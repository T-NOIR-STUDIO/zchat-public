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
    if (loadMessagesFromSupabase._inflight) return loadMessagesFromSupabase._inflight;

    loadMessagesFromSupabase._inflight = (async () => {
        try {
            const me = currentUsername || localStorage.getItem("zchat_username") || "";
            const meLower = me.toLowerCase();
            if (!meLower) return;

            const PREVIEW_PER_CHAT = 5;

            // 1) user id (thường đã cache localStorage)
            const myId = await getMyUserId();
            const mySavedChatId = myId ? ("saved_" + myId) : ("saved_" + meLower);
            ensureSavedMessagesChat();
            // Không await ensureSavedMessagesConversation — chạy nền, không chặn list
            if (myId) {
                Promise.resolve(ensureSavedMessagesConversation(myId)).catch(() => {});
            }

            // 2) conversations + (song song không được vì cần conv ids) — 1 query
            let convRows = [];
            if (myId) {
                const { data: convs, error: convErr } = await window.supabaseClient
                    .from("conversations")
                    .select("id, user_1, user_2")
                    .or(`user_1.eq.${myId},user_2.eq.${myId}`);
                if (convErr) console.warn("[ZChat] conversations:", convErr.message || convErr);
                else convRows = convs || [];
            }
            const convIds = convRows.map((c) => c && c.id).filter(Boolean);

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

            // 3) users (1 query) + messages preview (1 query) — SONG SONG
            const chatIdsToPreview = [...new Set([mySavedChatId, ...convIds].filter(Boolean))];
            const msgLimit = Math.min(Math.max(chatIdsToPreview.length * PREVIEW_PER_CHAT, PREVIEW_PER_CHAT), 120);

            const usersPromise = uniqueOtherIds.length
                ? window.supabaseClient
                    .from("users")
                    .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url, is_verified")
                    .in("id", uniqueOtherIds)
                : Promise.resolve({ data: [] });

            const msgsPromise = chatIdsToPreview.length
                ? window.supabaseClient
                    .from("messages")
                    .select("id, chat_id, sender_id, content, created_at, read_at")
                    .in("chat_id", chatIdsToPreview)
                    .order("created_at", { ascending: false })
                    .limit(msgLimit)
                : Promise.resolve({ data: [] });

            const [usersRes, msgsRes] = await Promise.all([usersPromise, msgsPromise]);

            const byId = Object.create(null);
            (usersRes.data || []).forEach((u) => {
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

            // Prefetch avatar signed URLs nền (không await)
            if (typeof prefetchAvatarUrls === "function") {
                const refs = (usersRes.data || []).map((u) => u && u.avatar_url).filter(Boolean);
                prefetchAvatarUrls(refs).then(() => {
                    if (typeof renderChatList === "function") renderChatList();
                }).catch(() => {});
            }

            // Slot chat từ conversations
            for (const c of convRows) {
                if (!c || !c.id) continue;
                const otherId = convOtherId[c.id];
                const u = otherId ? byId[otherId] : null;
                const partnerName = (u && u.username) || conversationOtherName[c.id] || null;
                let chat = state.chats.find((x) => x.id === c.id);
                if (!chat) {
                    chat = {
                        id: c.id,
                        participant: {
                            id: otherId || (typeof uid === "function" ? uid("u") : c.id),
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
                    if (u && typeof applyAvatarFields === "function") applyAvatarFields(chat.participant, u);
                    state.chats.push(chat);
                } else {
                    if (partnerName && (!chat.participant.name || chat.participant.name === "Chat User")) {
                        chat.participant.name = partnerName;
                    }
                    if (otherId) chat.participant.userId = otherId;
                    if (u && typeof applyAvatarFields === "function") applyAvatarFields(chat.participant, u);
                }
            }

            // Preview messages — đã gom 1 request
            const allPreviewRows = msgsRes.data || [];
            if (msgsRes.error) console.warn("[ZChat] preview batch:", msgsRes.error.message || msgsRes.error);

            // Legacy chỉ khi chưa có UUID conv
            if (!convIds.length) {
                const { data: legacyRows } = await window.supabaseClient
                    .from("messages")
                    .select("id, chat_id, sender_id, content, created_at, read_at")
                    .or(`chat_id.ilike.chat_${meLower}_%,chat_id.ilike.chat_%_${meLower}`)
                    .order("created_at", { ascending: false })
                    .limit(40);
                (legacyRows || []).forEach((m) => allPreviewRows.push(m));
            }

            const perChatCount = Object.create(null);
            allPreviewRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            for (const m of allPreviewRows) {
                const chatId = m.chat_id;
                if (!chatId) continue;
                if (!isChatIdMine(chatId, meLower) && !(isUuid(chatId) && convIds.includes(chatId))) continue;
                perChatCount[chatId] = (perChatCount[chatId] || 0) + 1;
                if (perChatCount[chatId] > PREVIEW_PER_CHAT) continue;

                let chat = state.chats.find((c) => c.id === chatId);
                if (!chat) {
                    let otherName = resolveOtherNameFromChatId(chatId, me, userIdToName[m.sender_id] || null);
                    if (isUuid(chatId)) otherName = conversationOtherName[chatId] || otherName;
                    chat = {
                        id: chatId,
                        participant: {
                            id: typeof uid === "function" ? uid("u") : chatId,
                            name: otherName || "Chat User",
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

                if (
                    (!chat.participant.name || chat.participant.name === "Chat User") &&
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

            // Saved messages label
            state.chats.forEach((chat) => {
                if (String(chat.id).startsWith("saved_")) {
                    chat.participant.name = (me || "Me").trim();
                    chat.participant.isSelfNotes = true;
                } else if ((!chat.participant.name || chat.participant.name === "Chat User") && conversationOtherName[chat.id]) {
                    chat.participant.name = conversationOtherName[chat.id];
                }
                chat.messages.sort((a, b) => a.createdAt - b.createdAt);
            });

            // E2EE decrypt preview (local, không request)
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
                    console.error("[E2EE] preview decrypt:", e2eeErr);
                }
            }

            renderChatList();
            // Không load full messages khi chưa mở chat — tránh request nặng lúc vào app
        } catch (err) {
            console.error("[ZChat] loadMessagesFromSupabase exception:", err);
        } finally {
            if (typeof hideAppLoading === "function") hideAppLoading();
        }
    })();

    try {
        await loadMessagesFromSupabase._inflight;
    } finally {
        loadMessagesFromSupabase._inflight = null;
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
    if (!loadMessagesForChat._inflight) loadMessagesForChat._inflight = Object.create(null);
    if (loadMessagesForChat._inflight[chatId]) return loadMessagesForChat._inflight[chatId];
    loadMessagesForChat._inflight[chatId] = (async () => {
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
    } finally {
        if (loadMessagesForChat._inflight) delete loadMessagesForChat._inflight[chatId];
    }
    })();
    return loadMessagesForChat._inflight[chatId];
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
