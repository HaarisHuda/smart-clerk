import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { publishEvent } from "@/lib/events";
import { getWhatsAppCloudProvider } from "@/lib/messaging/whatsapp-cloud";
import { getWhatsAppWebDemoProvider } from "@/lib/messaging/whatsapp-web-demo";
import { writeConversationToSource } from "@/lib/sheets";
import type { ConversationMessage, MessagingProvider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const messageBody = String(body.body ?? "").trim();

  if (!customerPhone) {
    return NextResponse.json({ error: "customerPhone is required" }, { status: 400 });
  }
  if (!messageBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const provider = getProvider();
  const status = await provider.getStatus();
  if (!status.ready) {
    return NextResponse.json(
      { error: "WhatsApp is not linked yet. Start the demo session and scan the QR first." },
      { status: 409 },
    );
  }

  await provider.sendMessage({ to: customerPhone, body: messageBody });

  const message: ConversationMessage = {
    id: randomUUID(),
    customerPhone,
    direction: "owner",
    actor: "owner",
    body: messageBody,
    replySource: "manual",
    createdAt: new Date().toISOString(),
  };
  await writeConversationToSource(message);
  publishEvent({ type: "conversation.message", message });

  return NextResponse.json({ message });
}

function getProvider(): MessagingProvider {
  if (process.env.WHATSAPP_PROVIDER === "cloud") {
    return getWhatsAppCloudProvider();
  }
  return getWhatsAppWebDemoProvider();
}
