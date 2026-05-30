import { useEffect, useRef, useState, useCallback } from "react";

// ─── STOMP / SockJS (loaded via CDN in index.html — window globals) ──────────
// Requires in index.html:
//   <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@stomp/stompjs@7/bundles/stomp.umd.min.js"></script>
//
// useStomp — connects once per user session, returns a subscribe helper.
// The hook reconnects automatically if the connection drops.
function useStomp() {
  const clientRef = useRef(null);
  const subs = useRef({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    const client = new window.StompJs.Client({
      webSocketFactory: () => new window.SockJS("http://localhost:8080/ws"),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setReady(true);
        // Re-subscribe pending subscriptions after reconnect
        Object.entries(subs.current).forEach(([dest, cb]) => {
          client.subscribe(dest, (frame) => {
            try { cb(JSON.parse(frame.body)); } catch {}
          });
        });
      },
      onDisconnect: () => setReady(false),
      onStompError: () => setReady(false),
    });

    client.activate();
    clientRef.current = client;

    return () => { client.deactivate(); clientRef.current = null; setReady(false); };
  }, []);

  // subscribe(destination, callback) → returns unsubscribe fn
  const subscribe = useCallback((destination, callback) => {
    subs.current[destination] = callback;
    if (clientRef.current?.connected) {
      const sub = clientRef.current.subscribe(destination, (frame) => {
        try { callback(JSON.parse(frame.body)); } catch {}
      });
      return () => { sub.unsubscribe(); delete subs.current[destination]; };
    }
    return () => { delete subs.current[destination]; };
  }, []);

  return { ready, subscribe };
}

// Module-level singleton so all components share one STOMP connection
let _stompClient = null;
let _stompReady = false;
const _stompListeners = new Map(); // destination → Set<callback>

function initStomp() {
  if (_stompClient) return;
  const token = localStorage.getItem("jwt");
  if (!token || !window.StompJs || !window.SockJS) return;

  const client = new window.StompJs.Client({
    webSocketFactory: () => new window.SockJS("http://localhost:8080/ws"),
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

// ─── Constants ───────────────────────────────────────────────────────────────

const API = "http://localhost:8080/api";

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
      const rr = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        // Backend uses @RequestBody String — must send raw string, NOT JSON.stringify
        headers: { "Content-Type": "text/plain" },
        body: rt,
      });
      if (rr.ok) {
        const newTok = await rr.text();
        localStorage.setItem("jwt", newTok);
        res = await doFetch(newTok);
      }
    }
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => "Request failed");
    throw new Error(msg || `HTTP ${res.status}`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
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
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-body); }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  input, select, textarea {
    font-family: var(--font-body);
    font-size: 14px;
    width: 100%;
    padding: 11px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(91,127,255,0.12);
  }
  select option { background: var(--surface); }

  button { cursor: pointer; font-family: var(--font-body); }

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
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "var(--card)", border: `1px solid ${colors[type] || colors.info}`,
      color: "var(--text)", padding: "12px 18px", borderRadius: "var(--radius)",
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      animation: "slideIn 0.3s ease",
      display: "flex", alignItems: "center", gap: 10, maxWidth: 340,
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
    sm: { padding: "6px 12px", fontSize: 12, borderRadius: 8 },
    md: { padding: "9px 16px", fontSize: 14, borderRadius: 10 },
    lg: { padding: "12px 22px", fontSize: 15, borderRadius: 12, fontWeight: 600 },
  };
  return (
    <button disabled={loading || props.disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
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
    }}>
      {children}
    </span>
  );
}

