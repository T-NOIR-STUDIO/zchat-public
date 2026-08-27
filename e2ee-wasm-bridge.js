(async function () {
    "use strict";

    const PKG_URL = window.ZCHAT_E2EE_WASM_URL || new URL("crypto/pkg/zchat_crypto.js", window.location.href).href;

    let wasm = null;

    async function loadWasm() {
        if (wasm) return wasm;
        const mod = await import(PKG_URL);
        if (typeof mod.default === "function") {
            await mod.default();
        }
        wasm = mod;
        console.log("[E2EE] Rust WASM loaded");
        return wasm;
    }

    function pick(w, ...names) {
        for (const n of names) {
            if (w && typeof w[n] === "function") return w[n].bind(w);
        }
        return null;
    }

    async function ensureUserKeys(username, existingUserRow) {
        const w = await loadWasm();
        const me = (username || localStorage.getItem("zchat_username") || "").trim();
        const getPub = pick(w, "get_local_public_key", "getLocalPublicKey");
        const getPriv = pick(w, "get_local_private_key", "getLocalPrivateKey");
        const cache = pick(w, "cache_keys_locally", "cacheKeysLocally");
        const ensurePure = pick(w, "ensure_user_keys_js", "ensureUserKeysJs");

        if (!me) {
            return {
                publicKey: getPub ? getPub() : localStorage.getItem("zchat_public_key") || "",
                privateKey: getPriv ? getPriv() : localStorage.getItem("zchat_private_key") || "",
            };
        }

        let row = existingUserRow || null;
        if ((!row || row.public_key == null || row.private_key == null) && window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from("users")
                .select("username, public_key, private_key, id")
                .ilike("username", me)
                .maybeSingle();
            if (error) console.error("[E2EE] load keys:", error);
            if (data) row = data;
        }

        const existingPub = (row && row.public_key) || "";
        const existingPriv = (row && row.private_key) || "";
        const userId = (row && row.id) || "";

        let bundle = null;
        if (ensurePure) {
            bundle = ensurePure(existingPub, existingPriv, String(userId || ""));
        } else {
            if (existingPub && existingPriv) {
                if (cache) cache(existingPub, existingPriv);
                else {
                    localStorage.setItem("zchat_public_key", existingPub);
                    localStorage.setItem("zchat_private_key", existingPriv);
                }
                bundle = { public_key: existingPub, private_key: existingPriv, user_id: userId, generated: false };
            } else if (existingPub) {
                const localPriv = localStorage.getItem("zchat_private_key") || "";
                if (localPriv && cache) cache(existingPub, localPriv);
                bundle = { public_key: existingPub, private_key: localPriv, user_id: userId, generated: false };
            } else {
                const gen = pick(w, "generate_keypair_js", "generateKeypairJs");
                if (!gen) throw new Error("WASM generate_keypair missing");
                const pair = gen();
                const pk = pair.public_key || pair.publicKey;
                const sk = pair.private_key || pair.privateKey;
                if (cache) cache(pk, sk);
                else {
                    localStorage.setItem("zchat_public_key", pk);
                    localStorage.setItem("zchat_private_key", sk);
                }
                bundle = { public_key: pk, private_key: sk, user_id: userId, generated: true };
            }
        }

        if (bundle && bundle.generated && bundle.public_key && window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from("users")
                .update({ public_key: bundle.public_key, private_key: bundle.private_key })
                .ilike("username", me)
                .is("public_key", null);
            if (error) {
                console.error("[E2EE] save first-time keys:", error);
                const { data: again } = await window.supabaseClient
                    .from("users")
                    .select("username, public_key, private_key, id")
                    .ilike("username", me)
                    .maybeSingle();
                if (again && again.public_key && again.private_key) {
                    if (cache) cache(again.public_key, again.private_key);
                    return { publicKey: again.public_key, privateKey: again.private_key, userId: again.id };
                }
            }
        }

        return {
            publicKey: (bundle && bundle.public_key) || "",
            privateKey: (bundle && bundle.private_key) || "",
            userId: (bundle && bundle.user_id) || userId || null,
        };
    }

    async function fetchPublicKeyForUsername(username) {
        if (!window.supabaseClient || !username) return null;
        const { data, error } = await window.supabaseClient
            .from("users")
            .select("username, public_key, id")
            .ilike("username", username)
            .maybeSingle();
        if (error || !data || !data.public_key) return null;
        return data;
    }

    async function encryptMessage(plainText, receiverPublicKeySpki) {
        const w = await loadWasm();
        const fn = pick(w, "encrypt_message_js", "encryptMessageJs", "encrypt_message");
        if (!fn) throw new Error("WASM encrypt_message missing");
        return fn(String(plainText ?? ""), String(receiverPublicKeySpki || ""));
    }

    async function encryptMessageForUsers(plainText, publicKeysByUsername) {
        const w = await loadWasm();
        const fn = pick(w, "encrypt_message_for_users_js", "encryptMessageForUsersJs");
        if (!fn) throw new Error("WASM encrypt_message_for_users missing");
        return fn(String(plainText ?? ""), JSON.stringify(publicKeysByUsername || {}));
    }

    async function decryptMessage(encryptedBase64, myPrivateKeyPkcs8) {
        const w = await loadWasm();
        const fn = pick(w, "decrypt_message_js", "decryptMessageJs", "decrypt_message");
        if (!fn) throw new Error("WASM decrypt_message missing");
        const v = fn(String(encryptedBase64 || ""), String(myPrivateKeyPkcs8 || ""));
        return v == null ? null : String(v);
    }

    async function safeDecryptContent(content, privateKeyPkcs8) {
        const w = await loadWasm();
        const fn = pick(w, "safe_decrypt_content_js", "safeDecryptContentJs");
        if (!fn) return String(content || "");
        return fn(String(content || ""), String(privateKeyPkcs8 || ""));
    }

    async function decryptMessagesBatch(messages, privateKeyPkcs8) {
        if (!messages || !messages.length || !privateKeyPkcs8) return;
        const w = await loadWasm();
        const looks = pick(w, "looks_like_e2ee_payload_js", "looksLikeE2eePayloadJs");
        const safe = pick(w, "safe_decrypt_content_js", "safeDecryptContentJs");
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg || !msg.text) continue;
            if (looks && !looks(msg.text)) continue;
            if (safe) {
                const plain = safe(msg.text, privateKeyPkcs8);
                if (plain != null) msg.text = plain;
            }
        }
    }

    async function generateSafetyNumber(myPublic, partnerPublic) {
        const w = await loadWasm();
        const fn = pick(w, "generate_safety_number_js", "generateSafetyNumberJs");
        if (!fn) return "";
        return fn(String(myPublic || ""), String(partnerPublic || ""));
    }

    async function generateKeyPairJwk() {
        const w = await loadWasm();
        const fn = pick(w, "generate_keypair_js", "generateKeypairJs");
        if (!fn) throw new Error("WASM generate_keypair missing");
        const obj = fn();
        return {
            publicKey: obj.public_key || obj.publicKey,
            privateKey: obj.private_key || obj.privateKey,
        };
    }

    async function markUserAsVerified(targetUserId, myUsername) {
        if (!window.supabaseClient) throw new Error("Supabase client missing");
        if (!targetUserId) throw new Error("targetUserId required");
        const me = myUsername || localStorage.getItem("zchat_username") || "";
        let myId = localStorage.getItem("zchat_user_id");
        if (!myId && me) {
            const { data } = await window.supabaseClient.from("users").select("id").ilike("username", me).maybeSingle();
            if (data && data.id) {
                myId = data.id;
                localStorage.setItem("zchat_user_id", myId);
            }
        }
        if (!myId) throw new Error("Current user id missing");
        const { data, error } = await window.supabaseClient
            .from("verified_users")
            .upsert({ verifier_id: myId, verified_user_id: String(targetUserId) }, { onConflict: "verifier_id,verified_user_id" })
            .select()
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async function unmarkUserAsVerified(targetUserId, myUsername) {
        if (!window.supabaseClient) throw new Error("Supabase client missing");
        if (!targetUserId) throw new Error("targetUserId required");
        const me = myUsername || localStorage.getItem("zchat_username") || "";
        let myId = localStorage.getItem("zchat_user_id");
        if (!myId && me) {
            const { data } = await window.supabaseClient.from("users").select("id").ilike("username", me).maybeSingle();
            if (data && data.id) myId = data.id;
        }
        if (!myId) throw new Error("Current user id missing");
        const { error } = await window.supabaseClient
            .from("verified_users")
            .delete()
            .eq("verifier_id", myId)
            .eq("verified_user_id", String(targetUserId));
        if (error) throw error;
        return true;
    }

    async function hasVerifiedUser(targetUserId, myUsername) {
        if (!window.supabaseClient || !targetUserId) return false;
        try {
            const me = myUsername || localStorage.getItem("zchat_username") || "";
            let myId = localStorage.getItem("zchat_user_id");
            if (!myId && me) {
                const { data } = await window.supabaseClient.from("users").select("id").ilike("username", me).maybeSingle();
                if (data && data.id) myId = data.id;
            }
            if (!myId) return false;
            const { data, error } = await window.supabaseClient
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

    function getLocalPrivateKey() {
        return localStorage.getItem("zchat_private_key") || "";
    }
    function getLocalPublicKey() {
        return localStorage.getItem("zchat_public_key") || "";
    }
    function cacheKeysLocally(publicKey, privateKey) {
        if (publicKey) localStorage.setItem("zchat_public_key", publicKey);
        if (privateKey) localStorage.setItem("zchat_private_key", privateKey);
    }
    function looksLikeE2eePayload(str) {
        if (!str || typeof str !== "string") return false;
        if (str.startsWith("eyJ")) return true;
        if (str.startsWith("{") && (str.includes('"alg"') || str.includes("P-256") || str.includes("XSalsa20"))) return true;
        return false;
    }

    window.ZChatE2EE = {
        generateKeyPairJwk,
        ensureUserKeys,
        fetchPublicKeyForUsername,
        encryptMessage,
        encryptMessageForUsers,
        decryptMessage,
        safeDecryptContent,
        decryptMessagesBatch,
        generateSafetyNumber,
        markUserAsVerified,
        unmarkUserAsVerified,
        hasVerifiedUser,
        getLocalPrivateKey,
        getLocalPublicKey,
        cacheKeysLocally,
        looksLikeE2eePayload,
        _ready: loadWasm(),
    };

    try {
        await loadWasm();
        console.log("[E2EE] ZChatE2EE ready (Rust WASM · crypto/pkg/zchat_crypto)");
    } catch (err) {
        console.error("[E2EE] WASM load failed:", err);
    }
})();
