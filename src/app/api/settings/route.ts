import { NextRequest, NextResponse } from "next/server";
import { publishEvent } from "@/lib/events";
import { getRuntimeSettings, saveRuntimeSettings } from "@/lib/local-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ settings: await getRuntimeSettings() });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    aiClerkActive?: unknown;
  };

  if (typeof body.aiClerkActive !== "boolean") {
    return NextResponse.json({ error: "aiClerkActive boolean is required" }, { status: 400 });
  }

  const settings = await saveRuntimeSettings({ aiClerkActive: body.aiClerkActive });
  publishEvent({ type: "settings.updated", settings });
  return NextResponse.json({ settings });
}
