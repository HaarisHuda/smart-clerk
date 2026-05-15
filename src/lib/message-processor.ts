import { randomUUID } from "node:crypto";
import { extractIntent, getIntentThreshold } from "./ai/intent";
import { findCatalogItemMatch, findCatalogItemMatches, normalizeSearch } from "./catalog/normalize";
import { getCachedCatalog } from "./catalog/cache";
import { publishEvent } from "./events";
import {
  addIgnoredMessage,
  getCustomerState,
  getRuntimeSettings,
  hasProcessedExternalMessage,
  markExternalMessageProcessed,
  saveCustomerState,
} from "./local-store";
import { getWhatsAppWebDemoProvider } from "./messaging/whatsapp-web-demo";
import { reserveItem } from "./reservation";
import { writeConversationToSource } from "./sheets";
import type { ConversationMessage, IncomingCustomerMessage, MessagingProvider } from "./types";

type MessageProcessorOptions = {
  sendViaProvider?: boolean;
  messagingProvider?: MessagingProvider;
};

type ProcessorResult = {
  reply: string;
  handledByAi: boolean;
  replySource?: ConversationMessage["replySource"];
  ignoredReason?: string;
};

type CustomerLockState = Promise<void>;

const customerLocks = new Map<string, CustomerLockState>();
const CONTEXT_TTL_MS = Number(process.env.CUSTOMER_CONTEXT_TTL_MINUTES ?? 20) * 60_000;

export async function processIncomingCustomerMessage(
  incoming: IncomingCustomerMessage,
  options: MessageProcessorOptions = {},
): Promise<ProcessorResult> {
  return withCustomerLock(incoming.from, () => processIncomingCustomerMessageUnlocked(incoming, options));
}

async function withCustomerLock<T>(customerPhone: string, work: () => Promise<T>): Promise<T> {
  const previous = customerLocks.get(customerPhone) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  customerLocks.set(customerPhone, chained);
  await previous;

  try {
    return await work();
  } finally {
    release();
    if (customerLocks.get(customerPhone) === chained) {
      customerLocks.delete(customerPhone);
    }
  }
}

