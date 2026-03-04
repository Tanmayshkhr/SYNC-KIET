import { useState, useEffect, useRef } from "react";
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
  @keyframes confettiFall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes pageIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .page-content {
    animation: pageIn 0.3s ease both;
  }
`;

const StyleInjector = () => (
  <style dangerouslySetInnerHTML={{ __html: styles }} />
);

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

const SkeletonCard = ({ cardBg, borderColor }) => (
  <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: `1px solid ${borderColor}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ width: 140, height: 16, borderRadius: 8, background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "400px 100%", animation: "skeleton 1.4s ease infinite" }} />
      <div style={{ width: 70, height: 22, borderRadius: 20, background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "400px 100%", animation: "skeleton 1.4s ease infinite" }} />
    </div>
    <div style={{ width: 100, height: 12, borderRadius: 8, marginBottom: 10, background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "400px 100%", animation: "skeleton 1.4s ease infinite" }} />
    <div style={{ width: "100%", height: 12, borderRadius: 8, marginBottom: 6, background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "400px 100%", animation: "skeleton 1.4s ease infinite" }} />
    <div style={{ width: "100%", height: 40, borderRadius: 8, marginTop: 12, background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "400px 100%", animation: "skeleton 1.4s ease infinite" }} />
  </div>
);

const QueueProgress = ({ position, total, cardBg, textColor, subColor }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: subColor, marginBottom: 4 }}>
      <span>Your Queue Position</span>
      <span style={{ fontWeight: 700, color: "#1a73e8" }}>#{position} of {total}</span>
    </div>
    <div style={{ background: "#e0e0e0", borderRadius: 20, height: 8, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 20,
        background: "linear-gradient(90deg, #1a73e8, #4f9ef8)",
        width: `${((total - position + 1) / total) * 100}%`,
        transition: "width 0.8s ease"
      }} />
    </div>
  </div>
);

const AIHint = ({ topic, subject }) => {
  const hints = {
    "Event Loop": "JavaScript Event Loop works by pushing async callbacks to the call stack only when it's empty. Try console.log()-ing execution order to visualize it.",
    "Supervised Learning": "Focus on understanding the difference between training and test data first. Think of it like studying from solved examples before an exam.",
    "KNN": "KNN classifies by finding K nearest neighbors using distance. Try working through a small example with 5 points manually before coding.",
    "Shell Sort": "Shell Sort is an extension of Insertion Sort with gaps. Start by understanding how gap sequence reduces and why it's faster.",
    "Communication Skills": "Break communication into: listening, speaking, and body language. Practice by recording yourself speaking for 2 minutes.",
    "Dijkstra Algorithm": "Dijkstra uses a greedy approach - always pick the unvisited node with smallest distance. Draw it on paper with 4-5 nodes first.",
    "BST Node Removal": "BST deletion has 3 cases: leaf node, one child, two children. Master each case separately before combining.",
    "Supervised Learning algorithms": "Start with Linear Regression as the base. Every other algorithm is a variation of minimizing prediction error.",
  };

  const getHint = (topic) => {
    // Check exact match first
    if (hints[topic]) return hints[topic];
    // Check partial match
    const key = Object.keys(hints).find(k => 
      topic.toLowerCase().includes(k.toLowerCase()) || 
      k.toLowerCase().includes(topic.toLowerCase())
    );
    if (key) return hints[key];
    // Generic hint based on topic words
    return `For ${topic}, start by understanding the core definition, then work through a simple example step by step before tackling complex problems.`;
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #eff6ff, #f0fdf4)",
      border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, marginTop: 12
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1a73e8" }}>AI HINT WHILE YOU WAIT</span>
      </div>
      <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.6 }}>
        {getHint(topic)}
      </div>
    </div>
  );
};

const Confetti = () => {
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    color: ["#1a73e8", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#f97316"][i % 6],
    left: `${(i * 5) + 2}%`,
    delay: `${i * 0.08}s`,
    size: [8, 10, 6, 12][i % 4]
  }));
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden", height: "100vh" }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.left, top: "-20px",
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: i % 3 === 0 ? "50%" : 2,
          animation: `confettiFall 2s ease-out ${p.delay} both`
        }} />
      ))}
    </div>
  );
};

