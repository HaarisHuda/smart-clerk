import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { initialStoreData } from "./demo-data";
import type {
  CatalogProduct,
  ConversationMessage,
  CustomerConversationState,
  IgnoredMessage,
  Order,
  RuntimeSettings,
  StoreData,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "demo-store.json");
const defaultSettings = (): RuntimeSettings => ({
  aiClerkActive: true,
  updatedAt: new Date().toISOString(),
});

async function ensureStore(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(initialStoreData, null, 2));
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await fs.readFile(storePath, "utf8");
  const store = JSON.parse(raw) as StoreData;
  store.settings ??= defaultSettings();
  store.ignoredMessages ??= [];
  store.processedExternalMessageIds ??= [];
  return store;
}

export async function writeStore(next: StoreData): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(next, null, 2));
}

export async function getLocalCatalog(): Promise<CatalogProduct[]> {
  return (await readStore()).catalog;
}

export async function saveLocalProduct(product: CatalogProduct): Promise<CatalogProduct> {
  const store = await readStore();
  const idx = store.catalog.findIndex((item) => item.id === product.id);
  const next = { ...product, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    store.catalog[idx] = next;
  } else {
    store.catalog.unshift(next);
  }
  await writeStore(store);
  return next;
}

export async function deleteLocalProduct(productId: string): Promise<CatalogProduct | null> {
  const store = await readStore();
  const existing = store.catalog.find((item) => item.id === productId) ?? null;
  store.catalog = store.catalog.filter((item) => item.id !== productId);
  await writeStore(store);
  return existing;
}

export async function saveLocalProducts(products: CatalogProduct[]): Promise<void> {
  const store = await readStore();
  const byId = new Map(store.catalog.map((item) => [item.id, item]));
  for (const product of products) {
    byId.set(product.id, { ...product, updatedAt: new Date().toISOString() });
  }
  store.catalog = Array.from(byId.values());
  await writeStore(store);
}

export async function addOrder(order: Order): Promise<Order> {
  const store = await readStore();
  store.orders.unshift(order);
  await writeStore(store);
  return order;
}

export async function getOrders(): Promise<Order[]> {
  return (await readStore()).orders;
}

export async function updateLocalOrderStatus(
  orderId: string,
  status: Order["status"],
): Promise<Order | null> {
  const store = await readStore();
  const idx = store.orders.findIndex((order) => order.id === orderId);
  if (idx < 0) return null;
  store.orders[idx] = {
    ...store.orders[idx],
    status,
    note:
      status === "completed"
        ? "Order completed at counter"
        : status === "cancelled"
          ? "Order cancelled"
          : store.orders[idx].note,
  };
  await writeStore(store);
  return store.orders[idx];
}

export async function addConversationMessage(
  message: ConversationMessage,
): Promise<ConversationMessage> {
  const store = await readStore();
  store.conversations.unshift(message);
  await writeStore(store);
  return message;
}

export async function getConversationMessages(): Promise<ConversationMessage[]> {
  return (await readStore()).conversations;
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  return (await readStore()).settings ?? defaultSettings();
}

export async function saveRuntimeSettings(
  next: Partial<RuntimeSettings>,
): Promise<RuntimeSettings> {
  const store = await readStore();
  const settings: RuntimeSettings = {
    ...(store.settings ?? defaultSettings()),
    ...next,
    updatedAt: new Date().toISOString(),
  };
  store.settings = settings;
  await writeStore(store);
  return settings;
}

export async function addIgnoredMessage(
  message: Omit<IgnoredMessage, "id" | "createdAt">,
): Promise<IgnoredMessage> {
  const store = await readStore();
  const ignored: IgnoredMessage = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...message,
  };
  store.ignoredMessages = [ignored, ...(store.ignoredMessages ?? [])].slice(0, 100);
  await writeStore(store);
  return ignored;
}

export async function getIgnoredMessages(): Promise<IgnoredMessage[]> {
  return (await readStore()).ignoredMessages ?? [];
}

export async function getCustomerState(customerPhone: string): Promise<CustomerConversationState> {
  const store = await readStore();
  const existing = store.customerStates.find((state) => state.customerPhone === customerPhone);
  if (existing) return existing;
  return {
    customerPhone,
    humanTakeover: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveCustomerState(
  state: CustomerConversationState,
): Promise<CustomerConversationState> {
  const store = await readStore();
  const idx = store.customerStates.findIndex((item) => item.customerPhone === state.customerPhone);
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    store.customerStates[idx] = next;
  } else {
    store.customerStates.push(next);
  }
  await writeStore(store);
  return next;
}

export async function hasProcessedExternalMessage(externalId: string): Promise<boolean> {
  const store = await readStore();
  return Boolean(store.processedExternalMessageIds?.includes(externalId));
}

export async function markExternalMessageProcessed(externalId: string): Promise<void> {
  const store = await readStore();
  const ids = store.processedExternalMessageIds ?? [];
  if (!ids.includes(externalId)) {
    ids.unshift(externalId);
  }
  store.processedExternalMessageIds = ids.slice(0, 1000);
  await writeStore(store);
}
