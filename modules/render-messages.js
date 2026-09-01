/* ============================================================
 * 12-render-messages.js
 * Render khung tin nhắn (bong bóng chat) + typing indicator. Phụ thuộc: 02, 03, 04, 05, 09, 11.
 * ============================================================ */

/** Parse ref ảnh chat-images (path private / URL public|signed cũ) */
function parseChatImageRef(ref) {
    if (!ref) return null;
    const s = String(ref).trim();
    if (s.startsWith("storage:chat-images/")) {
        return s.slice("storage:chat-images/".length).split("?")[0];
    }
    if (s.startsWith("storage:")) {
        const rest = s.slice(8);
        const i = rest.indexOf("/");
        if (i > 0 && rest.slice(0, i) === "chat-images") {
            return rest.slice(i + 1).split("?")[0];
        }
    }
    const pub = s.match(/\/storage\/v1\/object\/public\/chat-images\/(.+?)(?:\?|$)/);
    if (pub) return decodeURIComponent(pub[1]);
    const sig = s.match(/\/storage\/v1\/object\/sign\/chat-images\/(.+?)(?:\?|$)/);
    if (sig) return decodeURIComponent(sig[1]);
    if (!/^https?:\/\//i.test(s) && s.includes("/")) return s.split("?")[0];
    return null;
}

const _chatImgSignedCache = Object.create(null);

/** Signed URL cho bucket chat-images private (cache ~50 phút) */
async function resolveChatImageUrl(ref, expiresIn) {
    expiresIn = expiresIn || 3600;
    if (!ref) return null;
    const s = String(ref).trim();
    const path = parseChatImageRef(s);
    if (!path) {
        if (/^https?:\/\//i.test(s)) return s;
        return null;
    }
    if (!window.supabaseClient) return null;
    const now = Date.now();
    const hit = _chatImgSignedCache[path];
    if (hit && hit.exp > now + 60000) return hit.url;
    try {
        const { data, error } = await window.supabaseClient.storage
            .from("chat-images")
            .createSignedUrl(path, expiresIn);
        if (error || !data || !data.signedUrl) {
            console.warn("[ZChat] createSignedUrl chat-images:", error && error.message);
            return /^https?:\/\//i.test(s) ? s : null;
        }
        _chatImgSignedCache[path] = { url: data.signedUrl, exp: now + expiresIn * 1000 };
        return data.signedUrl;
    } catch (e) {
        console.warn("[ZChat] resolveChatImageUrl:", e);
        return /^https?:\/\//i.test(s) ? s : null;
    }
}

/** Gán src signed + đợi ảnh load xong (tránh scroll đáy sớm rồi bị văng khi ảnh cao ra) */
async function hydrateChatImages(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll("img[data-chat-image-ref]");
    if (!nodes.length) return;
    await Promise.all(Array.from(nodes).map(async (img) => {
        const ref = img.getAttribute("data-chat-image-ref");
        if (!ref) return;
        const url = await resolveChatImageUrl(ref);
        if (!url) return;
        await new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            img.onload = finish;
            img.onerror = finish;
            img.src = url;
            img.setAttribute("data-full-src", url);
            // cache hit / đã decode
            if (img.complete && img.naturalWidth > 0) finish();
            // an toàn: không treo mãi
            setTimeout(finish, 8000);
        });
    }));
}

/** Cuộn messageFeed xuống tin cuối */
function scrollMessageFeedToBottom() {
    if (!messageFeed) return;
    try {
        messageFeed.scrollTop = messageFeed.scrollHeight;
    } catch (_) {}
}

/**
 * @param {object} chat
 * @param {{ preserveScroll?: boolean, scrollTop?: number }} [opts]
 */
