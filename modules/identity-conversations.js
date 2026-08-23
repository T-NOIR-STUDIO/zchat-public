/* ============================================================
 * 03-identity-conversations.js
 * Định danh user (UUID), bảng conversations, avatar sync, state chính (state, currentUsername). Phụ thuộc: 02-utils.js
 * ============================================================ */
/* ============ ĐỒNG BỘ AVATAR NGƯỜI CHAT CÙNG (Supabase "users") ============ */
function applyAvatarFields(participant, row) {
    if (!participant || !row) return;
    participant.avatarType = row.avatar_type || "initials";
    participant.avatarColor = row.avatar_color || null;
    participant.avatarEmoji = row.avatar_emoji || null;
    participant.avatarUrl = row.avatar_url || null;
    participant.isVerified = !!row.is_verified;
    if (row.username && !participant.isSelfNotes) {
        participant.name = row.username;
    }
}

async function fetchAvatarForUsername(username) {
    if (!window.supabaseClient || !username) return null;
    try {
        const { data, error } = await window.supabaseClient
            .from("users")
            .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url, is_verified")
            .ilike("username", username)
            .maybeSingle();
        if (error) {
            console.error("[ZChat] fetchAvatarForUsername error:", error);
            return null;
        }
        return data || null;
    } catch (err) {
        console.error("[ZChat] fetchAvatarForUsername exception:", err);
        return null;
    }
}

/* ============ CONVERSATIONS 1-1 (bảng public.conversations: user_1, user_2) ============ */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return typeof v === "string" && UUID_RE.test(v);
}

/** Cache user id của mình + map conversationId → otherUsername */
let myUserIdCache = localStorage.getItem("zchat_user_id") || null;
const conversationOtherName = Object.create(null); // { [convId]: username }
const userIdToName = Object.create(null); // { [uuid]: username }

function myIdNow() {
    return myUserIdCache || localStorage.getItem("zchat_user_id") || "";
}

/** Tin của mình chỉ theo sender_id (uuid) */
function isRowFromMe(row, myId) {
    if (!row || !myId || !row.sender_id) return false;
    return String(row.sender_id) === String(myId);
}

function senderIdFromRow(row, myId) {
    return isRowFromMe(row, myId) ? "me" : (row.sender_id || "other");
}

async function resolveUsernameByUserId(userId) {
    if (!userId) return null;
    if (userIdToName[userId]) return userIdToName[userId];
    if (!window.supabaseClient) return null;
    try {
        const { data, error } = await window.supabaseClient
            .from("users")
            .select("id, username")
            .eq("id", userId)
            .maybeSingle();
        if (error || !data) return null;
        if (data.username) userIdToName[data.id] = data.username;
        return data.username || null;
    } catch (err) {
        console.error("[ZChat] resolveUsernameByUserId:", err);
        return null;
    }
}

async function resolveUserIdByUsername(username) {
    if (!window.supabaseClient || !username) return null;
    try {
        const { data, error } = await window.supabaseClient
            .from("users")
            .select("id, username")
            .ilike("username", username)
            .maybeSingle();
        if (error || !data || !data.id) return null;
        return data.id;
    } catch (err) {
        console.error("[ZChat] resolveUserIdByUsername:", err);
        return null;
    }
}

async function getMyUserId() {
    if (myUserIdCache) return myUserIdCache;
    const me = (currentUsername || localStorage.getItem("zchat_username") || "").trim();
    if (!me) return null;
    const id = await resolveUserIdByUsername(me);
    if (id) {
        myUserIdCache = id;
        localStorage.setItem("zchat_user_id", id);
    }
    return id;
}

/**
 * Tạo / lấy id phòng chat 1-1 từ 2 user UUID.
 * Ưu tiên RPC get_or_create_conversation; fallback insert/select bảng conversations.
 */
