/* ============================================================
 * 02-utils.js
 * ============================================================ */
function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function initials(name) {
    return (name || "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function formatTimeShort(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatListTimestamp(ts) {
    const now = Date.now();
    const diffMin = (now - ts) / 60000;
    const diffHr = diffMin / 60;
    const diffDay = diffHr / 24;
    const d = new Date(ts);
    if (diffMin < 1) return "now";
    if (diffHr < 1) return Math.floor(diffMin) + "m";
    if (diffDay < 1) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (diffDay < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatLastSeen(ts) {
    if (!ts) return "offline";
    const diffHr = (Date.now() - ts) / 3600000;
    if (diffHr < 1) return "last seen just now";
    if (diffHr < 24) return "last seen " + Math.floor(diffHr) + "h ago";
    return "last seen " + new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(ts) {
    const today = Date.now();
    const yesterday = today - 86400000;
    if (isSameDay(ts, today)) return "Today";
    if (isSameDay(ts, yesterday)) return "Yesterday";
    return new Date(ts).toLocaleDateString([], { month: "long", day: "numeric" });
}

const AVATAR_COLORS = ["#4F46E5", "#0284C7", "#16A34A", "#D97706", "#DC2626", "#9333EA", "#2563EB", "#0D9488"];
function colorFor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
