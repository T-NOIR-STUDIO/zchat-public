/* ============================================================
 * 19-messages-io.js
 * Giao tiếp Supabase cho tin nhắn: Offline-First Engine, Fast Decrypt & Optimistic Send
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

function hideLoading() {
    try {
        const el = document.getElementById("appLoading");
        if (el) {
            el.classList.add("is-done");
            setTimeout(() => { try { el.remove(); } catch (_) {} }, 200);
        }
    } catch (_) {}
}

/* ============ LOCAL CACHE ENGINE ============ */
function saveStateToCache(username) {
    if (!username) return;
    try {
        const cacheData = {
            chats: state.chats,
            userIdToName,
            conversationOtherName,
            timestamp: Date.now()
        };
        localStorage.setItem(`zchat_cache_${username.toLowerCase()}`, JSON.stringify(cacheData));
    } catch (e) {
        console.warn("[ZChat Cache] Save error:", e);
    }
}

function loadStateFromCache(username) {
    if (!username) return false;
    try {
        const raw = localStorage.getItem(`zchat_cache_${username.toLowerCase()}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.chats)) {
            state.chats = parsed.chats;
            if (parsed.userIdToName) Object.assign(userIdToName, parsed.userIdToName);
            if (parsed.conversationOtherName) Object.assign(conversationOtherName, parsed.conversationOtherName);
            return true;
        }
    } catch (e) {
        console.warn("[ZChat Cache] Read error:", e);
    }
    return false;
}

/* ============ PUBLIC KEY CACHE ENGINE ============ */
async function getOrFetchPublicKey(username) {
    if (!username) return null;
    const cacheKey = `zchat_pubkey_${username.toLowerCase()}`;
    const cachedKey = localStorage.getItem(cacheKey);
    if (cachedKey) return cachedKey;

    if (window.ZChatE2EE && window.ZChatE2EE.fetchPublicKeyForUsername) {
        const partner = await window.ZChatE2EE.fetchPublicKeyForUsername(username);
        if (partner && partner.public_key) {
            localStorage.setItem(cacheKey, partner.public_key);
            return partner.public_key;
        }
    }
    return null;
}

/* ============ SUPABASE MESSAGES ============ */
async function loadMessagesFromSupabase() {
    const me = currentUsername || localStorage.getItem("zchat_username") || "";
    const meLower = me.toLowerCase();
    if (!meLower) { hideLoading(); return; }

    // 🚀 BƯỚC 1: LOAD TỪ CACHE (TỐC ĐỘ ~0MS - TẮT SPINNER TỨC THÌ)
    const hasCache = loadStateFromCache(meLower);
    if (hasCache) {
        renderChatList();
        hideLoading(); // Spinner tắt ngay tức thì!
    }

    if (!window.supabaseClient) {
        console.warn("[ZChat] supabaseClient missing");
        hideLoading();
        return;
    }

    // 🚀 BƯỚC 2: FETCH DATA MỚI NGẦM TRÊN NETWORK (BACKGROUND SYNC)
    try {
        const myId = await getMyUserId();
        if (myId) {
            ensureSavedMessagesChat();
            ensureSavedMessagesConversation(myId).catch(() => {});
        }

        // Tối ưu network: Sử dụng RPC gộp request (Fallback query song song)
        let chatPreviews = null;
        try {
            const { data, error } = await window.supabaseClient.rpc("get_user_chat_previews", { p_user_id: myId });
            if (!error && data) chatPreviews = data;
        } catch (_) {}

        if (!chatPreviews) {
            // Fallback: Query song song tốc độ cao
            const { data: convs } = await window.supabaseClient
                .from("conversations")
                .select("id, user_1, user_2")
                .or(`user_1.eq.${myId},user_2.eq.${myId}`);

            const convRows = convs || [];
            const convIds = convRows.map((c) => c.id).filter(Boolean);
            const otherIds = convRows.map(c => String(c.user_1) === String(myId) ? c.user_2 : c.user_1).filter(Boolean);

            const mySavedChatId = myId ? ("saved_" + myId) : ("saved_" + meLower);
            const chatIdsToPreview = [...new Set([mySavedChatId, ...convIds])].filter(Boolean);

            const [userRes, msgsRes] = await Promise.all([
                otherIds.length ? window.supabaseClient.from("users").select("id, username, avatar_url").in("id", [...new Set(otherIds)]) : { data: [] },
                chatIdsToPreview.length ? window.supabaseClient.from("messages").select("id, chat_id, sender_id, content, created_at, read_at").in("chat_id", chatIdsToPreview).order("created_at", { ascending: false }).limit(chatIdsToPreview.length * 2) : { data: [] }
            ]);

            (userRes.data || []).forEach(u => { if (u?.id && u?.username) userIdToName[u.id] = u.username; });

            const allPreviewRows = msgsRes.data || [];
            const perChatCount = Object.create(null);

            for (const m of allPreviewRows) {
                const chatId = m.chat_id;
                if (!chatId) continue;
                perChatCount[chatId] = (perChatCount[chatId] || 0) + 1;
                if (perChatCount[chatId] > 1) continue;

                let chat = state.chats.find((c) => c.id === chatId);
                if (!chat) {
                    chat = {
                        id: chatId,
                        participant: { id: uid("u"), name: userIdToName[m.sender_id] || "Chat User", online: true },
                        unread: 0, messages: [], _msgsFullyLoaded: false
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
        }

        // 🚀 BƯỚC 3: DECRYPT VỚI WORKER/NON-BLOCKING VÀ LƯU LOCAL CACHE
        if (window.ZChatE2EE) {
            try {
                await window.ZChatE2EE.ensureUserKeys(me);
                const priv = window.ZChatE2EE.getLocalPrivateKey();
                if (priv) {
                    const allMsgs = [];
                    state.chats.forEach((c) => c.messages.forEach((m) => allMsgs.push(m)));
                    if (allMsgs.length) await window.ZChatE2EE.decryptMessagesBatch(allMsgs, priv);
                }
            } catch (e2eeErr) {
                console.error("[E2EE] preview decrypt:", e2eeErr);
            }
        }

        // Lưu bản state mới nhất vào LocalStorage cho lần F5 tiếp theo
        saveStateToCache(meLower);

        // Update UI
        renderChatList();
        hideLoading();

        // Background load cho active chat
        const activeChat = state.chats.find((c) => c.id === state.activeChatId);
        if (activeChat && !activeChat._msgsFullyLoaded) {
            loadMessagesForChat(activeChat.id).catch(() => {});
        }

    } catch (err) {
        console.error("[ZChat] loadMessagesFromSupabase exception:", err);
        hideLoading();
    }
}

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
        // Giảm PAGE_LIMIT xuống 50 để phản hồi khung chat cực nhanh (Lazy load tiếp nếu kéo lên)
        const PAGE_LIMIT = 50;

        const { data, error } = await window.supabaseClient
            .from("messages")
            .select("id, chat_id, sender_id, content, created_at, read_at")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: false })
            .limit(PAGE_LIMIT);

        if (error) {
            if (state.activeChatId === chatId) renderMessages(chat);
            return;
        }

        const rows = (data || []).reverse();
        const byId = new Map();
        chat.messages.forEach((m) => { if (!m._metaOnly) byId.set(m.id, m); });

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
                console.error("[E2EE] chat decrypt:", e2eeErr);
            }
        }

        // Cache lại toàn bộ tin nhắn đã decrypt
        saveStateToCache(me);

        if (state.activeChatId === chatId) renderMessages(chat);
        renderChatList();
    } catch (err) {
        console.error("[ZChat] loadMessagesForChat exception:", err);
        if (state.activeChatId === chatId) renderMessages(chat);
    }
}

async function postMessageToSupabase(msgObj, chatId) {
    if (!window.supabaseClient) return;

    const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
    let currentChat = state.chats.find(c => c.id === chatId);
    let realChatId = chatId;

    const isSavedChat = (currentChat && isSelfNotesChat(currentChat)) || String(chatId || "").startsWith("saved_");

    if (isSavedChat) {
        const myId = await getMyUserId();
        realChatId = myId ? ("saved_" + myId) : ("saved_" + me.toLowerCase());
    } else if (!isUuid(chatId)) {
        const otherUser = (currentChat && currentChat.participant.name ? currentChat.participant.name : "").trim();
        if (!otherUser) return;

        const myId = await getMyUserId();
        let otherId = (currentChat && currentChat.participant.userId) || null;
        if (!otherId) otherId = await resolveUserIdByUsername(otherUser);

        if (myId && otherId) {
            const convId = await getOrCreateConversationId(myId, otherId);
            if (convId) {
                realChatId = convId;
                if (currentChat && currentChat.id !== convId) currentChat.id = convId;
            }
        }
    }

    let contentToStore = msgObj.text || msgObj.attachment || "";
    if (window.ZChatE2EE && contentToStore && currentChat && !isSelfNotesChat(currentChat)) {
        try {
            await window.ZChatE2EE.ensureUserKeys(me);
            // 🚀 Tối ưu: Lấy Public Key từ Cache cực nhanh (0ms)
            const partnerPubKey = await getOrFetchPublicKey(currentChat.participant.name);
            const myPublic = window.ZChatE2EE.getLocalPublicKey();
            
            const keysMap = {};
            if (myPublic) keysMap[me.toLowerCase()] = myPublic;
            if (partnerPubKey) keysMap[String(currentChat.participant.name).toLowerCase()] = partnerPubKey;

            if (Object.keys(keysMap).length) {
                contentToStore = await window.ZChatE2EE.encryptMessageForUsers(contentToStore, keysMap);
            }
        } catch (e2eeErr) {
            console.error("[E2EE] encrypt failed:", e2eeErr);
        }
    }

    const senderUuid = myIdNow() || await getMyUserId() || null;
    const row = {
        id: msgObj.id || makeUuid(),
        chat_id: realChatId,
        sender_id: senderUuid,
        content: contentToStore,
        created_at: new Date(msgObj.createdAt || Date.now()).toISOString(),
    };

    // Bắn request ngầm - Không chờ đợi UI
    window.supabaseClient.from("messages").insert([row]).then(({ data, error }) => {
        if (!error) saveStateToCache(me);
    }).catch(console.error);
}
