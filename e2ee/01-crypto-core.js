/* ============================================================
 * 01-crypto-core.js
 * Hằng số thuật toán (RSA-OAEP 2048, AES-GCM), cache khoá, helper base64/JWK, generateKeyPairJwk, import/cache key. Không phụ thuộc file nào khác — LOAD ĐẦU TIÊN.
 * ============================================================ */
/**
 * ZChat E2EE — RSA-OAEP 2048 + AES-GCM (hybrid)
 */

const global = (typeof window !== "undefined" ? window : globalThis);

const RSA_ALGO = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
};
const AES_ALGO = { name: "AES-GCM", length: 256 };
const E2EE_VERSION = 1;

let _cachedPrivJwk = null, _cachedPrivKey = null;
let _cachedPubJwk = null, _cachedPubKey = null;

function bufToB64(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}
function b64ToBuf(b64) {
    const s = atob(b64);
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
function canonicalJwkString(jwk) {
    const o = parseJwk(jwk);
    if (!o) return "";
    const keys = ["e", "kty", "n"].filter((k) => o[k] != null).sort();
    const sorted = {};
    keys.forEach((k) => { sorted[k] = o[k]; });
    return JSON.stringify(sorted);
}

async function generateKeyPairJwk() {
    const keyPair = await crypto.subtle.generateKey(RSA_ALGO, true, ["encrypt", "decrypt"]);
    return {
        publicKey: JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey)),
        privateKey: JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.privateKey)),
    };
}
async function importPublicKey(jwk) {
    const str = jwkToString(jwk);
    if (_cachedPubJwk === str && _cachedPubKey) return _cachedPubKey;
    const obj = parseJwk(jwk);
    if (!obj) throw new Error("Invalid public key JWK");
    const key = await crypto.subtle.importKey("jwk", obj, RSA_ALGO, true, ["encrypt"]);
    _cachedPubJwk = str; _cachedPubKey = key;
    return key;
}
async function importPrivateKey(jwk) {
    const str = jwkToString(jwk);
    if (_cachedPrivJwk === str && _cachedPrivKey) return _cachedPrivKey;
    const obj = parseJwk(jwk);
    if (!obj) throw new Error("Invalid private key JWK");
    const key = await crypto.subtle.importKey("jwk", obj, RSA_ALGO, true, ["decrypt"]);
    _cachedPrivJwk = str; _cachedPrivKey = key;
    return key;
}
function cacheKeysLocally(publicKey, privateKey) {
    if (publicKey) localStorage.setItem("zchat_public_key", jwkToString(publicKey));
    if (privateKey) localStorage.setItem("zchat_private_key", jwkToString(privateKey));
    _cachedPrivJwk = _cachedPrivKey = _cachedPubJwk = _cachedPubKey = null;
}
function getLocalPrivateKey() { return localStorage.getItem("zchat_private_key") || ""; }
function getLocalPublicKey() { return localStorage.getItem("zchat_public_key") || ""; }