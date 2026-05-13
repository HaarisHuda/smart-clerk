import { NextRequest, NextResponse } from "next/server";
import { processIncomingCustomerMessage } from "@/lib/message-processor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await processIncomingCustomerMessage({
    from: String(body.from ?? "+919999999999"),
    body: String(body.body ?? ""),
    customerName: body.customerName,
  });
  return NextResponse.json(result);
}
