//! 03-encrypt-decrypt
//! P-256 ECIES + XSalsa20-Poly1305 (body cipher changed from AES-256-GCM).
//! Payload v2 Base64(JSON): { v, alg, n (nonce), c, e?, keys? }

use crate::crypto_core::*;
use aead::{Aead, KeyInit};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use xsalsa20poly1305::{XSalsa20Poly1305, XNonce};

#[derive(Debug, Serialize, Deserialize)]
struct Payload {
    v: u32,
    alg: String,
    /// XSalsa20 nonce (24 bytes) base64
    n: String,
    /// ciphertext + tag base64
    c: String,
    /// single-recipient ephemeral SPKI
    #[serde(skip_serializing_if = "Option::is_none")]
    e: Option<String>,
    /// multi-recipient wrapped keys
    #[serde(skip_serializing_if = "Option::is_none")]
    keys: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WrappedKey {
    e: String,
    w: String,
    wn: String, // wrap nonce 24B
}

pub fn looks_like_e2ee_payload(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    if s.starts_with("eyJ") {
        return true;
    }
    if s.starts_with('{') && (s.contains("\"alg\"") || s.contains("P-256") || s.contains("XSalsa20"))
    {
        return true;
    }
    false
}

fn xsalsa_encrypt(key: &[u8; KEY_LEN], plain: &[u8]) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XSalsa20Poly1305::new(key.into());
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand_core::RngCore::fill_bytes(&mut OsRng, &mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plain)
        .map_err(|_| "xsalsa encrypt failed".to_string())?;
    Ok((ct, nonce_bytes))
}

fn xsalsa_decrypt(key: &[u8; KEY_LEN], nonce: &[u8], ct: &[u8]) -> Result<Vec<u8>, String> {
    if nonce.len() != NONCE_LEN {
        return Err("bad nonce len".into());
    }
    let cipher = XSalsa20Poly1305::new(key.into());
    let n = XNonce::from_slice(nonce);
    cipher
        .decrypt(n, ct)
        .map_err(|_| "xsalsa decrypt failed".to_string())
}

fn encode_payload(p: &Payload) -> Result<String, String> {
    let json = serde_json::to_vec(p).map_err(|e| e.to_string())?;
    Ok(buf_to_b64(&json))
}

fn decode_payload(encrypted: &str) -> Result<Payload, String> {
    if let Ok(raw) = b64_to_buf(encrypted) {
        if let Ok(p) = serde_json::from_slice::<Payload>(&raw) {
            return Ok(p);
        }
    }
    serde_json::from_str(encrypted).map_err(|e| e.to_string())
}

/// Single-recipient: ephemeral P-256 → ECDH → XSalsa20-Poly1305
pub fn encrypt_message(plain_text: &str, receiver_public_spki: &str) -> Result<String, String> {
    let recipient = import_public_key_spki(receiver_public_spki)?;
    let eph = generate_ephemeral();
    let eph_spki = ephemeral_public_spki_b64(&eph)?;
    let key = ecdh_ephemeral_to_key(eph, &recipient);
    let (ct, nonce) = xsalsa_encrypt(&key, plain_text.as_bytes())?;

    encode_payload(&Payload {
        v: E2EE_VERSION,
        alg: E2EE_ALG.to_string(),
        n: buf_to_b64(&nonce),
        c: buf_to_b64(&ct),
        e: Some(eph_spki),
        keys: None,
    })
}

