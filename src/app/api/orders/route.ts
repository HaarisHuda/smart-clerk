import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/lib/local-store";
import { publishEvent } from "@/lib/events";
import { updateOrderStatusInSource } from "@/lib/sheets";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ orders: await getOrders() });
}

const statuses = new Set<Order["status"]>([
  "pending",
  "packed",
  "completed",
  "cancelled",
  "failed",
]);

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: Order["status"];
  };

  if (!body.id || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Valid id and status are required" }, { status: 400 });
  }

  const order = await updateOrderStatusInSource(body.id, body.status);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  publishEvent({ type: "order.updated", order });
  return NextResponse.json({ order });
}
