/* ============================================================
   TaskFlow — shared UI: helpers, icons, avatars, badges, button
   Exports to window. Requires React (global).
   ============================================================ */
const { useState, useEffect, useMemo, useRef } = React;

// ---------- time helpers ----------
const NOW = () => window.TASKFLOW_DATA.NOW;
function relTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const diff = d.getTime() - NOW().getTime();
  const past = diff < 0;
  const m = Math.round(Math.abs(diff) / 60000);
  const h = Math.round(Math.abs(diff) / 3600000);
  const days = Math.round(Math.abs(diff) / 86400000);
  let s;
  if (m < 1) s = 'just now';else
  if (m < 60) s = `${m} min`;else
  if (h < 24) s = `${h} hr${h > 1 ? 's' : ''}`;else
  s = `${days} day${days > 1 ? 's' : ''}`;
  if (s === 'just now') return s;
  return past ? `${s} ago` : `in ${s}`;
}
function dueLabel(date) {
  if (!date) return { text: 'No due date', state: 'none' };
  const d = new Date(date);
  const diff = d.getTime() - NOW().getTime();
  const h = diff / 3600000;
  let state = 'ok';
  if (diff < 0) state = 'overdue';else
  if (h < 24) state = 'soon';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let text;
  if (state === 'overdue') text = `Overdue · ${relTime(date)}`;else
  if (state === 'soon') text = `Due ${relTime(date)}`;else
  text = `Due ${day}`;
  return { text, state, full: `${day}, ${time}` };
}
const userById = (uid) => window.TASKFLOW_DATA.USERS.find((u) => u.id === uid);

// ---------- icons (simple line icons) ----------
function Icon({ name, size = 18, stroke = 1.8, style }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  const paths = {
    board: <><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 3-5 6-5s6 1.7 6 5" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M18 20c0-2.5-1-4-2.5-4.7" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><polyline points="16 9.5 11 14.5 8.5 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
    flag: <><line x1="5" y1="22" x2="5" y2="3" /><path d="M5 4h11l-2 4 2 4H5" /></>,
    hand: <><path d="M8 11V6a1.5 1.5 0 0 1 3 0v4M11 10V4.5a1.5 1.5 0 0 1 3 0V10M14 10V6.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7s-5-2-6-4l-2.5-4.2a1.5 1.5 0 0 1 2.5-1.6L8 12" /></>,
    search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
    paperclip: <path d="M21 11l-8.5 8.5a4 4 0 0 1-6-6L14 5a2.5 2.5 0 0 1 4 4l-8 8a1 1 0 0 1-1.5-1.5l7.5-7.5" />,
    camera: <><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.2" /></>,
    note: <><path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>,
    chat: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5A8 8 0 1 1 21 12z" />,
    x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
    chevron: <polyline points="9 6 15 12 9 18" />,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    arrowLeft: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="11 6 5 12 11 18" /></>,
    undo: <><polyline points="9 7 4 12 9 17" /><path d="M4 12h11a5 5 0 0 1 0 10h-3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    inbox: <><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /></>,
    home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /></>,
    filter: <polygon points="3 5 21 5 14 12.5 14 19 10 21 10 12.5" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></>,
    send: <><line x1="21" y1="3" x2="10" y2="14" /><polygon points="21 3 14 21 10 14 3 10 21 3" /></>,
    logOut: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><polyline points="9 17 4 12 9 7" /><line x1="4" y1="12" x2="15" y2="12" /></>,
    link: <><path d="M9 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.7-5.7L11 7" /><path d="M15 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.7 5.7L13 17" /></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><polyline points="9 12 11 14 15 10" /></>,
    edit: <><path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16z" /><line x1="13.5" y1="6.5" x2="17.5" y2="10.5" /></>,
    trash: <><polyline points="4 7 20 7" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
    award: <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7.5 21 12 18.5 16.5 21 15 13.5" /></>,
    repeat: <><polyline points="17 2 21 6 17 10" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 22 3 18 7 14" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
    download: <><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" /></>,
    chart: <><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="7" width="3" height="10" rx="1" /><rect x="16" y="13" width="3" height="4" rx="1" /></>
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

// ---------- avatar ----------
function initials(name) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function Avatar({ user, size = 30, ring = false }) {
  if (!user) return null;
  return (
    <div className="tf-avatar" title={user.name} style={{ ...{
        width: size, height: size, background: user.color,
        fontSize: size * 0.4, boxShadow: ring ? '0 0 0 2px var(--surface), 0 0 0 3.5px ' + user.color + '55' : 'none'
      }, background: "rgb(217, 79, 79)" }}>{initials(user.name)}</div>);

}
function AvatarStack({ ids = [], size = 26 }) {
  return (
    <div className="tf-stack">
      {ids.map((uid, i) =>
      <div key={uid} style={{ marginLeft: i ? -size * 0.32 : 0, zIndex: ids.length - i }}>
          <Avatar user={userById(uid)} size={size} ring />
        </div>
      )}
    </div>);

}

// ---------- badges ----------
const STATUS_META = {
  open: { label: 'Open', cls: 'open' },
  in_progress: { label: 'In progress', cls: 'progress' },
  pending_approval: { label: 'Needs review', cls: 'review' },
  completed: { label: 'Completed', cls: 'done' }
};
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return <span className={'tf-badge status ' + m.cls}><span className="dot"></span>{m.label}</span>;
}
const PRIORITY_CLS = { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' };
function PriorityTag({ priority }) {
  const meta = window.TASKFLOW_DATA.PRIORITY[priority];
  return (
    <span className={'tf-prio ' + PRIORITY_CLS[priority]}>
      <Icon name="flag" size={12} stroke={2.2} />{meta.label}
    </span>);

}
function DeptTag({ dept }) {
  return <span className="tf-dept">{dept}</span>;
}
function ProofTag({ proof }) {
  const map = { note: ['note', 'Note'], file: ['paperclip', 'File'], photo: ['camera', 'Photo'], checklist: ['checkCircle', 'Checklist'] };
  const [icon, label] = map[proof] || map.note;
  return <span className="tf-proof"><Icon name={icon} size={12} stroke={2} />{label}</span>;
}

// ---------- button ----------
function Button({ variant = 'default', size = 'md', icon, children, onClick, disabled, full, title }) {
  return (
    <button className={`tf-btn ${variant} ${size}${full ? ' full' : ''}`} onClick={onClick} disabled={disabled} title={title} style={{ backgroundColor: "rgb(255, 156, 156)" }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} stroke={2} />}
      {children}
    </button>);

}

Object.assign(window, {
  relTime, dueLabel, userById, initials,
  Icon, Avatar, AvatarStack,
  StatusBadge, PriorityTag, DeptTag, ProofTag, Button,
  STATUS_META
});