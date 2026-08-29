/* ============================================================
 * 19-messages-io.js
 * Giao tiếp Supabase cho tin nhắn: load lịch sử, gửi tin (bao gồm E2EE encrypt/decrypt). Phụ thuộc: 02-04, 09, 12.
 * ============================================================ */

/* ============ HELPER FUNCTIONS ============ */
function makeUuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function hideAppLoading() {
    try {
        const el = document.getElementById("appLoading");
        if (el) {
            el.classList.add("is-done");
            setTimeout(() => { try { el.remove(); } catch (_) {} }, 400);
        }
    } catch (_) {}
}

/* ============ SUPABASE MESSAGES ============ */
async function loadMessagesFromSupabase() {
    if (!window.supabaseClient) {
        console.warn("[ZChat] supabaseClient missing");
        hideAppLoading();
        return;
    }

    try {
        const me = currentUsername || localStorage.getItem("zchat_username") || "";
        const meLower = me.toLowerCase();
        if (!meLower) {
            hideAppLoading();
            return;
        }

        const PREVIEW_PER_CHAT = 1;
        const myId = await getMyUserId();
        const mySavedChatId = myId ? ("saved_" + myId) : ("saved_" + meLower);
        
        ensureSavedMessagesChat();
        if (myId) {
            ensureSavedMessagesConversation(myId).catch(() => {});
        }

        // 1) Load Conversations của người dùng
        let convRows = [];
        if (myId) {
            try {
                const { data: convs, error: convErr } = await window.supabaseClient
                    .from("conversations")
                    .select("id, user_1, user_2")
                    .or(`user_1.eq.${myId},user_2.eq.${myId}`);
                if (convErr) {
                    console.warn("[ZChat] conversations:", convErr.message || convErr);
                } else {
                    convRows = convs || [];
                }
            } catch (e) {
                console.warn("[ZChat] load conversations exception:", e);
            }
        }

        const convIds = convRows.map((c) => c.id).filter(Boolean);
        const convOtherId = Object.create(null);
        const otherIds = [];

        for (const c of convRows) {
            if (!c || !c.id || !myId) continue;
            const otherId = String(c.user_1) === String(myId) ? c.user_2 : c.user_1;
            if (otherId) {
                convOtherId[c.id] = otherId;
                otherIds.push(otherId);
            }
        }
        const uniqueOtherIds = [...new Set(otherIds.filter(Boolean))];
        const chatIdsToPreview = [...new Set([mySavedChatId, ...convIds])].filter(Boolean);

        // 2) Tải Users partners & Preview messages SONG SONG
        const usersPromise = uniqueOtherIds.length
            ? window.supabaseClient
                .from("users")
                .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url, is_verified")
                .in("id", uniqueOtherIds)
            : Promise.resolve({ data: [] });

        const msgsPromise = (async () => {
            if (!chatIdsToPreview.length) return [];
            const ID_CHUNK = 30;
            const promises = [];

            for (let i = 0; i < chatIdsToPreview.length; i += ID_CHUNK) {
                const slice = chatIdsToPreview.slice(i, i + ID_CHUNK);
                promises.push(
                    window.supabaseClient
                        .from("messages")
                        .select("id, chat_id, sender_id, content, created_at, read_at")
                        .in("chat_id", slice)
                        .order("created_at", { ascending: false })
                        .limit(Math.min(200, slice.length * 4))
                );
            }

            try {
                const results = await Promise.all(promises);
                return results.flatMap(res => res.data || []);
            } catch (e) {
                console.warn("[ZChat] preview bulk exception:", e);
                return [];
            }
        })();

        const [userRes, allPreviewRows] = await Promise.all([usersPromise, msgsPromise]);
        
        // Cập nhật User cache
        const userRows = (userRes && userRes.data) || [];
        const byId = Object.create(null);
        userRows.forEach((u) => {
            if (u && u.id) {
                byId[u.id] = u;
                if (u.username) userIdToName[u.id] = u.username;
            }
        });

        for (const c of convRows) {
            if (!c || !c.id) continue;
            const oid = convOtherId[c.id];
            const u = oid ? byId[oid] : null;
            if (u && u.username) conversationOtherName[c.id] = u.username;
        }

        // Tạo / Cập nhật Slot chat trong state
        for (const c of convRows) {
            if (!c || !c.id) continue;
            const otherId = convOtherId[c.id] || (c.user_1 === myId ? c.user_2 : c.user_1);
            const partnerName = conversationOtherName[c.id] || null;
            let chat = state.chats.find((x) => x.id === c.id);

            if (!chat) {
                chat = {
                    id: c.id,
                    participant: {
                        id: otherId || uid("u"),
                        name: partnerName || "Chat User",
                        userId: otherId || null,
                        online: true,
                        lastSeen: null,
                    },
                    unread: 0,
                    disappearingTime: "off",
                    blockScreenshots: false,
                    messages: [],
                    _msgsFullyLoaded: false,
                };
                if (otherId && byId[otherId]) applyAvatarFields(chat.participant, byId[otherId]);
                state.chats.push(chat);
            } else {
                if (partnerName && (chat.participant.name === "Chat User" || !chat.participant.name)) {
                    chat.participant.name = partnerName;
                }
                if (otherId) {
                    chat.participant.userId = otherId;
                    if (byId[otherId]) applyAvatarFields(chat.participant, byId[otherId]);
                }
            }
        }

        // Processing Previews
        const perChatCount = Object.create(null);
        allPreviewRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        for (const m of allPreviewRows) {
            const chatId = m.chat_id;
            if (!chatId) continue;
            if (!isChatIdMine(chatId, meLower) && !(isUuid(chatId) && convIds.includes(chatId))) {
                continue;
            }
            perChatCount[chatId] = (perChatCount[chatId] || 0) + 1;
            if (perChatCount[chatId] > PREVIEW_PER_CHAT) continue;

            let chat = state.chats.find((c) => c.id === chatId);
            if (!chat) {
                let otherName = resolveOtherNameFromChatId(chatId, me, userIdToName[m.sender_id] || null);
                if (isUuid(chatId) && (otherName === "Chat User" || !otherName)) {
                    otherName = conversationOtherName[chatId] || otherName;
                }
                chat = {
                    id: chatId,
                    participant: {
                        id: uid("u"),
                        name: otherName,
                        online: true,
                        lastSeen: null,
                    },
                    unread: 0,
                    disappearingTime: "off",
                    blockScreenshots: false,
                    messages: [],
                    _msgsFullyLoaded: false,
                };
                state.chats.push(chat);
            }

            if (!chat.messages.some((existing) => existing.id === m.id)) {
                chat.messages.push({
                    id: m.id,
                    senderId: senderIdFromRow(m, myIdNow()),
                    text: m.content || "",
                    createdAt: new Date(m.created_at).getTime(),
                    status: m.read_at ? "read" : "delivered",
                });
            }
        }

        // Format tên Participant
        state.chats.forEach((chat) => {
            if (chat.participant.name !== "Chat User" && chat.participant.name) return;
            if (String(chat.id).startsWith("saved_")) {
                chat.participant.name = (currentUsername || localStorage.getItem("zchat_username") || "Me").trim();
                chat.participant.isSelfNotes = true;
                return;
            }
            if (conversationOtherName[chat.id]) {
                chat.participant.name = conversationOtherName[chat.id];
            }
        });

        state.chats.forEach((c) => {
            c.messages.sort((a, b) => a.createdAt - b.createdAt);
        });

        // 3) Bắt buộc DECRYPT XONG TẤT CẢ tin nhắn Preview rồi mới tắt Spinner
        if (window.ZChatE2EE) {
            try {
                await window.ZChatE2EE.ensureUserKeys(me);
                const priv = window.ZChatE2EE.getLocalPrivateKey();
                if (priv) {
                    const allMsgs = [];
                    state.chats.forEach((c) => c.messages.forEach((m) => allMsgs.push(m)));
                    if (allMsgs.length) {
                        await window.ZChatE2EE.decryptMessagesBatch(allMsgs, priv);
                    }
                }
            } catch (e2eeErr) {
                console.error("[E2EE] preview decrypt error:", e2eeErr);
            }
        }

        // 4) Render giao diện chính thức + TẮT SPINNER LOADING
        renderChatList();
        hideAppLoading();

        // Tải toàn bộ nội dung cho chat đang Active (nếu có) ở nền
        const activeChat = state.chats.find((c) => c.id === state.activeChatId);
        if (activeChat) {
            loadMessagesForChat(activeChat.id).catch((e) =>
                console.warn("[ZChat] background load chat failed:", e)
            );
        }

        refreshAllParticipantAvatars();
    } catch (err) {
        console.error("[ZChat] loadMessagesFromSupabase exception:", err);
        hideAppLoading();
    }
}

