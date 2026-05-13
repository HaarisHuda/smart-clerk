import { NextRequest, NextResponse } from "next/server";
import { processIncomingCustomerMessage } from "@/lib/message-processor";
import { getWhatsAppCloudProvider } from "@/lib/messaging/whatsapp-cloud";
import { getWhatsAppWebDemoProvider } from "@/lib/messaging/whatsapp-web-demo";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.WHATSAPP_PROVIDER === "cloud") {
    return NextResponse.json(await getWhatsAppCloudProvider().getStatus());
  }

  const provider = getWhatsAppWebDemoProvider();
  return NextResponse.json(await provider.getStatus());
}

export async function POST(request: NextRequest) {
  if (process.env.WHATSAPP_PROVIDER === "cloud") {
    return NextResponse.json(
      {
        error:
          "QR session is disabled when WHATSAPP_PROVIDER=cloud. Use /api/whatsapp/cloud as the production webhook.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const provider = getWhatsAppWebDemoProvider();

  if (body.action === "stop") {
    await provider.stop();
    return NextResponse.json(await provider.getStatus());
  }

  if (body.action === "reset") {
    await provider.resetSession();
    return NextResponse.json(await provider.getStatus());
  }

  try {
    await provider.start(async (message) => {
      await processIncomingCustomerMessage(message, { sendViaProvider: true });
    });
    return NextResponse.json(await provider.getStatus());
  } catch (error) {
    const status = await provider.getStatus();
    return NextResponse.json(
      {
        ...status,
        error: error instanceof Error ? error.message : "WhatsApp demo session failed to start",
      },
      { status: 500 },
    );
  }
}
