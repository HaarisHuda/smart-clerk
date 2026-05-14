// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable */

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search, Plus, Trash2, Save, X, ChevronDown, ChevronRight,
  Package, AlertTriangle, MessageSquare, BarChart3, Mic, MicOff,
  Check, Clock, Phone, Bot, User, ArrowUpRight, ArrowDownRight,
  FileUp, Volume2, Eye, EyeOff, RefreshCw, Settings, Shield,
  TrendingUp, IndianRupee, Boxes, ShoppingBag, Edit3, Send,
  Zap, Activity, Bell, LayoutDashboard, BookOpen, Users, Radio
} from "lucide-react";

const SEED_CATALOG = [
  { id: "sku-1", itemName: "Nivia Tennis Ball", category: "Balls", price: 400, stockQuantity: 24, aliases: ["tennis ball", "nivia ball"], active: true, lowStockThreshold: 5, updatedAt: "2026-05-14T10:00:00Z" },
  { id: "sku-2", itemName: "Yonex Nanoray 10F", category: "Badminton", price: 1950, stockQuantity: 6, aliases: ["yonex racket", "nanoray"], active: true, lowStockThreshold: 3, updatedAt: "2026-05-14T10:00:00Z" },
  { id: "sku-3", itemName: "MRF Cricket Bat", category: "Cricket", price: 2850, stockQuantity: 2, aliases: ["mrf bat", "cricket bat"], active: true, lowStockThreshold: 3, updatedAt: "2026-05-14T09:30:00Z" },
  { id: "sku-4", itemName: "SG Cricket Ball", category: "Cricket", price: 260, stockQuantity: 18, aliases: ["sg ball", "leather ball"], active: true, lowStockThreshold: 6, updatedAt: "2026-05-14T09:00:00Z" },
  { id: "sku-5", itemName: "Li-Ning Shuttle Cork", category: "Badminton", price: 95, stockQuantity: 40, aliases: ["shuttle", "chidiya", "cork"], active: true, lowStockThreshold: 10, updatedAt: "2026-05-14T08:00:00Z" },
  { id: "sku-6", itemName: "Cosco Football", category: "Football", price: 750, stockQuantity: 8, aliases: ["football", "cosco ball"], active: true, lowStockThreshold: 4, updatedAt: "2026-05-14T07:00:00Z" },
  { id: "sku-7", itemName: "Adidas Shin Guard", category: "Protection", price: 580, stockQuantity: 15, aliases: ["shin guard", "leg guard"], active: true, lowStockThreshold: 5, updatedAt: "2026-05-14T06:00:00Z" },
  { id: "sku-8", itemName: "Nike Grip Tape", category: "Accessories", price: 120, stockQuantity: 1, aliases: ["grip", "tape", "bat grip"], active: true, lowStockThreshold: 5, updatedAt: "2026-05-14T05:00:00Z" },
];

const SEED_ORDERS = [
  { id: "ord-1", customerPhone: "+919876500001", customerName: "Aman Verma", productId: "sku-2", itemName: "Yonex Nanoray 10F", quantity: 1, amount: 1950, status: "pending", createdAt: "2026-05-14T10:12:00Z" },
  { id: "ord-2", customerPhone: "+919876500002", customerName: "Priya Sharma", productId: "sku-1", itemName: "Nivia Tennis Ball", quantity: 2, amount: 800, status: "packed", createdAt: "2026-05-14T09:45:00Z" },
  { id: "ord-3", customerPhone: "+919876500003", customerName: "Rahul Gupta", productId: "sku-4", itemName: "SG Cricket Ball", quantity: 6, amount: 1560, status: "completed", createdAt: "2026-05-14T08:30:00Z" },
];

