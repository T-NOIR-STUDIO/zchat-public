//! 04-safety-number-verify
//! generateSafetyNumber + verified_users helpers (pure logic).
//! DB writes still performed from JS with returned row payloads.

use crate::crypto_core::canonical_key_string;
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

/// Sort 2 public keys → SHA-256 → 60 digits in 12 groups of 5.
pub fn generate_safety_number(my_public: &str, partner_public: &str) -> String {
    let a = canonical_key_string(my_public);
    let b = canonical_key_string(partner_public);
    if a.is_empty() || b.is_empty() {
        return String::new();
    }
    let (first, second) = if a <= b { (a, b) } else { (b, a) };
    let mut hasher = Sha256::new();
    hasher.update(first.as_bytes());
    hasher.update(b"|");
    hasher.update(second.as_bytes());
    let hash = hasher.finalize();

    let mut digits = String::with_capacity(60);
    for i in 0..30 {
        let byte = hash[i];
        digits.push(char::from(b'0' + (byte % 10)));
        digits.push(char::from(b'0' + ((byte / 10) % 10)));
    }
    digits
        .chars()
        .take(60)
        .collect::<Vec<_>>()
        .chunks(5)
        .map(|c| c.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
}

#[wasm_bindgen]
pub fn generate_safety_number_js(my_public: &str, partner_public: &str) -> String {
    generate_safety_number(my_public, partner_public)
}

/// Build upsert row for verified_users table (JS performs the actual request).
#[wasm_bindgen]
pub fn build_mark_verified_row(verifier_id: &str, verified_user_id: &str) -> Result<JsValue, JsValue> {
    if verifier_id.is_empty() || verified_user_id.is_empty() {
        return Err(JsValue::from_str("verifier_id and verified_user_id required"));
    }
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &"verifier_id".into(), &verifier_id.into()).ok();
    js_sys::Reflect::set(
        &obj,
        &"verified_user_id".into(),
        &verified_user_id.into(),
    )
    .ok();
    Ok(obj.into())
}
