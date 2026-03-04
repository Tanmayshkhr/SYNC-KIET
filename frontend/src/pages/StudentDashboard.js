import { useState, useEffect } from "react";
import SubmitDoubt from "./SubmitDoubt";

const styles = `
  @keyframes pulseRing {
    0% { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes skeleton {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .faculty-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
  }
  .faculty-card:hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 32px rgba(26,115,232,0.15) !important;
  }
  .skeleton-box {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 400px 100%;
    animation: skeleton 1.4s ease infinite;
    border-radius: 8px;
  }
`;

const StyleInjector = () => (
  <style dangerouslySetInnerHTML={{ __html: styles }} />
);

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

export default function StudentDashboard({ user, setUser }) {
  const [page, setPage] = useState("home");
  const [faculty, setFaculty] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [myDoubts, setMyDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const filteredFaculty = faculty
    .filter(f => f.faculty_name?.toLowerCase().includes(search.toLowerCase()))
    .filter(f => subjectFilter ? f.subject === subjectFilter : true)
    .filter(f => availFilter ? f.status === availFilter : true)
    .sort((a, b) => {
      if (sortBy === "available") {
        const order = { available: 0, lunch: 1, busy: 2, not_arrived: 3, left: 4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      }
      if (sortBy === "name") return a.faculty_name?.localeCompare(b.faculty_name);
      if (sortBy === "queue") return (a.queue_count || 0) - (b.queue_count || 0);
      return 0;
    });

  useEffect(() => {
    requestNotificationPermission();
    fetchFaculty();
    fetchMyDoubts();
    const interval = setInterval(() => {
      fetchMyDoubts();
      fetchFaculty();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const sendNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    }
  };

  const fetchFaculty = async () => {
    try {
      const res = await fetch(`${API}/timetable/all-faculty-status`);
      const data = await res.json();
      setFaculty(data.faculty || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchMyDoubts = async () => {
    try {
      const res = await fetch(`${API}/doubts/my-doubts`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      const newDoubts = data.doubts || [];

      // Check for status changes and notify
      newDoubts.forEach(newDoubt => {
        const oldDoubt = myDoubts.find(d => d._id === newDoubt._id);
        if (oldDoubt && oldDoubt.status !== newDoubt.status) {
          if (newDoubt.status === "active") {
            sendNotification("Your turn!", `${newDoubt.topic} session started. Please come to the cabin!`);
          } else if (newDoubt.status === "completed") {
            sendNotification("Session Complete", `Your doubt on ${newDoubt.topic} has been resolved.`);
          } else if (newDoubt.status === "pending" && oldDoubt.status === "active") {
            sendNotification("Session Rejected", `You've been re-queued as priority for ${newDoubt.topic}`);
          }
        }
      });

      setMyDoubts(newDoubts);
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => { localStorage.clear(); setUser(null); };

  if (page === "submit") return (
    <SubmitDoubt
      user={user}
      faculty={selectedFaculty}
      onBack={() => setPage("home")}
      onSubmitted={() => { setPage("mydoubts"); fetchMyDoubts(); }}
    />
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>
      <StyleInjector />
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>PuchoKIET</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Home", "home"], ["My Doubts", "mydoubts"], ["Analytics", "analytics"]].map(([label, p]) => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: page === p ? BLUE : "none", color: page === p ? "#fff" : "#666", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>{user.name}</span>
          <button onClick={logout} style={{ padding: "8px 16px", border: "1px solid #e0e0e0", borderRadius: 8, background: "none", color: "#666", cursor: "pointer", fontSize: 13 }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
        {/* HOME PAGE */}
        {page === "home" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Find Faculty</h2>
              <p style={{ color: "#666", marginTop: 4 }}>Live availability · AI-powered queue · Smart grouping</p>
            </div>

            {/* Search and Filters */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <input
                placeholder="🔍 Search faculty by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
              />

              {/* Subject Filter */}
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", color: "#444" }}>
                <option value="">All Subjects</option>
                {[...new Set(faculty.map(f => f.subject))].sort().map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              {/* Availability Filter */}
              <select value={availFilter} onChange={e => setAvailFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", color: "#444" }}>
                <option value="">All Status</option>
                <option value="available">Available Now</option>
                <option value="busy">In Class</option>
                <option value="lunch">Lunch Break</option>
                <option value="not_arrived">Not Arrived</option>
                <option value="left">Left</option>
              </select>

              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", color: "#444" }}>
                <option value="default">Sort: Default</option>
                <option value="available">Available First</option>
                <option value="name">Name A-Z</option>
                <option value="queue">Least Queue</option>
              </select>

              {/* Results count */}
              <div style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                {filteredFaculty.length} faculty found
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Loading faculty...</div>
            ) : filteredFaculty.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#666" }}>
                No faculty found matching your filters
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {filteredFaculty.map((f, i) => (
                  <div key={i} className="faculty-card" style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: f.status === "available" ? `2px solid ${BLUE}` : "2px solid transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>{f.faculty_name}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{f.subject}</div>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{f.message}</div>
                    {f.cabin && (
                      <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>
                        📍 Cabin {f.cabin} · {f.block}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: BLUE, marginBottom: 8 }}>
                      ✉️ {f.email}
                    </div>
                    {f.queue_count > 0 && (
                      <div style={{ fontSize: 11, color: "#f59e0b", background: "#fef3c7", borderRadius: 6, padding: "4px 10px", marginBottom: 8, display: "inline-block" }}>
                        👥 {f.queue_count} student{f.queue_count > 1 ? "s" : ""} in queue
                      </div>
                    )}
                    {f.free_slots_today?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#444", background: "#f0f4f8", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
                        Next free: <b>{f.free_slots_today[0]?.start}</b>
                      </div>
                    )}
                    <button
                      onClick={() => { setSelectedFaculty(f); setPage("submit"); }}
                      style={{ width: "100%", padding: "10px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                      Submit Doubt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* MY DOUBTS PAGE */}
        {page === "mydoubts" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>My Doubts</h2>
              <p style={{ color: "#666", marginTop: 4 }}>Track your doubt sessions and queue position</p>
            </div>
            {myDoubts.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#666" }}>
                No doubts submitted yet. Go to Home to submit your first doubt!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myDoubts.map((d, i) => (
                  <div key={i} className="faculty-card" style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{d.topic}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                      <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{d.description?.slice(0, 60)}...</div>
                      {d.faculty_message && (
                        <div style={{ marginTop: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#1a73e8", marginBottom: 4 }}>💬 Message from Faculty</div>
                          <div style={{ fontSize: 13, color: "#1e40af" }}>{d.faculty_message}</div>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ANALYTICS PAGE */}
        {page === "analytics" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Analytics</h2>
              <p style={{ color: "#666", marginTop: 4 }}>Best times to visit faculty · Topic trends</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                ["All Time Doubts", myDoubts.length, BLUE],
                ["Pending", myDoubts.filter(d => d.status === "pending").length, "#f59e0b"],
                ["Completed", myDoubts.filter(d => d.status === "completed").length, "#10b981"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, flex: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, color: "#888" }}>Active</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1a73e8" }}>
                  {myDoubts.filter(d => d.status === "active").length}
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, flex: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, color: "#888" }}>Rejected</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>
                  {myDoubts.filter(d => d.status === "rejected").length}
                </div>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Best Time to Visit Faculty</div>
              {["9:10 AM", "11:40 AM", "2:20 PM"].map((time, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 80, fontSize: 13, color: "#444" }}>{time}</div>
                  <div style={{ flex: 1, height: 8, background: "#f0f4f8", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${[85, 60, 75][i]}%`, background: BLUE, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>{["High", "Medium", "High"][i]}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const config = {
    available: { label: "Available", color: "#22c55e", bg: "#dcfce7" },
    busy: { label: "In Class", color: "#1a73e8", bg: "#eff6ff" },
    lunch: { label: "Lunch Break", color: "#f59e0b", bg: "#fef3c7" },
    not_arrived: { label: "Not Arrived", color: "#94a3b8", bg: "#f1f5f9" },
    left: { label: "Left", color: "#ef4444", bg: "#fee2e2" },
  }[status] || { label: status, color: "#94a3b8", bg: "#f1f5f9" };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 20,
      background: config.bg,
    }}>
      {status === "available" && (
        <div style={{ position: "relative", width: 10, height: 10 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: config.color, opacity: 0.4,
            animation: "pulseRing 1.5s ease-out infinite"
          }} />
          <div style={{
            position: "absolute", inset: 2, borderRadius: "50%",
            background: config.color,
          }} />
        </div>
      )}
      {status === "busy" && (
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          border: `2px solid ${config.color}`,
          borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite"
        }} />
      )}
      {status === "lunch" && (
        <span style={{ fontSize: 10, animation: "bounce 1s ease-in-out infinite" }}>🍽️</span>
      )}
      {status === "not_arrived" && <span style={{ fontSize: 10 }}>⏰</span>}
      {status === "left" && <span style={{ fontSize: 10 }}>👋</span>}
      <span style={{ fontSize: 11, fontWeight: 700, color: config.color }}>{config.label}</span>
    </div>
  );
};