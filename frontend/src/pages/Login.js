import { useState, useRef, useCallback, useEffect } from "react";

const API = "http://localhost:8000";

export default function Login({ setUser }) {
  const [tab, setTab] = useState("student");
  const [mode, setMode] = useState("login"); // login, forgot, or face
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotForm, setForgotForm] = useState({ email: "", security_answer: "", new_password: "", confirm_password: "" });
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-switch to face mode when faculty tab selected
  useEffect(() => {
    if (tab === "faculty") {
      setMode("face");
    } else {
      if (mode === "face") setMode("login");
    }
    setError("");
    setSuccess("");
  }, [tab]);

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

        {/* Face Login for Faculty (default) */}
        {mode === "face" && tab === "faculty" && (
          <FaceLoginScanner
            onSuccess={(data) => {
              localStorage.setItem("token", data.token);
              localStorage.setItem("role", data.role);
              localStorage.setItem("name", data.name);
              setUser({
                token: data.token,
                role: data.role,
                name: data.name,
                needs_security_setup: data.needs_security_setup
              });
            }}
            onError={(msg) => {
              if (msg === "__switch_manual__") {
                setMode("login");
                setError("");
              } else {
                setError(msg);
              }
            }}
            error={error}
            setError={setError}
          />
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
              {loading ? "Logging in..." : `Login as ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                style={{ background: "none", border: "none", color: "#1a73e8", cursor: "pointer", fontSize: 13 }}>
                Forgot Password?
              </button>
              {tab === "faculty" && (
                <button onClick={() => { setMode("face"); setError(""); }}
                  style={{ background: "none", border: "none", color: "#1a73e8", cursor: "pointer", fontSize: 13 }}>
                  📷 Switch to Face Scan
                </button>
              )}
            </div>
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
            : tab === "faculty" && mode === "face"
            ? "Face scan is the default login for faculty"
            : "Email: facultycode@kiet.edu | Password: faculty123"}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Face Login Scanner (no auth token needed) ─── */
function FaceLoginScanner({ onSuccess, onError, error, setError }) {
  const videoElRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camStatus, setCamStatus] = useState("starting");
  const [message, setMessage] = useState("Starting camera...");
  const [scanning, setScanning] = useState(false);

  // Ref callback — attaches stream to video every time React touches the DOM
  const videoRef = useCallback((node) => {
    videoElRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let stopped = false;

    (async () => {
      try {
        // Pick physical USB camera over virtual (EShare etc.)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        const physicalCam = videoDevices.find(d =>
          d.label.toLowerCase().includes("usb") ||
          d.label.toLowerCase().includes("uvc") ||
          d.label.toLowerCase().includes("webcam") ||
          d.label.toLowerCase().includes("hd camera") ||
          d.label.toLowerCase().includes("integrated")
        );
        const virtualCam = videoDevices.find(d =>
          d.label.toLowerCase().includes("eshare") ||
          d.label.toLowerCase().includes("virtual") ||
          d.label.toLowerCase().includes("obs")
        );
        const preferredCam = physicalCam || videoDevices.find(d => d !== virtualCam) || videoDevices[0];
        console.log("Login camera:", preferredCam?.label || "default");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferredCam
            ? { deviceId: { exact: preferredCam.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
            : { width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;

        const video = videoElRef.current;
        if (video) {
          video.srcObject = stream;
          try { await video.play(); } catch (e) { console.warn("play():", e); }
        }

        // Poll until video actually has frame data
        const check = setInterval(() => {
          const v = videoElRef.current;
          if (v && v.videoWidth > 0 && v.videoHeight > 0) {
            clearInterval(check);
            if (!stopped) {
              setCamStatus("ready");
              setMessage("Position your face and click Scan to login");
            }
          }
        }, 200);

        setTimeout(() => {
          clearInterval(check);
          setCamStatus(prev => {
            if (prev === "starting") {
              setMessage("Camera connected but no video feed. Try a different browser or close other apps using the camera.");
              return "error";
            }
            return prev;
          });
        }, 8000);

      } catch {
        if (!stopped) {
          setCamStatus("error");
          setMessage("Camera access denied. Use manual login instead.");
        }
      }
    })();

    return () => {
      stopped = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const captureAndLogin = async () => {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Ensure video has real frames (not 0x0)
    if (!video.videoWidth || !video.videoHeight) {
      setMessage("Camera is still loading. Please wait a moment and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);

    setScanning(true);
    setError("");
    setMessage("Scanning face...");

    try {
      const res = await fetch(`${API}/face/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Welcome, ${data.name}! (${data.confidence}% match)`);
        setCamStatus("success");
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        setTimeout(() => onSuccess(data), 1200);
      } else {
        setMessage(data.detail || "Face not recognized.");
        setCamStatus("ready");
        onError(data.detail || "Face not recognized.");
      }
    } catch {
      setMessage("Network error. Try again or use manual login.");
      setCamStatus("ready");
    }
    setScanning(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Camera Feed */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden",
        background: "#000", aspectRatio: "4/3"
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{
          width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)"
        }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Face guide oval */}
        {(camStatus === "ready" || camStatus === "starting") && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 150, height: 200,
            border: "3px dashed rgba(255,255,255,0.5)",
            borderRadius: "50%", pointerEvents: "none"
          }} />
        )}

        {/* Scanning overlay */}
        {scanning && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ color: "#fff", fontWeight: 700, textAlign: "center" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #fff",
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite", margin: "0 auto 10px"
              }} />
              Verifying...
            </div>
          </div>
        )}

        {/* Success overlay */}
        {camStatus === "success" && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "14px 24px", textAlign: "center"
            }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>✅</div>
              <div style={{ fontWeight: 700, color: "#166534", fontSize: 14 }}>Verified!</div>
            </div>
          </div>
        )}
      </div>

      {/* Status message */}
      <div style={{
        padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: "center",
        background: camStatus === "success" ? "#dcfce7" : camStatus === "error" ? "#fee2e2" : "#eff6ff",
        color: camStatus === "success" ? "#166534" : camStatus === "error" ? "#991b1b" : "#1e40af"
      }}>
        {message}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Buttons */}
      {camStatus === "ready" && (
        <button onClick={captureAndLogin} disabled={scanning} style={{
          ...styles.btn, opacity: scanning ? 0.7 : 1, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 8
        }}>
          📷 Scan Face to Login
        </button>
      )}

      <button onClick={() => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      }}
        style={{ display: "none" }} className="face-cleanup" />

      <div style={{ textAlign: "center", marginTop: 2 }}>
        <span style={{ fontSize: 12, color: "#999" }}>Having trouble? </span>
        <button onClick={() => {
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          // Access parent's setMode via a trick: we call onError with a special signal
          onError("__switch_manual__");
        }}
          style={{ background: "none", border: "none", color: "#1a73e8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          Use Manual Login →
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" },
  card: { background: "#ffffff", borderRadius: 16, padding: 40, width: "min(420px, calc(100vw - 32px))", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", boxSizing: "border-box" },
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