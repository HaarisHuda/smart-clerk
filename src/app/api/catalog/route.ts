import { NextRequest, NextResponse } from "next/server";
import { findCatalogMatch, productFromInput } from "@/lib/catalog/normalize";
import {
  deleteCatalogProduct,
  getCachedCatalog,
  saveCatalogProduct,
} from "@/lib/catalog/cache";
import { publishEvent } from "@/lib/events";

export const runtime = "nodejs";

export async function GET() {
  const result = await getCachedCatalog();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const product = productFromInput(body);
  const saved = await saveCatalogProduct(product);
  publishEvent({ type: "catalog.updated", product: saved });
  return NextResponse.json({ product: saved });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "Product id is required" }, { status: 400 });
  }

  const catalog = await getCachedCatalog();
  const existing = catalog.products.find((product) => product.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const product = productFromInput({
    ...existing,
    ...body,
    itemName: body.itemName ?? existing.itemName,
  });
  const saved = await saveCatalogProduct(product);
  publishEvent({ type: "catalog.updated", product: saved });
  return NextResponse.json({ product: saved });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const catalog = await getCachedCatalog();
  const product =
    catalog.products.find((item) => item.id === body.id) ??
    findCatalogMatch(catalog.products, body.itemName);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const deleted = await deleteCatalogProduct(product.id);
  publishEvent({ type: "catalog.updated" });
  return NextResponse.json({ product: deleted });
}
