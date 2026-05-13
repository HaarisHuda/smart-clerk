import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { productFromInput } from "./catalog/normalize";
import {
  addConversationMessage,
  addOrder,
  deleteLocalProduct,
  getLocalCatalog,
  saveLocalProduct,
  saveLocalProducts,
  updateLocalOrderStatus,
} from "./local-store";
import type { CatalogProduct, ConversationMessage, Order } from "./types";

const CATALOG_SHEET = "Catalog";
const ORDERS_SHEET = "Orders";
const CONVERSATIONS_SHEET = "Conversations";

type SheetRow = {
  get(key: string): string | number | boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  save(): Promise<void>;
  delete(): Promise<void>;
};

export function isDemoMode(): boolean {
  return process.env.SMART_CLERK_DEMO_MODE === "true" || !isSheetsConfigured();
}

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

async function getDoc(): Promise<GoogleSpreadsheet> {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, auth);
  await doc.loadInfo();
  return doc;
}

async function getOrCreateSheet(title: string, headerValues: string[]) {
  const doc = await getDoc();
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues });
  }
  return sheet;
}

export async function readCatalogFromSource(): Promise<CatalogProduct[]> {
  if (isDemoMode()) {
    return getLocalCatalog();
  }

  const sheet = await getOrCreateSheet(CATALOG_SHEET, [
    "ID",
    "Item Name",
    "Category",
    "Price",
    "Stock Quantity",
    "Aliases",
    "Active",
    "Low Stock Threshold",
  ]);
  const rows = await sheet.getRows();
  const products = (rows as SheetRow[]).map((row) =>
    productFromInput({
      id: String(row.get("ID") || ""),
      itemName: String(row.get("Item Name") || ""),
      category: String(row.get("Category") || "General"),
      price: Number(row.get("Price") || 0),
      stockQuantity: Number(row.get("Stock Quantity") || 0),
      aliases: String(row.get("Aliases") || "")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      active: String(row.get("Active") || "true").toLowerCase() !== "false",
      lowStockThreshold: Number(row.get("Low Stock Threshold") || 3),
    }),
  );
  await saveLocalProducts(products);
  return products;
}

export async function writeProductToSource(product: CatalogProduct): Promise<CatalogProduct> {
  const next = await saveLocalProduct(product);
  if (isDemoMode()) return next;

  const sheet = await getOrCreateSheet(CATALOG_SHEET, [
    "ID",
    "Item Name",
    "Category",
    "Price",
    "Stock Quantity",
    "Aliases",
    "Active",
    "Low Stock Threshold",
  ]);
  const rows = await sheet.getRows();
  const existing = (rows as SheetRow[]).find((row) => row.get("ID") === next.id);
  const values = {
    "ID": next.id,
    "Item Name": next.itemName,
    "Category": next.category,
    "Price": next.price,
    "Stock Quantity": next.stockQuantity,
    "Aliases": next.aliases.join(", "),
    "Active": String(next.active),
    "Low Stock Threshold": next.lowStockThreshold,
  };

  if (existing) {
    Object.entries(values).forEach(([key, value]) => existing.set(key, value));
    await existing.save();
  } else {
    await sheet.addRow(values);
  }
  return next;
}

export async function deleteProductFromSource(productId: string): Promise<CatalogProduct | null> {
  const existingLocal = await deleteLocalProduct(productId);
  if (isDemoMode()) return existingLocal;

  const sheet = await getOrCreateSheet(CATALOG_SHEET, [
    "ID",
    "Item Name",
    "Category",
    "Price",
    "Stock Quantity",
    "Aliases",
    "Active",
    "Low Stock Threshold",
  ]);
  const rows = await sheet.getRows();
  const existing = (rows as SheetRow[]).find((row) => row.get("ID") === productId);
  if (existing) {
    await existing.delete();
  }
  return existingLocal;
}

export async function writeProductsToSource(products: CatalogProduct[]): Promise<CatalogProduct[]> {
  const written: CatalogProduct[] = [];
  for (const product of products) {
    written.push(await writeProductToSource(product));
  }
  return written;
}

export async function writeOrderToSource(order: Order): Promise<Order> {
  await addOrder(order);
  if (isDemoMode()) return order;
  const sheet = await getOrCreateSheet(ORDERS_SHEET, [
    "ID",
    "Customer Phone",
    "Item Name",
    "Quantity",
    "Amount",
    "Status",
    "Created At",
    "Note",
  ]);
  await sheet.addRow({
    "ID": order.id,
    "Customer Phone": order.customerPhone,
    "Item Name": order.itemName,
    "Quantity": order.quantity,
    "Amount": order.amount,
    "Status": order.status,
    "Created At": order.createdAt,
    "Note": order.note ?? "",
  });
  return order;
}

export async function updateOrderStatusInSource(
  orderId: string,
  status: Order["status"],
): Promise<Order | null> {
  const updated = await updateLocalOrderStatus(orderId, status);
  if (!updated || isDemoMode()) return updated;

  const sheet = await getOrCreateSheet(ORDERS_SHEET, [
    "ID",
    "Customer Phone",
    "Item Name",
    "Quantity",
    "Amount",
    "Status",
    "Created At",
    "Note",
  ]);
  const rows = await sheet.getRows();
  const existing = (rows as SheetRow[]).find((row) => row.get("ID") === orderId);
  if (existing) {
    existing.set("Status", updated.status);
    existing.set("Note", updated.note ?? "");
    await existing.save();
  }
  return updated;
}

export async function writeConversationToSource(
  message: ConversationMessage,
): Promise<ConversationMessage> {
  await addConversationMessage(message);
  if (isDemoMode()) return message;
  const sheet = await getOrCreateSheet(CONVERSATIONS_SHEET, [
    "ID",
    "Customer Phone",
    "Direction",
    "Actor",
    "Body",
    "Intent",
    "Reply Source",
    "Created At",
  ]);
  await sheet.addRow({
    "ID": message.id,
    "Customer Phone": message.customerPhone,
    "Direction": message.direction,
    "Actor": message.actor,
    "Body": message.body,
    "Intent": message.intent ? JSON.stringify(message.intent) : "",
    "Reply Source": message.replySource ?? "",
    "Created At": message.createdAt,
  });
  return message;
}
