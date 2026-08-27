//! 05-export — public wasm surface mirroring ZChatE2EE JS object.

use wasm_bindgen::prelude::*;

pub use crate::crypto_core::{
    cache_keys_locally, generate_keypair_js, get_local_private_key, get_local_public_key,
};
pub use crate::encrypt_decrypt::{
    decrypt_message_js, encrypt_message_for_users_js, encrypt_message_js, looks_like_e2ee_payload_js,
    safe_decrypt_content_js,
};
pub use crate::key_management::{ensure_user_keys_js, get_local_keys_js};
pub use crate::safety_number_verify::{build_mark_verified_row, generate_safety_number_js};

/// Startup log (called from JS after wasm init).
#[wasm_bindgen(start)]
pub fn e2ee_start() {
    // console.log equivalent
    let _ = js_sys::Reflect::get(&js_sys::global(), &"console".into()).and_then(|c| {
        let log = js_sys::Reflect::get(&c, &"log".into())?;
        let f = js_sys::Function::from(log);
        f.call1(
            &c,
            &JsValue::from_str("[E2EE] ZChatE2EE ready (P-256 ECIES + XSalsa20-Poly1305) [rust/wasm]"),
        )
    });
}
