import { useState, useEffect, useRef } from "react";
import ToastContainer, { useToast } from "../components/Toast";
import FaceScanner from "../components/FaceScanner";

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
  const { toasts, addToast } = useToast();
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
  const [groupModal, setGroupModal] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState({});
  const [rejectPopup, setRejectPopup] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ total_completed: 0, total_rejected: 0 });
  const [schedule, setSchedule] = useState({ day: "", slots: [] });
  const [announcements, setAnnouncements] = useState([]);
  const [notifDismissed, setNotifDismissed] = useState(localStorage.getItem("notifDismissed") === "true");
  const [faceStatus, setFaceStatus] = useState({ face_registered: false, manual_status: null });
  const [faceScanner, setFaceScanner] = useState(null); // null | "register" | "check_in" | "check_out"
  const wsRef = useRef(null);

  const sendNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchHistory();
    fetchSchedule();
    fetchAnnouncements();
    fetchFaceStatus();

    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws");
      wsRef.current = ws;

      ws.onopen = () => console.log("WebSocket connected");

      ws.onmessage = () => {
        fetchQueue();
        fetchAnnouncements();
      };

      ws.onclose = () => {
        console.log("WebSocket closed, reconnecting in 2s...");
        setTimeout(connectWS, 2000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
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

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${API}/admin/announcements`);
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFaceStatus = async () => {
    try {
      const res = await fetch(`${API}/face/status`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      setFaceStatus(data);
    } catch (err) {
      console.error(err);
    }
  };

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

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/doubts/faculty-history`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      setHistory(data.history || []);
      setHistoryStats({ total_completed: data.total_completed || 0, total_rejected: data.total_rejected || 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`${API}/timetable/my-schedule`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      setSchedule({ day: data.day || "", slots: data.slots || [] });
    } catch (err) {
      console.error(err);
    }
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
      addToast("Doubt accepted — session started!", "success");
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
      addToast("Session completed!", "success");
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const rejectDoubt = async (doubt, reason) => {
    try {
      const res = await fetch(`${API}/doubts/reject/${doubt._id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "No reason provided" })
      });
      const data = await res.json();
      setActiveSession(null);
      setRejectPopup(null);
      setRejectReason("");
      addToast("Doubt rejected", "info");
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
      addToast("Message sent to student!", "success");
    } catch (err) {
      console.error(err);
    }
  };

  const findSimilar = async () => {
    setGroupLoading(true);
    try {
      const res = await fetch(`${API}/doubts/find-similar`, {
        headers: { authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      const initialSelection = {};
      (data.groups || []).forEach((g, gi) => {
        g.doubts.forEach(d => { initialSelection[d._id] = gi; });
      });
      setSelectedForGroup(initialSelection);
      setGroupModal(data);
    } catch (err) {
      console.error(err);
      addToast("Failed to find similar doubts", "error");
    }
    setGroupLoading(false);
  };

  const confirmGroup = async (group) => {
    const selectedIds = group.doubts
      .filter(d => selectedForGroup[d._id] !== undefined)
      .map(d => d._id);
    if (selectedIds.length < 2) {
      addToast("Select at least 2 doubts to group", "warning");
      return;
    }
    try {
      await fetch(`${API}/doubts/group-doubts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          doubt_ids: selectedIds,
          group_name: group.canonical_topic
        })
      });
      setGroupModal(null);
      setSelectedForGroup({});
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAllGroups = async () => {
    if (!groupModal) return;
    for (const group of groupModal.groups) {
      const selectedIds = group.doubts
        .filter(d => selectedForGroup[d._id] !== undefined)
        .map(d => d._id);
      if (selectedIds.length >= 2) {
        await fetch(`${API}/doubts/group-doubts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            doubt_ids: selectedIds,
            group_name: group.canonical_topic
          })
        });
      }
    }
    setGroupModal(null);
    setSelectedForGroup({});
    fetchQueue();
  };

  const toggleDoubtSelection = (doubtId, groupIndex) => {
    setSelectedForGroup(prev => {
      const next = { ...prev };
      if (next[doubtId] !== undefined) {
        delete next[doubtId];
      } else {
        next[doubtId] = groupIndex;
      }
      return next;
    });
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const logout = () => { localStorage.clear(); setUser(null); };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      <ToastContainer toasts={toasts} />
      {/* Navbar */}
      <div className="responsive-navbar" style={{ background: navBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div className="responsive-nav-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>PuchoKIET</span>
          <span style={{ fontSize: 11, padding: "3px 10px", background: "#eff6ff", color: BLUE, borderRadius: 10, fontWeight: 700 }}>FACULTY</span>
        </div>
        <div className="responsive-nav-tabs" style={{ display: "flex", gap: 8 }}>
          {[["Dashboard", "dashboard"], ["History", "history"], ["Timetable", "timetable"], ["Stats", "stats"]].map(([label, p]) => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: page === p ? BLUE : "none", color: page === p ? "#fff" : subColor, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
        <div className="responsive-nav-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: subColor, fontWeight: 600 }}>{user.name}</span>
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${borderColor}`, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={logout} style={{ padding: "8px 16px", border: `1px solid ${borderColor}`, borderRadius: 8, background: "none", color: subColor, cursor: "pointer", fontSize: 13 }}>Logout</button>
        </div>
      </div>

      <div className="responsive-content" style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
        {/* Notification Permission Banner */}
        {!notifDismissed && "Notification" in window && Notification.permission !== "granted" && (
          <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fbbf24", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Enable Notifications</div>
                <div style={{ fontSize: 12, color: "#a16207" }}>Get notified when a student submits a doubt</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { Notification.requestPermission(); setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ padding: "6px 14px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>Allow</button>
              <button onClick={() => { setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ padding: "6px 10px", background: "transparent", color: "#a16207", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        )}
        {page === "dashboard" && (
          <>
            {announcements.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #1a73e8, #4f9ef8)",
                borderRadius: 12, padding: "12px 16px", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <span style={{ fontSize: 18 }}>📢</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>ANNOUNCEMENT</div>
                  <div style={{ fontSize: 13, color: "#bfdbfe" }}>{announcements[0].message}</div>
                </div>
              </div>
            )}
            {/* Face Scan Card */}
            <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: faceStatus.manual_status === "available" ? "#dcfce7" : faceStatus.manual_status === "left" ? "#fee2e2" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {faceStatus.manual_status === "available" ? "🟢" : faceStatus.manual_status === "left" ? "🔴" : "📷"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: textColor, fontSize: 14 }}>
                    {!faceStatus.face_registered ? "Face Not Registered" : faceStatus.manual_status === "available" ? "Checked In" : faceStatus.manual_status === "left" ? "Checked Out" : "Not Scanned Today"}
                  </div>
                  <div style={{ fontSize: 11, color: subColor }}>
                    {!faceStatus.face_registered ? "Register to enable face check-in/out" : faceStatus.last_scan_at ? `Last scan: ${faceStatus.last_scan_at.slice(0, 16).replace("T", " ")}` : "Scan your face to update status"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!faceStatus.face_registered ? (
                  <button onClick={() => setFaceScanner("register")} style={{ padding: "8px 16px", borderRadius: 8, background: BLUE, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    📷 Register Face
                  </button>
                ) : (
                  <>
                    {faceStatus.manual_status !== "available" && (
                      <button onClick={() => setFaceScanner("check_in")} style={{ padding: "8px 16px", borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        🟢 Check In
                      </button>
                    )}
                    {faceStatus.manual_status === "available" && (
                      <button onClick={() => setFaceScanner("check_out")} style={{ padding: "8px 16px", borderRadius: 8, background: "#ef4444", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        🔴 Check Out
                      </button>
                    )}
                    <button onClick={() => setFaceScanner("register")} style={{ padding: "8px 16px", borderRadius: 8, background: darkMode ? "#334155" : "#f1f5f9", color: subColor, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      Re-register
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="responsive-grid-5col" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 28 }}>
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

            <div className="responsive-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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
                      <button onClick={() => setRejectPopup(activeSession)}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: textColor }}>
                    Student Queue ({queue.length})
                  </div>
                  {queue.length >= 2 && !activeSession && (
                    <button onClick={findSimilar} disabled={groupLoading}
                      style={{ padding: "6px 14px", background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 11, opacity: groupLoading ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                      {groupLoading ? "Scanning..." : "🔍 Find Similar & Group"}
                    </button>
                  )}
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
                                  <button onClick={() => setRejectPopup(groupDoubts[0])}
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
                                  <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
                                    {d.topic}
                                    {d.duration && (
                                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, marginLeft: 6,
                                        background: d.duration === "quick" ? "#dcfce7" : d.duration === "long" ? "#fee2e2" : "#fef3c7",
                                        color: d.duration === "quick" ? "#16a34a" : d.duration === "long" ? "#ef4444" : "#d97706",
                                        fontWeight: 600
                                      }}>
                                        {d.duration === "quick" ? "⚡ 5-10m" : d.duration === "long" ? "🔍 30+m" : "📖 15-20m"}
                                      </span>
                                    )}
                                  </div>
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
                                  <button onClick={() => setRejectPopup(d)}
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

        {page === "history" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>Doubt History</h2>
              <p style={{ color: subColor, marginTop: 4 }}>Your past resolved sessions</p>
            </div>
            <div className="responsive-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total Resolved", value: historyStats.total_completed, color: "#22c55e", icon: "\u2705" },
                { label: "Rejected", value: historyStats.total_rejected, color: "#ef4444", icon: "\u274c" },
                { label: "Total Sessions", value: historyStats.total_completed + historyStats.total_rejected, color: BLUE, icon: "\ud83d\udcca" },
              ].map((s, i) => (
                <div key={i} style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: subColor }}>No past sessions yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.map((d, i) => (
                    <div key={d._id} style={{
                      border: `1px solid ${borderColor}`, borderRadius: 10, padding: 14,
                      background: cardBg, display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: textColor, fontSize: 14 }}>{d.student_name}</div>
                        <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
                          {d.topic} \u00b7 {d.subject}
                          {d.duration && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, marginLeft: 6,
                              background: d.duration === "quick" ? "#dcfce7" : d.duration === "long" ? "#fee2e2" : "#fef3c7",
                              color: d.duration === "quick" ? "#16a34a" : d.duration === "long" ? "#ef4444" : "#d97706",
                              fontWeight: 600
                            }}>
                              {d.duration === "quick" ? "\u26a1 5-10m" : d.duration === "long" ? "\ud83d\udd0d 30+m" : "\ud83d\udcd6 15-20m"}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                          {d.completed_at ? new Date(d.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          {d.grouped && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", background: "#ede9fe", color: "#7c3aed", borderRadius: 8, fontWeight: 700 }}>\ud83e\udd1d GROUP</span>}
                        </div>
                      </div>
                      <span style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: d.status === "completed" ? "#d1fae5" : "#fee2e2",
                        color: d.status === "completed" ? "#059669" : "#ef4444"
                      }}>
                        {d.status === "completed" ? "\u2705 Resolved" : "\u274c Rejected"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {page === "timetable" && (
          <div style={{ background: cardBg, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: textColor }}>Today's Timetable</div>
              <span style={{ fontSize: 13, color: subColor, background: darkMode ? "#334155" : "#eff6ff", padding: "4px 12px", borderRadius: 8 }}>{schedule.day || "—"}</span>
            </div>
            <div className="responsive-grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {schedule.slots.map((slot, i) => {
                const isClass = slot.type === "class";
                const bgColor = isClass ? (darkMode ? "#1e3a5f" : "#eff6ff") : (darkMode ? "#334155" : "#f0f4f8");
                const borderStyle = isClass ? `2px solid ${BLUE}` : `1px solid ${borderColor}`;
                return [
                  // Insert lunch after period 4 (index 3)
                  i === 4 && (
                    <div key="lunch" style={{ background: darkMode ? "#44403c" : "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: subColor, marginBottom: 4 }}>12:30 – 14:20</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>🍽 Lunch</div>
                    </div>
                  ),
                  <div key={i} style={{ background: bgColor, border: borderStyle, borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: subColor, marginBottom: 4 }}>{slot.start} – {slot.end}</div>
                    {isClass ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{slot.subject}</div>
                        <div style={{ fontSize: 10, color: subColor, marginTop: 2 }}>{slot.section} · {slot.class_type}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>Free</div>
                    )}
                  </div>
                ];
              })}
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
                  { label: "Total Resolved", value: historyStats.total_completed, color: "#22c55e", icon: "✅" },
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
          <div className="responsive-modal" style={{ background: cardBg, borderRadius: 16, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
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

      {/* Reject Reason Modal */}
      {rejectPopup && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="responsive-modal" style={{ background: cardBg, borderRadius: 16, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#ef4444" }}>❌ Reject Doubt</div>
            <div style={{ fontSize: 13, color: subColor, marginBottom: 16 }}>
              Student: <b style={{ color: textColor }}>{rejectPopup.student_name}</b> · {rejectPopup.topic}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                "Topic not in my subject area",
                "Please refer to class notes first",
                "Duplicate doubt — already resolved",
                "Come during office hours instead",
                "Not enough detail — please resubmit with more info"
              ].map((reason, i) => (
                <button key={i} onClick={() => setRejectReason(reason)}
                  style={{
                    padding: "10px 14px",
                    background: rejectReason === reason ? (darkMode ? "#451a1a" : "#fef2f2") : (darkMode ? "#334155" : "#f0f4f8"),
                    border: rejectReason === reason ? "1.5px solid #ef4444" : `1px solid ${borderColor}`,
                    borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 13, color: textColor, fontWeight: 500
                  }}>
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Or type a custom reason (max 50 words)..."
              value={rejectReason}
              onChange={e => {
                const words = e.target.value.split(/\s+/).filter(Boolean);
                if (words.length <= 50) setRejectReason(e.target.value);
              }}
              rows={2}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 4, background: cardBg, color: textColor, resize: "none", fontFamily: "inherit" }}
            />
            <div style={{ fontSize: 11, color: subColor, marginBottom: 12, textAlign: "right" }}>
              {rejectReason.split(/\s+/).filter(Boolean).length}/50 words
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => rejectDoubt(rejectPopup, rejectReason)}
                disabled={!rejectReason.trim()}
                style={{
                  flex: 1, padding: "11px 0", background: rejectReason.trim() ? "#ef4444" : "#fca5a5",
                  color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontSize: 14
                }}>
                Reject with Reason
              </button>
              <button onClick={() => { setRejectPopup(null); setRejectReason(""); }}
                style={{ padding: "11px 16px", background: darkMode ? "#334155" : "#f0f4f8", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: subColor }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Similar Modal */}
      {groupModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="responsive-modal" style={{ background: cardBg, borderRadius: 16, padding: 28, width: 520, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: textColor }}>🔍 Similar Doubts Found</div>
              <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: subColor }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: subColor, marginBottom: 20 }}>
              We detected topics that look similar. Review and confirm to group them for a joint session. Students will be notified.
            </div>

            {groupModal.groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: subColor }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🤷</div>
                No similar doubts found in the current queue.
              </div>
            ) : (
              <>
                {groupModal.groups.map((group, gi) => (
                  <div key={gi} style={{
                    border: "2px solid #8b5cf6", background: darkMode ? "#1e1b4b" : "#f5f3ff",
                    borderRadius: 12, padding: 16, marginBottom: 14
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#7c3aed", fontSize: 14 }}>
                          🤝 {group.canonical_topic}
                        </div>
                        <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>
                          {group.count} students · Confidence: {group.confidence}
                        </div>
                      </div>
                      <button onClick={() => confirmGroup(group)}
                        style={{ padding: "6px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                        Group These
                      </button>
                    </div>

                    {group.doubts.map((d, di) => {
                      const isSelected = selectedForGroup[d._id] !== undefined;
                      return (
                        <div key={d._id} onClick={() => toggleDoubtSelection(d._id, gi)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                            background: isSelected ? (darkMode ? "#312e81" : "#ede9fe") : (darkMode ? "#334155" : "#fff"),
                            border: isSelected ? "1.5px solid #7c3aed" : `1px solid ${borderColor}`,
                            borderRadius: 8, marginBottom: 6, cursor: "pointer", transition: "all 0.15s"
                          }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4,
                            border: isSelected ? "2px solid #7c3aed" : `2px solid ${borderColor}`,
                            background: isSelected ? "#7c3aed" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0
                          }}>
                            {isSelected && "✓"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: textColor }}>{d.student_name}</div>
                            <div style={{ fontSize: 11, color: subColor }}>
                              {d.topic} · {d.subject}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={confirmAllGroups}
                    style={{ flex: 1, padding: "12px 0", background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    Group All ({groupModal.groups.length} group{groupModal.groups.length > 1 ? "s" : ""})
                  </button>
                  <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }}
                    style={{ padding: "12px 20px", background: darkMode ? "#334155" : "#f0f4f8", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: subColor, fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {groupModal.ungrouped?.length > 0 && (
              <div style={{ marginTop: 14, fontSize: 12, color: subColor, borderTop: `1px solid ${borderColor}`, paddingTop: 12 }}>
                {groupModal.ungrouped.length} doubt(s) have no similar match and will remain as individual entries.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Face Scanner Modal */}
      {faceScanner && (
        <FaceScanner
          user={user}
          action={faceScanner}
          darkMode={darkMode}
          onClose={() => setFaceScanner(null)}
          onComplete={(data) => {
            setFaceScanner(null);
            fetchFaceStatus();
            if (data.action === "check_in") {
              addToast("Checked in! Status: Available", "success");
            } else if (data.action === "check_out") {
              addToast("Checked out! Status: Left", "success");
            } else {
              addToast("Face registered successfully!", "success");
            }
          }}
        />
      )}
    </div>
  );
}