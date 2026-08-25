/* ============================================================
 * 17-composer.js
 * ============================================================ */
function updateSendBtnState() {
    sendBtn.disabled = messageInput.value.trim().length === 0;
}

function autoResizeMessageInput() {
    if (!messageInput) return;
    const shell = document.getElementById("composerShell");
    const singleLineHeight = 24;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const maxHeight = Math.min(320, Math.max(96, Math.round(viewportHeight * 0.42)));
    const saved = messageInput.value || "";
    const hasNewline = /\n/.test(saved);

    if (shell) shell.classList.remove("is-multiline");
    messageInput.style.maxHeight = "none";
    messageInput.style.overflowY = "hidden";

    messageInput.value = "M";
    messageInput.style.height = "0px";
    const oneLineScroll = messageInput.scrollHeight;
    messageInput.value = saved;
    messageInput.style.height = "0px";
    const contentHeight = messageInput.scrollHeight;

    const isMultiline = hasNewline || contentHeight > oneLineScroll + 2;

    if (!isMultiline) {
        messageInput.style.height = singleLineHeight + "px";
        messageInput.style.maxHeight = "";
        return;
    }

    if (shell) shell.classList.add("is-multiline");
    messageInput.style.maxHeight = maxHeight + "px";
    messageInput.style.height = Math.min(Math.max(contentHeight, singleLineHeight), maxHeight) + "px";
    messageInput.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
}

messageInput.addEventListener("input", () => {
    autoResizeMessageInput();
    updateSendBtnState();
});

window.addEventListener("resize", autoResizeMessageInput);
if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", autoResizeMessageInput);
}

messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

sendBtn.addEventListener("click", handleSend);

async function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;
    const chat = state.chats.find((c) => c.id === state.activeChatId);
    if (!chat) return;

    if (editingMsgId) {
        const msg = chat.messages.find((m) => m.id === editingMsgId);
        if (msg) {
            const { replyId, replySender, replyPreview } = parseReply(msg.text || "");
            const newText = replyId ? buildReplyPrefix(replyId, replySender, replyPreview) + text : text;

            msg.text = newText;
            msg.isEdited = true;
            renderMessages(chat);
            renderChatList();

            if (window.supabaseClient) {
                try {
                    await window.supabaseClient
                        .from("messages")
                        .update({ content: newText })
                        .eq("id", editingMsgId);
                } catch (err) {
                    console.error("[ZChat] Update Supabase error:", err);
                }
            }
        }
        cancelEditMode();
        return;
    }

    let finalText = text;
    if (replyingMsgId) {
        const repliedMsg = chat.messages.find((m) => m.id === replyingMsgId);
        if (repliedMsg) {
            const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
            const senderName = repliedMsg.senderId === "me" ? me : chat.participant.name;
            finalText = buildReplyPrefix(replyingMsgId, senderName, previewForMessage(repliedMsg)) + text;
        }
    }
    cancelReplyMode();

    const msg = { id: uid("m"), senderId: "me", text: finalText, createdAt: Date.now(), status: "delivered" };
    chat.messages.push(msg);
    postMessageToSupabase(msg, chat.id);
    scheduleDisappearing(chat, msg);

    messageInput.value = "";
    if (typeof autoResizeMessageInput === "function") autoResizeMessageInput();
    else messageInput.style.height = "24px";
    updateSendBtnState();

    renderMessages(chat);
    renderChatList();
}

attachBtn.addEventListener("click", () => fileInput.click());

function renderEmojiPopover() {
    emojiPopover.innerHTML = EMOJIS.map(
        (e) => `<button type="button" class="emoji-opt text-xl leading-none p-1.5 rounded-lg hover:bg-elevated2 transition-colors">${e}</button>`
    ).join("");
    emojiPopover.querySelectorAll(".emoji-opt").forEach((btn) => {
        btn.addEventListener("click", () => {
            messageInput.value += btn.textContent;
            messageInput.dispatchEvent(new Event("input"));
            messageInput.focus();
            emojiPopover.classList.add("hidden");
        });
    });
}
renderEmojiPopover();

emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPopover.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
    if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) {
        emojiPopover.classList.add("hidden");
    }
});

function openNewChatModal() {
    newChatModal.classList.remove("hidden");
    newChatNameInput.value = "";
    const errEl = document.getElementById("newChatError");
    if (errEl) errEl.classList.add("hidden");
    newChatNameInput.focus();
}

function closeNewChatModal() {
    newChatModal.classList.add("hidden");
    const errEl = document.getElementById("newChatError");
    if (errEl) errEl.classList.add("hidden");
}

newChatEmptyBtn.addEventListener("click", openNewChatModal);
newChatIconBtn.addEventListener("click", openNewChatModal);
closeModalBtn.addEventListener("click", closeModalBtn ? closeNewChatModal : () => {});
cancelModalBtn.addEventListener("click", closeNewChatModal);
