/* ============================================================
 * 08-chat-list-render.js
 * Render danh sách chat (sidebar), chọn chat, đánh dấu đã đọc.
 * Phụ thuộc: 02, 03, 04, 07.
 * ============================================================ */

const MOBILE_MQ = "(max-width: 767px)";
let _mobileMq = null;
function isMobileView() {
    if (!_mobileMq && window.matchMedia) _mobileMq = window.matchMedia(MOBILE_MQ);
    return _mobileMq ? _mobileMq.matches : false;
}

function lastMessageTime(chat) {
    const msgs = chat.messages;
    return msgs.length ? msgs[msgs.length - 1].createdAt : 0;
}

function getFilteredSortedChats() {
    const q = state.searchQuery.trim().toLowerCase();
    const pinned = new Set(typeof loadPinnedChatIds === "function" ? loadPinnedChatIds() : []);

    const list = q
        ? state.chats.filter((c) => c.participant.name.toLowerCase().includes(q))
        : state.chats.slice();

    // Không sort in-place mảng state khi không filter
    const sorted = q ? list : list.slice();
    sorted.sort((a, b) => {
        const ap = pinned.has(String(a.id)) ? 1 : 0;
        const bp = pinned.has(String(b.id)) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return lastMessageTime(b) - lastMessageTime(a);
    });
    return sorted;
}

function getChatPreviewText(chat, last, isMine, dict) {
    if (!last) return dict.noMessagesYet || "No messages yet";
    const { body } = parseReply(last.text || "");
    if (body && body.startsWith("[IMAGE]:")) {
        return isMine
            ? (dict.youSentPhoto || "You sent a photo")
            : (dict.sentPhoto || "Sent a photo");
    }
    return previewForMessage(last) || (last.attachment ? "📎 Attachment" : "");
}

function bindChatRowGestures(row, chat) {
    row.addEventListener("click", () => selectChat(chat.id));
    row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openChatListMenu(chat, e.clientX, e.clientY);
    });

    let pressTimer = null;
    let longPressed = false;
    row.addEventListener("touchstart", (e) => {
        longPressed = false;
        const t = e.touches[0];
        pressTimer = setTimeout(() => {
            longPressed = true;
            openChatListMenu(chat, t.clientX, t.clientY);
        }, 480);
    }, { passive: true });
    row.addEventListener("touchend", (e) => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
        if (longPressed) e.preventDefault();
    });
    row.addEventListener("touchmove", () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { passive: true });
}

function renderChatList() {
    const list = getFilteredSortedChats();

    if (list.length === 0) {
        chatList.innerHTML = "";
        chatListEmpty.classList.remove("hidden");
        chatListEmpty.classList.add("flex");
        icons();
        return;
    }
    chatListEmpty.classList.add("hidden");
    chatListEmpty.classList.remove("flex");

    const lang = localStorage.getItem("zchat_lang") || "en";
    const dict = (typeof i18n !== "undefined" && i18n[lang]) ? i18n[lang] : {};
    const pinned = new Set(typeof loadPinnedChatIds === "function" ? loadPinnedChatIds() : []);

    // Lưu lại các element dòng chat hiện có trên DOM để tái sử dụng (tránh huỷ DOM làm mất hover state)
    const existingRows = new Map();
    Array.from(chatList.children).forEach((el) => {
        if (el.dataset && el.dataset.chatId) {
            existingRows.set(el.dataset.chatId, el);
        }
    });

    const frag = document.createDocumentFragment();

    for (let i = 0; i < list.length; i++) {
        const chat = list[i];
        const last = chat.messages.length ? chat.messages[chat.messages.length - 1] : null;
        const isMine = !!(last && last.senderId === "me");
        const active = chat.id === state.activeChatId;
        const isPinned = pinned.has(String(chat.id));
        const previewText = getChatPreviewText(chat, last, isMine, dict);

        // NẾU ĐÃ CÓ TRÊN DOM: Tái sử dụng Element cũ để không bị flicker
        if (existingRows.has(chat.id)) {
            const row = existingRows.get(chat.id);
            existingRows.delete(chat.id);

            row.style.backgroundColor = active ? "var(--elevated)" : "transparent";
            frag.appendChild(row);
            continue;
        }

        // NẾU CHƯA CÓ TRÊN DOM: Tạo Element mới
        const receiptIcon = isMine && last
            ? `<i data-lucide="${last.status === "read" ? "check-check" : "check"}" class="w-[14px] h-[14px] shrink-0" style="color: var(--muted);"></i>`
            : "";
        const pinIcon = isPinned
            ? `<i data-lucide="pin" class="w-[12px] h-[12px] shrink-0" style="color: var(--faint);"></i>`
            : "";

        const row = document.createElement("button");
        row.type = "button";
        row.className = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors";
        row.style.backgroundColor = active ? "var(--elevated)" : "transparent";

        if (!active) {
            row.addEventListener("mouseenter", () => { row.style.backgroundColor = "var(--elevated)"; });
            row.addEventListener("mouseleave", () => { row.style.backgroundColor = "transparent"; });
        }

        row.dataset.chatId = chat.id;
        row.innerHTML = `
        <div class="pointer-events-none flex w-full items-center gap-3">
          ${avatarHtml(chat.participant)}
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="flex min-w-0 items-center gap-1.5 truncate">
                ${pinIcon}
                <span class="inline-flex min-w-0 items-center truncate text-[15px] font-bold" style="color: var(--ink);">${escapeHtml(chat.participant.name)}${getVerifiedBadge(!!chat.participant.isVerified)}</span>
              </span>
              ${last ? `<span class="shrink-0 text-xs font-medium" style="color: ${chat.unread > 0 ? "var(--ink)" : "var(--faint)"};">${formatListTimestamp(last.createdAt)}</span>` : ""}
            </div>
            <div class="mt-0.5 flex items-center justify-between gap-2">
              <span class="flex min-w-0 items-center gap-1 truncate text-[13px]" style="color: var(--muted);">
                ${receiptIcon}
                <span class="truncate font-normal">${escapeHtml(previewText)}</span>
              </span>
              ${chat.unread > 0 ? `<span class="flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5 text-[11px] font-bold" style="background-color: var(--ink); color: var(--canvas);">${chat.unread > 99 ? "99+" : chat.unread}</span>` : ""}
            </div>
          </div>
        </div>`;

        bindChatRowGestures(row, chat);
        frag.appendChild(row);
    }

    // Xóa bớt các ô chat cũ không còn tồn tại trong list
    existingRows.forEach((oldRow) => oldRow.remove());

    chatList.appendChild(frag);
    icons();
}