async function getOrCreateConversationId(myUserId, otherUserId) {
    if (!window.supabaseClient || !myUserId || !otherUserId) return null;
    if (myUserId === otherUserId) return null;

    // Thử RPC (nếu đã tạo function trên Supabase)
    try {
        const { data: rpcId, error: rpcErr } = await window.supabaseClient.rpc(
            "get_or_create_conversation",
            { p_user_a: myUserId, p_user_b: otherUserId }
        );
        if (!rpcErr && rpcId) return rpcId;
        if (rpcErr) console.warn("[ZChat] RPC get_or_create_conversation:", rpcErr.message || rpcErr);
    } catch (_) { /* fallback */ }

    // Fallback client: chuẩn hóa user_1 < user_2 (so text UUID)
    const u1 = myUserId < otherUserId ? myUserId : otherUserId;
    const u2 = myUserId < otherUserId ? otherUserId : myUserId;

    try {
        const { data: existing, error: selErr } = await window.supabaseClient
            .from("conversations")
            .select("id")
            .eq("user_1", u1)
            .eq("user_2", u2)
            .maybeSingle();
        if (!selErr && existing && existing.id) return existing.id;

        const { data: created, error: insErr } = await window.supabaseClient
            .from("conversations")
            .insert([{ user_1: u1, user_2: u2 }])
            .select("id")
            .maybeSingle();
        if (!insErr && created && created.id) return created.id;

        // Race: insert trùng → select lại
        if (insErr) {
            const { data: again } = await window.supabaseClient
                .from("conversations")
                .select("id")
                .eq("user_1", u1)
                .eq("user_2", u2)
                .maybeSingle();
            if (again && again.id) return again.id;
            console.error("[ZChat] create conversation failed:", insErr);
        }
    } catch (err) {
        console.error("[ZChat] getOrCreateConversationId exception:", err);
    }
    return null;
}

/** Resolve username đối phương từ conversation uuid (user_1 / user_2) */
async function resolveOtherNameFromConversationId(convId, meId) {
    if (!window.supabaseClient || !convId) return null;
    if (conversationOtherName[convId]) return conversationOtherName[convId];
    try {
        const { data: conv, error } = await window.supabaseClient
            .from("conversations")
            .select("user_1, user_2")
            .eq("id", convId)
            .maybeSingle();
        if (error || !conv) return null;
        const otherId = conv.user_1 === meId ? conv.user_2 : conv.user_1;
        if (!otherId) return null;
        const { data: user } = await window.supabaseClient
            .from("users")
            .select("username")
            .eq("id", otherId)
            .maybeSingle();
        if (user && user.username) {
            conversationOtherName[convId] = user.username;
            return user.username;
        }
    } catch (err) {
        console.error("[ZChat] resolveOtherNameFromConversationId:", err);
    }
    return null;
}

/* Lấy avatar cho tất cả participant hiện có trong state.chats.
   Dùng ilike (không phân biệt hoa/thường) từng tên một để tránh lệch case
   giữa tên hiển thị trong chat và username thật lưu trong bảng users. */
async function refreshAllParticipantAvatars() {
    if (!window.supabaseClient) return;
    const names = [...new Set(
        state.chats
            .map((c) => c.participant && c.participant.name)
            .filter((n) => n && n !== "Saved Messages" && !(state.chats.find((c) => c.participant && c.participant.name === n && c.participant.isSelfNotes)))
    )];
    if (!names.length) return;

    try {
        const rows = await Promise.all(names.map((n) => fetchAvatarForUsername(n)));

        let changed = false;
        state.chats.forEach((c) => {
            if (!c.participant) return;
            const idx = names.findIndex((n) => n.toLowerCase() === c.participant.name.toLowerCase());
            const row = idx > -1 ? rows[idx] : null;
            if (row) {
                applyAvatarFields(c.participant, row);
                changed = true;
            }
        });

        if (changed) {
            renderChatList();
            const activeChat = state.chats.find((c) => c.id === state.activeChatId);
            if (activeChat) renderActiveChat();
        }
    } catch (err) {
        console.error("[ZChat] refreshAllParticipantAvatars exception:", err);
    }
}

/* Nghe realtime khi user khác đổi avatar -> cập nhật ngay không cần reload */
function subscribeToUserAvatarChanges() {
    if (!window.supabaseClient) return;

    window.supabaseClient
        .channel("zchat-users-avatar-realtime")
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "users" },
            (payload) => {
                try {
                    const row = payload.new;
                    if (!row || !row.username) return;

                    const chat = state.chats.find(
                        (c) => c.participant && c.participant.name && c.participant.name.toLowerCase() === row.username.toLowerCase()
                    );
                    if (!chat) return;

                    applyAvatarFields(chat.participant, row);
                    renderChatList();
                    if (state.activeChatId === chat.id) renderActiveChat();
                } catch (err) {
                    console.error("[ZChat] Avatar realtime handler error:", err);
                }
            }
        )
        .subscribe();
}

