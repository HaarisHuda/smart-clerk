import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  IncomingCustomerMessage,
  MessagingProvider,
  MessagingStatus,
  OutboundMessage,
} from "../types";

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
};

function graphVersion(): string {
  return process.env.WHATSAPP_CLOUD_GRAPH_VERSION || "v25.0";
}

function normalizeCloudRecipient(value: string): string {
  return value.replace("@c.us", "").replace(/\D/g, "");
}

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN &&
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN,
  );
}

export function verifyWhatsAppCloudSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_CLOUD_APP_SECRET;
  if (!appSecret && process.env.WHATSAPP_CLOUD_ALLOW_UNSIGNED_WEBHOOKS === "true") {
    return true;
  }
  if (!appSecret || !signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function extractIncomingMessagesFromCloudPayload(
  payload: unknown,
): IncomingCustomerMessage[] {
  const data = payload as MetaWebhookPayload;
  const messages: IncomingCustomerMessage[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contacts = change.value?.contacts ?? [];
      for (const message of change.value?.messages ?? []) {
        if (message.type !== "text" || !message.from || !message.text?.body) continue;
        const contact = contacts.find((item) => item.wa_id === message.from);
        messages.push({
          from: message.from,
          body: message.text.body,
          customerName: contact?.profile?.name,
          externalId: message.id,
        });
      }
    }
  }

  return messages;
}

class WhatsAppCloudProvider implements MessagingProvider {
  name = "whatsapp-cloud";

  async start(): Promise<void> {
    return;
  }

  async stop(): Promise<void> {
    return;
  }

  async sendMessage(message: OutboundMessage): Promise<void> {
    const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp Cloud API is not configured");
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizeCloudRecipient(message.to),
          type: "text",
          text: {
            preview_url: false,
            body: message.body,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`WhatsApp Cloud send failed: ${response.status} ${detail}`);
    }
  }

  async getStatus(): Promise<MessagingStatus> {
    return {
      provider: this.name,
      running: true,
      ready: isWhatsAppCloudConfigured(),
      lastError: isWhatsAppCloudConfigured() ? undefined : "Missing WhatsApp Cloud env vars",
    };
  }
}

const globalForCloud = globalThis as typeof globalThis & {
  smartClerkWhatsAppCloudProvider?: WhatsAppCloudProvider;
};

export function getWhatsAppCloudProvider(): WhatsAppCloudProvider {
  globalForCloud.smartClerkWhatsAppCloudProvider ??= new WhatsAppCloudProvider();
  return globalForCloud.smartClerkWhatsAppCloudProvider;
}
