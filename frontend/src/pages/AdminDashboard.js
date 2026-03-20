import { useState, useEffect, useRef } from "react";
import ToastContainer, { useToast } from "../components/Toast";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const BLUE = "#2563eb";

/* ─── Inline Styles ───────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .fade-up { animation: fadeUp 0.32s ease both; }
  .nav-link { transition: all 0.15s ease; cursor: pointer; border-radius: 10px; }
  .nav-link:hover { background: #f5f3ff !important; color: ${PURPLE} !important; }
  .nav-link.active { background: ${PURPLE_LIGHT} !important; color: ${PURPLE} !important; font-weight: 700 !important; }
  .stat-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
  .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(124,58,237,0.13) !important; }
  .row-hover:hover { background: #f9f7ff !important; }
  .btn { transition: all 0.15s ease; cursor: pointer; }
  .btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn-primary { background: ${PURPLE}; color: #fff; border: none; border-radius: 10px; font-weight: 700; padding: 10px 20px; font-size: 13px; }
  .btn-danger { background: #fee2e2; color: ${RED}; border: none; border-radius: 8px; font-weight: 600; padding: 6px 12px; font-size: 12px; }
  .btn-success { background: #dcfce7; color: #16a34a; border: none; border-radius: 8px; font-weight: 600; padding: 6px 12px; font-size: 12px; }
  .chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .skeleton { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 600px 100%; animation: shimmer 1.5s ease infinite; border-radius: 8px; }
  .search-input:focus { outline: none; border-color: ${PURPLE} !important; }
  .tab-btn { transition: all 0.15s; cursor: pointer; }
  .tab-btn.active { background: ${PURPLE} !important; color: #fff !important; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 4px; }
`;

/* ─── Mini Bar Chart ─────────────────────────────────────────────── */
const BarChart = ({ data = [] }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: d.count > 0 ? PURPLE : "#cbd5e1" }}>{d.count || ""}</span>
          <div style={{ width: "100%", borderRadius: "4px 4px 0 0", height: `${Math.max((d.count / max) * 80, d.count > 0 ? 6 : 2)}px`, background: d.count > 0 ? `linear-gradient(180deg,${PURPLE},${PURPLE_DARK})` : "#e2e8f0", transition: "height 0.6s ease" }} />
          <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Donut Chart ────────────────────────────────────────────────── */
