/* ============================================================
 * 12-render-messages.js
 * Render khung tin nhắn (bong bóng chat) + typing indicator. Phụ thuộc: 02, 03, 04, 05, 09, 11.
 * ============================================================ */
function renderMessages(chat) {
    const msgs = chat.messages;
    messageFeed.innerHTML = "";

    if (msgs.length === 0) {
        messageFeed.innerHTML = `
        <div class="flex flex-1 h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p class="text-sm" style="color: var(--muted);">No messages yet.</p>
          <p class="text-sm" style="color: var(--faint);">Say hi to ${escapeHtml(chat.participant.name)} 👋</p>
        </div>`;
        return;
    }

    // Seen chỉ hiện dưới tin nhắn cuối cùng của mình
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
            messageFeed.appendChild(sep);
        }

        const wrap = document.createElement("div");
        wrap.id = `msg-${msg.id}`;
        wrap.className = (showTail ? "mb-5 " : "mb-1 ") + "group relative flex w-full " + (isMine ? "justify-end" : "justify-start");

        let attachmentHtml = "";
        if (msg.attachment) {
            attachmentHtml = `
          <div class="flex items-center gap-3 rounded-bubble px-4 py-3 mb-1.5" style="background-color: var(--elevated);">
            <i data-lucide="file-text" class="w-5 h-5 shrink-0" style="color: var(--muted);"></i>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium" style="color: var(--ink);">${escapeHtml(msg.attachment)}</p>
            </div>
          </div>`;
        }

        const bubbleStyle = isMine
            ? "background-color: var(--ink); color: var(--canvas);"
            : "background-color: var(--elevated); color: var(--ink);";

        // Tách phần "đang trả lời tin nhắn nào" ra khỏi nội dung thật
        const { replyId, replySender, replyPreview, body } = parseReply(msg.text || "");

        let contentHtml = "";
        let isImageMsg = false;
        if (body) {
            if (body.startsWith("[IMAGE]:")) {
                isImageMsg = true;
                const imgUrl = body.replace("[IMAGE]:", "");
                contentHtml = `<img src="${imgUrl}" class="msg-image block rounded-2xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity" data-full-src="${imgUrl}" />`;
            } else {
                contentHtml = escapeHtml(body) + (msg.isEdited ? ` <span class="text-[10px] opacity-60 font-normal">(edited)</span>` : "");
            }
        }

        let shortReplyPrev = String(replyPreview || "").replace(/\s+/g, " ").trim();
        if (shortReplyPrev.length > 72) shortReplyPrev = shortReplyPrev.slice(0, 72).trimEnd() + "…";

        const replyImgUrl = replyId ? resolveReplyImageUrl(replyId, chat) : null;
        const replyNameLabel = (replySender || "").trim() || "User";
        let replyQuoteHtml = "";
        let replyThumbHtml = "";
        if (replyId) {
            if (replyImgUrl) {
                replyThumbHtml = `<div class="msg-reply-quote msg-reply-quote--image" data-reply-target="${escapeHtml(String(replyId))}">
                        <div class="msg-reply-image-head">
                            <span class="msg-reply-image-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg></span>
                            <span class="msg-reply-image-name">${escapeHtml(replyNameLabel)}</span>
                        </div>
                        <img src="${escapeHtml(replyImgUrl)}" class="msg-reply-thumb" alt="Photo" loading="lazy" />
                    </div>`;
            } else {
                replyQuoteHtml = `<div class="msg-reply-quote flex flex-col gap-0.5 mb-1" data-reply-target="${escapeHtml(String(replyId))}">
                     <span class="text-[11px] font-semibold" style="color: var(--ink); opacity: .85;">${escapeHtml(replySender)}</span>
                     <span class="text-[11px] opacity-70 msg-reply-preview" style="color: var(--ink);">${escapeHtml(shortReplyPrev)}</span>
                   </div>`;
            }
        }

        // Nút menu 3 chấm — luôn hiện (mờ), rõ hơn khi hover / touch
        const menuBtnHtml = `
                <button type="button" class="btn-msg-menu absolute top-1/2 -translate-y-1/2 ${isMine ? "-left-9" : "-right-9"} flex h-7 w-7 items-center justify-center rounded-full opacity-50 hover:opacity-100 hover:bg-elevated2 transition-all z-10" style="color: var(--muted);" title="More">
                    <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>`;

        const bubbleInner = isImageMsg
            ? `${replyQuoteHtml}${contentHtml}`
            : `<div class="rounded-bubble px-4 py-2.5 text-[14.5px] leading-relaxed font-medium ${showTail ? (isMine ? "rounded-br-md" : "rounded-bl-md") : ""}" style="${bubbleStyle}">${replyQuoteHtml}${contentHtml}</div>`;

        const bubble = body ? `<div class="msg-bubble-pressable">${bubbleInner}</div>` : "";

        const disappearingOn = chat.disappearingTime && chat.disappearingTime !== "off";
        const timerIcon = disappearingOn
            ? `<i data-lucide="timer" class="w-[11px] h-[11px] shrink-0" style="color: var(--faint); opacity: 0.85;" title="Disappearing message"></i>`
            : "";

        // Chỉ tin cuối mình gửi mới hiện Seen
        const seenHtml = (isMine && i === lastMineIdx) ? statusIconMarkup(msg.status) : "";
        const metaInner = `${timerIcon}${seenHtml}`;
        const hasMetaContent = !!timerIcon || !!seenHtml;

        const meta = (showTail && hasMetaContent)
            ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${metaInner}</div>`
            : (disappearingOn
                ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${timerIcon}</div>`
                : "");

        const colGap = replyThumbHtml ? "gap-1" : "gap-1.5";
        wrap.innerHTML = `
        <div class="relative flex max-w-[72%] min-w-0 flex-col ${colGap} ${isMine ? "items-end" : "items-start"}">
          ${menuBtnHtml}
          ${attachmentHtml}
          ${replyThumbHtml}
          ${bubble}
          ${meta}
        </div>`;

        const btnMenu = wrap.querySelector(".btn-msg-menu");
        if (btnMenu) {
            btnMenu.addEventListener("click", (e) => {
                e.stopPropagation();
                const rect = btnMenu.getBoundingClientRect();
                // Neo giữa nút 3 chấm — ổn định hơn trên mobile
                openMessageActionMenu(
                    msg, chat, isMine,
                    rect.left + rect.width / 2,
                    rect.bottom + 6
                );
            });
        }

        const imgEl = wrap.querySelector(".msg-image");
        if (imgEl) {
            imgEl.addEventListener("click", () => openImageLightbox(imgEl.dataset.fullSrc));
        }

        const quoteEl = wrap.querySelector(".msg-reply-quote");
        if (quoteEl) {
            quoteEl.addEventListener("click", (e) => {
                e.stopPropagation();
                scrollToMessage(quoteEl.dataset.replyTarget);
            });
        }

        // Nhấn giữ (long-press) trên mobile để mở menu ngay tại điểm chạm
        const pressable = wrap.querySelector(".msg-bubble-pressable");
        if (pressable) {
            let pressTimer = null;
            let pressStartX = 0, pressStartY = 0, pressMoved = false;

            const clearPress = () => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
                pressable.classList.remove("is-pressing");
            };

            pressable.addEventListener("touchstart", (e) => {
                if (imgEl && e.target.closest(".msg-reply-quote")) return;
                const touch = e.touches[0];
                pressStartX = touch.clientX;
                pressStartY = touch.clientY;
                pressMoved = false;
                pressTimer = setTimeout(() => {
                    pressable.classList.add("is-pressing");
                    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                    // Dùng tọa độ đã lưu — tránh touch object bị reset trên mobile
                    openMessageActionMenu(msg, chat, isMine, pressStartX, pressStartY);
                    clearPress();
                }, 480);
            }, { passive: true });

            pressable.addEventListener("touchmove", (e) => {
                const touch = e.touches[0];
                if (Math.abs(touch.clientX - pressStartX) > 10 || Math.abs(touch.clientY - pressStartY) > 10) {
                    pressMoved = true;
                    clearPress();
                }
            }, { passive: true });

            pressable.addEventListener("touchend", clearPress);
            pressable.addEventListener("touchcancel", clearPress);
        }

        messageFeed.appendChild(wrap);
    });

    messageFeed.scrollTop = messageFeed.scrollHeight;
    icons();
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
