//! 01-crypto-core — P-256 ECDH core + helpers.
//! Symmetric body cipher key is 32 bytes for XSalsa20-Poly1305.

use p256::{ecdh::EphemeralSecret, PublicKey, SecretKey};
use pkcs8::{DecodePrivateKey, DecodePublicKey, EncodePrivateKey, EncodePublicKey};
use rand_core::OsRng;
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

pub const E2EE_VERSION: u32 = 2;
pub const E2EE_ALG: &str = "P-256-ECIES+XSalsa20-Poly1305";
pub const NONCE_LEN: usize = 24;
pub const KEY_LEN: usize = 32;

#[inline]
pub fn buf_to_b64(bytes: &[u8]) -> String {
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
}

#[inline]
pub fn b64_to_buf(b64: &str) -> Result<Vec<u8>, String> {
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64.trim())
        .map_err(|e| e.to_string())
}

pub fn canonical_key_string(key_material: &str) -> String {
    let t = key_material.trim();
    if t.is_empty() {
        return String::new();
    }
    if !t.starts_with('{') {
        return t.to_string();
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(t) {
        if let (Some(x), Some(y)) = (
            v.get("x").and_then(|x| x.as_str()),
            v.get("y").and_then(|y| y.as_str()),
        ) {
            return serde_json::json!({ "crv": "P-256", "kty": "EC", "x": x, "y": y }).to_string();
        }
    }
    t.to_string()
}

pub fn generate_keypair() -> Result<(String /*pub*/, String /*priv*/), String> {
    let secret = SecretKey::random(&mut OsRng);
    let public = secret.public_key();
    let pkcs8_der = secret
        .to_pkcs8_der()
        .map_err(|e| e.to_string())?
        .as_bytes()
        .to_vec();
    let spki_der = public
        .to_public_key_der()
        .map_err(|e| e.to_string())?
        .to_vec();
    Ok((buf_to_b64(&spki_der), buf_to_b64(&pkcs8_der)))
}

pub fn import_public_key_spki(spki_b64: &str) -> Result<PublicKey, String> {
    let der = b64_to_buf(spki_b64)?;
    PublicKey::from_public_key_der(&der).map_err(|e| e.to_string())
}

pub fn import_private_key_pkcs8(pkcs8_b64: &str) -> Result<SecretKey, String> {
    let der = b64_to_buf(pkcs8_b64)?;
    SecretKey::from_pkcs8_der(&der).map_err(|e| e.to_string())
}

pub fn derive_xsalsa_key(private: &SecretKey, peer_public: &PublicKey) -> [u8; KEY_LEN] {
    let shared =
        p256::ecdh::diffie_hellman(private.to_nonzero_scalar(), peer_public.as_affine());
    let hash = Sha256::digest(shared.raw_secret_bytes());
    let mut out = [0u8; KEY_LEN];
    out.copy_from_slice(&hash);
    out
}

pub fn generate_ephemeral() -> EphemeralSecret {
    EphemeralSecret::random(&mut OsRng)
}

pub fn ephemeral_public_spki_b64(eph: &EphemeralSecret) -> Result<String, String> {
    let pubk = eph.public_key();
    let der = pubk
        .to_public_key_der()
        .map_err(|e| e.to_string())?
        .to_vec();
    Ok(buf_to_b64(&der))
}

pub fn ecdh_ephemeral_to_key(eph: EphemeralSecret, peer: &PublicKey) -> [u8; KEY_LEN] {
    let shared = eph.diffie_hellman(peer);
    let hash = Sha256::digest(shared.raw_secret_bytes());
    let mut out = [0u8; KEY_LEN];
    out.copy_from_slice(&hash);
    out
}

fn ls_get(key: &str) -> String {
    let global = js_sys::global();
    let storage = js_sys::Reflect::get(&global, &JsValue::from_str("localStorage")).ok();
    let Some(storage) = storage else {
        return String::new();
    };
    if storage.is_undefined() || storage.is_null() {
        return String::new();
    }
    let get_item = js_sys::Reflect::get(&storage, &JsValue::from_str("getItem")).ok();
    let Some(get_item) = get_item else {
        return String::new();
    };
    let func = js_sys::Function::from(get_item);
    match func.call1(&storage, &JsValue::from_str(key)) {
        Ok(v) if v.is_string() => v.as_string().unwrap_or_default(),
        _ => String::new(),
    }
}

fn ls_set(key: &str, val: &str) {
    let global = js_sys::global();
    let Ok(storage) = js_sys::Reflect::get(&global, &JsValue::from_str("localStorage")) else {
        return;
    };
    if storage.is_undefined() || storage.is_null() {
        return;
    }
    let Ok(set_item) = js_sys::Reflect::get(&storage, &JsValue::from_str("setItem")) else {
        return;
    };
    let func = js_sys::Function::from(set_item);
    let _ = func.call2(
        &storage,
        &JsValue::from_str(key),
        &JsValue::from_str(val),
    );
}

#[wasm_bindgen]
pub fn cache_keys_locally(public_key: &str, private_key: &str) {
    if !public_key.is_empty() {
        ls_set("zchat_public_key", public_key);
    }
    if !private_key.is_empty() {
        ls_set("zchat_private_key", private_key);
    }
}

#[wasm_bindgen]
pub fn get_local_private_key() -> String {
    ls_get("zchat_private_key")
}

#[wasm_bindgen]
pub fn get_local_public_key() -> String {
    ls_get("zchat_public_key")
}

#[wasm_bindgen]
pub fn generate_keypair_js() -> Result<JsValue, JsValue> {
    let (pk, sk) = generate_keypair().map_err(|e| JsValue::from_str(&e))?;
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &"public_key".into(), &pk.into()).ok();
    js_sys::Reflect::set(&obj, &"private_key".into(), &sk.into()).ok();
    Ok(obj.into())
}
