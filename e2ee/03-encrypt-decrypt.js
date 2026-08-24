/* ============================================================
 * 03-encrypt-decrypt.js
 * P-256 ECIES + AES-256-GCM encrypt/decrypt. Phụ thuộc: 01.
 * Payload v2: Base64(JSON) { v, alg, iv, c, e?, keys? }
 * ============================================================ */
function looksLikeE2eePayload(str) {
    if (!str || typeof str !== "string") return false;
    if (str.startsWith("eyJ")) return true;
    if (str.startsWith("{") && (str.includes('"alg"') || str.includes("P-256"))) return true;
    return false;
}

/**
 * Single-recipient ECIES:
 * ephemeral P-256 → ECDH → SHA-256 → AES-GCM
 * payload.e = ephemeral SPKI Base64
 */
async function encryptMessage(plainText, receiverPublicKeySpki) {
    if (plainText == null) plainText = "";
    if (!receiverPublicKeySpki) throw new Error("Missing receiver public key");

    const recipientPub = await importPublicKey(receiverPublicKeySpki);
    const eph = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveBits", "deriveKey"]);
    const aesKey = await deriveAesKeyFromShared(eph.privateKey, recipientPub);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        new TextEncoder().encode(String(plainText))
    );
    const ephSpki = bufToB64(await crypto.subtle.exportKey("spki", eph.publicKey));

    return bufToB64(
        new TextEncoder().encode(
            JSON.stringify({
                v: E2EE_VERSION,
                alg: E2EE_ALG,
                e: ephSpki,
                iv: bufToB64(iv),
                c: bufToB64(cipherBuf),
            })
        )
    );
}

/**
 * Multi-recipient hybrid (1-1: me + partner):
 * One AES-GCM body; each recipient gets ephemeral ECDH-wrapped AES key.
 * keys[username] = { e: ephSpkiB64, w: wrappedKeyB64, wi: wrapIvB64 }
 */
async function encryptMessageForUsers(plainText, publicKeysByUsername) {
    if (plainText == null) plainText = "";
    const entries = Object.entries(publicKeysByUsername || {}).filter(([, k]) => !!k);
    if (!entries.length) throw new Error("No public keys provided");

    const aesKey = await crypto.subtle.generateKey(AES_ALGO, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        new TextEncoder().encode(String(plainText))
    );
    const rawAes = new Uint8Array(await crypto.subtle.exportKey("raw", aesKey));

    const keys = {};
    await Promise.all(
        entries.map(async ([name, spki]) => {
            const recipientPub = await importPublicKey(spki);
            const eph = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveBits", "deriveKey"]);
            const wrapKey = await deriveAesKeyFromShared(eph.privateKey, recipientPub);
            const wrapIv = crypto.getRandomValues(new Uint8Array(12));
            const wrapped = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: wrapIv },
                wrapKey,
                rawAes
            );
            keys[String(name).toLowerCase()] = {
                e: bufToB64(await crypto.subtle.exportKey("spki", eph.publicKey)),
                w: bufToB64(wrapped),
                wi: bufToB64(wrapIv),
            };
        })
    );

    return bufToB64(
        new TextEncoder().encode(
            JSON.stringify({
                v: E2EE_VERSION,
                alg: E2EE_ALG,
                iv: bufToB64(iv),
                c: bufToB64(cipherBuf),
                keys,
            })
        )
    );
}

async function decryptMessage(encryptedBase64, myPrivateKeyPkcs8) {
    if (!encryptedBase64 || !myPrivateKeyPkcs8) return null;
    try {
        if (!looksLikeE2eePayload(encryptedBase64)) return null;

        let payload;
        try {
            payload = JSON.parse(new TextDecoder().decode(b64ToBuf(encryptedBase64)));
        } catch {
            try { payload = JSON.parse(encryptedBase64); } catch { return null; }
        }
        if (!payload || !payload.c || !payload.iv) return null;

        if (payload.alg === "RSA-OAEP+AES-GCM" || payload.v === 1) {
            console.warn("[E2EE] legacy RSA payload — skip");
            return null;
        }

        const privKey = await importPrivateKey(myPrivateKeyPkcs8);

        if (payload.e && !payload.keys) {
            const ephPub = await importPublicKey(payload.e);
            const aesKey = await deriveAesKeyFromShared(privKey, ephPub);
            const plainBuf = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(payload.iv)) },
                aesKey,
                b64ToBuf(payload.c)
            );
            return new TextDecoder().decode(plainBuf);
        }

        if (payload.keys) {
            const me = (localStorage.getItem("zchat_username") || "").toLowerCase();
            const entry =
                payload.keys[me] ||
                Object.values(payload.keys).find((k) => k && k.e && k.w);
            if (!entry) return null;
            const ephPub = await importPublicKey(entry.e);
            const wrapKey = await deriveAesKeyFromShared(privKey, ephPub);
            const rawAes = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(entry.wi)) },
                wrapKey,
                b64ToBuf(entry.w)
            );
            const aesKey = await crypto.subtle.importKey("raw", rawAes, AES_ALGO, false, ["decrypt"]);
            const plainBuf = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(payload.iv)) },
                aesKey,
                b64ToBuf(payload.c)
            );
            return new TextDecoder().decode(plainBuf);
        }

        return null;
    } catch (err) {
        console.warn("[E2EE] decrypt failed:", err && err.message);
        return null;
    }
}

async function safeDecryptContent(content, privateKeyPkcs8) {
    if (!content) return "";
    if (!privateKeyPkcs8 || !looksLikeE2eePayload(content)) return content;
    try {
        const plain = await decryptMessage(content, privateKeyPkcs8);
        return plain != null ? plain : content;
    } catch {
        return content;
    }
}

async function decryptMessagesBatch(messages, privateKeyPkcs8) {
    if (!messages || !messages.length || !privateKeyPkcs8) return;
    try { await importPrivateKey(privateKeyPkcs8); } catch { return; }
    const tasks = messages.map(async (msg) => {
        if (!msg || !msg.text || !looksLikeE2eePayload(msg.text)) return;
        const plain = await safeDecryptContent(msg.text, privateKeyPkcs8);
        if (plain != null) msg.text = plain;
    });
    for (let i = 0; i < tasks.length; i += 32) {
        await Promise.all(tasks.slice(i, i + 32));
    }
}
