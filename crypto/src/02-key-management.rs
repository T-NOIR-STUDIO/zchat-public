//! 02-key-management
//! Logic mirrors JS ensureUserKeys / fetchPublicKeyForUsername.
//! Supabase I/O stays in JS — this module exposes pure helpers + wasm hooks
//! that accept already-fetched row fields so behaviour is identical.

use crate::crypto_core::{cache_keys_locally, generate_keypair, get_local_private_key, get_local_public_key};
use wasm_bindgen::prelude::*;

/// Result of ensure_user_keys when row data is provided from JS/Supabase.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct KeyBundle {
    pub public_key: String,
    pub private_key: String,
    pub user_id: Option<String>,
    /// true if a brand-new keypair was generated (only when server had no public_key)
    pub generated: bool,
}

/// Pure port of ensureUserKeys decision tree (no network).
///
/// `existing_public` / `existing_private` / `user_id` come from Supabase `users` row
/// (pass empty string when null/missing).
pub fn ensure_user_keys_pure(
    existing_public: &str,
    existing_private: &str,
    user_id: &str,
) -> Result<KeyBundle, String> {
    let pub_k = existing_public.trim();
    let priv_k = existing_private.trim();
    let uid = if user_id.is_empty() {
        None
    } else {
        Some(user_id.to_string())
    };

    // Đủ cặp key → dùng, không đụng server
    if !pub_k.is_empty() && !priv_k.is_empty() {
        cache_keys_locally(pub_k, priv_k);
        return Ok(KeyBundle {
            public_key: pub_k.to_string(),
            private_key: priv_k.to_string(),
            user_id: uid,
            generated: false,
        });
    }

    // ĐÃ CÓ public_key → tuyệt đối không tạo/ghi đè
    if !pub_k.is_empty() {
        let local_priv = get_local_private_key();
        if !local_priv.is_empty() {
            cache_keys_locally(pub_k, &local_priv);
            return Ok(KeyBundle {
                public_key: pub_k.to_string(),
                private_key: local_priv,
                user_id: uid,
                generated: false,
            });
        }
        // private missing — do NOT regenerate
        return Ok(KeyBundle {
            public_key: pub_k.to_string(),
            private_key: String::new(),
            user_id: uid,
            generated: false,
        });
    }

    // CHƯA CÓ public_key → tạo lần đầu
    let (pk, sk) = generate_keypair()?;
    cache_keys_locally(&pk, &sk);
    Ok(KeyBundle {
        public_key: pk,
        private_key: sk,
        user_id: uid,
        generated: true,
    })
}

#[wasm_bindgen]
pub fn ensure_user_keys_js(
    existing_public: &str,
    existing_private: &str,
    user_id: &str,
) -> Result<JsValue, JsValue> {
    let b = ensure_user_keys_pure(existing_public, existing_private, user_id)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen_compat(&b)
}

fn serde_wasm_bindgen_compat<T: serde::Serialize>(v: &T) -> Result<JsValue, JsValue> {
    let s = serde_json::to_string(v).map_err(|e| JsValue::from_str(&e.to_string()))?;
    js_sys::JSON::parse(&s).map_err(|e| e)
}

#[wasm_bindgen]
pub fn get_local_keys_js() -> JsValue {
    let obj = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &obj,
        &"public_key".into(),
        &get_local_public_key().into(),
    );
    let _ = js_sys::Reflect::set(
        &obj,
        &"private_key".into(),
        &get_local_private_key().into(),
    );
    obj.into()
}
