import { useState, useEffect } from "react";
import SubmitDoubt from "./SubmitDoubt";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

export default function StudentDashboard({ user, setUser }) {
  const [page, setPage] = useState("home");
  const [faculty, setFaculty] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [myDoubts, setMyDoubts] = useState([]);
  const [loading, setLoading] = useState(true);

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
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>SYNC-KIET</span>
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

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Loading faculty...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {faculty.map((f, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: f.status === "available" ? `2px solid ${BLUE}` : "2px solid transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>{f.faculty_name}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{f.subject}</div>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
                      {f.message}
                    </div>
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
                  <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{d.topic}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                      <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{d.description?.slice(0, 60)}...</div>
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
                ["Total Doubts", myDoubts.length, BLUE],
                ["Pending", myDoubts.filter(d => d.status === "pending").length, "#f59e0b"],
                ["Completed", myDoubts.filter(d => d.status === "completed").length, "#10b981"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
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

function StatusBadge({ status }) {
  const map = {
    available: { color: "#10b981", bg: "#d1fae5", label: "Available" },
    busy: { color: "#ef4444", bg: "#fee2e2", label: "Busy" },
    free_soon: { color: "#f59e0b", bg: "#fef3c7", label: "Free Soon" },
    lunch: { color: "#f59e0b", bg: "#fef3c7", label: "Lunch Break" },
    not_arrived: { color: "#6b7280", bg: "#f3f4f6", label: "Not Arrived" },
    left: { color: "#6b7280", bg: "#f3f4f6", label: "Left" },
    pending: { color: "#f59e0b", bg: "#fef3c7", label: "Pending" },
    active: { color: "#10b981", bg: "#d1fae5", label: "Active" },
    completed: { color: "#6b7280", bg: "#f3f4f6", label: "Completed" },
  };
  const s = map[status] || map.not_arrived;
  return (
    <span style={{ padding: "4px 10px", borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}