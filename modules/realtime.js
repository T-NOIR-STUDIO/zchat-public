/* ============================================================
 * 21-realtime.js
 * ============================================================ */
/* ============ REALTIME ============ */
function isChatIdMine(chatId, meLower) {
    if (!chatId || !meLower) return false;
    if (chatId.startsWith("saved_")) {
        const uid = myUserIdCache || localStorage.getItem("zchat_user_id") || "";
        if (uid && chatId === ("saved_" + uid)) return true;
        if (chatId === ("saved_" + meLower)) return true;
        return false;
    }
    if (chatId.startsWith("chat_")) {
        const rest = chatId.slice(5);
        return rest === meLower || rest.startsWith(meLower + "_") || rest.endsWith("_" + meLower);
    }
    if (isUuid(chatId)) {
        if (conversationOtherName[chatId]) return true;
        if (state.chats.some((c) => c.id === chatId)) return true;
        return false;
    }
    return false;
}

async function isConversationMineAsync(chatId) {
    if (!isUuid(chatId) || !window.supabaseClient) return false;
    if (isChatIdMine(chatId, (currentUsername || "").toLowerCase())) return true;
    const myId = await getMyUserId();
    if (!myId) return false;
    try {
        const { data } = await window.supabaseClient
            .from("conversations")
            .select("id")
            .eq("id", chatId)
            .or(`user_1.eq.${myId},user_2.eq.${myId}`)
            .maybeSingle();
        return !!(data && data.id);
    } catch (_) {
        return false;
    }
}

function resolveOtherNameFromChatId(chatId, me, senderUsername) {
    const meL = (me || "").toLowerCase();
    if (!chatId) return senderUsername && senderUsername.toLowerCase() !== meL ? senderUsername : "Chat User";
    if (chatId.startsWith("saved_")) return (currentUsername || localStorage.getItem("zchat_username") || me || "Me").trim();
    if (chatId.startsWith("chat_")) {
        const rest = chatId.slice(5);
        if (meL && rest.startsWith(meL + "_")) return rest.slice(meL.length + 1);
        if (meL && rest.endsWith("_" + meL)) return rest.slice(0, -(meL.length + 1));
        const other = rest.split("_").find((p) => p && p !== meL);
        if (other) return other;
    }
    if (isUuid(chatId) && conversationOtherName[chatId]) {
        return conversationOtherName[chatId];
    }
    if (senderUsername && senderUsername.toLowerCase() !== meL) return senderUsername;
    return "Chat User";
}

