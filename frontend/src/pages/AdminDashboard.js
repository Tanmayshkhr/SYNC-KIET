import { useState, useEffect, useRef } from "react";
import ToastContainer, { useToast } from "../components/Toast";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const BLUE = "#2563eb";
const COLORS = [PURPLE, BLUE, GREEN, AMBER, RED, "#f97316", "#06b6d4", "#ec4899"];

// ── Theme ──────────────────────────────────────────────────────────────
const T = (dark) => ({
  bg:      dark ? "#0d0f1a" : "#f8f7ff",
  nav:     dark ? "#0a0c14" : "#ffffff",
  card:    dark ? "#13162a" : "#ffffff",
  surface: dark ? "#1a1d30" : "#f8f7ff",
  border:  dark ? "#252840" : "#ede9fe",
  text:    dark ? "#f0f2ff" : "#0d0f1a",
  sub:     dark ? "#6b7099" : "#6b7280",
  muted:   dark ? "#3d4060" : "#9ca3af",
  hover:   dark ? "#1e2240" : "#f5f3ff",
  shadow:  dark ? "0 4px 24px rgba(0,0,0,0.5)" : "0 4px 24px rgba(99,102,241,0.08)",
});

const css = (dark) => `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${dark?"#0d0f1a":"#f8f7ff"}; transition: background 0.3s; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
  @keyframes notifDrop { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ringBell { 0%,100%{transform:rotate(0)} 20%{transform:rotate(15deg)} 40%{transform:rotate(-15deg)} 60%{transform:rotate(10deg)} 80%{transform:rotate(-10deg)} }
  .fade-up { animation: fadeUp 0.32s ease both; }
  .nav-link { transition: all 0.15s ease; cursor: pointer; border-radius: 10px; }
  .nav-link:hover { background: ${dark?"#1e2240":"#f5f3ff"} !important; color: ${PURPLE} !important; }
  .nav-link.active { background: ${dark?"rgba(124,58,237,0.2)":"#ede9fe"} !important; color: ${PURPLE} !important; font-weight: 700 !important; }
  .stat-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
  .stat-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(124,58,237,0.18) !important; }
  .row-hover:hover { background: ${dark?"#1e2240":"#f9f7ff"} !important; }
  .btn { transition: all 0.15s ease; cursor: pointer; }
  .btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn-primary { background: linear-gradient(135deg,${PURPLE},${PURPLE_DARK}); color: #fff; border: none; border-radius: 10px; font-weight: 700; padding: 10px 20px; font-size: 13px; }
  .btn-danger { background: ${dark?"#450a0a":"#fee2e2"}; color: ${RED}; border: none; border-radius: 8px; font-weight: 600; padding: 6px 12px; font-size: 12px; }
  .btn-success { background: ${dark?"#052e16":"#dcfce7"}; color: #16a34a; border: none; border-radius: 8px; font-weight: 600; padding: 6px 12px; font-size: 12px; }
  .chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .skeleton { background: linear-gradient(90deg,${dark?"#1e2240 25%,#252840 50%,#1e2240 75%":"#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%"}); background-size: 600px 100%; animation: shimmer 1.5s ease infinite; border-radius: 8px; }
  .tab-btn { transition: all 0.15s; cursor: pointer; }
  .tab-btn.active { background: ${PURPLE} !important; color: #fff !important; }
  .donut-segment { transition: all 0.2s ease; cursor: pointer; }
  .donut-segment:hover { filter: brightness(1.15); }
  .bar-col { transition: all 0.2s ease; cursor: pointer; }
  .bar-col:hover { filter: brightness(1.2); }
  .bell-animate { animation: ringBell 0.6s ease; }
  .notif-panel { animation: notifDrop 0.2s ease; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${dark?"#252840":"#ddd6fe"}; border-radius: 4px; }
`;

