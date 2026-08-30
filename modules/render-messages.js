/* ============================================================
 * 12-render-messages.js (OPTIMIZED FOR HIGH PERFORMANCE)
 * Render khung tin nhắn + typing indicator. Phụ thuộc: 02, 03, 04, 05, 09, 11.
 * ============================================================ */

// Lưu trữ tham chiếu chat hiện tại để Event Delegation truy xuất
let currentRenderingChat = null;

function renderMessages(chat) {
    currentRenderingChat = chat;
    const msgs = chat.messages;

    if (!msgs || msgs.length === 0) {
        messageFeed.innerHTML = `
        <div class="flex flex-1 h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p class="text-sm" style="color: var(--muted);">No messages yet.</p>
          <p class="text-sm" style="color: var(--faint);">Say hi to ${escapeHtml(chat.participant.name)} 👋</p>
        </div>`;
        return;
    }

    // ⚡ 1. Tạo DocumentFragment (Vùng đệm bộ nhớ ẩn)
    const fragment = document.createDocumentFragment();

    let lastMineIdx = -1;
    for (let k = msgs.length - 1; k >= 0; k--) {
        if (msgs[k].senderId === "me") { lastMineIdx = k; break; }
    }

    msgs.forEach((msg, i) => {
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        const newDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);
        const showTail = !next || next.senderId !== msg.senderId || !isSameDay(next.createdAt, msg.createdAt);
        const isMine = msg.senderId === "me";

        if (newDay) {
            const sep = document.createElement("div");
            sep.className = "my-4 flex items-center justify-center";
            sep.innerHTML = `<span class="rounded-pill px-3 py-1 text-[11px] font-medium" style="background-color: var(--elevated); color: var(--muted);">${dayLabel(msg.createdAt)}</span>`;
            fragment.appendChild(sep);
        }

        const wrap = document.createElement("div");
        wrap.id = `msg-${msg.id}`;
        wrap.className = (showTail ? "mb-5 " : "mb-1 ") + "group relative flex w-full " + (isMine ? "justify-end" : "justify-start");
        
        // Lưu metadata vào dataset phục vụ Event Delegation
        wrap.dataset.msgId = msg.id;
        wrap.dataset.isMine = isMine;

        let attachmentHtml = "";
        if (msg.attachment) {
            attachmentHtml = `
          <div class="flex items-center gap-3 rounded-bubble px-4 py-3 mb-1.5" style="background-color: var(--elevated);">
            <svg class="w-5 h-5 shrink-0" style="color: var(--muted);" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium" style="color: var(--ink);">${escapeHtml(msg.attachment)}</p>
            </div>
          </div>`;
        }

        const bubbleStyle = isMine
            ? "background-color: var(--ink); color: var(--canvas);"
            : "background-color: var(--elevated); color: var(--ink);";

        const { replyId, replySender, replyPreview, body } = parseReply(msg.text || "");

        let contentHtml = "";
        let isImageMsg = false;
        if (body) {
            if (body.startsWith("[IMAGE]:")) {
                isImageMsg = true;
                const imgUrl = body.replace("[IMAGE]:", "");
                contentHtml = `<img src="${imgUrl}" class="msg-image block rounded-2xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity" data-full-src="${imgUrl}" loading="lazy" />`;
            } else {
                contentHtml = escapeHtml(body) + (msg.isEdited ? ` <span class="text-[10px] opacity-60 font-normal">(edited)</span>` : "");
            }
        }

        let shortReplyPrev = String(replyPreview || "").replace(/\s+/g, " ").trim();
        const replyMax = 28;
        if (shortReplyPrev.length > replyMax) shortReplyPrev = shortReplyPrev.slice(0, replyMax).trimEnd() + "…";

        const replyImgUrl = replyId ? resolveReplyImageUrl(replyId, chat) : null;
        const replyNameLabel = (replySender || "").trim() || "User";
        let replyQuoteHtml = "";
        let replyThumbHtml = "";
        if (replyId) {
            if (replyImgUrl) {
                replyThumbHtml = `<div class="msg-reply-quote msg-reply-quote--image cursor-pointer" data-reply-target="${escapeHtml(String(replyId))}">
                        <div class="msg-reply-image-head">
                            <span class="msg-reply-image-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg></span>
                            <span class="msg-reply-image-name">${escapeHtml(replyNameLabel)}</span>
                        </div>
                        <img src="${escapeHtml(replyImgUrl)}" class="msg-reply-thumb" alt="Photo" loading="lazy" />
                    </div>`;
            } else {
                replyQuoteHtml = `<div class="msg-reply-quote flex flex-col gap-0.5 mb-1 cursor-pointer" data-reply-target="${escapeHtml(String(replyId))}">
                     <span class="text-[11px] font-semibold" style="color: var(--ink); opacity: .85;">${escapeHtml(replySender)}</span>
                     <span class="text-[11px] opacity-70 msg-reply-preview" style="color: var(--ink);">${escapeHtml(shortReplyPrev)}</span>
                   </div>`;
            }
        }

        // Inline SVG trực tiếp thay cho <i data-lucide="...">
        const menuBtnHtml = `
                <button type="button" class="btn-msg-menu absolute top-1/2 -translate-y-1/2 ${isMine ? "-left-9" : "-right-9"} flex h-7 w-7 items-center justify-center rounded-full opacity-50 hover:opacity-100 hover:bg-elevated2 transition-all z-10" style="color: var(--muted);" title="More">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>`;

        const bubbleInner = isImageMsg
            ? `${replyQuoteHtml}${contentHtml}`
            : `<div class="rounded-bubble px-4 py-2.5 text-[14.5px] leading-relaxed font-medium ${showTail ? (isMine ? "rounded-br-md" : "rounded-bl-md") : ""}" style="${bubbleStyle}">${replyQuoteHtml}${contentHtml}</div>`;

        const bubble = body ? `<div class="msg-bubble-pressable">${bubbleInner}</div>` : "";

        const disappearingOn = chat.disappearingTime && chat.disappearingTime !== "off";
        const timerIcon = disappearingOn
            ? `<svg class="w-[11px] h-[11px] shrink-0 inline-block" style="color: var(--faint); opacity: 0.85;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
            : "";

        const seenHtml = (isMine && i === lastMineIdx) ? statusIconMarkup(msg.status) : "";
        const metaInner = `${timerIcon}${seenHtml}`;
        const hasMetaContent = !!timerIcon || !!seenHtml;

        const meta = (showTail && hasMetaContent)
            ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${metaInner}</div>`
            : (disappearingOn
                ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${timerIcon}</div>`
                : "");

        wrap.innerHTML = `
        <div class="relative flex max-w-[72%] min-w-0 flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}">
          ${menuBtnHtml}
          ${attachmentHtml}
          ${replyThumbHtml}
          ${bubble}
          ${meta}
        </div>`;

        fragment.appendChild(wrap);
    });

    // ⚡ 2. Render đúng 1 lần duy nhất vào DOM Thật
    messageFeed.innerHTML = "";
    messageFeed.appendChild(fragment);

    // ⚡ 3. Cuộn trang mượt bằng requestAnimationFrame
    requestAnimationFrame(() => {
        messageFeed.scrollTop = messageFeed.scrollHeight;
    });
}

function renderTypingIndicator(chat) {
    const wrap = document.createElement("div");
    wrap.id = "typingIndicator";
    wrap.className = "flex w-full justify-start mb-3";
    wrap.innerHTML = `
      <div class="rounded-bubble rounded-bl-md px-4 py-3 flex items-center gap-1" style="background-color: var(--elevated);">
        <span class="typing-dot w-1.5 h-1.5 rounded-full inline-block" style="background-color: var(--faint);"></span>
        <span class="typing-dot w-1.5 h-1.5 rounded-full inline-block" style="background-color: var(--faint);"></span>
        <span class="typing-dot w-1.5 h-1.5 rounded-full inline-block" style="background-color: var(--faint);"></span>
      </div>`;
    messageFeed.appendChild(wrap);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

/* ============================================================
 * EVENT DELEGATION (Ủy quyền sự kiện duy nhất trên messageFeed)
 * Cắt giảm hoàn toàn hàng ngàn Event Listener rác gây đơ UI
 * ============================================================ */
if (typeof messageFeed !== "undefined" && messageFeed && !messageFeed._hasGlobalDelegation) {
    messageFeed._hasGlobalDelegation = true;

    // 1. Xử lý CLICK chung (Menu, Lightbox, Quote)
    messageFeed.addEventListener("click", (e) => {
        // Nút Menu 3 chấm
        const btnMenu = e.target.closest(".btn-msg-menu");
        if (btnMenu) {
            e.stopPropagation();
            const wrap = btnMenu.closest("[data-msg-id]");
            if (wrap && currentRenderingChat) {
                const msgId = wrap.dataset.msgId;
                const isMine = wrap.dataset.isMine === "true";
                const msg = currentRenderingChat.messages.find(m => String(m.id) === String(msgId));
                if (msg) {
                    const rect = btnMenu.getBoundingClientRect();
                    openMessageActionMenu(msg, currentRenderingChat, isMine, rect.left + rect.width / 2, rect.bottom + 6);
                }
            }
            return;
        }

        // Xem ảnh Lightbox
        const imgEl = e.target.closest(".msg-image");
        if (imgEl) {
            openImageLightbox(imgEl.dataset.fullSrc);
            return;
        }

        // Nhấn vào Quote để Jump tới tin nhắn gốc
        const quoteEl = e.target.closest(".msg-reply-quote");
        if (quoteEl) {
            e.stopPropagation();
            scrollToMessage(quoteEl.dataset.replyTarget);
            return;
        }
    });

    // 2. Xử lý LONG-PRESS trên Mobile (Ủy quyền Touch Events)
    let pressTimer = null;
    let pressStartX = 0, pressStartY = 0;
    let activePressable = null;

    const clearPress = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
        if (activePressable) {
            activePressable.classList.remove("is-pressing");
            activePressable = null;
        }
    };

    messageFeed.addEventListener("touchstart", (e) => {
        const pressable = e.target.closest(".msg-bubble-pressable");
        if (!pressable || e.target.closest(".msg-reply-quote")) return;

        const wrap = pressable.closest("[data-msg-id]");
        if (!wrap || !currentRenderingChat) return;

        activePressable = pressable;
        const touch = e.touches[0];
        pressStartX = touch.clientX;
        pressStartY = touch.clientY;

        pressTimer = setTimeout(() => {
            pressable.classList.add("is-pressing");
            if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }

            const msgId = wrap.dataset.msgId;
            const isMine = wrap.dataset.isMine === "true";
            const msg = currentRenderingChat.messages.find(m => String(m.id) === String(msgId));

            if (msg) {
                openMessageActionMenu(msg, currentRenderingChat, isMine, pressStartX, pressStartY);
            }
            clearPress();
        }, 480);
    }, { passive: true });

    messageFeed.addEventListener("touchmove", (e) => {
        if (!pressTimer) return;
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - pressStartX) > 10 || Math.abs(touch.clientY - pressStartY) > 10) {
            clearPress();
        }
    }, { passive: true });

    messageFeed.addEventListener("touchend", clearPress);
    messageFeed.addEventListener("touchcancel", clearPress);
}
