import { useState } from "react";

const API = "http://localhost:8000";

export default function Login({ setUser }) {
  const [tab, setTab] = useState("student");
  const [mode, setMode] = useState("login"); // login or forgot
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotForm, setForgotForm] = useState({ email: "", security_answer: "", new_password: "", confirm_password: "" });
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/${tab}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      setUser({ 
        token: data.token, 
        role: data.role, 
        name: data.name,
        needs_security_setup: data.needs_security_setup
      });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fetchSecurityQuestion = async () => {
    if (!forgotForm.email) {
      setError("Please enter your email first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/security-question/${tab}/${forgotForm.email}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Email not found");
      setSecurityQuestion(data.security_question);
      setForgotStep(2);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (forgotForm.new_password !== forgotForm.confirm_password) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/forgot-password/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotForm.email,
          security_answer: forgotForm.security_answer,
          new_password: forgotForm.new_password
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setSuccess("Password reset successfully! Please login.");
      setMode("login");
      setForgotStep(1);
      setForgotForm({ email: "", security_answer: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>P</div>
          <div>
            <h1 style={styles.logoText}>PuchoKIET</h1>
            <p style={styles.logoSub}>AI-Powered Doubt Resolution System</p>
          </div>
        </div>

        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === "student" ? styles.tabActive : {}) }}
            onClick={() => { setTab("student"); setError(""); setSuccess(""); }}>
            Student
          </button>
          <button style={{ ...styles.tab, ...(tab === "faculty" ? styles.tabActive : {}) }}
            onClick={() => { setTab("faculty"); setError(""); setSuccess(""); }}>
            Faculty
          </button>
          <button style={{ ...styles.tab, ...(tab === "admin" ? styles.tabActive : {}) }}
            onClick={() => { setTab("admin"); setError(""); setSuccess(""); }}>
            Admin
          </button>
        </div>

        {success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {success}
          </div>
        )}

        {mode === "login" && (
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email"
                placeholder={tab === "student" ? "rollno@kiet.edu" : "code@kiet.edu"}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password"
                placeholder={tab === "student" ? "Your roll number" : "faculty123"}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : `Login as ${tab === "student" ? "Student" : "Faculty"}`}
            </button>
            <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: "#1a73e8", cursor: "pointer", fontSize: 13, marginTop: 4 }}>
              Forgot Password?
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div style={styles.form}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 16 }}>
              Reset Password — Step {forgotStep} of 2
            </div>

            {forgotStep === 1 && (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Enter your registered email</label>
                  <input style={styles.input} type="email"
                    placeholder={tab === "student" ? "rollno@kiet.edu" : "code@kiet.edu"}
                    value={forgotForm.email}
                    onChange={e => setForgotForm({ ...forgotForm, email: e.target.value })} />
                </div>
                {error && <div style={styles.error}>{error}</div>}
                <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
                  onClick={fetchSecurityQuestion} disabled={loading}>
                  {loading ? "Checking..." : "Continue"}
                </button>
              </>
            )}

            {forgotStep === 2 && (
              <>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#1e40af" }}>
                  Security Question: <b>{securityQuestion}</b>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Your Answer</label>
                  <input style={styles.input} type="text"
                    placeholder="Type your answer"
                    value={forgotForm.security_answer}
                    onChange={e => setForgotForm({ ...forgotForm, security_answer: e.target.value })} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>New Password</label>
                  <input style={styles.input} type="password"
                    placeholder="Enter new password"
                    value={forgotForm.new_password}
                    onChange={e => setForgotForm({ ...forgotForm, new_password: e.target.value })} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input style={styles.input} type="password"
                    placeholder="Confirm new password"
                    value={forgotForm.confirm_password}
                    onChange={e => setForgotForm({ ...forgotForm, confirm_password: e.target.value })} />
                </div>
                {error && <div style={styles.error}>{error}</div>}
                <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
                  onClick={handleForgotPassword} disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </>
            )}

            <button onClick={() => { setMode("login"); setForgotStep(1); setError(""); }}
              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 13, marginTop: 4 }}>
              ← Back to Login
            </button>
          </div>
        )}

        <div style={styles.hint}>
          {tab === "student"
            ? "Email: rollnumber@kiet.edu | Password: roll number"
            : "Email: facultycode@kiet.edu | Password: faculty123"}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" },
  card: { background: "#ffffff", borderRadius: 16, padding: 40, width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  logo: { display: "flex", alignItems: "center", gap: 14, marginBottom: 32 },
  logoIcon: { width: 48, height: 48, borderRadius: 12, background: "#1a73e8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 },
  logoText: { fontSize: 22, fontWeight: 800, color: "#1a73e8", margin: 0 },
  logoSub: { fontSize: 12, color: "#666", margin: 0 },
  tabs: { display: "flex", background: "#f0f4f8", borderRadius: 10, padding: 4, marginBottom: 28 },
  tab: { flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: "none", fontSize: 14, fontWeight: 600, color: "#666", cursor: "pointer" },
  tabActive: { background: "#ffffff", color: "#1a73e8", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#444" },
  input: { padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none" },
  btn: { padding: "13px 0", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 },
  hint: { marginTop: 20, fontSize: 11, color: "#999", textAlign: "center", lineHeight: 1.6 },
};