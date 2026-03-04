import { useState, useEffect } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

const LiveClock = ({ textColor, subColor, cardBg }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: subColor, marginBottom: 4, fontWeight: 600 }}>LIVE TIME</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#1a73e8", fontVariantNumeric: "tabular-nums", letterSpacing: -1 }}>
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 11, color: subColor, marginTop: 4 }}>
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      </div>
    </div>
  );
};

export default function FacultyDashboard({ user, setUser, darkMode, setDarkMode }) {
  const bg = darkMode ? "#0f172a" : "#f0f4f8";
  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";
  const borderColor = darkMode ? "#334155" : "#e0e0e0";
  const navBg = darkMode ? "#1e293b" : "#fff";

  const [queue, setQueue] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [messagePopup, setMessagePopup] = useState(null);
  const [customMessage, setCustomMessage] = useState("");

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

  const acceptDoubt = async (doubt, groupDoubts = null) => {
    try {
      if (groupDoubts && groupDoubts.length > 1) {
        // Accept all doubts in the group at once
        await Promise.all(groupDoubts.map(d =>
          fetch(`${API}/doubts/accept/${d._id}`, {
            method: "PUT",
            headers: { authorization: `Bearer ${user.token}` }
          })
        ));
        setActiveSession({ ...doubt, groupDoubts, isGroup: true });
      } else {
        await fetch(`${API}/doubts/accept/${doubt._id}`, {
          method: "PUT",
          headers: { authorization: `Bearer ${user.token}` }
        });
        setActiveSession(doubt);
      }
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

  const QUICK_MESSAGES = [
    "Come in 5 minutes",
    "Come in 10 minutes",
    "Come in 15 minutes",
    "Please wait, finishing current session",
    "Your doubt needs more detail, please describe better",
    "Grouping you with others, arrive in 5 mins",
    "Group session starting in 10 minutes",
  ];

  const sendMessage = async (doubtId, message) => {
    try {
      await fetch(`${API}/doubts/send-message/${doubtId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ message })
      });
      setMessagePopup(null);
      setCustomMessage("");
      alert("Message sent to student!");
    } catch (err) {
      console.error(err);
    }
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const logout = () => { localStorage.clear(); setUser(null); };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      {/* Navbar */}
      <div style={{ background: navBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>PuchoKIET</span>
          <span style={{ fontSize: 11, padding: "3px 10px", background: "#eff6ff", color: BLUE, borderRadius: 10, fontWeight: 700 }}>FACULTY</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Dashboard", "dashboard"], ["Timetable", "timetable"], ["Stats", "stats"]].map(([label, p]) => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: page === p ? BLUE : "none", color: page === p ? "#fff" : subColor, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: subColor, fontWeight: 600 }}>{user.name}</span>
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${borderColor}`, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={logout} style={{ padding: "8px 16px", border: `1px solid ${borderColor}`, borderRadius: 8, background: "none", color: subColor, cursor: "pointer", fontSize: 13 }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
        {page === "dashboard" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                ["Queue", queue.length, "#f59e0b"],
                ["Active Session", activeSession ? "1" : "0", BLUE],
                ["Session Time", activeSession ? fmt(timer) : "--", "#10b981"],
                ["Status", activeSession ? "Busy" : "Available", activeSession ? "#ef4444" : "#10b981"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 12, color: subColor, marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
              <LiveClock textColor={textColor} subColor={subColor} cardBg={cardBg} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Active Session */}
              <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: textColor, marginBottom: 16 }}>Active Session</div>
                {activeSession ? (
                  <>
                    <div style={{ background: darkMode ? "#334155" : "#f0f4f8", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      {activeSession.isGroup ? (
                        <>
                          <div style={{ fontWeight: 700, color: BLUE, marginBottom: 6 }}>🤝 Group Session</div>
                          {activeSession.groupDoubts.map(gd => (
                            <div key={gd._id} style={{ fontSize: 13, color: "#444", background: "#eff6ff", borderRadius: 6, padding: "4px 10px", marginBottom: 4 }}>
                              👤 {gd.student_name}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontWeight: 700, color: textColor, marginBottom: 4 }}>{activeSession.student_name}</div>
                      )}
                      <div style={{ fontSize: 13, color: subColor, marginBottom: 4 }}>{activeSession.topic}</div>
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
              <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: textColor, marginBottom: 16 }}>
                  Student Queue ({queue.length})
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Loading...</div>
                ) : queue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>No students in queue</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                    {/* Group clustered doubts */}
                    {(() => {
                      const groups = {};
                      const singles = [];
                      queue.forEach(d => {
                        if (d.grouped && d.cluster_id) {
                          if (!groups[d.cluster_id]) groups[d.cluster_id] = [];
                          groups[d.cluster_id].push(d);
                        } else {
                          singles.push(d);
                        }
                      });

                      return (
                        <>
                          {/* Grouped sessions */}
                          {Object.entries(groups).map(([clusterId, groupDoubts]) => (
                            <div key={clusterId} style={{
                              border: "2px solid #1a73e8",
                              background: "#eff6ff",
                              borderRadius: 10, padding: 14, marginBottom: 10
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 16 }}>🤝</span>
                                <span style={{ fontWeight: 700, color: BLUE, fontSize: 14 }}>GROUP SESSION</span>
                                <span style={{ fontSize: 11, padding: "2px 8px", background: "#bfdbfe", color: BLUE, borderRadius: 10, fontWeight: 700 }}>
                                  {groupDoubts.length} students
                                </span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: textColor, marginBottom: 6 }}>
                                {groupDoubts[0].topic} · {groupDoubts[0].subject}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                {groupDoubts.map((gd, gi) => (
                                  <div key={gd._id} style={{ fontSize: 12, color: subColor, background: cardBg, borderRadius: 6, padding: "6px 10px" }}>
                                    👤 {gd.student_name}
                                  </div>
                                ))}
                              </div>
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => acceptDoubt(groupDoubts[0], groupDoubts)}
                                    style={{ flex: 1, padding: "8px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                                    Accept Group Session
                                  </button>
                                  <button onClick={() => rejectDoubt(groupDoubts[0])}
                                    style={{ padding: "8px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Single doubts */}
                          {singles.map((d, i) => (
                            <div key={d._id} style={{
                              border: d.priority === "urgent" ? "2px solid #ef4444" : `1px solid ${borderColor}`,
                              background: d.priority === "urgent" ? "#fff5f5" : cardBg,
                              borderRadius: 10, padding: 14, marginBottom: 10
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontWeight: 700, color: textColor, fontSize: 14 }}>
                                      #{i + 1} {d.student_name}
                                    </div>
                                    {d.priority === "urgent" && (
                                      <span style={{ fontSize: 10, padding: "2px 8px", background: "#fee2e2", color: "#ef4444", borderRadius: 10, fontWeight: 700 }}>
                                        URGENT
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{d.topic}</div>
                                  <div style={{ fontSize: 11, color: "#888" }}>{d.subject}</div>
                                </div>
                              </div>
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => setMessagePopup(d)}
                                    style={{ padding: "8px 12px", background: "#f0f4f8", color: "#444", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                                    💬
                                  </button>
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
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {page === "timetable" && (
          <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, color: textColor }}>Today's Timetable</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {["9:10", "10:00", "10:50", "11:40", "Lunch", "2:20", "3:10", "4:00"].map((time, i) => (
                <div key={i} style={{ background: darkMode ? "#334155" : "#f0f4f8", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: subColor, marginBottom: 4 }}>{time}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>
                    {i === 4 ? "Lunch" : "Free"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === "stats" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>Performance Stats</h2>
              <p style={{ color: subColor, marginTop: 4 }}>Your queue analytics and session insights</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                {[
                  { label: "Total Resolved", value: queue.filter ? 0 : 0, color: "#22c55e", icon: "✅" },
                  { label: "Pending Queue", value: queue.length, color: "#f59e0b", icon: "⏳" },
                  { label: "Group Sessions", value: queue.filter(d => d.grouped).length, color: "#8b5cf6", icon: "🤝" },
                  { label: "Urgent Doubts", value: queue.filter(d => d.priority === "urgent").length, color: "#ef4444", icon: "🚨" },
                ].map((s, i) => (
                  <div key={i} style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, color: textColor, marginBottom: 16 }}>📋 Current Queue Topics</div>
                {queue.length === 0 ? (
                  <div style={{ color: subColor, fontSize: 13 }}>No pending doubts right now</div>
                ) : Object.entries(queue.reduce((acc, d) => {
                  acc[d.subject] = (acc[d.subject] || 0) + 1;
                  return acc;
                }, {})).map(([subject, count], i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: textColor, fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: subColor }}>{count} student{count > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ background: borderColor, borderRadius: 20, height: 6 }}>
                      <div style={{ height: "100%", borderRadius: 20, background: "linear-gradient(90deg, #1a73e8, #4f9ef8)", width: `${(count / queue.length) * 100}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Message Popup */}
      {messagePopup && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: cardBg, borderRadius: 16, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: textColor }}>💬 Send Message</div>
            <div style={{ fontSize: 13, color: subColor, marginBottom: 16 }}>To: {messagePopup.student_name}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {QUICK_MESSAGES.map((msg, i) => (
                <button key={i} onClick={() => sendMessage(messagePopup._id, msg)}
                  style={{ padding: "10px 14px", background: darkMode ? "#334155" : "#f0f4f8", border: `1px solid ${borderColor}`, borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 13, color: textColor, fontWeight: 500 }}>
                  {msg}
                </button>
              ))}
            </div>

            <input
              placeholder="Or type custom message..."
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12, background: cardBg, color: textColor }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              {customMessage && (
                <button onClick={() => sendMessage(messagePopup._id, customMessage)}
                  style={{ flex: 1, padding: "11px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                  Send
                </button>
              )}
              <button onClick={() => { setMessagePopup(null); setCustomMessage(""); }}
                style={{ flex: 1, padding: "11px 0", background: darkMode ? "#334155" : "#f0f4f8", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: subColor }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}