async function processIncomingCustomerMessageUnlocked(
  incoming: IncomingCustomerMessage,
  options: MessageProcessorOptions,
): Promise<ProcessorResult> {
  const ignoredChatReason = getIgnoredChatReason(incoming);
  if (ignoredChatReason) {
    await recordIgnoredMessage(incoming, ignoredChatReason);
    return {
      reply: "Group or broadcast chat ignored.",
      handledByAi: false,
      replySource: "ignored",
      ignoredReason: ignoredChatReason,
    };
  }

  if (incoming.externalId && (await hasProcessedExternalMessage(incoming.externalId))) {
    return {
      reply: "Duplicate message ignored.",
      handledByAi: false,
    };
  }
  if (incoming.externalId) {
    await markExternalMessageProcessed(incoming.externalId);
  }

  await logConversation({
    customerPhone: incoming.from,
    direction: "inbound",
    actor: "customer",
    body: incoming.body,
  });

  const settings = await getRuntimeSettings();
  if (!settings.aiClerkActive) {
    await recordIgnoredMessage(incoming, "ai_paused");
    return {
      reply: "AI Clerk is paused.",
      handledByAi: false,
      replySource: "ignored",
      ignoredReason: "ai_paused",
    };
  }

  const state = await getCustomerState(incoming.from);
  if (state.humanTakeover) {
    await recordIgnoredMessage(incoming, "human_takeover");
    return {
      reply: "Human takeover active. AI did not reply.",
      handledByAi: false,
      replySource: "ignored",
      ignoredReason: "human_takeover",
    };
  }

  const catalog = await getCachedCatalog();
  const contextualProduct =
    isContextActive(state)
      ? catalog.products.find((product) => product.id === state.lastProductId && product.active) ??
        null
      : null;
  const businessGateReason = getBusinessGateIgnoreReason(
    incoming,
    catalog.products,
    Boolean(contextualProduct),
  );
  if (businessGateReason) {
    await recordIgnoredMessage(incoming, businessGateReason);
    return {
      reply: "Non-business message ignored.",
      handledByAi: false,
      replySource: "ignored",
      ignoredReason: businessGateReason,
    };
  }

  const explicitMatches = findCatalogItemMatches(catalog.products, incoming.body);
  const explicitMatch =
    explicitMatches.length === 1
      ? explicitMatches[0]
      : findCatalogItemMatch(catalog.products, incoming.body);
  const catalogListReply = await handleCatalogListQuery({
    incoming,
    options,
    state,
    matches: explicitMatches,
  });
  if (catalogListReply) {
    return catalogListReply;
  }
  const contextualReply = await handleContextualFollowUp({
    incoming,
    options,
    state,
    contextualProduct,
    explicitMatch,
  });
  if (contextualReply) {
    return contextualReply;
  }

  const intent = await extractIntent(incoming.body, catalog.products);
  const threshold = getIntentThreshold();
  let reply: string;
  const replySource = intent.source ?? "local";

  if (intent.intent === "reserve_item" && intent.confidence >= threshold) {
    const groundedIntentItem = isIntentItemGrounded(intent.item, incoming.body)
      ? intent.item
      : null;
    const itemFromContext =
      explicitMatch?.itemName ||
      groundedIntentItem ||
      catalog.products.find((product) => product.id === state.lastProductId)?.itemName ||
      null;
    if (!itemFromContext) {
      reply = "Kaunsa item pack karna hai? Item ka naam bata dijiye.";
    } else {
      const result = await reserveItem({
        customerPhone: incoming.from,
        customerName: incoming.customerName,
        item: itemFromContext,
        quantity: intent.quantity ?? 1,
      });
      if (result.ok) {
        reply = `Done ji. ${result.order.quantity}x ${result.order.itemName} pack kar diya. Counter par Rs. ${result.order.amount} collect hoga.`;
        await clearContextState(state);
        await notifyOwner(
          `New pickup order from ${incoming.customerName || incoming.from}: ${result.order.quantity}x ${result.order.itemName}. Collect Rs. ${result.order.amount} at counter.`,
          options,
        );
      } else if (result.product) {
        reply = `Sorry ji, ${result.product.itemName} ke sirf ${result.product.stockQuantity} piece bache hain. Quantity kam kar dun?`;
        await saveContextState(state, {
          lastProductId: result.product.id,
          lastIntent: "reserve_item",
          awaitingQuantity: true,
        });
      } else {
        const requestedItem = extractRequestedItemLabel(incoming.body) ?? itemFromContext;
        reply = requestedItem
          ? `Sorry ji, ${requestedItem} abhi stock me nahi hai. Koi aur item chahiye ho to naam bhej dijiye.`
          : "Sorry ji, ye item catalog me nahi mil raha. Thoda exact naam bhej dijiye.";
      }
    }
  } else {
    const matched =
      explicitMatch ??
      (isIntentItemGrounded(intent.item, incoming.body)
        ? findCatalogItemMatch(catalog.products, intent.item)
        : null) ??
      (intent.item ? null : contextualProduct);
    if (matched && matched.stockQuantity > 0) {
      if (asksStockCount(incoming.body)) {
        reply = `Abhi ${matched.itemName} ke ${matched.stockQuantity} piece stock me hain. Rs. ${matched.price} ka hai. Kitne piece pack karun?`;
      } else if (intent.intent === "price_query") {
        reply = `Haan ji, ${matched.itemName} Rs. ${matched.price} ka hai. Abhi ${matched.stockQuantity} piece stock me hain. Kitne piece pack karun?`;
      } else {
        reply = `Haan ji, ${matched.itemName} available hai. Rs. ${matched.price} ka hai. Kitne piece pack karun?`;
      }
      await saveCustomerState({
        ...state,
        lastProductId: matched.id,
        lastIntent: intent.intent,
        awaitingQuantity: true,
        contextExpiresAt: nextContextExpiry(),
      });
    } else if (matched) {
      const alternative = catalog.products.find(
        (product) =>
          product.active &&
          product.stockQuantity > 0 &&
          product.category === matched.category &&
          product.id !== matched.id,
      );
      reply = alternative
        ? `Sorry ji, ${matched.itemName} abhi out of stock hai. ${alternative.itemName} available hai Rs. ${alternative.price} me.`
        : `Sorry ji, ${matched.itemName} abhi out of stock hai.`;
      await saveContextState(state, {
        lastProductId: matched.id,
        lastIntent: intent.intent,
        awaitingQuantity: false,
      });
    } else if (isUnavailableCatalogQuery(incoming.body, intent.intent)) {
      const requestedItem = extractRequestedItemLabel(incoming.body);
      reply = requestedItem
        ? `Sorry ji, ${requestedItem} abhi stock me nahi hai. Koi aur sports item chahiye ho to naam bhej dijiye.`
        : "Kaunsa item chahiye ji? Item ka naam bhej dijiye, main stock check kar deta hun.";
    } else if (intent.intent === "greeting") {
      reply = "Namaste ji. Kaunsa sports item chahiye? Naam bhejiye, main stock aur price check kar deta hun.";
    } else {
      reply = "Thoda exact item naam bhej dijiye ji, main price aur stock turant check kar deta hun.";
    }
  }

  await logConversation({
    customerPhone: incoming.from,
    direction: "outbound",
    actor: "ai",
    body: reply,
    intent,
    replySource,
  });

  if (options.sendViaProvider) {
    await getMessagingProvider(options).sendMessage({ to: incoming.from, body: reply });
  }

  return { reply, handledByAi: true, replySource };
}