if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        renderChatList();
    });
}

function setMobileChrome(chatOpen) {
    if (!isMobileView()) {
        if (bottomNav) bottomNav.classList.remove("hidden");
        if (appShell) appShell.classList.add("pb-[60px]");
        return;
    }
    if (chatOpen) {
        if (bottomNav) bottomNav.classList.add("hidden");
        if (appShell) appShell.classList.remove("pb-[60px]");
    } else {
        if (bottomNav) bottomNav.classList.remove("hidden");
        if (appShell) appShell.classList.add("pb-[60px]");
    }
}

function openSidebar() {
    if (!sidebarWrap) return;
    sidebarWrap.classList.remove("-translate-x-full");
    if (sidebarScrim) sidebarScrim.classList.add("hidden");
    setMobileChrome(false);
}

function closeSidebar() {
    if (!sidebarWrap) return;
    if (isMobileView()) {
        sidebarWrap.classList.add("-translate-x-full");
        setMobileChrome(true);
    } else {
        sidebarWrap.classList.remove("-translate-x-full");
    }
    if (sidebarScrim) sidebarScrim.classList.add("hidden");
}

if (openSidebarBtn) openSidebarBtn.addEventListener("click", openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
if (sidebarScrim) sidebarScrim.addEventListener("click", closeSidebar);

window.addEventListener("resize", () => {
    if (!bottomNav) return;
    const chatOpen = isMobileView()
        && !!state.activeChatId
        && sidebarWrap
        && sidebarWrap.classList.contains("-translate-x-full");
    setMobileChrome(chatOpen);
});

function selectChat(chatId) {
    state.activeChatId = chatId;
    const chat = state.chats.find((c) => c.id === chatId);
    if (chat) chat.unread = 0;
    cancelEditMode();
    closeInfoDrawer();
    closeSidebar();
    renderChatList();
    renderActiveChat();
    loadMessagesForChat(chatId);
    markChatAsRead(chatId);
}

async function markChatAsRead(chatId) {
    if (!window.supabaseClient || !chatId || chatId.startsWith("saved_")) return;
    const myId = myIdNow();
    if (!myId) return;
    try {
        const { error } = await window.supabaseClient
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("chat_id", chatId)
            .neq("sender_id", myId)
            .is("read_at", null);
        if (error) console.error("[ZChat] markChatAsRead error:", error);
    } catch (err) {
        console.error("[ZChat] markChatAsRead exception:", err);
    }
}

function statusIconMarkup(status) {
    if (status !== "read") return "";
    return `<span class="text-[11px] font-medium" style="color: var(--muted);">Seen</span>`;
}

function renderActiveChat() {
    const chat = state.chats.find((c) => c.id === state.activeChatId);

    if (!chat) {
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
        activeChatEl.classList.add("hidden");
        activeChatEl.classList.remove("flex");
        return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
    activeChatEl.classList.remove("hidden");
    activeChatEl.classList.add("flex");

    const p = chat.participant;
    const verifiedBadge = getVerifiedBadge(!!p.isVerified);
    const nameHtml = escapeHtml(p.name) + verifiedBadge;

    chatHeaderAvatar.innerHTML = avatarHtml(p, 40);
    chatHeaderName.innerHTML = nameHtml;
    chatHeaderStatus.textContent = "";

    const infoAvatar = document.getElementById("infoAvatar");
    if (infoAvatar) infoAvatar.innerHTML = avatarHtml(p, 64);
    const infoNameEl = document.getElementById("infoName");
    if (infoNameEl) infoNameEl.innerHTML = nameHtml;
    const infoUser = document.getElementById("infoUsername");
    if (infoUser) infoUser.textContent = "@" + p.name.toLowerCase().replace(/\s+/g, "");

    updateDisappearingUI(chat.disappearingTime || "off");
    if (blockScreenshotsToggle) blockScreenshotsToggle.checked = !!chat.blockScreenshots;
    applyScreenshotProtection(chat.blockScreenshots);

    renderMessages(chat);
    icons();
}
