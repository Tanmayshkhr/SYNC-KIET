import { useState, useEffect, useRef } from "react";
import ToastContainer, { useToast } from "../components/Toast";
import FaceScanner from "../components/FaceScanner";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const ACCENT = "#a78bfa";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";
const PINK = "#ec4899";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes timerPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  .fade-up { animation: fadeUp 0.3s ease both; }
  .nav-link { transition: all 0.15s ease; cursor: pointer; border-radius: 10px; }
  .queue-card { transition: transform 0.2s ease, border-color 0.2s ease; }
  .queue-card:hover { transform: translateY(-2px); }
  .btn-primary { background: linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; transition:all 0.15s; }
  .btn-primary:hover { opacity:0.88; transform:translateY(-1px); }
  .clickable-header { transition: opacity 0.15s ease; cursor: pointer; }
  .clickable-header:hover { opacity: 0.82; }
  .timetable-slot { transition: all 0.15s ease; }
  .timetable-slot:hover { transform: scale(1.01); z-index: 2; }
`;

// ── Theme helper ────────────────────────────────────────────────────────
const theme = (dark) => ({
  bg:          dark ? "#0d0f1a" : "#f0f2ff",
  navBg:       dark ? "#0a0c14" : "#ffffff",
  cardBg:      dark ? "#13162a" : "#ffffff",
  surface:     dark ? "#1a1d30" : "#f8f9ff",
  border:      dark ? "#252840" : "#e8eaff",
  text:        dark ? "#f0f2ff" : "#0d0f1a",
  subText:     dark ? "#6b7099" : "#6366f1",
  muted:       dark ? "#3d4060" : "#9ca3af",
  navText:     dark ? "#8b8fb8" : "#6b7280",
  shadow:      dark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(99,102,241,0.1)",
});

// ── Live Clock ─────────────────────────────────────────────────────────
const LiveClock = ({ dark }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const T = theme(dark);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums", letterSpacing: -1, lineHeight: 1 }}>
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      </div>
    </div>
  );
};

// ── Status Dot ─────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    available: { c: GREEN, l: "Available" },
    busy:      { c: RED,   l: "Busy"      },
    lunch:     { c: AMBER, l: "Lunch"     },
    left:      { c: RED,   l: "Left"      },
  };
  const s = map[status] || { c: "#64748b", l: "Offline" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${s.c}18`, border: `1px solid ${s.c}44`, fontSize: 11, fontWeight: 700, color: s.c }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, display: "inline-block", animation: status === "available" ? "pulse 2s infinite" : "none" }} />
      {s.l}
    </span>
  );
};

