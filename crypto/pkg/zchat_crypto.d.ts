/* tslint:disable */
/* eslint-disable */

/**
 * Build upsert row for verified_users table (JS performs the actual request).
 */
export function build_mark_verified_row(verifier_id: string, verified_user_id: string): any;

export function cache_keys_locally(public_key: string, private_key: string): void;

export function decrypt_message_js(encrypted_b64: string, my_private_pkcs8: string): any;

export function e2ee_start(): void;

export function encrypt_message_for_users_js(plain_text: string, public_keys_json: string): string;

export function encrypt_message_js(plain_text: string, receiver_public_spki: string): string;

export function ensure_user_keys_js(existing_public: string, existing_private: string, user_id: string): any;

export function generate_keypair_js(): any;

export function generate_safety_number_js(my_public: string, partner_public: string): string;

export function get_local_keys_js(): any;

export function get_local_private_key(): string;

export function get_local_public_key(): string;

export function looks_like_e2ee_payload_js(s: string): boolean;

export function safe_decrypt_content_js(content: string, private_key_pkcs8: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly cache_keys_locally: (a: number, b: number, c: number, d: number) => void;
    readonly ensure_user_keys_js: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly generate_keypair_js: () => [number, number, number];
    readonly get_local_keys_js: () => any;
    readonly get_local_private_key: () => [number, number];
    readonly get_local_public_key: () => [number, number];
    readonly e2ee_start: () => void;
    readonly decrypt_message_js: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly encrypt_message_for_users_js: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly encrypt_message_js: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly looks_like_e2ee_payload_js: (a: number, b: number) => number;
    readonly safe_decrypt_content_js: (a: number, b: number, c: number, d: number) => [number, number];
    readonly build_mark_verified_row: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly generate_safety_number_js: (a: number, b: number, c: number, d: number) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