// ── Interactive Bar Chart ──────────────────────────────────────────────
const BarChart = ({ data = [], dark, onBarClick }) => {
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const theme = T(dark);
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ position: "relative" }}>
      {tooltip && (
        <div style={{ position: "absolute", top: -36, left: tooltip.x - 40, background: dark?"#252840":"#1a1a2e", color: "#fff", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {tooltip.label}: {tooltip.count} doubt{tooltip.count !== 1 ? "s" : ""}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 3);
          const isHov = hovered === i;
          return (
            <div key={i} className="bar-col" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              onMouseEnter={e => { setHovered(i); setTooltip({ label: d.label, count: d.count, x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2 }); }}
              onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              onClick={() => onBarClick && onBarClick(d)}>
              <span style={{ fontSize: 11, fontWeight: 800, color: d.count > 0 ? PURPLE : theme.muted, opacity: isHov ? 1 : 0.8 }}>{d.count || ""}</span>
              <div style={{ width: "100%", borderRadius: "6px 6px 0 0", height: `${h}px`, background: d.count > 0 ? `linear-gradient(180deg,${isHov?"#a78bfa":PURPLE},${PURPLE_DARK})` : theme.border, transition: "all 0.3s ease", boxShadow: isHov && d.count > 0 ? `0 -4px 16px ${PURPLE}55` : "none" }} />
              <span style={{ fontSize: 10, color: isHov ? PURPLE : theme.muted, fontWeight: isHov ? 700 : 600 }}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Interactive Donut Chart ────────────────────────────────────────────
const DonutChart = ({ data = [], total, dark, onSegmentClick }) => {
  const [hovered, setHovered] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const theme = T(dark);
  const radius = 54, cx = 68, cy = 68, strokeW = 20;
  const circ = 2 * Math.PI * radius;
  const sum = data.reduce((a, b) => a + (b.count || 0), 0) || 1;
  let offset = 0;

  const active = selectedSegment !== null ? data[selectedSegment] : hovered !== null ? data[hovered] : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={136} height={136} viewBox="0 0 136 136" style={{ overflow: "visible" }}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke={dark?"#252840":"#f1f5f9"} strokeWidth={strokeW} />
          {data.map((d, i) => {
            const pct = (d.count || 0) / sum;
            const dash = pct * circ;
            const isActive = hovered === i || selectedSegment === i;
            const el = (
              <circle key={i} className="donut-segment" cx={cx} cy={cy} r={isActive ? radius + 3 : radius}
                fill="none" stroke={COLORS[i % COLORS.length]}
                strokeWidth={isActive ? strokeW + 4 : strokeW}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset * circ}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ filter: isActive ? `drop-shadow(0 0 8px ${COLORS[i % COLORS.length]}88)` : "none", transition: "all 0.2s ease" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelectedSegment(selectedSegment === i ? null : i); onSegmentClick && onSegmentClick(d); }}
              />
            );
            offset += pct;
            return el;
          })}
        </svg>
        {/* Center label */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {active ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS[hovered ?? selectedSegment ?? 0], transition: "all 0.2s" }}>{active.count}</div>
              <div style={{ fontSize: 9, color: theme.muted, fontWeight: 600, textAlign: "center", maxWidth: 60, lineHeight: 1.2 }}>{active.label?.slice(0, 12)}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>{total ?? sum}</div>
              <div style={{ fontSize: 10, color: theme.muted, fontWeight: 600 }}>Total</div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.slice(0, 6).map((d, i) => {
          const pct = Math.round((d.count / sum) * 100);
          const isActive = hovered === i || selectedSegment === i;
          return (
            <div key={i} className="bar-col" onClick={() => { setSelectedSegment(selectedSegment === i ? null : i); onSegmentClick && onSegmentClick(d); }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8, background: isActive ? `${COLORS[i % COLORS.length]}15` : "transparent", border: isActive ? `1px solid ${COLORS[i % COLORS.length]}44` : "1px solid transparent", transition: "all 0.2s" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0, boxShadow: isActive ? `0 0 6px ${COLORS[i % COLORS.length]}` : "none" }} />
              <span style={{ fontSize: 12, color: isActive ? theme.text : theme.sub, fontWeight: isActive ? 700 : 500, flex: 1 }}>{d.label?.slice(0, 22)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{d.count}</span>
              <span style={{ fontSize: 10, color: theme.muted, minWidth: 30, textAlign: "right" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Status Chip ────────────────────────────────────────────────────────
const StatusChip = ({ status }) => {
  const map = { pending:{bg:"#fef3c7",color:AMBER,label:"Pending"}, active:{bg:"#dbeafe",color:BLUE,label:"Active"}, completed:{bg:"#dcfce7",color:"#16a34a",label:"Completed"}, rejected:{bg:"#fee2e2",color:RED,label:"Rejected"} };
  const c = map[status] || {bg:"#f1f5f9",color:"#64748b",label:status};
  return <span className="chip" style={{background:c.bg,color:c.color}}>{c.label}</span>;
};

// ── Notification Bell ──────────────────────────────────────────────────
const NotificationBell = ({ doubts, announcements, dark }) => {
  const [open, setOpen] = useState(false);
  const [bellAnim, setBellAnim] = useState(false);
  const [read, setRead] = useState([]);
  const theme = T(dark);
  const ref = useRef(null);

  const notifications = [
    ...doubts.filter(d => d.status === "pending").slice(0, 5).map(d => ({
      id: d._id, type: "doubt", icon: "📋", color: AMBER,
      title: "New Doubt Pending",
      body: `${d.student_name} — ${d.topic?.slice(0,30)}`,
      time: d.created_at?.slice(0,16)?.replace("T"," "),
    })),
    ...announcements.slice(0,3).map((a,i) => ({
      id: `ann-${i}`, type: "announcement", icon: "📢", color: PURPLE,
      title: "Announcement",
      body: a.message?.slice(0,50),
      time: a.created_at?.slice(0,16)?.replace("T"," "),
    })),
  ].slice(0,8);

  const unread = notifications.filter(n => !read.includes(n.id)).length;

  useEffect(() => {
    if (unread > 0) { setBellAnim(true); setTimeout(() => setBellAnim(false), 600); }
  }, [unread]);

  useEffect(() => {
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(!open); if (!open) setRead(notifications.map(n => n.id)); }}
        className={`btn ${bellAnim ? "bell-animate" : ""}`}
        style={{ width: 40, height: 40, borderRadius: 12, background: theme.card, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative" }}>
        🔔
        {unread > 0 && (
          <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: RED, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${theme.bg}` }}>{unread}</div>
        )}
      </button>

      {open && (
        <div className="notif-panel" style={{ position: "absolute", top: 48, right: 0, width: 340, background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: theme.text }}>Notifications</div>
            <span style={{ fontSize: 11, background: `${RED}18`, color: RED, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{notifications.length} total</span>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: theme.muted }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>All caught up!</div>
              </div>
            ) : notifications.map((n, i) => (
              <div key={n.id} style={{ padding: "12px 18px", borderBottom: i < notifications.length-1 ? `1px solid ${theme.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start", background: read.includes(n.id) ? "transparent" : `${n.color}08` }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${n.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{n.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: theme.sub, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{n.time}</div>
                </div>
                {!read.includes(n.id) && <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── AI Grouped Modal ───────────────────────────────────────────────────
const GroupedModal = ({ doubts, dark, onClose }) => {
  const theme = T(dark);
  const [expanded, setExpanded] = useState(null);
  const grouped = doubts.filter(d => d.grouped);
  const clusters = {};
  grouped.forEach(d => {
    const key = d.cluster_name || d.cluster_id || "Unknown Group";
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(d);
  });

  const completedCount = (items) => items.filter(d => d.status === "completed").length;
  const pendingCount = (items) => items.filter(d => d.status === "pending").length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: theme.card, borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${theme.border}`, boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>🤝 AI Grouped Sessions</div>
            <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
              {grouped.length} doubts · {Object.keys(clusters).length} sessions · Click a session to expand
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}`, cursor: "pointer", fontSize: 16, color: theme.sub }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.keys(clusters).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: theme.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
              <div>No grouped doubts yet</div>
            </div>
          ) : Object.entries(clusters).map(([name, items], gi) => {
            const isOpen = expanded === gi;
            const done = completedCount(items);
            const pending = pendingCount(items);
            const facultyNames = [...new Set(items.map(d => d.faculty_name).filter(Boolean))];
            return (
              <div key={gi} style={{ background: theme.surface, borderRadius: 14, overflow: "hidden", border: `1px solid ${isOpen ? PURPLE : theme.border}`, transition: "border 0.2s" }}>
                {/* Header — clickable to expand */}
                <div onClick={() => setExpanded(isOpen ? null : gi)} style={{ padding: "14px 18px", background: isOpen ? `${PURPLE}18` : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PURPLE}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤝</div>
                    <div>
                      <div style={{ fontWeight: 700, color: isOpen ? PURPLE : theme.text, fontSize: 14 }}>{name}</div>
                      <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                        {items.length} students
                        {facultyNames.length > 0 && <span style={{ marginLeft: 8, color: BLUE }}>· 👨‍🏫 {facultyNames[0]?.slice(0,20)}</span>}
                        {items[0]?.subject && <span style={{ marginLeft: 8 }}>· {items[0].subject?.slice(0,18)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {done > 0 && <span className="chip" style={{ background: "#dcfce7", color: "#16a34a" }}>✅ {done} done</span>}
                    {pending > 0 && <span className="chip" style={{ background: "#fef3c7", color: AMBER }}>⏳ {pending}</span>}
                    <span style={{ fontSize: 18, color: theme.muted, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
                  </div>
                </div>

                {/* Expanded student rows */}
                {isOpen && (
                  <div>
                    {/* Column headers */}
                    <div style={{ display: "flex", padding: "8px 18px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
                      {[["Student",160],["Topic",140],["Subject",130],["Faculty",150],["Status",100]].map(([h,w]) => (
                        <div key={h} style={{ flex: `0 0 ${w}px`, fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
                      ))}
                    </div>
                    {items.map((d, i) => (
                      <div key={i} style={{ display: "flex", padding: "12px 18px", borderTop: `1px solid ${theme.border}`, alignItems: "flex-start", gap: 0, background: i % 2 === 0 ? "transparent" : `${theme.surface}66` }}>
                        <div style={{ flex: "0 0 160px", minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{d.student_name}</div>
                          <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>{d.created_at?.slice(0,10)}</div>
                        </div>
                        <div style={{ flex: "0 0 140px", fontSize: 12, color: theme.sub }}>{d.topic?.slice(0,22)}{d.topic?.length>22?"…":""}</div>
                        <div style={{ flex: "0 0 130px", fontSize: 11, color: theme.muted }}>{d.subject?.slice(0,18)}</div>
                        <div style={{ flex: "0 0 150px", fontSize: 12, color: d.faculty_name ? BLUE : theme.muted, fontWeight: d.faculty_name ? 600 : 400 }}>
                          {d.faculty_name ? `👨‍🏫 ${d.faculty_name?.slice(0,18)}` : "—"}
                        </div>
                        <div style={{ flex: "0 0 100px" }}><StatusChip status={d.status} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Bar Date Filter Modal ──────────────────────────────────────────────
const BarDrillModal = ({ day, doubts, dark, onClose }) => {
  const theme = T(dark);
  const dayDoubts = doubts.filter(d => {
    if (!d.created_at) return false;
    const dd = new Date(d.created_at);
    return dd.toLocaleDateString("en-US",{weekday:"short"}) === day.label;
  });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: theme.card, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${theme.border}`, boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>📊 {day.label} — {day.count} Doubt{day.count !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Click bars to drill down into daily data</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}`, cursor: "pointer", fontSize: 16, color: theme.sub }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 24px" }}>
          {dayDoubts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: theme.muted }}>No doubts on {day.label}</div>
          ) : dayDoubts.map((d, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < dayDoubts.length-1 ? `1px solid ${theme.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{d.student_name} → {d.topic?.slice(0,24)}</div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{d.subject?.slice(0,22)}</div>
                {d.faculty_name && <div style={{ fontSize: 11, color: BLUE, marginTop: 2 }}>👨‍🏫 {d.faculty_name}</div>}
              </div>
              <StatusChip status={d.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main AdminDashboard ────────────────────────────────────────────────
export default function AdminDashboard({ user, setUser, darkMode, setDarkMode }) {
  const { toasts, addToast } = useToast();
  const theme = T(darkMode);

  const [page, setPage] = useState("overview");
  const [stats, setStats] = useState({});
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState("");
  const [doubtsFilter, setDoubtsFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetRole, setResetRole] = useState("student");
  const [bulkRole, setBulkRole] = useState("student");
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showBulkPass, setShowBulkPass] = useState(false);

  // Modals
  const [groupedModal, setGroupedModal] = useState(false);
  const [barDrill, setBarDrill] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [facultyFilter, setFacultyFilter] = useState(null);

  const headers = { authorization: `Bearer ${user.token}` };

  useEffect(() => { fetchStats(); fetchAnnouncements(); fetchDoubts(); }, []);
  useEffect(() => {
    if (page === "faculty") fetchFaculty();
    if (page === "students") fetchStudents();
  }, [page]);

  const fetchStats = async () => { try { const r = await fetch(`${API}/admin/stats`, { headers }); setStats(await r.json()); } catch {} };
  const fetchFaculty = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/faculty`, { headers }); const d = await r.json(); setFaculty(d.faculty || []); } catch {} setLoading(false); };
  const fetchStudents = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/students`, { headers }); const d = await r.json(); setStudents(d.students || []); } catch {} setLoading(false); };
  const fetchDoubts = async () => { setLoading(true); try { const r = await fetch(`${API}/admin/doubts`, { headers }); const d = await r.json(); setDoubts(d.doubts || []); } catch {} setLoading(false); };
  const fetchAnnouncements = async () => { try { const r = await fetch(`${API}/admin/announcements`, { headers }); const d = await r.json(); setAnnouncements(d.announcements || []); } catch {} };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) return addToast("Fill all fields!", "warning");
    try { const r = await fetch(`${API}/admin/reset-password`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ email: resetEmail, new_password: resetPassword, role: resetRole }) }); const d = await r.json(); addToast(d.message || "Reset!", "success"); setResetEmail(""); setResetPassword(""); } catch { addToast("Failed!", "error"); }
  };

  const handleBulkReset = async () => {
    if (!bulkPassword || bulkPassword.length < 4) return addToast("Min 4 chars!", "warning");
    if (!window.confirm(`Reset ALL ${bulkRole} passwords to "${bulkPassword}"?`)) return;
    setBulkLoading(true);
    try { const r = await fetch(`${API}/admin/bulk-reset-password`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ role: bulkRole, new_password: bulkPassword }) }); const d = await r.json(); addToast(d.message || "Done!", "success"); setBulkPassword(""); } catch { addToast("Failed!", "error"); }
    setBulkLoading(false);
  };

  const handleDeleteDoubt = async (id) => { if (!window.confirm("Delete?")) return; await fetch(`${API}/admin/doubt/${id}`, { method: "DELETE", headers }); fetchDoubts(); addToast("Deleted!", "success"); };
  const handleForceComplete = async (id) => { await fetch(`${API}/admin/complete-doubt/${id}`, { method: "PUT", headers }); fetchDoubts(); addToast("Completed!", "success"); };

  const handleAnnouncement = async () => {
    if (!announcement.trim()) return addToast("Type a message!", "warning");
    try { const r = await fetch(`${API}/admin/announcement`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: announcement, target: announcementTarget }) }); const d = await r.json(); addToast(d.message || "Sent!", "success"); setAnnouncement(""); fetchAnnouncements(); } catch { addToast("Failed!", "error"); }
  };

  const handleAIAnnouncement = async () => {
    if (!aiPrompt.trim()) return addToast("Enter a prompt!", "warning");
    setAiLoading(true);
    try {
      const r = await fetch(`${API}/admin/generate-announcement`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await r.json();
      if (d.announcement) { setAnnouncement(d.announcement); addToast("AI generated! Review and send.", "success"); }
      else addToast("AI failed. Try again!", "error");
    } catch { addToast("AI generation failed!", "error"); }
    setAiLoading(false);
  };

  // Chart data
  const getWeeklyData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ label, count: doubts.filter(dbt => dbt.created_at?.slice(0, 10) === dateStr).length, date: dateStr });
    }
    return days;
  };

  const getSubjectData = () => {
    const map = {};
    doubts.forEach(d => { if (d.subject) map[d.subject] = (map[d.subject] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  };

  // Dynamic recent activity from actual doubts
  const getRecentActivity = () => {
    return doubts.slice(0, 10).map(d => ({
      icon: d.status === "completed" ? "✅" : d.status === "active" ? "🔵" : d.status === "rejected" ? "❌" : "📋",
      bg: d.status === "completed" ? "#dcfce7" : d.status === "active" ? "#dbeafe" : d.status === "rejected" ? "#fee2e2" : "#fef3c7",
      color: d.status === "completed" ? GREEN : d.status === "active" ? BLUE : d.status === "rejected" ? RED : AMBER,
      text: `${d.student_name} → "${d.topic?.slice(0,22)}"`,
      sub: d.faculty_name ? `👨‍🏫 ${d.faculty_name?.slice(0,18)} · ${d.subject?.slice(0,14)}` : `${d.subject?.slice(0,22)} · No faculty assigned`,
      time: d.created_at ? new Date(d.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
      grouped: d.grouped,
      faculty: d.faculty_name,
    }));
  };

  const filteredDoubts = doubts
    .filter(d => doubtsFilter === "all" || d.status === doubtsFilter)
    .filter(d => d.topic?.toLowerCase().includes(search.toLowerCase()) || d.student_name?.toLowerCase().includes(search.toLowerCase()))
    .filter(d => subjectFilter ? d.subject === subjectFilter : true)
    .filter(d => facultyFilter ? d.faculty_name?.toLowerCase().includes(facultyFilter.toLowerCase()) : true);

  const navItems = [
    { id: "overview", icon: "⊞", label: "Dashboard" },
    { id: "doubts", icon: "📋", label: "Doubts" },
    { id: "faculty", icon: "👨‍🏫", label: "Faculty" },
    { id: "students", icon: "🎓", label: "Students" },
    { id: "announcements", icon: "📢", label: "Announcements" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, fontFamily: "'Plus Jakarta Sans',sans-serif", color: theme.text, transition: "background 0.3s,color 0.3s" }}>
      <style dangerouslySetInnerHTML={{ __html: css(darkMode) }} />
      <ToastContainer toasts={toasts} />

      {/* Modals */}
      {groupedModal && <GroupedModal doubts={doubts} dark={darkMode} onClose={() => setGroupedModal(false)} />}
      {barDrill && <BarDrillModal day={barDrill} doubts={doubts} dark={darkMode} onClose={() => setBarDrill(null)} />}

      {/* SIDEBAR */}
      <div style={{ width: 230, minHeight: "100vh", background: theme.nav, display: "flex", flexDirection: "column", padding: "24px 16px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, borderRight: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, padding: "0 8px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>P</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: theme.text }}>PuchoKIET</div>
            <div style={{ fontSize: 10, color: RED, fontWeight: 700, letterSpacing: 0.5 }}>ADMIN</div>
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: theme.muted, letterSpacing: 1, padding: "0 10px", marginBottom: 8 }}>MAIN MENU</div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <div key={item.id} className={`nav-link${page === item.id ? " active" : ""}`} onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", color: page === item.id ? PURPLE : theme.sub, fontWeight: page === item.id ? 700 : 500, fontSize: 13 }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.id === "doubts" && doubts.filter(d => d.status === "pending").length > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#000", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 6px" }}>{doubts.filter(d => d.status === "pending").length}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: theme.surface, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>A</div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>Admin</div><div style={{ fontSize: 10, color: theme.muted }}>Full Access</div></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: "8px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.text }}>{darkMode ? "☀️" : "🌙"}</button>
            <button className="btn" onClick={() => setUser(null)} style={{ flex: 2, padding: "8px", background: darkMode?"#450a0a":"#fee2e2", border: "none", borderRadius: 8, color: RED, fontSize: 12, fontWeight: 700 }}>Logout</button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: 230, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top Bar */}
        <div style={{ background: theme.nav, borderBottom: `1px solid ${theme.border}`, padding: "0 28px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 99, boxShadow: theme.shadow }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: theme.muted, fontSize: 14 }}>🔍</span>
            <input className="search-input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search students, faculty, doubts..."
              style={{ width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10, border: `1.5px solid ${theme.border}`, fontSize: 13, background: theme.surface, color: theme.text, transition: "border 0.2s" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NotificationBell doubts={doubts} announcements={announcements} dark={darkMode} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", background: theme.surface, borderRadius: 10, border: `1px solid ${theme.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>A</div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>Admin</div><div style={{ fontSize: 10, color: theme.muted }}>KIET</div></div>
            </div>
          </div>
        </div>

        <div style={{ padding: "28px", flex: 1 }}>

          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          {page === "overview" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: 0 }}>Dashboard</h1>
                <p style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
              </div>

              {/* Stats Row - all clickable */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { label: "Total Students", value: stats.total_students, icon: "🎓", color: PURPLE, bg: darkMode?"rgba(124,58,237,0.15)":PURPLE_LIGHT, trend: "+12.4%", up: true, action: () => setPage("students") },
                  { label: "Total Faculty", value: stats.total_faculty, icon: "👨‍🏫", color: BLUE, bg: darkMode?"rgba(37,99,235,0.15)":"#dbeafe", trend: "+2.1%", up: true, action: () => setPage("faculty") },
                  { label: "Doubts Today", value: stats.doubts_today, icon: "📋", color: AMBER, bg: darkMode?"rgba(245,158,11,0.15)":"#fef3c7", trend: "+8.3%", up: true, action: () => setPage("doubts") },
                  { label: "Active Sessions", value: stats.active_sessions, icon: "🟢", color: GREEN, bg: darkMode?"rgba(34,197,94,0.15)":"#dcfce7", trend: "Live", up: true, action: () => { setPage("doubts"); setDoubtsFilter("active"); } },
                ].map((s, i) => (
                  <div key={i} className="stat-card" onClick={s.action} style={{ background: theme.card, borderRadius: 16, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: darkMode?"rgba(34,197,94,0.15)":"#dcfce7", borderRadius: 20, padding: "2px 8px" }}>↑ {s.trend}</span>
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: theme.text, marginBottom: 2 }}>{s.value ?? "—"}</div>
                    <div style={{ fontSize: 12, color: theme.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Secondary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { label: "Pending Doubts", value: stats.pending_doubts, icon: "⏳", color: AMBER, action: () => { setPage("doubts"); setDoubtsFilter("pending"); } },
                  { label: "Completed Today", value: stats.completed_today, icon: "✅", color: GREEN, action: () => { setPage("doubts"); setDoubtsFilter("completed"); } },
                  { label: "AI Grouped", value: stats.grouped_doubts, icon: "🤝", color: PURPLE, action: () => setGroupedModal(true) },
                ].map((s, i) => (
                  <div key={i} className="stat-card" onClick={s.action} style={{ background: theme.card, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 30 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value ?? "—"}</div>
                      <div style={{ fontSize: 12, color: theme.muted }}>{s.label}</div>
                    </div>
                    <div style={{ marginLeft: "auto", fontSize: 18, color: theme.muted }}>→</div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Bar Chart */}
                <div style={{ background: theme.card, borderRadius: 16, padding: 22, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: theme.text, fontSize: 15 }}>Doubts This Week</div>
                      <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Click a bar to see details</div>
                    </div>
                    <span style={{ fontSize: 11, color: theme.muted, background: theme.surface, borderRadius: 8, padding: "4px 10px", border: `1px solid ${theme.border}` }}>Last 7 days</span>
                  </div>
                  <BarChart data={getWeeklyData()} dark={darkMode} onBarClick={d => d.count > 0 && setBarDrill(d)} />
                </div>

                {/* Donut Chart */}
                <div style={{ background: theme.card, borderRadius: 16, padding: 22, border: `1px solid ${theme.border}` }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: theme.text, fontSize: 15 }}>Doubts by Subject</div>
                    <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Click segment to filter doubts</div>
                  </div>
                  {getSubjectData().length > 0 ? (
                    <DonutChart data={getSubjectData()} total={doubts.length} dark={darkMode}
                      onSegmentClick={d => { setSubjectFilter(subjectFilter === d.label ? null : d.label); setPage("doubts"); }} />
                  ) : <div style={{ textAlign: "center", color: theme.muted, padding: 20, fontSize: 13 }}>Loading...</div>}
                </div>
              </div>

              {/* Bottom Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
                {/* Recent Doubts Table */}
                <div style={{ background: theme.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                  <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>Recent Doubts</div>
                    <button className="btn" onClick={() => setPage("doubts")} style={{ background: "none", border: "none", color: PURPLE, fontSize: 12, fontWeight: 700 }}>See All →</button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: theme.surface }}>
                        {["Student","Topic","Subject","Status"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doubts.slice(0, 6).map((d, i) => (
                        <tr key={i} className="row-hover" style={{ borderTop: `1px solid ${theme.border}` }}>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: theme.text }}>{d.student_name}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: theme.sub }}>{d.topic?.slice(0,18)}{d.topic?.length>18?"…":""}</td>
                          <td style={{ padding: "12px 16px", fontSize: 11, color: theme.muted }}>{d.subject?.slice(0,14)}</td>
                          <td style={{ padding: "12px 16px" }}><StatusChip status={d.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Dynamic Recent Activity */}
                <div style={{ background: theme.card, borderRadius: 16, padding: 20, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>Recent Activity</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "pulse 2s infinite" }} />
                      <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>LIVE</span>
                    </div>
                  </div>
                  {announcements.length > 0 && (
                    <div style={{ background: `${PURPLE}15`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${PURPLE}33` }}>
                      <span style={{ fontSize: 16 }}>📢</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE }}>Latest Announcement</div>
                        <div style={{ fontSize: 11, color: theme.sub, marginTop: 1 }}>{announcements[0].message?.slice(0,55)}…</div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
                    {getRecentActivity().map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: darkMode?`${a.color}22`:a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, border: `1px solid ${a.color}33` }}>{a.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.4 }}>
                            {a.text}
                            {a.grouped && <span style={{ marginLeft: 6, fontSize: 9, background: `${PURPLE}22`, color: PURPLE, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>Grouped</span>}
                          </div>
                          <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>{a.sub} · {a.time}</div>
                        </div>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flexShrink: 0, marginTop: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DOUBTS ────────────────────────────────────────────── */}
          {page === "doubts" && (
            <div className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: 0 }}>All Doubts</h2>
                  <p style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>{doubts.length} total · {subjectFilter ? `Filtered: ${subjectFilter}` : "All subjects"}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                {subjectFilter && <button className="btn" onClick={() => setSubjectFilter(null)} style={{ padding: "7px 14px", background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: 8, fontWeight: 600, fontSize: 12 }}>✕ Subject: {subjectFilter?.slice(0,20)}</button>}
                {facultyFilter && <button className="btn" onClick={() => setFacultyFilter(null)} style={{ padding: "7px 14px", background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: 8, fontWeight: 600, fontSize: 12 }}>✕ Faculty: {facultyFilter?.slice(0,20)}</button>}
              </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, background: theme.card, borderRadius: 12, padding: 6, border: `1px solid ${theme.border}`, width: "fit-content" }}>
                {["all","pending","active","completed","rejected"].map(f => (
                  <button key={f} className={`tab-btn${doubtsFilter===f?" active":""}`} onClick={() => setDoubtsFilter(f)}
                    style={{ padding: "7px 16px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", color: doubtsFilter===f?"#fff":theme.sub, textTransform: "capitalize" }}>
                    {f} <span style={{ marginLeft: 3, fontSize: 10, opacity: 0.8 }}>({doubts.filter(d=>f==="all"||d.status===f).length})</span>
                  </button>
                ))}
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by topic or student..."
                style={{ width: "100%", padding: "11px 16px", borderRadius: 10, border: `1.5px solid ${theme.border}`, fontSize: 13, outline: "none", marginBottom: 14, background: theme.card, color: theme.text }} />
              <div style={{ background: theme.card, borderRadius: 14, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: theme.surface }}>
                    {["Student","Topic","Subject","Faculty","Date","Status","Actions"].map(h => (<th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {loading ? [1,2,3,4].map(i=>(<tr key={i}><td colSpan={7} style={{padding:14}}><div className="skeleton" style={{height:14,width:"100%"}}/></td></tr>)):
                    filteredDoubts.slice(0,20).map((d,i)=>(
                      <tr key={i} className="row-hover" style={{borderTop:`1px solid ${theme.border}`}}>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:theme.text}}>{d.student_name}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.sub}}>
                          {d.topic?.slice(0,20)}{d.topic?.length>20?"…":""}
                          {d.grouped&&<span style={{marginLeft:6,fontSize:9,background:`${PURPLE}18`,color:PURPLE,borderRadius:4,padding:"1px 5px",fontWeight:700}}>Grouped</span>}
                        </td>
                        <td style={{padding:"12px 16px",fontSize:11,color:theme.muted}}>{d.subject?.slice(0,14)}</td>
                        <td style={{padding:"12px 16px",fontSize:11,color:theme.muted}}>{d.faculty_name?.slice(0,14)||"—"}</td>
                        <td style={{padding:"12px 16px",fontSize:11,color:theme.muted}}>{d.created_at?.slice(0,10)}</td>
                        <td style={{padding:"12px 16px"}}><StatusChip status={d.status}/></td>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",gap:6}}>
                            {d.status!=="completed"&&<button className="btn btn-success" onClick={()=>handleForceComplete(d._id)}>✓</button>}
                            <button className="btn btn-danger" onClick={()=>handleDeleteDoubt(d._id)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredDoubts.length===0&&!loading&&(<div style={{textAlign:"center",padding:40,color:theme.muted}}><div style={{fontSize:32,marginBottom:8}}>📭</div>No doubts found</div>)}
              </div>
            </div>
          )}

          {/* ── FACULTY ───────────────────────────────────────────── */}
          {page === "faculty" && (
            <div className="fade-up">
              <div style={{marginBottom:20}}><h2 style={{fontSize:22,fontWeight:800,color:theme.text,margin:0}}>Faculty ({faculty.length})</h2></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search faculty..."
                style={{width:"100%",padding:"11px 16px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",marginBottom:14,background:theme.card,color:theme.text}}/>
              <div style={{background:theme.card,borderRadius:14,overflow:"hidden",border:`1px solid ${theme.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:theme.surface}}>{["Name","Code","Subject","Cabin","Email","Doubts"].map(h=>(<th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:theme.muted,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>))}</tr></thead>
                  <tbody>
                    {loading?[1,2,3].map(i=>(<tr key={i}><td colSpan={6} style={{padding:14}}><div className="skeleton" style={{height:14}}/></td></tr>)):
                    faculty.filter(f=>f.name?.toLowerCase().includes(search.toLowerCase())).map((f,i)=>(
                      <tr key={i} className="row-hover" style={{borderTop:`1px solid ${theme.border}`}}>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:"50%",background:`${PURPLE}22`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:PURPLE}}>{f.name?.[0]?.toUpperCase()}</div>
                            <span style={{fontSize:13,fontWeight:600,color:theme.text}}>{f.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.muted}}>{f.faculty_code}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.sub}}>{f.subject?.slice(0,22)}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.muted}}>{f.cabin||"—"}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:PURPLE}}>{f.email}</td>
                        <td style={{padding:"12px 16px"}}><span className="chip" onClick={()=>{setFacultyFilter(f.name);setDoubtsFilter("all");setSubjectFilter(null);setSearch("");setPage("doubts");}} style={{background:`${PURPLE}18`,color:PURPLE,cursor:"pointer"}} title={`Click to see ${f.name}'s doubts`}>{f.doubt_count} →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STUDENTS ──────────────────────────────────────────── */}
          {page === "students" && (
            <div className="fade-up">
              <div style={{marginBottom:20}}><h2 style={{fontSize:22,fontWeight:800,color:theme.text,margin:0}}>Students ({students.length})</h2></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search students..."
                style={{width:"100%",padding:"11px 16px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",marginBottom:14,background:theme.card,color:theme.text}}/>
              <div style={{background:theme.card,borderRadius:14,overflow:"hidden",border:`1px solid ${theme.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:theme.surface}}>{["Name","Roll No","Branch","Semester","Email","Doubts"].map(h=>(<th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:theme.muted,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>))}</tr></thead>
                  <tbody>
                    {loading?[1,2,3].map(i=>(<tr key={i}><td colSpan={6} style={{padding:14}}><div className="skeleton" style={{height:14}}/></td></tr>)):
                    students.filter(s=>s.name?.toLowerCase().includes(search.toLowerCase())||s.roll_no?.includes(search)).map((s,i)=>(
                      <tr key={i} className="row-hover" style={{borderTop:`1px solid ${theme.border}`}}>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:"50%",background:`${BLUE}22`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:BLUE}}>{s.name?.[0]?.toUpperCase()}</div>
                            <span style={{fontSize:13,fontWeight:600,color:theme.text}}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.muted}}>{s.roll_no}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:theme.sub}}>{s.branch}</td>
                        <td style={{padding:"12px 16px"}}><span className="chip" style={{background:theme.surface,color:theme.sub}}>Sem {s.semester}</span></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:PURPLE}}>{s.email}</td>
                        <td style={{padding:"12px 16px"}}><span className="chip" onClick={()=>{setSearch(s.name);setDoubtsFilter("all");setSubjectFilter(null);setPage("doubts");}} style={{background:`${BLUE}18`,color:BLUE,cursor:"pointer"}} title="Click to see doubts">{s.doubt_count} →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ANNOUNCEMENTS ─────────────────────────────────────── */}
          {page === "announcements" && (
            <div className="fade-up">
              <div style={{marginBottom:20}}><h2 style={{fontSize:22,fontWeight:800,color:theme.text,margin:0}}>📢 Announcements</h2><p style={{color:theme.muted,fontSize:13,marginTop:4}}>Send messages to students and faculty</p></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <div>
                  <div style={{background:theme.card,borderRadius:16,padding:24,border:`1px solid ${theme.border}`,marginBottom:16}}>
                    <div style={{fontWeight:700,color:theme.text,marginBottom:16,fontSize:15}}>Compose</div>
                    <div style={{background:`${PURPLE}12`,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${PURPLE}33`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <span style={{fontSize:18}}>🤖</span>
                        <div><div style={{fontWeight:700,fontSize:13,color:theme.text}}>AI Generator</div><div style={{fontSize:11,color:theme.muted}}>Describe in plain words → AI writes professionally</div></div>
                      </div>
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAIAnnouncement()}
                          placeholder='e.g. "MSE starts 9th March"'
                          style={{flex:1,padding:"9px 12px",borderRadius:8,border:`1.5px solid ${PURPLE}33`,fontSize:12,outline:"none",background:theme.card,color:theme.text}}/>
                        <button className="btn btn-primary" onClick={handleAIAnnouncement} disabled={aiLoading||!aiPrompt.trim()}
                          style={{padding:"9px 14px",fontSize:12,opacity:(aiLoading||!aiPrompt.trim())?0.6:1,whiteSpace:"nowrap"}}>
                          {aiLoading?<span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:12,height:12,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>...</span>:"✨ Generate"}
                        </button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {["MSE exam reminder","Library closed","Holiday notice","Fee deadline","Sports day"].map(t=>(
                          <span key={t} onClick={()=>setAiPrompt(t)} style={{padding:"3px 9px",background:theme.card,color:PURPLE,borderRadius:20,fontSize:10,cursor:"pointer",fontWeight:600,border:`1px solid ${PURPLE}33`}}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <select value={announcementTarget} onChange={e=>setAnnouncementTarget(e.target.value)}
                      style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",marginBottom:12,background:theme.card,color:theme.text}}>
                      <option value="all">Everyone</option>
                      <option value="students">Students Only</option>
                      <option value="faculty">Faculty Only</option>
                    </select>
                    <textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)}
                      placeholder="Type announcement or use AI above..."
                      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",minHeight:110,resize:"vertical",boxSizing:"border-box",marginBottom:14,background:theme.card,color:theme.text,lineHeight:1.6}}/>
                    <button className="btn btn-primary" onClick={handleAnnouncement} style={{width:"100%",padding:"12px 0",fontSize:14}}>📢 Send Announcement</button>
                  </div>
                </div>
                <div style={{background:theme.card,borderRadius:16,padding:24,border:`1px solid ${theme.border}`,maxHeight:600,overflowY:"auto"}}>
                  <div style={{fontWeight:700,color:theme.text,marginBottom:16,fontSize:15}}>History ({announcements.length})</div>
                  {announcements.length===0?(<div style={{textAlign:"center",padding:32,color:theme.muted}}><div style={{fontSize:32,marginBottom:8}}>📭</div>No announcements yet</div>):
                  announcements.map((a,i)=>(
                    <div key={i} style={{padding:"14px 0",borderBottom:i<announcements.length-1?`1px solid ${theme.border}`:"none"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                        <span className="chip" style={{background:`${PURPLE}18`,color:PURPLE}}>{a.target}</span>
                        <span style={{fontSize:11,color:theme.muted}}>{a.created_at?.slice(0,16)?.replace("T"," ")}</span>
                      </div>
                      <div style={{fontSize:13,color:theme.text,lineHeight:1.6}}>{a.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ──────────────────────────────────────────── */}
          {page === "settings" && (
            <div className="fade-up">
              <div style={{marginBottom:20}}><h2 style={{fontSize:22,fontWeight:800,color:theme.text,margin:0}}>⚙️ Settings</h2></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,maxWidth:860}}>
                <div style={{background:theme.card,borderRadius:16,padding:24,border:`1px solid ${theme.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                    <div style={{width:40,height:40,borderRadius:10,background:`${PURPLE}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔐</div>
                    <div><div style={{fontWeight:700,color:theme.text,fontSize:15}}>Reset Password</div><div style={{fontSize:12,color:theme.muted}}>Reset a single user's password</div></div>
                  </div>
                  <select value={resetRole} onChange={e=>setResetRole(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",marginBottom:12,background:theme.card,color:theme.text}}>
                    <option value="student">Student</option><option value="faculty">Faculty</option>
                  </select>
                  <input placeholder="Email address" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",marginBottom:12,background:theme.card,color:theme.text}}/>
                  <div style={{position:"relative",marginBottom:16}}>
                    <input placeholder="New password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} type={showPass?"text":"password"} style={{width:"100%",padding:"10px 40px 10px 14px",borderRadius:10,border:`1.5px solid ${theme.border}`,fontSize:13,outline:"none",background:theme.card,color:theme.text}}/>
                    <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:theme.muted,fontSize:16}}>{showPass?"🙈":"👁️"}</button>
                  </div>
                  <button className="btn btn-primary" onClick={handleResetPassword} style={{width:"100%",padding:"12px 0",fontSize:14}}>Reset Password</button>
                </div>
                <div style={{background:theme.card,borderRadius:16,padding:24,border:"1px solid #fecaca"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{width:40,height:40,borderRadius:10,background:darkMode?"#450a0a":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚠️</div>
                    <div><div style={{fontWeight:700,color:theme.text,fontSize:15}}>Bulk Reset</div><div style={{fontSize:12,color:RED}}>Resets ALL users of selected role</div></div>
                  </div>
                  <div style={{background:darkMode?"#1a0505":"#fef2f2",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:darkMode?"#fca5a5":"#991b1b",lineHeight:1.5}}>⚠️ This resets passwords for <b>ALL {bulkRole}s</b>. Cannot be undone!</div>
                  <select value={bulkRole} onChange={e=>setBulkRole(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1.5px solid #fecaca",fontSize:13,outline:"none",marginBottom:12,background:theme.card,color:theme.text}}>
                    <option value="student">All Students</option><option value="faculty">All Faculty</option>
                  </select>
                  <div style={{position:"relative",marginBottom:16}}>
                    <input placeholder="New password for all" value={bulkPassword} onChange={e=>setBulkPassword(e.target.value)} type={showBulkPass?"text":"password"} style={{width:"100%",padding:"10px 40px 10px 14px",borderRadius:10,border:"1.5px solid #fecaca",fontSize:13,outline:"none",background:theme.card,color:theme.text}}/>
                    <button onClick={()=>setShowBulkPass(!showBulkPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:theme.muted,fontSize:16}}>{showBulkPass?"🙈":"👁️"}</button>
                  </div>
                  <button onClick={handleBulkReset} disabled={bulkLoading||!bulkPassword}
                    style={{width:"100%",padding:"12px 0",background:(bulkLoading||!bulkPassword)?theme.surface:"linear-gradient(135deg,#ef4444,#dc2626)",color:(bulkLoading||!bulkPassword)?theme.muted:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:(bulkLoading||!bulkPassword)?"not-allowed":"pointer",fontSize:14}}>
                    {bulkLoading?"Resetting...":"🗝 Bulk Reset All"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}