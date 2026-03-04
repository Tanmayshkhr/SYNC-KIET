import { useState, useEffect, useCallback } from "react";

let addToastGlobal = null;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, duration);
  }, []);

  useEffect(() => { addToastGlobal = addToast; }, [addToast]);

  return { toasts, addToast };
}

export function showToast(message, type = "info") {
  if (addToastGlobal) addToastGlobal(message, type);
}

const typeConfig = {
  success: { bg: "#dcfce7", border: "#86efac", color: "#166534", icon: "✅" },
  error: { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b", icon: "❌" },
  warning: { bg: "#fef3c7", border: "#fcd34d", color: "#92400e", icon: "⚠️" },
  info: { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af", icon: "ℹ️" },
};

export default function ToastContainer({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 10000,
      display: "flex", flexDirection: "column", gap: 10,
      maxWidth: "min(380px, calc(100vw - 40px))",
      pointerEvents: "none"
    }}>
      {toasts.map(toast => {
        const cfg = typeConfig[toast.type] || typeConfig.info;
        return (
          <div key={toast.id} style={{
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 10, padding: "12px 16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", gap: 10,
            animation: toast.exiting ? "toastOut 0.35s ease forwards" : "toastIn 0.35s ease",
            pointerEvents: "auto"
          }}>
            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color, flex: 1 }}>{toast.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn { from { opacity:0; transform:translateX(80px); } to { opacity:1; transform:translateX(0); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(80px); } }
      `}</style>
    </div>
  );
}
