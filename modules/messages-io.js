/* ============================================================
 * 19-messages-io.js
 * Giao tiếp Supabase cho tin nhắn: load lịch sử, gửi tin (bao gồm E2EE encrypt/decrypt). Phụ thuộc: 02-04, 09, 12.
 * ============================================================ */
/* ============ SUPABASE MESSAGES ============ */

function hideAppLoading() {
    try {
        const el = document.getElementById("appLoading");
        if (!el) return;
        el.classList.add("is-done");
        el.setAttribute("aria-hidden", "true");
        setTimeout(() => { try { el.remove(); } catch (_) {} }, 400);
    } catch (_) {}
}

let _loadListInflight = null;
const _loadChatInflight = Object.create(null);
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
        hideAppLoading();
        return;
    }
    if (_loadListInflight) return _loadListInflight;

    _loadListInflight = (async () => {
        try {
            const me = currentUsername || localStorage.getItem("zchat_username") || "";
            const meLower = me.toLowerCase();
            if (!meLower) {
                hideAppLoading();
                return;
            }

            const PREVIEW_PER_CHAT = 5;
            const myId = await getMyUserId();
            const mySavedChatId = myId ? ("saved_" + myId) : ("saved_" + meLower);
            ensureSavedMessagesChat();
            if (myId) {
                try { await ensureSavedMessagesConversation(myId); } catch (_) {}
            }

            // 1) Lấy conversations của mình (Request 1)
            let convRows = [];
            if (myId) {
                try {
                    const { data: convs, error: convErr } = await window.supabaseClient
                        .from("conversations")
                        .select("id, user_1, user_2")
                        .or(`user_1.eq.${myId},user_2.eq.${myId}`);
                    if (convErr) console.warn("[ZChat] conversations:", convErr.message || convErr);
                    else convRows = convs || [];
                } catch (e) {
                    console.warn("[ZChat] load conversations:", e);
                }
            }
            const convIds = convRows.map((c) => c.id).filter(Boolean);

            // Thu thập các partner ID
            const otherIds = [];
            const convOtherId = Object.create(null);
            for (const c of convRows) {
                if (!c || !c.id || !myId) continue;
                const otherId = String(c.user_1) === String(myId) ? c.user_2 : c.user_1;
                if (otherId) {
                    convOtherId[c.id] = otherId;
                    otherIds.push(otherId);
                }
            }
            const uniqueOtherIds = [...new Set(otherIds.filter(Boolean))];
            const chatIdsToPreview = [...new Set([mySavedChatId, ...convIds])];
            const limit = Math.min(Math.max(chatIdsToPreview.length * PREVIEW_PER_CHAT, PREVIEW_PER_CHAT), 150);

            // ⚡ FAST PATH: Bắn SONG SONG Query Users (Avatar + Public Key) và Query Messages ⚡
            const [usersRes, messagesRes] = await Promise.all([
                // Request 2: Gom chung Avatar + public_key làm 1 query duy nhất
                uniqueOtherIds.length ? window.supabaseClient
                    .from("users")
                    .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url, is_verified, public_key")
                    .in("id", uniqueOtherIds) : Promise.resolve({ data: [] }),

                // Request 3: Lấy tin nhắn preview cùng lúc
                chatIdsToPreview.length ? window.supabaseClient
                    .from("messages")
                    .select("id, chat_id, sender_id, content, created_at, read_at")
                    .in("chat_id", chatIdsToPreview)
                    .order("created_at", { ascending: false })
                    .limit(limit) : Promise.resolve({ data: [] })
            ]);

            // Map dữ liệu Users, Avatars và Cache Public Key
            const byId = Object.create(null);
            (usersRes.data || []).forEach((u) => {
                if (u && u.id) {
                    byId[u.id] = u;
                    if (u.username) {
                        userIdToName[u.id] = u.username;
                        // Cache public_key ngay tại đây để E2EE không bắn thêm request lẻ
                        if (u.public_key && window.ZChatE2EE?.cachePublicKey) {
                            window.ZChatE2EE.cachePublicKey(u.username, u.public_key);
                        }
                    }
                }
            });

            for (const c of convRows) {
                if (!c || !c.id) continue;
                const oid = convOtherId[c.id];
                const u = oid ? byId[oid] : null;
                if (u && u.username) conversationOtherName[c.id] = u.username;
            }

            // Gán slots chat
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
                    const u = otherId ? byId[otherId] : null;
                    if (u) applyAvatarFields(chat.participant, u);
                    state.chats.push(chat);
                } else {
                    if (partnerName && (chat.participant.name === "Chat User" || !chat.participant.name)) {
                        chat.participant.name = partnerName;
                    }
                    if (otherId) chat.participant.userId = otherId;
                    const u = otherId ? byId[otherId] : null;
                    if (u) applyAvatarFields(chat.participant, u);
                }
            }

            // Xử lý dữ liệu tin nhắn preview
            const allPreviewRows = messagesRes.data || [];

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

            state.chats.forEach((chat) => {
                if (String(chat.id).startsWith("saved_")) {
                    chat.participant.name = (currentUsername || localStorage.getItem("zchat_username") || "Me").trim();
                    chat.participant.isSelfNotes = true;
                    return;
                }
                if (chat.participant.name && chat.participant.name !== "Chat User") return;
                if (conversationOtherName[chat.id]) {
                    chat.participant.name = conversationOtherName[chat.id];
                }
            });

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
        } catch (err) {
            console.error("[ZChat] loadMessagesFromSupabase exception:", err);
        } finally {
            hideAppLoading();
        }
    })();

    try {
        await _loadListInflight;
    } finally {
        _loadListInflight = null;
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
    if (_loadChatInflight[chatId]) return _loadChatInflight[chatId];
    _loadChatInflight[chatId] = (async () => {
    try {
        const me = currentUsername || localStorage.getItem("zchat_username") || "";
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
        delete _loadChatInflight[chatId];
    }
    })();
    return _loadChatInflight[chatId];
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
        realChatId = chatId;
    } else {
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
