/* ============================================================
 * 09-edit-reply.js
 * Chế độ Edit tin nhắn + Reply (trả lời tin nhắn). Phụ thuộc: 02, 03, 04.
 * ============================================================ */
/* ============ ĐIỀU KHIỂN EDIT MODE BẰNG EDIT BAR ============ */
function startEditMessage(msgId, currentText) {
    cancelReplyMode();
    editingMsgId = msgId;

    messageInput.value = currentText;
    messageInput.focus();
    autoResizeMessageInput();

    if (editBar) {
        editBarPreview.textContent = currentText;
        editBar.classList.remove("hidden");
    }

    if (sendIcon) {
        sendIcon.setAttribute("data-lucide", "check");
        icons();
    }

    updateSendBtnState();
}

function cancelEditMode() {
    editingMsgId = null;
    messageInput.value = "";
    if (typeof autoResizeMessageInput === "function") autoResizeMessageInput();
    else messageInput.style.height = "24px";

    if (editBar) {
        editBar.classList.add("hidden");
    }

    if (sendIcon) {
        sendIcon.setAttribute("data-lucide", "arrow-up");
        icons();
    }

    updateSendBtnState();
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", cancelEditMode);
}

/* ============ REPLY (TRẢ LỜI TIN NHẮN) ============ */
const REPLY_PREFIX_RE = /^\[REPLY:([^:]+):([^:]*):([^\]]*)\]([\s\S]*)$/;

function buildReplyPrefix(replyId, replySender, replyPreview) {
    return `[REPLY:${replyId}:${encodeURIComponent(replySender)}:${encodeURIComponent(replyPreview)}]`;
}

// Tách phần "trả lời ai, preview gì" ra khỏi nội dung thật của tin nhắn
function parseReply(text) {
    if (!text) return { replyId: null, replySender: "", replyPreview: "", body: text || "" };
    const match = text.match(REPLY_PREFIX_RE);
    if (!match) return { replyId: null, replySender: "", replyPreview: "", body: text };
    return {
        replyId: match[1],
        replySender: decodeURIComponent(match[2] || ""),
        replyPreview: decodeURIComponent(match[3] || ""),
        body: match[4] || "",
    };
}

function previewForMessage(msg) {
    if (!msg) return "";
    const { body } = parseReply(msg.text || "");
    if (body.startsWith("[IMAGE]:")) return "📷 Photo";
    if (msg.attachment) {
        const a = String(msg.attachment || "");
        return a.length > 40 ? ("📎 " + a.slice(0, 40) + "…") : ("📎 " + a);
    }
    const t = String(body || "").replace(/\s+/g, " ").trim();
    if (t.length <= 72) return t;
    return t.slice(0, 72).trimEnd() + "…";
}

function resolveReplyImageUrl(replyId, chat) {
    if (!replyId || !chat || !Array.isArray(chat.messages)) return null;
    const orig = chat.messages.find((m) => String(m.id) === String(replyId));
    if (!orig) return null;
    const { body } = parseReply(orig.text || "");
    if (body && body.startsWith("[IMAGE]:")) {
        const url = body.replace("[IMAGE]:", "").trim();
        return url || null;
    }
    return null;
}

function startReplyMessage(msgId) {
    cancelEditMode();
    const chat = state.chats.find((c) => c.id === state.activeChatId);
    if (!chat) return;
    const msg = chat.messages.find((m) => m.id === msgId);
    if (!msg) return;

    replyingMsgId = msgId;
    const senderLabel = msg.senderId === "me" ? "yourself" : chat.participant.name;

    if (replyBarSender) replyBarSender.textContent = senderLabel;
    if (replyBarPreview) replyBarPreview.textContent = previewForMessage(msg) || "…";
    if (replyBar) replyBar.classList.remove("hidden");

    messageInput.focus();
    updateSendBtnState();
}

function cancelReplyMode() {
    replyingMsgId = null;
    if (replyBar) replyBar.classList.add("hidden");
}

if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", cancelReplyMode);
}

// Nhảy thẳng tới tin nhắn gốc (không lướt), rồi lắc trái-phải
function scrollToMessage(msgId) {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "center" });
    el.classList.remove("msg-reply-shake");
    // Jump xong → lắc ngay
    requestAnimationFrame(() => {
        el.classList.add("msg-reply-shake");
        setTimeout(() => el.classList.remove("msg-reply-shake"), 600);
    });
}
