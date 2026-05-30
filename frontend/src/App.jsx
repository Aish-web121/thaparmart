import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:8080";

const CATEGORIES = ["BOOKS","NOTES","ELECTRONICS","FURNITURE","CLOTHES","CYCLES","SPORTS","OTHER"];

const CAT_META = {
  BOOKS:       { icon: "📚", color: "#f59e0b" },
  NOTES:       { icon: "📝", color: "#10b981" },
  ELECTRONICS: { icon: "💻", color: "#6366f1" },
  FURNITURE:   { icon: "🛋️", color: "#8b5cf6" },
  CLOTHES:     { icon: "👕", color: "#ec4899" },
  CYCLES:      { icon: "🚲", color: "#14b8a6" },
  SPORTS:      { icon: "⚽", color: "#f97316" },
  OTHER:       { icon: "📦", color: "#64748b" },
};

const STATUS_META = {
  PENDING_REVIEW: { label: "Under Review", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  AVAILABLE:      { label: "Available",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  REJECTED:       { label: "Rejected",     color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  SOLD:           { label: "Sold",         color: "#64748b", bg: "rgba(100,116,139,0.12)"},
  ARCHIVED:       { label: "Archived",     color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

// ─── CHANGE 1: STOMP / SockJS singleton ──────────────────────────────────────
// Requires in index.html:
//   <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@stomp/stompjs@7/bundles/stomp.umd.min.js"></script>

let _stompClient = null;
let _stompReady = false;
const _stompListeners = new Map(); // destination → Set<callback>

function initStomp() {
  if (_stompClient) return;
  const token = localStorage.getItem("jwt");
  if (!token || !window.StompJs || !window.SockJS) return;

  const client = new window.StompJs.Client({
    webSocketFactory: () => new window.SockJS(WS_URL + "/ws"),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 5000,
    onConnect: () => {
      _stompReady = true;
      _stompListeners.forEach((cbs, dest) => {
        client.subscribe(dest, (frame) => {
          try {
            const data = JSON.parse(frame.body);
            cbs.forEach(cb => cb(data));
          } catch {}
        });
      });
    },
    onDisconnect: () => { _stompReady = false; },
  });

  client.activate();
  _stompClient = client;
}

function stompSubscribe(destination, callback) {
  if (!_stompListeners.has(destination)) _stompListeners.set(destination, new Set());
  _stompListeners.get(destination).add(callback);

  if (_stompReady && _stompClient) {
    const sub = _stompClient.subscribe(destination, (frame) => {
      try { callback(JSON.parse(frame.body)); } catch {}
    });
    return () => {
      sub.unsubscribe();
      _stompListeners.get(destination)?.delete(callback);
    };
  }
  return () => { _stompListeners.get(destination)?.delete(callback); };
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function getToken()  { return localStorage.getItem("jwt"); }
function getUser()   { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } }

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("jwt");

  const doFetch = (tok) => fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    ...opts,
  });

  let res = await doFetch(token);

  if (res.status === 401) {
    const rt = localStorage.getItem("refreshToken");
    if (rt) {
      try {
        const rr = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: rt.trim(),
        });
        if (rr.ok) {
          const newTok = (await rr.text()).trim();
          localStorage.setItem("jwt", newTok);
          res = await doFetch(newTok);
        } else {
          localStorage.removeItem("jwt");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          window.location.reload();
          return;
        }
      } catch {
        localStorage.removeItem("jwt");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.reload();
        return;
      }
    } else {
      localStorage.removeItem("jwt");
      localStorage.removeItem("user");
      window.location.reload();
      return;
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed");
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || text);
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) throw new Error(text || `HTTP ${res.status}`);
      throw parseErr;
    }
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  return res.json().catch(() => null);
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #08090c;
    --surface:  #0f1117;
    --card:     #141720;
    --border:   #1e2330;
    --border2:  #252c3d;
    --text:     #e8eaf0;
    --muted:    #6b7280;
    --accent:   #5b7fff;
    --accent2:  #8b5cf6;
    --danger:   #ef4444;
    --success:  #10b981;
    --warn:     #f59e0b;
    --font-head: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --radius:   14px;
    --radius-sm: 8px;
    --shadow:   0 4px 24px rgba(0,0,0,0.5);
    --glow:     0 0 30px rgba(91,127,255,0.15);
    --nav-h:    58px;
    --bottom-nav-h: 0px;
  }

  @media (max-width: 640px) {
    :root { --bottom-nav-h: 60px; }
  }

  html, body, #root {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    -webkit-text-size-adjust: 100%;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  input, select, textarea {
    font-family: var(--font-body);
    font-size: 16px; /* prevents iOS zoom */
    width: 100%;
    padding: 11px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    -webkit-appearance: none;
    appearance: none;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(91,127,255,0.12);
  }
  select option { background: var(--surface); }
  select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1 1l5 5 5-5'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }

  button { cursor: pointer; font-family: var(--font-body); }

  /* ── Responsive grid ── */
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  @media (max-width: 640px) {
    .product-grid {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
  }
  @media (max-width: 400px) {
    .product-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ── Top nav (desktop) ── */
  .top-nav { display: flex; }
  .bottom-nav { display: none; }

  @media (max-width: 640px) {
    .top-nav-links { display: none !important; }
    .top-nav-user-name { display: none !important; }
    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: var(--bottom-nav-h);
      background: rgba(8,9,12,0.95);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      z-index: 200;
      align-items: stretch;
    }
  }

  /* ── Main padding ── */
  .main-content {
    padding: 24px 20px;
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: calc(24px + var(--bottom-nav-h));
  }
  @media (max-width: 640px) {
    .main-content { padding: 14px 12px; padding-bottom: calc(14px + var(--bottom-nav-h)); }
  }

  /* ── Filter bar ── */
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .filter-bar .search-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .filter-bar .filter-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }
  @media (max-width: 640px) {
    .filter-bar .filter-row select { width: 100%; flex: 1 1 100%; }
    .filter-bar .filter-row .price-inputs { display: flex; gap: 8px; flex: 1 1 100%; }
    .filter-bar .filter-row .price-inputs input { flex: 1; }
  }

  /* ── Modal ── */
  .modal-inner {
    background: var(--card);
    border-radius: 18px;
    border: 1px solid var(--border2);
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7);
    animation: fadeUp 0.25s ease;
  }
  @media (max-width: 640px) {
    .modal-backdrop {
      align-items: flex-end !important;
      padding: 0 !important;
    }
    .modal-inner {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      max-height: 92vh;
      border-bottom: none;
    }
  }

  /* ── Inbox split pane ── */
  .inbox-pane { display: flex; min-height: 420px; }
  .inbox-sidebar { width: 280px; border-right: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }
  .inbox-thread  { flex: 1; min-width: 0; }
  @media (max-width: 640px) {
    .inbox-pane { flex-direction: column; }
    .inbox-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 220px; }
    .inbox-thread  { min-height: 360px; }
  }

  /* ── Admin tabs ── */
  .admin-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .admin-tabs::-webkit-scrollbar { display: none; }
  .admin-tabs button { flex-shrink: 0; }

  /* ── Card actions wrap ── */
  .card-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* ── Form grid ── */
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 480px) {
    .form-grid-2 { grid-template-columns: 1fr; }
  }

  /* ── Auth card ── */
  .auth-card {
    background: var(--card);
    border-radius: 20px;
    border: 1px solid var(--border2);
    padding: 28px;
    box-shadow: var(--shadow), var(--glow);
  }
  @media (max-width: 480px) {
    .auth-card { padding: 20px 16px; border-radius: 16px; }
  }

  /* ── Pending admin row ── */
  .pending-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .pending-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  @media (max-width: 640px) {
    .pending-row { flex-direction: column; }
    .pending-actions { flex-direction: row; flex-wrap: wrap; }
  }

  /* ── User row ── */
  .user-row {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  @media (max-width: 480px) {
    .user-row { flex-wrap: wrap; }
    .user-row .user-actions { margin-left: auto; }
  }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  @keyframes slideIn {
    from { opacity:0; transform:translateX(16px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
`;

// ─── Micro Components ─────────────────────────────────────────────────────────

function Spinner({ size = 20 }) {
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size,
      border: `2px solid rgba(91,127,255,0.3)`,
      borderTopColor: "var(--accent)",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  const colors = { success: "#10b981", error: "#ef4444", info: "#5b7fff" };
  return (
    <div style={{
      position: "fixed", bottom: "calc(var(--bottom-nav-h) + 12px)", right: 16, zIndex: 9999,
      background: "var(--card)", border: `1px solid ${colors[type] || colors.info}`,
      color: "var(--text)", padding: "12px 16px", borderRadius: "var(--radius)",
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      animation: "slideIn 0.3s ease",
      display: "flex", alignItems: "center", gap: 10, maxWidth: "min(340px, calc(100vw - 32px))",
      fontSize: 14,
    }}>
      <span style={{ color: colors[type] || colors.info, fontSize: 18 }}>
        {type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}
      </span>
      {msg}
      <button onClick={onClose} style={{ marginLeft: "auto", background:"none", border:"none", color:"var(--muted)", fontSize:16 }}>×</button>
    </div>
  );
}

function Btn({ children, variant = "primary", size = "md", loading, icon, style: sx, ...props }) {
  const variants = {
    primary:  { background: "var(--accent)", color: "#fff", border: "none" },
    ghost:    { background: "transparent", color: "var(--text)", border: "1px solid var(--border2)" },
    danger:   { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" },
    success:  { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" },
    subtle:   { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" },
  };
  const sizes = {
    sm: { padding: "6px 11px", fontSize: 12, borderRadius: 8 },
    md: { padding: "9px 16px", fontSize: 14, borderRadius: 10 },
    lg: { padding: "12px 22px", fontSize: 15, borderRadius: 12, fontWeight: 600 },
  };
  return (
    <button disabled={loading || props.disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontWeight: 500, whiteSpace: "nowrap", transition: "all 0.18s",
      opacity: (loading || props.disabled) ? 0.6 : 1,
      ...variants[variant], ...sizes[size], ...sx,
    }} {...props}>
      {loading ? <Spinner size={14} /> : icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

function Badge({ children, color = "var(--muted)" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: color + "22", color,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Modal({ title, children, onClose, width = 480 }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div className="modal-inner" style={{ maxWidth: width }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily:"var(--font-head)", fontSize:16, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:24, lineHeight:1, padding:"2px 6px" }}>×</button>
        </div>
        <div style={{ padding: "18px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children, gap = 8 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap }}>
      {label && <label style={{ fontSize:12, color:"var(--muted)", fontWeight:500, letterSpacing:"0.04em", textTransform:"uppercase" }}>{label}</label>}
      {children}
    </div>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "BUYER",
    college: "Thapar Institute", hostelName: "", hostelRoom: "",
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const data = await apiFetch(tab === "login" ? "/auth/login" : "/auth/register", {
        method: "POST", body: JSON.stringify(form),
      });
      localStorage.setItem("jwt", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken || "");
      const profile = await apiFetch("/auth/me");
      localStorage.setItem("user", JSON.stringify({
        id: profile.id, name: profile.name, email: profile.email, role: profile.role,
      }));
      onAuth(data);
    } catch (e) {
      const raw = e.message || "";
      if (raw.includes("Bad credentials")) setErr("Incorrect email or password. Please try again.");
      else if (raw.includes("User not found")) setErr("No account found with that email.");
      else if (raw.includes("banned")) setErr("Your account has been banned. Contact support.");
      else if (raw.includes("already registered")) setErr("An account with this email already exists.");
      else setErr(raw || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)",
      backgroundImage:"radial-gradient(ellipse 60% 50% at 50% 0%, rgba(91,127,255,0.08) 0%, transparent 70%)",
      padding: "16px",
    }}>
      <div style={{ width:"100%", maxWidth:420, animation:"fadeUp 0.4s ease" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:52, height:52, borderRadius:14, marginBottom:12,
            background:"linear-gradient(135deg, var(--accent), var(--accent2))",
            boxShadow:"0 8px 24px rgba(91,127,255,0.35)",
            fontSize:24,
          }}>🏛️</div>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:26, fontWeight:800, letterSpacing:"-0.02em" }}>ThaparMart</h1>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Campus marketplace for Thapar students</p>
        </div>

        <div className="auth-card">
          <div style={{ display:"flex", background:"var(--surface)", borderRadius:10, padding:3, marginBottom:20, gap:3 }}>
            {["login","register"].map(t => (
              <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{
                flex:1, padding:"8px 0", borderRadius:8, border:"none",
                background: tab===t ? "var(--card)" : "transparent",
                color: tab===t ? "var(--text)" : "var(--muted)",
                fontFamily:"var(--font-body)", fontWeight:600, fontSize:14,
                boxShadow: tab===t ? "0 1px 6px rgba(0,0,0,0.3)" : "none",
                transition:"all 0.2s",
              }}>
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {tab === "register" && (
              <>
                <FieldGroup label="Full Name">
                  <input placeholder="Your full name" value={form.name} onChange={set("name")} required />
                </FieldGroup>
                <FieldGroup label="Role">
                  <select value={form.role} onChange={set("role")}>
                    <option value="BUYER">Buyer — I want to purchase items</option>
                    <option value="SELLER">Seller — I want to sell items</option>
                  </select>
                </FieldGroup>
                <div className="form-grid-2">
                  <FieldGroup label="Hostel">
                    <input placeholder="e.g. A Block" value={form.hostelName} onChange={set("hostelName")} />
                  </FieldGroup>
                  <FieldGroup label="Room No.">
                    <input placeholder="e.g. 204" value={form.hostelRoom} onChange={set("hostelRoom")} />
                  </FieldGroup>
                </div>
              </>
            )}

            <FieldGroup label="Email">
              <input type="email" placeholder="you@thapar.edu" value={form.email} onChange={set("email")} required />
            </FieldGroup>
            <FieldGroup label="Password">
              <input type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required />
            </FieldGroup>

            {err && (
              <div style={{ background:"rgba(239,68,68,0.1)", color:"#ef4444", padding:"10px 14px", borderRadius:8, fontSize:13 }}>
                {err}
              </div>
            )}

            <Btn type="submit" size="lg" loading={loading} style={{ width:"100%", justifyContent:"center", marginTop:4 }}>
              {tab === "login" ? "Sign In" : "Create Account"}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onChat, onReport, onMarkSold, onArchive, onRelist, onEdit, onDelete, showActions = true }) {
  const user = getUser();
  const isMine = user?.id === product.sellerId;
  const cat = CAT_META[product.category] || CAT_META.OTHER;
  const status = STATUS_META[product.status] || STATUS_META.AVAILABLE;

  return (
    <div style={{
      background:"var(--card)", borderRadius:"var(--radius)",
      border:"1px solid var(--border)", overflow:"hidden",
      transition:"transform 0.18s, box-shadow 0.18s",
      animation:"fadeUp 0.35s ease both",
      display:"flex", flexDirection:"column",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.45)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}
    >
      <div style={{
        height:140, position:"relative", overflow:"hidden",
        background: `linear-gradient(135deg, ${cat.color}18, ${cat.color}06)`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <span style={{ fontSize:46, opacity:0.85 }}>{cat.icon}</span>
        }
        <div style={{ position:"absolute", top:8, left:8 }}>
          <Badge color={cat.color}>{product.category}</Badge>
        </div>
        {product.status !== "AVAILABLE" && (
          <div style={{ position:"absolute", top:8, right:8 }}>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
        )}
      </div>

      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:7, flex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6 }}>
          <h3 style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:14, lineHeight:1.3, flex:1 }}>{product.title}</h3>
          <span style={{ fontFamily:"var(--font-head)", fontWeight:800, fontSize:15, color:"var(--accent)", whiteSpace:"nowrap" }}>₹{product.price}</span>
        </div>

        <p style={{ color:"var(--muted)", fontSize:12, lineHeight:1.5, flex:1,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"
        }}>{product.description}</p>

        {product.meetingHostel && (
          <div style={{ display:"flex", alignItems:"center", gap:4, color:"var(--muted)", fontSize:11 }}>
            <span>📍</span>
            <span>{product.meetingHostel}{product.meetingRoom ? ` · ${product.meetingRoom}` : ""}</span>
          </div>
        )}

        {product.sellerName && (
          <div style={{ display:"flex", alignItems:"center", gap:4, color:"var(--muted)", fontSize:11 }}>
            <span>👤</span><span>{product.sellerName}</span>
          </div>
        )}

        {product.status === "REJECTED" && product.rejectionReason && (
          <div style={{ background:"rgba(239,68,68,0.08)", color:"#ef4444", padding:"6px 8px", borderRadius:7, fontSize:11, border:"1px solid rgba(239,68,68,0.15)" }}>
            <strong>Rejected:</strong> {product.rejectionReason}
          </div>
        )}

        {showActions && product.status === "AVAILABLE" && (
          <div className="card-actions" style={{ marginTop:4 }}>
            {!isMine && (
              <>
                <Btn size="sm" icon="💬" onClick={() => onChat?.(product)}>Chat</Btn>
                <Btn size="sm" variant="ghost" icon="🚩" onClick={() => onReport?.(product)}>Report</Btn>
              </>
            )}
            {isMine && (
              <>
                <Btn size="sm" variant="success" onClick={() => onMarkSold?.(product.id)}>Sold</Btn>
                <Btn size="sm" variant="ghost" onClick={() => onArchive?.(product.id)}>Archive</Btn>
                <Btn size="sm" variant="subtle" icon="✏️" onClick={() => onEdit?.(product)}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={() => onDelete?.(product.id)}>Del</Btn>
              </>
            )}
          </div>
        )}

        {showActions && isMine && product.status === "ARCHIVED" && (
          <div className="card-actions" style={{ marginTop:4 }}>
            <Btn size="sm" variant="success" onClick={() => onRelist?.(product.id)}>↩ Relist</Btn>
            <Btn size="sm" variant="subtle" icon="✏️" onClick={() => onEdit?.(product)}>Edit</Btn>
            <Btn size="sm" variant="danger" onClick={() => onDelete?.(product.id)}>Del</Btn>
          </div>
        )}

        {showActions && isMine && product.status === "REJECTED" && (
          <div className="card-actions" style={{ marginTop:4 }}>
            <Btn size="sm" variant="subtle" icon="✏️" onClick={() => onEdit?.(product)}>Edit & Resubmit</Btn>
            <Btn size="sm" variant="danger" onClick={() => onDelete?.(product.id)}>Del</Btn>
          </div>
        )}

        {showActions && isMine && product.status === "SOLD" && (
          <div className="card-actions" style={{ marginTop:4 }}>
            <Btn size="sm" variant="danger" onClick={() => onDelete?.(product.id)}>Delete</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Modal ───────────────────────────────────────────────────────────────

// ─── CHANGE 2: ChatModal — added STOMP subscription + polling fallback + status dot ───

function ChatModal({ product, onClose, toast }) {
  const user = getUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting"); // "connecting" | "live" | "polling"
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const otherUserId = user?.id === product.sellerId ? null : product.sellerId;

  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const data = await apiFetch(`/chat/conversation?productId=${product.id}&otherUserId=${otherUserId}`);
      setMessages(data || []);
    } catch {}
    setLoading(false);
  }, [product.id, otherUserId]);

  useEffect(() => {
    loadMessages();

    if (!user?.id) return;

    const destination = `/topic/messages/${user.id}`;
    const unsub = stompSubscribe(destination, (msg) => {
      if (msg.productId === product.id) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setWsStatus("live");
      }
    });

    const check = setTimeout(() => {
      if (!_stompReady) {
        setWsStatus("polling");
        pollRef.current = setInterval(loadMessages, 4000);
      } else {
        setWsStatus("live");
      }
    }, 3000);

    return () => {
      unsub();
      clearTimeout(check);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMessages, product.id, user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  async function send() {
    if (!text.trim() || !otherUserId) return;
    setSending(true);
    try {
      const msg = await apiFetch("/chat/send", {
        method:"POST",
        body: JSON.stringify({ productId: product.id, receiverId: otherUserId, content: text.trim() }),
      });
      setMessages(p => [...p, msg]);
      setText("");
    } catch (e) { toast(e.message, "error"); }
    setSending(false);
  }

  return (
    <Modal title={`💬 ${product.title}`} onClose={onClose} width={520}>
      {/* WS status indicator */}
      <div style={{ marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
        <span style={{
          width:7, height:7, borderRadius:"50%", display:"inline-block",
          background: wsStatus==="live" ? "var(--success)" : wsStatus==="polling" ? "var(--warn)" : "var(--muted)",
          boxShadow: wsStatus==="live" ? "0 0 6px var(--success)" : "none",
        }} />
        <span style={{ fontSize:11, color:"var(--muted)" }}>
          {wsStatus==="live" ? "Live" : wsStatus==="polling" ? "Polling every 4s" : "Connecting…"}
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        <div style={{
          height:320, overflowY:"auto", padding:"4px 0",
          display:"flex", flexDirection:"column", gap:8,
        }}>
          {loading && <div style={{ textAlign:"center", padding:40 }}><Spinner /></div>}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--muted)", padding:40, fontSize:14 }}>
              No messages yet. Start the conversation!
            </div>
          )}
          {messages.map(m => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} style={{ display:"flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth:"78%", padding:"9px 13px", borderRadius:12,
                  background: mine ? "var(--accent)" : "var(--surface)",
                  color: mine ? "#fff" : "var(--text)",
                  fontSize:13, lineHeight:1.5,
                  borderBottomRightRadius: mine ? 4 : 12,
                  borderBottomLeftRadius: mine ? 12 : 4,
                }}>
                  {!mine && <div style={{ fontSize:11, color:"var(--muted)", marginBottom:3 }}>{m.senderName}</div>}
                  {m.content}
                  <div style={{ fontSize:10, opacity:0.6, marginTop:4, textAlign:"right" }}>
                    {new Date(m.sentAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ display:"flex", gap:8, marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)" }}>
          <input
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
            style={{ flex:1 }}
          />
          <Btn onClick={send} loading={sending} icon="➤">Send</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ product, onClose, toast }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/products/${product.id}/report`, {
        method:"POST", body: JSON.stringify({ reason }),
      });
      toast("Report submitted", "success");
      onClose();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }

  return (
    <Modal title="Report Listing" onClose={onClose} width={420}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <p style={{ color:"var(--muted)", fontSize:14 }}>Reporting: <strong style={{ color:"var(--text)" }}>{product.title}</strong></p>
        <FieldGroup label="Reason">
          <textarea
            rows={4} placeholder="Describe the issue…"
            value={reason} onChange={e => setReason(e.target.value)}
            style={{ resize:"vertical" }}
          />
        </FieldGroup>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" loading={loading} onClick={submit}>Submit Report</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Image Uploader ───────────────────────────────────────────────────────────

function ImageUploader({ value, onChange, toast }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) {
      toast("Only JPG, PNG, WEBP or GIF allowed", "error"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be under 5MB", "error"); return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("jwt");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/products/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
      toast("Image uploaded!", "success");
    } catch (err) {
      toast(err.message, "error");
    }
    setUploading(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {value && (
        <div style={{ position:"relative", borderRadius:10, overflow:"hidden", height:130, background:"var(--surface)" }}>
          <img src={value} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => e.target.style.display="none"} />
          <button onClick={() => onChange("")} style={{
            position:"absolute", top:6, right:6,
            background:"rgba(0,0,0,0.6)", border:"none", color:"#fff",
            borderRadius:"50%", width:26, height:26, cursor:"pointer", fontSize:16, lineHeight:1,
          }}>×</button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display:"none" }} onChange={handleFile} />

      <div style={{ display:"flex", gap:8 }}>
        <Btn type="button" variant="ghost" loading={uploading} icon="📷"
          onClick={() => inputRef.current?.click()} style={{ flex:1, justifyContent:"center" }}>
          {uploading ? "Uploading…" : value ? "Change Image" : "Upload Image"}
        </Btn>
        {value && (
          <Btn type="button" variant="subtle" size="sm" onClick={() => onChange("")}>Remove</Btn>
        )}
      </div>
      <p style={{ fontSize:11, color:"var(--muted)" }}>Max 5MB · JPG, PNG, WEBP</p>
    </div>
  );
}

// ─── Edit Listing Modal ───────────────────────────────────────────────────────

function EditModal({ product, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    title: product.title, description: product.description,
    imageUrl: product.imageUrl || "", price: product.price, category: product.category,
  });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    setLoading(true);
    try {
      await apiFetch(`/products/${product.id}`, {
        method:"PUT",
        body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
      });
      toast("Listing updated", "success");
      onSaved();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }

  return (
    <Modal title="Edit Listing" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <FieldGroup label="Title"><input value={form.title} onChange={set("title")} /></FieldGroup>
        <FieldGroup label="Description">
          <textarea rows={3} value={form.description} onChange={set("description")} style={{ resize:"vertical" }} />
        </FieldGroup>
        <FieldGroup label="Image">
          <ImageUploader value={form.imageUrl} onChange={url => setForm(p => ({ ...p, imageUrl: url }))} toast={toast} />
        </FieldGroup>
        <div className="form-grid-2">
          <FieldGroup label="Price (₹)"><input type="number" min="0" value={form.price} onChange={set("price")} /></FieldGroup>
          <FieldGroup label="Category">
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
            </select>
          </FieldGroup>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={loading} onClick={save}>Save Changes</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

function Marketplace({ toast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [chatProduct, setChatProduct] = useState(null);
  const [reportProduct, setReportProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)   params.set("query", search);
      if (category) params.set("category", category);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const useSearch = search || category || minPrice || maxPrice;
      const data = await apiFetch(useSearch ? `/products/search?${params}` : "/products");
      setProducts(data || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [search, category, minPrice, maxPrice]);

  useEffect(() => { load(); }, []);

  async function markSold(id) {
    try { await apiFetch(`/products/${id}/status?status=SOLD`, { method:"PATCH" }); toast("Marked as sold!", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function archiveProduct(id) {
    try { await apiFetch(`/products/${id}/status?status=ARCHIVED`, { method:"PATCH" }); toast("Listing archived", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function relistProduct(id) {
    try { await apiFetch(`/products/${id}/status?status=PENDING_REVIEW`, { method:"PATCH" }); toast("Listing resubmitted for review!", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function deleteProduct(id) {
    if (!confirm("Delete this listing?")) return;
    try { await apiFetch(`/products/${id}`, { method:"DELETE" }); toast("Listing deleted", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{
        background:"var(--card)", borderRadius:"var(--radius)", border:"1px solid var(--border)",
        padding:"14px 16px",
      }}>
        <div className="filter-bar">
          <div className="search-row">
            <input
              placeholder="Search listings…" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key==="Enter" && load()}
            />
            <Btn onClick={load} icon="🔍">Search</Btn>
          </div>
          <div className="filter-row">
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ flex:"1 1 140px", minWidth:0 }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
            </select>
            <div className="price-inputs">
              <input placeholder="Min ₹" type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
              <input placeholder="Max ₹" type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
            {(search || category || minPrice || maxPrice) && (
              <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(""); setMinPrice(""); setMaxPrice(""); setTimeout(load,0); }}>
                Clear
              </Btn>
            )}
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", padding:60 }}><Spinner size={32} /></div>}

      {!loading && products.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:16, fontWeight:500 }}>No listings found</div>
          <div style={{ fontSize:13, marginTop:4 }}>Try adjusting your filters</div>
        </div>
      )}

      <div className="product-grid">
        {products.map((p, i) => (
          <div key={p.id} style={{ animationDelay: `${i * 0.04}s` }}>
            <ProductCard
              product={p}
              onChat={setChatProduct}
              onReport={setReportProduct}
              onMarkSold={markSold}
              onArchive={archiveProduct}
              onRelist={relistProduct}
              onEdit={setEditProduct}
              onDelete={deleteProduct}
            />
          </div>
        ))}
      </div>

      {chatProduct   && <ChatModal   product={chatProduct}   onClose={() => setChatProduct(null)}   toast={toast} />}
      {reportProduct && <ReportModal product={reportProduct} onClose={() => setReportProduct(null)} toast={toast} />}
      {editProduct   && <EditModal   product={editProduct}   onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); load(); }} toast={toast} />}
    </div>
  );
}

// ─── Create / Sell Listing ────────────────────────────────────────────────────

function CreateListing({ onCreated, toast }) {
  const [form, setForm] = useState({ title:"", description:"", category:"BOOKS", imageUrl:"", price:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/products", {
        method:"POST",
        body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
      });
      toast("Listing submitted for review!", "success");
      onCreated();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }

  const cat = CAT_META[form.category];

  return (
    <div style={{ maxWidth:560, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:800 }}>New Listing</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Your listing will be reviewed by an admin before going live.</p>
      </div>
      <form onSubmit={submit} style={{
        background:"var(--card)", borderRadius:18, border:"1px solid var(--border2)",
        padding:"20px 18px", display:"flex", flexDirection:"column", gap:16,
      }}>
        <FieldGroup label="Title">
          <input placeholder="What are you selling?" value={form.title} onChange={set("title")} required />
        </FieldGroup>
        <FieldGroup label="Description">
          <textarea rows={4} placeholder="Describe the condition, age, etc." value={form.description} onChange={set("description")} required style={{ resize:"vertical" }} />
        </FieldGroup>
        <div className="form-grid-2">
          <FieldGroup label="Category">
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Price (₹)">
            <input type="number" min="0" step="1" placeholder="0" value={form.price} onChange={set("price")} required />
          </FieldGroup>
        </div>
        <FieldGroup label="Image (optional)">
          <ImageUploader value={form.imageUrl} onChange={url => setForm(p => ({ ...p, imageUrl: url }))} toast={toast} />
        </FieldGroup>
        <Btn type="submit" loading={loading} size="lg" icon={cat.icon} style={{ width:"100%", justifyContent:"center" }}>
          Submit Listing
        </Btn>
      </form>
    </div>
  );
}

// ─── My Listings ──────────────────────────────────────────────────────────────

function MyListings({ toast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/products/my");
      setProducts(data || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markSold(id) {
    try { await apiFetch(`/products/${id}/status?status=SOLD`, { method:"PATCH" }); toast("Marked as sold!", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function archiveProduct(id) {
    try { await apiFetch(`/products/${id}/status?status=ARCHIVED`, { method:"PATCH" }); toast("Listing archived", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function relistProduct(id) {
    try { await apiFetch(`/products/${id}/status?status=PENDING_REVIEW`, { method:"PATCH" }); toast("Listing resubmitted!", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function deleteProduct(id) {
    if (!confirm("Delete this listing?")) return;
    try { await apiFetch(`/products/${id}`, { method:"DELETE" }); toast("Deleted", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  }

  const groups = {
    PENDING_REVIEW: products.filter(p => p.status === "PENDING_REVIEW"),
    AVAILABLE:      products.filter(p => p.status === "AVAILABLE"),
    SOLD:           products.filter(p => p.status === "SOLD"),
    REJECTED:       products.filter(p => p.status === "REJECTED"),
    ARCHIVED:       products.filter(p => p.status === "ARCHIVED"),
  };

  if (loading) return <div style={{ textAlign:"center", padding:60 }}><Spinner size={32} /></div>;
  if (!products.length) return (
    <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>📦</div>
      <div style={{ fontSize:16, fontWeight:500 }}>No listings yet</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {Object.entries(groups).filter(([,v]) => v.length).map(([status, items]) => (
        <div key={status}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Badge color={STATUS_META[status]?.color}>{STATUS_META[status]?.label}</Badge>
            <span style={{ color:"var(--muted)", fontSize:13 }}>{items.length} listing{items.length > 1 ? "s" : ""}</span>
          </div>
          <div className="product-grid">
            {items.map(p => (
              <ProductCard key={p.id} product={p}
                onMarkSold={markSold} onArchive={archiveProduct} onRelist={relistProduct} onEdit={setEditProduct} onDelete={deleteProduct}
              />
            ))}
          </div>
        </div>
      ))}
      {editProduct && (
        <EditModal product={editProduct} onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); load(); }} toast={toast} />
      )}
    </div>
  );
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

function Inbox({ toast }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const user = getUser();

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/chat/inbox");
        setMessages(data || []);
      } catch (e) { toast(e.message, "error"); }
      setLoading(false);
    })();
  }, []);

  const threads = [];
  const seen = new Set();
  for (const m of messages) {
    const otherId = m.senderId === user?.id ? m.receiverId : m.senderId;
    const key = `${m.productId}-${otherId}`;
    if (!seen.has(key)) {
      seen.add(key);
      threads.push({ key, productId: m.productId, productTitle: m.productTitle, otherId, otherName: m.senderId === user?.id ? m.receiverName : m.senderName, lastMsg: m });
    }
  }

  if (loading) return <div style={{ textAlign:"center", padding:60 }}><Spinner size={32} /></div>;
  if (!threads.length) return (
    <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>💬</div>
      <div style={{ fontSize:16, fontWeight:500 }}>No messages yet</div>
    </div>
  );

  return (
    <div className="inbox-pane" style={{ background:"var(--card)", borderRadius:"var(--radius)", border:"1px solid var(--border)", overflow:"hidden" }}>
      <div className="inbox-sidebar">
        {threads.map(t => (
          <div key={t.key} onClick={() => setSelected(t)} style={{
            padding:"13px 15px", cursor:"pointer", borderBottom:"1px solid var(--border)",
            background: selected?.key === t.key ? "var(--surface)" : "transparent",
            transition:"background 0.15s",
          }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{t.otherName}</div>
            <div style={{ color:"var(--accent)", fontSize:12, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.productTitle}</div>
            <div style={{ color:"var(--muted)", fontSize:12, marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {t.lastMsg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="inbox-thread">
        {selected
          ? <ThreadPane thread={selected} toast={toast} />
          : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", minHeight:200, color:"var(--muted)", fontSize:14 }}>
              Select a conversation
            </div>
        }
      </div>
    </div>
  );
}

// ─── CHANGE 3: ThreadPane — added STOMP subscription + polling fallback + status dot ───

function ThreadPane({ thread, toast }) {
  const user = getUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting"); // "connecting" | "live" | "polling"
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/chat/conversation?productId=${thread.productId}&otherUserId=${thread.otherId}`);
      setMessages(data || []);
    } catch {}
  }, [thread.key]);

  useEffect(() => {
    load();

    if (!user?.id) return;

    const destination = `/topic/messages/${user.id}`;
    const unsub = stompSubscribe(destination, (msg) => {
      if (msg.productId === thread.productId) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setWsStatus("live");
      }
    });

    const check = setTimeout(() => {
      if (!_stompReady) {
        setWsStatus("polling");
        pollRef.current = setInterval(load, 4000);
      } else {
        setWsStatus("live");
      }
    }, 3000);

    return () => {
      unsub();
      clearTimeout(check);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, thread.productId, user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await apiFetch("/chat/send", {
        method:"POST",
        body: JSON.stringify({ productId: thread.productId, receiverId: thread.otherId, content: text.trim() }),
      });
      setMessages(p => [...p, msg]);
      setText("");
    } catch (e) { toast(e.message, "error"); }
    setSending(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"13px 16px", borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:2 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>{thread.otherName}</div>
        <div style={{ color:"var(--muted)", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
          {thread.productTitle}
          {/* WS status dot */}
          <span style={{
            width:6, height:6, borderRadius:"50%", display:"inline-block", flexShrink:0,
            background: wsStatus==="live" ? "var(--success)" : wsStatus==="polling" ? "var(--warn)" : "var(--muted)",
            boxShadow: wsStatus==="live" ? "0 0 5px var(--success)" : "none",
          }} />
          <span style={{ fontSize:10 }}>
            {wsStatus==="live" ? "Live" : wsStatus==="polling" ? "Polling" : "Connecting…"}
          </span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:8, minHeight:200 }}>
        {messages.map(m => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth:"75%", padding:"9px 12px", borderRadius:12, fontSize:13, lineHeight:1.5,
                background: mine ? "var(--accent)" : "var(--surface)",
                color: mine ? "#fff" : "var(--text)",
                borderBottomRightRadius: mine ? 4 : 12,
                borderBottomLeftRadius:  mine ? 12 : 4,
              }}>
                {m.content}
                <div style={{ fontSize:10, opacity:0.6, marginTop:3, textAlign:"right" }}>
                  {new Date(m.sentAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border)", display:"flex", gap:8 }}>
        <input placeholder="Message…" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()} style={{ flex:1 }} />
        <Btn onClick={send} loading={sending} icon="➤">Send</Btn>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ toast }) {
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, u, k, ap] = await Promise.all([
        apiFetch("/admin/products/pending"),
        apiFetch("/admin/reports"),
        apiFetch("/admin/users"),
        apiFetch("/admin/keywords"),
        apiFetch("/products"),
      ]);
      setPending(p || []); setReports(r || []); setUsers(u || []); setKeywords(k || []); setAllProducts(ap || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function approve(id) {
    try { await apiFetch(`/admin/products/${id}/approve`, { method:"PATCH" }); toast("Approved", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function doReject() {
    try { await apiFetch(`/admin/products/${rejectModal}/reject`, { method:"PATCH", body: JSON.stringify({ reason: rejectReason }) }); toast("Rejected", "success"); setRejectModal(null); setRejectReason(""); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function resolveReport(id) {
    try { await apiFetch(`/admin/reports/${id}/resolve`, { method:"PATCH" }); toast("Resolved", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function banUser(id, banned) {
    try { await apiFetch(`/admin/users/${id}/${banned ? "unban" : "ban"}`, { method:"PATCH" }); toast(banned ? "User unbanned" : "User banned", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;
    try { await apiFetch(`/admin/users/${id}`, { method:"DELETE" }); toast("User deleted", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function adminDeleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    try { await apiFetch(`/admin/products/${id}`, { method:"DELETE" }); toast("Product deleted", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function hideProduct(id) {
    try { await apiFetch(`/admin/products/${id}/hide`, { method:"PATCH" }); toast("Product hidden", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function unhideProduct(id) {
    try { await apiFetch(`/admin/products/${id}/unhide`, { method:"PATCH" }); toast("Product unhidden", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }

  const tabs = [
    { id:"pending",  label:"Pending",  count: pending.length },
    { id:"products", label:"Products", count: allProducts.length },
    { id:"reports",  label:"Reports",  count: reports.filter(r => !r.resolved).length },
    { id:"users",    label:"Users",    count: users.length },
    { id:"keywords", label:"Keywords", count: keywords.length },
  ];

  if (loading) return <div style={{ textAlign:"center", padding:60 }}><Spinner size={32} /></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:800 }}>Admin Panel</h2>
        <Badge color="var(--warn)">ADMIN</Badge>
      </div>

      <div className="admin-tabs">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"8px 14px", borderRadius:8, border: tab===t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: tab===t.id ? "rgba(91,127,255,0.12)" : "transparent",
            color: tab===t.id ? "var(--accent)" : "var(--muted)",
            fontFamily:"var(--font-body)", fontWeight:600, fontSize:13, cursor:"pointer",
            display:"inline-flex", alignItems:"center", gap:6,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: tab===t.id ? "var(--accent)" : "var(--muted)", color:"#fff", borderRadius:99, padding:"1px 6px", fontSize:11 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        pending.length === 0
          ? <EmptyState icon="✅" msg="No pending products" />
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {pending.map(p => (
                <div key={p.id} style={{
                  background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
                  padding:"14px 16px",
                }}>
                  <div className="pending-row">
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:700 }}>{p.title}</span>
                        <Badge color={CAT_META[p.category]?.color}>{p.category}</Badge>
                      </div>
                      <p style={{ color:"var(--muted)", fontSize:13 }}>{p.description}</p>
                      <div style={{ color:"var(--muted)", fontSize:12, marginTop:5 }}>
                        By {p.sellerName} · ₹{p.price}
                      </div>
                    </div>
                    <div className="pending-actions">
                      <Btn size="sm" variant="success" onClick={() => approve(p.id)}>Approve</Btn>
                      <Btn size="sm" variant="danger" onClick={() => { setRejectModal(p.id); setRejectReason(""); }}>Reject</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => hideProduct(p.id)}>Hide</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => adminDeleteProduct(p.id)}>Delete</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {tab === "reports" && (
        reports.length === 0
          ? <EmptyState icon="🏳️" msg="No reports" />
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {reports.map(r => (
                <div key={r.id} style={{
                  background:"var(--card)", borderRadius:12, border:`1px solid ${r.resolved ? "var(--border)" : "rgba(239,68,68,0.25)"}`,
                  padding:"12px 16px", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap",
                  opacity: r.resolved ? 0.6 : 1,
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{r.productTitle}</div>
                    <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>
                      <strong>{r.reporterName}</strong>: {r.reason}
                    </div>
                  </div>
                  {!r.resolved && <Btn size="sm" variant="ghost" onClick={() => resolveReport(r.id)}>Resolve</Btn>}
                  {r.resolved && <Badge color="var(--success)">Resolved</Badge>}
                </div>
              ))}
            </div>
      )}

      {tab === "users" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {users.map(u => (
            <div key={u.id} style={{
              background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
              padding:"12px 16px", opacity: u.banned ? 0.65 : 1,
            }}>
              <div className="user-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    <span style={{ fontWeight:600 }}>{u.name}</span>
                    <Badge color={u.role === "ADMIN" ? "var(--warn)" : u.role === "SELLER" ? "var(--accent)" : "var(--muted)"}>{u.role}</Badge>
                    {u.banned && <Badge color="var(--danger)">Banned</Badge>}
                  </div>
                  <div style={{ color:"var(--muted)", fontSize:12, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                </div>
                <div className="user-actions" style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <Btn size="sm" variant={u.banned ? "success" : "danger"} onClick={() => banUser(u.id, u.banned)}>
                    {u.banned ? "Unban" : "Ban"}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => deleteUser(u.id)}>Del</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        allProducts.length === 0
          ? <EmptyState icon="📦" msg="No products" />
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {allProducts.map(p => (
                <div key={p.id} style={{
                  background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
                  padding:"12px 16px",
                }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:600, fontSize:14 }}>{p.title}</span>
                        <Badge color={CAT_META[p.category]?.color}>{p.category}</Badge>
                        <Badge color={STATUS_META[p.status]?.color}>{STATUS_META[p.status]?.label}</Badge>
                      </div>
                      <div style={{ color:"var(--muted)", fontSize:12 }}>
                        {p.sellerName} · ₹{p.price}{p.reportCount > 0 ? ` · ⚠️ ${p.reportCount} report${p.reportCount > 1 ? "s" : ""}` : ""}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      {p.status === "AVAILABLE" && <Btn size="sm" variant="ghost" onClick={() => hideProduct(p.id)}>Hide</Btn>}
                      {p.status === "ARCHIVED"  && <Btn size="sm" variant="success" onClick={() => unhideProduct(p.id)}>Unhide</Btn>}
                      <Btn size="sm" variant="danger" onClick={() => adminDeleteProduct(p.id)}>Del</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {tab === "keywords" && (
        keywords.length === 0
          ? <EmptyState icon="🔤" msg="No banned keywords configured" />
          : <div style={{ background:"var(--card)", borderRadius:12, border:"1px solid var(--border)", padding:"16px" }}>
              <p style={{ color:"var(--muted)", fontSize:13, marginBottom:12 }}>These keywords are automatically flagged in listings.</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {keywords.map((kw, i) => (
                  <span key={i} style={{
                    background:"rgba(239,68,68,0.1)", color:"#ef4444",
                    border:"1px solid rgba(239,68,68,0.2)",
                    padding:"4px 12px", borderRadius:99, fontSize:13, fontWeight:500,
                  }}>🚫 {kw}</span>
                ))}
              </div>
            </div>
      )}

      {rejectModal && (
        <Modal title="Reject Listing" onClose={() => setRejectModal(null)} width={400}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <FieldGroup label="Rejection Reason">
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why…" style={{ resize:"vertical" }} />
            </FieldGroup>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={() => setRejectModal(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={doReject}>Reject Listing</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15 }}>{msg}</div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ tab, setTab, user, onLogout }) {
  const navItems = [
    { id:"market",     label:"Browse",      icon:"🏪" },
    ...(user?.role === "SELLER" || user?.role === "ADMIN"
      ? [{ id:"sell", label:"Sell", icon:"➕" }, { id:"mylistings", label:"My Listings", icon:"📋" }]
      : []),
    { id:"inbox",      label:"Inbox",       icon:"💬" },
    ...(user?.role === "ADMIN" ? [{ id:"admin", label:"Admin", icon:"⚙️" }] : []),
  ];

  return (
    <>
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        background:"rgba(8,9,12,0.9)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid var(--border)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"0 16px", height:"var(--nav-h)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{
            width:32, height:32, borderRadius:9,
            background:"linear-gradient(135deg, var(--accent), var(--accent2))",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, boxShadow:"0 4px 12px rgba(91,127,255,0.3)",
          }}>🏛️</div>
          <span style={{ fontFamily:"var(--font-head)", fontWeight:800, fontSize:15, letterSpacing:"-0.01em" }}>ThaparMart</span>
        </div>

        <div className="top-nav-links" style={{ display:"flex", gap:2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              padding:"6px 12px", borderRadius:8, border:"none",
              background: tab===item.id ? "rgba(91,127,255,0.15)" : "transparent",
              color: tab===item.id ? "var(--accent)" : "var(--muted)",
              fontFamily:"var(--font-body)", fontWeight:500, fontSize:13,
              cursor:"pointer", transition:"all 0.15s",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{
            width:30, height:30, borderRadius:"50%",
            background:"linear-gradient(135deg, var(--accent), var(--accent2))",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:700, color:"#fff",
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <span className="top-nav-user-name" style={{ fontSize:13, color:"var(--muted)", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {user?.name}
          </span>
          <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
        </div>
      </nav>

      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              gap:3, border:"none", background:"transparent", padding:"6px 0",
              color: tab===item.id ? "var(--accent)" : "var(--muted)",
              fontSize:10, fontWeight:600, fontFamily:"var(--font-body)",
              cursor:"pointer", transition:"color 0.15s",
              borderTop: tab===item.id ? `2px solid var(--accent)` : "2px solid transparent",
            }}
          >
            <span style={{ fontSize:20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:3, border:"none", background:"transparent", padding:"6px 0",
            color:"var(--muted)", fontSize:10, fontWeight:600, fontFamily:"var(--font-body)",
            cursor:"pointer", borderTop:"2px solid transparent",
          }}
        >
          <span style={{ fontSize:20 }}>🚪</span>
          <span>Logout</span>
        </button>
      </nav>
    </>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [auth, setAuth] = useState(() => !!localStorage.getItem("jwt"));
  const [tab, setTab] = useState("market");
  const [toastData, setToastData] = useState(null);

  const toast = useCallback((msg, type = "info") => setToastData({ msg, type, key: Date.now() }), []);
  const user = getUser();

  // ─── CHANGE 4: boot STOMP on login/reload, tear down on logout ───
  useEffect(() => { if (auth) initStomp(); }, [auth]);

  function logout() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    // Tear down STOMP connection cleanly
    if (_stompClient) {
      _stompClient.deactivate();
      _stompClient = null;
      _stompReady = false;
      _stompListeners.clear();
    }
    setAuth(false);
  }

  if (!auth) return (
    <>
      <style>{css}</style>
      <AuthPage onAuth={() => setAuth(true)} />
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
        <Nav tab={tab} setTab={setTab} user={user} onLogout={logout} />
        <main className="main-content">
          {tab === "market"     && <Marketplace  toast={toast} />}
          {tab === "sell"       && <CreateListing onCreated={() => setTab("mylistings")} toast={toast} />}
          {tab === "mylistings" && <MyListings   toast={toast} />}
          {tab === "inbox"      && <Inbox         toast={toast} />}
          {tab === "admin"      && <AdminPanel    toast={toast} />}
        </main>
      </div>
      {toastData && (
        <Toast key={toastData.key} msg={toastData.msg} type={toastData.type} onClose={() => setToastData(null)} />
      )}
    </>
  );
}