let currentUsername = localStorage.getItem("zchat_username") || "";

const state = {
    chats: [],
    activeChatId: null,
    searchQuery: "",
};

function isSelfNotesChatId(chatId) {
    return typeof chatId === "string" && chatId.startsWith("saved_");
}
function isSelfNotesChat(chat) {
    return !!(chat && (isSelfNotesChatId(chat.id) || (chat.participant && chat.participant.isSelfNotes)));
}

/** Chat ghi chú = tên mình + avatar mình (không còn nhãn Saved Messages) */
function ensureSavedMessagesChat() {
    const displayName = (currentUsername || localStorage.getItem("zchat_username") || "Me").trim();
    const uid = myUserIdCache || localStorage.getItem("zchat_user_id") || "";
    const savedChatId = uid ? ("saved_" + uid) : ("saved_" + displayName.toLowerCase());

    // Migrate label cũ
    state.chats.forEach((c) => {
        if (!c || !c.participant) return;
        if (c.participant.name === "Saved Messages" || isSelfNotesChatId(c.id)) {
            c.participant.name = displayName;
            c.participant.isSelfNotes = true;
        }
    });

    let savedChat = state.chats.find((c) => c.id === savedChatId) ||
        state.chats.find((c) => isSelfNotesChat(c));
    if (!savedChat) {
        savedChat = {
            id: savedChatId,
            participant: {
                id: uid ? ("u_" + uid) : ("u_" + displayName.toLowerCase()),
                name: displayName,
                online: true,
                lastSeen: null,
                userId: uid || null,
                isSelfNotes: true,
            },
            unread: 0,
            disappearingTime: "off",
            blockScreenshots: false,
            messages: [],
        };
        state.chats.unshift(savedChat);
    } else {
        savedChat.id = savedChatId;
        savedChat.participant.name = displayName;
        savedChat.participant.isSelfNotes = true;
        if (uid) savedChat.participant.userId = uid;
    }
    const p = savedChat.participant;
    p.avatarType = localStorage.getItem("zchat_avatar_type") || p.avatarType || "initials";
    p.avatarColor = localStorage.getItem("zchat_avatar_color") || p.avatarColor || null;
    p.avatarEmoji = localStorage.getItem("zchat_avatar_emoji") || p.avatarEmoji || null;
    p.avatarUrl = localStorage.getItem("zchat_avatar_url") || p.avatarUrl || null;

    // Tick xanh trên chat tự nhắn: lấy is_verified từ server (không đổi tên)
    if (displayName && typeof fetchAvatarForUsername === "function") {
        fetchAvatarForUsername(displayName).then((row) => {
            if (!row || !savedChat || !savedChat.participant) return;
            applyAvatarFields(savedChat.participant, row);
            savedChat.participant.isSelfNotes = true;
            savedChat.participant.name = displayName;
            if (typeof renderChatList === "function") renderChatList();
            if (state.activeChatId === savedChat.id && typeof renderActiveChat === "function") {
                renderActiveChat();
            }
        }).catch(() => {});
    }

    if (!state.activeChatId) state.activeChatId = savedChatId;
    return savedChatId;
}

async function ensureSavedMessagesConversation(userId) {
    if (!window.supabaseClient || !userId) return null;
    const convId = "saved_" + userId;
    try {
        const { data: existing } = await window.supabaseClient
            .from("conversations").select("id").eq("id", convId).maybeSingle();
        if (existing && existing.id) return convId;
        const { error } = await window.supabaseClient.from("conversations").upsert({
            id: convId, user_1: userId, user_2: userId,
            created_at: new Date().toISOString(),
        }, { onConflict: "id" });
        if (error) console.error("[ZChat] ensureSavedMessagesConversation:", error);
        return convId;
    } catch (e) {
        console.error("[ZChat] ensureSavedMessagesConversation:", e);
        return null;
    }
}
