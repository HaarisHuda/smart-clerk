import { NextResponse } from "next/server";
import { getProductionHealth } from "@/lib/production-health";

export const runtime = "nodejs";

export async function GET() {
  const health = getProductionHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
