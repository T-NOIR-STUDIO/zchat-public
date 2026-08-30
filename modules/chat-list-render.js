/* ============================================================
 * 08-chat-list-render.js
 * Render danh sách chat (sidebar), chọn chat, đánh dấu đã đọc. Phụ thuộc: 02, 03, 04, 07.
 * ============================================================ */
function getFilteredSortedChats() {
    const q = state.searchQuery.trim().toLowerCase();
    return state.chats
        .filter((c) => c.participant.name.toLowerCase().includes(q))
        .slice()
        .sort((a, b) => {
            const ap = isChatPinned(a.id) ? 1 : 0;
            const bp = isChatPinned(b.id) ? 1 : 0;
            if (ap !== bp) return bp - ap;
            const at = a.messages.length ? a.messages[a.messages.length - 1].createdAt : 0;
            const bt = b.messages.length ? b.messages[b.messages.length - 1].createdAt : 0;
            return bt - at;
        });
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

    const existingRows = new Map();
    Array.from(chatList.children).forEach((child) => {
        if (child.dataset && child.dataset.chatId) {
            existingRows.set(child.dataset.chatId, child);
        }
    });

    const fragment = document.createDocumentFragment();

    list.forEach((chat) => {
        const last = chat.messages[chat.messages.length - 1] || null;
        const isMine = last && last.senderId === "me";
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = (typeof i18n !== "undefined" && i18n[lang]) ? i18n[lang] : {};
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

        let row = existingRows.get(chat.id);

        if (row) {
            const textEl = row.querySelector(".js-preview-text");
            if (textEl && textEl.textContent !== previewText) {
                textEl.textContent = previewText;
            }

            const timeEl = row.querySelector(".js-chat-time");
            if (timeEl && last) {
                const timeStr = formatListTimestamp(last.createdAt);
                if (timeEl.textContent !== timeStr) timeEl.textContent = timeStr;
            }

            const unreadEl = row.querySelector(".js-unread-badge");
            if (chat.unread > 0) {
                const unreadStr = chat.unread > 99 ? "99+" : chat.unread;
                if (!unreadEl) {
                    const badgeWrap = row.querySelector(".js-bottom-row");
                    if (badgeWrap) {
                        badgeWrap.insertAdjacentHTML('beforeend', `<span class="js-unread-badge flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5 text-[11px] font-bold" style="background-color: var(--ink); color: var(--canvas);">${unreadStr}</span>`);
                    }
                } else if (unreadEl.textContent !== String(unreadStr)) {
                    unreadEl.textContent = unreadStr;
                }
            } else if (unreadEl) {
                unreadEl.remove();
            }

            const isHovered = row.matches(':hover');
            if (active || isHovered) {
                row.style.backgroundColor = "var(--elevated)";
            } else {
                row.style.backgroundColor = "transparent";
            }
            existingRows.delete(chat.id);
        } else {
            row = document.createElement("button");
            row.type = "button";
            row.className = `flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors select-none`;
            row.style.backgroundColor = active ? "var(--elevated)" : "transparent";
            
            row.onmouseover = () => { if (chat.id !== state.activeChatId) row.style.backgroundColor = "var(--elevated)"; };
            row.onmouseout = () => { if (chat.id !== state.activeChatId) row.style.backgroundColor = "transparent"; };

            row.dataset.chatId = chat.id;
            row.innerHTML = `
            ${avatarHtml(chat.participant)}
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="flex min-w-0 items-center gap-1.5 truncate">
                  ${pinIcon}
                  <span class="inline-flex min-w-0 items-center truncate text-[15px] font-bold" style="color: var(--ink);">${escapeHtml(chat.participant.name)}${getVerifiedBadge(!!chat.participant.isVerified)}</span>
                </span>
                ${last ? `<span class="js-chat-time shrink-0 text-xs font-medium" style="color: ${chat.unread > 0 ? "var(--ink)" : "var(--faint)"};">${formatListTimestamp(last.createdAt)}</span>` : ""}
              </div>
              <div class="js-bottom-row mt-0.5 flex items-center justify-between gap-2">
                <span class="flex min-w-0 items-center gap-1 truncate text-[13px]" style="color: var(--muted);">
                  ${receiptIcon}
                  <span class="js-preview-text truncate font-normal">${escapeHtml(previewText)}</span>
                </span>
                ${chat.unread > 0 ? `<span class="js-unread-badge flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5 text-[11px] font-bold" style="background-color: var(--ink); color: var(--canvas);">${chat.unread > 99 ? "99+" : chat.unread}</span>` : ""}
              </div>
            </div>
          `;

            // XỬ LÝ EVENT CHUẨN XÁC: Tránh xung đột click/longpress
            let pressTimer = null;
            let isLongPress = false;

            const startPress = (x, y) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    openChatListMenu(chat, x, y);
                }, 450);
            };

            const cancelPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            // Touch events
            row.addEventListener("touchstart", (e) => {
                const t = e.touches[0];
                startPress(t.clientX, t.clientY);
            }, { passive: true });

            row.addEventListener("touchmove", cancelPress, { passive: true });
            
            row.addEventListener("touchend", (e) => {
                cancelPress();
                if (isLongPress) {
                    e.preventDefault();
                }
            });

            // Mouse / Click event
            row.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                openChatListMenu(chat, e.clientX, e.clientY);
            });

            row.addEventListener("click", (e) => {
                if (isLongPress) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                selectChat(chat.id);
            });
        }

        fragment.appendChild(row);
    });

    existingRows.forEach((oldRow) => oldRow.remove());

    chatList.innerHTML = "";
    chatList.appendChild(fragment);

    icons();
}

searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderChatList();
});

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
    if (status === "read") {
        return `<span class="text-[11px] font-medium" style="color: var(--muted);">Seen</span>`;
    }
    return "";
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

    chatHeaderAvatar.innerHTML = avatarHtml(chat.participant, 40);
    const verifiedBadge = getVerifiedBadge(!!chat.participant.isVerified);
    chatHeaderName.innerHTML = escapeHtml(chat.participant.name) + verifiedBadge;
    chatHeaderStatus.textContent = "";

    document.getElementById("infoAvatar").innerHTML = avatarHtml(chat.participant, 64);
    const infoNameEl = document.getElementById("infoName");
    if (infoNameEl) infoNameEl.innerHTML = escapeHtml(chat.participant.name) + verifiedBadge;
    document.getElementById("infoUsername").textContent = "@" + chat.participant.name.toLowerCase().replace(/\s+/g, "");

    updateDisappearingUI(chat.disappearingTime || "off");
    blockScreenshotsToggle.checked = !!chat.blockScreenshots;

    applyScreenshotProtection(chat.blockScreenshots);

    renderMessages(chat);
    icons();
}