// ── Weekly Timetable Grid ──────────────────────────────────────────────
const WeeklyTimetable = ({ schedule, dark }) => {
  const T = theme(dark);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const hours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
  
  // Build slot map for today's column only
  // API returns slots for today without day field
  // Use schedule.day to know which column they belong to
  const todayName = schedule.day || "";
  const slotMap = {};
  (schedule.slots || []).forEach(slot => {
    // Slots belong to today's column
    if (todayName && slot.start) {
      const key = `${todayName}-${slot.start?.slice(0,5)}`;
      slotMap[key] = slot;
    }
    // Also support if slot has explicit day
    if (slot.day && slot.start) {
      const key = `${slot.day}-${slot.start?.slice(0,5)}`;
      slotMap[key] = slot;
    }
  });

  const classColors = [
    { bg: "#7c3aed", border: "#5b21b6", text: "#fff" },
    { bg: "#3b82f6", border: "#1d4ed8", text: "#fff" },
    { bg: "#f59e0b", border: "#d97706", text: "#fff" },
    { bg: "#ec4899", border: "#db2777", text: "#fff" },
    { bg: "#22c55e", border: "#16a34a", text: "#fff" },
  ];
  const subjectColors = {};
  let colorIdx = 0;
  const getColor = (subject) => {
    if (!subjectColors[subject]) {
      subjectColors[subject] = classColors[colorIdx % classColors.length];
      colorIdx++;
    }
    return subjectColors[subject];
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 700 }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "60px repeat(5,1fr)", gap: 4, marginBottom: 4 }}>
          <div />
          {days.map(d => {
            const isToday = d === todayName;
            return (
              <div key={d} style={{ fontSize: 12, fontWeight: isToday ? 800 : 700, color: isToday ? PURPLE : T.subText, textAlign: "center", padding: "6px 0", background: isToday ? `${PURPLE}18` : "transparent", borderRadius: 8 }}>
                {d.slice(0,3)}
                {isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: PURPLE, margin: "2px auto 0" }} />}
              </div>
            );
          })}
        </div>
        {/* Time rows */}
        {hours.map(hour => (
          <div key={hour} style={{ display: "grid", gridTemplateColumns: "60px repeat(5,1fr)", gap: 4, marginBottom: 4, minHeight: 52 }}>
            <div style={{ fontSize: 10, color: T.muted, paddingTop: 6, textAlign: "right", paddingRight: 8 }}>{hour}</div>
            {days.map(day => {
              const slot = slotMap[`${day}-${hour}`];
              if (slot && slot.type === "class") {
                const c = getColor(slot.subject);
                return (
                  <div key={day} className="timetable-slot" style={{ background: c.bg, borderRadius: 8, padding: "6px 8px", cursor: "default", border: `1px solid ${c.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{slot.subject?.slice(0,18)}</div>
                    {slot.section && <div style={{ fontSize: 9, color: `${c.text}cc`, marginTop: 2 }}>{slot.section}</div>}
                  </div>
                );
              }
              if (hour === "13:00") {
                return (
                  <div key={day} style={{ background: dark ? "#2d1f00" : "#fef9c3", borderRadius: 8, padding: "6px 8px", border: `1px solid ${AMBER}44`, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: AMBER }}>🍽 Lunch</div>
                  </div>
                );
              }
              return <div key={day} style={{ background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }} />;
            })}
          </div>
        ))}
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(subjectColors).map(([subj, c]) => (
            <div key={subj} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg }} />
              <span style={{ fontSize: 10, color: T.muted }}>{subj?.slice(0, 20)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Today's Schedule (right panel like fd2) ────────────────────────────
const TodayQueue = ({ queue, history, dark }) => {
  const T = theme(dark);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
      {queue.slice(0, 8).map((d, i) => (
        <div key={d._id} style={{ background: T.surface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>#{i + 1} {d.student_name}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{d.topic?.slice(0, 24)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            {d.priority === "urgent" && <span style={{ fontSize: 9, padding: "1px 6px", background: `${RED}22`, color: RED, borderRadius: 8, fontWeight: 800 }}>URGENT</span>}
            <span style={{ fontSize: 10, color: T.muted }}>
              {d.duration === "quick" ? "⚡" : d.duration === "long" ? "🔍" : "📖"}
            </span>
          </div>
        </div>
      ))}
      {queue.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: T.muted }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 12 }}>No students in queue</div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────
export default function FacultyDashboard({ user, setUser, darkMode, setDarkMode }) {
  const { toasts, addToast } = useToast();
  const T = theme(darkMode);

  const [queue, setQueue] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [messagePopup, setMessagePopup] = useState(null);
  const [customMessage, setCustomMessage] = useState("");
  const [groupModal, setGroupModal] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState({});
  const [rejectPopup, setRejectPopup] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ total_completed: 0, total_rejected: 0, total_group_sessions: 0 });
  const [schedule, setSchedule] = useState({ day: "", slots: [] });
  const [announcements, setAnnouncements] = useState([]);
  const [notifDismissed, setNotifDismissed] = useState(localStorage.getItem("notifDismissed") === "true");
  const [faceStatus, setFaceStatus] = useState({ face_registered: false, manual_status: null });
  const [faceScanner, setFaceScanner] = useState(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const wsRef = useRef(null);

  const authH = { authorization: `Bearer ${user.token}` };
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const logout = () => { localStorage.clear(); setUser(null); };
  const sendNotif = (t, b) => { if ("Notification" in window && Notification.permission === "granted") new Notification(t, { body: b }); };

  useEffect(() => {
    fetchQueue(); fetchHistory(); fetchSchedule(); fetchAnnouncements(); fetchFaceStatus();
    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws"); wsRef.current = ws;
      ws.onopen = () => console.log("WS connected");
      ws.onmessage = () => { fetchQueue(); fetchAnnouncements(); };
      ws.onclose = () => setTimeout(connectWS, 2000);
      ws.onerror = e => { ws.close(); };
    };
    connectWS();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  useEffect(() => {
    let t;
    if (activeSession) {
      t = setInterval(() => setTimer(s => { if (s >= 1800) { completeSession(); return 0; } return s + 1; }), 1000);
    } else setTimer(0);
    return () => clearInterval(t);
  }, [activeSession]);

  const fetchAnnouncements = async () => { try { const r = await fetch(`${API}/admin/announcements`); const d = await r.json(); setAnnouncements(d.announcements || []); } catch {} };
  const fetchFaceStatus = async () => { try { const r = await fetch(`${API}/face/status`, { headers: authH }); const d = await r.json(); setFaceStatus(d); } catch {} };
  const fetchQueue = async () => {
    try {
      const r = await fetch(`${API}/doubts/faculty-queue`, { headers: authH });
      const d = await r.json(); const nq = d.queue || [];
      if (nq.length > queue.length && nq.length > 0) sendNotif("New Doubt", `${nq[nq.length - 1].student_name} - ${nq[nq.length - 1].topic}`);
      setQueue(nq);
    } catch {}
    setLoading(false);
  };
  const fetchHistory = async () => { try { const r = await fetch(`${API}/doubts/faculty-history`, { headers: authH }); const d = await r.json(); setHistory(d.history || []); setHistoryStats({ total_completed: d.total_completed || 0, total_rejected: d.total_rejected || 0, total_group_sessions: d.total_group_sessions || 0 }); } catch {} };
  const fetchSchedule = async () => { try { const r = await fetch(`${API}/timetable/my-schedule`, { headers: authH }); const d = await r.json(); setSchedule({ day: d.day || "", slots: d.slots || [] }); } catch {} };

  const acceptDoubt = async (doubt, groupDoubts = null) => {
    try {
      if (groupDoubts && groupDoubts.length > 1) {
        await Promise.all(groupDoubts.map(d => fetch(`${API}/doubts/accept/${d._id}`, { method: "PUT", headers: authH })));
        setActiveSession({ ...doubt, groupDoubts, isGroup: true });
      } else {
        await fetch(`${API}/doubts/accept/${doubt._id}`, { method: "PUT", headers: authH });
        setActiveSession(doubt);
      }
      addToast("Session started!", "success"); fetchQueue();
    } catch (e) { console.error(e); }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    try { await fetch(`${API}/doubts/complete/${activeSession._id}`, { method: "PUT", headers: authH }); setActiveSession(null); addToast("Session completed!", "success"); fetchQueue(); fetchHistory(); } catch (e) { console.error(e); }
  };

  const rejectDoubt = async (doubt, reason) => {
    try { await fetch(`${API}/doubts/reject/${doubt._id}`, { method: "PUT", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason || "No reason" }) }); setActiveSession(null); setRejectPopup(null); setRejectReason(""); addToast("Rejected", "info"); setTimeout(() => fetchQueue(), 500); } catch (e) { console.error(e); }
  };

  const QUICK_MESSAGES = ["Come in 5 minutes", "Come in 10 minutes", "Come in 15 minutes", "Please wait, finishing current session", "Your doubt needs more detail, please resubmit", "Grouping you with others, arrive in 5 mins", "Group session starting in 10 minutes"];
  const sendMessage = async (doubtId, message) => { try { await fetch(`${API}/doubts/send-message/${doubtId}`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); setMessagePopup(null); setCustomMessage(""); addToast("Message sent!", "success"); } catch {} };

  const findSimilar = async () => {
    setGroupLoading(true);
    try { const r = await fetch(`${API}/doubts/find-similar`, { headers: authH }); const d = await r.json(); const init = {}; (d.groups || []).forEach((g, gi) => g.doubts.forEach(dbt => { init[dbt._id] = gi; })); setSelectedForGroup(init); setGroupModal(d); } catch { addToast("Failed to find similar doubts", "error"); }
    setGroupLoading(false);
  };

  const confirmGroup = async (group) => {
    const ids = group.doubts.filter(d => selectedForGroup[d._id] !== undefined).map(d => d._id);
    if (ids.length < 2) { addToast("Select at least 2 doubts", "warning"); return; }
    try { await fetch(`${API}/doubts/group-doubts`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ doubt_ids: ids, group_name: group.canonical_topic }) }); setGroupModal(null); setSelectedForGroup({}); fetchQueue(); } catch {}
  };

  const confirmAllGroups = async () => {
    if (!groupModal) return;
    for (const g of groupModal.groups) {
      const ids = g.doubts.filter(d => selectedForGroup[d._id] !== undefined).map(d => d._id);
      if (ids.length >= 2) await fetch(`${API}/doubts/group-doubts`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ doubt_ids: ids, group_name: g.canonical_topic }) });
    }
    setGroupModal(null); setSelectedForGroup({}); fetchQueue();
  };

  const toggleDoubtSelection = (doubtId, gi) => setSelectedForGroup(prev => { const n = { ...prev }; if (n[doubtId] !== undefined) delete n[doubtId]; else n[doubtId] = gi; return n; });

  const currentStatus = activeSession ? "busy" : faceStatus.manual_status || "offline";

  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "history", icon: "📋", label: "History" },
    { id: "timetable", icon: "📅", label: "Timetable" },
    { id: "stats", icon: "📊", label: "Stats" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", color: T.text, transition: "background 0.3s,color 0.3s" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ToastContainer toasts={toasts} />

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <div style={{ width: 220, minHeight: "100vh", background: T.navBg, display: "flex", flexDirection: "column", padding: "24px 14px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, borderRight: `1px solid ${T.border}`, boxShadow: T.shadow }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "0 8px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>P</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>PuchoKIET</div>
            <div style={{ fontSize: 9, color: PURPLE, fontWeight: 700, letterSpacing: 1 }}>FACULTY</div>
          </div>
        </div>

        {/* Faculty card */}
        <div style={{ background: T.surface, borderRadius: 12, padding: 14, marginBottom: 24, border: `1px solid ${T.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff", margin: "0 auto 8px" }}>{user.name?.[0]?.toUpperCase()}</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>{user.name}</div>
            <StatusDot status={currentStatus} />
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <div key={item.id} className="nav-link" onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: page === item.id ? `${PURPLE}22` : "transparent", color: page === item.id ? ACCENT : T.navText, fontWeight: page === item.id ? 700 : 500, fontSize: 13 }}>
              <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.id === "dashboard" && queue.length > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#000", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px" }}>{queue.length}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: "8px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>{darkMode ? "☀️" : "🌙"}</button>
            <button onClick={logout} style={{ flex: 2, padding: "8px", background: "#450a0a", border: "1px solid #991b1b", borderRadius: 8, color: RED, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Logout</button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div style={{ marginLeft: 220, flex: 1, padding: "28px", minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>
              {page === "dashboard" ? "Dashboard" : page === "history" ? "History" : page === "timetable" ? "Timetable" : "Stats"}
            </h1>
            <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {!notifDismissed && "Notification" in window && Notification.permission !== "granted" && (
              <button onClick={() => { Notification.requestPermission(); setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ padding: "7px 14px", background: "#78350f", border: "1px solid #92400e", borderRadius: 8, color: AMBER, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>🔔 Enable Alerts</button>
            )}
            <LiveClock dark={darkMode} />
          </div>
        </div>

        {/* ══ DASHBOARD PAGE ══════════════════════════════════════ */}
        {page === "dashboard" && (
          <div className="fade-up">

            {/* Announcement banner — CLICKABLE shows all */}
            {announcements.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="clickable-header" onClick={() => setShowAnnouncements(!showAnnouncements)}
                  style={{ background: `linear-gradient(135deg,${PURPLE}33,${BLUE}22)`, borderRadius: showAnnouncements ? "12px 12px 0 0" : 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${PURPLE}44`, cursor: "pointer" }}>
                  <span style={{ fontSize: 20 }}>📢</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: 1, marginBottom: 2 }}>ANNOUNCEMENT</div>
                    <div style={{ fontSize: 13, color: T.text }}>{announcements[0].message}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {announcements.length > 1 && <span style={{ fontSize: 11, color: T.muted, background: `${PURPLE}22`, padding: "2px 8px", borderRadius: 10 }}>{announcements.length} total</span>}
                    <span style={{ fontSize: 16, color: ACCENT, transition: "transform 0.2s", transform: showAnnouncements ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
                  </div>
                </div>
                {showAnnouncements && (
                  <div style={{ background: T.cardBg, border: `1px solid ${PURPLE}44`, borderTop: "none", borderRadius: "0 0 12px 12px", maxHeight: 300, overflowY: "auto" }}>
                    {announcements.map((ann, i) => (
                      <div key={i} style={{ padding: "12px 18px", borderBottom: i < announcements.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, marginTop: 1 }}>📢</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{ann.message}</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
                            {ann.target && <span style={{ background: `${PURPLE}22`, color: ACCENT, padding: "1px 6px", borderRadius: 8, marginRight: 6, fontWeight: 700 }}>{ann.target}</span>}
                            {ann.created_at?.slice(0, 16)?.replace("T", " ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Hero Row: Welcome + 4 stats */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {/* Welcome */}
              <div style={{ background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                <div style={{ position: "absolute", bottom: -30, right: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>WELCOME BACK</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                  Hello, {(() => {
                    const parts = (user.name || "").split(" ");
                    const honorifics = ["mr.", "mrs.", "ms.", "dr.", "prof.", "mr", "mrs", "ms", "dr", "prof"];
                    const firstName = parts.find(p => !honorifics.includes(p.toLowerCase())) || parts[0] || "Faculty";
                    return firstName;
                  })()}!
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>{user.subject || "Faculty"} · KIET</div>
                <StatusDot status={currentStatus} />
              </div>

              {/* Stat cards */}
              {[
                { label: "Queue", value: queue.length, color: AMBER, icon: "👥", bg: darkMode ? "#1f1500" : "#fef9c3", action: () => document.getElementById("queue-section")?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Session", value: activeSession ? "Active" : "Idle", color: activeSession ? RED : GREEN, icon: activeSession ? "🔴" : "🟢", bg: darkMode ? activeSession ? "#1a0505" : "#052e16" : activeSession ? "#fef2f2" : "#f0fdf4", action: () => document.getElementById("session-section")?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Timer", value: activeSession ? fmt(timer) : "--:--", color: timer > 1500 ? RED : ACCENT, icon: "⏱️", bg: darkMode ? "#1e1b4b" : "#ede9fe", action: null },
                { label: "Resolved", value: historyStats.total_completed, color: GREEN, icon: "✅", bg: darkMode ? "#052e16" : "#f0fdf4", action: () => setPage("history") },
              ].map((s, i) => (
                <div key={i} className="clickable-header" onClick={s.action || undefined}
                  style={{ background: T.cardBg, borderRadius: 16, padding: 18, border: `1px solid ${T.border}`, cursor: s.action ? "pointer" : "default" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontSize: s.label === "Timer" ? 20 : 28, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Face Scan Card — CLICKABLE */}
            <div className="clickable-header" onClick={() => { if (!faceStatus.face_registered) setFaceScanner("register"); else if (faceStatus.manual_status !== "available") setFaceScanner("check_in"); else setFaceScanner("check_out"); }}
              style={{ background: T.cardBg, borderRadius: 14, padding: 18, marginBottom: 20, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: faceStatus.manual_status === "available" ? darkMode ? "#052e16" : "#dcfce7" : darkMode ? "#1e1b4b" : "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {faceStatus.manual_status === "available" ? "🟢" : faceStatus.manual_status === "left" ? "🔴" : "📷"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>
                    {!faceStatus.face_registered ? "Face Not Registered" : faceStatus.manual_status === "available" ? "Checked In ✅" : faceStatus.manual_status === "left" ? "Checked Out 🔴" : "Not Scanned Today"}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {!faceStatus.face_registered ? "Click to register face for check-in/out" : faceStatus.last_scan_at ? `Last: ${faceStatus.last_scan_at?.slice(0, 16)?.replace("T", " ")}` : "Click to scan face"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                {!faceStatus.face_registered ? (
                  <button onClick={() => setFaceScanner("register")} className="btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}>📷 Register Face</button>
                ) : (
                  <>
                    {faceStatus.manual_status !== "available" && <button onClick={() => setFaceScanner("check_in")} style={{ padding: "8px 14px", background: darkMode ? "#052e16" : "#dcfce7", border: `1px solid ${GREEN}44`, borderRadius: 8, color: GREEN, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🟢 Check In</button>}
                    {faceStatus.manual_status === "available" && <button onClick={() => setFaceScanner("check_out")} style={{ padding: "8px 14px", background: darkMode ? "#450a0a" : "#fee2e2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🔴 Check Out</button>}
                    <button onClick={() => setFaceScanner("register")} style={{ padding: "8px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Re-register</button>
                  </>
                )}
              </div>
            </div>

            {/* Main 2-col: Active Session + Queue */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {/* Active Session */}
              <div id="session-section" style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  Active Session
                  {activeSession && <span style={{ width: 8, height: 8, borderRadius: "50%", background: RED, display: "inline-block", animation: "pulse 1s infinite" }} />}
                </div>
                {activeSession ? (
                  <>
                    <div style={{ background: T.surface, borderRadius: 12, padding: 16, marginBottom: 14, border: `1px solid ${T.border}` }}>
                      {activeSession.isGroup ? (
                        <>
                          <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 8, fontSize: 13 }}>🤝 Group ({activeSession.groupDoubts.length} students)</div>
                          {activeSession.groupDoubts.map(gd => <div key={gd._id} style={{ fontSize: 12, color: T.muted, background: T.cardBg, borderRadius: 6, padding: "4px 10px", marginBottom: 3 }}>👤 {gd.student_name}</div>)}
                        </>
                      ) : <div style={{ fontWeight: 700, color: T.text, fontSize: 15, marginBottom: 4 }}>{activeSession.student_name}</div>}
                      <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{activeSession.topic}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{activeSession.subject}</div>
                    </div>
                    <div className={timer > 1500 ? "timer-warn" : ""} style={{ textAlign: "center", fontSize: 40, fontWeight: 800, color: timer > 1500 ? RED : ACCENT, marginBottom: 10, fontFamily: "monospace", background: T.surface, borderRadius: 12, padding: "14px 0", letterSpacing: 2, border: `1px solid ${T.border}` }}>
                      {fmt(timer)}
                    </div>
                    {timer > 1500 && <div style={{ textAlign: "center", fontSize: 11, color: RED, marginBottom: 10, fontWeight: 600 }}>⚠️ Auto-completing in {fmt(1800 - timer)}</div>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={completeSession} style={{ flex: 1, padding: "12px 0", background: darkMode ? "#052e16" : "#dcfce7", border: `1px solid ${GREEN}44`, borderRadius: 10, color: GREEN, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✅ Complete</button>
                      <button onClick={() => setRejectPopup(activeSession)} style={{ padding: "12px 16px", background: darkMode ? "#450a0a" : "#fee2e2", border: `1px solid ${RED}44`, borderRadius: 10, color: RED, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Reject</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💤</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No active session</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Accept a doubt from the queue</div>
                  </div>
                )}
              </div>

              {/* Queue */}
              <div id="queue-section" style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
                    Queue <span style={{ fontSize: 12, color: T.muted }}>({queue.length})</span>
                  </div>
                  {queue.length >= 2 && !activeSession && (
                    <button onClick={findSimilar} disabled={groupLoading} className="btn-primary" style={{ padding: "6px 12px", fontSize: 11, opacity: groupLoading ? 0.6 : 1 }}>
                      {groupLoading ? "Scanning..." : "🔍 Find Similar"}
                    </button>
                  )}
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: T.muted }}>Loading...</div>
                ) : queue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No students in queue</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
                    {(() => {
                      const groups = {}, singles = [];
                      queue.forEach(d => { if (d.grouped && d.cluster_id) { if (!groups[d.cluster_id]) groups[d.cluster_id] = []; groups[d.cluster_id].push(d); } else singles.push(d); });
                      return (
                        <>
                          {Object.entries(groups).map(([cid, gd]) => (
                            <div key={cid} className="queue-card" style={{ border: `2px solid ${BLUE}`, background: darkMode ? "#0c1a3a" : "#eff6ff", borderRadius: 12, padding: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontWeight: 700, color: BLUE, fontSize: 13 }}>🤝 GROUP SESSION</span>
                                <span style={{ fontSize: 10, padding: "1px 7px", background: `${BLUE}22`, color: BLUE, borderRadius: 10, fontWeight: 700 }}>{gd.length} students</span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>{gd[0].topic} · {gd[0].subject}</div>
                              {gd.map(g => <div key={g._id} style={{ fontSize: 11, color: T.muted, background: T.cardBg, borderRadius: 6, padding: "4px 10px", marginBottom: 3 }}>👤 {g.student_name}</div>)}
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button onClick={() => acceptDoubt(gd[0], gd)} className="btn-primary" style={{ flex: 1, padding: "8px 0", fontSize: 12 }}>Accept Group</button>
                                  <button onClick={() => setRejectPopup(gd[0])} style={{ padding: "8px 12px", background: darkMode ? "#450a0a" : "#fee2e2", border: "none", borderRadius: 8, color: RED, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                          {singles.map((d, i) => (
                            <div key={d._id} className="queue-card" style={{ border: d.priority === "urgent" ? `2px solid ${RED}` : `1px solid ${T.border}`, background: d.priority === "urgent" ? darkMode ? "#1a0505" : "#fff5f5" : T.surface, borderRadius: 12, padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>#{i + 1} {d.student_name}</span>
                                    {d.priority === "urgent" && <span style={{ fontSize: 9, padding: "1px 6px", background: `${RED}22`, color: RED, borderRadius: 8, fontWeight: 800, border: `1px solid ${RED}44` }}>URGENT</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                                    {d.topic}
                                    {d.duration && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: d.duration === "quick" ? darkMode ? "#052e16" : "#dcfce7" : d.duration === "long" ? darkMode ? "#450a0a" : "#fee2e2" : darkMode ? "#1f1500" : "#fef9c3", color: d.duration === "quick" ? GREEN : d.duration === "long" ? RED : AMBER, fontWeight: 700 }}>{d.duration === "quick" ? "⚡" : d.duration === "long" ? "🔍" : "📖"} {d.duration}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: T.muted }}>{d.subject}</div>
                                </div>
                              </div>
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => setMessagePopup(d)} style={{ padding: "7px 10px", background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>💬</button>
                                  <button onClick={() => acceptDoubt(d)} className="btn-primary" style={{ flex: 1, padding: "7px 0", fontSize: 12 }}>{d.priority === "urgent" ? "Accept (Priority)" : "Accept"}</button>
                                  <button onClick={() => setRejectPopup(d)} style={{ padding: "7px 10px", background: darkMode ? "#450a0a" : "#fee2e2", border: "none", borderRadius: 8, color: RED, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Timetable Section on Dashboard — like fd2! */}
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
              <div className="clickable-header" onClick={() => setPage("timetable")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>📅 Weekly Timetable</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Today: {schedule.day || "—"} · Click to expand</div>
                </div>
                <span style={{ fontSize: 12, color: PURPLE, fontWeight: 600 }}>View full →</span>
              </div>
              <WeeklyTimetable schedule={schedule} dark={darkMode} />
            </div>
          </div>
        )}

        {/* ══ HISTORY PAGE ════════════════════════════════════════ */}
        {page === "history" && (
          <div className="fade-up">
            {/* Clickable stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Resolved", value: historyStats.total_completed, color: GREEN, bg: darkMode ? "#052e16" : "#dcfce7", icon: "✅" },
                { label: "Total Rejected", value: historyStats.total_rejected, color: RED, bg: darkMode ? "#450a0a" : "#fee2e2", icon: "❌" },
                { label: "Group Sessions", value: historyStats.total_group_sessions, color: ACCENT, bg: darkMode ? "#1e1b4b" : "#ede9fe", icon: "🤝" },
              ].map((s, i) => (
                <div key={i} style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                  <div><div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 12, color: T.muted }}>{s.label}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background: T.cardBg, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Session History</div>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: T.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>No history yet</div>
              ) : history.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < history.length - 1 ? `1px solid ${T.border}` : "none", background: i % 2 === 0 ? "transparent" : T.surface }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{d.student_name} → {d.topic}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                    {d.grouped && <span style={{ fontSize: 9, padding: "1px 7px", background: `${PURPLE}22`, color: ACCENT, borderRadius: 6, fontWeight: 700, marginTop: 4, display: "inline-block" }}>🤝 Group</span>}
                    {d.status === "rejected" && d.reject_reason && <div style={{ fontSize: 11, color: RED, marginTop: 3 }}>Reason: {d.reject_reason}</div>}
                  </div>
                  <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: d.status === "completed" ? darkMode ? "#052e16" : "#dcfce7" : darkMode ? "#450a0a" : "#fee2e2", color: d.status === "completed" ? GREEN : RED, border: `1px solid ${d.status === "completed" ? GREEN : RED}44` }}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ TIMETABLE PAGE ══════════════════════════════════════ */}
        {page === "timetable" && (
          <div className="fade-up">
            <div className="clickable-header" onClick={() => setPage("dashboard")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>📅 Weekly Schedule</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Today: {schedule.day || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ l: "Class", c: PURPLE }, { l: "Free", c: GREEN }, { l: "Lunch", c: AMBER }].map(x => (
                  <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />
                    <span style={{ fontSize: 11, color: T.muted }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
              <WeeklyTimetable schedule={schedule} dark={darkMode} />
            </div>

            {/* Today's slots list */}
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}`, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 16 }}>Today's Classes</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {schedule.slots.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13 }}>No schedule loaded</div>
                ) : schedule.slots.map((slot, i) => (
                  <div key={i} style={{ background: slot.type === "class" ? `${BLUE}18` : T.surface, border: `1px solid ${slot.type === "class" ? BLUE : T.border}44`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>{slot.start} – {slot.end}</div>
                    {slot.type === "class" ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{slot.subject}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{slot.section} · {slot.class_type}</div>
                      </>
                    ) : <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Free Slot</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STATS PAGE ══════════════════════════════════════════ */}
        {page === "stats" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total Resolved", value: historyStats.total_completed, color: GREEN, icon: "✅", action: () => setPage("history") },
                { label: "Pending Queue", value: queue.length, color: AMBER, icon: "⏳", action: () => setPage("dashboard") },
                { label: "Group Sessions", value: historyStats.total_group_sessions, color: ACCENT, icon: "🤝", action: () => setPage("history") },
                { label: "Urgent Doubts", value: queue.filter(d => d.priority === "urgent").length, color: RED, icon: "🚨", action: () => setPage("dashboard") },
              ].map((s, i) => (
                <div key={i} className="clickable-header" onClick={s.action} style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}` }}>
              <div className="clickable-header" onClick={() => setPage("dashboard")} style={{ fontWeight: 700, color: T.text, marginBottom: 16, fontSize: 14, cursor: "pointer" }}>
                📋 Queue by Subject <span style={{ fontSize: 11, color: PURPLE }}>→ View Queue</span>
              </div>
              {queue.length === 0 ? <div style={{ color: T.muted, fontSize: 13 }}>No pending doubts right now</div> :
                Object.entries(queue.reduce((acc, d) => { acc[d.subject] = (acc[d.subject] || 0) + 1; return acc; }, {})).map(([subject, count], i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: T.text, fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: T.muted }}>{count} student{count > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ background: T.surface, borderRadius: 20, height: 6 }}>
                      <div style={{ height: "100%", borderRadius: 20, background: `linear-gradient(90deg,${PURPLE},${ACCENT})`, width: `${(count / queue.length) * 100}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────── */}

      {/* Message Modal */}
      {messagePopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 420, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>💬 Send Message</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>To: {messagePopup.student_name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {QUICK_MESSAGES.map((msg, i) => (
                <button key={i} onClick={() => sendMessage(messagePopup._id, msg)}
                  style={{ padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 12, color: T.text, fontWeight: 500, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE}
                  onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                  {msg}
                </button>
              ))}
            </div>
            <input placeholder="Or type custom message..." value={customMessage} onChange={e => setCustomMessage(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12, background: T.surface, color: T.text }} />
            <div style={{ display: "flex", gap: 10 }}>
              {customMessage && <button onClick={() => sendMessage(messagePopup._id, customMessage)} className="btn-primary" style={{ flex: 1, padding: "11px 0", fontSize: 13 }}>Send</button>}
              <button onClick={() => { setMessagePopup(null); setCustomMessage(""); }} style={{ flex: 1, padding: "11px 0", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 440, border: `1px solid ${RED}44`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: RED, marginBottom: 4 }}>❌ Reject Doubt</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Student: <b style={{ color: T.text }}>{rejectPopup.student_name}</b> · {rejectPopup.topic}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {["Topic not in my subject area", "Please refer to class notes first", "Duplicate doubt — already resolved", "Come during office hours instead", "Not enough detail — please resubmit with more info"].map((reason, i) => (
                <button key={i} onClick={() => setRejectReason(reason)}
                  style={{ padding: "10px 14px", background: rejectReason === reason ? `${RED}18` : T.surface, border: rejectReason === reason ? `1.5px solid ${RED}` : `1px solid ${T.border}`, borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 12, color: rejectReason === reason ? RED : T.text, fontWeight: 500 }}>
                  {reason}
                </button>
              ))}
            </div>
            <textarea placeholder="Or type custom reason (max 50 words)..." value={rejectReason}
              onChange={e => { const w = e.target.value.split(/\s+/).filter(Boolean); if (w.length <= 50) setRejectReason(e.target.value); }}
              rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 4, background: T.surface, color: T.text, resize: "none", fontFamily: "inherit" }} />
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, textAlign: "right" }}>{rejectReason.split(/\s+/).filter(Boolean).length}/50 words</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => rejectDoubt(rejectPopup, rejectReason)} disabled={!rejectReason.trim()}
                style={{ flex: 1, padding: "11px 0", background: rejectReason.trim() ? `linear-gradient(135deg,${RED},#dc2626)` : T.surface, color: rejectReason.trim() ? "#fff" : T.muted, border: "none", borderRadius: 8, fontWeight: 700, cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>
                Reject with Reason
              </button>
              <button onClick={() => { setRejectPopup(null); setRejectReason(""); }} style={{ padding: "11px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {groupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 540, maxHeight: "80vh", overflowY: "auto", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>🔍 Similar Doubts Found</div>
              <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Review and confirm to group students for a joint session.</div>
            {groupModal.groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: T.muted }}><div style={{ fontSize: 32, marginBottom: 10 }}>🤷</div>No similar doubts found.</div>
            ) : (
              <>
                {groupModal.groups.map((group, gi) => (
                  <div key={gi} style={{ border: `2px solid ${PURPLE}`, background: `${PURPLE}0a`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: ACCENT, fontSize: 13 }}>🤝 {group.canonical_topic}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{group.count} students · Confidence: {group.confidence}</div>
                      </div>
                      <button onClick={() => confirmGroup(group)} className="btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>Group These</button>
                    </div>
                    {group.doubts.map(d => {
                      const isSel = selectedForGroup[d._id] !== undefined;
                      return (
                        <div key={d._id} onClick={() => toggleDoubtSelection(d._id, gi)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: isSel ? `${PURPLE}18` : T.surface, border: isSel ? `1.5px solid ${PURPLE}` : `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: isSel ? `2px solid ${PURPLE}` : `2px solid ${T.border}`, background: isSel ? PURPLE : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{isSel && "✓"}</div>
                          <div><div style={{ fontWeight: 600, fontSize: 12, color: T.text }}>{d.student_name}</div><div style={{ fontSize: 10, color: T.muted }}>{d.topic} · {d.subject}</div></div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={confirmAllGroups} className="btn-primary" style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>Group All ({groupModal.groups.length})</button>
                  <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }} style={{ padding: "12px 20px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 14 }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Face Scanner */}
      {faceScanner && (
        <FaceScanner user={user} action={faceScanner} darkMode={darkMode} onClose={() => setFaceScanner(null)}
          onComplete={data => {
            setFaceScanner(null); fetchFaceStatus();
            if (data.action === "check_in") addToast("Checked in! Status: Available", "success");
            else if (data.action === "check_out") addToast("Checked out! Status: Left", "success");
            else addToast("Face registered!", "success");
          }} />
      )}
    </div>
  );
}