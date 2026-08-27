/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const cache_keys_locally: (a: number, b: number, c: number, d: number) => void;
export const ensure_user_keys_js: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const generate_keypair_js: () => [number, number, number];
export const get_local_keys_js: () => any;
export const get_local_private_key: () => [number, number];
export const get_local_public_key: () => [number, number];
export const e2ee_start: () => void;
export const decrypt_message_js: (a: number, b: number, c: number, d: number) => [number, number, number];
export const encrypt_message_for_users_js: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const encrypt_message_js: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const looks_like_e2ee_payload_js: (a: number, b: number) => number;
export const safe_decrypt_content_js: (a: number, b: number, c: number, d: number) => [number, number];
export const build_mark_verified_row: (a: number, b: number, c: number, d: number) => [number, number, number];
export const generate_safety_number_js: (a: number, b: number, c: number, d: number) => [number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
