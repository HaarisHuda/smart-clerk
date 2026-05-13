import { NextRequest, NextResponse } from "next/server";
import { reserveItem } from "@/lib/reservation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await reserveItem({
    customerPhone: String(body.customerPhone ?? "+910000000000"),
    customerName: body.customerName,
    item: String(body.item ?? ""),
    quantity: Number(body.quantity ?? 1),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