function Modal({ title, children, onClose, width = 480 }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--card)", borderRadius: 18, border: "1px solid var(--border2)",
        width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        animation: "fadeUp 0.25s ease",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily:"var(--font-head)", fontSize:17, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:22, lineHeight:1, padding:4 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
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
      // AuthResponse doesn't include id — fetch profile to get it
      const profile = await apiFetch("/auth/me");
      localStorage.setItem("user", JSON.stringify({
        id: profile.id, name: profile.name, email: profile.email, role: profile.role,
      }));
      // Boot STOMP connection now that we have a token
      initStomp();
      onAuth(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)",
      backgroundImage:"radial-gradient(ellipse 60% 50% at 50% 0%, rgba(91,127,255,0.08) 0%, transparent 70%)",
    }}>
      <div style={{ width:"100%", maxWidth:420, animation:"fadeUp 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:56, height:56, borderRadius:16, marginBottom:14,
            background:"linear-gradient(135deg, var(--accent), var(--accent2))",
            boxShadow:"0 8px 24px rgba(91,127,255,0.35)",
            fontSize:26,
          }}>🏛️</div>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:28, fontWeight:800, letterSpacing:"-0.02em" }}>ThaparMart</h1>
          <p style={{ color:"var(--muted)", fontSize:14, marginTop:4 }}>Campus marketplace for Thapar students</p>
        </div>

        <div style={{
          background:"var(--card)", borderRadius:20, border:"1px solid var(--border2)",
          padding:28, boxShadow:"var(--shadow), var(--glow)",
        }}>
          {/* Tabs */}
          <div style={{ display:"flex", background:"var(--surface)", borderRadius:10, padding:3, marginBottom:22, gap:3 }}>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
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

