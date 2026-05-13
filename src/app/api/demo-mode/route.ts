import { NextResponse } from "next/server";
import { isDemoMode, isSheetsConfigured } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    demoMode: isDemoMode(),
    sheetsConfigured: isSheetsConfigured(),
    hint: "Set SMART_CLERK_DEMO_MODE=true to force seeded local fixtures.",
  });
}
