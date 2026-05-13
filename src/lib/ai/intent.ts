import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages/messages";
import { GoogleGenAI } from "@google/genai";
import type { CatalogProduct, IntentExtraction, VoiceMutation } from "../types";
import { findCatalogItemMatch, normalizeSearch } from "../catalog/normalize";

const INTENT_THRESHOLD = Number(process.env.INTENT_CONFIDENCE_THRESHOLD ?? 0.75);
const INTENT_SHORT_CIRCUIT_CONFIDENCE = Number(
  process.env.AI_INTENT_SHORT_CIRCUIT_CONFIDENCE ?? 0.8,
);

const globalForAi = globalThis as typeof globalThis & {
  smartClerkAiRuntime?: {
    geminiBackoffUntil: number;
    lastGeminiQuotaLogAt: number;
  };
};

const aiRuntime = (globalForAi.smartClerkAiRuntime ??= {
  geminiBackoffUntil: 0,
  lastGeminiQuotaLogAt: 0,
});

export function getIntentThreshold(): number {
  return INTENT_THRESHOLD;
}

const intentTool: Tool = {
  name: "extract_customer_intent",
  description: "Extract structured retail intent from a Hinglish customer message.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["price_query", "stock_query", "reserve_item", "bulk_discount", "greeting", "ambiguous"],
      },
      item: { type: ["string", "null"] },
      quantity: { type: ["number", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["intent", "item", "quantity", "confidence"],
  },
};

const voiceTool: Tool = {
  name: "extract_stock_mutation",
  description: "Extract a structured stock mutation from an owner's voice transcript.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "set", "subtract", "update_price", "update_category", "delete", "unknown"],
      },
      item: { type: ["string", "null"] },
      quantity: { type: ["number", "null"] },
      price: { type: ["number", "null"] },
      category: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["action", "item", "quantity", "price", "category", "confidence"],
  },
};

type ToolUseBlock<T> = {
  type: "tool_use";
  input: T;
};

function isToolUseBlock<T>(block: unknown): block is ToolUseBlock<T> {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    (block as { type?: unknown }).type === "tool_use" &&
    "input" in block
  );
}

export async function extractIntent(
  message: string,
  products: CatalogProduct[],
): Promise<IntentExtraction> {
  const deterministic = heuristicIntent(message, products);
  if (
    process.env.AI_PROVIDER === "local" ||
    process.env.AI_PROVIDER === "none" ||
    deterministic.confidence >= INTENT_SHORT_CIRCUIT_CONFIDENCE
  ) {
    return deterministic;
  }

  if (process.env.AI_PROVIDER === "gemini") {
    return extractIntentWithGemini(message, products);
  }

  if (process.env.AI_PROVIDER === "anthropic" || process.env.ANTHROPIC_API_KEY) {
    return extractIntentWithAnthropic(message, products);
  }

  return deterministic;
}

async function extractIntentWithAnthropic(
  message: string,
  products: CatalogProduct[],
): Promise<IntentExtraction> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicIntent(message, products);
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 400,
      temperature: 0,
      tools: [intentTool],
      tool_choice: { type: "tool", name: "extract_customer_intent" },
      messages: [
        {
          role: "user",
          content: [
            "You are extracting intent for an Indian sports store WhatsApp AI clerk.",
            "Return only the tool call. Use Hinglish context.",
            "reserve_item means the customer is clearly asking to pack/reserve/buy a quantity.",
            "Do not infer a reservation from a price or availability question.",
            `Available inventory: ${JSON.stringify(
              products.map((product) => ({
                itemName: product.itemName,
                aliases: product.aliases,
                stockQuantity: product.stockQuantity,
                price: product.price,
              })),
            )}`,
            `Customer message: ${message}`,
          ].join("\n"),
        },
      ],
    });

    const toolUse = (response.content as unknown[]).find(isToolUseBlock<IntentExtraction>);
    return { ...sanitizeIntent(toolUse?.input ?? heuristicIntent(message, products)), source: "ai" };
  } catch (error) {
    console.warn(
      "Anthropic intent extraction failed; falling back to heuristic parser.",
      shortAiError(error),
    );
    return { ...heuristicIntent(message, products), source: "fallback" };
  }
}

