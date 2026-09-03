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

/** CSS load: ảnh gửi = cover; ẢNH REPLY = contain + max 80px (giữ tỷ lệ gốc) */
function ensureMsgImageLoadStyle() {
    if (document.getElementById("zchatMsgImageLoadStyle")) return;
    const s = document.createElement("style");
    s.id = "zchatMsgImageLoadStyle";
    s.textContent = `
.msg-image-wrap{position:relative;display:inline-block;overflow:hidden;border-radius:1rem;line-height:0;max-width:260px}
.msg-image-wrap .msg-image{display:block;max-width:260px;max-height:300px;width:auto;height:auto;object-fit:cover;transition:filter .35s ease,opacity .35s ease}
/* REPLY ONLY — không cover, không 260px */
.msg-image-wrap--reply,.msg-image-wrap:has(.msg-reply-thumb){max-width:80px!important;width:fit-content!important;border-radius:12px}
.msg-image-wrap .msg-reply-thumb{display:block;width:auto!important;height:auto!important;max-width:80px!important;max-height:80px!important;object-fit:contain!important;object-position:center;transition:filter .35s ease,opacity .35s ease}
.msg-image-wrap.is-loading .msg-image,.msg-image-wrap.is-loading .msg-reply-thumb{filter:blur(10px);opacity:.65}
.msg-image-wrap:not(.is-loading) .msg-image,.msg-image-wrap:not(.is-loading) .msg-reply-thumb{filter:none;opacity:1}
.msg-image-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .2s ease}
.msg-image-wrap.is-loading .msg-image-progress{opacity:1}
.msg-image-progress-bar{height:100%;width:0%;background:#1c9bf0;border-radius:0 2px 2px 0}
.msg-image-wrap.is-loading .msg-image-progress-bar{animation:zchatImgProgress 1.1s ease-in-out infinite}
@keyframes zchatImgProgress{0%{width:8%}50%{width:70%}100%{width:92%}}
.msg-image-wrap.is-done .msg-image-progress-bar{animation:none;width:100%;transition:width .2s ease}
.msg-image-wrap.is-done .msg-image-progress{opacity:0;transition:opacity .35s ease .15s}
`;
    document.head.appendChild(s);
}

function markImgWrapLoading(img) {
    if (!img) return null;
    ensureMsgImageLoadStyle();
    const isReply = img.classList.contains("msg-reply-thumb");
    let wrap = img.closest(".msg-image-wrap");
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "msg-image-wrap is-loading" + (isReply ? " msg-image-wrap--reply" : "");
        if (img.parentNode) img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        const bar = document.createElement("div");
        bar.className = "msg-image-progress";
        bar.innerHTML = '<div class="msg-image-progress-bar"></div>';
        wrap.appendChild(bar);
    } else {
        wrap.classList.add("is-loading");
        wrap.classList.remove("is-done");
        if (isReply) wrap.classList.add("msg-image-wrap--reply");
    }
    return wrap;
}

function markImgWrapDone(img) {
    const wrap = img && img.closest(".msg-image-wrap");
    if (!wrap) return;
    wrap.classList.add("is-done");
    wrap.classList.remove("is-loading");
    const bar = wrap.querySelector(".msg-image-progress-bar");
    if (bar) bar.style.width = "100%";
    setTimeout(() => { wrap.classList.remove("is-done"); }, 400);
}

async function hydrateChatImages(root) {
    const scope = root || document;
    const nodes = Array.from(scope.querySelectorAll("img[data-chat-image-ref]"));
    if (!nodes.length) return;
    ensureMsgImageLoadStyle();
    await Promise.all(nodes.map(async (img) => {
        const ref = img.getAttribute("data-chat-image-ref");
        if (!ref) return;
        markImgWrapLoading(img);
        let url = null;
        try { url = await resolveChatImageUrl(ref); } catch (_) {}
        if (!url) { markImgWrapDone(img); return; }
        await new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                markImgWrapDone(img);
                resolve();
            };
            img.addEventListener("load", finish, { once: true });
            img.addEventListener("error", finish, { once: true });
            if (img.getAttribute("src") !== url) img.src = url;
            img.setAttribute("data-full-src", url);
            if (img.complete && img.naturalWidth > 0) finish();
            setTimeout(finish, 8000);
        });
    }));
}

