import { useState, useRef, useCallback, useEffect } from "react";

const API = "http://localhost:8000";

export default function FaceScanner({ user, onComplete, onClose, action, darkMode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting, ready, capturing, success, error
  const [message, setMessage] = useState("Starting camera...");
  const [confidence, setConfidence] = useState(null);

  const cardBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a1a";
  const subColor = darkMode ? "#94a3b8" : "#666";

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus("ready");
      setMessage(action === "register" ? "Position your face clearly and click Capture" : "Look at the camera and click Scan");
    } catch (err) {
      console.error("Camera error:", err);
      setStatus("error");
      setMessage("Camera access denied. Please allow camera permission.");
    }
  }, [action]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [startCamera]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const handleScan = async () => {
    setStatus("capturing");
    setMessage("Scanning face...");

    const imageData = captureFrame();
    if (!imageData) {
      setStatus("error");
      setMessage("Failed to capture image.");
      return;
    }

    try {
      const endpoint = action === "register" ? "/face/register" : "/face/scan";
      const body = action === "register"
        ? { image: imageData }
        : { image: imageData, action: action === "check_in" ? "check_in" : "check_out" };

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
        if (data.confidence) setConfidence(data.confidence);
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        // Auto-close after 2s
        setTimeout(() => onComplete && onComplete(data), 2000);
      } else {
        setStatus("error");
        setMessage(data.detail || "Face scan failed. Try again.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const retryEnabled = status === "error" || status === "ready";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: cardBg, borderRadius: 16, padding: 28,
        width: "min(500px, calc(100vw - 32px))",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: textColor }}>
              {action === "register" ? "📷 Register Face" : action === "check_in" ? "🟢 Check In" : "🔴 Check Out"}
            </div>
            <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
              {action === "register" ? "One-time face registration" : "Face verification"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer", color: subColor
          }}>✕</button>
        </div>

        {/* Video Feed */}
        <div style={{
          position: "relative", borderRadius: 12, overflow: "hidden",
          background: "#000", marginBottom: 16, aspectRatio: "4/3"
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: "scaleX(-1)" // Mirror
          }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Overlay */}
          {status === "capturing" && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                <div style={{
                  width: 36, height: 36, border: "3px solid #fff",
                  borderTopColor: "transparent", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 10px"
                }} />
                Scanning...
              </div>
            </div>
          )}

          {status === "success" && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{
                background: "#fff", borderRadius: 16, padding: "16px 28px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, color: "#166534" }}>Verified!</div>
                {confidence && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{confidence}% match</div>}
              </div>
            </div>
          )}

          {/* Face Guide Oval */}
          {(status === "ready" || status === "starting") && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 180, height: 240,
              border: "3px dashed rgba(255,255,255,0.5)",
              borderRadius: "50%",
              pointerEvents: "none"
            }} />
          )}
        </div>

        {/* Status Message */}
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16,
          background: status === "success" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#eff6ff",
          color: status === "success" ? "#166534" : status === "error" ? "#991b1b" : "#1e40af",
          fontSize: 13, fontWeight: 600, textAlign: "center"
        }}>
          {message}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {retryEnabled && (
            <button onClick={handleScan} style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: action === "check_out" ? "#ef4444" : "#1a73e8",
              color: "#fff", border: "none", fontWeight: 700,
              fontSize: 14, cursor: "pointer"
            }}>
              {action === "register" ? "📷 Capture" : "🔍 Scan Face"}
            </button>
          )}
          {status === "error" && (
            <button onClick={() => { setStatus("ready"); setMessage("Try again"); }} style={{
              padding: "12px 20px", borderRadius: 10,
              background: "#f1f5f9", color: "#333", border: "none",
              fontWeight: 700, fontSize: 14, cursor: "pointer"
            }}>
              Retry
            </button>
          )}
          <button onClick={onClose} style={{
            padding: "12px 20px", borderRadius: 10,
            background: "transparent", color: subColor,
            border: `1px solid ${darkMode ? "#334155" : "#e0e0e0"}`,
            fontWeight: 600, fontSize: 14, cursor: "pointer"
          }}>
            Cancel
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