async function extractIntentWithGemini(
  message: string,
  products: CatalogProduct[],
): Promise<IntentExtraction> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return heuristicIntent(message, products);
  }
  if (Date.now() < aiRuntime.geminiBackoffUntil) {
    return { ...heuristicIntent(message, products), source: "fallback" };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        "Extract structured retail intent from this Indian sports store WhatsApp message.",
        "Return strict JSON only, with no markdown.",
        'Schema: {"intent":"price_query|stock_query|reserve_item|bulk_discount|greeting|ambiguous","item":string|null,"quantity":number|null,"confidence":number}',
        "reserve_item means the customer is clearly asking to pack/reserve/buy a quantity.",
        "Do not infer reservation from price or availability questions.",
        `Available inventory: ${JSON.stringify(
          products.map((product) => ({
            itemName: product.itemName,
            aliases: product.aliases,
            stockQuantity: product.stockQuantity,
            price: product.price,
          })),
        )}`,
        `Customer message: ${message}`,
      ].join("\n"),
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    return {
      ...sanitizeIntent(
        parseJsonResponse<IntentExtraction>(response.text) ?? heuristicIntent(message, products),
      ),
      source: "ai",
    };
  } catch (error) {
    if (!handleGeminiQuotaError(error)) {
      console.warn("Gemini intent extraction failed; falling back to heuristic parser.", shortAiError(error));
    }
    return { ...heuristicIntent(message, products), source: "fallback" };
  }
}

export async function extractVoiceMutation(transcript: string): Promise<VoiceMutation> {
  const deterministic = heuristicVoiceMutation(transcript);
  if (deterministic.confidence >= 0.75) {
    return deterministic;
  }

  if (process.env.AI_PROVIDER === "gemini") {
    return extractVoiceMutationWithGemini(transcript);
  }

  if (process.env.AI_PROVIDER === "anthropic" || process.env.ANTHROPIC_API_KEY) {
    return extractVoiceMutationWithAnthropic(transcript);
  }

  return heuristicVoiceMutation(transcript);
}

async function extractVoiceMutationWithAnthropic(transcript: string): Promise<VoiceMutation> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicVoiceMutation(transcript);
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 300,
      temperature: 0,
      tools: [voiceTool],
      tool_choice: { type: "tool", name: "extract_stock_mutation" },
      messages: [
        {
          role: "user",
          content: `Extract the stock mutation from this owner transcript: ${transcript}`,
        },
      ],
    });
    const toolUse = (response.content as unknown[]).find(isToolUseBlock<VoiceMutation>);
    return sanitizeVoiceMutation(toolUse?.input ?? heuristicVoiceMutation(transcript));
  } catch (error) {
    console.warn(
      "Anthropic voice extraction failed; falling back to heuristic parser.",
      shortAiError(error),
    );
    return heuristicVoiceMutation(transcript);
  }
}

async function extractVoiceMutationWithGemini(transcript: string): Promise<VoiceMutation> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return heuristicVoiceMutation(transcript);
  }
  if (Date.now() < aiRuntime.geminiBackoffUntil) {
    return heuristicVoiceMutation(transcript);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        "Extract a stock mutation from this shop owner voice transcript.",
        "Return strict JSON only, with no markdown.",
        'Schema: {"action":"add|set|subtract|update_price|update_category|delete|unknown","item":string|null,"quantity":number|null,"price":number|null,"category":string|null,"confidence":number}',
        "Preserve the item phrase literally from the transcript. Do not replace it with a similar inventory item.",
        "For price commands like 'update price to 20 rupees for SG cricket balls', use action update_price, price 20, item SG cricket balls, quantity null.",
        "For category commands like 'set category of media balls to Football', use action update_category, category Football, item media balls.",
        "For delete commands like 'delete SG cricket balls', use action delete.",
        `Transcript: ${transcript}`,
      ].join("\n"),
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    return sanitizeVoiceMutation(
      parseJsonResponse<VoiceMutation>(response.text) ?? heuristicVoiceMutation(transcript),
    );
  } catch (error) {
    if (!handleGeminiQuotaError(error)) {
      console.warn("Gemini voice extraction failed; falling back to heuristic parser.", shortAiError(error));
    }
    return heuristicVoiceMutation(transcript);
  }
}

