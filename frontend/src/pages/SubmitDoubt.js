import { useState } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

const SUBJECT_TOPICS = {
  "Design and Analysis of Algorithms": [
    "Substitution Method", "Master's Theorem", "Shell Sort", "Tim Sort",
    "Counting Sort", "Radix Sort", "Bucket Sort", "Fractional Knapsack",
    "Activity Selection", "Task Scheduling", "Kruskal's Algorithm", "Prim's Algorithm",
    "Dijkstra's Algorithm", "Bellman Ford", "Dynamic Programming Intro",
    "0-1 Knapsack", "Coin Change Problem", "LCS", "Matrix Chain Multiplication",
    "Floyd Warshall", "N-Queen Problem", "Graph Coloring", "Travelling Salesman",
    "KMP Algorithm", "Rabin Karp", "Boyer Moore", "NP Completeness", "NP Hard"
  ],
  "Computer Networks": [
    "OSI Model", "TCP/IP Model", "Network Topologies", "Transmission Media",
    "Switching Techniques", "Framing", "Error Detection", "Error Correction",
    "Flow Control", "Sliding Window Protocol", "ALOHA", "CSMA/CD", "CSMA/CA",
    "Ethernet", "WiFi 802.11", "Bluetooth", "Subnetting", "Supernetting",
    "NAT", "IPv4", "IPv6", "RIP", "OSPF", "BGP", "Distance Vector Routing",
    "Link State Routing", "UDP", "TCP", "Congestion Control", "Leaky Bucket",
    "Token Bucket", "DNS", "HTTP", "FTP", "SMTP", "Cryptography",
    "Symmetric Key", "Asymmetric Key", "Digital Signature"
  ],
  "Web Technology": [
    "Node.js Basics", "Event Loop", "Callbacks", "Async Programming",
    "WebSockets", "EventEmitter", "Node Streams", "Express Routing",
    "Middleware", "EJS Templating", "React Components", "React Hooks",
    "useState", "useEffect", "Redux", "Context API", "Props vs State",
    "RESTful API", "HTTP Methods", "MongoDB CRUD", "Mongoose",
    "SQL vs NoSQL", "Flask Routing", "Jinja2", "Flask REST API",
    "Django MVC", "Django Models", "Django Views", "URL Routing",
    "React-Express Integration"
  ],
  "ANN and Machine Learning": [
    "Supervised Learning", "Unsupervised Learning", "Reinforcement Learning",
    "Linear Regression", "Logistic Regression", "Decision Tree", "Random Forest",
    "SVM", "K-Means Clustering", "KNN Algorithm", "Naive Bayes",
    "Gradient Descent", "Overfitting", "Underfitting", "Cross Validation",
    "Confusion Matrix", "Precision Recall", "Neural Networks Basics",
    "Activation Functions", "Backpropagation", "CNN", "RNN", "LSTM",
    "Perceptron", "Multilayer Perceptron", "Dropout", "Batch Normalization"
  ],
  "Data Analytics": [
    "Data Preprocessing", "Data Cleaning", "Handling Missing Values",
    "Outlier Detection", "Feature Engineering", "Feature Selection",
    "Exploratory Data Analysis", "Data Visualization", "Pandas",
    "NumPy", "Matplotlib", "Seaborn", "Correlation Analysis",
    "Hypothesis Testing", "Statistical Inference", "Regression Analysis",
    "Classification", "Clustering", "Dimensionality Reduction", "PCA",
    "Time Series Analysis", "Data Wrangling", "GroupBy Operations",
    "Pivot Tables", "Dashboard Creation"
  ],
  "Universal Human Values": [
    "Human Values Basics", "Self Exploration", "Harmony in Family",
    "Harmony in Society", "Harmony with Nature", "Right Understanding",
    "Ethical Human Conduct", "Professional Ethics"
  ],
  "Aptitude": [
    "Number System", "Percentages", "Profit and Loss", "Time and Work",
    "Time Speed Distance", "Ratio Proportion", "Averages", "Probability",
    "Permutation Combination", "Logical Reasoning", "Verbal Ability"
  ],
  "Soft Skills": [
    "Communication Skills", "Group Discussion", "Interview Skills",
    "Resume Writing", "Presentation Skills", "Email Writing", "Leadership"
  ]
};

