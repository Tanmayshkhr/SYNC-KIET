import { useState } from "react";

const API = "http://localhost:8000";
const BLUE = "#1a73e8";

export default function SecuritySetup({ user, onComplete }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [confirmAnswer, setConfirmAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1 = password, 2 = security question

  const isFaculty = user.role === "faculty";

  const handleNext = () => {
    if (!newPassword || !confirmPassword) { setError("Please fill both password fields"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setStep(2);
  };

  const handleSetup = async () => {
    if (!answer) { setError("Please enter your lucky number"); return; }
    if (answer !== confirmAnswer) { setError("Answers do not match"); return; }
    if (isNaN(answer)) { setError("Please enter a valid number"); return; }

    setLoading(true);
    setError("");
    try {
      const body = {
        security_question: "What is your lucky number?",
        security_answer: answer,
      };
      // Always send new password if set
      if (newPassword) body.new_password = newPassword;

      const res = await fetch(`${API}/auth/setup-security`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(body)
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
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, width: "min(440px, calc(100vw - 32px))", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", boxSizing: "border-box" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>🔒</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>First Time Setup</h2>
            <p style={{ color: "#666", fontSize: 13, margin: 0 }}>Step {step} of 2 — {step === 1 ? "Set New Password" : "Security Question"}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: BLUE }} />
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: step === 2 ? BLUE : "#e0e0e0", transition: "background 0.3s" }} />
        </div>

        {isFaculty && step === 1 && (
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#92400e" }}>
            ⚠️ You're using the default faculty password. Please change it now to secure your account.
          </div>
        )}

        {/* STEP 1: New Password */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>New Password</label>
              <input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
              />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <button onClick={handleNext}
              style={{ padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Next →
            </button>
          </div>
        )}

        {/* STEP 2: Security Question */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 700, color: BLUE, fontSize: 14 }}>Security Question:</div>
              <div style={{ color: "#1e40af", fontSize: 15, marginTop: 4 }}>What is your lucky number?</div>
            </div>

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
                value={confirmAnswer}
                onChange={e => setConfirmAnswer(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" }}
              />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStep(1); setError(""); }}
                style={{ flex: 1, padding: "13px 0", background: "#f0f4f8", color: "#666", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ← Back
              </button>
              <button onClick={handleSetup} disabled={loading}
                style={{ flex: 2, padding: "13px 0", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: "#999", textAlign: "center" }}>
          Remember your password and lucky number — you'll need them to recover your account
        </div>
      </div>
    </div>
  );
}