/* Tải danh sách tin nhắn cho 1 cuộc hội thoại (Tối ưu Lazy Load 50 tin) */
async function loadMessagesForChat(chatId) {
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat || !window.supabaseClient || !chatId) {
        if (chat && state.activeChatId === chatId) renderMessages(chat);
        return;
    }
    if (chat._msgsFullyLoaded) {
        if (state.activeChatId === chatId) renderMessages(chat);
        return;
    }

    try {
        const me = currentUsername || localStorage.getItem("zchat_username") || "";
        const PAGE_LIMIT = 50;

        const { data, error } = await window.supabaseClient
            .from("messages")
            .select("id, chat_id, sender_id, content, created_at, read_at")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: false })
            .limit(PAGE_LIMIT);

        if (error) {
            console.error("[ZChat] loadMessagesForChat query error:", error);
            if (state.activeChatId === chatId) renderMessages(chat);
            return;
        }

        const rows = (data || []).slice().reverse();
        const byId = new Map();
        chat.messages.forEach((m) => {
            if (!m._metaOnly) byId.set(m.id, m);
        });

        rows.forEach((m) => {
            if (!byId.has(m.id)) {
                byId.set(m.id, {
                    id: m.id,
                    senderId: senderIdFromRow(m, myIdNow()),
                    text: m.content || "",
                    createdAt: new Date(m.created_at).getTime(),
                    status: m.read_at ? "read" : "delivered",
                });
            }
        });

        chat.messages = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
        chat._msgsFullyLoaded = true;

        if (window.ZChatE2EE) {
            try {
                await window.ZChatE2EE.ensureUserKeys(me);
                const priv = window.ZChatE2EE.getLocalPrivateKey();
                if (priv) await window.ZChatE2EE.decryptMessagesBatch(chat.messages, priv);
            } catch (e2eeErr) {
                console.error("[E2EE] chat decrypt error:", e2eeErr);
            }
        }

        if (state.activeChatId === chatId) renderMessages(chat);
        renderChatList();
    } catch (err) {
        console.error("[ZChat] loadMessagesForChat exception:", err);
        if (state.activeChatId === chatId) renderMessages(chat);
    }
}

