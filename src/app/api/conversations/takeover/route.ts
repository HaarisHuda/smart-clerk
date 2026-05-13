import { NextRequest, NextResponse } from "next/server";
import { getCustomerState, saveCustomerState } from "@/lib/local-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const customerPhone = String(body.customerPhone ?? "");
  if (!customerPhone) {
    return NextResponse.json({ error: "customerPhone is required" }, { status: 400 });
  }
  const state = await getCustomerState(customerPhone);
  const saved = await saveCustomerState({
    ...state,
    humanTakeover: Boolean(body.humanTakeover),
  });
  return NextResponse.json({ state: saved });
}
