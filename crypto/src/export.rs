//! 05-export — public wasm surface mirroring ZChatE2EE JS object.

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn e2ee_start() {
    let _ = js_sys::Reflect::get(&js_sys::global(), &"console".into()).and_then(|c| {
        let log = js_sys::Reflect::get(&c, &"log".into())?;
        let f = js_sys::Function::from(log);
        f.call1(
            &c,
            &JsValue::from_str("[E2EE] ZChatE2EE ready (P-256 ECIES + XSalsa20-Poly1305) [rust/wasm]"),
        )
    });
}