import { NextRequest, NextResponse } from "next/server";
import { extractVoiceMutation } from "@/lib/ai/intent";
import {
  findCatalogItemMatch,
  normalizeSearch,
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

  const shouldApplyPrice = typeof mutation.price === "number";
  const nextPrice = shouldApplyPrice ? mutation.price ?? 0 : matched?.price ?? 0;
  const repairedItemName =
    matched && mutation.item && shouldRepairMatchedItemName(matched.itemName, mutation.item)
      ? mutation.item.trim()
      : matched?.itemName;
  const product = matched
    ? {
        ...matched,
        itemName: repairedItemName ?? matched.itemName,
        price: nextPrice,
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
        price: nextPrice,
        category: "General",
        aliases: [],
      });

  const saved = await saveCatalogProduct(product);
  publishEvent({ type: "catalog.updated", product: saved });
  const created = !matched;
  const priceMessage = shouldApplyPrice ? `, price Rs. ${saved.price}` : "";
  return NextResponse.json({
    mutation,
    applied: true,
    product: saved,
    message: created
      ? `Created ${saved.itemName} with stock ${saved.stockQuantity}${priceMessage}.`
      : `Updated ${saved.itemName}: stock is now ${saved.stockQuantity}${priceMessage}.`,
  });
}

function itemNameTokens(value: string): string[] {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function isLikelyTruncatedToken(existingToken: string, requestedToken: string): boolean {
  return (
    existingToken.length <= 3 &&
    requestedToken.length - existingToken.length >= 2 &&
    requestedToken.startsWith(existingToken)
  );
}

function shouldRepairMatchedItemName(existingName: string, requestedName: string): boolean {
  if (existingName.trim().toLowerCase() === requestedName.trim().toLowerCase()) {
    return false;
  }

  const existingTokens = itemNameTokens(existingName);
  const requestedTokens = itemNameTokens(requestedName);
  if (!existingTokens.length || existingTokens.length !== requestedTokens.length) {
    return false;
  }

  let repairedTokenCount = 0;
  const compatible = existingTokens.every((existingToken, index) => {
    const requestedToken = requestedTokens[index];
    if (existingToken === requestedToken) return true;
    if (isLikelyTruncatedToken(existingToken, requestedToken)) {
      repairedTokenCount += 1;
      return true;
    }
    return false;
  });

  return compatible && repairedTokenCount > 0;
}
