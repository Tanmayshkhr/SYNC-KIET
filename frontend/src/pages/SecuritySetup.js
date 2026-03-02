import { useState } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

export default function SecuritySetup({ user, onComplete }) {
  const [answer, setAnswer] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetup = async () => {
    if (!answer) { setError("Please enter your lucky number"); return; }
    if (answer !== confirm) { setError("Answers do not match"); return; }
    if (isNaN(answer)) { setError("Please enter a valid number"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/setup-security`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          security_question: "What is your lucky number?",
          security_answer: answer
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Setup failed");
      onComplete();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, marginBottom: 20 }}>S</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>One Time Setup</h2>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 28 }}>Set a security answer to protect your account. You'll need this if you forget your password.</p>

        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, color: BLUE, fontSize: 14 }}>Security Question:</div>
          <div style={{ color: "#1e40af", fontSize: 15, marginTop: 4 }}>What is your lucky number?</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>Your Lucky Number</label>
            <input
              type="number"
              placeholder="e.g. 7"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              style={{ padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>Confirm Lucky Number</label>
            <input
              type="number"
              placeholder="Enter again to confirm"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSetup}
            disabled={loading}
            style={{ padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "#999", textAlign: "center" }}>
          Remember this number — you'll need it to reset your password
        </div>
      </div>
    </div>
  );
}