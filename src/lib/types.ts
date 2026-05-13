export type IntentName =
  | "price_query"
  | "stock_query"
  | "reserve_item"
  | "bulk_discount"
  | "greeting"
  | "ambiguous";

export type CatalogProduct = {
  id: string;
  itemName: string;
  category: string;
  price: number;
  stockQuantity: number;
  aliases: string[];
  active: boolean;
  lowStockThreshold: number;
  updatedAt: string;
};

export type CatalogReadResult = {
  products: CatalogProduct[];
  source: "sheets" | "cache" | "local-fixture";
  stale: boolean;
  syncing: boolean;
  error?: string;
  refreshedAt?: string;
};

export type IntentExtraction = {
  intent: IntentName;
  item: string | null;
  quantity: number | null;
  confidence: number;
  source?: "local" | "ai" | "fallback";
};

export type VoiceMutation = {
  action:
    | "add"
    | "set"
    | "subtract"
    | "update_price"
    | "update_category"
    | "delete"
    | "unknown";
  item: string | null;
  quantity: number | null;
  price?: number | null;
  category?: string | null;
  confidence: number;
};

export type Order = {
  id: string;
  customerPhone: string;
  customerName?: string;
  productId: string;
  itemName: string;
  quantity: number;
  amount: number;
  status: "pending" | "packed" | "completed" | "cancelled" | "failed";
  note?: string;
  createdAt: string;
};

export type ConversationMessage = {
  id: string;
  customerPhone: string;
  direction: "inbound" | "outbound" | "owner";
  body: string;
  actor: "customer" | "ai" | "owner" | "system";
  intent?: IntentExtraction;
  replySource?: "local" | "ai" | "fallback" | "context" | "manual" | "ignored";
  ignoredReason?: string;
  createdAt: string;
};

export type CustomerConversationState = {
  customerPhone: string;
  humanTakeover: boolean;
  lastProductId?: string;
  lastIntent?: IntentName;
  awaitingQuantity?: boolean;
  contextExpiresAt?: string;
  updatedAt: string;
};

export type RuntimeSettings = {
  aiClerkActive: boolean;
  updatedAt: string;
};

export type IgnoredMessage = {
  id: string;
  from: string;
  body: string;
  reason: string;
  customerName?: string;
  isGroup?: boolean;
  createdAt: string;
};

export type StoreData = {
  catalog: CatalogProduct[];
  orders: Order[];
  conversations: ConversationMessage[];
  customerStates: CustomerConversationState[];
  settings?: RuntimeSettings;
  ignoredMessages?: IgnoredMessage[];
  processedExternalMessageIds?: string[];
};

export type RealtimeEvent =
  | { type: "order.created"; order: Order }
  | { type: "order.updated"; order: Order }
  | { type: "catalog.updated"; product?: CatalogProduct }
  | { type: "conversation.message"; message: ConversationMessage }
  | { type: "ignored.message"; message: IgnoredMessage }
  | { type: "settings.updated"; settings: RuntimeSettings }
  | { type: "sync.status"; syncing: boolean; error?: string };

export type IncomingCustomerMessage = {
  from: string;
  body: string;
  customerName?: string;
  externalId?: string;
  isGroup?: boolean;
  messageType?: string;
  hasMedia?: boolean;
  hasQuotedMessage?: boolean;
  mentionedIds?: string[];
};

export type OutboundMessage = {
  to: string;
  body: string;
};

export type MessagingProvider = {
  name: string;
  start(onMessage: (message: IncomingCustomerMessage) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: OutboundMessage): Promise<void>;
  getStatus(): Promise<MessagingStatus>;
};

export type MessagingStatus = {
  provider: string;
  running: boolean;
  ready: boolean;
  qrDataUrl?: string;
  lastError?: string;
};