function handleGeminiQuotaError(error: unknown): boolean {
  const message = aiErrorMessage(error);
  const isQuotaError =
    message.includes('"code":429') ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota exceeded");
  if (!isQuotaError) return false;

  aiRuntime.geminiBackoffUntil = Date.now() + (extractRetryDelayMs(message) ?? 60_000);
  const shouldLog = Date.now() - aiRuntime.lastGeminiQuotaLogAt > 60_000;
  if (shouldLog) {
    aiRuntime.lastGeminiQuotaLogAt = Date.now();
    console.warn(
      "Gemini quota exhausted; using local parser until quota recovers.",
      shortAiError(error),
    );
  }
  return true;
}

function extractRetryDelayMs(message: string): number | null {
  const retryMatch =
    message.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i) ??
    message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  return retryMatch ? Math.ceil(Number(retryMatch[1]) * 1000) : null;
}

function shortAiError(error: unknown): string {
  const message = aiErrorMessage(error);
  try {
    const parsed = JSON.parse(message) as {
      error?: { code?: number; status?: string; message?: string };
    };
    if (parsed.error) {
      const firstLine = parsed.error.message?.split("\n")[0] ?? "AI request failed";
      return `${parsed.error.code ?? "unknown"} ${parsed.error.status ?? "error"}: ${firstLine}`;
    }
  } catch {
    // Fall through to a compact raw message.
  }
  return message.split("\n")[0].slice(0, 260);
}

function aiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown AI error";
  }
}

function parseJsonResponse<T>(text: string | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function sanitizeIntent(input: IntentExtraction): IntentExtraction {
  return {
    intent: input.intent ?? "ambiguous",
    item: input.item || null,
    quantity: input.quantity ? Math.max(1, Math.floor(Number(input.quantity))) : null,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0))),
    source: input.source,
  };
}

function sanitizeVoiceMutation(input: VoiceMutation): VoiceMutation {
  return {
    action: input.action ?? "unknown",
    item: input.item || null,
    quantity: input.quantity ? Math.max(1, Math.floor(Number(input.quantity))) : null,
    price:
      typeof input.price === "number" && Number.isFinite(input.price)
        ? Math.max(0, Number(input.price))
        : null,
    category: input.category?.trim() || null,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0))),
  };
}

function heuristicIntent(message: string, products: CatalogProduct[]): IntentExtraction {
  const text = normalizeSearch(message);
  const quantity = extractQuantity(text);
  const matched = findCatalogItemMatch(products, text);
  const reserveWords = [
    "pack",
    "rakh",
    "reserve",
    "bhej",
    "bhejo",
    "de do",
    "dedo",
    "kar do",
    "kardo",
    "chahiye",
    "lena",
  ];
  const priceWords = ["price", "rate", "kitne", "kitna", "daam", "rs"];
  const stockWords = ["hai kya", "available", "stock", "milega", "mil jayega"];

  if (reserveWords.some((word) => text.includes(word))) {
    return {
      intent: "reserve_item",
      item: matched?.itemName ?? null,
      quantity,
      confidence: matched ? 0.82 : 0.62,
      source: "local",
    };
  }
  if (priceWords.some((word) => text.includes(word))) {
    return {
      intent: "price_query",
      item: matched?.itemName ?? null,
      quantity,
      confidence: matched ? 0.86 : 0.55,
      source: "local",
    };
  }
  if (stockWords.some((word) => text.includes(word)) || matched) {
    return {
      intent: "stock_query",
      item: matched?.itemName ?? null,
      quantity,
      confidence: matched ? 0.86 : 0.55,
      source: "local",
    };
  }
  if (["hi", "hello", "namaste", "bhaiya"].some((word) => text.includes(word))) {
    return { intent: "greeting", item: null, quantity: null, confidence: 0.65, source: "local" };
  }
  return { intent: "ambiguous", item: null, quantity: null, confidence: 0.4, source: "local" };
}

