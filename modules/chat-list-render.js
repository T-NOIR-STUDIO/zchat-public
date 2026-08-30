function getFilteredSortedChats() {
    const q = state.searchQuery.trim().toLowerCase();
    return state.chats
        .filter((c) => c.participant.name.toLowerCase().includes(q))
        .slice()
        .sort((a, b) => {
            const ap = isChatPinned(a.id) ? 1 : 0;
            const bp = isChatPinned(b.id) ? 1 : 0;
            if (ap !== bp) return bp - ap;
            const atLast = a.messages.length ? a.messages[a.messages.length - 1].createdAt : 0;
            const btLast = b.messages.length ? b.messages[b.messages.length - 1].createdAt : 0;
            const at = typeof atLast === "number" ? atLast : new Date(atLast).getTime() || 0;
            const bt = typeof btLast === "number" ? btLast : new Date(btLast).getTime() || 0;
            return bt - at;
        });
}

function renderChatList() {
    if (!chatList || !chatListEmpty) return;
    const list = getFilteredSortedChats();
    chatList.innerHTML = "";

    if (list.length === 0) {
        chatListEmpty.classList.remove("hidden");
        chatListEmpty.classList.add("flex");
        if (typeof icons === "function") icons();
        return;
    }
    chatListEmpty.classList.add("hidden");
    chatListEmpty.classList.remove("flex");

    const lang = localStorage.getItem("zchat_lang") || "en";
    const dict = (typeof i18n !== "undefined" && i18n[lang]) ? i18n[lang] : {};

    list.forEach((chat) => {
        const last = chat.messages[chat.messages.length - 1] || null;
        const isMine = last && last.senderId === "me";
        let previewText;
        if (!last) {
            previewText = dict.noMessagesYet || "No messages yet";
        } else {
            const { body } = parseReply(last.text || "");
            if (body && body.startsWith("[IMAGE]:")) {
                previewText = isMine
                    ? (dict.youSentPhoto || "You sent a photo")
                    : (dict.sentPhoto || "Sent a photo");
            } else {
                previewText = previewForMessage(last) || (last.attachment ? "📎 Attachment" : "");
            }
        }
        const active = chat.id === state.activeChatId;
        const pinned = isChatPinned(chat.id);
        const receiptIcon =
            isMine && last
                ? `<i data-lucide="${last.status === "read" ? "check-check" : "check"}" class="w-[14px] h-[14px] shrink-0" style="color: var(--muted);"></i>`
                : "";
        const pinIcon = pinned
            ? `<i data-lucide="pin" class="w-[12px] h-[12px] shrink-0" style="color: var(--faint);"></i>`
            : "";

        const row = document.createElement("button");
        row.type = "button";
        row.className = `flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
            active ? "bg-[var(--elevated)]" : "hover:bg-[var(--elevated)] bg-transparent"
        }`;

        row.dataset.chatId = chat.id;
        row.innerHTML = `
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
      `;
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
            if (longPressed) e.preventDefault();
        });
        row.addEventListener("touchmove", () => {
            if (pressTimer) clearTimeout(pressTimer);
        }, { passive: true });

        chatList.appendChild(row);
    });

    if (typeof icons === "function") icons();
}

if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        renderChatList();
    });
}

function isMobileView() {
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
}

function openSidebar() {
    if (!sidebarWrap) return;
    sidebarWrap.classList.remove("-translate-x-full");
    if (sidebarScrim) sidebarScrim.classList.add("hidden");
    if (isMobileView() && bottomNav) {
        bottomNav.classList.remove("hidden");
        if (appShell) appShell.classList.add("pb-[60px]");
    }
}
function closeSidebar() {
    if (!sidebarWrap) return;
    if (isMobileView()) {
        sidebarWrap.classList.add("-translate-x-full");
        if (bottomNav) bottomNav.classList.add("hidden");
        if (appShell) appShell.classList.remove("pb-[60px]");
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
    if (!isMobileView()) {
        bottomNav.classList.remove("hidden");
        if (appShell) appShell.classList.add("pb-[60px]");
    } else if (state.activeChatId && sidebarWrap && sidebarWrap.classList.contains("-translate-x-full")) {
        bottomNav.classList.add("hidden");
        if (appShell) appShell.classList.remove("pb-[60px]");
    } else {
        bottomNav.classList.remove("hidden");
        if (appShell) appShell.classList.add("pb-[60px]");
    }
});

async function selectChat(chatId) {
    state.activeChatId = chatId;
    const chat = state.chats.find((c) => c.id === chatId);
    if (chat) chat.unread = 0;
    cancelEditMode();
    closeInfoDrawer();
    closeSidebar();
    renderChatList();

    if (typeof loadMessagesForChat === "function") {
        await loadMessagesForChat(chatId);
    }
    renderActiveChat();
    markChatAsRead(chatId);
}

async function markChatAsRead(chatId) {
    if (!window.supabaseClient || !chatId || chatId.startsWith("saved_")) return;
    const myId = typeof myIdNow === "function" ? myIdNow() : null;
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
    if (status === "read") {
        return `<span class="text-[11px] font-medium" style="color: var(--muted);">Seen</span>`;
    }
    return "";
}

function renderActiveChat() {
    if (!emptyState || !activeChatEl) return;
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

    if (chatHeaderAvatar) chatHeaderAvatar.innerHTML = avatarHtml(chat.participant, 40);
    const verifiedBadge = getVerifiedBadge(!!chat.participant.isVerified);
    if (chatHeaderName) chatHeaderName.innerHTML = escapeHtml(chat.participant.name) + verifiedBadge;
    if (chatHeaderStatus) chatHeaderStatus.textContent = "";

    const infoAvatarEl = document.getElementById("infoAvatar");
    if (infoAvatarEl) infoAvatarEl.innerHTML = avatarHtml(chat.participant, 64);
    const infoNameEl = document.getElementById("infoName");
    if (infoNameEl) infoNameEl.innerHTML = escapeHtml(chat.participant.name) + verifiedBadge;
    const infoUsernameEl = document.getElementById("infoUsername");
    if (infoUsernameEl) infoUsernameEl.textContent = "@" + chat.participant.name.toLowerCase().replace(/\s+/g, "");

    if (typeof updateDisappearingUI === "function") updateDisappearingUI(chat.disappearingTime || "off");
    if (blockScreenshotsToggle) blockScreenshotsToggle.checked = !!chat.blockScreenshots;

    if (typeof applyScreenshotProtection === "function") applyScreenshotProtection(chat.blockScreenshots);

    if (typeof renderMessages === "function") renderMessages(chat);
    if (typeof icons === "function") icons();
}