const SEED_CONVERSATIONS = [
  { id: "m1", customerPhone: "+919876500001", direction: "inbound", body: "Bhaiya, Yonex racket hai kya?", actor: "customer", createdAt: "2026-05-14T10:10:00Z" },
  { id: "m2", customerPhone: "+919876500001", direction: "outbound", body: "Haan ji! Yonex Nanoray 10F available hai, ₹1,950 ka. Pack karun?", actor: "ai", createdAt: "2026-05-14T10:10:05Z" },
  { id: "m3", customerPhone: "+919876500001", direction: "inbound", body: "Haan bhai, 1 piece pack kar do. 10 min mein aa raha hun.", actor: "customer", createdAt: "2026-05-14T10:11:00Z" },
  { id: "m4", customerPhone: "+919876500001", direction: "outbound", body: "Done! 1x Yonex Nanoray 10F packed hai. ₹1,950 counter pe de dena. 🏸", actor: "ai", createdAt: "2026-05-14T10:11:05Z" },
  { id: "m5", customerPhone: "+919876500002", direction: "inbound", body: "Tennis ball kitne ki hai?", actor: "customer", createdAt: "2026-05-14T09:40:00Z" },
  { id: "m6", customerPhone: "+919876500002", direction: "outbound", body: "Nivia Tennis Ball ₹400 ki hai per piece. Kitne chahiye?", actor: "ai", createdAt: "2026-05-14T09:40:05Z" },
  { id: "m7", customerPhone: "+919876500002", direction: "inbound", body: "2 piece de do", actor: "customer", createdAt: "2026-05-14T09:42:00Z" },
  { id: "m8", customerPhone: "+919876500002", direction: "outbound", body: "2x Nivia Tennis Ball pack ho gayi. Total ₹800. Jab aayein collect kar lena!", actor: "ai", createdAt: "2026-05-14T09:42:05Z" },
  { id: "m9", customerPhone: "+919876500003", direction: "inbound", body: "Bhai cricket ball hai? SG chahiye", actor: "customer", createdAt: "2026-05-14T08:25:00Z" },
  { id: "m10", customerPhone: "+919876500003", direction: "outbound", body: "SG Cricket Ball available hai, ₹260 per piece. Kitne pack karun?", actor: "ai", createdAt: "2026-05-14T08:25:05Z" },
];

const fmt = (n) => n.toLocaleString("en-IN");
const timeAgo = (iso) => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
};

const TAB_CONFIG = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "stock", label: "Stock", icon: Boxes },
  { key: "catalog", label: "Catalog", icon: BookOpen },
  { key: "conversations", label: "Chats", icon: MessageSquare },
];