async function handleCatalogListQuery(params: {
  incoming: IncomingCustomerMessage;
  options: MessageProcessorOptions;
  state: Awaited<ReturnType<typeof getCustomerState>>;
  matches: Awaited<ReturnType<typeof getCachedCatalog>>["products"];
}): Promise<ProcessorResult | null> {
  const { incoming, options, state, matches } = params;
  const requestedItem = extractRequestedItemLabel(incoming.body);
  if (!requestedItem || !shouldListCatalogMatches(incoming.body, matches)) return null;

  const inStock = matches.filter((product) => product.stockQuantity > 0);
  let reply: string;

  if (!inStock.length) {
    reply = `Sorry ji, ${requestedItem} abhi stock me nahi hai. Koi aur item chahiye ho to naam bhej dijiye.`;
    await clearContextState(state);
  } else if (inStock.length === 1) {
    const product = inStock[0];
    reply = `Haan ji, ${requestedItem} me ${product.itemName} available hai. Rs. ${product.price} ka hai (${product.stockQuantity} piece stock). Kitne piece pack karun?`;
    await saveContextState(state, {
      lastProductId: product.id,
      lastIntent: "stock_query",
      awaitingQuantity: true,
    });
  } else {
    const optionsList = inStock
      .slice(0, 6)
      .map(
        (product, index) =>
          `${index + 1}. ${product.itemName} - Rs. ${product.price} (${product.stockQuantity} pcs)`,
      )
      .join("\n");
    reply = `Haan ji, ${requestedItem} me ye options available hain:\n${optionsList}\nKaunsa brand pack karun?`;
    await clearContextState(state);
  }

  await logConversation({
    customerPhone: incoming.from,
    direction: "outbound",
    actor: "ai",
    body: reply,
    replySource: "local",
  });

  if (options.sendViaProvider) {
    await getMessagingProvider(options).sendMessage({ to: incoming.from, body: reply });
  }

  return { reply, handledByAi: true, replySource: "local" };
}

