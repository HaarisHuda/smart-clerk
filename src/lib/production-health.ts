import { isSheetsConfigured } from "./sheets";
import { isWhatsAppCloudConfigured } from "./messaging/whatsapp-cloud";

type HealthCheck = {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
};

export function getProductionHealth() {
  const demoMode = process.env.SMART_CLERK_DEMO_MODE === "true";
  const provider = process.env.WHATSAPP_PROVIDER || "web-demo";
  const requireProductionChecks = !demoMode;
  const requireCloud = provider === "cloud";

  const checks: HealthCheck[] = [
    {
      name: "catalog",
      ok: isSheetsConfigured() || process.env.SMART_CLERK_DEMO_MODE === "true",
      required: true,
      detail: isSheetsConfigured()
        ? "Google Sheets write-backbone configured"
        : "Using local demo catalog",
    },
    {
      name: "ai",
      ok: Boolean(
        (process.env.AI_PROVIDER === "gemini" && process.env.GEMINI_API_KEY) ||
          (process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY),
      ),
      required: true,
      detail: process.env.AI_PROVIDER
        ? `AI provider selected: ${process.env.AI_PROVIDER}`
        : "AI_PROVIDER is not set",
    },
    {
      name: "whatsappCloud",
      ok: isWhatsAppCloudConfigured(),
      required: requireCloud,
      detail: isWhatsAppCloudConfigured()
        ? "WhatsApp Cloud webhook/send configured"
        : requireCloud
          ? "WhatsApp Cloud env vars missing"
          : "Not required unless WHATSAPP_PROVIDER=cloud",
    },
    {
      name: "webhookSignature",
      ok: Boolean(
        process.env.WHATSAPP_CLOUD_APP_SECRET ||
          process.env.WHATSAPP_CLOUD_ALLOW_UNSIGNED_WEBHOOKS === "true",
      ),
      required: requireCloud,
      detail: process.env.WHATSAPP_CLOUD_APP_SECRET
        ? "Webhook signatures are enforced"
        : requireCloud
          ? "Webhook signature secret missing"
          : "Not required unless WHATSAPP_PROVIDER=cloud",
    },
    {
      name: "dashboardAuth",
      ok: Boolean(process.env.DASHBOARD_PASSWORD),
      required: requireProductionChecks,
      detail: process.env.DASHBOARD_PASSWORD
        ? "Dashboard basic auth enabled"
        : requireProductionChecks
          ? "Dashboard basic auth disabled"
          : "Dashboard auth optional in demo mode",
    },
  ];

  return {
    ok: checks.every((check) => !check.required || check.ok),
    mode: demoMode ? "demo" : "production",
    provider,
    checks,
  };
}
