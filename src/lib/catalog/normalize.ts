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
    .replace(/rs\.?|inr|rupees|rupaye|ka|ke|ki/g, " ")
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
  if (!query) return null;
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
