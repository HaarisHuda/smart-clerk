import { NextRequest, NextResponse } from "next/server";
import { processIncomingCustomerMessage } from "@/lib/message-processor";
import {
  extractIncomingMessagesFromCloudPayload,
  getWhatsAppCloudProvider,
  verifyWhatsAppCloudSignature,
} from "@/lib/messaging/whatsapp-cloud";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    challenge &&
    token &&
    token === process.env.WHATSAPP_CLOUD_VERIFY_TOKEN
  ) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppCloudSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON webhook payload" }, { status: 400 });
  }

  const provider = getWhatsAppCloudProvider();
  const messages = extractIncomingMessagesFromCloudPayload(payload);
  const errors: string[] = [];

  for (const message of messages) {
    try {
      await processIncomingCustomerMessage(message, {
        sendViaProvider: true,
        messagingProvider: provider,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown processing error");
      console.error("WhatsApp Cloud webhook message failed", error);
    }
  }

  return NextResponse.json({ received: true, messages: messages.length, errors });
}
