import { useState, useEffect } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

const StatCard = ({ title, value, color = BLUE, icon, cardBg, subColor }) => (
  <div style={{ background: cardBg || "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", flex: 1, minWidth: 140 }}>
    <div style={{ fontSize: 28 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
    <div style={{ fontSize: 12, color: subColor || "#888", marginTop: 4 }}>{title}</div>
  </div>
);

export default function AdminDashboard({ user, setUser, darkMode, setDarkMode }) {
  const bg = darkMode ? "#0f172a" : "#f0f4f8";
  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";
  const borderColor = darkMode ? "#334155" : "#e0e0e0";
  const navBg = darkMode ? "#1e293b" : "#fff";

  const [page, setPage] = useState("overview");
  const [stats, setStats] = useState({});
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetRole, setResetRole] = useState("student");

  const headers = { authorization: `Bearer ${user.token}` };

  useEffect(() => {
    fetchStats();
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (page === "faculty") fetchFaculty();
    if (page === "students") fetchStudents();
    if (page === "doubts") fetchDoubts();
  }, [page]);

  const fetchStats = async () => {
    const res = await fetch(`${API}/admin/stats`, { headers });
    const data = await res.json();
    setStats(data);
  };

  const fetchFaculty = async () => {
    setLoading(true);
    const res = await fetch(`${API}/admin/faculty`, { headers });
    const data = await res.json();
    setFaculty(data.faculty || []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    setLoading(true);
    const res = await fetch(`${API}/admin/students`, { headers });
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  };

  const fetchDoubts = async () => {
    setLoading(true);
    const res = await fetch(`${API}/admin/doubts`, { headers });
    const data = await res.json();
    setDoubts(data.doubts || []);
    setLoading(false);
  };

  const fetchAnnouncements = async () => {
    const res = await fetch(`${API}/admin/announcements`, { headers });
    const data = await res.json();
    setAnnouncements(data.announcements || []);
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) return alert("Fill all fields!");
    const res = await fetch(`${API}/admin/reset-password`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail, new_password: resetPassword, role: resetRole })
    });
    const data = await res.json();
    alert(data.message || "Done!");
    setResetEmail(""); setResetPassword("");
  };

  const handleDeleteDoubt = async (id) => {
    if (!window.confirm("Delete this doubt?")) return;
    await fetch(`${API}/admin/doubt/${id}`, { method: "DELETE", headers });
    fetchDoubts();
  };

  const handleForceComplete = async (id) => {
    await fetch(`${API}/admin/complete-doubt/${id}`, { method: "PUT", headers });
    fetchDoubts();
  };

  const handleAnnouncement = async () => {
    if (!announcement) return alert("Type a message!");
    const res = await fetch(`${API}/admin/announcement`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message: announcement, target: announcementTarget })
    });
    const data = await res.json();
    alert(data.message);
    setAnnouncement("");
    fetchAnnouncements();
  };

  const statusColor = { pending: "#f59e0b", active: "#1a73e8", completed: "#22c55e", rejected: "#ef4444" };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "Inter, sans-serif", transition: "background 0.3s" }}>
      {/* Navbar */}
      <div style={{ background: navBg, padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: BLUE, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>PuchoKIET</span>
          <span style={{ fontSize: 11, background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["overview", "faculty", "students", "doubts", "announcements", "settings"].map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: "6px 14px", background: page === p ? BLUE : "transparent", color: page === p ? "#fff" : subColor, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>
              {p}
            </button>
          ))}
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${borderColor}`, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setUser(null)}
            style={{ padding: "6px 14px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ padding: 32 }}>

        {/* OVERVIEW */}
        {page === "overview" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>Overview</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard title="Total Students" value={stats.total_students} icon="👨‍🎓" cardBg={cardBg} subColor={subColor} />
              <StatCard title="Total Faculty" value={stats.total_faculty} icon="👨‍🏫" cardBg={cardBg} subColor={subColor} />
              <StatCard title="Doubts Today" value={stats.doubts_today} icon="📋" color="#f59e0b" cardBg={cardBg} subColor={subColor} />
              <StatCard title="Active Sessions" value={stats.active_sessions} icon="🟢" color="#22c55e" cardBg={cardBg} subColor={subColor} />
              <StatCard title="Pending Doubts" value={stats.pending_doubts} icon="⏳" color="#f59e0b" cardBg={cardBg} subColor={subColor} />
              <StatCard title="Completed Today" value={stats.completed_today} icon="✅" color="#22c55e" cardBg={cardBg} subColor={subColor} />
              <StatCard title="AI Grouped" value={stats.grouped_doubts} icon="🤝" color="#8b5cf6" cardBg={cardBg} subColor={subColor} />
            </div>

            {/* Recent Announcements */}
            <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: textColor }}>📢 Recent Announcements</div>
              {announcements.length === 0 ? (
                <div style={{ color: "#888", fontSize: 13 }}>No announcements yet</div>
              ) : announcements.map((a, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <span style={{ fontSize: 10, background: "#eff6ff", color: BLUE, borderRadius: 4, padding: "2px 6px", marginRight: 8 }}>{a.target}</span>
                  {a.message}
                  <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>{a.created_at?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FACULTY */}
        {page === "faculty" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>Faculty ({faculty.length})</h2>
            <input placeholder="🔍 Search faculty..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box", background: cardBg, color: textColor }} />
            <div style={{ background: cardBg, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: darkMode ? "#334155" : "#f8f9fa" }}>
                    {["Name", "Code", "Subject", "Cabin", "Email", "Doubts"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: subColor }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {faculty.filter(f => f.name?.toLowerCase().includes(search.toLowerCase())).map((f, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${darkMode ? "#334155" : "#f0f0f0"}` }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: textColor }}>{f.name}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{f.faculty_code}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{f.subject}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{f.cabin || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: BLUE }}>{f.email}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: textColor }}>{f.doubt_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* STUDENTS */}
        {page === "students" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>Students ({students.length})</h2>
            <input placeholder="🔍 Search students..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box", background: cardBg, color: textColor }} />
            <div style={{ background: cardBg, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: darkMode ? "#334155" : "#f8f9fa" }}>
                    {["Name", "Roll No", "Branch", "Semester", "Email", "Doubts"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: subColor }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll_no?.includes(search)).map((s, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${darkMode ? "#334155" : "#f0f0f0"}` }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: textColor }}>{s.name}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{s.roll_no}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{s.branch}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: subColor }}>{s.semester}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: BLUE }}>{s.email}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: textColor }}>{s.doubt_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DOUBTS */}
        {page === "doubts" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>All Doubts ({doubts.length})</h2>
            <input placeholder="🔍 Search doubts..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box", background: cardBg, color: textColor }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {doubts.filter(d => d.topic?.toLowerCase().includes(search.toLowerCase()) || d.student_name?.toLowerCase().includes(search.toLowerCase())).map((d, i) => (
                <div key={i} style={{ background: cardBg, borderRadius: 10, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: textColor }}>{d.student_name} → {d.topic}</div>
                    <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                    {d.grouped && <span style={{ fontSize: 10, background: "#ede9fe", color: "#8b5cf6", borderRadius: 4, padding: "2px 6px", marginTop: 4, display: "inline-block" }}>🤝 Grouped</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "4px 10px", background: statusColor[d.status] + "22", color: statusColor[d.status], borderRadius: 6, fontWeight: 700 }}>
                      {d.status}
                    </span>
                    {d.status !== "completed" && (
                      <button onClick={() => handleForceComplete(d._id)}
                        style={{ padding: "6px 12px", background: "#dcfce7", color: "#16a34a", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✓ Complete
                      </button>
                    )}
                    <button onClick={() => handleDeleteDoubt(d._id)}
                      style={{ padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ANNOUNCEMENTS */}
        {page === "announcements" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>📢 Announcements</h2>
            <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: textColor }}>Send New Announcement</div>
              <select value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", marginBottom: 12, background: cardBg, color: textColor }}>
                <option value="all">Everyone</option>
                <option value="students">Students Only</option>
                <option value="faculty">Faculty Only</option>
              </select>
              <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)}
                placeholder="Type announcement message..."
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", minHeight: 100, resize: "vertical", boxSizing: "border-box", marginBottom: 12, background: cardBg, color: textColor }} />
              <button onClick={handleAnnouncement}
                style={{ padding: "12px 24px", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Send Announcement
              </button>
            </div>
            <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: textColor }}>Past Announcements</div>
              {announcements.map((a, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${darkMode ? "#334155" : "#f0f0f0"}` }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, background: "#eff6ff", color: BLUE, borderRadius: 4, padding: "2px 6px" }}>{a.target}</span>
                    <span style={{ fontSize: 11, color: "#888" }}>{a.created_at?.slice(0, 16)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: textColor }}>{a.message}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <>
            <h2 style={{ margin: "0 0 24px", fontWeight: 800, color: textColor }}>⚙️ Settings</h2>
            <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", maxWidth: 500 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: textColor }}>Reset User Password</div>
              <select value={resetRole} onChange={e => setResetRole(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", marginBottom: 12, background: cardBg, color: textColor }}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
              <input placeholder="Email address" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box", background: cardBg, color: textColor }} />
              <input placeholder="New password" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", marginBottom: 16, boxSizing: "border-box", background: cardBg, color: textColor }} />
              <button onClick={handleResetPassword}
                style={{ width: "100%", padding: "12px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Reset Password
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}