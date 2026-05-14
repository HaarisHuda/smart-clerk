import { NextResponse } from "next/server";
import { getIgnoredMessages, getRuntimeSettings } from "@/lib/local-store";
import { getWhatsAppCloudProvider } from "@/lib/messaging/whatsapp-cloud";
import { getWhatsAppWebDemoProvider } from "@/lib/messaging/whatsapp-web-demo";
import { isDemoMode, isSheetsConfigured } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  const whatsappStatus =
    process.env.WHATSAPP_PROVIDER === "cloud"
      ? await getWhatsAppCloudProvider().getStatus()
      : await getWhatsAppWebDemoProvider().getStatus();

  return NextResponse.json({
    settings: await getRuntimeSettings(),
    whatsappStatus,
    ignoredMessages: (await getIgnoredMessages()).slice(0, 20),
    runtime: {
      aiProvider: process.env.AI_PROVIDER || "local",
      demoMode: isDemoMode(),
      sheetsConfigured: isSheetsConfigured(),
      whatsappProvider: process.env.WHATSAPP_PROVIDER || "web-demo",
      whatsappGroupsAllowed: process.env.WHATSAPP_WEB_ALLOW_GROUPS === "true",
    },
  });
}
