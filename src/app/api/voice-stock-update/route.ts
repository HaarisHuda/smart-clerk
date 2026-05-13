import { NextRequest, NextResponse } from "next/server";
import { extractVoiceMutation } from "@/lib/ai/intent";
import {
  findCatalogItemMatch,
  productFromInput,
} from "@/lib/catalog/normalize";
import {
  deleteCatalogProduct,
  getCachedCatalog,
  saveCatalogProduct,
} from "@/lib/catalog/cache";
import { publishEvent } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transcript = String(body.transcript ?? "");
  const mutation = await extractVoiceMutation(transcript);
  const isPriceUpdate = mutation.action === "update_price";
  const isCategoryUpdate = mutation.action === "update_category";
  const isDelete = mutation.action === "delete";
  const hasRequiredValue =
    isPriceUpdate
      ? typeof mutation.price === "number"
      : isCategoryUpdate
        ? Boolean(mutation.category)
      : isDelete
        ? true
        : Boolean(mutation.quantity);
  if (mutation.confidence < 0.75 || mutation.action === "unknown" || !mutation.item || !hasRequiredValue) {
    return NextResponse.json({
      mutation,
      applied: false,
      message: "Could not parse confidently. Show transcript for manual edit.",
    });
  }

  const catalog = await getCachedCatalog();
  const matched = findCatalogItemMatch(catalog.products, mutation.item);

  if (isCategoryUpdate) {
    if (!matched) {
      return NextResponse.json({
        mutation,
        applied: false,
        message: `Could not find "${mutation.item}" to update category.`,
      });
    }
    const saved = await saveCatalogProduct({
      ...matched,
      category: mutation.category ?? matched.category,
    });
    publishEvent({ type: "catalog.updated", product: saved });
    return NextResponse.json({
      mutation,
      applied: true,
      product: saved,
      message:
        matched.itemName.toLowerCase() === mutation.item.toLowerCase()
          ? `Updated ${saved.itemName} category to ${saved.category}.`
          : `Matched "${mutation.item}" to ${saved.itemName}. Updated category to ${saved.category}.`,
    });
  }

  if (isDelete) {
    if (!matched) {
      return NextResponse.json({
        mutation,
        applied: false,
        message: `Could not find "${mutation.item}" to delete.`,
      });
    }
    const deleted = await deleteCatalogProduct(matched.id);
    publishEvent({ type: "catalog.updated" });
    return NextResponse.json({
      mutation,
      applied: true,
      product: deleted,
      message: `Deleted ${matched.itemName}.`,
    });
  }

  if (isPriceUpdate) {
    if (!matched) {
      return NextResponse.json({
        mutation,
        applied: false,
        message: `Could not find "${mutation.item}" to update price.`,
      });
    }
    const saved = await saveCatalogProduct({
      ...matched,
      price: mutation.price ?? matched.price,
    });
    publishEvent({ type: "catalog.updated", product: saved });
    return NextResponse.json({
      mutation,
      applied: true,
      product: saved,
      message:
        matched.itemName.toLowerCase() === mutation.item.toLowerCase()
          ? `Updated ${saved.itemName} price to Rs. ${saved.price}.`
          : `Matched "${mutation.item}" to ${saved.itemName}. Updated price to Rs. ${saved.price}.`,
    });
  }

  if (mutation.action === "subtract" && !matched) {
    return NextResponse.json({
      mutation,
      applied: false,
      message: `Could not find "${mutation.item}" to subtract stock.`,
    });
  }

  const product = matched
    ? {
        ...matched,
        stockQuantity:
          mutation.action === "set"
            ? mutation.quantity ?? matched.stockQuantity
            : mutation.action === "subtract"
              ? Math.max(0, matched.stockQuantity - (mutation.quantity ?? 0))
              : matched.stockQuantity + (mutation.quantity ?? 0),
      }
    : productFromInput({
        itemName: mutation.item,
        stockQuantity: mutation.quantity ?? 0,
        price: 0,
        category: "General",
        aliases: [],
      });

  const saved = await saveCatalogProduct(product);
  publishEvent({ type: "catalog.updated", product: saved });
  const created = !matched;
  return NextResponse.json({
    mutation,
    applied: true,
    product: saved,
    message: created
      ? `Created ${saved.itemName} with stock ${saved.stockQuantity}.`
      : `Updated ${saved.itemName}: stock is now ${saved.stockQuantity}.`,
  });
}
