import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { productFromInput } from "@/lib/catalog/normalize";
import { saveCatalogProducts } from "@/lib/catalog/cache";
import { publishEvent } from "@/lib/events";

export const runtime = "nodejs";

type ImportRow = Record<string, string>;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const csv = String(body.csv ?? "");
  const mapping = body.mapping ?? {};
  const parsed = Papa.parse<ImportRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const products = parsed.data
    .map((row) =>
      productFromInput({
        itemName: row[mapping.itemName || "Item Name"] || row.name || row.item || "",
        category: row[mapping.category || "Category"] || "General",
        price: Number(row[mapping.price || "Price"] || 0),
        stockQuantity: Number(row[mapping.stockQuantity || "Stock Quantity"] || row.stock || 0),
        aliases: String(row[mapping.aliases || "Aliases"] || "")
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean),
        active: true,
      }),
    )
    .filter((product) => product.itemName);

  const saved = await saveCatalogProducts(products);
  publishEvent({ type: "catalog.updated" });
  return NextResponse.json({ imported: saved.length, products: saved });
}
