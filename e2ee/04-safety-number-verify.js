/* ============================================================
 * 04-safety-number-verify.js
 * generateSafetyNumber (mã an toàn chống MITM) + markUserAsVerified/unmarkUserAsVerified/hasVerifiedUser (bảng verified_users). Phụ thuộc: 01.
 * ============================================================ */
async function generateSafetyNumber(myPublicKeyJwk, partnerPublicKeyJwk) {
    try {
        const a = canonicalJwkString(myPublicKeyJwk);
        const b = canonicalJwkString(partnerPublicKeyJwk);
        if (!a || !b) return "";
        const [first, second] = [a, b].sort();
        const hashBuf = await crypto.subtle.digest(
            "SHA-256", new TextEncoder().encode(first + "|" + second)
        );
        const bytes = new Uint8Array(hashBuf);
        let digits = "";
        for (let i = 0; i < 15; i++) {
            digits += String(bytes[i] % 10);
            digits += String(Math.floor(bytes[i] / 10) % 10);
        }
        return (digits.slice(0, 60).match(/.{1,5}/g) || []).join(" ");
    } catch (err) {
        console.error("[E2EE] generateSafetyNumber:", err);
        return "";
    }
}

/** Lấy UUID + username của user hiện tại (verifier) */
async function _resolveMyUser(myUsername) {
    const me = myUsername || localStorage.getItem("zchat_username") || "";
    const cachedId = localStorage.getItem("zchat_user_id");
    if (cachedId && me) return { me, myId: cachedId };
    if (!global.supabaseClient || !me) return { me, myId: null };
    const { data, error } = await global.supabaseClient
        .from("users").select("id, username")
        .ilike("username", me).maybeSingle();
    if (error) throw error;
    if (!data || !data.id) throw new Error("Current user not found");
    localStorage.setItem("zchat_user_id", data.id);
    return { me: data.username || me, myId: data.id };
}

/** Lấy username từ UUID (partner được verify) */
async function _resolveUsernameById(userId) {
    if (!global.supabaseClient || !userId) return null;
    const { data } = await global.supabaseClient
        .from("users").select("username")
        .eq("id", userId).maybeSingle();
    return data && data.username ? data.username : null;
}

/**
 * Bảng verified_users:
 *   verifier_id, verified_user_id, created_at
 */
async function markUserAsVerified(targetUserId, myUsername, partnerUsername) {
    if (!global.supabaseClient) throw new Error("Supabase client missing");
    if (!targetUserId) throw new Error("targetUserId required");
    const { myId } = await _resolveMyUser(myUsername);
    if (!myId) throw new Error("Current user id missing");
    const row = {
        verifier_id: myId,
        verified_user_id: String(targetUserId),
    };
    const { data, error } = await global.supabaseClient
        .from("verified_users")
        .upsert(row, { onConflict: "verifier_id,verified_user_id" })
        .select()
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Xóa dòng verify (Mark as unverified) */
async function unmarkUserAsVerified(targetUserId, myUsername) {
    if (!global.supabaseClient) throw new Error("Supabase client missing");
    if (!targetUserId) throw new Error("targetUserId required");
    const { myId } = await _resolveMyUser(myUsername);
    if (!myId) throw new Error("Current user id missing");
    const { error } = await global.supabaseClient
        .from("verified_users")
        .delete()
        .eq("verifier_id", myId)
        .eq("verified_user_id", String(targetUserId));
    if (error) throw error;
    return true;
}

async function hasVerifiedUser(targetUserId, myUsername) {
    if (!global.supabaseClient || !targetUserId) return false;
    try {
        const { myId } = await _resolveMyUser(myUsername);
        if (!myId) return false;
        const { data, error } = await global.supabaseClient
            .from("verified_users")
            .select("verifier_id")
            .eq("verifier_id", myId)
            .eq("verified_user_id", String(targetUserId))
            .maybeSingle();
        if (error) return false;
        return !!data;
    } catch {
        return false;
    }
}