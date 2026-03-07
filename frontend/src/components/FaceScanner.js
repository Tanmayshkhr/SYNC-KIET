import { useState, useEffect, useRef } from "react";

const API = "http://localhost:8000";

export default function FaceScanner({ user, action, darkMode, onClose, onComplete }) {
  const [status, setStatus] = useState("loading"); // loading | ready | scanning | success | error
  const [message, setMessage] = useState("Starting camera...");
  const [confidence, setConfidence] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";

  // Called when video element mounts
  const startCamera = async (videoEl) => {
    if (!videoEl || streamRef.current) return;
    try {
const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { 
    width: { exact: 640 }, 
    height: { exact: 480 },
    frameRate: { ideal: 30 }
  } 
});      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.play();
      setStatus("ready");
      setMessage(action === "register"
        ? "Position your face and click Capture"
        : "Look at camera and click Scan");
    } catch (e) {
      setStatus("error");
      setMessage("Camera access denied.");
    }
  };

  useEffect(() => {
    // Try attaching once videoRef is available
    if (videoRef.current) startCamera(videoRef.current);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleScan = async () => {
    const image = capture();
    if (!image) { setMessage("Camera not ready, wait a moment."); return; }
    setStatus("scanning");
    setMessage("Processing...");
    try {
      const endpoint = action === "register" ? "/face/register" : "/face/scan";
      const body = action === "register"
        ? { image }
        : { image, action: action === "check_in" ? "check_in" : "check_out" };
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Success!");
        if (data.confidence) setConfidence(data.confidence);
        streamRef.current?.getTracks().forEach(t => t.stop());
        setTimeout(() => onComplete?.(data), 2000);
      } else {
        setStatus("error");
        setMessage(data.detail || "Failed. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: cardBg, borderRadius: 16, padding: 24, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: textColor }}>
              {action === "register" ? "📷 Register Face" : action === "check_in" ? "🟢 Check In" : "🔴 Check Out"}
            </div>
            <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
              {action === "register" ? "One-time setup" : "Face verification"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: subColor }}>✕</button>
        </div>

        {/* Video */}
        <div style={{ borderRadius: 12, overflow: "hidden", background: "#111", marginBottom: 14, position: "relative" }}>
          <video
            ref={el => { videoRef.current = el; if (el && !streamRef.current) startCamera(el); }}
            autoPlay
            playsInline
            muted
style={{ width: "100%", display: "block", minHeight: 280, transform: "none", objectFit: "fill" }}          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Oval guide */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 160, height: 210, border: "2px dashed rgba(255,255,255,0.5)", borderRadius: "50%", pointerEvents: "none" }} />

          {/* Scanning overlay */}
          {status === "scanning" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "#fff" }}>
                <div style={{ width: 36, height: 36, border: "3px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 700 }}>Scanning...</div>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {status === "success" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: "14px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 38, marginBottom: 6 }}>✅</div>
                <div style={{ fontWeight: 700, color: "#166534" }}>Done!</div>
                {confidence && <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{confidence}% match</div>}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, textAlign: "center", fontSize: 13, fontWeight: 600,
          background: status === "success" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#eff6ff",
          color: status === "success" ? "#166534" : status === "error" ? "#991b1b" : "#1e40af" }}>
          {message}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {status === "ready" && (
            <button onClick={handleScan} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#fff", background: action === "check_out" ? "#ef4444" : "#1a73e8" }}>
              {action === "register" ? "📷 Capture" : "🔍 Scan"}
            </button>
          )}
          {status === "error" && (
            <button onClick={() => window.location.reload()} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "#f1f5f9", color: "#333" }}>
              🔄 Retry
            </button>
          )}
          <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, border: `1px solid ${darkMode ? "#334155" : "#e0e0e0"}`, background: "transparent", color: subColor, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>

        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    </div>
  );
}