import { useState, useEffect, useRef } from "react";
import SubmitDoubt from "./SubmitDoubt";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";
const PURPLE_MID = "#8b5cf6";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes pulseRing {
    0% { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes skeleton {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes confettiFall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .fac-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
    cursor: pointer;
  }
  .fac-card:hover {
    transform: translateY(-3px) !important;
    box-shadow: 0 12px 32px rgba(124,58,237,0.14) !important;
  }
  .nav-item {
    transition: all 0.18s ease;
    cursor: pointer;
  }
  .nav-item:hover {
    background: rgba(255,255,255,0.15) !important;
  }
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
    border-radius: 8px;
  }
  .page-anim { animation: fadeInUp 0.35s ease both; }
  .btn-purple {
    background: linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK});
    color: #fff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s;
  }
  .btn-purple:hover { opacity: 0.92; transform: translateY(-1px); }
  .scroll-area::-webkit-scrollbar { width: 4px; }
  .scroll-area::-webkit-scrollbar-track { background: transparent; }
  .scroll-area::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 4px; }
`;

const StatusBadge = ({ status }) => {
  const config = {
    available: { label: "Available", color: "#16a34a", bg: "#dcfce7" },
    busy: { label: "In Class", color: "#2563eb", bg: "#dbeafe" },
    lunch: { label: "Lunch", color: "#d97706", bg: "#fef3c7" },
    not_arrived: { label: "Not Arrived", color: "#94a3b8", bg: "#f1f5f9" },
    left: { label: "Left", color: "#dc2626", bg: "#fee2e2" },
    pending: { label: "Pending", color: "#d97706", bg: "#fef3c7" },
    active: { label: "Active", color: "#2563eb", bg: "#dbeafe" },
    completed: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
    rejected: { label: "Rejected", color: "#dc2626", bg: "#fee2e2" },
  }[status] || { label: status, color: "#94a3b8", bg: "#f1f5f9" };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: config.bg, fontSize: 11, fontWeight: 700, color: config.color }}>
      {status === "available" && (
        <span style={{ position: "relative", width: 7, height: 7, display: "inline-block" }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: config.color, opacity: 0.4, animation: "pulseRing 1.5s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 1, borderRadius: "50%", background: config.color }} />
        </span>
      )}
      {status === "busy" && <span style={{ width: 7, height: 7, borderRadius: "50%", border: `2px solid ${config.color}`, borderTopColor: "transparent", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
      {config.label}
    </span>
  );
};

const Confetti = () => {
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    color: [PURPLE, "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#f97316"][i % 6],
    left: `${(i * 5) + 2}%`, delay: `${i * 0.08}s`, size: [8, 10, 6, 12][i % 4]
  }));
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 9999, height: "100vh", overflow: "hidden" }}>
      {pieces.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.left, top: "-20px", width: p.size, height: p.size, background: p.color, borderRadius: i % 3 === 0 ? "50%" : 2, animation: `confettiFall 2s ease-out ${p.delay} both` }} />
      ))}
    </div>
  );
};

const AIHint = ({ topic }) => {
  const hints = {
    "Event Loop": "JavaScript Event Loop works by pushing async callbacks to the call stack only when it's empty.",
    "Supervised Learning": "Focus on understanding the difference between training and test data first.",
    "KNN": "KNN classifies by finding K nearest neighbors using distance.",
    "Shell Sort": "Shell Sort is an extension of Insertion Sort with gaps.",
    "Dijkstra Algorithm": "Dijkstra uses a greedy approach — always pick the unvisited node with smallest distance.",
    "BST Node Removal": "BST deletion has 3 cases: leaf node, one child, two children. Master each case separately.",
  };
  const key = Object.keys(hints).find(k => topic?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(topic?.toLowerCase() || ""));
  const hint = hints[key] || `For ${topic}, start by understanding the core definition, then work through a simple example step by step.`;

  return (
    <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "1px solid #ddd6fe", borderRadius: 10, padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: PURPLE, letterSpacing: 0.5 }}>AI HINT</span>
      </div>
      <div style={{ fontSize: 12, color: "#5b21b6", lineHeight: 1.6 }}>{hint}</div>
    </div>
  );
};

// Mini calendar
const MiniCalendar = ({ darkMode }) => {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background: darkMode ? "#1e1b4b" : "#fff", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#c4b5fd" : PURPLE }}>{monthNames[month]} {year}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: darkMode ? "#7c3aed" : "#94a3b8", padding: "2px 0" }}>{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} style={{
            fontSize: 11, padding: "4px 0", borderRadius: 6, fontWeight: d === today ? 800 : 400,
            background: d === today ? PURPLE : "transparent",
            color: d === today ? "#fff" : darkMode ? "#e2e8f0" : "#374151"
          }}>{d || ""}</div>
        ))}
      </div>
    </div>
  );
};

export default function StudentDashboard({ user, setUser, darkMode, setDarkMode }) {
  const isDark = darkMode;
  const bg = isDark ? "#0f0e1a" : "#f5f3ff";
  const cardBg = isDark ? "#1e1b4b" : "#fff";
  const textColor = isDark ? "#f1f5f9" : "#1a1a2e";
  const subColor = isDark ? "#a5b4fc" : "#64748b";
  const borderColor = isDark ? "#312e81" : "#ede9fe";

  const [page, setPage] = useState("home");
  const [faculty, setFaculty] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [myDoubts, setMyDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showConfetti, setShowConfetti] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [notifDismissed, setNotifDismissed] = useState(localStorage.getItem("notifDismissed") === "true");
  const wsRef = useRef(null);
  const [recommendTopic, setRecommendTopic] = useState("");
  const [recommendSubject, setRecommendSubject] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);

  const filteredFaculty = faculty
    .filter(f => f.faculty_name?.toLowerCase().includes(search.toLowerCase()))
    .filter(f => subjectFilter ? f.subject === subjectFilter : true)
    .filter(f => availFilter ? f.status === availFilter : true)
    .sort((a, b) => {
      if (sortBy === "available") { const o = { available: 0, lunch: 1, busy: 2, not_arrived: 3, left: 4 }; return (o[a.status] ?? 5) - (o[b.status] ?? 5); }
      if (sortBy === "name") return a.faculty_name?.localeCompare(b.faculty_name);
      if (sortBy === "queue") return (a.queue_count || 0) - (b.queue_count || 0);
      return 0;
    });

  useEffect(() => {
    requestNotificationPermission();
    fetchFaculty(); fetchMyDoubts(); fetchAnnouncements();
    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws");
      wsRef.current = ws;
      ws.onopen = () => console.log("WebSocket connected");
      ws.onmessage = () => { fetchFaculty(); fetchMyDoubts(); fetchAnnouncements(); };
      ws.onclose = () => { console.log("WS closed, reconnecting..."); setTimeout(connectWS, 2000); };
      ws.onerror = (err) => { console.error(err); ws.close(); };
    };
    connectWS();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const requestNotificationPermission = async () => { if ("Notification" in window) await Notification.requestPermission(); };
  const sendNotification = (title, body) => { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.ico" }); };

  const fetchFaculty = async () => {
    try { const res = await fetch(`${API}/timetable/all-faculty-status`); const data = await res.json(); setFaculty(data.faculty || []); } catch {}
    setLoading(false);
  };
  const fetchAnnouncements = async () => { try { const res = await fetch(`${API}/admin/announcements`); const data = await res.json(); setAnnouncements(data.announcements || []); } catch {} };
  const fetchMyDoubts = async () => {
    try {
      const res = await fetch(`${API}/doubts/my-doubts`, { headers: { authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      const newDoubts = data.doubts || [];
      newDoubts.forEach(nd => {
        const od = myDoubts.find(d => d._id === nd._id);
        if (od && od.status !== nd.status) {
          if (nd.status === "active") sendNotification("Your turn!", `${nd.topic} session started!`);
          if (nd.status === "completed") { sendNotification("Done!", `${nd.topic} resolved.`); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
          if (nd.status === "rejected") sendNotification("Rejected", `${nd.topic}: ${nd.reject_reason || ""}`);
        }
      });
      setMyDoubts(newDoubts);
    } catch {}
  };

  const logout = () => { localStorage.clear(); setUser(null); };

  const fetchRecommendations = async () => {
    if (!recommendTopic.trim()) return;
    setRecLoading(true);
    try {
      const res = await fetch(`${API}/doubts/recommend-faculty`, {
        method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ topic: recommendTopic, subject: recommendSubject })
      });
      const data = await res.json();
      if (res.ok) setRecommendations(data.recommendations || []);
    } catch {}
    setRecLoading(false);
  };

  if (page === "submit") return (
    <SubmitDoubt darkMode={darkMode} user={user} faculty={selectedFaculty} onBack={() => setPage("home")} onSubmitted={() => { setPage("mydoubts"); fetchMyDoubts(); }} />
  );

  const navItems = [
    { id: "home", icon: "⊞", label: "Dashboard" },
    { id: "mydoubts", icon: "📋", label: "My Doubts" },
    { id: "analytics", icon: "📊", label: "Analytics" },
  ];

  const pendingCount = myDoubts.filter(d => d.status === "pending").length;
  const activeCount = myDoubts.filter(d => d.status === "active").length;
  const completedCount = myDoubts.filter(d => d.status === "completed").length;
  const availableFaculty = faculty.filter(f => f.status === "available").length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {showConfetti && <Confetti />}

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, minHeight: "100vh", background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
        display: "flex", flexDirection: "column", padding: "28px 16px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100,
        boxShadow: "4px 0 24px rgba(124,58,237,0.2)"
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, padding: "0 8px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff" }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: -0.3 }}>PuchoKIET</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map(item => (
            <div key={item.id} className="nav-item" onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, background: page === item.id ? "rgba(255,255,255,0.22)" : "transparent" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 14, fontWeight: page === item.id ? 700 : 500, color: page === item.id ? "#fff" : "rgba(255,255,255,0.72)" }}>{item.label}</span>
              {item.id === "mydoubts" && (pendingCount + activeCount) > 0 && (
                <span style={{ marginLeft: "auto", background: "#fbbf24", color: "#1a1a1a", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px" }}>{pendingCount + activeCount}</span>
              )}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Student</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={logout} style={{ flex: 2, padding: "8px 0", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.85)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 28px", maxWidth: "calc(100vw - 220px)" }}>

        {/* Notification Banner */}
        {!notifDismissed && "Notification" in window && Notification.permission !== "granted" && (
          <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fbbf24", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Enable Notifications</div>
                <div style={{ fontSize: 11, color: "#a16207" }}>Get notified when your doubt is resolved</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { Notification.requestPermission(); setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ padding: "6px 14px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Allow</button>
              <button onClick={() => { setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ background: "transparent", border: "none", color: "#a16207", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        )}

        {/* ── HOME PAGE ── */}
        {page === "home" && (
          <div className="page-anim">
            {/* Welcome Banner */}
            <div style={{
              background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_MID} 60%, #a78bfa 100%)`,
              borderRadius: 20, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden"
            }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              <div style={{ position: "absolute", bottom: -40, right: 80, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              {announcements.length > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 12px", marginBottom: 12, fontSize: 12, color: "#fff" }}>
                  📢 {announcements[0].message}
                </div>
              )}
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>
                Welcome back, {user.name?.split(" ")[0]}! 👋
              </h2>
              <p style={{ color: "rgba(255,255,255,0.75)", margin: 0, fontSize: 14 }}>Always stay updated in your student portal</p>
              <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
                {[
                  { label: "Available Faculty", value: availableFaculty, color: "#a7f3d0" },
                  { label: "My Pending", value: pendingCount, color: "#fde68a" },
                  { label: "Resolved", value: completedCount, color: "#c4b5fd" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 18px", backdropFilter: "blur(8px)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-col layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
              <div>
                {/* AI Faculty Finder */}
                <div style={{ background: cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${borderColor}`, boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showRecommend ? 16 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: textColor }}>AI Faculty Finder</div>
                        <div style={{ fontSize: 12, color: subColor }}>Get the best faculty recommendation for your doubt</div>
                      </div>
                    </div>
                    <button onClick={() => { setShowRecommend(!showRecommend); setRecommendations(null); }}
                      className="btn-purple" style={{ padding: "7px 16px", fontSize: 12 }}>
                      {showRecommend ? "✕ Close" : "Try it ✨"}
                    </button>
                  </div>

                  {showRecommend && (
                    <div>
                      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                        <select value={recommendSubject} onChange={e => setRecommendSubject(e.target.value)}
                          style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", color: textColor, background: cardBg, minWidth: 170 }}>
                          <option value="">Any Subject</option>
                          {["Design and Analysis of Algorithms","Computer Networks","Web Technology","ANN and Machine Learning","Data Analytics","Universal Human Values","Aptitude","Soft Skills"].map(s => <option key={s}>{s}</option>)}
                        </select>
                        <input value={recommendTopic} onChange={e => setRecommendTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchRecommendations()}
                          placeholder='e.g. "Dijkstra", "KNN", "BST"'
                          style={{ flex: 1, minWidth: 160, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", background: cardBg, color: textColor }} />
                        <button onClick={fetchRecommendations} disabled={recLoading || !recommendTopic.trim()} className="btn-purple" style={{ padding: "9px 18px", fontSize: 13, opacity: (recLoading || !recommendTopic.trim()) ? 0.6 : 1 }}>
                          {recLoading ? "Finding..." : "🔍 Find"}
                        </button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {["Dijkstra", "Binary Search Tree", "KNN", "React Hooks", "OSI Model", "Dynamic Programming"].map(t => (
                          <span key={t} onClick={() => setRecommendTopic(t)} style={{ padding: "4px 10px", background: PURPLE_LIGHT, color: PURPLE, borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                      {recommendations && recommendations.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: 0.5 }}>Top {recommendations.length} for "{recommendTopic}"</div>
                          {recommendations.map((rec, i) => (
                            <div key={rec.faculty_id} className="fac-card" onClick={() => { const fac = faculty.find(f => f._id === rec.faculty_id); if (fac) { setSelectedFaculty(fac); setPage("submit"); } }}
                              style={{ background: i === 0 ? `linear-gradient(135deg, ${PURPLE_LIGHT}, #ddd6fe)` : isDark ? "#0f0e1a" : "#fafaf9", borderRadius: 12, padding: 14, border: i === 0 ? `2px solid ${PURPLE}` : `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: i === 0 ? PURPLE : i === 1 ? "#94a3b8" : "#cd7f32", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{rec.medal}</div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: textColor }}>{rec.faculty_name}</div>
                                  <div style={{ fontSize: 11, color: subColor }}>{rec.subject}</div>
                                  <div style={{ fontSize: 11, color: PURPLE, fontWeight: 600 }}>{rec.reason}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                                <StatusBadge status={rec.status} />
                                <button className="btn-purple" onClick={e => { e.stopPropagation(); const fac = faculty.find(f => f._id === rec.faculty_id); if (fac) { setSelectedFaculty(fac); setPage("submit"); } }}
                                  style={{ padding: "5px 12px", fontSize: 11 }}>Submit →</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {recommendations && recommendations.length === 0 && (
                        <div style={{ background: isDark ? "#0f0e1a" : "#fafaf9", borderRadius: 10, padding: 14, textAlign: "center", color: subColor, fontSize: 13 }}>No faculty found. Try a different topic.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div style={{ background: cardBg, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${borderColor}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="🔍 Search faculty..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 180, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", background: cardBg, color: textColor }} />
                  {[
                    { val: subjectFilter, onChange: setSubjectFilter, opts: ["All Subjects", ...[...new Set(faculty.map(f => f.subject))].sort()], first: "All Subjects" },
                    { val: availFilter, onChange: setAvailFilter, opts: ["All Status", "available", "busy", "lunch", "not_arrived", "left"], first: "All Status" },
                    { val: sortBy, onChange: setSortBy, opts: ["default", "available", "name", "queue"], first: "Sort: Default" },
                  ].map((sel, i) => (
                    <select key={i} value={sel.val} onChange={e => sel.onChange(e.target.value)}
                      style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 12, outline: "none", color: subColor, background: cardBg }}>
                      {sel.opts.map(o => <option key={o} value={o === sel.first ? "" : o}>{o === "available" ? "Available Now" : o === "busy" ? "In Class" : o === "lunch" ? "Lunch" : o === "not_arrived" ? "Not Arrived" : o === "left" ? "Left" : o === "default" ? "Sort: Default" : o === "available" ? "Available First" : o === "name" ? "Name A-Z" : o === "queue" ? "Least Queue" : o}</option>)}
                    </select>
                  ))}
                  <span style={{ fontSize: 12, color: subColor }}>{filteredFaculty.length} found</span>
                </div>

                {/* Faculty Grid */}
                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ background: cardBg, borderRadius: 14, padding: 18, border: `1px solid ${borderColor}` }}>
                        <div className="skeleton" style={{ height: 16, width: "60%", marginBottom: 10 }} />
                        <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 16 }} />
                        <div className="skeleton" style={{ height: 36, width: "100%" }} />
                      </div>
                    ))}
                  </div>
                ) : filteredFaculty.length === 0 ? (
                  <div style={{ background: cardBg, borderRadius: 14, padding: 40, textAlign: "center", color: subColor, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                    No faculty matching your filters
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                    {filteredFaculty.map((f, i) => (
                      <div key={i} className="fac-card" style={{
                        background: cardBg, borderRadius: 14, padding: 18,
                        border: f.status === "available" ? `2px solid ${PURPLE}` : `1px solid ${borderColor}`,
                        boxShadow: f.status === "available" ? "0 4px 20px rgba(124,58,237,0.1)" : "0 2px 8px rgba(0,0,0,0.04)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${PURPLE_LIGHT}, #ddd6fe)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: PURPLE }}>
                              {f.faculty_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: textColor }}>{f.faculty_name}</div>
                              <div style={{ fontSize: 11, color: subColor, marginTop: 1 }}>{f.subject?.slice(0, 28)}{f.subject?.length > 28 ? "…" : ""}</div>
                            </div>
                          </div>
                          <StatusBadge status={f.status} />
                        </div>
                        {f.cabin && <div style={{ fontSize: 11, color: subColor, marginBottom: 4 }}>📍 Cabin {f.cabin} · {f.block}</div>}
                        {f.queue_count > 0 && <div style={{ fontSize: 11, color: "#d97706", background: "#fef3c7", borderRadius: 6, padding: "3px 8px", display: "inline-block", marginBottom: 8 }}>👥 {f.queue_count} in queue</div>}
                        <button onClick={() => { setSelectedFaculty(f); setPage("submit"); }} className="btn-purple" style={{ width: "100%", padding: "10px 0", fontSize: 13, marginTop: 8, borderRadius: 10 }}>
                          Submit Doubt →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Calendar */}
                <MiniCalendar darkMode={isDark} />

                {/* Quick Stats */}
                <div style={{ background: cardBg, borderRadius: 16, padding: 16, border: `1px solid ${borderColor}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: textColor, marginBottom: 12 }}>My Activity</div>
                  {[
                    { label: "Total Doubts", value: myDoubts.length, color: PURPLE },
                    { label: "Pending", value: pendingCount, color: "#d97706" },
                    { label: "Active", value: activeCount, color: "#2563eb" },
                    { label: "Resolved", value: completedCount, color: "#16a34a" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${borderColor}` : "none" }}>
                      <span style={{ fontSize: 13, color: subColor }}>{s.label}</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>

                {/* Recent Doubts */}
                {myDoubts.length > 0 && (
                  <div style={{ background: cardBg, borderRadius: 16, padding: 16, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: textColor, marginBottom: 12 }}>Recent Doubts</div>
                    {myDoubts.slice(0, 4).map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${borderColor}` : "none" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{d.topic?.slice(0, 20)}{d.topic?.length > 20 ? "…" : ""}</div>
                          <div style={{ fontSize: 10, color: subColor }}>{d.subject?.slice(0, 18)}</div>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                    ))}
                    <button onClick={() => setPage("mydoubts")} style={{ width: "100%", marginTop: 10, padding: "8px 0", background: PURPLE_LIGHT, color: PURPLE, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      View All →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MY DOUBTS PAGE ── */}
        {page === "mydoubts" && (
          <div className="page-anim">
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: textColor, margin: 0 }}>My Doubts</h2>
              <p style={{ color: subColor, marginTop: 4, fontSize: 13 }}>Track your doubt sessions and queue position</p>
            </div>
            {myDoubts.length === 0 ? (
              <div style={{ background: cardBg, borderRadius: 16, padding: 48, textAlign: "center", color: subColor, border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: textColor, marginBottom: 6 }}>No doubts yet</div>
                <div style={{ fontSize: 13 }}>Go to Dashboard to submit your first doubt!</div>
                <button onClick={() => setPage("home")} className="btn-purple" style={{ marginTop: 16, padding: "10px 24px", fontSize: 13 }}>Go to Dashboard</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myDoubts.map((d, i) => (
                  <div key={i} style={{ background: cardBg, borderRadius: 14, padding: 18, border: `1px solid ${borderColor}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>{d.topic}</span>
                          {d.grouped && <span style={{ fontSize: 10, padding: "2px 8px", background: PURPLE_LIGHT, color: PURPLE, borderRadius: 10, fontWeight: 700 }}>🤝 GROUPED</span>}
                        </div>
                        <div style={{ fontSize: 12, color: subColor }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                        <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>{d.description?.slice(0, 70)}…</div>
                        {d.status === "rejected" && d.reject_reason && (
                          <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>❌ Rejection Reason</div>
                            <div style={{ fontSize: 13, color: "#991b1b" }}>{d.reject_reason}</div>
                          </div>
                        )}
                        {d.faculty_message && d.status !== "rejected" && (
                          <div style={{ marginTop: 10, background: PURPLE_LIGHT, border: `1px solid #ddd6fe`, borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, marginBottom: 4 }}>💬 Faculty Message</div>
                            <div style={{ fontSize: 13, color: PURPLE_DARK }}>{d.faculty_message}</div>
                          </div>
                        )}
                        {d.status === "pending" && <AIHint topic={d.topic} />}
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS PAGE ── */}
        {page === "analytics" && (() => {
          const completed = myDoubts.filter(d => d.status === "completed");
          const rejected = myDoubts.filter(d => d.status === "rejected");
          const pending = myDoubts.filter(d => d.status === "pending");
          const active = myDoubts.filter(d => d.status === "active");
          const resolutionRate = myDoubts.length > 0 ? Math.round((completed.length / myDoubts.length) * 100) : 0;
          const subjectStats = Object.entries(myDoubts.reduce((acc, d) => {
            if (!acc[d.subject]) acc[d.subject] = { total: 0, completed: 0, rejected: 0 };
            acc[d.subject].total++;
            if (d.status === "completed") acc[d.subject].completed++;
            if (d.status === "rejected") acc[d.subject].rejected++;
            return acc;
          }, {})).sort((a, b) => b[1].total - a[1].total);
          const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const dayBreakdown = myDoubts.reduce((acc, d) => { if (d.created_at) { const day = new Date(d.created_at).getDay(); acc[day] = (acc[day] || 0) + 1; } return acc; }, {});
          const maxDayCount = Math.max(...Object.values(dayBreakdown), 1);

          return (
            <div className="page-anim">
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: textColor, margin: 0 }}>Analytics</h2>
                <p style={{ color: subColor, marginTop: 4, fontSize: 13 }}>Your doubt history insights & patterns</p>
              </div>

              {myDoubts.length === 0 ? (
                <div style={{ background: cardBg, borderRadius: 16, padding: 48, textAlign: "center", color: subColor, border: `1px solid ${borderColor}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  Submit your first doubt to see analytics!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Stats Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
                    {[
                      { label: "Total", value: myDoubts.length, icon: "📝", color: PURPLE, bg: PURPLE_LIGHT },
                      { label: "Resolved", value: completed.length, icon: "✅", color: "#16a34a", bg: "#dcfce7" },
                      { label: "Pending", value: pending.length, icon: "⏳", color: "#d97706", bg: "#fef3c7" },
                      { label: "Active", value: active.length, icon: "🔵", color: "#2563eb", bg: "#dbeafe" },
                      { label: "Rejected", value: rejected.length, icon: "❌", color: "#dc2626", bg: "#fee2e2" },
                      { label: "Rate", value: `${resolutionRate}%`, icon: "📈", color: resolutionRate >= 70 ? "#16a34a" : "#d97706", bg: resolutionRate >= 70 ? "#dcfce7" : "#fef3c7" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: cardBg, borderRadius: 14, padding: 16, textAlign: "center", border: `1px solid ${borderColor}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 8px" }}>{s.icon}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Subject Breakdown */}
                  <div style={{ background: cardBg, borderRadius: 14, padding: 20, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontWeight: 700, color: textColor, marginBottom: 16, fontSize: 14 }}>📚 Subject Breakdown</div>
                    {subjectStats.length === 0 ? <div style={{ color: subColor, fontSize: 13 }}>No subjects yet</div> :
                      subjectStats.slice(0, 6).map(([subject, stats], i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                            <span style={{ color: textColor, fontWeight: 600 }}>{subject}</span>
                            <span style={{ color: subColor, fontSize: 11 }}>{stats.total} total · {stats.completed} resolved</span>
                          </div>
                          <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 20, overflow: "hidden", background: borderColor }}>
                            {stats.completed > 0 && <div style={{ height: "100%", background: "#22c55e", width: `${(stats.completed / stats.total) * 100}%`, transition: "width 0.8s ease" }} />}
                            {stats.rejected > 0 && <div style={{ height: "100%", background: "#ef4444", width: `${(stats.rejected / stats.total) * 100}%`, transition: "width 0.8s ease" }} />}
                            {(stats.total - stats.completed - stats.rejected) > 0 && <div style={{ height: "100%", background: "#f59e0b", width: `${((stats.total - stats.completed - stats.rejected) / stats.total) * 100}%` }} />}
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Day Activity */}
                  <div style={{ background: cardBg, borderRadius: 14, padding: 20, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontWeight: 700, color: textColor, marginBottom: 16, fontSize: 14 }}>📅 Day-wise Activity</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
                      {dayNames.map((day, i) => {
                        const count = dayBreakdown[i] || 0;
                        const height = count > 0 ? Math.max((count / maxDayCount) * 90, 10) : 4;
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: count > 0 ? PURPLE : subColor }}>{count || ""}</span>
                            <div style={{ width: "100%", maxWidth: 32, borderRadius: "6px 6px 0 0", height: `${height}px`, background: count > 0 ? `linear-gradient(180deg, ${PURPLE}, ${PURPLE_MID})` : borderColor, transition: "height 0.6s ease" }} />
                            <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>{day}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div style={{ background: cardBg, borderRadius: 14, padding: 20, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontWeight: 700, color: textColor, marginBottom: 16, fontSize: 14 }}>🕒 Recent Activity</div>
                    {myDoubts.slice(0, 8).map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 7 ? `1px solid ${borderColor}` : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{d.topic}</div>
                          <div style={{ fontSize: 11, color: subColor }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                          {d.status === "rejected" && d.reject_reason && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>Reason: {d.reject_reason}</div>}
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}