function renderMessages(chat, opts) {
    opts = opts || {};

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

        const { replyId, replySender, replyPreview, body } = parseReply(msg.text || "");

        let contentHtml = "";
        let isImageMsg = false;
        if (body) {
            if (body.startsWith("[IMAGE]:")) {
                isImageMsg = true;
                const imgRef = body.replace("[IMAGE]:", "").trim();
                contentHtml = `<img src="" data-chat-image-ref="${escapeHtml(imgRef)}" class="msg-image block rounded-2xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity bg-elevated2" data-full-src="" alt="Photo" />`;
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
                replyThumbHtml = `<div class="msg-reply-quote msg-reply-quote--image" data-reply-target="${escapeHtml(String(replyId))}">
                        <div class="msg-reply-image-head">
                            <span class="msg-reply-image-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg></span>
                            <span class="msg-reply-image-name">${escapeHtml(replyNameLabel)}</span>
                        </div>
                        <img src="" data-chat-image-ref="${escapeHtml(replyImgUrl)}" class="msg-reply-thumb" alt="Photo" loading="lazy" />
                    </div>`;
            } else {
                replyQuoteHtml = `<div class="msg-reply-quote flex flex-col gap-0.5 mb-1" data-reply-target="${escapeHtml(String(replyId))}">
                     <span class="text-[11px] font-semibold" style="color: var(--ink); opacity: .85;">${escapeHtml(replySender)}</span>
                     <span class="text-[11px] opacity-70 msg-reply-preview" style="color: var(--ink);">${escapeHtml(shortReplyPrev)}</span>
                   </div>`;
            }
        }

        const menuBtnHtml = `
                <button type="button" class="btn-msg-menu absolute top-1/2 -translate-y-1/2 ${isMine ? "-left-9" : "-right-9"} flex h-7 w-7 items-center justify-center rounded-full opacity-50 hover:opacity-100 hover:bg-elevated2 transition-all z-0" style="color: var(--muted);" title="More">
                    <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                </button>`;

        const bubbleInner = isImageMsg
            ? `${replyQuoteHtml}${contentHtml}`
            : `<div class="rounded-bubble px-4 py-2.5 text-[14.5px] leading-relaxed font-medium ${showTail ? (isMine ? "rounded-br-md" : "rounded-bl-md") : ""}" style="${bubbleStyle}">${replyQuoteHtml}${contentHtml}</div>`;

        const bubble = body ? `<div class="msg-bubble-pressable">${bubbleInner}</div>` : "";

        const disappearingOn = chat.disappearingTime && chat.disappearingTime !== "off";
        const timerIcon = disappearingOn
            ? `<i data-lucide="timer" class="w-[11px] h-[11px] shrink-0" style="color: var(--faint); opacity: 0.85;" title="Disappearing message"></i>`
            : "";

        const seenHtml = (isMine && i === lastMineIdx) ? statusIconMarkup(msg.status) : "";
        const metaInner = `${timerIcon}${seenHtml}`;
        const hasMetaContent = !!timerIcon || !!seenHtml;

        const meta = (showTail && hasMetaContent)
            ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${metaInner}</div>`
            : (disappearingOn
                ? `<div class="flex items-center gap-1 px-1 text-[11px]" style="color: var(--faint);">${timerIcon}</div>`
                : "");

        // Menu 3 chấm neo theo bong bóng/ảnh — không tính khối Seen (meta)
        wrap.innerHTML = `
        <div class="flex max-w-[72%] min-w-0 flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}">
          <div class="relative">
            ${menuBtnHtml}
            ${attachmentHtml}
            ${replyThumbHtml}
            ${bubble}
          </div>
          ${meta}
        </div>`;

        const btnMenu = wrap.querySelector(".btn-msg-menu");
        if (btnMenu) {
            btnMenu.addEventListener("click", (e) => {
                e.stopPropagation();
                const rect = btnMenu.getBoundingClientRect();
                openMessageActionMenu(
                    msg, chat, isMine,
                    rect.left + rect.width / 2,
                    rect.bottom + 6
                );
            });
        }

        const imgEl = wrap.querySelector(".msg-image");
        if (imgEl) {
            imgEl.addEventListener("click", async () => {
                let url = imgEl.dataset.fullSrc || imgEl.getAttribute("src") || "";
                const ref = imgEl.getAttribute("data-chat-image-ref");
                if ((!url || url === "") && ref) {
                    url = (await resolveChatImageUrl(ref)) || "";
                }
                if (url) openImageLightbox(url);
            });
        }

        const quoteEl = wrap.querySelector(".msg-reply-quote");
        if (quoteEl) {
            quoteEl.addEventListener("click", (e) => {
                e.stopPropagation();
                scrollToMessage(quoteEl.dataset.replyTarget);
            });
        }

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

    const preserve = !!(opts && opts.preserveScroll);
    const savedTop = (opts && typeof opts.scrollTop === "number") ? opts.scrollTop : null;

    if (preserve) {
        // Xóa tin lúc đang lướt trên → giữ vị trí
        const apply = () => {
            if (messageFeed && savedTop != null) messageFeed.scrollTop = savedTop;
        };
        apply();
        requestAnimationFrame(apply);
        hydrateChatImages(messageFeed).catch(() => {}).finally(apply);
    } else {
        // Mở chat: stick đáy — cuộn sau render, sau frame, SAU khi ảnh load xong
        scrollMessageFeedToBottom();
        requestAnimationFrame(() => {
            scrollMessageFeedToBottom();
            requestAnimationFrame(scrollMessageFeedToBottom);
        });
        hydrateChatImages(messageFeed)
            .catch(() => {})
            .finally(() => {
                scrollMessageFeedToBottom();
                requestAnimationFrame(() => {
                    scrollMessageFeedToBottom();
                    // 1 nhịp layout cuối (font/ảnh decode)
                    setTimeout(scrollMessageFeedToBottom, 50);
                    setTimeout(scrollMessageFeedToBottom, 200);
                });
            });
    }
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
