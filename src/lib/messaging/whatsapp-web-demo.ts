import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  IncomingCustomerMessage,
  MessagingProvider,
  MessagingStatus,
  OutboundMessage,
} from "../types";

type ClientLike = {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  sendMessage(to: string, body: string): Promise<unknown>;
  on(event: "qr", handler: (qr: string) => unknown): void;
  on(event: "ready", handler: () => unknown): void;
  on(event: "message", handler: (message: unknown) => unknown): void;
  on(event: "disconnected", handler: () => unknown): void;
};

type ChatLike = {
  id?: {
    _serialized?: string;
  };
  isGroup?: boolean;
};

type WhatsAppMessageLike = {
  fromMe?: boolean;
  from: string;
  to?: string;
  author?: string;
  body?: string;
  type?: string;
  hasMedia?: boolean;
  hasQuotedMsg?: boolean;
  mentionedIds?: string[];
  id?: {
    remote?: string;
    _serialized?: string;
  };
  _data?: {
    notifyName?: string;
  };
  getChat?: () => Promise<ChatLike>;
};

function isGroupChatId(chatId: string | undefined): boolean {
  return Boolean(chatId?.endsWith("@g.us"));
}

function shouldDropBeforeProcessor(chatId: string): boolean {
  if (chatId.endsWith("@broadcast") || chatId === "status@broadcast") {
    return true;
  }
  return false;
}

class WhatsAppWebDemoProvider implements MessagingProvider {
  name = "whatsapp-web-demo";
  private client: ClientLike | null = null;
  private running = false;
  private ready = false;
  private qrDataUrl: string | undefined;
  private lastError: string | undefined;

  async start(onMessage: (message: IncomingCustomerMessage) => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.lastError = undefined;
    try {
      const [{ Client, LocalAuth }, qrcode] = await Promise.all([
        import("whatsapp-web.js"),
        import("qrcode"),
      ]);

      const client = new Client({
        authStrategy: new LocalAuth({ clientId: "smart-clerk-demo" }),
        puppeteer: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      }) as unknown as ClientLike;

      client.on("qr", async (qr: string) => {
        this.qrDataUrl = await qrcode.toDataURL(qr);
        this.ready = false;
      });

      client.on("ready", () => {
        this.ready = true;
        this.qrDataUrl = undefined;
      });

      client.on("message", async (messageInput: unknown) => {
        const message = messageInput as WhatsAppMessageLike;
        if (message.fromMe || !message.body) return;
        const chat = await message.getChat?.().catch(() => null);
        const chatId = chat?.id?._serialized || message.id?.remote || message.from;
        const isGroup =
          Boolean(chat?.isGroup) ||
          isGroupChatId(chatId) ||
          isGroupChatId(message.from) ||
          isGroupChatId(message.to);
        if (shouldDropBeforeProcessor(chatId)) return;
        await onMessage({
          from: chatId,
          body: message.body,
          customerName: message._data?.notifyName,
          isGroup,
          messageType: message.type,
          hasMedia: message.hasMedia,
          hasQuotedMessage: message.hasQuotedMsg,
          mentionedIds: message.mentionedIds,
        });
      });

      client.on("disconnected", () => {
        this.ready = false;
        this.running = false;
      });

      this.client = client;
      await client.initialize();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "WhatsApp start failed";
      this.running = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
    }
    this.client = null;
    this.running = false;
    this.ready = false;
    this.qrDataUrl = undefined;
  }

  async resetSession(): Promise<void> {
    await this.stop();
    const root = process.cwd();
    const authDir = path.join(root, ".wwebjs_auth", "session-smart-clerk-demo");
    const cacheDir = path.join(root, ".wwebjs_cache");
    for (const target of [authDir, cacheDir]) {
      const relative = path.relative(root, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Refusing to reset WhatsApp session outside project directory");
      }
      await fs.rm(target, { recursive: true, force: true });
    }
    this.lastError = undefined;
  }

  async sendMessage(message: OutboundMessage): Promise<void> {
    if (!this.client || !this.ready) {
      throw new Error("WhatsApp demo provider is not ready");
    }
    await this.client.sendMessage(message.to, message.body);
  }

  async getStatus(): Promise<MessagingStatus> {
    return {
      provider: this.name,
      running: this.running,
      ready: this.ready,
      qrDataUrl: this.qrDataUrl,
      lastError: this.lastError,
    };
  }
}

const globalForMessaging = globalThis as typeof globalThis & {
  smartClerkWhatsAppProvider?: WhatsAppWebDemoProvider;
};

export function getWhatsAppWebDemoProvider(): WhatsAppWebDemoProvider {
  globalForMessaging.smartClerkWhatsAppProvider ??= new WhatsAppWebDemoProvider();
  return globalForMessaging.smartClerkWhatsAppProvider;
}
