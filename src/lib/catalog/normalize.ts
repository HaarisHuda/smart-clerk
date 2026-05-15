import type { CatalogProduct } from "../types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:rs|inr|rupees|rupaye|ka|ke|ki)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es")) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function normalizeComparable(value: string): string {
  return normalizeSearch(value).split(" ").map(singularizeToken).join(" ");
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)),
  );
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      dp[row][col] = Math.min(
        dp[row - 1][col] + 1,
        dp[row][col - 1] + 1,
        dp[row - 1][col - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  return (longer - editDistance(a, b)) / longer;
}

function tokenFuzzyScore(query: string, target: string): number {
  const queryTokens = query.split(" ").filter(Boolean);
  const targetTokens = target.split(" ").filter(Boolean);
  if (!queryTokens.length || !targetTokens.length) return 0;

  const tokenScores = queryTokens.map((queryToken) =>
    Math.max(...targetTokens.map((targetToken) => similarity(queryToken, targetToken))),
  );
  return tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
}

const genericItemTokens = new Set([
  "ball",
  "bat",
  "racket",
  "racquet",
  "piece",
  "pc",
  "item",
  "stock",
  "unit",
]);

const queryStopWords = new Set([
  "aapke",
  "aapka",
  "add",
  "available",
  "bata",
  "batao",
  "bataiye",
  "bhai",
  "bhaiya",
  "bro",
  "chahiye",
  "create",
  "hai",
  "hain",
  "he",
  "ji",
  "kya",
  "me",
  "milega",
  "mil",
  "new",
  "packet",
  "paas",
  "pack",
  "pass",
  "price",
  "rate",
  "sir",
  "stock",
  "to",
  "wala",
  "wali",
]);

function hasMeaningfulTokenMatch(query: string, itemTerms: string[]): boolean {
  const queryTokens = query
    .split(" ")
    .filter((token) => token.length > 2 && !genericItemTokens.has(token));
  if (!queryTokens.length) return false;

  const targetTokens = itemTerms.flatMap((term) =>
    term.split(" ").filter((token) => token.length > 2 && !genericItemTokens.has(token)),
  );
  return queryTokens.some((queryToken) =>
    targetTokens.some((targetToken) => similarity(queryToken, targetToken) >= 0.75),
  );
}

function searchableQueryTokens(query: string): string[] {
  return normalizeComparable(query)
    .split(" ")
    .filter((token) => token.length > 1 && !queryStopWords.has(token));
}

function productTerms(product: CatalogProduct, includeCategory: boolean): string[] {
  return [
    product.itemName,
    ...(includeCategory ? [product.category] : []),
    ...product.aliases,
  ]
    .map(normalizeComparable)
    .filter(Boolean);
}

function productTokenScore(token: string, targetTokens: string[]): number {
  return Math.max(
    ...targetTokens.map((targetToken) => {
      if (token.length <= 3 || targetToken.length <= 3) {
        return token === targetToken ? 1 : 0;
      }
      return similarity(token, targetToken);
    }),
  );
}

function scoreProductQuery(product: CatalogProduct, query: string, includeCategory: boolean): number {
  const queryTokens = searchableQueryTokens(query);
  if (!queryTokens.length) return 0;

  const terms = productTerms(product, includeCategory);
  const targetTokens = terms.flatMap((term) => term.split(" ").filter(Boolean));
  if (!targetTokens.length) return 0;

  const compactQuery = queryTokens.join(" ");
  const exactTerm = terms.includes(compactQuery);
  const tokenScores = queryTokens.map((token) => productTokenScore(token, targetTokens));
  const allTokensMatched = tokenScores.every((score) => score >= 0.75);
  if (!exactTerm && !allTokensMatched) return 0;

  const averageTokenScore =
    tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const exactHits = tokenScores.filter((score) => score === 1).length;
  const phraseSimilarity = Math.max(...terms.map((term) => similarity(compactQuery, term)));

  return (
    (exactTerm ? 110 : 0) +
    averageTokenScore * 55 +
    exactHits * 12 +
    phraseSimilarity * 25
  );
}

export function findCatalogItemMatches(
  products: CatalogProduct[],
  query: string | null | undefined,
): CatalogProduct[] {
  if (!query) return [];

  return products
    .filter((product) => product.active)
    .map((product) => ({
      product,
      score: scoreProductQuery(product, query, true),
    }))
    .filter((entry) => entry.score >= 62)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

function scoreItemTerms(itemTerms: string[], normalizedQuery: string): number {
  const haystack = itemTerms.join(" ");
  const exactAlias = itemTerms.includes(normalizedQuery);
  const contains =
    haystack.includes(normalizedQuery) ||
    itemTerms.some((term) => normalizedQuery.includes(term));
  const queryTokens = normalizedQuery.split(" ");
  const hits = queryTokens.filter((token) => haystack.includes(token)).length;
  const phraseSimilarity = Math.max(...itemTerms.map((term) => similarity(normalizedQuery, term)));
  const fuzzyTokenScore = Math.max(...itemTerms.map((term) => tokenFuzzyScore(normalizedQuery, term)));

  return (
    (exactAlias ? 100 : 0) +
    (contains ? 40 : 0) +
    hits * 8 +
    phraseSimilarity * 35 +
    fuzzyTokenScore * 30
  );
}

export function findCatalogItemMatch(
  products: CatalogProduct[],
  query: string | null | undefined,
): CatalogProduct | null {
  const matches = findCatalogItemMatches(products, query);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return null;
  if (!query) return null;
  if (searchableQueryTokens(query).length > 1) return null;
  const normalizedQuery = normalizeComparable(query);
  if (!normalizedQuery) return null;

  const scored = products
    .filter((product) => product.active)
    .map((product) => {
      const itemTerms = [product.itemName, ...product.aliases].map(normalizeComparable);
      const meaningfulMatch = hasMeaningfulTokenMatch(normalizedQuery, itemTerms);
      return {
        product,
        score: meaningfulMatch ? scoreItemTerms(itemTerms, normalizedQuery) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 42 ? scored[0].product : null;
}

type ProductInput = Omit<Partial<CatalogProduct>, "aliases"> & {
  itemName: string;
  aliases?: string[] | string;
};

export function productFromInput(input: ProductInput): CatalogProduct {
  const now = new Date().toISOString();
  const aliases =
    typeof input.aliases === "string"
      ? input.aliases
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean)
      : input.aliases ?? [];

  return {
    id: input.id || `sku-${slugify(input.itemName)}`,
    itemName: input.itemName.trim(),
    category: input.category?.trim() || "General",
    price: Number(input.price ?? 0),
    stockQuantity: Number(input.stockQuantity ?? 0),
    aliases,
    active: input.active ?? true,
    lowStockThreshold: Number(input.lowStockThreshold ?? 3),
    updatedAt: input.updatedAt || now,
  };
}

export function findCatalogMatch(
  products: CatalogProduct[],
  query: string | null | undefined,
): CatalogProduct | null {
  if (!query) return null;
  const normalizedQuery = normalizeComparable(query);
  if (!normalizedQuery) return null;

  const scored = products
    .filter((product) => product.active)
    .map((product) => {
      const itemTerms = [product.itemName, product.category, ...product.aliases].map(normalizeComparable);
      return {
        product,
        score: scoreItemTerms(itemTerms, normalizedQuery),
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 35 ? scored[0].product : null;
}

export function lowStock(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter(
    (product) => product.active && product.stockQuantity <= product.lowStockThreshold,
  );
}