async function handleContextualFollowUp(params: {
  incoming: IncomingCustomerMessage;
  options: MessageProcessorOptions;
  state: Awaited<ReturnType<typeof getCustomerState>>;
  contextualProduct: Awaited<ReturnType<typeof getCachedCatalog>>["products"][number] | null;
  explicitMatch: Awaited<ReturnType<typeof getCachedCatalog>>["products"][number] | null;
}): Promise<ProcessorResult | null> {
  const { incoming, options, state, contextualProduct, explicitMatch } = params;
  if (!contextualProduct || explicitMatch) return null;

  const text = normalizeSearch(incoming.body);
  const quantity = extractStandaloneQuantity(text);
  const reservationQuantity = extractQuantity(text);
  let reply: string | null = null;
  let awaitingQuantity = state.awaitingQuantity ?? true;
  let lastIntent = state.lastIntent ?? "ambiguous";
  let shouldCloseContext = false;

  if (state.awaitingQuantity === false && isSettledAcknowledgement(text)) {
    await clearContextState(state);
    await recordIgnoredMessage(incoming, "post_order_ack");
    return {
      reply: "Post-order acknowledgement ignored.",
      handledByAi: false,
      replySource: "ignored",
      ignoredReason: "post_order_ack",
    };
  }

  if (isLaterOrDecline(text)) {
    reply = `Theek hai ji. Jab chahiye ho message kar dena, main ${contextualProduct.itemName} ka stock check kar dunga.`;
    awaitingQuantity = false;
    lastIntent = "ambiguous";
    shouldCloseContext = true;
  } else if (quantity && state.awaitingQuantity !== false) {
    const result = await reserveItem({
      customerPhone: incoming.from,
      customerName: incoming.customerName,
      item: contextualProduct.itemName,
      quantity,
    });
    const handled = await replyFromReservation(result, incoming, options);
    reply = handled.reply;
    awaitingQuantity = handled.awaitingQuantity;
    shouldCloseContext = handled.shouldCloseContext;
    lastIntent = "reserve_item";
  } else if (quantity) {
    reply = `${quantity}x ${contextualProduct.itemName} pack karna hai? Confirm karne ke liye "${quantity} pack kar do" bhej dijiye.`;
    awaitingQuantity = true;
    lastIntent = "reserve_item";
  } else if (reservationQuantity && isReserveFollowUp(text)) {
    const result = await reserveItem({
      customerPhone: incoming.from,
      customerName: incoming.customerName,
      item: contextualProduct.itemName,
      quantity: reservationQuantity,
    });
    const handled = await replyFromReservation(result, incoming, options);
    reply = handled.reply;
    awaitingQuantity = handled.awaitingQuantity;
    shouldCloseContext = handled.shouldCloseContext;
    lastIntent = "reserve_item";
  } else if (isReserveFollowUp(text) || isAffirmative(text)) {
    if (state.awaitingQuantity !== false) {
      reply = `Kitne piece ${contextualProduct.itemName} pack karun ji?`;
      awaitingQuantity = true;
      lastIntent = "reserve_item";
    } else {
      reply = `Aap ${contextualProduct.itemName} pack karwana chahte hain? Quantity bata dijiye ji.`;
      awaitingQuantity = true;
      lastIntent = "reserve_item";
    }
  } else if (isStockFollowUp(text) || isPriceFollowUp(text)) {
    reply = `Abhi ${contextualProduct.itemName} ke ${contextualProduct.stockQuantity} piece stock me hain. Rs. ${contextualProduct.price} ka hai. Kitne piece pack karun?`;
    awaitingQuantity = true;
    lastIntent = isPriceFollowUp(text) ? "price_query" : "stock_query";
  } else if (isVagueQuantity(text)) {
    reply = `Quantity bata dijiye ji. Abhi ${contextualProduct.itemName} ke ${contextualProduct.stockQuantity} piece stock me hain.`;
    awaitingQuantity = true;
    lastIntent = "reserve_item";
  } else if (isPunctuationOnly(incoming.body)) {
    reply = `${contextualProduct.itemName} available hai ji. Rs. ${contextualProduct.price} ka hai. Kitne piece pack karun?`;
    awaitingQuantity = true;
    lastIntent = "stock_query";
  }

  if (!reply) return null;

  if (shouldCloseContext) {
    await clearContextState(state);
  } else {
    await saveContextState(state, {
      lastProductId: contextualProduct.id,
      lastIntent,
      awaitingQuantity,
    });
  }

  await logConversation({
    customerPhone: incoming.from,
    direction: "outbound",
    actor: "ai",
    body: reply,
    replySource: "context",
  });

  if (options.sendViaProvider) {
    await getMessagingProvider(options).sendMessage({ to: incoming.from, body: reply });
  }

  return { reply, handledByAi: true, replySource: "context" };
}