function subscribeToMessages() {
    if (!window.supabaseClient) {
        console.warn("[ZChat] Realtime: supabaseClient missing");
        return;
    }

    const channel = window.supabaseClient
        .channel("zchat-messages-realtime")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            async (payload) => {
                try {
                    const newMsg = payload.new;
                    if (!newMsg) return;

                    const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
                    const meLower = me.toLowerCase();
                    const chatId = newMsg.chat_id;
                    if (!chatId || !meLower) return;
                   
                    let mine = isChatIdMine(chatId, meLower);
                    if (!mine && isUuid(chatId)) {
                        mine = await isConversationMineAsync(chatId);
                    }
                    if (!mine) return;

                    if (String(chatId).startsWith("saved_")) {
                        const uid = myUserIdCache || localStorage.getItem("zchat_user_id") || "";
                        if (!((uid && chatId === ("saved_" + uid)) || chatId === ("saved_" + meLower))) return;
                    }

                    let chat = state.chats.find((c) => c.id === chatId);

                    if (!chat) {
                        let otherName;
                        if (String(chatId).startsWith("saved_")) {
                            otherName = me || "Me";
                        } else {
                            otherName = resolveOtherNameFromChatId(chatId, me, userIdToName[newMsg.sender_id] || null);
                            if (isUuid(chatId) && (otherName === "Chat User" || !otherName)) {
                                const myId = await getMyUserId();
                                const resolved = await resolveOtherNameFromConversationId(chatId, myId);
                                if (resolved) otherName = resolved;
                            }
                            if ((!otherName || otherName === "Chat User") &&
                                newMsg.sender_id &&
                                String(newMsg.sender_id) !== String(myIdNow())) {
                                const n = userIdToName[newMsg.sender_id] ||
                                    (await resolveUsernameByUserId(newMsg.sender_id));
                                if (n) otherName = n;
                            }
                        }
                        const selfNote = String(chatId).startsWith("saved_");
                        chat = {
                            id: chatId,
                            participant: {
                                id: uid("u"),
                                name: otherName || "Chat User",
                                online: true,
                                lastSeen: null,
                                isSelfNotes: selfNote,
                            },
                            unread: 0,
                            disappearingTime: "off",
                            blockScreenshots: false,
                            messages: [],
                        };
                        state.chats.unshift(chat);
                        if (otherName && !selfNote) {
                            fetchAvatarForUsername(otherName).then((row) => {
                                if (row) {
                                    applyAvatarFields(chat.participant, row);
                                    if (row.id) chat.participant.userId = row.id;
                                    renderChatList();
                                    if (state.activeChatId === chat.id) renderActiveChat();
                                }
                            });
                        }
                    }

                    if (chat.messages.some((m) => m.id === newMsg.id)) return;

                    const ts = new Date(newMsg.created_at).getTime();
                    const isMineMsg = isRowFromMe(newMsg, myIdNow());

                    if (isMineMsg) {
                        const pending = [...chat.messages].reverse().find((m) =>
                            m.senderId === "me" &&
                            typeof m.id === "string" &&
                            (m.id.startsWith("m_") || m.status === "sending" || m.status === "delivered") &&
                            Math.abs((m.createdAt || 0) - ts) < 60000
                        );
                        if (pending) {
                            pending.id = newMsg.id;
                            pending.status = "read";
                            return;
                        }
                    }

                    let rtText = newMsg.content || "";
                    if (window.ZChatE2EE && rtText) {
                        try {
                            await window.ZChatE2EE.ensureUserKeys(me);
                            const priv = window.ZChatE2EE.getLocalPrivateKey();
                            if (priv) {
                                const plain = await window.ZChatE2EE.safeDecryptContent(rtText, priv);
                                if (plain != null) rtText = plain;
                            }
                        } catch (_) {}
                    }

                    chat.messages.push({
                        id: newMsg.id,
                        senderId: isMineMsg ? "me" : (newMsg.sender_id || "other"),
                        text: rtText,
                        createdAt: ts,
                        status: "read",
                    });
                    chat.messages.sort((a, b) => a.createdAt - b.createdAt);

                    if (state.activeChatId === chat.id) {
                        renderMessages(chat);
                        if (chatHeaderName) {
                            chatHeaderName.innerHTML =
                                escapeHtml(chat.participant.name) +
                                getVerifiedBadge(!!chat.participant.isVerified);
                        }
                        markChatAsRead(chat.id);
                    } else if (!isMineMsg) {
                        chat.unread = (chat.unread || 0) + 1;
                    }
                    renderChatList();
                } catch (err) {
                    console.error("[ZChat] Realtime handler error:", err);
                }
            }
        )
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "messages" },
            async (payload) => {
                try {
                    const updatedMsg = payload.new;
                    if (!updatedMsg) return;

                    const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
                    const meLower = me.toLowerCase();
                    const chatId = updatedMsg.chat_id;
                    if (!chatId || !meLower) return;

                    if (!isChatIdMine(chatId, meLower) &&
                        !(typeof isUuid === "function" && isUuid(chatId) && state.chats.some((c) => c.id === chatId))) {
                        return;
                    }

                    const chat = state.chats.find((c) => c.id === chatId);
                    if (!chat) return;

                    const msg = chat.messages.find((m) => m.id === updatedMsg.id);
                    if (!msg) return;

                    let needRender = false;
                    if (updatedMsg.read_at && msg.status !== "read") {
                        msg.status = "read";
                        needRender = true;
                    }

                    const rawContent = updatedMsg.content || "";
                    if (rawContent) {
                        let plain = rawContent;
                        if (window.ZChatE2EE) {
                            try {
                                await window.ZChatE2EE.ensureUserKeys(me);
                                const priv = window.ZChatE2EE.getLocalPrivateKey();
                                if (priv) {
                                    const d = await window.ZChatE2EE.safeDecryptContent(rawContent, priv);
                                    if (d != null) plain = d;
                                }
                            } catch (_) {}
                        }
                        const stillCipher =
                            plain === rawContent &&
                            window.ZChatE2EE &&
                            typeof window.ZChatE2EE.looksLikeE2eePayload === "function" &&
                            window.ZChatE2EE.looksLikeE2eePayload(rawContent);
                        if (!stillCipher && plain !== msg.text) {
                            msg.text = plain;
                            msg.isEdited = true;
                            needRender = true;
                        }
                    }

                    if (needRender) {
                        if (state.activeChatId === chat.id) renderMessages(chat);
                        renderChatList();
                    }
                } catch (err) {
                    console.error("[ZChat] Realtime UPDATE handler error:", err);
                }
            }
        )
        .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "messages" },
            (payload) => {
                try {
                    const deletedId = payload.old && payload.old.id;
                    if (!deletedId) return;

                    for (const chat of state.chats) {
                        const idx = chat.messages.findIndex((m) => m.id === deletedId);
                        if (idx === -1) continue;

                        chat.messages.splice(idx, 1);
                        if (state.activeChatId === chat.id) renderMessages(chat);
                        renderChatList();
                        break;
                    }
                } catch (err) {
                    console.error("[ZChat] Realtime DELETE handler error:", err);
                }
            }
        )
        .subscribe((status) => {
            console.log("[ZChat] Realtime status:", status);
            if (status === "SUBSCRIBED") {
                console.log("[ZChat] Realtime OK");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                console.error("[ZChat] Realtime FAILED");
            }
        });

    return channel;
}