function ProductCard({ product, onChat, onReport, onMarkSold, onEdit, onDelete, showActions = true }) {
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
      {/* Image / Icon */}
      <div style={{
        height:160, position:"relative", overflow:"hidden",
        background: `linear-gradient(135deg, ${cat.color}18, ${cat.color}06)`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <span style={{ fontSize:52, opacity:0.85 }}>{cat.icon}</span>
        }
        {/* Category badge */}
        <div style={{ position:"absolute", top:10, left:10 }}>
          <Badge color={cat.color}>{product.category}</Badge>
        </div>
        {/* Status badge */}
        {product.status !== "AVAILABLE" && (
          <div style={{ position:"absolute", top:10, right:10 }}>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
        )}
      </div>

      <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
          <h3 style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:15, lineHeight:1.3 }}>{product.title}</h3>
          <span style={{ fontFamily:"var(--font-head)", fontWeight:800, fontSize:17, color:"var(--accent)", whiteSpace:"nowrap" }}>₹{product.price}</span>
        </div>

        <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.5, flex:1 }}>{product.description}</p>

        {product.meetingHostel && (
          <div style={{ display:"flex", alignItems:"center", gap:5, color:"var(--muted)", fontSize:12 }}>
            <span>📍</span>
            <span>{product.meetingHostel}{product.meetingRoom ? ` · Room ${product.meetingRoom}` : ""}</span>
          </div>
        )}

        {product.sellerName && (
          <div style={{ display:"flex", alignItems:"center", gap:5, color:"var(--muted)", fontSize:12 }}>
            <span>👤</span><span>{product.sellerName}</span>
          </div>
        )}

        {product.status === "REJECTED" && product.rejectionReason && (
          <div style={{ background:"rgba(239,68,68,0.08)", color:"#ef4444", padding:"8px 10px", borderRadius:8, fontSize:12, border:"1px solid rgba(239,68,68,0.15)" }}>
            <strong>Rejected:</strong> {product.rejectionReason}
          </div>
        )}

        {showActions && product.status === "AVAILABLE" && (
          <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
            {!isMine && (
              <>
                <Btn size="sm" icon="💬" onClick={() => onChat?.(product)}>Chat</Btn>
                <Btn size="sm" variant="ghost" icon="🚩" onClick={() => onReport?.(product)}>Report</Btn>
              </>
            )}
            {isMine && (
              <>
                <Btn size="sm" variant="success" onClick={() => onMarkSold?.(product.id)}>Mark Sold</Btn>
                <Btn size="sm" variant="ghost" onClick={() => onArchive?.(product.id)}>Archive</Btn>
                <Btn size="sm" variant="subtle" icon="✏️" onClick={() => onEdit?.(product)}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={() => onDelete?.(product.id)}>Delete</Btn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Modal ───────────────────────────────────────────────────────────────

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

    // Subscribe to STOMP topic for real-time delivery
    const destination = `/topic/messages/${user.id}`;
    const unsub = stompSubscribe(destination, (msg) => {
      // Only add if it belongs to this product+conversation
      if (msg.productId === product.id) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setWsStatus("live");
      }
    });

    // Detect if STOMP connected within 3 s; otherwise fall back to polling
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
    <Modal title={`Chat — ${product.title}`} onClose={onClose} width={520}>
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
          height:340, overflowY:"auto", padding:"4px 0",
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
              <div key={m.id} style={{
                display:"flex", justifyContent: mine ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth:"75%", padding:"9px 13px", borderRadius:12,
                  background: mine ? "var(--accent)" : "var(--surface)",
                  color: mine ? "#fff" : "var(--text)",
                  fontSize:13, lineHeight:1.5,
                  borderBottomRightRadius: mine ? 4 : 12,
                  borderBottomLeftRadius: mine ? 12 : 4,
                }}>
                  {!mine && <div style={{ fontSize:11, color: mine ? "rgba(255,255,255,0.7)" : "var(--muted)", marginBottom:3 }}>{m.senderName}</div>}
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
        <FieldGroup label="Image URL"><input value={form.imageUrl} onChange={set("imageUrl")} /></FieldGroup>
        <FieldGroup label="Price (₹)"><input type="number" min="0" value={form.price} onChange={set("price")} /></FieldGroup>
        <FieldGroup label="Category">
          <select value={form.category} onChange={set("category")}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
          </select>
        </FieldGroup>
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
    try {
      await apiFetch(`/products/${id}/status?status=SOLD`, { method:"PATCH" });
      toast("Marked as sold!", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  async function archiveProduct(id) {
    try {
      await apiFetch(`/products/${id}/status?status=ARCHIVED`, { method:"PATCH" });
      toast("Listing archived", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this listing?")) return;
    try {
      await apiFetch(`/products/${id}`, { method:"DELETE" });
      toast("Listing deleted", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Search & Filters */}
      <div style={{
        background:"var(--card)", borderRadius:"var(--radius)", border:"1px solid var(--border)",
        padding:"16px 20px", display:"flex", flexDirection:"column", gap:12,
      }}>
        <div style={{ display:"flex", gap:10 }}>
          <input
            placeholder="Search listings…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key==="Enter" && load()}
            style={{ flex:1 }}
          />
          <Btn onClick={load} icon="🔍">Search</Btn>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width:160 }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
          </select>
          <input placeholder="Min ₹" type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ width:100 }} />
          <input placeholder="Max ₹" type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width:100 }} />
          {(search || category || minPrice || maxPrice) && (
            <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(""); setMinPrice(""); setMaxPrice(""); setTimeout(load,0); }}>
              Clear Filters
            </Btn>
          )}
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", padding:60 }}><Spinner size={32} /></div>}

      {!loading && products.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:16, fontWeight:500 }}>No listings found</div>
          <div style={{ fontSize:13, marginTop:4 }}>Try adjusting your filters</div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:18 }}>
        {products.map((p, i) => (
          <div key={p.id} style={{ animationDelay: `${i * 0.05}s` }}>
            <ProductCard
              product={p}
              onChat={setChatProduct}
              onReport={setReportProduct}
              onMarkSold={markSold}
              onArchive={archiveProduct}
              onDelete={deleteProduct}
            />
          </div>
        ))}
      </div>

      {chatProduct   && <ChatModal   product={chatProduct}   onClose={() => setChatProduct(null)}   toast={toast} />}
      {reportProduct && <ReportModal product={reportProduct} onClose={() => setReportProduct(null)} toast={toast} />}
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
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:22, fontWeight:800 }}>New Listing</h2>
        <p style={{ color:"var(--muted)", fontSize:14, marginTop:4 }}>Your listing will be reviewed by an admin before going live.</p>
      </div>
      <form onSubmit={submit} style={{
        background:"var(--card)", borderRadius:18, border:"1px solid var(--border2)",
        padding:28, display:"flex", flexDirection:"column", gap:18,
      }}>
        <FieldGroup label="Title">
          <input placeholder="What are you selling?" value={form.title} onChange={set("title")} required />
        </FieldGroup>
        <FieldGroup label="Description">
          <textarea rows={4} placeholder="Describe the condition, age, etc." value={form.description} onChange={set("description")} required style={{ resize:"vertical" }} />
        </FieldGroup>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <FieldGroup label="Category">
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Price (₹)">
            <input type="number" min="0" step="1" placeholder="0" value={form.price} onChange={set("price")} required />
          </FieldGroup>
        </div>
        <FieldGroup label="Image URL (optional)">
          <input placeholder="https://…" value={form.imageUrl} onChange={set("imageUrl")} />
        </FieldGroup>

        {/* Preview strip */}
        {form.imageUrl && (
          <div style={{ borderRadius:10, overflow:"hidden", height:120 }}>
            <img src={form.imageUrl} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => e.target.style.display="none"} />
          </div>
        )}

        <div style={{ display:"flex", gap:10, paddingTop:4 }}>
          <Btn type="submit" loading={loading} size="lg" icon={cat.icon} style={{ flex:1, justifyContent:"center" }}>
            Submit Listing
          </Btn>
        </div>
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
    try {
      await apiFetch(`/products/${id}/status?status=SOLD`, { method:"PATCH" });
      toast("Marked as sold!", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  async function archiveProduct(id) {
    try {
      await apiFetch(`/products/${id}/status?status=ARCHIVED`, { method:"PATCH" });
      toast("Listing archived", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this listing?")) return;
    try {
      await apiFetch(`/products/${id}`, { method:"DELETE" });
      toast("Deleted", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
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
      <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
      <div style={{ fontSize:16, fontWeight:500 }}>No listings yet</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
      {Object.entries(groups).filter(([,v]) => v.length).map(([status, items]) => (
        <div key={status}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <Badge color={STATUS_META[status]?.color}>{STATUS_META[status]?.label}</Badge>
            <span style={{ color:"var(--muted)", fontSize:13 }}>{items.length} listing{items.length > 1 ? "s" : ""}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
            {items.map(p => (
              <ProductCard key={p.id} product={p}
                onMarkSold={markSold} onArchive={archiveProduct} onEdit={setEditProduct} onDelete={deleteProduct}
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

  // Group into threads by (productId, otherUserId)
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
      <div style={{ fontSize:48, marginBottom:12 }}>💬</div>
      <div style={{ fontSize:16, fontWeight:500 }}>No messages yet</div>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:0, background:"var(--card)", borderRadius:"var(--radius)", border:"1px solid var(--border)", overflow:"hidden", minHeight:420 }}>
      {/* Thread list */}
      <div style={{ width:280, borderRight:"1px solid var(--border)", overflowY:"auto" }}>
        {threads.map(t => (
          <div key={t.key} onClick={() => setSelected(t)} style={{
            padding:"14px 16px", cursor:"pointer", borderBottom:"1px solid var(--border)",
            background: selected?.key === t.key ? "var(--surface)" : "transparent",
            transition:"background 0.15s",
          }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{t.otherName}</div>
            <div style={{ color:"var(--accent)", fontSize:12, marginTop:1 }}>{t.productTitle}</div>
            <div style={{ color:"var(--muted)", fontSize:12, marginTop:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {t.lastMsg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Conversation pane */}
      <div style={{ flex:1 }}>
        {selected
          ? <ThreadPane thread={selected} toast={toast} />
          : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--muted)", fontSize:14 }}>
              Select a conversation
            </div>
        }
      </div>
    </div>
  );
}

function ThreadPane({ thread, toast }) {
  const user = getUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");
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
      <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:2 }}>
        <div style={{ fontWeight:600 }}>{thread.otherName}</div>
        <div style={{ color:"var(--muted)", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
          {thread.productTitle}
          <span style={{
            width:6, height:6, borderRadius:"50%", display:"inline-block",
            background: wsStatus==="live" ? "var(--success)" : wsStatus==="polling" ? "var(--warn)" : "var(--muted)",
          }} />
          <span style={{ fontSize:10 }}>
            {wsStatus==="live" ? "Live" : wsStatus==="polling" ? "Polling" : "Connecting…"}
          </span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:8 }}>
        {messages.map(m => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth:"70%", padding:"9px 13px", borderRadius:12, fontSize:13, lineHeight:1.5,
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
      <div style={{ padding:"12px 18px", borderTop:"1px solid var(--border)", display:"flex", gap:8 }}>
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

  async function approve(id)  {
    try { await apiFetch(`/admin/products/${id}/approve`, { method:"PATCH" }); toast("Approved", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function doReject()   {
    try { await apiFetch(`/admin/products/${rejectModal}/reject`, { method:"PATCH", body: JSON.stringify({ reason: rejectReason }) }); toast("Rejected", "success"); setRejectModal(null); setRejectReason(""); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function resolveReport(id) {
    try { await apiFetch(`/admin/reports/${id}/resolve`, { method:"PATCH" }); toast("Resolved", "success"); loadAll(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function banUser(id, banned) {
    try {
      await apiFetch(`/admin/users/${id}/${banned ? "unban" : "ban"}`, { method:"PATCH" });
      toast(banned ? "User unbanned" : "User banned", "success"); loadAll();
    } catch (e) { toast(e.message, "error"); }
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
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:22, fontWeight:800 }}>Admin Panel</h2>
        <Badge color="var(--warn)">ADMIN</Badge>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"8px 16px", borderRadius:8, border: tab===t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: tab===t.id ? "rgba(91,127,255,0.12)" : "transparent",
            color: tab===t.id ? "var(--accent)" : "var(--muted)",
            fontFamily:"var(--font-body)", fontWeight:600, fontSize:13, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
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

      {/* Pending products */}
      {tab === "pending" && (
        pending.length === 0
          ? <EmptyState icon="✅" msg="No pending products" />
          : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {pending.map(p => (
                <div key={p.id} style={{
                  background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
                  padding:"16px 20px", display:"flex", gap:16, alignItems:"flex-start",
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontWeight:700 }}>{p.title}</span>
                      <Badge color={CAT_META[p.category]?.color}>{p.category}</Badge>
                    </div>
                    <p style={{ color:"var(--muted)", fontSize:13 }}>{p.description}</p>
                    <div style={{ color:"var(--muted)", fontSize:12, marginTop:6 }}>
                      By {p.sellerName} · ₹{p.price} · {p.meetingHostel}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <Btn size="sm" variant="success" onClick={() => approve(p.id)}>Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => { setRejectModal(p.id); setRejectReason(""); }}>Reject</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => adminDeleteProduct(p.id)}>Delete</Btn>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Reports */}
      {tab === "reports" && (
        reports.length === 0
          ? <EmptyState icon="🏳️" msg="No reports" />
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {reports.map(r => (
                <div key={r.id} style={{
                  background:"var(--card)", borderRadius:12, border:`1px solid ${r.resolved ? "var(--border)" : "rgba(239,68,68,0.25)"}`,
                  padding:"14px 18px", display:"flex", gap:14, alignItems:"center",
                  opacity: r.resolved ? 0.6 : 1,
                }}>
                  <div style={{ flex:1 }}>
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

      {/* Users */}
      {tab === "users" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {users.map(u => (
            <div key={u.id} style={{
              background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
              padding:"14px 18px", display:"flex", gap:14, alignItems:"center",
              opacity: u.banned ? 0.65 : 1,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontWeight:600 }}>{u.name}</span>
                  <Badge color={u.role === "ADMIN" ? "var(--warn)" : u.role === "SELLER" ? "var(--accent)" : "var(--muted)"}>{u.role}</Badge>
                  {u.banned && <Badge color="var(--danger)">Banned</Badge>}
                </div>
                <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>{u.email} · {u.hostelName || "—"}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn size="sm" variant={u.banned ? "success" : "danger"} onClick={() => banUser(u.id, u.banned)}>
                  {u.banned ? "Unban" : "Ban"}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => deleteUser(u.id)}>Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Products — hide/unhide/delete */}
      {tab === "products" && (
        allProducts.length === 0
          ? <EmptyState icon="📦" msg="No products" />
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {allProducts.map(p => (
                <div key={p.id} style={{
                  background:"var(--card)", borderRadius:12, border:"1px solid var(--border)",
                  padding:"14px 18px", display:"flex", gap:14, alignItems:"center",
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2 }}>
                      <span style={{ fontWeight:600 }}>{p.title}</span>
                      <Badge color={CAT_META[p.category]?.color}>{p.category}</Badge>
                      <Badge color={STATUS_META[p.status]?.color}>{STATUS_META[p.status]?.label}</Badge>
                    </div>
                    <div style={{ color:"var(--muted)", fontSize:12 }}>
                      {p.sellerName} · ₹{p.price} · {p.reportCount > 0 ? `⚠️ ${p.reportCount} report${p.reportCount > 1 ? "s" : ""}` : "No reports"}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    {p.status === "AVAILABLE" && <Btn size="sm" variant="ghost" onClick={() => hideProduct(p.id)}>Hide</Btn>}
                    {p.status === "ARCHIVED"  && <Btn size="sm" variant="success" onClick={() => unhideProduct(p.id)}>Unhide</Btn>}
                    <Btn size="sm" variant="danger" onClick={() => adminDeleteProduct(p.id)}>Delete</Btn>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Keywords */}
      {tab === "keywords" && (
        keywords.length === 0
          ? <EmptyState icon="🔤" msg="No banned keywords configured" />
          : <div style={{ background:"var(--card)", borderRadius:12, border:"1px solid var(--border)", padding:"18px 20px" }}>
              <p style={{ color:"var(--muted)", fontSize:13, marginBottom:14 }}>
                These keywords are automatically flagged in listings. Configured server-side.
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {keywords.map((kw, i) => (
                  <span key={i} style={{
                    background:"rgba(239,68,68,0.1)", color:"#ef4444",
                    border:"1px solid rgba(239,68,68,0.2)",
                    padding:"4px 12px", borderRadius:99, fontSize:13, fontWeight:500,
                  }}>
                    🚫 {kw}
                  </span>
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
      <div style={{ fontSize:42, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15 }}>{msg}</div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ tab, setTab, user, onLogout }) {
  const navItems = [
    { id:"market",  label:"Browse",    icon:"🏪" },
    ...(user?.role === "SELLER" || user?.role === "ADMIN"
      ? [{ id:"sell", label:"Sell", icon:"➕" }, { id:"mylistings", label:"My Listings", icon:"📋" }]
      : []),
    { id:"inbox",   label:"Inbox",     icon:"💬" },
    ...(user?.role === "ADMIN" ? [{ id:"admin", label:"Admin", icon:"⚙️" }] : []),
  ];

  return (
    <nav style={{
      position:"sticky", top:0, zIndex:100,
      background:"rgba(8,9,12,0.85)", backdropFilter:"blur(16px)",
      borderBottom:"1px solid var(--border)",
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"0 24px", height:58,
    }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{
          width:34, height:34, borderRadius:9,
          background:"linear-gradient(135deg, var(--accent), var(--accent2))",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:17, boxShadow:"0 4px 12px rgba(91,127,255,0.3)",
        }}>🏛️</div>
        <span style={{ fontFamily:"var(--font-head)", fontWeight:800, fontSize:16, letterSpacing:"-0.01em" }}>ThaparMart</span>
      </div>

      {/* Nav items */}
      <div style={{ display:"flex", gap:2 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            padding:"6px 14px", borderRadius:8, border:"none",
            background: tab===item.id ? "rgba(91,127,255,0.15)" : "transparent",
            color: tab===item.id ? "var(--accent)" : "var(--muted)",
            fontFamily:"var(--font-body)", fontWeight:500, fontSize:13,
            cursor:"pointer", transition:"all 0.15s",
            display:"flex", alignItems:"center", gap:6,
          }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      {/* User */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{
          width:32, height:32, borderRadius:"50%",
          background:"linear-gradient(135deg, var(--accent), var(--accent2))",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:13, fontWeight:700, color:"#fff",
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <span style={{ fontSize:13, color:"var(--muted)" }}>{user?.name}</span>
        <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
      </div>
    </nav>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [auth, setAuth] = useState(() => !!localStorage.getItem("jwt"));
  const [tab, setTab] = useState("market");
  const [toastData, setToastData] = useState(null);

  const toast = useCallback((msg, type = "info") => setToastData({ msg, type, key: Date.now() }), []);
  const user = getUser();

  // Boot STOMP if already logged in (e.g. after page reload)
  useEffect(() => { if (auth) initStomp(); }, [auth]);

  function logout() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    // Tear down STOMP connection
    if (_stompClient) { _stompClient.deactivate(); _stompClient = null; _stompReady = false; _stompListeners.clear(); }
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
        <main style={{ padding:"28px 24px", maxWidth:1200, margin:"0 auto" }}>
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