async function replyFromReservation(
  result: Awaited<ReturnType<typeof reserveItem>>,
  incoming: IncomingCustomerMessage,
  options: MessageProcessorOptions,
): Promise<{ reply: string; awaitingQuantity: boolean; shouldCloseContext: boolean }> {
  if (result.ok) {
    await notifyOwner(
      `New pickup order from ${incoming.customerName || incoming.from}: ${result.order.quantity}x ${result.order.itemName}. Collect Rs. ${result.order.amount} at counter.`,
      options,
    );
    return {
      reply: `Done ji. ${result.order.quantity}x ${result.order.itemName} pack kar diya. Counter par Rs. ${result.order.amount} collect hoga.`,
      awaitingQuantity: false,
      shouldCloseContext: true,
    };
  }

  if (result.product) {
    return {
      reply: `Sorry ji, ${result.product.itemName} ke sirf ${result.product.stockQuantity} piece bache hain. Quantity kam kar dun?`,
      awaitingQuantity: true,
      shouldCloseContext: false,
    };
  }

  return {
    reply: "Sorry ji, ye item catalog me nahi mil raha. Thoda exact naam bhej dijiye.",
    awaitingQuantity: false,
    shouldCloseContext: true,
  };
}

function getIgnoredChatReason(incoming: IncomingCustomerMessage): string | null {
  if (incoming.isGroup && process.env.WHATSAPP_WEB_ALLOW_GROUPS !== "true") {
    return "group_chat";
  }
  if (incoming.from.endsWith("@g.us") && process.env.WHATSAPP_WEB_ALLOW_GROUPS !== "true") {
    return "group_chat";
  }
  if (incoming.from.endsWith("@broadcast") || incoming.from === "status@broadcast") {
    return "broadcast_chat";
  }
  return null;
}

function getBusinessGateIgnoreReason(
  incoming: IncomingCustomerMessage,
  products: Awaited<ReturnType<typeof getCachedCatalog>>["products"],
  hasActiveContext: boolean,
): string | null {
  if (isEmojiOnly(incoming.body) && !hasActiveContext) return "non_business_emoji";
  const text = normalizeSearch(incoming.body);
  if (!text) return "empty_message";
  if (isPlainGreeting(text) && !hasActiveContext) return "non_business_greeting";
  if (incoming.hasMedia && !hasBusinessSignal(text, products, hasActiveContext)) {
    return "non_business_media";
  }
  if (
    incoming.messageType &&
    incoming.messageType !== "chat" &&
    !hasBusinessSignal(text, products, hasActiveContext)
  ) {
    return `non_business_${incoming.messageType}`;
  }
  if (isUrlOnlyOrForwarded(text, incoming) && !hasBusinessSignal(text, products, hasActiveContext)) {
    return "non_business_link_or_forward";
  }
  if (!hasBusinessSignal(text, products, hasActiveContext)) {
    return "non_business_message";
  }
  return null;
}

function hasBusinessSignal(
  normalizedText: string,
  products: Awaited<ReturnType<typeof getCachedCatalog>>["products"],
  hasActiveContext: boolean,
): boolean {
  if (findCatalogItemMatch(products, normalizedText)) return true;
  if (isBusinessPhrase(normalizedText)) return true;
  if (hasActiveContext && isContextFollowUpSignal(normalizedText)) return true;
  if (hasActiveContext && isStandaloneBusinessQuantity(normalizedText)) return true;
  return false;
}

function isBusinessPhrase(text: string): boolean {
  return /\b(price|rate|daam|stock|available|hai kya|milega|mil jayega|kitne|kitna|pack|rakh|rakho|reserve|bhej|bhejo|de do|dedo|chahiye|lena|bill|pickup|piece|pieces|pc|pcs|order)\b/.test(
    text,
  );
}

function isPlainGreeting(text: string): boolean {
  return /^(hi|hello|hey|hii+|helo|namaste|namaskar|yo|sup|hi bro|hi bhai|hi bbg)$/.test(text);
}

