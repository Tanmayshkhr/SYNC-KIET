import { useState, useEffect } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

export default function FacultyDashboard({ user, setUser }) {
  const [queue, setQueue] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");

  const sendNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let t;
    if (activeSession) {
      t = setInterval(() => {
        setTimer(s => {
          // Auto complete after 30 minutes
          if (s >= 1800) {
            completeSession();
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(t);
  }, [activeSession]);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API}/doubts/faculty-queue`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      const newQueue = data.queue || [];

      // Notify faculty of new students
      if (newQueue.length > queue.length) {
        const newStudent = newQueue[newQueue.length - 1];
        sendNotification("New Doubt Request", `${newStudent.student_name} - ${newStudent.topic}`);
      }

      // Notify of urgent/priority students
      const urgentCount = newQueue.filter(d => d.priority === "urgent").length;
      if (urgentCount > 0 && !activeSession) {
        sendNotification("Priority Students Waiting", `${urgentCount} student(s) need priority attention!`);
      }

      setQueue(newQueue);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const acceptDoubt = async (doubt) => {
    try {
      await fetch(`${API}/doubts/accept/${doubt._id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${user.token}` }
      });
      setActiveSession(doubt);
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    try {
      await fetch(`${API}/doubts/complete/${activeSession._id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${user.token}` }
      });
      setActiveSession(null);
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

const rejectDoubt = async (doubt) => {
    try {
      const res = await fetch(`${API}/doubts/reject/${doubt._id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      console.log("Reject response:", data);
      setActiveSession(null);
      setTimeout(() => fetchQueue(), 500);
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const logout = () => { localStorage.clear(); setUser(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>SYNC-KIET</span>
          <span style={{ fontSize: 11, padding: "3px 10px", background: "#eff6ff", color: BLUE, borderRadius: 10, fontWeight: 700 }}>FACULTY</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Dashboard", "dashboard"], ["Timetable", "timetable"]].map(([label, p]) => (
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
        {page === "dashboard" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                ["Queue", queue.length, "#f59e0b"],
                ["Active Session", activeSession ? "1" : "0", BLUE],
                ["Session Time", activeSession ? fmt(timer) : "--", "#10b981"],
                ["Status", activeSession ? "Busy" : "Available", activeSession ? "#ef4444" : "#10b981"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Active Session */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 16 }}>Active Session</div>
                {activeSession ? (
                  <>
                    <div style={{ background: "#f0f4f8", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{activeSession.student_name}</div>
                      <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>{activeSession.topic}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{activeSession.subject}</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>{activeSession.description}</div>
                    </div>
                    <div style={{ textAlign: "center", fontSize: 32, fontWeight: 800, color: timer > 1500 ? "#ef4444" : BLUE, marginBottom: 16, fontFamily: "monospace" }}>
                      {fmt(timer)}
                      {timer > 1500 && (
                        <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 400, marginTop: 4 }}>
                          Auto-completing in {fmt(1800 - timer)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={completeSession}
                        style={{ flex: 1, padding: "12px 0", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        Complete
                      </button>
                      <button onClick={() => rejectDoubt(activeSession)}
                        style={{ padding: "12px 16px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        Reject
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                    No active session. Accept a doubt from the queue.
                  </div>
                )}
              </div>

              {/* Queue */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 16 }}>
                  Student Queue ({queue.length})
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Loading...</div>
                ) : queue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>No students in queue</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                    {queue.map((d, i) => (
                      <div key={d._id} style={{
  border: d.priority === "urgent" ? "2px solid #ef4444" : "1px solid #e0e0e0",
  background: d.priority === "urgent" ? "#fff5f5" : "#fff",
  borderRadius: 10, padding: 14
}}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <div style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 14 }}>
    #{i + 1} {d.student_name}
  </div>
  {d.priority === "urgent" && (
    <span style={{ fontSize: 10, padding: "2px 8px", background: "#fee2e2", color: "#ef4444", borderRadius: 10, fontWeight: 700 }}>
      URGENT
    </span>
  )}
                            </div>
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{d.topic}</div>
                            <div style={{ fontSize: 11, color: "#888" }}>{d.subject}</div>
                          </div>
                        </div>
                        {!activeSession && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => acceptDoubt(d)}
                              style={{ flex: 1, padding: "8px 0", background: d.priority === "urgent" ? "#ef4444" : BLUE, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                              {d.priority === "urgent" ? "Accept (Priority)" : "Accept"}
                            </button>
                            <button onClick={() => rejectDoubt(d)}
                              style={{ padding: "8px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {page === "timetable" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Today's Timetable</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {["9:10", "10:00", "10:50", "11:40", "Lunch", "2:20", "3:10", "4:00"].map((time, i) => (
                <div key={i} style={{ background: "#f0f4f8", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{time}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>
                    {i === 4 ? "Lunch" : "Free"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}