function heuristicVoiceMutation(transcript: string): VoiceMutation {
  const text = normalizeSearch(transcript);
  const explicitCategory = extractCategoryCommand(text);
  if (explicitCategory) {
    return {
      action: "update_category",
      item: explicitCategory.item,
      quantity: null,
      price: null,
      category: explicitCategory.category,
      confidence: 0.86,
    };
  }

  const explicitPrice = extractPriceCommand(text);
  if (explicitPrice) {
    return {
      action: "update_price",
      item: explicitPrice.item,
      quantity: null,
      price: explicitPrice.price,
      category: null,
      confidence: 0.86,
    };
  }

  const quantity = extractQuantity(text);
  const price = extractPrice(text);
  const action = text.includes("delete") || text.includes("remove item") || text.includes("hata do")
    ? "delete"
    : text.includes("category")
      ? "update_category"
    : text.includes("price") || text.includes("rate") || text.includes("rupees") || text.includes("rupaye")
      ? "update_price"
      : text.includes("set")
    ? "set"
    : text.includes("subtract") || text.includes("remove") || text.includes("minus")
      ? "subtract"
      : text.includes("add")
        ? "add"
        : "unknown";
  const item = text
    .replace(/\b(add|set|subtract|remove|delete|hata|do|update|change|price|rate|rupees|rupaye|rs|to|for|stock|quantity|qty|piece|pieces|pcs)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    action,
    item: item || null,
    quantity: action === "update_price" || action === "update_category" ? null : quantity,
    price,
    category: null,
    confidence:
      action === "update_price"
        ? item && price !== null
          ? 0.8
          : 0.45
        : action === "update_category"
          ? 0.45
        : action === "delete"
          ? item
            ? 0.78
            : 0.45
          : action !== "unknown" && item && quantity
            ? 0.8
            : 0.45,
  };
}

function cleanCategory(value: string): string {
  return value
    .replace(/\b(category|to|as|at|of|for|set|update|change)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractCategoryCommand(text: string): { item: string; category: string } | null {
  const patterns = [
    /\b(?:set|update|change)\s+(?:the\s+)?category\s+(?:of|for)\s+(.+?)\s+(?:to|as|at)\s+(.+)\b/,
    /\b(?:set|update|change)\s+(.+?)\s+category\s+(?:to|as|at)\s+(.+)\b/,
    /\b(.+?)\s+category\s+(?:to|as|at)?\s+(.+)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const item = match[1]
      .replace(/\b(category|to|as|at|of|for|set|update|change)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const category = cleanCategory(match[2]);
    if (item && category) {
      return { item, category };
    }
  }
  return null;
}

function extractPriceCommand(text: string): { item: string; price: number } | null {
  const patterns = [
    /\b(?:set|update|change)\s+(?:the\s+)?(?:price|rate)\s+(?:of\s+|for\s+)?(.+?)\s+(?:to|as|at)\s+(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*(?:rupees|rupaye|rs))?\b/,
    /\b(?:set|update|change)\s+(.+?)\s+(?:price|rate)\s+(?:to|as|at)?\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*(?:rupees|rupaye|rs))?\b/,
    /\b(.+?)\s+(?:price|rate)\s+(?:to|as|at)?\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*(?:rupees|rupaye|rs))?\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const item = match[1]
      .replace(/\b(price|rate|rs|rupees|rupaye|to|as|at|of|for)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const price = Number(match[2]);
    if (item && Number.isFinite(price)) {
      return { item, price };
    }
  }
  return null;
}

function extractQuantity(text: string): number | null {
  const match = text.match(/\b(\d+)\b/);
  if (match) return Number(match[1]);
  if (/\b(do|two)\b/.test(text)) return 2;
  if (/\b(teen|three)\b/.test(text)) return 3;
  if (/\b(ek|one)\b/.test(text)) return 1;
  return null;
}

function extractPrice(text: string): number | null {
  const priceMatch =
    text.match(/\b(?:price|rate|rs|rupees|rupaye)\s*(?:to|is|at)?\s*(\d+(?:\.\d+)?)\b/) ??
    text.match(/\b(\d+(?:\.\d+)?)\s*(?:rs|rupees|rupaye)\b/);
  return priceMatch ? Number(priceMatch[1]) : null;
}