function isEmojiOnly(value: string): boolean {
  const compact = value.replace(/\s/g, "");
  if (!compact) return false;
  return !/[a-z0-9]/i.test(compact) && /\p{Extended_Pictographic}/u.test(compact);
}

function isStandaloneBusinessQuantity(text: string): boolean {
  return Boolean(extractStandaloneQuantity(text));
}

function isContextFollowUpSignal(text: string): boolean {
  return (
    isVagueQuantity(text) ||
    isAffirmative(text) ||
    isLaterOrDecline(text) ||
    isStockFollowUp(text) ||
    isPriceFollowUp(text) ||
    isPunctuationOnly(text)
  );
}

function isUrlOnlyOrForwarded(text: string, incoming: IncomingCustomerMessage): boolean {
  return (
    /\bhttps?\b|\bdrive google\b|\bwww\b|\bcom\b/.test(text) ||
    Boolean(incoming.hasQuotedMessage || incoming.mentionedIds?.length)
  );
}

async function recordIgnoredMessage(
  incoming: IncomingCustomerMessage,
  reason: string,
): Promise<void> {
  const ignored = await addIgnoredMessage({
    from: incoming.from,
    body: incoming.body,
    customerName: incoming.customerName,
    isGroup: incoming.isGroup,
    reason,
  });
  publishEvent({ type: "ignored.message", message: ignored });
}

function isContextActive(state: Awaited<ReturnType<typeof getCustomerState>>): boolean {
  if (!state.lastProductId || !state.contextExpiresAt) return false;
  return new Date(state.contextExpiresAt).getTime() > Date.now();
}

async function saveContextState(
  state: Awaited<ReturnType<typeof getCustomerState>>,
  patch: Partial<Awaited<ReturnType<typeof getCustomerState>>>,
): Promise<void> {
  await saveCustomerState({
    ...state,
    ...patch,
    contextExpiresAt: nextContextExpiry(),
  });
}

async function clearContextState(
  state: Awaited<ReturnType<typeof getCustomerState>>,
): Promise<void> {
  await saveCustomerState({
    ...state,
    lastProductId: undefined,
    lastIntent: undefined,
    awaitingQuantity: false,
    contextExpiresAt: undefined,
  });
}

function nextContextExpiry(): string {
  return new Date(Date.now() + CONTEXT_TTL_MS).toISOString();
}

function extractStandaloneQuantity(text: string): number | null {
  const normalized = text.trim();
  const numeric = normalized.match(/^(\d+)(?:\s*(?:piece|pieces|pc|pcs))?$/);
  if (numeric) return Number(numeric[1]);

  if (/^(?:ek|one)(?:\s*(?:piece|pieces|pc|pcs))?$/.test(normalized)) return 1;
  if (/^(?:do|two)(?:\s*(?:piece|pieces|pc|pcs))?$/.test(normalized)) return 2;
  if (/^(?:teen|three)(?:\s*(?:piece|pieces|pc|pcs))?$/.test(normalized)) return 3;
  return null;
}

function extractQuantity(text: string): number | null {
  const match = text.match(/\b(\d+)\b/);
  if (match) return Number(match[1]);
  if (/\b(ek|one)\b/.test(text)) return 1;
  if (/\b(do|two)\b/.test(text)) return 2;
  if (/\b(teen|three)\b/.test(text)) return 3;
  return null;
}

function isReserveFollowUp(text: string): boolean {
  return /\b(pack|rakh|rakho|reserve|bhej|bhejo|de do|dedo|kar do|kardo|chahiye|lena)\b/.test(
    text,
  );
}

function isAffirmative(text: string): boolean {
  return /^(haan|ha|yes|ok|okay|theek|thik|sure|final)(\s|$)/.test(text);
}

function isSettledAcknowledgement(text: string): boolean {
  return /^(ok|okay|theek|thik|thanks|thank you|done|haan|ha|yes|sure|acha|achha|accha|ji|jee)$/.test(
    text,
  );
}