export default function StudentDashboard({ user, setUser, darkMode, setDarkMode }) {
  const bg = darkMode ? "#0f172a" : "#f0f4f8";
  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";
  const borderColor = darkMode ? "#334155" : "#e0e0e0";
  const navBg = darkMode ? "#1e293b" : "#fff";

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
    fetchAnnouncements();

    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws");
      wsRef.current = ws;

      ws.onopen = () => console.log("WebSocket connected");

      ws.onmessage = () => {
        fetchFaculty();
        fetchMyDoubts();
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

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${API}/admin/announcements`);
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error(err);
    }
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
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          } else if (newDoubt.status === "rejected") {
            sendNotification("Doubt Rejected", `Your doubt on "${newDoubt.topic}" was rejected: ${newDoubt.reject_reason || "No reason provided"}`);
          }
        }
        // Notify when grouped
        if (oldDoubt && !oldDoubt.grouped && newDoubt.grouped) {
          sendNotification("Grouped for Session!", `Your doubt on "${newDoubt.topic}" has been grouped with similar doubts. You'll be resolved together!`);
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
      darkMode={darkMode}
      user={user}
      faculty={selectedFaculty}
      onBack={() => setPage("home")}
      onSubmitted={() => { setPage("mydoubts"); fetchMyDoubts(); }}
    />
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      <StyleInjector />
      {showConfetti && <Confetti />}
      {/* Navbar */}
      <div className="responsive-navbar" style={{ background: navBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div className="responsive-nav-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>PuchoKIET</span>
        </div>
        <div className="responsive-nav-tabs" style={{ display: "flex", gap: 8 }}>
          {[["Home", "home"], ["My Doubts", "mydoubts"], ["Analytics", "analytics"]].map(([label, p]) => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: page === p ? BLUE : "none", color: page === p ? "#fff" : subColor, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
        <div className="responsive-nav-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>          <span style={{ fontSize: 13, color: subColor, fontWeight: 600 }}>{user.name}</span>          <button onClick={() => setDarkMode(!darkMode)}
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
                <div style={{ fontSize: 12, color: "#a16207" }}>Get notified when your doubt is accepted or resolved</div>
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
        {/* HOME PAGE */}
        {page === "home" && (
          <div className="page-content">
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
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>Find Faculty</h2>
              <p style={{ color: subColor, marginTop: 4 }}>Live availability · AI-powered queue · Smart grouping</p>
            </div>

            {/* Search and Filters */}
            <div className="responsive-filters" style={{ background: cardBg, borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <input
                placeholder="🔍 Search faculty by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", background: cardBg, color: textColor }}
              />

              {/* Subject Filter */}
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", color: subColor, background: cardBg }}>
                <option value="">All Subjects</option>
                {[...new Set(faculty.map(f => f.subject))].sort().map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              {/* Availability Filter */}
              <select value={availFilter} onChange={e => setAvailFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", color: subColor, background: cardBg }}>
                <option value="">All Status</option>
                <option value="available">Available Now</option>
                <option value="busy">In Class</option>
                <option value="lunch">Lunch Break</option>
                <option value="not_arrived">Not Arrived</option>
                <option value="left">Left</option>
              </select>

              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 13, outline: "none", color: subColor, background: cardBg }}>
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
              <div className="responsive-grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} cardBg={cardBg} borderColor={borderColor} />)}
              </div>
            ) : filteredFaculty.length === 0 ? (
              <div style={{ background: cardBg, borderRadius: 12, padding: 40, textAlign: "center", color: subColor }}>
                No faculty found matching your filters
              </div>
            ) : (
              <div className="responsive-grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {filteredFaculty.map((f, i) => (
                  <div key={i} className="faculty-card" style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: f.status === "available" ? `2px solid ${BLUE}` : "2px solid transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: textColor }}>{f.faculty_name}</div>
                        <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{f.subject}</div>
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
          </div>
        )}

        {/* MY DOUBTS PAGE */}
        {page === "mydoubts" && (
          <div className="page-content">
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>My Doubts</h2>
              <p style={{ color: subColor, marginTop: 4 }}>Track your doubt sessions and queue position</p>
            </div>
            {myDoubts.length === 0 ? (
              <div style={{ background: cardBg, borderRadius: 12, padding: 40, textAlign: "center", color: subColor }}>
                No doubts submitted yet. Go to Home to submit your first doubt!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myDoubts.map((d, i) => (
                  <div key={i} className="faculty-card" style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, color: textColor }}>{d.topic}</div>
                        {d.grouped && (
                          <span style={{ fontSize: 10, padding: "2px 8px", background: "#ede9fe", color: "#7c3aed", borderRadius: 10, fontWeight: 700 }}>🤝 GROUPED</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: subColor }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                      <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{d.description?.slice(0, 60)}...</div>
                      {d.status === "rejected" && d.reject_reason && (
                        <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>❌ Rejection Reason</div>
                          <div style={{ fontSize: 13, color: "#991b1b" }}>{d.reject_reason}</div>
                        </div>
                      )}
                      {d.faculty_message && d.status !== "rejected" && (
                        <div style={{ marginTop: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#1a73e8", marginBottom: 4 }}>💬 Message from Faculty</div>
                          <div style={{ fontSize: 13, color: "#1e40af" }}>{d.faculty_message}</div>
                        </div>
                      )}
                      {d.status === "pending" && (
                        <>
                          <QueueProgress position={1} total={myDoubts.filter(x => x.status === "pending").length} cardBg={cardBg} textColor={textColor} subColor={subColor} />
                          <AIHint topic={d.topic} subject={d.subject} />
                        </>
                      )}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS PAGE */}
        {page === "analytics" && (() => {
          const completed = myDoubts.filter(d => d.status === "completed");
          const rejected = myDoubts.filter(d => d.status === "rejected");
          const pending = myDoubts.filter(d => d.status === "pending");
          const active = myDoubts.filter(d => d.status === "active");
          const resolutionRate = myDoubts.length > 0 ? Math.round((completed.length / myDoubts.length) * 100) : 0;

          // Subject breakdown
          const subjectStats = Object.entries(myDoubts.reduce((acc, d) => {
            if (!acc[d.subject]) acc[d.subject] = { total: 0, completed: 0, rejected: 0 };
            acc[d.subject].total++;
            if (d.status === "completed") acc[d.subject].completed++;
            if (d.status === "rejected") acc[d.subject].rejected++;
            return acc;
          }, {})).sort((a, b) => b[1].total - a[1].total);

          // Day of week breakdown
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const dayBreakdown = myDoubts.reduce((acc, d) => {
            if (d.created_at) {
              const day = new Date(d.created_at).getDay();
              acc[day] = (acc[day] || 0) + 1;
            }
            return acc;
          }, {});
          const maxDayCount = Math.max(...Object.values(dayBreakdown), 1);

          return (
          <div className="page-content">
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>Analytics</h2>
              <p style={{ color: subColor, marginTop: 4 }}>Your doubt history insights & patterns</p>
            </div>

            {myDoubts.length === 0 ? (
              <div style={{ background: cardBg, borderRadius: 12, padding: 40, textAlign: "center", color: subColor }}>
                No doubts submitted yet. Submit your first doubt to see analytics!
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Stats Row */}
              <div className="stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
                {[
                  { label: "Total Doubts", value: myDoubts.length, icon: "📝", color: "#1a73e8" },
                  { label: "Resolved", value: completed.length, icon: "✅", color: "#22c55e" },
                  { label: "Pending", value: pending.length, icon: "⏳", color: "#f59e0b" },
                  { label: "Active", value: active.length, icon: "🔵", color: "#1a73e8" },
                  { label: "Rejected", value: rejected.length, icon: "❌", color: "#ef4444" },
                  { label: "Resolution Rate", value: `${resolutionRate}%`, icon: "📊", color: resolutionRate >= 70 ? "#22c55e" : resolutionRate >= 40 ? "#f59e0b" : "#ef4444" },
                ].map((s, i) => (
                  <div key={i} style={{ background: cardBg, borderRadius: 12, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
                    <div style={{ fontSize: 20 }}>{s.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Subject Breakdown with resolution bars */}
              <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, color: textColor, marginBottom: 16 }}>📚 Subject Breakdown</div>
                {subjectStats.length === 0 ? (
                  <div style={{ color: subColor, fontSize: 13 }}>No subjects yet</div>
                ) : subjectStats.slice(0, 6).map(([subject, stats], i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: textColor, fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: subColor, fontSize: 11 }}>
                        {stats.total} total · {stats.completed} resolved · {stats.rejected} rejected
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 20, overflow: "hidden", background: borderColor }}>
                      {stats.completed > 0 && (
                        <div style={{ height: "100%", background: "#22c55e", width: `${(stats.completed / stats.total) * 100}%`, transition: "width 0.8s ease" }} />
                      )}
                      {stats.rejected > 0 && (
                        <div style={{ height: "100%", background: "#ef4444", width: `${(stats.rejected / stats.total) * 100}%`, transition: "width 0.8s ease" }} />
                      )}
                      {(stats.total - stats.completed - stats.rejected) > 0 && (
                        <div style={{ height: "100%", background: "#f59e0b", width: `${((stats.total - stats.completed - stats.rejected) / stats.total) * 100}%`, transition: "width 0.8s ease" }} />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "#22c55e" }}>● Resolved</span>
                      <span style={{ fontSize: 10, color: "#ef4444" }}>● Rejected</span>
                      <span style={{ fontSize: 10, color: "#f59e0b" }}>● Pending/Active</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Day of Week Pattern */}
              <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, color: textColor, marginBottom: 16 }}>📅 Day-wise Activity</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                  {dayNames.map((day, i) => {
                    const count = dayBreakdown[i] || 0;
                    const height = count > 0 ? Math.max((count / maxDayCount) * 100, 12) : 4;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: count > 0 ? "#1a73e8" : subColor }}>{count || ""}</span>
                        <div style={{
                          width: "100%", maxWidth: 36, borderRadius: "6px 6px 0 0",
                          height: `${height}%`,
                          background: count > 0 ? "linear-gradient(180deg, #1a73e8, #4f9ef8)" : borderColor,
                          transition: "height 0.6s ease"
                        }} />
                        <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ background: cardBg, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, color: textColor, marginBottom: 16 }}>🕒 Recent Activity</div>
                {myDoubts.slice(0, 8).map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 7 ? `1px solid ${borderColor}` : "none" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{d.topic}</div>
                      <div style={{ fontSize: 11, color: subColor }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                      {d.status === "rejected" && d.reject_reason && (
                        <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>Reason: {d.reject_reason}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                      background: d.status === "completed" ? "#dcfce7" : d.status === "pending" ? "#fef3c7" : d.status === "active" ? "#eff6ff" : "#fee2e2",
                      color: d.status === "completed" ? "#16a34a" : d.status === "pending" ? "#d97706" : d.status === "active" ? "#1a73e8" : "#ef4444"
                    }}>{d.status}</span>
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

const StatusBadge = ({ status }) => {
  const config = {
    available: { label: "Available", color: "#22c55e", bg: "#dcfce7" },
    busy: { label: "In Class", color: "#1a73e8", bg: "#eff6ff" },
    lunch: { label: "Lunch Break", color: "#f59e0b", bg: "#fef3c7" },
    not_arrived: { label: "Not Arrived", color: "#94a3b8", bg: "#f1f5f9" },
    left: { label: "Left", color: "#ef4444", bg: "#fee2e2" },
    pending: { label: "Pending", color: "#d97706", bg: "#fef3c7" },
    active: { label: "Active", color: "#1a73e8", bg: "#eff6ff" },
    completed: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
    rejected: { label: "Rejected", color: "#dc2626", bg: "#fee2e2" },
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