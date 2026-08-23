/* ============================================================
 * 05-export.js
 * Gom toàn bộ hàm ở 4 file trên thành window.ZChatE2EE — PHẢI LOAD SAU CÙNG (sau 01-04).
 * ============================================================ */
global.ZChatE2EE = {
    generateKeyPairJwk, ensureUserKeys, fetchPublicKeyForUsername,
    encryptMessage, encryptMessageForUsers, decryptMessage, safeDecryptContent,
    decryptMessagesBatch, generateSafetyNumber,
    markUserAsVerified, unmarkUserAsVerified, hasVerifiedUser,
    getLocalPrivateKey, getLocalPublicKey, cacheKeysLocally, looksLikeE2eePayload,
};
console.log("[E2EE] ZChatE2EE ready");