async function postMessageToSupabase(msgObj, chatId) {
    if (!window.supabaseClient) {
        console.warn("[ZChat] supabaseClient missing — message not saved to server");
        return;
    }

    const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
    const currentChat = state.chats.find(c => c.id === chatId);
    let realChatId = chatId;

    const myId = await getMyUserId();

    const isSavedChat =
        (currentChat && isSelfNotesChat(currentChat)) ||
        String(chatId || "").startsWith("saved_");

    if (isSavedChat) {
        realChatId = myId ? ("saved_" + myId) : ("saved_" + me.toLowerCase());
        if (myId) {
            try { await ensureSavedMessagesConversation(myId); } catch (_) {}
        }
        if (currentChat) {
            currentChat.id = realChatId;
            if (state.activeChatId === chatId) state.activeChatId = realChatId;
            if (currentChat.participant) {
                currentChat.participant.name = me;
                currentChat.participant.isSelfNotes = true;
            }
        }
    } else if (isUuid(chatId)) {
        realChatId = chatId;
    } else {
        const otherUser = (currentChat && currentChat.participant.name ? currentChat.participant.name : "").trim();
        if (!otherUser) {
            console.error("[ZChat] postMessage: missing partner");
            return;
        }

        let otherId = (currentChat && currentChat.participant.userId) || null;
        if (!otherId) otherId = await resolveUserIdByUsername(otherUser);

        if (myId && otherId) {
            const convId = await getOrCreateConversationId(myId, otherId);
            if (convId) {
                realChatId = convId;
                conversationOtherName[convId] = otherUser;
                if (currentChat && currentChat.id !== convId) {
                    currentChat.id = convId;
                    currentChat.participant.userId = otherId;
                    if (state.activeChatId === chatId) state.activeChatId = convId;
                }
            }
        }

        // Fallback legacy
        if (!isUuid(realChatId) && !String(realChatId).startsWith("saved_")) {
            const sortedUsers = [me.toLowerCase(), otherUser.toLowerCase()].sort();
            realChatId = `chat_${sortedUsers[0]}_${sortedUsers[1]}`;
            if (currentChat) {
                currentChat.id = realChatId;
                if (state.activeChatId === chatId) state.activeChatId = realChatId;
            }
        }
    }

    if (!realChatId) {
        console.error("[ZChat] postMessage: realChatId empty — abort");
        return;
    }

    // Mã hóa E2EE nếu không phải tin nhắn Saved
    let contentToStore = msgObj.text || msgObj.attachment || "";
    if (window.ZChatE2EE && contentToStore && currentChat && !isSelfNotesChat(currentChat)) {
        try {
            await window.ZChatE2EE.ensureUserKeys(me);
            const partner = await window.ZChatE2EE.fetchPublicKeyForUsername(currentChat.participant.name);
            const keysMap = {};
            const myPublic = window.ZChatE2EE.getLocalPublicKey();

            if (myPublic) keysMap[me.toLowerCase()] = myPublic;
            if (partner && partner.public_key) {
                keysMap[String(partner.username || currentChat.participant.name).toLowerCase()] = partner.public_key;
                currentChat.participant.publicKey = partner.public_key;
                if (partner.id) currentChat.participant.userId = partner.id;
            }

            if (Object.keys(keysMap).length) {
                contentToStore = await window.ZChatE2EE.encryptMessageForUsers(contentToStore, keysMap);
            }
        } catch (e2eeErr) {
            console.error("[E2EE] encrypt failed:", e2eeErr);
        }
    }

    const senderUuid = myIdNow() || myId || null;
    const row = {
        id: makeUuid(),
        chat_id: realChatId,
        sender_id: senderUuid,
        content: contentToStore,
        created_at: new Date(msgObj.createdAt || Date.now()).toISOString(),
    };

    try {
        const { data, error } = await window.supabaseClient
            .from("messages")
            .insert([row])
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("[ZChat] insert message error:", error);
            return;
        }
        if (data && data.id) msgObj.id = data.id;
    } catch (err) {
        console.error("[ZChat] postMessageToSupabase exception:", err);
    }
}
