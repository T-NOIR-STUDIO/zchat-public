/* ============================================================
 * 05-export.js
 * Gom API P-256 ECIES thành window.ZChatE2EE — LOAD SAU 01–04.
 * ============================================================ */
global.ZChatE2EE = {
    generateKeyPairJwk, ensureUserKeys, fetchPublicKeyForUsername,
    encryptMessage, encryptMessageForUsers, decryptMessage, safeDecryptContent,
    decryptMessagesBatch, generateSafetyNumber,
    markUserAsVerified, unmarkUserAsVerified, hasVerifiedUser,
    getLocalPrivateKey, getLocalPublicKey, cacheKeysLocally, looksLikeE2eePayload,
};
console.log("[E2EE] ZChatE2EE ready (P-256 ECIES + AES-256-GCM)");
