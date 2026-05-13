import { NextResponse } from "next/server";
import { getConversationMessages, readStore } from "@/lib/local-store";

export const runtime = "nodejs";

export async function GET() {
  const [messages, store] = await Promise.all([getConversationMessages(), readStore()]);
  return NextResponse.json({
    messages,
    customerStates: store.customerStates,
  });
}
