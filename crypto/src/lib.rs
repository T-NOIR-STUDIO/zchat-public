//! ZChat E2EE (Rust / WASM)
//! Modules mirror the original 5 JS files.
//! Message body cipher: XSalsa20-Poly1305 (replaces AES-256-GCM).
//! Key agreement: NIST P-256 ECDH (unchanged).

mod crypto_core;           // 01
mod key_management;        // 02
mod encrypt_decrypt;       // 03
mod safety_number_verify;  // 04
mod export;                // 05

pub use crypto_core::*;
pub use key_management::*;
pub use encrypt_decrypt::*;
pub use safety_number_verify::*;
pub use export::*;