const DonutChart = ({ data = [], total }) => {
  const colors = [PURPLE, BLUE, GREEN, AMBER, RED, "#f97316", "#06b6d4"];
  const radius = 52, cx = 64, cy = 64, strokeW = 18;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const sum = data.reduce((a, b) => a + (b.count || 0), 0) || 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
          {data.map((d, i) => {
            const pct = (d.count || 0) / sum;
            const dash = pct * circ;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
                stroke={colors[i % colors.length]} strokeWidth={strokeW}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset * circ}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            );
            offset += pct;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{total ?? sum}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Total</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.slice(0, 5).map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i % colors.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#374151" }}>{d.label?.slice(0, 22)}{d.label?.length > 22 ? "…" : ""}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Status Chip ────────────────────────────────────────────────── */
const StatusChip = ({ status }) => {
  const map = {
    pending: { bg: "#fef3c7", color: AMBER, label: "Pending" },
    active: { bg: "#dbeafe", color: BLUE, label: "Active" },
    completed: { bg: "#dcfce7", color: "#16a34a", label: "Completed" },
    rejected: { bg: "#fee2e2", color: RED, label: "Rejected" },
  };
  const c = map[status] || { bg: "#f1f5f9", color: "#64748b", label: status };
  return <span className="chip" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
};

/* ─── Main Component ─────────────────────────────────────────────── */
export default function AdminDashboard({ user, setUser, darkMode, setDarkMode }) {
  const { toasts, addToast } = useToast();

  const [page, setPage] = useState("overview");
  const [stats, setStats] = useState({});
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState("");
  const [doubtsFilter, setDoubtsFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  // Announcement
  const [announcement, setAnnouncement] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Settings
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetRole, setResetRole] = useState("student");
  const [bulkRole, setBulkRole] = useState("student");
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkPass, setShowBulkPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const headers = { authorization: `Bearer ${user.token}` };

  useEffect(() => { fetchStats(); fetchAnnouncements(); fetchDoubts(); }, []);
  useEffect(() => {
    if (page === "faculty") fetchFaculty();
    if (page === "students") fetchStudents();
  }, [page]);

  const fetchStats = async () => { try { const r = await fetch(`${API}/admin/stats`, { headers }); setStats(await r.json()); } catch {} };
  const fetchFaculty = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/faculty`, { headers }); const d = await r.json(); setFaculty(d.faculty || []); } catch {} setLoading(false); };
  const fetchStudents = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/students`, { headers }); const d = await r.json(); setStudents(d.students || []); } catch {} setLoading(false); };
  const fetchDoubts = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/doubts`, { headers }); const d = await r.json(); setDoubts(d.doubts || []); } catch {} setLoading(false); };
  const fetchAnnouncements = async () => { try { const r = await fetch(`${API}/admin/announcements`, { headers }); const d = await r.json(); setAnnouncements(d.announcements || []); } catch {} };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) return addToast("Fill all fields!", "warning");
    try {
      const r = await fetch(`${API}/admin/reset-password`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ email: resetEmail, new_password: resetPassword, role: resetRole }) });
      const d = await r.json();
      addToast(d.message || "Password reset!", "success");
      setResetEmail(""); setResetPassword("");
    } catch { addToast("Failed!", "error"); }
  };

  const handleBulkReset = async () => {
    if (!bulkPassword || bulkPassword.length < 4) return addToast("Enter valid password (min 4 chars)!", "warning");
    if (!window.confirm(`Reset ALL ${bulkRole} passwords to "${bulkPassword}"? This cannot be undone!`)) return;
    setBulkLoading(true);
    try {
      const r = await fetch(`${API}/admin/bulk-reset-password`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ role: bulkRole, new_password: bulkPassword }) });
      const d = await r.json();
      addToast(d.message || `All ${bulkRole} passwords reset!`, "success");
      setBulkPassword("");
    } catch { addToast("Bulk reset failed!", "error"); }
    setBulkLoading(false);
  };

  const handleDeleteDoubt = async (id) => {
    if (!window.confirm("Delete this doubt?")) return;
    await fetch(`${API}/admin/doubt/${id}`, { method: "DELETE", headers });
    fetchDoubts(); addToast("Deleted!", "success");
  };

  const handleForceComplete = async (id) => {
    await fetch(`${API}/admin/complete-doubt/${id}`, { method: "PUT", headers });
    fetchDoubts(); addToast("Marked complete!", "success");
  };

  const handleAnnouncement = async () => {
    if (!announcement.trim()) return addToast("Type a message!", "warning");
    try {
      const r = await fetch(`${API}/admin/announcement`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: announcement, target: announcementTarget }) });
      const d = await r.json();
      addToast(d.message || "Sent!", "success");
      setAnnouncement(""); fetchAnnouncements();
    } catch { addToast("Failed to send!", "error"); }
  };

  const handleAIAnnouncement = async () => {
    if (!aiPrompt.trim()) return addToast("Enter a prompt!", "warning");
    setAiLoading(true);
    try {
      const r = await fetch(`${API}/admin/generate-announcement`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const d = await r.json();
      if (d.announcement) { setAnnouncement(d.announcement); addToast("AI generated! Review and send.", "success"); }
      else addToast("AI failed. Try again!", "error");
    } catch { addToast("AI generation failed! Check backend.", "error"); }
    setAiLoading(false);
  };

  // Chart data
  const getWeeklyData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ label, count: doubts.filter(dbt => dbt.created_at?.slice(0, 10) === dateStr).length });
    }
    return days;
  };

  const getSubjectData = () => {
    const map = {};
    doubts.forEach(d => { if (d.subject) map[d.subject] = (map[d.subject] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));
  };

  const filteredDoubts = doubts
    .filter(d => doubtsFilter === "all" || d.status === doubtsFilter)
    .filter(d => d.topic?.toLowerCase().includes(search.toLowerCase()) || d.student_name?.toLowerCase().includes(search.toLowerCase()));

  const navItems = [
    { id: "overview", icon: "⊞", label: "Dashboard" },
    { id: "doubts", icon: "📋", label: "Doubts" },
    { id: "faculty", icon: "👨‍🏫", label: "Faculty" },
    { id: "students", icon: "🎓", label: "Students" },
    { id: "announcements", icon: "📢", label: "Announcements" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  const recentActivity = doubts.slice(0, 8).map(d => ({
    icon: d.status === "completed" ? "✅" : d.status === "active" ? "🔵" : d.status === "rejected" ? "❌" : "⏳",
    bg: d.status === "completed" ? "#dcfce7" : d.status === "active" ? "#dbeafe" : d.status === "rejected" ? "#fee2e2" : "#fef3c7",
    text: `${d.student_name} submitted "${d.topic}"`,
    time: d.created_at ? new Date(d.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
    status: d.status,
  }));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8f7ff", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ToastContainer toasts={toasts} />

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <div style={{ width: 230, minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", padding: "24px 16px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, boxShadow: "2px 0 16px rgba(0,0,0,0.06)", borderRight: "1px solid #f1f5f9" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, padding: "0 8px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>P</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e", letterSpacing: -0.3 }}>PuchoKIET</div>
            <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, letterSpacing: 0.5 }}>ADMIN</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, padding: "0 10px", marginBottom: 6 }}>MAIN MENU</div>
          {navItems.map(item => (
            <div key={item.id} className={`nav-link${page === item.id ? " active" : ""}`} onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", color: page === item.id ? PURPLE : "#64748b", fontWeight: page === item.id ? 700 : 500, fontSize: 13 }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.id === "doubts" && doubts.filter(d => d.status === "pending").length > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 6px" }}>{doubts.filter(d => d.status === "pending").length}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f8f7ff", marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>A</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>Admin</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>Full Access</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: "8px", background: "#f1f5f9", border: "none", borderRadius: 8, fontSize: 14 }}>{darkMode ? "☀️" : "🌙"}</button>
            <button className="btn" onClick={() => setUser(null)} style={{ flex: 2, padding: "8px", background: "#fee2e2", border: "none", borderRadius: 8, color: RED, fontSize: 12, fontWeight: 700 }}>Logout</button>
          </div>
        </div>
      </div>

      {/* ── Main Area ─────────────────────────────────────────────── */}
      <div style={{ marginLeft: 230, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Top Bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 99, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
            <input className="search-input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search students, faculty, doubts..."
              style={{ width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#f8f7ff", color: "#1a1a2e" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f8f7ff", border: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16 }}>🔔</div>
              {doubts.filter(d => d.status === "pending").length > 0 && (
                <div style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: "50%", background: RED, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{doubts.filter(d => d.status === "pending").length}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: "#f8f7ff", borderRadius: 10, border: "1.5px solid #e2e8f0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>A</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>Admin</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>KIET</div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: "28px", flex: 1 }}>

          {/* ── OVERVIEW ─────────────────────────────────────── */}
          {page === "overview" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>Dashboard</h1>
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
              </div>

              {/* Stats Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Total Students", value: stats.total_students, icon: "🎓", color: PURPLE, bg: PURPLE_LIGHT, trend: "+12.4%", up: true, action: () => setPage("students") },
                  { label: "Total Faculty", value: stats.total_faculty, icon: "👨‍🏫", color: BLUE, bg: "#dbeafe", trend: "+2.1%", up: true, action: () => setPage("faculty") },
                  { label: "Doubts Today", value: stats.doubts_today, icon: "📋", color: AMBER, bg: "#fef3c7", trend: "+8.3%", up: true, action: () => setPage("doubts") },
                  { label: "Active Sessions", value: stats.active_sessions, icon: "🟢", color: GREEN, bg: "#dcfce7", trend: "-1.8%", up: false, action: () => setPage("doubts") },
                ].map((s, i) => (
                  <div key={i} className="stat-card" onClick={s.action} style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.up ? GREEN : RED, background: s.up ? "#dcfce7" : "#fee2e2", borderRadius: 20, padding: "2px 8px" }}>
                        {s.up ? "↑" : "↓"} {s.trend}
                      </span>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: "#1a1a2e", marginBottom: 2 }}>{s.value ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Secondary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Pending Doubts", value: stats.pending_doubts, icon: "⏳", color: AMBER, action: () => { setPage("doubts"); setDoubtsFilter("pending"); } },
                  { label: "Completed Today", value: stats.completed_today, icon: "✅", color: GREEN, action: () => { setPage("doubts"); setDoubtsFilter("completed"); } },
                  { label: "AI Grouped", value: stats.grouped_doubts, icon: "🤝", color: PURPLE, action: () => setPage("doubts") },
                ].map((s, i) => (
                  <div key={i} className="stat-card" onClick={s.action} style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 28 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value ?? "—"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14 }}>Doubts This Week</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Daily submission trends</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", background: "#f8f7ff", borderRadius: 8, padding: "4px 10px" }}>Last 7 days</span>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <BarChart data={getWeeklyData()} />
                  </div>
                </div>
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" }}>
                  <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14, marginBottom: 4 }}>Doubts by Subject</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Subject-wise distribution</div>
                  {getSubjectData().length > 0 ? <DonutChart data={getSubjectData()} total={doubts.length} /> : <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 13 }}>Loading data...</div>}
                </div>
              </div>

              {/* Bottom Row: Recent Doubts + Activity */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
                {/* Recent Doubts Table */}
                <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" }}>
                  <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14 }}>Recent Doubts</div>
                    <button className="btn" onClick={() => setPage("doubts")} style={{ background: "none", border: "none", color: PURPLE, fontSize: 12, fontWeight: 700, padding: 0 }}>See All →</button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f7ff" }}>
                        {["Student", "Topic", "Subject", "Status"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doubts.slice(0, 6).map((d, i) => (
                        <tr key={i} className="row-hover" style={{ borderTop: "1px solid #f8f7ff" }}>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{d.student_name}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>{d.topic?.slice(0, 18)}{d.topic?.length > 18 ? "…" : ""}</td>
                          <td style={{ padding: "12px 16px", fontSize: 11, color: "#64748b" }}>{d.subject?.slice(0, 15)}{d.subject?.length > 15 ? "…" : ""}</td>
                          <td style={{ padding: "12px 16px" }}><StatusChip status={d.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Recent Activity */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14 }}>Recent Activity</div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Today</span>
                  </div>
                  {announcements.length > 0 && (
                    <div style={{ background: PURPLE_LIGHT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16 }}>📢</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE }}>Latest Announcement</div>
                        <div style={{ fontSize: 11, color: PURPLE_DARK, marginTop: 2, lineHeight: 1.4 }}>{announcements[0].message?.slice(0, 60)}…</div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {recentActivity.slice(0, 5).map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{a.text}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DOUBTS ───────────────────────────────────────── */}
          {page === "doubts" && (
            <div className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div><h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>All Doubts</h2><p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{doubts.length} total doubts in system</p></div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "#fff", borderRadius: 12, padding: 6, border: "1px solid #f1f5f9", width: "fit-content" }}>
                {["all", "pending", "active", "completed", "rejected"].map(f => (
                  <button key={f} className={`tab-btn${doubtsFilter === f ? " active" : ""}`} onClick={() => setDoubtsFilter(f)}
                    style={{ padding: "7px 16px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", color: doubtsFilter === f ? "#fff" : "#64748b", textTransform: "capitalize" }}>
                    {f} {f !== "all" && <span style={{ marginLeft: 4, fontSize: 10 }}>({doubts.filter(d => d.status === f).length})</span>}
                  </button>
                ))}
              </div>

              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by topic or student name..."
                style={{ width: "100%", padding: "11px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 16, background: "#fff", color: "#1a1a2e" }} />

              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8f7ff" }}>
                      {["Student", "Topic", "Subject", "Faculty", "Date", "Status", "Actions"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? [1,2,3,4].map(i => (
                      <tr key={i}><td colSpan={7} style={{ padding: 16 }}><div className="skeleton" style={{ height: 14, width: "100%" }} /></td></tr>
                    )) : filteredDoubts.slice(0, 20).map((d, i) => (
                      <tr key={i} className="row-hover" style={{ borderTop: "1px solid #f8f7ff" }}>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{d.student_name}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>
                          {d.topic?.slice(0, 20)}{d.topic?.length > 20 ? "…" : ""}
                          {d.grouped && <span style={{ marginLeft: 6, fontSize: 9, background: PURPLE_LIGHT, color: PURPLE, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>Grouped</span>}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "#64748b" }}>{d.subject?.slice(0, 14)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "#64748b" }}>{d.faculty_name?.slice(0, 14) || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "#94a3b8" }}>{d.created_at?.slice(0, 10)}</td>
                        <td style={{ padding: "12px 16px" }}><StatusChip status={d.status} /></td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {d.status !== "completed" && <button className="btn btn-success" onClick={() => handleForceComplete(d._id)}>✓</button>}
                            <button className="btn btn-danger" onClick={() => handleDeleteDoubt(d._id)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredDoubts.length === 0 && !loading && (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    No doubts found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FACULTY ──────────────────────────────────────── */}
          {page === "faculty" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}><h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>Faculty ({faculty.length})</h2></div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search faculty..."
                style={{ width: "100%", padding: "11px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 16, background: "#fff", color: "#1a1a2e" }} />
              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f8f7ff" }}>
                    {["Name", "Code", "Subject", "Cabin", "Email", "Doubts"].map(h => (<th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {loading ? [1,2,3].map(i => (<tr key={i}><td colSpan={6} style={{ padding: 16 }}><div className="skeleton" style={{ height: 14, width: "100%" }} /></td></tr>)) :
                    faculty.filter(f => f.name?.toLowerCase().includes(search.toLowerCase())).map((f, i) => (
                      <tr key={i} className="row-hover" style={{ borderTop: "1px solid #f8f7ff" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: PURPLE, flexShrink: 0 }}>{f.name?.[0]?.toUpperCase()}</div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{f.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>{f.faculty_code}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>{f.subject?.slice(0, 22)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>{f.cabin || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: PURPLE }}>{f.email}</td>
                        <td style={{ padding: "12px 16px" }}><span className="chip" style={{ background: PURPLE_LIGHT, color: PURPLE }}>{f.doubt_count}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STUDENTS ─────────────────────────────────────── */}
          {page === "students" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}><h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>Students ({students.length})</h2></div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search students..."
                style={{ width: "100%", padding: "11px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 16, background: "#fff", color: "#1a1a2e" }} />
              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f8f7ff" }}>
                    {["Name", "Roll No", "Branch", "Semester", "Email", "Doubts"].map(h => (<th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {loading ? [1,2,3].map(i => (<tr key={i}><td colSpan={6} style={{ padding: 16 }}><div className="skeleton" style={{ height: 14, width: "100%" }} /></td></tr>)) :
                    students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll_no?.includes(search)).map((s, i) => (
                      <tr key={i} className="row-hover" style={{ borderTop: "1px solid #f8f7ff" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: BLUE, flexShrink: 0 }}>{s.name?.[0]?.toUpperCase()}</div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>{s.roll_no}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>{s.branch}</td>
                        <td style={{ padding: "12px 16px" }}><span className="chip" style={{ background: "#f1f5f9", color: "#374151" }}>Sem {s.semester}</span></td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: PURPLE }}>{s.email}</td>
                        <td style={{ padding: "12px 16px" }}><span className="chip" style={{ background: "#dbeafe", color: BLUE }}>{s.doubt_count}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ANNOUNCEMENTS ────────────────────────────────── */}
          {page === "announcements" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}><h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>📢 Announcements</h2><p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Send messages to students and faculty</p></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Compose */}
                <div>
                  <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 16, fontSize: 15 }}>Compose Announcement</div>
                    {/* AI Section */}
                    <div style={{ background: PURPLE_LIGHT, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid #ddd6fe` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 18 }}>🤖</span>
                        <div><div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>AI Generator</div><div style={{ fontSize: 11, color: "#64748b" }}>Describe in plain words → AI writes professionally</div></div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAIAnnouncement()}
                          placeholder='e.g. "MSE starts 9th March"'
                          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #ddd6fe", fontSize: 12, outline: "none", background: "#fff", color: "#1a1a2e" }} />
                        <button className="btn btn-primary" onClick={handleAIAnnouncement} disabled={aiLoading || !aiPrompt.trim()}
                          style={{ padding: "9px 14px", fontSize: 12, opacity: (aiLoading || !aiPrompt.trim()) ? 0.6 : 1, whiteSpace: "nowrap" }}>
                          {aiLoading ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />...</span> : "✨ Generate"}
                        </button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {["MSE exam reminder", "Library closed", "Holiday notice", "Fee deadline", "Sports day"].map(t => (
                          <span key={t} onClick={() => setAiPrompt(t)} style={{ padding: "3px 9px", background: "#fff", color: PURPLE, borderRadius: 20, fontSize: 10, cursor: "pointer", fontWeight: 600, border: "1px solid #ddd6fe" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <select value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 12, background: "#fff", color: "#1a1a2e" }}>
                      <option value="all">Everyone</option>
                      <option value="students">Students Only</option>
                      <option value="faculty">Faculty Only</option>
                    </select>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)}
                      placeholder="Type your announcement here, or use AI generator above..."
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", minHeight: 110, resize: "vertical", boxSizing: "border-box", marginBottom: 14, background: "#fff", color: "#1a1a2e", lineHeight: 1.6 }} />
                    <button className="btn btn-primary" onClick={handleAnnouncement} style={{ width: "100%", padding: "12px 0", fontSize: 14 }}>
                      📢 Send Announcement
                    </button>
                  </div>
                </div>

                {/* History */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", maxHeight: 600, overflowY: "auto" }}>
                  <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 16, fontSize: 15 }}>History ({announcements.length})</div>
                  {announcements.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>No announcements yet</div>
                  ) : announcements.map((a, i) => (
                    <div key={i} style={{ padding: "14px 0", borderBottom: i < announcements.length - 1 ? "1px solid #f8f7ff" : "none" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span className="chip" style={{ background: PURPLE_LIGHT, color: PURPLE }}>{a.target}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{a.created_at?.slice(0, 16)?.replace("T", " ")}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{a.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ─────────────────────────────────────── */}
          {page === "settings" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}><h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>⚙️ Settings</h2><p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Manage system passwords and configurations</p></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 860 }}>
                {/* Individual Reset */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔐</div>
                    <div><div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>Reset Password</div><div style={{ fontSize: 12, color: "#64748b" }}>Reset a single user's password</div></div>
                  </div>
                  <select value={resetRole} onChange={e => setResetRole(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 12, background: "#fff", color: "#1a1a2e" }}>
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                  <input placeholder="Email address" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 12, background: "#fff", color: "#1a1a2e" }} />
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <input placeholder="New password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} type={showPass ? "text" : "password"}
                      style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#fff", color: "#1a1a2e" }} />
                    <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</button>
                  </div>
                  <button className="btn btn-primary" onClick={handleResetPassword} style={{ width: "100%", padding: "12px 0", fontSize: 14 }}>Reset Password</button>
                </div>

                {/* Bulk Reset */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #fecaca", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚠️</div>
                    <div><div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>Bulk Reset</div><div style={{ fontSize: 12, color: RED }}>Resets ALL users of selected role</div></div>
                  </div>
                  <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#991b1b", fontWeight: 500, lineHeight: 1.5 }}>
                    ⚠️ This will reset passwords for <b>ALL {bulkRole}s</b>. This action cannot be undone. Use with extreme caution!
                  </div>
                  <select value={bulkRole} onChange={e => setBulkRole(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #fecaca", fontSize: 13, outline: "none", marginBottom: 12, background: "#fff", color: "#1a1a2e" }}>
                    <option value="student">All Students</option>
                    <option value="faculty">All Faculty</option>
                  </select>
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <input placeholder="New password for all" value={bulkPassword} onChange={e => setBulkPassword(e.target.value)} type={showBulkPass ? "text" : "password"}
                      style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10, border: "1.5px solid #fecaca", fontSize: 13, outline: "none", background: "#fff", color: "#1a1a2e" }} />
                    <button onClick={() => setShowBulkPass(!showBulkPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}>{showBulkPass ? "🙈" : "👁️"}</button>
                  </div>
                  <button onClick={handleBulkReset} disabled={bulkLoading || !bulkPassword}
                    style={{ width: "100%", padding: "12px 0", background: (bulkLoading || !bulkPassword) ? "#f1f5f9" : "linear-gradient(135deg,#ef4444,#dc2626)", color: (bulkLoading || !bulkPassword) ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: (bulkLoading || !bulkPassword) ? "not-allowed" : "pointer", fontSize: 14 }}>
                    {bulkLoading ? "Resetting..." : "🗝 Bulk Reset All"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}