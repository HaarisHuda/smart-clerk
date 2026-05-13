import { randomUUID } from "node:crypto";
import { findCatalogMatch } from "./catalog/normalize";
import { getCachedCatalog, saveCatalogProduct } from "./catalog/cache";
import { publishEvent } from "./events";
import { writeOrderToSource } from "./sheets";
import type { CatalogProduct, Order } from "./types";

type LockState = Promise<void>;

const locks = new Map<string, LockState>();

async function withProductLock<T>(productId: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(productId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  locks.set(productId, chained);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (locks.get(productId) === chained) {
      locks.delete(productId);
    }
  }
}

export type ReservationResult =
  | { ok: true; order: Order; product: CatalogProduct }
  | { ok: false; reason: string; product?: CatalogProduct };

export async function reserveItem(params: {
  customerPhone: string;
  item: string;
  quantity: number;
  customerName?: string;
}): Promise<ReservationResult> {
  const catalog = await getCachedCatalog();
  const initialMatch = findCatalogMatch(catalog.products, params.item);
  if (!initialMatch) {
    return { ok: false, reason: "Item not found" };
  }

  return withProductLock(initialMatch.id, async () => {
    const freshCatalog = await getCachedCatalog(true);
    const product = freshCatalog.products.find((item) => item.id === initialMatch.id);
    if (!product) return { ok: false, reason: "Item not found" };
    if (product.stockQuantity < params.quantity) {
      return { ok: false, reason: "Not enough stock", product };
    }

    const nextProduct = {
      ...product,
      stockQuantity: product.stockQuantity - params.quantity,
      updatedAt: new Date().toISOString(),
    };
    await saveCatalogProduct(nextProduct);

    const order: Order = {
      id: randomUUID(),
      customerPhone: params.customerPhone,
      customerName: params.customerName,
      productId: nextProduct.id,
      itemName: nextProduct.itemName,
      quantity: params.quantity,
      amount: params.quantity * nextProduct.price,
      status: "pending",
      createdAt: new Date().toISOString(),
      note: "Pickup reservation from AI clerk",
    };
    await writeOrderToSource(order);
    publishEvent({ type: "catalog.updated", product: nextProduct });
    publishEvent({ type: "order.created", order });
    return { ok: true, order, product: nextProduct };
  });
}