/// Multi-recipient hybrid: one XSalsa20 body; each user gets ECDH-wrapped 32B key.
pub fn encrypt_message_for_users(
    plain_text: &str,
    public_keys_by_username: &serde_json::Map<String, serde_json::Value>,
) -> Result<String, String> {
    // random content key
    let mut content_key = [0u8; KEY_LEN];
    rand_core::RngCore::fill_bytes(&mut OsRng, &mut content_key);
    let (ct, nonce) = xsalsa_encrypt(&content_key, plain_text.as_bytes())?;

    let mut keys = serde_json::Map::new();
    for (name, val) in public_keys_by_username {
        let spki = match val.as_str() {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let recipient = import_public_key_spki(spki)?;
        let eph = generate_ephemeral();
        let eph_spki = ephemeral_public_spki_b64(&eph)?;
        let wrap_key = ecdh_ephemeral_to_key(eph, &recipient);
        let (wrapped, wrap_nonce) = xsalsa_encrypt(&wrap_key, &content_key)?;
        keys.insert(
            name.to_lowercase(),
            serde_json::json!({
                "e": eph_spki,
                "w": buf_to_b64(&wrapped),
                "wn": buf_to_b64(&wrap_nonce),
            }),
        );
    }
    if keys.is_empty() {
        return Err("No public keys provided".into());
    }

    encode_payload(&Payload {
        v: E2EE_VERSION,
        alg: E2EE_ALG.to_string(),
        n: buf_to_b64(&nonce),
        c: buf_to_b64(&ct),
        e: None,
        keys: Some(keys),
    })
}

pub fn decrypt_message(encrypted_b64: &str, my_private_pkcs8: &str) -> Result<Option<String>, String> {
    if encrypted_b64.is_empty() || my_private_pkcs8.is_empty() {
        return Ok(None);
    }
    if !looks_like_e2ee_payload(encrypted_b64) {
        return Ok(None);
    }
    let payload = match decode_payload(encrypted_b64) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    if payload.c.is_empty() || payload.n.is_empty() {
        return Ok(None);
    }
    // skip legacy RSA
    if payload.alg.contains("RSA") || payload.v == 1 {
        return Ok(None);
    }

    let priv_key = import_private_key_pkcs8(my_private_pkcs8)?;
    let ct = b64_to_buf(&payload.c)?;
    let nonce = b64_to_buf(&payload.n)?;

    // single-recipient
    if let Some(ref eph_spki) = payload.e {
        if payload.keys.is_none() {
            let eph_pub = import_public_key_spki(eph_spki)?;
            let key = derive_xsalsa_key(&priv_key, &eph_pub);
            let plain = xsalsa_decrypt(&key, &nonce, &ct)?;
            return Ok(Some(String::from_utf8_lossy(&plain).into_owned()));
        }
    }

    // multi-recipient
    if let Some(ref keys) = payload.keys {
        // username from localStorage
        let me_name = {
            // read zchat_username
            let global = js_sys::global();
            let storage = js_sys::Reflect::get(&global, &"localStorage".into()).ok();
            storage
                .and_then(|s| {
                    let f = js_sys::Reflect::get(&s, &"getItem".into()).ok()?;
                    let func = js_sys::Function::from(f);
                    func.call1(&s, &"zchat_username".into())
                        .ok()
                        .and_then(|v| v.as_string())
                })
                .unwrap_or_default()
                .to_lowercase()
        };
        let entry = keys
            .get(&me_name)
            .cloned()
            .or_else(|| keys.values().find(|v| v.get("e").is_some() && v.get("w").is_some()).cloned());
        let Some(entry) = entry else {
            return Ok(None);
        };
        let e = entry.get("e").and_then(|v| v.as_str()).ok_or("missing e")?;
        let w = entry.get("w").and_then(|v| v.as_str()).ok_or("missing w")?;
        // accept both "wn" (new) and "wi" (legacy AES wrap iv name)
        let wn = entry
            .get("wn")
            .or_else(|| entry.get("wi"))
            .and_then(|v| v.as_str())
            .ok_or("missing wrap nonce")?;
        let eph_pub = import_public_key_spki(e)?;
        let wrap_key = derive_xsalsa_key(&priv_key, &eph_pub);
        let wrapped = b64_to_buf(w)?;
        let wrap_nonce = b64_to_buf(wn)?;
        let content_key_bytes = xsalsa_decrypt(&wrap_key, &wrap_nonce, &wrapped)?;
        if content_key_bytes.len() != KEY_LEN {
            return Err("bad content key".into());
        }
        let mut content_key = [0u8; KEY_LEN];
        content_key.copy_from_slice(&content_key_bytes);
        let plain = xsalsa_decrypt(&content_key, &nonce, &ct)?;
        return Ok(Some(String::from_utf8_lossy(&plain).into_owned()));
    }

    Ok(None)
}

pub fn safe_decrypt_content(content: &str, private_key_pkcs8: &str) -> String {
    if content.is_empty() {
        return String::new();
    }
    if private_key_pkcs8.is_empty() || !looks_like_e2ee_payload(content) {
        return content.to_string();
    }
    match decrypt_message(content, private_key_pkcs8) {
        Ok(Some(p)) => p,
        _ => content.to_string(),
    }
}

#[wasm_bindgen]
pub fn encrypt_message_js(plain_text: &str, receiver_public_spki: &str) -> Result<String, JsValue> {
    encrypt_message(plain_text, receiver_public_spki).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn encrypt_message_for_users_js(
    plain_text: &str,
    public_keys_json: &str,
) -> Result<String, JsValue> {
    let map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(public_keys_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    encrypt_message_for_users(plain_text, &map).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn decrypt_message_js(encrypted_b64: &str, my_private_pkcs8: &str) -> Result<JsValue, JsValue> {
    match decrypt_message(encrypted_b64, my_private_pkcs8) {
        Ok(Some(s)) => Ok(JsValue::from_str(&s)),
        Ok(None) => Ok(JsValue::NULL),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn safe_decrypt_content_js(content: &str, private_key_pkcs8: &str) -> String {
    safe_decrypt_content(content, private_key_pkcs8)
}

#[wasm_bindgen]
pub fn looks_like_e2ee_payload_js(s: &str) -> bool {
    looks_like_e2ee_payload(s)
}