export default function SmartClerkDashboard() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiActive, setAiActive] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [draft, setDraft] = useState({ itemName: "", category: "", price: 0, stockQuantity: 0, aliases: "" });
  const [voiceText, setVoiceText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [replyText, setReplyText] = useState("");
  const [humanTakeover, setHumanTakeover] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [notification, setNotification] = useState("");
  const [customerStates, setCustomerStates] = useState([]);
  const [importCsv, setImportCsv] = useState("");
  const [syncNote, setSyncNote] = useState("Ready");
  const [whatsappStatus, setWhatsappStatus] = useState({ running: false, ready: false, qrDataUrl: "", lastError: "" });

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const activeProducts = products.filter(p => p.active && p.stockQuantity > 0);
  const lowStock = products.filter(p => p.active && p.stockQuantity <= p.lowStockThreshold);
  const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "cancelled");
  const categories = ["all", ...new Set(activeProducts.map(p => p.category))];
  const totalValue = activeProducts.reduce((s, p) => s + p.price * p.stockQuantity, 0);
  const totalUnits = activeProducts.reduce((s, p) => s + p.stockQuantity, 0);
  const todayRevenue = orders.filter(o => o.status === "completed").reduce((s, o) => s + o.amount, 0);

  const filteredStock = useMemo(() => {
    const q = stockSearch.toLowerCase();
    return activeProducts
      .filter(p => stockCategory === "all" || p.category === stockCategory)
      .filter(p => !q || [p.itemName, p.category, ...p.aliases].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.category.localeCompare(b.category) || a.itemName.localeCompare(b.itemName));
  }, [activeProducts, stockCategory, stockSearch]);

  const customers = [...new Set(conversations.map(m => m.customerPhone))];
  const customerMsgs = conversations.filter(m => m.customerPhone === selectedCustomer).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const customerName = (phone) => {
    const o = orders.find(o => o.customerPhone === phone);
    return o?.customerName || phone.replace("+91", "+91 ").replace(/(\d{5})(\d{5})/, "$1 $2");
  };

  async function refreshAll() {
    await Promise.all([refreshCatalog(), refreshOrders(), refreshConversations(), refreshDebug(), refreshWhatsAppStatus()]);
  }

  async function refreshCatalog() {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    const data = await response.json();
    setProducts(data.products || []);
    setSyncNote(data.syncing ? "syncing..." : data.source || "synced");
  }

  async function refreshOrders() {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json();
    setOrders(data.orders || []);
  }

  async function refreshConversations() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const data = await response.json();
    const nextMessages = data.messages || [];
    setConversations(nextMessages);
    setCustomerStates(data.customerStates || []);
    setSelectedCustomer(current => current || nextMessages[0]?.customerPhone || "");
  }

  async function refreshDebug() {
    const response = await fetch("/api/debug", { cache: "no-store" });
    const data = await response.json();
    if (data.settings) setAiActive(Boolean(data.settings.aiClerkActive));
    if (data.whatsappStatus) setWhatsappStatus(data.whatsappStatus);
  }

  async function refreshWhatsAppStatus() {
    const response = await fetch("/api/whatsapp/session", { cache: "no-store" });
    const data = await response.json();
    setWhatsappStatus(data);
  }

  async function updateWhatsAppSession(action) {
    const response = await fetch("/api/whatsapp/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    setWhatsappStatus(data);
    if (response.ok) {
      notify(
        action === "stop"
          ? "WhatsApp client stopped"
          : action === "reset"
            ? "WhatsApp session reset. Start again for a fresh QR."
            : data.ready
              ? "WhatsApp client ready"
              : "WhatsApp client starting. Scan QR when it appears."
      );
    } else {
      notify(data.error || data.lastError || "WhatsApp session failed");
    }
  }

  async function toggleAiActive() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiClerkActive: !aiActive }),
    });
    const data = await response.json();
    if (response.ok) {
      setAiActive(Boolean(data.settings.aiClerkActive));
      notify(data.settings.aiClerkActive ? "AI Clerk activated" : "AI Clerk paused");
    } else {
      notify(data.error || "Could not update AI Clerk");
    }
  }

  async function setTakeover(value) {
    if (!selectedCustomer) return;
    const response = await fetch("/api/conversations/takeover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerPhone: selectedCustomer, humanTakeover: value }),
    });
    if (response.ok) {
      setHumanTakeover(value);
      await refreshConversations();
      notify(value ? "You took over chat" : "AI resumed");
    } else {
      const data = await response.json();
      notify(data.error || "Could not update takeover");
    }
  }

  async function applyVoiceText(transcript = voiceText) {
    if (!transcript.trim()) return notify("Type or speak a stock update first");
    const response = await fetch("/api/voice-stock-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcript.trim() }),
    });
    const data = await response.json();
    notify(data.message || (data.applied ? "Voice command applied" : "Could not parse, edit manually"));
    if (data.applied) await refreshCatalog();
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("Voice unavailable here. Type the command and press Apply.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListening(true);
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      void applyVoiceText(transcript);
    };
    recognition.onerror = () => { setIsListening(false); notify("Could not hear that. Type it manually?"); };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  async function importCatalog() {
    if (!importCsv.trim()) return notify("Paste CSV rows first");
    const response = await fetch("/api/catalog/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv: importCsv,
        mapping: { itemName: "Item Name", category: "Category", price: "Price", stockQuantity: "Stock", aliases: "Aliases" },
      }),
    });
    const data = await response.json();
    notify(response.ok ? "Imported " + data.imported + " SKUs" : data.error || "Import failed");
    if (response.ok) await refreshCatalog();
  }

  useEffect(() => {
    void refreshAll();
    const events = new EventSource("/api/events");
    events.onmessage = message => {
      const event = JSON.parse(message.data);
      if (event.type === "order.created") { setOrders(current => [event.order, ...current]); notify("New order received"); }
      if (event.type === "order.updated") setOrders(current => current.map(order => order.id === event.order.id ? event.order : order));
      if (event.type === "catalog.updated") void refreshCatalog();
      if (event.type === "conversation.message") {
        setConversations(current => [event.message, ...current]);
        setSelectedCustomer(current => current || event.message.customerPhone);
      }
      if (event.type === "settings.updated") setAiActive(Boolean(event.settings.aiClerkActive));
    };
    return () => events.close();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshWhatsAppStatus();
    }, whatsappStatus.running && !whatsappStatus.ready ? 3000 : 10000);
    return () => clearInterval(timer);
  }, [whatsappStatus.running, whatsappStatus.ready]);

  useEffect(() => {
    const state = customerStates.find(s => s.customerPhone === selectedCustomer);
    setHumanTakeover(Boolean(state?.humanTakeover));
  }, [selectedCustomer, customerStates]);

  const updateOrder = async (id, status) => {
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await response.json();
    if (response.ok) {
      setOrders(prev => prev.map(o => o.id === id ? data.order : o));
      notify("Order " + (status === "packed" ? "packed" : status === "completed" ? "completed" : "cancelled"));
    } else {
      notify(data.error || "Order update failed");
    }
  };

  const saveNewProduct = async () => {
    if (!draft.itemName) return;
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, aliases: draft.aliases }),
    });
    const data = await response.json();
    if (response.ok) {
      setProducts(prev => [data.product, ...prev]);
      setDraft({ itemName: "", category: "", price: 0, stockQuantity: 0, aliases: "" });
      setShowAddForm(false);
      notify(data.product.itemName + " added to catalog");
      await refreshCatalog();
    } else {
      notify(data.error || "Could not save SKU");
    }
  };

  const saveEdit = async () => {
    const response = await fetch("/api/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editDraft, id: editingId }),
    });
    const data = await response.json();
    if (response.ok) {
      setProducts(prev => prev.map(p => p.id === editingId ? data.product : p));
      setEditingId(null);
      notify("Product updated");
      await refreshCatalog();
    } else {
      notify(data.error || "Product update failed");
    }
  };

  const deleteProduct = async (id) => {
    const response = await fetch("/api/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (response.ok) {
      setProducts(prev => prev.filter(p => p.id !== id));
      notify("Product deleted");
      await refreshCatalog();
    } else {
      notify(data.error || "Delete failed");
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    const response = await fetch("/api/conversations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerPhone: selectedCustomer, body: replyText.trim() }),
    });
    const data = await response.json();
    if (response.ok) {
      setConversations(prev => [data.message, ...prev]);
      setReplyText("");
      notify("Reply sent");
    } else {
      notify(data.error || "Reply failed");
    }
  };

  const styles = {
    app: { fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif", background: "#F7F8FA", minHeight: "100vh", color: "#1A1D21" },
    sidebar: { width: 220, background: "#FFFFFF", borderRight: "1px solid #E8ECF0", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 },
    main: { marginLeft: 220, minHeight: "100vh" },
    header: { background: "#FFFFFF", borderBottom: "1px solid #E8ECF0", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 },
    content: { padding: "24px 32px" },
    card: { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E8ECF0", overflow: "hidden" },
    metricCard: (accent) => ({
      background: "#FFFFFF", borderRadius: 12, border: "1px solid #E8ECF0", padding: "20px 24px",
      borderLeft: `4px solid ${accent}`, position: "relative",
    }),
  };

  const P = { blue: "#2563EB", green: "#16A34A", red: "#DC2626", amber: "#D97706", purple: "#7C3AED", indigo: "#4F46E5", teal: "#0D9488" };
  const whatsappPhase = whatsappStatus.ready
    ? "Ready"
    : whatsappStatus.authenticated
      ? "Authenticated"
      : whatsappStatus.qrDataUrl
        ? "Scan QR"
        : whatsappStatus.running
          ? "Starting"
          : "Stopped";
  const whatsappPhaseColor = whatsappStatus.ready
    ? P.green
    : whatsappStatus.authenticated
      ? P.blue
      : whatsappStatus.running || whatsappStatus.qrDataUrl
        ? P.amber
        : "#64748B";
  const whatsappHelperText = whatsappStatus.ready
    ? "Shop WhatsApp is linked and ready. Text this number from another phone to test real AI replies."
    : whatsappStatus.authenticated
      ? "QR scan was accepted. Waiting for WhatsApp Web to finish loading on the server."
      : whatsappStatus.qrDataUrl
        ? "Scan this QR from the shop WhatsApp phone."
        : whatsappStatus.running
          ? "WhatsApp Web is starting. QR can take a few seconds to appear."
          : "Start the client after every server restart or Render wake-up before testing replies.";

  return (
    <div style={styles.app}>
      {notification && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999, background: "#1A1D21", color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "slideUp 0.3s ease"
        }}>
          <Check size={16} style={{ color: "#4ADE80" }} /> {notification}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        .row-hover:hover { background: #F8FAFC; }
      `}</style>

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #E8ECF0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D21", letterSpacing: "-0.3px" }}>Smart Clerk</div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>AI-powered POS</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 12px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 8px 8px" }}>
            Menu
          </div>
          {TAB_CONFIG.map(t => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "#EFF6FF" : "transparent",
                color: active ? "#2563EB" : "#64748B",
                fontWeight: active ? 600 : 500, fontSize: 13,
                marginBottom: 2, transition: "all 0.15s",
              }}>
                <Icon size={18} />
                {t.label}
                {t.key === "conversations" && (
                  <span style={{
                    marginLeft: "auto", background: active ? "#2563EB" : "#E2E8F0",
                    color: active ? "#fff" : "#64748B", fontSize: 10, fontWeight: 700,
                    padding: "2px 7px", borderRadius: 10, minWidth: 18, textAlign: "center"
                  }}>{customers.length}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid #E8ECF0" }}>
          <div style={{
            background: aiActive ? "#F0FDF4" : "#FEF2F2", borderRadius: 10, padding: "12px 14px",
            border: `1px solid ${aiActive ? "#BBF7D0" : "#FECACA"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: aiActive ? "#16A34A" : "#DC2626",
                  animation: aiActive ? "pulse 2s infinite" : "none"
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: aiActive ? "#166534" : "#991B1B" }}>
                  AI Clerk {aiActive ? "Active" : "Paused"}
                </span>
              </div>
            </div>
            <button onClick={toggleAiActive}
              style={{
                width: "100%", padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: aiActive ? "#DC2626" : "#16A34A", color: "#fff",
                fontSize: 11, fontWeight: 600,
              }}>
              {aiActive ? "Pause AI" : "Resume AI"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1A1D21", letterSpacing: "-0.3px" }}>
              Sharma Sports & Fitness
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B", marginTop: 2 }}>
              {TAB_CONFIG.find(t => t.key === tab)?.label} — Last synced just now
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => void refreshAll()} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff",
              fontSize: 13, fontWeight: 500, color: "#475569", cursor: "pointer"
            }}>
              <RefreshCw size={14} /> Sync
            </button>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              position: "relative"
            }}>
              <Bell size={16} color="#2563EB" />
              {activeOrders.length > 0 && (
                <div style={{
                  position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%",
                  background: "#DC2626", color: "#fff", fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff"
                }}>{activeOrders.length}</div>
              )}
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 600
            }}>SS</div>
          </div>
        </header>

        <div style={styles.content}>
          {/* ===== DASHBOARD ===== */}
          {tab === "dashboard" && (
            <div>
              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Today's revenue", value: `₹${fmt(todayRevenue)}`, icon: IndianRupee, color: P.green, sub: "1 order completed" },
                  { label: "Active orders", value: activeOrders.length, icon: ShoppingBag, color: P.blue, sub: `${orders.length} total` },
                  { label: "Total stock value", value: `₹${fmt(totalValue)}`, icon: TrendingUp, color: P.purple, sub: `${totalUnits} units` },
                  { label: "Low stock alerts", value: lowStock.length, icon: AlertTriangle, color: P.red, sub: "Need reorder" },
                ].map((m, i) => (
                  <div key={i} style={styles.metricCard(m.color)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: "#1A1D21", letterSpacing: "-0.5px" }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{m.sub}</div>
                      </div>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: `${m.color}12`, display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <m.icon size={20} color={m.color} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 20 }}>
                {/* Live orders */}
                <div style={styles.card}>
                  <div style={{
                    padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Package size={18} color={P.blue} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Live orders</span>
                      <span style={{
                        background: "#EFF6FF", color: P.blue, fontSize: 11,
                        fontWeight: 600, padding: "2px 8px", borderRadius: 6
                      }}>{activeOrders.length}</span>
                    </div>
                    <Radio size={14} color={P.green} style={{ animation: "pulse 2s infinite" }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    {activeOrders.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8" }}>
                        <Package size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>No active orders right now</div>
                      </div>
                    ) : activeOrders.map(o => (
                      <div key={o.id} style={{
                        border: `1px solid ${o.status === "pending" ? "#BBF7D0" : "#FDE68A"}`,
                        background: o.status === "pending" ? "#F0FDF4" : "#FFFBEB",
                        borderRadius: 10, padding: 16, marginBottom: 12,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{o.quantity}× {o.itemName}</div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                              {o.customerName || o.customerPhone} · ₹{fmt(o.amount)} · {timeAgo(o.createdAt)}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                            padding: "4px 10px", borderRadius: 6,
                            background: o.status === "pending" ? "#DCFCE7" : "#FEF3C7",
                            color: o.status === "pending" ? "#166534" : "#92400E",
                          }}>{o.status === "pending" ? "Pack this" : o.status}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          {o.status === "pending" && (
                            <button onClick={() => updateOrder(o.id, "packed")} style={{
                              padding: "6px 14px", borderRadius: 6, border: "1px solid #16A34A",
                              background: "#fff", color: "#16A34A", fontSize: 12, fontWeight: 600, cursor: "pointer"
                            }}>Mark packed</button>
                          )}
                          <button onClick={() => updateOrder(o.id, "completed")} style={{
                            padding: "6px 14px", borderRadius: 6, border: "none",
                            background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer"
                          }}>Complete ✓</button>
                          <button onClick={() => updateOrder(o.id, "cancelled")} style={{
                            padding: "6px 14px", borderRadius: 6, border: "1px solid #E2E8F0",
                            background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer"
                          }}>Cancel</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Low stock */}
                <div style={styles.card}>
                  <div style={{
                    padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                    display: "flex", alignItems: "center", gap: 8
                  }}>
                    <AlertTriangle size={18} color={P.red} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Low stock alerts</span>
                  </div>
                  <div style={{ padding: 12 }}>
                    {lowStock.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 24, color: "#94A3B8", fontSize: 13 }}>
                        All items well stocked
                      </div>
                    ) : lowStock.map(p => (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", borderRadius: 8, marginBottom: 6,
                        background: p.stockQuantity <= 2 ? "#FEF2F2" : "#FFFBEB",
                        border: `1px solid ${p.stockQuantity <= 2 ? "#FECACA" : "#FDE68A"}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.itemName}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{p.category}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: p.stockQuantity <= 2 ? "#DC2626" : "#D97706" }}>
                            {p.stockQuantity}
                          </div>
                          <div style={{ fontSize: 10, color: "#94A3B8" }}>left</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ ...styles.card, marginTop: 20 }}>
                <div style={{
                  padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  flexWrap: "wrap"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bot size={18} color={P.blue} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>WhatsApp live client</span>
                    <span style={{
                      background: `${whatsappPhaseColor}18`,
                      color: whatsappPhaseColor,
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      textTransform: "uppercase"
                    }}>
                      {whatsappPhase}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => void updateWhatsAppSession("start")} style={{
                      padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: P.blue, color: "#fff", fontSize: 12, fontWeight: 700,
                    }}>Start / show QR</button>
                    <button onClick={() => void updateWhatsAppSession("stop")} style={{
                      padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer",
                      background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700,
                    }}>Stop</button>
                    <button onClick={() => void updateWhatsAppSession("reset")} style={{
                      padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer",
                      background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 700,
                    }}>Reset QR</button>
                  </div>
                </div>
                <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 500, marginBottom: 8 }}>
                      {whatsappHelperText}
                    </div>
                    {(whatsappStatus.loadingStatus || whatsappStatus.state) && (
                      <div style={{
                        background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A",
                        borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 8,
                      }}>
                        {whatsappStatus.loadingStatus || `State: ${whatsappStatus.state}`}
                      </div>
                    )}
                    {whatsappStatus.lastError && (
                      <div style={{
                        background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
                        borderRadius: 8, padding: "10px 12px", fontSize: 12,
                      }}>
                        {whatsappStatus.lastError}
                      </div>
                    )}
                  </div>
                  <div style={{
                    width: 220, height: 220, borderRadius: 12, border: "1px dashed #CBD5E1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#F8FAFC", textAlign: "center", color: "#64748B", fontSize: 12,
                    overflow: "hidden"
                  }}>
                    {whatsappStatus.qrDataUrl ? (
                      <img src={whatsappStatus.qrDataUrl} alt="WhatsApp QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : whatsappStatus.ready ? (
                      <div>
                        <Check size={32} color={P.green} style={{ margin: "0 auto 8px" }} />
                        Linked and ready
                      </div>
                    ) : whatsappStatus.authenticated ? (
                      <div>
                        <Clock size={32} color={P.blue} style={{ margin: "0 auto 8px" }} />
                        Authenticated, loading
                      </div>
                    ) : (
                      <div>QR appears here after starting</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== STOCK ===== */}
          {tab === "stock" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Active SKUs", value: activeProducts.length, color: P.blue },
                  { label: "Total units", value: fmt(totalUnits), color: P.green },
                  { label: "Stock value", value: `₹${fmt(totalValue)}`, color: P.purple },
                  { label: "Low stock", value: lowStock.length, color: P.red },
                ].map((m, i) => (
                  <div key={i} style={styles.metricCard(m.color)}>
                    <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={styles.card}>
                <div style={{
                  padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Boxes size={18} color={P.blue} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Available stock</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ position: "relative" }}>
                      <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                      <input placeholder="Search items..." value={stockSearch} onChange={e => setStockSearch(e.target.value)}
                        style={{
                          padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid #E2E8F0",
                          fontSize: 13, width: 220, background: "#F8FAFC"
                        }} />
                    </div>
                    <select value={stockCategory} onChange={e => setStockCategory(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, background: "#F8FAFC" }}>
                      {categories.map(c => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {["Item", "Category", "Stock", "Price", "Value", "Status", "Aliases"].map(h => (
                          <th key={h} style={{
                            padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                            color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px",
                            borderBottom: "1px solid #E8ECF0"
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map(p => {
                        const isLow = p.stockQuantity <= p.lowStockThreshold;
                        return (
                          <tr key={p.id} className="row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.itemName}</td>
                            <td style={{ padding: "12px 16px", color: "#64748B" }}>{p.category}</td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 15 }}>{p.stockQuantity}</td>
                            <td style={{ padding: "12px 16px" }}>₹{fmt(p.price)}</td>
                            <td style={{ padding: "12px 16px", color: "#64748B" }}>₹{fmt(p.price * p.stockQuantity)}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                                background: isLow ? "#FEF2F2" : "#F0FDF4",
                                color: isLow ? "#DC2626" : "#16A34A"
                              }}>{isLow ? "Low stock" : "In stock"}</span>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 12 }}>{p.aliases.join(", ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredStock.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>
                      No items match your filter
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== CATALOG ===== */}
          {tab === "catalog" && (
            <div>
              {/* Voice bar */}
              <div style={{ ...styles.card, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={startVoice} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
                    borderRadius: 8, border: "none", cursor: "pointer",
                    background: isListening ? "#DC2626" : "linear-gradient(135deg, #2563EB, #7C3AED)",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                  }}>
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {isListening ? "Stop listening" : "Update stock via voice"}
                  </button>
                  <input placeholder='Try: "Add 10 SG Cricket balls"' value={voiceText}
                    onChange={e => setVoiceText(e.target.value)}
                    style={{
                      flex: 1, minWidth: 260, padding: "10px 14px", borderRadius: 8,
                      border: "1px solid #E2E8F0", fontSize: 13, background: "#F8FAFC"
                    }} />
                  <button onClick={() => void applyVoiceText()} style={{
                    padding: "10px 18px", borderRadius: 8, border: "1px solid #E2E8F0",
                    background: "#fff", fontSize: 13, fontWeight: 600, color: P.blue, cursor: "pointer"
                  }}>Apply</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
                {/* Catalog table */}
                <div style={styles.card}>
                  <div style={{
                    padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <BookOpen size={18} color={P.blue} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Catalog manager</span>
                      <span style={{
                        background: "#F1F5F9", color: "#475569", fontSize: 11,
                        fontWeight: 600, padding: "2px 8px", borderRadius: 6
                      }}>{products.length} items</span>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          {["Item name", "Category", "Price (₹)", "Stock", "Aliases", ""].map(h => (
                            <th key={h} style={{
                              padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
                              color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px",
                              borderBottom: "1px solid #E8ECF0"
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => {
                          const isEd = editingId === p.id;
                          return (
                            <tr key={p.id} className="row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "10px 14px" }}>
                                {isEd ? <input value={editDraft.itemName || ""} onChange={e => setEditDraft({...editDraft, itemName: e.target.value})}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13, width: "100%" }} />
                                  : <span style={{ fontWeight: 600 }}>{p.itemName}</span>}
                              </td>
                              <td style={{ padding: "10px 14px", color: "#64748B" }}>
                                {isEd ? <input value={editDraft.category || ""} onChange={e => setEditDraft({...editDraft, category: e.target.value})}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13, width: 100 }} />
                                  : p.category}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {isEd ? <input type="number" value={editDraft.price || 0} onChange={e => setEditDraft({...editDraft, price: Number(e.target.value)})}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13, width: 80 }} />
                                  : `₹${fmt(p.price)}`}
                              </td>
                              <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                                {isEd ? <input type="number" value={editDraft.stockQuantity || 0} onChange={e => setEditDraft({...editDraft, stockQuantity: Number(e.target.value)})}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13, width: 70 }} />
                                  : p.stockQuantity}
                              </td>
                              <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 12 }}>
                                {isEd ? <input value={(editDraft.aliases || []).join(", ")} onChange={e => setEditDraft({...editDraft, aliases: e.target.value.split(",").map(a=>a.trim()).filter(Boolean)})}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12, width: 140 }} />
                                  : p.aliases.join(", ")}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {isEd ? (<>
                                    <button onClick={saveEdit} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <Check size={14} color="#16A34A" />
                                    </button>
                                    <button onClick={() => setEditingId(null)} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <X size={14} color="#94A3B8" />
                                    </button>
                                  </>) : (<>
                                    <button onClick={() => { setEditingId(p.id); setEditDraft({...p}); }}
                                      style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <Edit3 size={14} color="#64748B" />
                                    </button>
                                    <button onClick={() => deleteProduct(p.id)}
                                      style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <Trash2 size={14} color="#DC2626" />
                                    </button>
                                  </>)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Add SKU panel */}
                <div>
                  <div style={styles.card}>
                    <div style={{
                      padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <Plus size={18} color={P.green} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Add new SKU</span>
                    </div>
                    <div style={{ padding: 20 }}>
                      {[
                        { label: "Item name", key: "itemName", type: "text", ph: "e.g. Cosco Football" },
                        { label: "Category", key: "category", type: "text", ph: "e.g. Football" },
                        { label: "Price (₹)", key: "price", type: "number", ph: "0" },
                        { label: "Stock quantity", key: "stockQuantity", type: "number", ph: "0" },
                        { label: "Aliases", key: "aliases", type: "text", ph: "comma separated" },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom: 14 }}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                            {f.label}
                          </label>
                          <input type={f.type} placeholder={f.ph}
                            value={draft[f.key]} onChange={e => setDraft({...draft, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value})}
                            style={{
                              width: "100%", padding: "10px 12px", borderRadius: 8,
                              border: "1px solid #E2E8F0", fontSize: 13, boxSizing: "border-box", background: "#F8FAFC"
                            }} />
                        </div>
                      ))}
                      <button onClick={saveNewProduct} style={{
                        width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                        background: P.blue, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        marginTop: 4,
                      }}>Save SKU</button>
                    </div>
                  </div>

                  <div style={{ ...styles.card, marginTop: 16 }}>
                    <div style={{
                      padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <FileUp size={18} color={P.amber} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Bulk CSV import</span>
                    </div>
                    <div style={{ padding: 20 }}>
                      <textarea placeholder="Item Name,Category,Price,Stock,Aliases" value={importCsv} onChange={e => setImportCsv(e.target.value)}
                        style={{
                          width: "100%", minHeight: 100, padding: 12, borderRadius: 8,
                          border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "monospace",
                          resize: "vertical", boxSizing: "border-box", background: "#F8FAFC"
                        }} />
                      <button onClick={() => void importCatalog()} style={{
                        width: "100%", padding: "10px 0", borderRadius: 8, border: "1px solid #E2E8F0",
                        background: "#fff", fontSize: 13, fontWeight: 600, color: P.amber, cursor: "pointer",
                        marginTop: 10
                      }}>Import catalog</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== CONVERSATIONS ===== */}
          {tab === "conversations" && (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, height: "calc(100vh - 140px)" }}>
              {/* Customer list */}
              <div style={{ ...styles.card, display: "flex", flexDirection: "column" }}>
                <div style={{
                  padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <Users size={18} color={P.blue} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Customers</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {customers.map(c => {
                    const active = selectedCustomer === c;
                    const lastMsg = conversations.filter(m => m.customerPhone === c).slice(-1)[0];
                    return (
                      <button key={c} onClick={() => setSelectedCustomer(c)} style={{
                        width: "100%", padding: "14px 16px", border: "none", borderBottom: "1px solid #F1F5F9",
                        background: active ? "#EFF6FF" : "#fff", cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s"
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: active ? P.blue : "#E2E8F0",
                          color: active ? "#fff" : "#64748B",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 600, flexShrink: 0
                        }}>
                          {customerName(c).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? P.blue : "#1A1D21", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {customerName(c)}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {lastMsg?.body.slice(0, 35)}...
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat view */}
              <div style={{ ...styles.card, display: "flex", flexDirection: "column" }}>
                <div style={{
                  padding: "14px 20px", borderBottom: "1px solid #E8ECF0",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", background: "#EFF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <User size={16} color={P.blue} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{customerName(selectedCustomer)}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{selectedCustomer}</div>
                    </div>
                  </div>
                  <button onClick={() => void setTakeover(!humanTakeover)}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: humanTakeover ? "#16A34A" : "#DC2626", color: "#fff",
                      fontSize: 12, fontWeight: 600,
                    }}>
                    {humanTakeover ? "Release to AI" : "Take over chat"}
                  </button>
                </div>

                <div style={{
                  flex: 1, overflowY: "auto", padding: 20, background: "#F8FAFC",
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  {customerMsgs.map(m => (
                    <div key={m.id} style={{
                      display: "flex",
                      justifyContent: m.direction === "inbound" ? "flex-start" : "flex-end"
                    }}>
                      <div style={{
                        maxWidth: "70%", padding: "10px 14px", borderRadius: 12,
                        background: m.direction === "inbound" ? "#FFFFFF" : m.actor === "owner" ? "#DBEAFE" : "#DCFCE7",
                        border: `1px solid ${m.direction === "inbound" ? "#E2E8F0" : m.actor === "owner" ? "#93C5FD" : "#BBF7D0"}`,
                        borderBottomLeftRadius: m.direction === "inbound" ? 4 : 12,
                        borderBottomRightRadius: m.direction === "outbound" ? 4 : 12,
                      }}>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.body}</div>
                        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                          {m.actor === "ai" && <Bot size={10} />}
                          {m.actor === "owner" && <User size={10} />}
                          {m.actor === "ai" ? "AI Clerk" : m.actor === "owner" ? "You" : "Customer"} · {timeAgo(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {humanTakeover && (
                  <div style={{
                    padding: "14px 20px", borderTop: "1px solid #E8ECF0",
                    display: "flex", gap: 10
                  }}>
                    <input placeholder="Type your reply..." value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendReply()}
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 8,
                        border: "1px solid #E2E8F0", fontSize: 13
                      }} />
                    <button onClick={sendReply} style={{
                      width: 40, height: 40, borderRadius: 8, border: "none",
                      background: P.blue, color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Send size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
