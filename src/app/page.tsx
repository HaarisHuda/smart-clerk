"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  Boxes,
  FileUp,
  Mic,
  PackageCheck,
  Pencil,
  Search,
  Play,
  RefreshCcw,
  Save,
  ShieldAlert,
  Square,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  CatalogProduct,
  CatalogReadResult,
  ConversationMessage,
  CustomerConversationState,
  IgnoredMessage,
  MessagingStatus,
  Order,
  RuntimeSettings,
} from "@/lib/types";

type Tab = "dashboard" | "stock" | "catalog" | "conversations";
type DebugPayload = {
  settings: RuntimeSettings;
  ignoredMessages: IgnoredMessage[];
  runtime: {
    aiProvider: string;
    demoMode: boolean;
    sheetsConfigured: boolean;
    whatsappProvider: string;
    whatsappGroupsAllowed: boolean;
  };
};
type SpeechRecognitionResultEvent = {
  results: { 0: { 0: { transcript: string } } };
};
type SpeechRecognitionErrorEvent = {
  error:
    | "aborted"
    | "audio-capture"
    | "bad-grammar"
    | "language-not-supported"
    | "network"
    | "no-speech"
    | "not-allowed"
    | "service-not-allowed";
  message?: string;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onnomatch: () => void;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [catalogResult, setCatalogResult] = useState<CatalogReadResult | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [states, setStates] = useState<CustomerConversationState[]>([]);
  const [whatsApp, setWhatsApp] = useState<MessagingStatus | null>(null);
  const [whatsAppError, setWhatsAppError] = useState("");
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [ignoredMessages, setIgnoredMessages] = useState<IgnoredMessage[]>([]);
  const [runtimeDebug, setRuntimeDebug] = useState<DebugPayload["runtime"] | null>(null);
  const [draft, setDraft] = useState<Partial<CatalogProduct>>({
    itemName: "",
    category: "General",
    price: 0,
    stockQuantity: 0,
    aliases: [],
  });
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceResult, setVoiceResult] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CatalogProduct>>({});
  const [syncNote, setSyncNote] = useState("Ready");
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("all");
  const audioContext = useRef<AudioContext | null>(null);

  const products = catalogResult?.products ?? [];
  const aiClerkActive = settings?.aiClerkActive ?? true;
  const activeOrders = orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const closedOrders = orders.filter(
    (order) => order.status === "completed" || order.status === "cancelled",
  );
  const availableProducts = products.filter(
    (product) => product.active && product.stockQuantity > 0,
  );
  const lowStock = products.filter(
    (product) => product.active && product.stockQuantity <= product.lowStockThreshold,
  );
  const stockCategories = useMemo(
    () => ["all", ...Array.from(new Set(availableProducts.map((product) => product.category)))],
    [availableProducts],
  );
  const filteredStock = useMemo(() => {
    const search = stockSearch.trim().toLowerCase();
    return availableProducts
      .filter((product) => stockCategory === "all" || product.category === stockCategory)
      .filter((product) => {
        if (!search) return true;
        return [product.itemName, product.category, ...product.aliases]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.itemName.localeCompare(b.itemName));
  }, [availableProducts, stockCategory, stockSearch]);
  const totalAvailableUnits = availableProducts.reduce(
    (sum, product) => sum + product.stockQuantity,
    0,
  );
  const totalAvailableValue = availableProducts.reduce(
    (sum, product) => sum + product.stockQuantity * product.price,
    0,
  );
  const selectedCustomer = messages[0]?.customerPhone ?? "";
  const selectedMessages = messages
    .filter((message) => message.customerPhone === selectedCustomer)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selectedState = states.find((state) => state.customerPhone === selectedCustomer);

  const groupedCustomers = useMemo(() => {
    return Array.from(new Set(messages.map((message) => message.customerPhone)));
  }, [messages]);

  useEffect(() => {
    void refreshAll();
    const events = new EventSource("/api/events");
    events.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.type === "order.created") {
        setOrders((current) => [event.order, ...current]);
        playDing();
      }
      if (event.type === "order.updated") {
        setOrders((current) =>
          current.map((order) => (order.id === event.order.id ? event.order : order)),
        );
      }
      if (event.type === "catalog.updated") void refreshCatalog();
      if (event.type === "conversation.message") {
        setMessages((current) => [event.message, ...current]);
      }
      if (event.type === "ignored.message") {
        setIgnoredMessages((current) => [event.message, ...current].slice(0, 20));
      }
      if (event.type === "settings.updated") {
        setSettings(event.settings);
      }
    };
    return () => events.close();
    // The initial bootstrapping functions intentionally run once; SSE keeps state fresh after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!whatsApp?.running || whatsApp.ready || whatsApp.qrDataUrl) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/whatsapp/session", { cache: "no-store" });
        const data = (await response.json()) as MessagingStatus & { error?: string };
        setWhatsApp(data);
        setWhatsAppError(data.error || data.lastError || "");
      } catch (error) {
        setWhatsAppError(error instanceof Error ? error.message : "Could not read WhatsApp status");
      }
    }, 2_000);

    return () => window.clearInterval(interval);
  }, [whatsApp?.running, whatsApp?.ready, whatsApp?.qrDataUrl]);

  async function refreshAll() {
    await Promise.all([
      refreshCatalog(),
      refreshOrders(),
      refreshConversations(),
      refreshWhatsApp(),
      refreshDebug(),
    ]);
  }

  async function refreshCatalog() {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    const data = (await response.json()) as CatalogReadResult;
    setCatalogResult(data);
    setSyncNote(data.syncing ? "syncing..." : data.source === "cache" ? "cache hot" : data.source);
  }

  async function refreshOrders() {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json();
    setOrders(data.orders ?? []);
  }

  async function refreshConversations() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const data = await response.json();
    setMessages(data.messages ?? []);
    setStates(data.customerStates ?? []);
  }

  async function refreshWhatsApp() {
    try {
      const response = await fetch("/api/whatsapp/session", { cache: "no-store" });
      const data = (await response.json()) as MessagingStatus & { error?: string };
      setWhatsApp(data);
      setWhatsAppError(response.ok ? data.lastError || "" : data.error || data.lastError || "");
    } catch (error) {
      setWhatsAppError(error instanceof Error ? error.message : "Could not read WhatsApp status");
    }
  }

  async function refreshDebug() {
    const response = await fetch("/api/debug", { cache: "no-store" });
    const data = (await response.json()) as DebugPayload;
    setSettings(data.settings);
    setIgnoredMessages(data.ignoredMessages ?? []);
    setRuntimeDebug(data.runtime);
  }

  async function startWhatsApp() {
    setWhatsAppError("");
    setSyncNote("starting WhatsApp...");
    const response = await fetch("/api/whatsapp/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const data = (await response.json()) as MessagingStatus & { error?: string };
    setWhatsApp(data);
    if (!response.ok) {
      setWhatsAppError(data.error || data.lastError || "WhatsApp start failed");
      setSyncNote("WhatsApp start failed");
      return;
    }
    setWhatsAppError(data.lastError || "");
    setSyncNote(data.ready ? "WhatsApp ready" : "WhatsApp starting...");
    window.setTimeout(() => void refreshWhatsApp(), 1_500);
  }

  async function stopWhatsApp() {
    setWhatsAppError("");
    await fetch("/api/whatsapp/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    await refreshWhatsApp();
  }

  async function resetWhatsApp() {
    setWhatsAppError("");
    const response = await fetch("/api/whatsapp/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = (await response.json()) as MessagingStatus & { error?: string };
    setWhatsApp(data);
    setWhatsAppError(response.ok ? data.lastError || "" : data.error || data.lastError || "");
    setSyncNote(response.ok ? "WhatsApp link reset" : "WhatsApp reset failed");
  }

  async function updateOrderStatus(orderId: string, status: Order["status"]) {
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status }),
    });
    const data = await response.json();
    if (response.ok) {
      const updated = data.order as Order;
      setOrders((current) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      );
      setSyncNote(`order ${updated.status}`);
    } else {
      setSyncNote(data.error || "order update failed");
    }
  }

  async function toggleAiClerk() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiClerkActive: !aiClerkActive }),
    });
    const data = await response.json();
    if (response.ok) {
      setSettings(data.settings);
      setSyncNote(data.settings.aiClerkActive ? "AI Clerk active" : "AI Clerk paused");
    } else {
      setSyncNote(data.error || "settings update failed");
    }
  }

  async function saveProduct() {
    if (!draft.itemName) return;
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        aliases: typeof draft.aliases === "string" ? draft.aliases : draft.aliases?.join(", "),
      }),
    });
    setDraft({ itemName: "", category: "General", price: 0, stockQuantity: 0, aliases: [] });
    await refreshCatalog();
  }

  function startEditProduct(product: CatalogProduct) {
    setEditingProductId(product.id);
    setEditDraft({ ...product });
  }

  async function updateProduct() {
    if (!editingProductId || !editDraft.itemName) return;
    const response = await fetch("/api/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editDraft,
        id: editingProductId,
        aliases: Array.isArray(editDraft.aliases) ? editDraft.aliases : [],
      }),
    });
    const data = await response.json();
    setSyncNote(response.ok ? `updated ${data.product.itemName}` : data.error || "update failed");
    setEditingProductId(null);
    setEditDraft({});
    await refreshCatalog();
  }

  async function deleteProduct(product: CatalogProduct) {
    const response = await fetch("/api/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id }),
    });
    const data = await response.json();
    setSyncNote(response.ok ? `deleted ${product.itemName}` : data.error || "delete failed");
    await refreshCatalog();
  }

  async function takeOver(value: boolean) {
    if (!selectedCustomer) return;
    await fetch("/api/conversations/takeover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerPhone: selectedCustomer, humanTakeover: value }),
    });
    await refreshConversations();
  }

  async function importCatalog() {
    if (!importCsv.trim()) return;
    const response = await fetch("/api/catalog/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv: importCsv,
        mapping: {
          itemName: "Item Name",
          category: "Category",
          price: "Price",
          stockQuantity: "Stock Quantity",
          aliases: "Aliases",
        },
      }),
    });
    const data = await response.json();
    setSyncNote(response.ok ? `imported ${data.imported} SKUs` : data.error || "import failed");
    await refreshCatalog();
  }

  async function applyVoiceTranscript(transcript: string) {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      setVoiceResult("Type or speak a stock update first.");
      return;
    }
    const response = await fetch("/api/voice-stock-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: cleanTranscript }),
    });
    const data = await response.json();
    const nextMessage = data.applied
      ? data.message ??
        `Updated ${data.product.itemName}: stock is now ${data.product.stockQuantity}`
      : data.message || "Could not parse. Edit manually or try a clearer command.";
    setVoiceResult(nextMessage);
    setSyncNote(
      data.applied && data.product
        ? `voice updated ${data.product.itemName}`
        : data.applied
          ? "voice command applied"
          : "could not parse voice",
    );
    await refreshCatalog();
  }

  async function startVoice() {
    const SpeechRecognition =
      (window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).SpeechRecognition ||
      (window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSyncNote("voice unavailable in this browser");
      setVoiceResult("Voice capture is unavailable here. Type the command and press Apply.");
      return;
    }

    if (!window.isSecureContext) {
      setSyncNote("voice requires secure page");
      setVoiceResult("Voice capture needs localhost or HTTPS. Open the app on http://localhost:3000, or type the command and press Apply.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
      stream?.getTracks().forEach((track) => track.stop());
    } catch {
      setIsListening(false);
      setSyncNote("microphone blocked");
      setVoiceResult("Microphone permission is blocked. Allow microphone access in the browser, then try again, or type the command and press Apply.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListening(true);
    setVoiceResult("Listening...");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      void applyVoiceTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const messages: Record<SpeechRecognitionErrorEvent["error"], string> = {
        aborted: "Voice capture was stopped before a result came in.",
        "audio-capture": "No microphone was found. Check your mic input, or type the command and press Apply.",
        "bad-grammar": "The browser rejected the speech grammar. Type the command and press Apply.",
        "language-not-supported": "This browser does not support en-IN speech recognition. Try Chrome/Edge, or type the command and press Apply.",
        network: "Chrome's speech service could not be reached. Check internet access, or type the command and press Apply.",
        "no-speech": "No speech was detected. Try again closer to the mic, or type the command and press Apply.",
        "not-allowed": "Microphone access is blocked. Click the lock icon in the address bar and allow microphone access.",
        "service-not-allowed": "The browser speech service is blocked. Try Chrome/Edge, or type the command and press Apply.",
      };
      setSyncNote(`voice: ${event.error}`);
      setVoiceResult(messages[event.error] ?? "Voice capture failed. Type the command and press Apply.");
    };
    recognition.onend = () => setIsListening(false);
    recognition.onnomatch = () => {
      setIsListening(false);
      setVoiceResult("Could not understand that command. Try saying 'Add 10 SG Cricket balls' or type it and press Apply.");
    };
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setSyncNote("voice could not start");
      setVoiceResult("Voice capture could not start. Refresh the page or type the command and press Apply.");
    }
  }

  function playDing() {
    audioContext.current ??= new AudioContext();
    const ctx = audioContext.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 880;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] text-[#20242a]">
      <header className="border-b border-[#ded6ca] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b42318]">
              Smart Clerk
            </p>
            <h1 className="text-2xl font-bold">Sharma Sports & Fitness</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`rounded-md px-3 py-2 text-xs font-bold ${
                aiClerkActive
                  ? "bg-[#b42318] text-white"
                  : "border border-[#b42318] bg-white text-[#b42318]"
              }`}
              onClick={toggleAiClerk}
            >
              {aiClerkActive ? "Pause AI Clerk" : "Resume AI Clerk"}
            </button>
            <StatusPill active={aiClerkActive} label={`AI Clerk: ${aiClerkActive ? "ACTIVE" : "PAUSED"}`} />
            <StatusPill active={whatsApp?.ready ?? false} label="WhatsApp demo" />
            <span className="rounded-md border border-[#ded6ca] bg-[#fbfaf8] px-3 py-2 text-xs font-semibold text-[#52616f]">
              {syncNote}
            </span>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-7xl gap-2 px-5 py-4">
        {(["dashboard", "stock", "catalog", "conversations"] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
              tab === item
                ? "bg-[#b42318] text-white"
                : "border border-[#ded6ca] bg-white text-[#52616f]"
            }`}
          >
            {item}
          </button>
        ))}
        <button
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-[#ded6ca] bg-white px-3 py-2 text-sm font-semibold"
          onClick={refreshAll}
          title="Refresh dashboard data"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </nav>

      <section className="mx-auto max-w-7xl px-5 pb-8">
        {tab === "dashboard" && (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr]">
            <Panel title="Live orders" action={<PackageCheck size={18} />}>
              <div className="space-y-3">
                {activeOrders.length === 0 && <EmptyState text="No active orders." />}
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-[#c9e7d0] bg-[#ecfdf3] p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">NEW ORDER: {order.quantity}x {order.itemName}</p>
                      <span className="rounded-md bg-[#087443] px-2 py-1 text-xs font-bold uppercase text-white">
                        {order.status === "pending" ? "PACK THIS ITEM" : order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#345042]">
                      Customer: {order.customerName || order.customerPhone} | Amount: Rs. {order.amount}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.status === "pending" ? (
                        <button
                          className="rounded-md border border-[#087443] bg-white px-3 py-2 text-xs font-bold text-[#087443]"
                          onClick={() => updateOrderStatus(order.id, "packed")}
                        >
                          Mark packed
                        </button>
                      ) : null}
                      <button
                        className="rounded-md bg-[#087443] px-3 py-2 text-xs font-bold text-white"
                        onClick={() => updateOrderStatus(order.id, "completed")}
                      >
                        Complete
                      </button>
                      <button
                        className="rounded-md border border-[#b42318] bg-white px-3 py-2 text-xs font-bold text-[#b42318]"
                        onClick={() => updateOrderStatus(order.id, "cancelled")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
                {closedOrders.length ? (
                  <div className="rounded-lg border border-[#ded6ca] bg-[#fbfaf8] px-3 py-2 text-sm text-[#52616f]">
                    {closedOrders.length} completed/cancelled order{closedOrders.length === 1 ? "" : "s"} hidden from live queue.
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Low stock alerts" action={<ShieldAlert size={18} />}>
              <div className="space-y-3">
                {lowStock.length === 0 && <EmptyState text="No low-stock products." />}
                {lowStock.map((product) => (
                  <div key={product.id} className="rounded-lg border border-[#f4c7c3] bg-[#fff5f5] p-4">
                    <p className="font-bold">{product.itemName}</p>
                    <p className="mt-1 text-sm text-[#7a271a]">
                      Only {product.stockQuantity} left. Ask AI to reorder?
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="WhatsApp live client" action={<Bot size={18} />}>
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="primary-button" onClick={startWhatsApp}>
                      <Play size={16} /> Start shop WhatsApp QR
                    </button>
                    <button className="icon-button" onClick={stopWhatsApp} title="Stop QR session">
                      <Square size={16} />
                    </button>
                    <button
                      className="rounded-md border border-[#ded6ca] bg-white px-3 py-2 text-sm font-bold text-[#b42318]"
                      onClick={resetWhatsApp}
                    >
                      Reset link
                    </button>
                    <span className="rounded-md bg-[#fbfaf8] px-3 py-2 text-sm">
                      {whatsApp?.running ? (whatsApp.ready ? "Ready" : "Waiting for QR") : "Stopped"}
                    </span>
                  </div>
                  {whatsAppError ? (
                    <div className="rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-3 py-2 text-sm text-[#7a271a]">
                      {whatsAppError}
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-[#ded6ca] bg-[#fbfaf8] px-3 py-3 text-sm text-[#344054]">
                    {whatsApp?.ready
                      ? "Shop WhatsApp is linked. Text this shop number from another phone to test real AI replies."
                      : whatsApp?.running
                        ? "Open WhatsApp on the shop owner's phone, go to Linked devices, and scan the QR."
                        : "Click Start shop WhatsApp QR, then scan it from the shop owner's WhatsApp."}
                  </div>
                  <div className="rounded-lg border border-[#ded6ca] bg-white px-3 py-3 text-xs text-[#52616f]">
                    <div className="flex flex-wrap gap-2">
                      <span>AI: {runtimeDebug?.aiProvider ?? "..."}</span>
                      <span>Mode: {runtimeDebug?.demoMode ? "demo" : "live"}</span>
                      <span>Groups: {runtimeDebug?.whatsappGroupsAllowed ? "allowed" : "blocked"}</span>
                      <span>Ignored: {ignoredMessages.length}</span>
                    </div>
                    {ignoredMessages[0] ? (
                      <p className="mt-2">
                        Last ignored: {ignoredMessages[0].reason} from {ignoredMessages[0].from}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[#ded6ca] bg-[#fbfaf8]">
                  {whatsApp?.qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={whatsApp.qrDataUrl} alt="WhatsApp QR code" className="h-40 w-40" />
                  ) : whatsApp?.ready ? (
                    <p className="px-4 text-center text-sm font-semibold text-[#087443]">
                      WhatsApp is linked and ready.
                    </p>
                  ) : whatsApp?.running ? (
                    <p className="px-4 text-center text-sm text-[#52616f]">
                      Starting WhatsApp Web. QR can take a few seconds.
                    </p>
                  ) : (
                    <p className="px-4 text-center text-sm text-[#52616f]">
                      Click Start shop WhatsApp QR to generate the linking code.
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        )}

        {tab === "stock" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Available SKUs" value={availableProducts.length.toString()} />
              <MetricCard label="Available Units" value={totalAvailableUnits.toString()} />
              <MetricCard label="Stock Value" value={`Rs. ${totalAvailableValue.toLocaleString("en-IN")}`} />
              <MetricCard label="Low Stock" value={lowStock.length.toString()} tone="warning" />
            </div>

            <Panel title="Available stock" action={<Boxes size={18} />}>
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#52616f]"
                    size={16}
                  />
                  <input
                    className="field pl-10"
                    placeholder="Search item, category, or alias"
                    value={stockSearch}
                    onChange={(event) => setStockSearch(event.target.value)}
                  />
                </label>
                <select
                  className="field"
                  value={stockCategory}
                  onChange={(event) => setStockCategory(event.target.value)}
                >
                  {stockCategories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "All categories" : category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#52616f]">
                      <th className="table-head">Item</th>
                      <th className="table-head">Category</th>
                      <th className="table-head">Available</th>
                      <th className="table-head">Price</th>
                      <th className="table-head">Stock Value</th>
                      <th className="table-head">Status</th>
                      <th className="table-head">Aliases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((product) => {
                      const isLow = product.stockQuantity <= product.lowStockThreshold;
                      return (
                        <tr key={product.id} className="bg-white">
                          <td className="table-cell font-semibold">{product.itemName}</td>
                          <td className="table-cell">{product.category}</td>
                          <td className="table-cell text-base font-bold">{product.stockQuantity}</td>
                          <td className="table-cell">Rs. {product.price}</td>
                          <td className="table-cell">
                            Rs. {(product.price * product.stockQuantity).toLocaleString("en-IN")}
                          </td>
                          <td className="table-cell">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-bold ${
                                isLow
                                  ? "bg-[#fff5f5] text-[#b42318]"
                                  : "bg-[#ecfdf3] text-[#087443]"
                              }`}
                            >
                              {isLow ? "LOW STOCK" : "AVAILABLE"}
                            </span>
                          </td>
                          <td className="table-cell text-[#52616f]">{product.aliases.join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredStock.length === 0 && (
                <div className="mt-4">
                  <EmptyState text="No available stock matches this filter." />
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "catalog" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Panel title="Magic catalog manager" action={<Bell size={18} />}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button className="primary-button" onClick={() => void startVoice()}>
                  <Mic size={16} /> {isListening ? "Listening..." : "Update Stock via Voice"}
                </button>
                <input
                  className="field min-w-72 flex-1"
                  placeholder="Try: Add 10 SG Cricket balls"
                  value={voiceTranscript}
                  onChange={(event) => setVoiceTranscript(event.target.value)}
                />
                <button
                  className="rounded-md border border-[#ded6ca] bg-white px-4 py-2 text-sm font-bold text-[#b42318]"
                  onClick={() => applyVoiceTranscript(voiceTranscript)}
                >
                  Apply
                </button>
              </div>
              {voiceResult && (
                <p className="mb-4 rounded-md border border-[#ded6ca] bg-[#fbfaf8] px-3 py-2 text-sm text-[#52616f]">
                  {voiceResult}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#52616f]">
                      <th className="table-head">Item Name</th>
                      <th className="table-head">Category</th>
                      <th className="table-head">Price</th>
                      <th className="table-head">Stock Quantity</th>
                      <th className="table-head">Aliases</th>
                      <th className="table-head">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const isEditing = editingProductId === product.id;
                      return (
                        <tr key={product.id} className="bg-white">
                          <td className="table-cell font-semibold">
                            {isEditing ? (
                              <input
                                className="field"
                                value={editDraft.itemName ?? ""}
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, itemName: event.target.value })
                                }
                              />
                            ) : (
                              product.itemName
                            )}
                          </td>
                          <td className="table-cell">
                            {isEditing ? (
                              <input
                                className="field"
                                value={editDraft.category ?? ""}
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, category: event.target.value })
                                }
                              />
                            ) : (
                              product.category
                            )}
                          </td>
                          <td className="table-cell">
                            {isEditing ? (
                              <input
                                className="field"
                                type="number"
                                value={editDraft.price ?? 0}
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, price: Number(event.target.value) })
                                }
                              />
                            ) : (
                              `Rs. ${product.price}`
                            )}
                          </td>
                          <td className="table-cell">
                            {isEditing ? (
                              <input
                                className="field"
                                type="number"
                                value={editDraft.stockQuantity ?? 0}
                                onChange={(event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    stockQuantity: Number(event.target.value),
                                  })
                                }
                              />
                            ) : (
                              product.stockQuantity
                            )}
                          </td>
                          <td className="table-cell text-[#52616f]">
                            {isEditing ? (
                              <input
                                className="field"
                                value={editDraft.aliases?.join(", ") ?? ""}
                                onChange={(event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    aliases: event.target.value
                                      .split(",")
                                      .map((alias) => alias.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            ) : (
                              product.aliases.join(", ")
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    className="icon-button"
                                    onClick={updateProduct}
                                    title="Save changes"
                                  >
                                    <Save size={16} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    onClick={() => {
                                      setEditingProductId(null);
                                      setEditDraft({});
                                    }}
                                    title="Cancel edit"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="icon-button"
                                    onClick={() => startEditProduct(product)}
                                    title="Edit item"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    className="icon-button danger-button"
                                    onClick={() => deleteProduct(product)}
                                    title="Delete item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="Add SKU" action={<PackageCheck size={18} />}>
                <div className="space-y-2">
                  <input className="field" placeholder="Item Name" value={draft.itemName ?? ""} onChange={(event) => setDraft({ ...draft, itemName: event.target.value })} />
                  <input className="field" placeholder="Category" value={draft.category ?? ""} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
                  <input className="field" placeholder="Price" type="number" value={draft.price ?? 0} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} />
                  <input className="field" placeholder="Stock Quantity" type="number" value={draft.stockQuantity ?? 0} onChange={(event) => setDraft({ ...draft, stockQuantity: Number(event.target.value) })} />
                  <input className="field" placeholder="Aliases comma separated" value={Array.isArray(draft.aliases) ? draft.aliases.join(", ") : ""} onChange={(event) => setDraft({ ...draft, aliases: event.target.value.split(",").map((alias) => alias.trim()).filter(Boolean) })} />
                  <button className="primary-button w-full justify-center" onClick={saveProduct}>
                    Save SKU
                  </button>
                </div>
              </Panel>

              <Panel title="Bulk CSV import" action={<FileUp size={18} />}>
                <textarea
                  className="field min-h-40"
                  placeholder={"Item Name,Category,Price,Stock Quantity,Aliases\nCosco Football,Football,750,12,football, ball"}
                  value={importCsv}
                  onChange={(event) => setImportCsv(event.target.value)}
                />
                <button className="primary-button mt-2 w-full justify-center" onClick={importCatalog}>
                  Import catalog
                </button>
              </Panel>
            </div>
          </div>
        )}

        {tab === "conversations" && (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Panel title="Customers" action={<UserRoundCheck size={18} />}>
              <div className="space-y-2">
                {groupedCustomers.map((customer) => (
                  <div key={customer} className="rounded-md border border-[#ded6ca] bg-[#fbfaf8] px-3 py-2 text-sm font-semibold">
                    {customer}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="AI conversation log"
              action={
                <button
                  className="rounded-md bg-[#b42318] px-3 py-2 text-xs font-bold text-white"
                  onClick={() => takeOver(!selectedState?.humanTakeover)}
                >
                  {selectedState?.humanTakeover ? "Release AI" : "Take Over Chat"}
                </button>
              }
            >
              <div className="grid min-h-[520px] gap-4 md:grid-cols-2">
                <div className="space-y-3 border-r border-[#ded6ca] pr-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52616f]">
                    Customer
                  </p>
                  {selectedMessages
                    .filter((message) => message.direction === "inbound")
                    .map((message) => (
                      <ChatBubble key={message.id} message={message} />
                    ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52616f]">
                    AI Clerk
                  </p>
                  {selectedMessages
                    .filter((message) => message.direction === "outbound")
                    .map((message) => (
                      <ChatBubble key={message.id} message={message} />
                    ))}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </section>
    </main>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#ded6ca] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        <div className="text-[#b42318]">{action}</div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "warning"
          ? "border-[#f4c7c3] bg-[#fff5f5]"
          : "border-[#ded6ca] bg-white"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#52616f]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === "warning" ? "text-[#b42318]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-[#ded6ca] bg-[#fbfaf8] px-3 py-2 text-xs font-bold">
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "animate-pulse bg-[#12b76a]" : "bg-[#98a2b3]"}`} />
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#ded6ca] bg-[#fbfaf8] p-4 text-sm text-[#52616f]">{text}</p>;
}

function ChatBubble({ message }: { message: ConversationMessage }) {
  return (
    <div className="rounded-lg border border-[#ded6ca] bg-[#fbfaf8] p-3">
      <p className="text-sm">{message.body}</p>
      {message.intent && (
        <p className="mt-2 text-xs text-[#52616f]">
          {message.intent.intent} | confidence {message.intent.confidence.toFixed(2)}
          {message.intent.source ? ` | ${message.intent.source}` : ""}
        </p>
      )}
      {message.replySource && !message.intent ? (
        <p className="mt-2 text-xs text-[#52616f]">{message.replySource}</p>
      ) : null}
    </div>
  );
}