export default function SubmitDoubt({ user, faculty, onBack, onSubmitted, darkMode }) {
  const bg = darkMode ? "#0f172a" : "#f0f4f8";
  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";
  const borderColor = darkMode ? "#334155" : "#e0e0e0";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    subject: faculty?.subject || "",
    topic: "",
    description: "",
    faculty_id: faculty?.faculty_code || "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const topics = SUBJECT_TOPICS[form.subject] || [];
  const filteredTopics = topics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase()));

  const getFacultyId = async () => {
    try {
      const res = await fetch(`${API}/auth/faculty/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${faculty.faculty_code.toLowerCase()}@kiet.edu`,
          password: "faculty123"
        })
      });
      const data = await res.json();
      return data.token ? JSON.parse(atob(data.token.split(".")[1])).id : null;
    } catch {
      return null;
    }
  };

  const submitDoubt = async () => {
    if (!form.topic || !form.description) {
      setError("Please fill all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const facultyId = await getFacultyId();
      if (!facultyId) throw new Error("Could not find faculty");

      const res = await fetch(`${API}/doubts/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          subject: form.subject,
          topic: form.topic,
          description: form.description,
          faculty_id: facultyId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit");
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (step === 3 && result) return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s" }}>
      <div style={{ background: cardBg, borderRadius: 16, padding: 40, maxWidth: 480, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>✓</div>
        <h2 style={{ color: "#10b981", margin: "0 0 8px" }}>Doubt Submitted!</h2>
        <p style={{ color: subColor, marginBottom: 24 }}>Your doubt has been added to the queue</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[
            ["Queue Position", `#${result.queue_position}`],
            ["Est. Wait", result.estimated_wait],
            ["Faculty Status", result.faculty_status || "unknown"]
          ].map(([l, v]) => (
            <div key={l} style={{ background: bg, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: BLUE }}>{v}</div>
              <div style={{ fontSize: 11, color: subColor, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        {result.cluster_info?.grouped && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontWeight: 700, color: BLUE, marginBottom: 6 }}>AI Group Session Created!</div>
            <div style={{ fontSize: 13, color: "#444" }}>
              {result.cluster_info.students?.length} students with similar doubts about <b>{result.cluster_info.cluster_name}</b> have been grouped together.
            </div>
            <div style={{ fontSize: 12, color: subColor, marginTop: 6 }}>{result.cluster_info.recommendation}</div>
          </div>
        )}

        {result.next_free_slot && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#059669" }}>
              Next available slot: <b>{result.next_free_slot.start} - {result.next_free_slot.end}</b>
            </div>
          </div>
        )}

        <button onClick={onSubmitted}
          style={{ width: "100%", padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
          View My Doubts
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      {/* Navbar */}
      <div style={{ background: cardBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", gap: 16, height: 64 }}>
        <button onClick={onBack} style={{ padding: "8px 16px", border: `1px solid ${borderColor}`, borderRadius: 8, background: "none", color: subColor, cursor: "pointer" }}>← Back</button>
        <span style={{ fontWeight: 700, color: textColor }}>Submit Doubt</span>
      </div>

      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
        {/* Faculty Info */}
        <div style={{ background: cardBg, borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: textColor }}>{faculty?.faculty_name}</div>
            <div style={{ fontSize: 13, color: subColor }}>{faculty?.subject}</div>
          </div>
          <span style={{ padding: "4px 12px", borderRadius: 20, background: "#d1fae5", color: "#10b981", fontSize: 12, fontWeight: 700 }}>
            {faculty?.status}
          </span>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", marginBottom: 24 }}>
          {["Topic", "Describe", "Submit"].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center", paddingBottom: 10, borderBottom: `2px solid ${step === i + 1 ? BLUE : borderColor}`, color: step === i + 1 ? BLUE : "#999", fontSize: 13, fontWeight: step === i + 1 ? 700 : 400 }}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div style={{ background: cardBg, borderRadius: 12, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Subject</label>
                <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", background: cardBg, color: textColor }}>
                  {["Web Technology", "Design and Analysis of Algorithms", "ANN and Machine Learning", "Computer Networks", "Data Analytics", "Universal Human Values", "Aptitude", "Soft Skills"].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Topic</label>
                <input value={form.topic} onChange={e => { setForm({ ...form, topic: e.target.value }); setTopicSearch(e.target.value); }}
                  placeholder="Type or select a topic..."
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: cardBg, color: textColor }} />
                {topicSearch && filteredTopics.length > 0 && (
                  <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto", background: cardBg, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    {filteredTopics.map(t => (
                      <div key={t} onClick={() => { setForm({ ...form, topic: t }); setTopicSearch(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: textColor, borderBottom: `1px solid ${borderColor}` }}
                        onMouseEnter={e => e.target.style.background = bg}
                        onMouseLeave={e => e.target.style.background = cardBg}>
                        {t}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {topics.slice(0, 6).map(t => (
                    <span key={t} onClick={() => setForm({ ...form, topic: t })}
                      style={{ padding: "4px 10px", background: "#eff6ff", color: "#1a73e8", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => form.topic && setStep(2)}
                style={{ width: "100%", padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Describe your doubt</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Explain what you've tried and where you're stuck..."
                  rows={6}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", background: cardBg, color: textColor }} />
              </div>
              {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)}
                  style={{ flex: 1, padding: "13px 0", background: "none", border: `1.5px solid ${borderColor}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: subColor }}>
                  Back
                </button>
                <button onClick={submitDoubt} disabled={loading}
                  style={{ flex: 2, padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Submitting..." : "Submit Doubt"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}