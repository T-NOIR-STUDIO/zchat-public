/* ============================================================
 * 03-encrypt-decrypt.js
 * Mã hoá/giải mã tin nhắn: encryptMessage, encryptMessageForUsers, decryptMessage, safeDecryptContent, decryptMessagesBatch, looksLikeE2eePayload. Phụ thuộc: 01.
 * ============================================================ */
function looksLikeE2eePayload(str) {
    if (!str || typeof str !== "string") return false;
    return str.startsWith("eyJ") || (str.startsWith("{") && str.includes('"alg"'));
}

async function encryptMessage(plainText, receiverPublicKeyJwk) {
    if (plainText == null) plainText = "";
    if (!receiverPublicKeyJwk) throw new Error("Missing receiver public key");
    const pubKey = await importPublicKey(receiverPublicKeyJwk);
    const aesKey = await crypto.subtle.generateKey(AES_ALGO, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(String(plainText))
    );
    const rawAes = await crypto.subtle.exportKey("raw", aesKey);
    const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, rawAes);
    return bufToB64(new TextEncoder().encode(JSON.stringify({
        v: E2EE_VERSION, alg: "RSA-OAEP+AES-GCM",
        iv: bufToB64(iv), c: bufToB64(cipherBuf), k: bufToB64(wrapped),
    })));
}

async function encryptMessageForUsers(plainText, publicKeysByUsername) {
    if (plainText == null) plainText = "";
    const entries = Object.entries(publicKeysByUsername || {}).filter(([, jwk]) => !!jwk);
    if (!entries.length) throw new Error("No public keys provided");
    const aesKey = await crypto.subtle.generateKey(AES_ALGO, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(String(plainText))
    );
    const rawAes = await crypto.subtle.exportKey("raw", aesKey);
    const keys = {};
    await Promise.all(entries.map(async ([name, jwk]) => {
        const pubKey = await importPublicKey(jwk);
        const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, rawAes);
        keys[name.toLowerCase()] = bufToB64(wrapped);
    }));
    return bufToB64(new TextEncoder().encode(JSON.stringify({
        v: E2EE_VERSION, alg: "RSA-OAEP+AES-GCM",
        iv: bufToB64(iv), c: bufToB64(cipherBuf), keys,
    })));
}

async function decryptMessage(encryptedBase64, myPrivateKeyJwk) {
    if (!encryptedBase64 || !myPrivateKeyJwk) return null;
    try {
        if (!looksLikeE2eePayload(encryptedBase64)) return null;
        const payload = JSON.parse(new TextDecoder().decode(b64ToBuf(encryptedBase64)));
        if (!payload || !payload.c || !payload.iv) return null;
        const privKey = await importPrivateKey(myPrivateKeyJwk);
        let wrappedB64 = payload.k || null;
        if (!wrappedB64 && payload.keys) {
            const me = (localStorage.getItem("zchat_username") || "").toLowerCase();
            wrappedB64 = payload.keys[me] || Object.values(payload.keys).find(Boolean) || null;
        }
        if (!wrappedB64) return null;
        const rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, b64ToBuf(wrappedB64));
        const aesKey = await crypto.subtle.importKey("raw", rawAes, AES_ALGO, false, ["decrypt"]);
        const plainBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(payload.iv)) },
            aesKey, b64ToBuf(payload.c)
        );
        return new TextDecoder().decode(plainBuf);
    } catch (err) {
        console.warn("[E2EE] decrypt failed:", err && err.message);
        return null;
    }
}

async function safeDecryptContent(content, privateKeyJwk) {
    if (!content) return "";
    if (!privateKeyJwk || !looksLikeE2eePayload(content)) return content;
    try {
        const plain = await decryptMessage(content, privateKeyJwk);
        return plain != null ? plain : content;
    } catch { return content; }
}

async function decryptMessagesBatch(messages, privateKeyJwk) {
    if (!messages || !messages.length || !privateKeyJwk) return;
    try { await importPrivateKey(privateKeyJwk); } catch { return; }
    const tasks = messages.map(async (msg) => {
        if (!msg || !msg.text || !looksLikeE2eePayload(msg.text)) return;
        const plain = await safeDecryptContent(msg.text, privateKeyJwk);
        if (plain != null) msg.text = plain;
    });
    for (let i = 0; i < tasks.length; i += 32) {
        await Promise.all(tasks.slice(i, i + 32));
    }
}