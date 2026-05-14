# Smart Clerk & Auto-Catalog

Demo-first WhatsApp AI clerk for small Indian retailers. The MVP proves the core loop:

1. Customer messages WhatsApp.
2. AI reads catalog from a fast 30s in-memory cache.
3. Structured intent JSON gates stock mutations.
4. Confirmed orders reserve stock with a per-SKU lock.
5. Dashboard receives a live SSE order event.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + lucide-react
- whatsapp-web.js demo adapter behind a `MessagingProvider` interface
- Gemini or Anthropic for structured extraction, with local heuristic fallback
- Google Sheets via `google-spreadsheet` as write-backbone
- Local JSON fixture store for demo mode and restart resilience

## Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Without Google Sheets credentials, the app automatically uses local demo data. To force it, keep:

```bash
SMART_CLERK_DEMO_MODE=true
```

Set `AI_PROVIDER=gemini` with `GEMINI_API_KEY` for Gemini extraction, or
`AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` for Anthropic extraction.
For quota-free WhatsApp testing, set `AI_PROVIDER=local`; the app will use the
deterministic catalog/context parser and avoid external AI calls.

## Important Routes

- `/` - POS-style command center, catalog manager, conversation log
- `/demo-mode` - offline pitch mode note
- `/api/whatsapp/session` - start/stop QR session for whatsapp-web.js
- `/api/whatsapp/cloud` - production WhatsApp Cloud webhook
- `/api/health` - deployment readiness checks
- `/api/whatsapp-receive` - dev-only manual inbound message hook
- `/api/catalog` - read/write catalog
- `/api/catalog/import` - CSV import with default column mapping
- `/api/events` - SSE stream for dashboard order updates
- `/api/reserve` - race-safe reserve endpoint
- `/api/voice-stock-update` - structured voice stock mutation

## Dashboard Access

The dashboard and all protected mutation APIs use HTTP Basic Auth through
Next.js Proxy. Set these on Render before sharing the live link:

```bash
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=use-a-strong-demo-password
```

Only `/api/health`, `/api/whatsapp/cloud`, Next.js assets, and `favicon.ico`
stay public. If `DASHBOARD_PASSWORD` is missing in a deployed production
runtime, protected routes fail closed with `503` instead of exposing the app.

## Render Deployment

Use Render as a full-stack web service for the demo because `whatsapp-web.js`
needs a long-running Node process.

```bash
Build Command: npm install && npm run render-build
Start Command: npm run start
```

The `render-build` script installs the Puppeteer Chrome binary required by
WhatsApp Web before running the Next.js production build. Puppeteer is configured
to keep that browser under `.cache/puppeteer` inside the project so the runtime
can find the same binary after deployment.

## Production Readiness

For shop demos, keep `WHATSAPP_PROVIDER=web-demo` and use the QR flow at
`/api/whatsapp/session`. For a production deployment, switch to
`WHATSAPP_PROVIDER=cloud` and configure:

```bash
SMART_CLERK_DEMO_MODE=false
WHATSAPP_PROVIDER=cloud
WHATSAPP_CLOUD_ACCESS_TOKEN=...
WHATSAPP_CLOUD_PHONE_NUMBER_ID=...
WHATSAPP_CLOUD_VERIFY_TOKEN=...
WHATSAPP_CLOUD_APP_SECRET=...
DASHBOARD_PASSWORD=...
```

Use this callback URL in Meta's webhook setup:

```text
https://your-domain.com/api/whatsapp/cloud
```

The verify token in Meta must exactly match `WHATSAPP_CLOUD_VERIFY_TOKEN`.
Webhook POSTs are rejected unless their `x-hub-signature-256` matches
`WHATSAPP_CLOUD_APP_SECRET`. `WHATSAPP_CLOUD_ALLOW_UNSIGNED_WEBHOOKS=true`
exists only for local tunnel testing and should stay `false` in production.

Set `OWNER_WHATSAPP_NUMBER` to an E.164-style digits-only number for Cloud API
deployments, for example `919205675345`. The older `919205675345@c.us` format is
still tolerated by the adapter for demo compatibility.

The QR-based demo client ignores WhatsApp groups by default, so it only replies
in one-to-one customer chats. Keep `WHATSAPP_WEB_ALLOW_GROUPS=false` unless you
explicitly want group-chat testing.

Check `/api/health` after setting env vars. In production mode it requires:

- Google Sheets or an explicit demo catalog fallback
- Gemini or Anthropic API credentials
- WhatsApp Cloud credentials when `WHATSAPP_PROVIDER=cloud`
- Dashboard basic auth via `DASHBOARD_PASSWORD`

## Evals

```bash
npm run eval:hinglish
```

The fixture lives at `evals/hinglish.json` and includes 40+ realistic Hinglish messages across confirmations, aliases, price checks, and ambiguous cases.

## WhatsApp Demo Notes

`whatsapp-web.js` is intentionally demo-only. Production messaging now uses the
same `MessagingProvider` boundary through the WhatsApp Cloud adapter, and can
later be swapped for a BSP such as Gupshup, AiSensy, or Interakt.
