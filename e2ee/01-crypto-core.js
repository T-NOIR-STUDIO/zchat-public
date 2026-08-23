/* ============================================================
 * 01-crypto-core.js
 * P-256 (ECDH) + AES-256-GCM helpers. SPKI / PKCS8 Base64 keys.
 * LOAD ĐẦU TIÊN — không phụ thuộc file khác.
 * ============================================================ */
/**
 * ZChat E2EE — NIST P-256 ECIES-style + AES-256-GCM
 * Public:  SPKI Base64  (thường bắt đầu MFkwEwYHKoZIzj0...)
 * Private: PKCS8 Base64
 */

const global = (typeof window !== "undefined" ? window : globalThis);

const ECDH_PARAMS = { name: "ECDH", namedCurve: "P-256" };
const AES_ALGO = { name: "AES-GCM", length: 256 };
const E2EE_VERSION = 2;
const E2EE_ALG = "P-256-ECIES+AES-GCM";

let _cachedPrivStr = null;
let _cachedPrivKey = null;
let _cachedPubStr = null;
let _cachedPubKey = null;

function bufToB64(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

function b64ToBuf(b64) {
    const s = atob(String(b64 || "").trim());
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
}

function jwkToString(jwk) {
    return typeof jwk === "string" ? jwk : JSON.stringify(jwk);
}

function parseJwk(jwk) {
    if (!jwk) return null;
    if (typeof jwk === "object") return jwk;
    try { return JSON.parse(jwk); } catch { return null; }
}

/** Canonical string for safety number — prefer raw SPKI Base64 */
function canonicalJwkString(keyMaterial) {
    if (!keyMaterial) return "";
    if (typeof keyMaterial === "string") {
        const t = keyMaterial.trim();
        if (!t.startsWith("{")) return t;
        try {
            const o = JSON.parse(t);
            if (o && o.x && o.y) {
                return JSON.stringify({ crv: o.crv || "P-256", kty: "EC", x: o.x, y: o.y });
            }
        } catch (_) {}
        return t;
    }
    if (typeof keyMaterial === "object") {
        const o = keyMaterial;
        if (o.x && o.y) {
            return JSON.stringify({ crv: o.crv || "P-256", kty: "EC", x: o.x, y: o.y });
        }
        return JSON.stringify(o);
    }
    return "";
}

/** Generate P-256 keypair → SPKI public + PKCS8 private (Base64) */
async function generateKeyPairJwk() {
    const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveBits", "deriveKey"]);
    const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    return {
        publicKey: bufToB64(spki),
        privateKey: bufToB64(pkcs8),
    };
}

async function importPublicKey(spkiOrJwk) {
    const str = typeof spkiOrJwk === "string" ? spkiOrJwk.trim() : jwkToString(spkiOrJwk);
    if (_cachedPubStr === str && _cachedPubKey) return _cachedPubKey;

    let key;
    if (typeof spkiOrJwk === "string" && !str.startsWith("{")) {
        key = await crypto.subtle.importKey("spki", b64ToBuf(str), ECDH_PARAMS, true, []);
    } else {
        const obj = parseJwk(spkiOrJwk);
        if (!obj) throw new Error("Invalid public key");
        key = await crypto.subtle.importKey("jwk", obj, ECDH_PARAMS, true, []);
    }
    _cachedPubStr = str;
    _cachedPubKey = key;
    return key;
}

async function importPrivateKey(pkcs8OrJwk) {
    const str = typeof pkcs8OrJwk === "string" ? pkcs8OrJwk.trim() : jwkToString(pkcs8OrJwk);
    if (_cachedPrivStr === str && _cachedPrivKey) return _cachedPrivKey;

    let key;
    if (typeof pkcs8OrJwk === "string" && !str.startsWith("{")) {
        key = await crypto.subtle.importKey(
            "pkcs8",
            b64ToBuf(str),
            ECDH_PARAMS,
            true,
            ["deriveBits", "deriveKey"]
        );
    } else {
        const obj = parseJwk(pkcs8OrJwk);
        if (!obj) throw new Error("Invalid private key");
        key = await crypto.subtle.importKey("jwk", obj, ECDH_PARAMS, true, ["deriveBits", "deriveKey"]);
    }
    _cachedPrivStr = str;
    _cachedPrivKey = key;
    return key;
}

/** ECDH shared secret → SHA-256 → AES-256 key */
async function deriveAesKeyFromShared(privateKey, publicKey) {
    const shared = await crypto.subtle.deriveBits(
        { name: "ECDH", public: publicKey },
        privateKey,
        256
    );
    const hash = await crypto.subtle.digest("SHA-256", shared);
    return crypto.subtle.importKey("raw", hash, AES_ALGO, false, ["encrypt", "decrypt"]);
}

function cacheKeysLocally(publicKey, privateKey) {
    if (publicKey) {
        localStorage.setItem(
            "zchat_public_key",
            typeof publicKey === "string" ? publicKey : jwkToString(publicKey)
        );
    }
    if (privateKey) {
        localStorage.setItem(
            "zchat_private_key",
            typeof privateKey === "string" ? privateKey : jwkToString(privateKey)
        );
    }
    _cachedPrivStr = _cachedPrivKey = _cachedPubStr = _cachedPubKey = null;
}

function getLocalPrivateKey() {
    return localStorage.getItem("zchat_private_key") || "";
}

function getLocalPublicKey() {
    return localStorage.getItem("zchat_public_key") || "";
}