/** Overlay loading — không bị renderMessages xóa (nằm ngoài #messageFeed) */
function ensureChatLoadStyle() {
    if (document.getElementById("zchatChatLoadStyle")) return;
    const s = document.createElement("style");
    s.id = "zchatChatLoadStyle";
    s.textContent = `
@keyframes zchatChatSpin { to { transform: rotate(360deg); } }
#chatFeedLoadingOverlay {
  position: absolute; inset: 0; z-index: 30;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 2rem 1rem;
  background: var(--canvas, #0a0a0a);
}
#chatFeedLoadingOverlay .chat-load-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2.5px solid rgba(127,127,127,0.25);
  border-top-color: var(--ink, #fff);
  animation: zchatChatSpin 0.7s linear infinite;
}
#chatFeedLoadingOverlay p {
  margin: 0; font-size: 12px; color: var(--muted); font-weight: 500;
}
`;
    document.head.appendChild(s);
}

function showChatFeedLoading() {
    if (!messageFeed) return;
    ensureChatLoadStyle();
    const host = messageFeed.parentElement || messageFeed;
    const prev = window.getComputedStyle(host).position;
    if (prev === "static" || !prev) host.style.position = "relative";
    let el = document.getElementById("chatFeedLoadingOverlay");
    if (!el) {
        el = document.createElement("div");
        el.id = "chatFeedLoadingOverlay";
        el.setAttribute("aria-busy", "true");
        el.setAttribute("aria-live", "polite");
        el.innerHTML =
            '<div class="chat-load-spinner" role="status"></div>' +
            "<p>Loading chat…</p>";
        host.appendChild(el);
    }
    el.style.display = "flex";
}

function hideChatFeedLoading() {
    const el = document.getElementById("chatFeedLoadingOverlay");
    if (el) el.remove();
}

async function renderMessagesUntilImagesReady(chat, opts) {
    opts = opts || {};
    opts.skipAutoHydrate = true;
    renderMessages(chat, opts);
    hideChatFeedLoading();
    if (typeof scrollMessageFeedToBottom === "function") {
        try { scrollMessageFeedToBottom(); } catch (_) {}
    }
    hydrateChatImages(messageFeed).catch(() => {}).finally(() => {
        if (typeof scrollMessageFeedToBottom === "function") {
            try { scrollMessageFeedToBottom(); } catch (_) {}
        }
    });
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
                contentHtml = `<div class="msg-image-wrap is-loading"><img src="" data-chat-image-ref="${escapeHtml(imgRef)}" class="msg-image block rounded-2xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:opacity-95 bg-elevated2" data-full-src="" alt="Photo" /><div class="msg-image-progress"><div class="msg-image-progress-bar"></div></div></div>`;
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
                        <div class="msg-image-wrap is-loading msg-image-wrap--reply"><img src="" data-chat-image-ref="${escapeHtml(replyImgUrl)}" class="msg-reply-thumb" alt="Photo" loading="lazy" /><div class="msg-image-progress"><div class="msg-image-progress-bar"></div></div></div>
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

        // Menu 3 chấm chỉ neo giữa bubble tin nhắn (text/ảnh gửi) — không kèm reply thumb / attachment / Seen
        wrap.innerHTML = `
        <div class="flex max-w-[72%] min-w-0 flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}">
          ${attachmentHtml}
          ${replyThumbHtml}
          <div class="relative">
            ${menuBtnHtml}
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
        const apply = () => {
            if (messageFeed && savedTop != null) messageFeed.scrollTop = savedTop;
        };
        apply();
        requestAnimationFrame(apply);
        if (!opts.skipAutoHydrate) {
            hydrateChatImages(messageFeed).catch(() => {}).finally(apply);
        } else apply();
    } else {
        scrollMessageFeedToBottom();
        requestAnimationFrame(() => {
            scrollMessageFeedToBottom();
            requestAnimationFrame(scrollMessageFeedToBottom);
        });
        if (!opts.skipAutoHydrate) {
            hydrateChatImages(messageFeed)
                .catch(() => {})
                .finally(() => {
                    scrollMessageFeedToBottom();
                    requestAnimationFrame(() => {
                        scrollMessageFeedToBottom();
                        setTimeout(scrollMessageFeedToBottom, 50);
                        setTimeout(scrollMessageFeedToBottom, 200);
                    });
                });
        }
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
