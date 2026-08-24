/* ============================================================
 * 02-key-management.js
 * ============================================================ */
async function ensureUserKeys(username, existingUserRow) {
    if (!username) {
        return { publicKey: getLocalPublicKey(), privateKey: getLocalPrivateKey() };
    }
    if (!global.supabaseClient) {
        return { publicKey: getLocalPublicKey(), privateKey: getLocalPrivateKey() };
    }

    let row = existingUserRow;
    if (!row || row.public_key == null || row.private_key == null) {
        const { data, error } = await global.supabaseClient
            .from("users")
            .select("username, public_key, private_key, id")
            .ilike("username", username)
            .maybeSingle();
        if (error) console.error("[E2EE] load keys from server:", error);
        if (data) row = data;
    }

    // Đủ cặp key → dùng, không đụng server
    if (row && row.public_key && row.private_key) {
        cacheKeysLocally(row.public_key, row.private_key);
        return {
            publicKey: row.public_key,
            privateKey: row.private_key,
            userId: row.id,
        };
    }

    // ĐÃ CÓ public_key → tuyệt đối không tạo/ghi đè (dù private đọc thiếu)
    if (row && row.public_key) {
        const localPriv = getLocalPrivateKey();
        if (localPriv) {
            cacheKeysLocally(row.public_key, localPriv);
            return {
                publicKey: row.public_key,
                privateKey: localPriv,
                userId: row.id,
            };
        }
        console.error(
            "[E2EE] private_key missing but public_key exists — NOT regenerating (would destroy messages)."
        );
        return {
            publicKey: row.public_key,
            privateKey: "",
            userId: row.id,
        };
    }

    // CHƯA CÓ public_key trên server → tạo key lần đầu (chỉ khi public_key IS NULL)
    const pair = await generateKeyPairJwk();
    const { error } = await global.supabaseClient
        .from("users")
        .update({ public_key: pair.publicKey, private_key: pair.privateKey })
        .ilike("username", username)
        .is("public_key", null);
    if (error) {
        console.error("[E2EE] save first-time keys:", error);
        // Có thể race: máy khác vừa ghi key — đọc lại, không overwrite
        const { data: again } = await global.supabaseClient
            .from("users")
            .select("username, public_key, private_key, id")
            .ilike("username", username)
            .maybeSingle();
        if (again && again.public_key && again.private_key) {
            cacheKeysLocally(again.public_key, again.private_key);
            return {
                publicKey: again.public_key,
                privateKey: again.private_key,
                userId: again.id,
            };
        }
    }
    cacheKeysLocally(pair.publicKey, pair.privateKey);
    return {
        publicKey: pair.publicKey,
        privateKey: pair.privateKey,
        userId: row && row.id,
    };
}

async function fetchPublicKeyForUsername(username) {
    if (!global.supabaseClient || !username) return null;
    const { data, error } = await global.supabaseClient
        .from("users").select("username, public_key, id")
        .ilike("username", username).maybeSingle();
    if (error || !data || !data.public_key) return null;
    return data;
}
