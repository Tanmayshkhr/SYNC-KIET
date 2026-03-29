import { useEffect, useState } from "react";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";

const SUBJECT_TOPICS = {
  "Design and Analysis of Algorithms": ["Substitution Method", "Master's Theorem", "Shell Sort", "Tim Sort", "Counting Sort", "Radix Sort", "Bucket Sort", "Fractional Knapsack", "Activity Selection", "Task Scheduling", "Kruskal's Algorithm", "Prim's Algorithm", "Dijkstra's Algorithm", "Bellman Ford", "Dynamic Programming Intro", "0-1 Knapsack", "Coin Change Problem", "LCS", "Matrix Chain Multiplication", "Floyd Warshall", "N-Queen Problem", "Graph Coloring", "Travelling Salesman", "KMP Algorithm", "Rabin Karp", "Boyer Moore", "NP Completeness", "NP Hard"],
  "Computer Networks": ["OSI Model", "TCP/IP Model", "Network Topologies", "Transmission Media", "Switching Techniques", "Framing", "Error Detection", "Error Correction", "Flow Control", "Sliding Window Protocol", "ALOHA", "CSMA/CD", "CSMA/CA", "Ethernet", "WiFi 802.11", "Bluetooth", "Subnetting", "Supernetting", "NAT", "IPv4", "IPv6", "RIP", "OSPF", "BGP", "Distance Vector Routing", "Link State Routing", "UDP", "TCP", "Congestion Control", "Leaky Bucket", "Token Bucket", "DNS", "HTTP", "FTP", "SMTP", "Cryptography", "Symmetric Key", "Asymmetric Key", "Digital Signature"],
  "Web Technology": ["Node.js Basics", "Event Loop", "Callbacks", "Async Programming", "WebSockets", "EventEmitter", "Node Streams", "Express Routing", "Middleware", "EJS Templating", "React Components", "React Hooks", "useState", "useEffect", "Redux", "Context API", "Props vs State", "RESTful API", "HTTP Methods", "MongoDB CRUD", "Mongoose", "SQL vs NoSQL", "Flask Routing", "Jinja2", "Flask REST API", "Django MVC", "Django Models", "Django Views", "URL Routing", "React-Express Integration"],
  "ANN and Machine Learning": ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Linear Regression", "Logistic Regression", "Decision Tree", "Random Forest", "SVM", "K-Means Clustering", "KNN Algorithm", "Naive Bayes", "Gradient Descent", "Overfitting", "Underfitting", "Cross Validation", "Confusion Matrix", "Precision Recall", "Neural Networks Basics", "Activation Functions", "Backpropagation", "CNN", "RNN", "LSTM", "Perceptron", "Multilayer Perceptron", "Dropout", "Batch Normalization"],
  "Data Analytics": ["Data Preprocessing", "Data Cleaning", "Handling Missing Values", "Outlier Detection", "Feature Engineering", "Feature Selection", "Exploratory Data Analysis", "Data Visualization", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Correlation Analysis", "Hypothesis Testing", "Statistical Inference", "Regression Analysis", "Classification", "Clustering", "Dimensionality Reduction", "PCA", "Time Series Analysis", "Data Wrangling", "GroupBy Operations", "Pivot Tables", "Dashboard Creation"],
  "Universal Human Values": ["Human Values Basics", "Self Exploration", "Harmony in Family", "Harmony in Society", "Harmony with Nature", "Right Understanding", "Ethical Human Conduct", "Professional Ethics"],
  "Aptitude": ["Number System", "Percentages", "Profit and Loss", "Time and Work", "Time Speed Distance", "Ratio Proportion", "Averages", "Probability", "Permutation Combination", "Logical Reasoning", "Verbal Ability"],
  "Soft Skills": ["Communication Skills", "Group Discussion", "Interview Skills", "Resume Writing", "Presentation Skills", "Email Writing", "Leadership"],
};

const formatSlotText = (slot) => {
  if (!slot) return "-";
  return `${slot.relative_label || slot.day} | ${slot.day}, ${slot.start} - ${slot.end}`;
};

export default function SubmitDoubt({ user, faculty, onBack, onSubmitted, darkMode, resubmitData }) {
  const bg = darkMode ? "#0f0e1a" : "#f5f3ff";
  const cardBg = darkMode ? "#1e1b4b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a2e";
  const subColor = darkMode ? "#a5b4fc" : "#64748b";
  const borderColor = darkMode ? "#312e81" : "#ede9fe";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    subject: resubmitData?.subject || faculty?.subject || "",
    topic: resubmitData?.topic || "",
    description: resubmitData?.description || "",
  });
  const [duration, setDuration] = useState("medium");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState("");

  const topics = SUBJECT_TOPICS[form.subject] || [];
  const filteredTopics = topics.filter((topic) => topic.toLowerCase().includes(topicSearch.toLowerCase()));

  useEffect(() => {
    const fetchSlots = async () => {
      if (!faculty?._id || !user?.token) {
        setAvailableSlots([]);
        setSelectedSlot(null);
        setSlotError("Faculty details are missing for scheduling.");
        return;
      }

      setSlotsLoading(true);
      setSlotError("");
      try {
        const res = await fetch(`${API}/doubts/available-slots/${faculty._id}`, {
          headers: { authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load available slots");
        setAvailableSlots(data.slots || []);
        setSelectedSlot((data.slots || [])[0] || null);
        if (!data.slots?.length) {
          setSlotError("No mutually free slots are available right now. Try another faculty or check again later.");
        }
      } catch (err) {
        setAvailableSlots([]);
        setSelectedSlot(null);
        setSlotError(err.message);
      }
      setSlotsLoading(false);
    };

    fetchSlots();
  }, [faculty?._id, user?.token]);

  const submitDoubt = async () => {
    if (!faculty?._id) {
      setError("Faculty details are unavailable.");
      return;
    }
    if (!form.topic || !form.description) {
      setError("Please fill all fields");
      return;
    }
    if (!selectedSlot) {
      setError("Please select one mutually free slot");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/doubts/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          subject: form.subject,
          topic: form.topic,
          description: form.description,
          faculty_id: faculty._id,
          duration,
          scheduled_date: selectedSlot.date,
          scheduled_period: selectedSlot.period,
          reminder_minutes: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to schedule doubt");
      setResult(data);
      setStep("success");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (step === "success" && result) {
    const scheduledSlot = result.scheduled_slot;
    return (
      <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: cardBg, borderRadius: 24, padding: 40, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(124,58,237,0.15)", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(124,58,237,0.3)", fontSize: 36, color: "#fff" }}>S</div>
          <h2 style={{ color: PURPLE, margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Doubt Scheduled!</h2>
          <p style={{ color: subColor, marginBottom: 28, fontSize: 14 }}>Your slot is reserved and the reminder scaffold is ready.</p>

          <div style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 16, padding: 20, marginBottom: 20, textAlign: "left", border: `1px solid ${borderColor}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, marginBottom: 12, letterSpacing: 0.5 }}>BOOKING SUMMARY</div>
            {[
              ["Faculty", faculty?.faculty_name || "-"],
              ["Subject", form.subject],
              ["Topic", form.topic],
              ["Slot", formatSlotText(scheduledSlot)],
              ["Reminder", "10 minutes before the slot"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${borderColor}`, fontSize: 13 }}>
                <span style={{ color: subColor }}>{label}</span>
                <span style={{ color: textColor, fontWeight: 600, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              ["SLOT", `${scheduledSlot?.start || "-"} - ${scheduledSlot?.end || "-"}`, "Booked Time"],
              ["DAY", scheduledSlot?.relative_label || scheduledSlot?.day || "-", "Meeting Day"],
              ["REMIND", "T-10 min", "Reminder"],
            ].map(([icon, value, label]) => (
              <div key={label} style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 12, padding: "14px 8px", border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: PURPLE, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: PURPLE_DARK }}>{value}</div>
                <div style={{ fontSize: 10, color: subColor, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 14, marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>Only mutually free slots were shown, and this slot is now reserved for the faculty and the student.</div>
          </div>

          <button onClick={onSubmitted} style={{ width: "100%", padding: "14px 0", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
            View My Doubts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <div style={{ background: cardBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", gap: 16, height: 64 }}>
        <button onClick={onBack} style={{ padding: "8px 16px", border: `1px solid ${borderColor}`, borderRadius: 8, background: "none", color: subColor, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Back</button>
        <span style={{ fontWeight: 700, color: textColor, fontSize: 15 }}>{resubmitData ? "Re-schedule Doubt" : "Schedule Doubt"}</span>
        {resubmitData && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>Resubmitting</span>}
      </div>

      <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: PURPLE }}>{faculty?.faculty_name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 700, color: textColor, fontSize: 15 }}>{faculty?.faculty_name}</div>
              <div style={{ fontSize: 12, color: subColor }}>{faculty?.subject}</div>
              {faculty?.cabin && <div style={{ fontSize: 11, color: subColor }}>Cabin {faculty.cabin} | {faculty.block}</div>}
            </div>
          </div>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: faculty?.status === "available" ? "#dcfce7" : "#fef3c7", color: faculty?.status === "available" ? "#16a34a" : "#d97706", fontSize: 12, fontWeight: 700 }}>{faculty?.status || "unknown"}</span>
        </div>

        {resubmitData?.reject_reason && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Previous rejection reason</div>
            <div style={{ fontSize: 13, color: "#991b1b" }}>{resubmitData.reject_reason}</div>
          </div>
        )}

        <div style={{ display: "flex", marginBottom: 24, background: cardBg, borderRadius: 12, padding: 4, border: `1px solid ${borderColor}` }}>
          {[["1", "Topic", 1], ["2", "Describe + Slot", 2], ["3", "Review", "preview"]].map(([num, label, value]) => (
            <div key={label} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, background: step === value ? PURPLE : "transparent", color: step === value ? "#fff" : subColor, fontSize: 13, fontWeight: step === value ? 700 : 500, transition: "all 0.2s" }}>
              {num}. {label}
            </div>
          ))}
        </div>

        <div style={{ background: cardBg, borderRadius: 16, padding: 28, border: `1px solid ${borderColor}`, boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Subject</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topic: "" })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", background: cardBg, color: textColor }}>
                  {["Web Technology", "Design and Analysis of Algorithms", "ANN and Machine Learning", "Computer Networks", "Data Analytics", "Universal Human Values", "Aptitude", "Soft Skills"].map((subject) => <option key={subject}>{subject}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Topic</label>
                <input value={form.topic} onChange={(e) => { setForm({ ...form, topic: e.target.value }); setTopicSearch(e.target.value); }} placeholder="Type or select a topic..." style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: cardBg, color: textColor }} />
                {topicSearch && filteredTopics.length > 0 && (
                  <div style={{ border: `1px solid ${borderColor}`, borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: "auto", background: cardBg, boxShadow: "0 4px 16px rgba(124,58,237,0.1)" }}>
                    {filteredTopics.map((topic) => (
                      <div key={topic} onClick={() => { setForm({ ...form, topic }); setTopicSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: textColor, borderBottom: `1px solid ${borderColor}` }}>
                        {topic}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {topics.slice(0, 6).map((topic) => (
                    <span key={topic} onClick={() => { setForm({ ...form, topic }); setTopicSearch(""); }} style={{ padding: "4px 10px", background: PURPLE_LIGHT, color: PURPLE, borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => form.topic && setStep(2)} style={{ width: "100%", padding: "13px 0", background: form.topic ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})` : "#e2e8f0", color: form.topic ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 700, cursor: form.topic ? "pointer" : "not-allowed", fontSize: 15 }}>Next</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Describe your doubt</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what you tried and where you are stuck..." rows={6} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", background: cardBg, color: textColor }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, marginBottom: 10, display: "block" }}>Estimated duration</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ value: "quick", label: "Quick", sub: "5-10 mins" }, { value: "medium", label: "Medium", sub: "15-20 mins" }, { value: "long", label: "Long", sub: "30+ mins" }].map((option) => (
                    <div key={option.value} onClick={() => setDuration(option.value)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: `2px solid ${duration === option.value ? PURPLE : borderColor}`, background: duration === option.value ? PURPLE_LIGHT : cardBg, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: duration === option.value ? PURPLE : textColor }}>{option.label}</div>
                      <div style={{ fontSize: 11, color: subColor }}>{option.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: textColor }}>Mutually free slots</label>
                  <span style={{ fontSize: 11, color: subColor }}>10-minute reminder scaffolded</span>
                </div>
                {slotsLoading ? (
                  <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${borderColor}`, color: subColor }}>Loading available slots...</div>
                ) : slotError ? (
                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{slotError}</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {availableSlots.map((slot) => {
                      const selected = selectedSlot?.date === slot.date && selectedSlot?.period === slot.period;
                      return (
                        <button key={`${slot.date}-${slot.period}`} onClick={() => setSelectedSlot(slot)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: selected ? `2px solid ${PURPLE}` : `1px solid ${borderColor}`, background: selected ? PURPLE_LIGHT : cardBg, cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: selected ? PURPLE : textColor }}>{slot.relative_label}</div>
                          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{slot.day} | Period {slot.period} | {slot.start} - {slot.end}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px 0", background: "none", border: `1.5px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", color: subColor }}>Back</button>
                <button onClick={() => form.description && selectedSlot && setStep("preview")} style={{ flex: 2, padding: "13px 0", background: form.description && selectedSlot ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})` : "#e2e8f0", color: form.description && selectedSlot ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 700, cursor: form.description && selectedSlot ? "pointer" : "not-allowed", fontSize: 15 }}>Review</button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>R</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: textColor }}>Review your booking</div>
                <div style={{ fontSize: 13, color: subColor, marginTop: 4 }}>Only the selected mutual slot will be booked.</div>
              </div>
              <div style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${borderColor}` }}>
                {[
                  ["Faculty", faculty?.faculty_name],
                  ["Subject", form.subject],
                  ["Topic", form.topic],
                  ["Duration", duration === "quick" ? "Quick" : duration === "medium" ? "Medium" : "Long"],
                  ["Slot", formatSlotText(selectedSlot)],
                  ["Reminder", "10 minutes before the slot"],
                  ["Description", form.description],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "8px 0", borderBottom: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, color: textColor, fontWeight: label === "Description" ? 400 : 600, lineHeight: 1.5 }}>{value}</div>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px 0", background: "none", border: `1.5px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", color: subColor }}>Edit</button>
                <button onClick={submitDoubt} disabled={loading} style={{ flex: 2, padding: "13px 0", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}>
                  {loading ? "Scheduling..." : "Schedule Doubt"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
