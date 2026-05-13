import {
  deleteProductFromSource,
  isDemoMode,
  readCatalogFromSource,
  writeProductToSource,
  writeProductsToSource,
} from "../sheets";
import type { CatalogProduct, CatalogReadResult } from "../types";

const TTL_MS = 30_000;

let cachedProducts: CatalogProduct[] | null = null;
let cachedAt = 0;
let lastError: string | undefined;

export function invalidateCatalogCache(): void {
  cachedAt = 0;
}

export async function getCachedCatalog(force = false): Promise<CatalogReadResult> {
  const now = Date.now();
  const hasFreshCache = cachedProducts && now - cachedAt < TTL_MS;
  if (!force && hasFreshCache && cachedProducts) {
    return {
      products: cachedProducts,
      source: "cache",
      stale: false,
      syncing: false,
      refreshedAt: new Date(cachedAt).toISOString(),
    };
  }

  try {
    const products = await readCatalogFromSource();
    cachedProducts = products;
    cachedAt = now;
    lastError = undefined;
    return {
      products,
      source: isDemoMode() ? "local-fixture" : "sheets",
      stale: false,
      syncing: false,
      refreshedAt: new Date(cachedAt).toISOString(),
    };
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Catalog sync failed";
    return {
      products: cachedProducts ?? [],
      source: cachedProducts ? "cache" : "local-fixture",
      stale: Boolean(cachedProducts),
      syncing: true,
      error: lastError,
      refreshedAt: cachedAt ? new Date(cachedAt).toISOString() : undefined,
    };
  }
}

export async function saveCatalogProduct(product: CatalogProduct): Promise<CatalogProduct> {
  const saved = await writeProductToSource(product);
  invalidateCatalogCache();
  return saved;
}

export async function saveCatalogProducts(products: CatalogProduct[]): Promise<CatalogProduct[]> {
  const saved = await writeProductsToSource(products);
  invalidateCatalogCache();
  return saved;
}

export async function deleteCatalogProduct(productId: string): Promise<CatalogProduct | null> {
  const deleted = await deleteProductFromSource(productId);
  invalidateCatalogCache();
  return deleted;
}