function isLaterOrDecline(text: string): boolean {
  return /\b(kal|baad me|bad me|later|abhi nahi|nahi lunga|mat rakho|cancel|rehne do|rhne do)\b/.test(
    text,
  );
}

function isStockFollowUp(text: string): boolean {
  return /\b(kitne|kitna|stock|available|bache|bachi|pass|paas)\b/.test(text);
}

function asksStockCount(message: string): boolean {
  const text = normalizeSearch(message);
  return /\b(kitne|kitna|stock|bache|bachi|pass|paas)\b/.test(text);
}

const requestedItemStopTokens = new Set([
  "aapke",
  "aapka",
  "available",
  "bata",
  "batao",
  "bataiye",
  "bhai",
  "bhaiya",
  "bro",
  "chahiye",
  "hai",
  "hain",
  "he",
  "item",
  "ji",
  "kaunsa",
  "kitna",
  "kitne",
  "kya",
  "list",
  "me",
  "milega",
  "mil",
  "paas",
  "pack",
  "pass",
  "price",
  "rate",
  "sir",
  "stock",
  "to",
  "ye",
  "yeh",
]);

function requestedItemTokens(message: string): string[] {
  return normalizeSearch(message)
    .split(" ")
    .filter((token) => token.length > 1 && !requestedItemStopTokens.has(token));
}

function extractRequestedItemLabel(message: string): string | null {
  const tokens = requestedItemTokens(message);
  return tokens.length ? tokens.join(" ") : null;
}

function shouldListCatalogMatches(
  message: string,
  matches: Awaited<ReturnType<typeof getCachedCatalog>>["products"],
): boolean {
  if (!matches.length) return false;
  if (matches.length > 1) return true;

  const tokens = requestedItemTokens(message);
  if (tokens.length !== 1) return false;

  const token = tokens[0];
  if (genericTokens.has(token)) return true;
  return matches.some((product) => normalizeSearch(product.category) === token);
}

function isUnavailableCatalogQuery(message: string, intent: string): boolean {
  if (!extractRequestedItemLabel(message)) return false;
  if (intent === "stock_query" || intent === "price_query") return true;

  const text = normalizeSearch(message);
  return /\b(hai kya|available|milega|stock|price|rate|chahiye)\b/.test(text);
}

function isPriceFollowUp(text: string): boolean {
  return /\b(price|rate|daam)\b/.test(text);
}

function isVagueQuantity(text: string): boolean {
  return /\b(bohat|bahut|bahot|bhot|sare|saare|many|zyada|jada)\b/.test(text);
}

function isPunctuationOnly(text: string): boolean {
  return text.trim().length > 0 && !/[a-z0-9]/i.test(text);
}

function isIntentItemGrounded(item: string | null, message: string): boolean {
  if (!item) return false;
  const messageTokens = meaningfulTokens(normalizeSearch(message));
  if (!messageTokens.length) return false;
  const itemTokens = meaningfulTokens(normalizeSearch(item));
  return messageTokens.some((messageToken) =>
    itemTokens.some((itemToken) => tokenSimilarity(messageToken, itemToken) >= 0.75),
  );
}

const genericTokens = new Set([
  "ball",
  "bat",
  "racket",
  "racquet",
  "piece",
  "pieces",
  "item",
  "stock",
  "available",
  "hai",
  "kya",
  "bhai",
  "bhaiya",
]);

function meaningfulTokens(text: string): string[] {
  return text
    .split(" ")
    .filter((token) => token.length > 2 && !genericTokens.has(token));
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return (Math.max(a.length, b.length) - distance) / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
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

function getMessagingProvider(options: MessageProcessorOptions): MessagingProvider {
  return options.messagingProvider ?? getWhatsAppWebDemoProvider();
}

async function notifyOwner(body: string, options: MessageProcessorOptions): Promise<void> {
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerNumber || !options.sendViaProvider) return;
  await getMessagingProvider(options).sendMessage({ to: ownerNumber, body });
}

async function logConversation(input: Omit<ConversationMessage, "id" | "createdAt">) {
  const message: ConversationMessage = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await writeConversationToSource(message);
  publishEvent({ type: "conversation.message", message });
}
