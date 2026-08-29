/* ============================================================
 * 19-messages-io.js
 * Giao tiếp Supabase cho tin nhắn: load lịch sử, gửi tin (bao gồm E2EE encrypt/decrypt). Phụ thuộc: 02-04, 09, 12.
 * ============================================================ */
/* ============ SUPABASE MESSAGES ============ */
function makeUuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

async function loadMessagesFromSupabase() {
    if (!window.supabaseClient) {
        console.warn("[ZChat] supabaseClient missing");
        if (typeof hideAppLoading === "function") hideAppLoading();
        return;
    }
    try {
        const me = currentUsername || localStorage.getItem("zchat_username") || "";
        const meLower = me.toLowerCase();
        if (!meLower) return;

        const PREVIEW_PER_CHAT = 5;
        const myId = await getMyUserId();
        const mySavedChatId = myId ? ("saved_" + myId) : ("saved_" + meLower);
        ensureSavedMessagesChat();
        if (myId) {
            try { await ensureSavedMessagesConversation(myId); } catch (_) {}
        }

        // 1) Danh sách conversation UUID của mình
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
                console.warn("[ZChat] load conversations:", e);
            }
        }
        const convIds = convRows.map((c) => c.id).filter(Boolean);

        // Resolve username đối phương từ user_1 / user_2 (tránh hiện "Chat User")
        const otherIds = [];
        const convOtherId = Object.create(null); // convId → otherUserId
        for (const c of convRows) {
            if (!c || !c.id || !myId) continue;
            const otherId = String(c.user_1) === String(myId) ? c.user_2 : c.user_1;
            if (otherId) {
                convOtherId[c.id] = otherId;
                otherIds.push(otherId);
            }
        }
        const uniqueOtherIds = [...new Set(otherIds.filter(Boolean))];
        if (uniqueOtherIds.length && window.supabaseClient) {
            try {
                const { data: userRows } = await window.supabaseClient
                    .from("users")
                    .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url, is_verified")
                    .in("id", uniqueOtherIds);
                const byId = Object.create(null);
                (userRows || []).forEach((u) => {
                    if (u && u.id) byId[u.id] = u;
                });
                for (const c of convRows) {
                    if (!c || !c.id) continue;
                    const oid = convOtherId[c.id];
                    const u = oid ? byId[oid] : null;
                    if (u && u.username) {
                        conversationOtherName[c.id] = u.username;
                    }
                }
                // Gắn luôn vào state nếu chat đã tồn tại
                state.chats.forEach((chat) => {
                    if (!isUuid(chat.id)) return;
                    const uname = conversationOtherName[chat.id];
                    if (uname && (chat.participant.name === "Chat User" || !chat.participant.name)) {
                        chat.participant.name = uname;
                        const oid = convOtherId[chat.id];
                        const u = oid ? byId[oid] : null;
                        if (u) applyAvatarFields(chat.participant, u);
                        if (oid) chat.participant.userId = oid;
                    }
                });
            } catch (e) {
                console.warn("[ZChat] resolve partner names:", e);
            }
        }

        // Đảm bảo có slot chat trong state (kể cả chưa có tin)
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
                state.chats.push(chat);
            } else {
                if (partnerName && (chat.participant.name === "Chat User" || !chat.participant.name)) {
                    chat.participant.name = partnerName;
                }
                if (otherId) chat.participant.userId = otherId;
            }
        }

        // 2) Tập chat_id cần preview: conversations + saved + (legacy nếu còn)
        const chatIdsToPreview = [...new Set([mySavedChatId, ...convIds])];

        // 3) Mỗi chat: lấy 5 tin mới nhất (có content) — chạy song song theo lô
        const fetchPreview = async (chatId) => {
            const { data, error } = await window.supabaseClient
                .from("messages")
                .select("id, chat_id, sender_id, content, created_at, read_at")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: false })
                .limit(PREVIEW_PER_CHAT);
            if (error) {
                console.warn("[ZChat] preview", chatId, error.message || error);
                return [];
            }
            return data || [];
        };

        const BATCH = 6;
        const allPreviewRows = [];
        for (let i = 0; i < chatIdsToPreview.length; i += BATCH) {
            const slice = chatIdsToPreview.slice(i, i + BATCH);
            const parts = await Promise.all(slice.map(fetchPreview));
            parts.forEach((rows) => allPreviewRows.push(...rows));
        }

        // Legacy: nếu chưa có conv, vẫn lấy vài tin chat_* gần nhất để dựng list
        if (!convIds.length) {
            const { data: legacyRows } = await window.supabaseClient
                .from("messages")
                .select("id, chat_id, sender_id, content, created_at, read_at")
                .or(`chat_id.ilike.chat_${meLower}_%,chat_id.ilike.chat_%_${meLower}`)
                .order("created_at", { ascending: false })
                .limit(40);
            (legacyRows || []).forEach((m) => allPreviewRows.push(m));
        }

        const pendingNameResolves = [];
        // Giữ tối đa 5 tin / chat (đã limit ở query; legacy gộp thì cắt lại)
        const perChatCount = Object.create(null);

        // Mới nhất trước
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
                    pendingNameResolves.push({ chatId, meId: myId });
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
            // Cập nhật tên nếu đang placeholder
            if (
                (chat.participant.name === "Chat User" || !chat.participant.name) &&
                m.sender_id &&
                String(m.sender_id) !== String(myIdNow())
            ) {
                const cachedName = userIdToName[m.sender_id];
                if (cachedName) {
                    chat.participant.name = cachedName;
                    conversationOtherName[chatId] = cachedName;
                }
                chat.participant.userId = m.sender_id;
            }
        }

        await Promise.all(
            pendingNameResolves.map(async ({ chatId, meId }) => {
                const name = await resolveOtherNameFromConversationId(chatId, meId);
                if (!name) return;
                const chat = state.chats.find((c) => c.id === chatId);
                if (chat && (chat.participant.name === "Chat User" || !chat.participant.name)) {
                    chat.participant.name = name;
                }
            })
        );

        // Bổ sung: nếu còn "Chat User" mà có tin từ người khác → resolve tên theo sender_id
        state.chats.forEach((chat) => {
            if (chat.participant.name !== "Chat User" && chat.participant.name) return;
            if (String(chat.id).startsWith("saved_")) {
                chat.participant.name = (currentUsername || localStorage.getItem("zchat_username") || "Me").trim();
                chat.participant.isSelfNotes = true;
                return;
            }
            const fromMsg = chat.messages.find(
                (m) => m.senderId && m.senderId !== "me"
            );
            if (fromMsg && fromMsg.senderId) {
                const sid = fromMsg.senderId;
                chat.participant.userId = sid;
                const cached = userIdToName[sid];
                if (cached) {
                    chat.participant.name = cached;
                    conversationOtherName[chat.id] = cached;
                }
            } else if (conversationOtherName[chat.id]) {
                chat.participant.name = conversationOtherName[chat.id];
            }
        });

        await Promise.all(
            state.chats
                .filter((c) => c.participant && c.participant.userId &&
                    (!c.participant.name || c.participant.name === "Chat User"))
                .map(async (c) => {
                    const n = await resolveUsernameByUserId(c.participant.userId);
                    if (n) {
                        c.participant.name = n;
                        conversationOtherName[c.id] = n;
                    }
                })
        );

        state.chats.forEach((c) => {
            c.messages.sort((a, b) => a.createdAt - b.createdAt);
        });

        if (window.ZChatE2EE) {
            try {
                await window.ZChatE2EE.ensureUserKeys(me);
                const priv = window.ZChatE2EE.getLocalPrivateKey();
                if (priv) {
                    const allMsgs = [];
                    state.chats.forEach((c) => c.messages.forEach((m) => allMsgs.push(m)));
                    await window.ZChatE2EE.decryptMessagesBatch(allMsgs, priv);
                }
            } catch (e2eeErr) {
                console.error("[E2EE] ensure keys / preview decrypt:", e2eeErr);
            }
        }

        renderChatList();
        const activeChat = state.chats.find((c) => c.id === state.activeChatId);
        if (activeChat) {
            // Mở sẵn 1 chat → load full
            await loadMessagesForChat(activeChat.id);
        }

        refreshAllParticipantAvatars();
    } catch (err) {
        console.error("[ZChat] loadMessagesFromSupabase exception:", err);
    } finally {
        if (typeof hideAppLoading === "function") hideAppLoading();
        else {
            const el = document.getElementById("appLoading");
            if (el) { el.classList.add("is-done"); setTimeout(() => { try { el.remove(); } catch (_) {} }, 280); }
        }
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
        // Load toàn bộ tin của chat (phân trang lớn; thực tế 1-1 ít khi > vài nghìn)
        const PAGE = 500;
        let offset = 0;
        let allRows = [];
        for (;;) {
            const { data, error } = await window.supabaseClient
                .from("messages")
                .select("id, chat_id, sender_id, content, created_at, read_at")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: false })
                .range(offset, offset + PAGE - 1);
            if (error) {
                console.error("[ZChat] loadMessagesForChat:", error);
                break;
            }
            const batch = data || [];
            allRows = allRows.concat(batch);
            if (batch.length < PAGE) break;
            offset += PAGE;
            // an toàn: tối đa ~5000 tin / chat
            if (offset >= 5000) break;
        }

        const rows = allRows.slice().reverse();
        const byId = new Map();
        chat.messages.forEach((m) => {
            if (!m._metaOnly) byId.set(m.id, m);
        });
        rows.forEach((m) => {
            if (byId.has(m.id)) return;
            byId.set(m.id, {
                id: m.id,
                senderId: senderIdFromRow(m, myIdNow()),
                text: m.content || "",
                createdAt: new Date(m.created_at).getTime(),
                status: m.read_at ? "read" : "delivered",
            });
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
    let currentChat = state.chats.find(c => c.id === chatId);

    let realChatId = chatId;

    const isSavedChat =
        (currentChat && isSelfNotesChat(currentChat)) ||
        String(chatId || "").startsWith("saved_");

    if (isSavedChat) {
        const myId = await getMyUserId();
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
        // Đã là conversations.id
        realChatId = chatId;
    } else {
        // Tạo / lấy conversation uuid từ 2 user
        const otherUser = (currentChat && currentChat.participant.name
                ? currentChat.participant.name
                : ""
        ).trim();
        if (!otherUser) {
            console.error("[ZChat] postMessage: missing partner");
            return;
        }
        const myId = await getMyUserId();
        let otherId = (currentChat && currentChat.participant.userId) || null;
        if (!otherId) otherId = await resolveUserIdByUsername(otherUser);

        if (myId && otherId) {
            const convId = await getOrCreateConversationId(myId, otherId);
            if (convId) {
                realChatId = convId;
                conversationOtherName[convId] = otherUser;
                if (currentChat) {
                    if (currentChat.id !== convId) {
                        currentChat.id = convId;
                        currentChat.participant.userId = otherId;
                        if (state.activeChatId === chatId) state.activeChatId = convId;
                    }
                }
            }
        }
        // Fallback legacy — vẫn không bao giờ dùng saved_ cho chat 1-1
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

    let senderUuid = myIdNow();
    if (!senderUuid && typeof getMyUserId === "function") {
        try { senderUuid = (await getMyUserId()) || ""; } catch (_) {}
    }
    const row = {
        id: makeUuid(),
        chat_id: realChatId,
        sender_id: senderUuid || null,
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
