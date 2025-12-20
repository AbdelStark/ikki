# Browser WASM approach for Ikki

## Current Zcash Rust crates (native backend)
The Tauri backend at `src-tauri/src/wallet/core.rs` and `src-tauri/Cargo.toml` pulls the following Zcash crates:

| Crate | Purpose today | WASM-oriented option | Notes / required flags |
| --- | --- | --- | --- |
| `zcash_client_backend` (features: `lightwalletd-tonic-transport`, `transparent-inputs`, `orchard`) | Wallet sync, proposal, broadcast over gRPC | Prefer **WebZjs** (prebuilt WASM backend) to get gRPC-Web/WebSocket transport and IndexedDB persistence. Custom fallback: compile `zcash_client_backend` with `default-features = false`, `wasm-bindgen` helpers, and supply JS-side gRPC/WebSocket transport. | Disable `lightwalletd-tonic-transport`; use `getrandom/js`; keep `orchard` + `transparent-inputs` as needed. |
| `zcash_client_sqlite` (features: `transparent-inputs`, `unstable`, `orchard`) | On-disk wallet database | WebZjs bundles an IndexedDB-backed store; a bespoke build would need `sql.js`/IndexedDB adapter exposed via `wasm-bindgen`. | SQLite is not WASM-safe; avoid directly compiling this crate. |
| `zcash_client_memory` | In-memory block cache used during sync | Remains usable in WASM; WebZjs already wraps similar cache internally. | No extra flags required. |
| `zcash_protocol` | Consensus params, memo handling, value types | Reuse directly; ensure `getrandom/js` when deriving keys. | Works in WASM with std and JS RNG. |
| `zcash_address` | Address parsing/encoding | Reuse directly in WASM. | No special flags. |
| `zcash_keys` | ZIP32 key derivation (USK/UFVK/UA) | Reuse directly; WebZjs exposes equivalent JS APIs for viewing keys. | Enable `orchard`, `sapling`, `transparent-inputs`; add `getrandom/js`. |
| `zcash_proofs` (`bundled-prover`) | Local Orchard/Sapling proving | Avoid in-browser; WebZjs omits proving and relies on lightwalletd for verification. If needed, compile without `bundled-prover` and gate proving behind feature flags. | Browser lacks threads/SGX; heavy proving is impractical. |
| `zcash_transparent`, `zcash_primitives`, `zip32` | Supporting primitives for addresses/keys | Reuse directly; WebZjs embeds the same primitives. | No extra flags beyond JS RNG. |

## Minimal wasm-pack proof (no UI)
A prototype crate lives in `tools/webzjs-wasm-poc`:

- Exposes `derive_viewing_key(mnemonic, account)` via `wasm-bindgen`, using `bip0039`, `zcash_keys`, and `zcash_protocol` to return a unified full viewing key string.
- Exposes `fetch_compact_blocks(start_height, count)` that delegates to a small JS shim (`js/webzjs_shim.js`). The shim is structured to call WebZjs (or another JS lightwalletd bridge) and returns compact block JSON to Rust as `JsValue`.
- Build command: `wasm-pack build tools/webzjs-wasm-poc --target web --release`. (Network access to fetch `webzjs` NPM package is required when running the JS shim; not executed in CI here.)

### Blockers and constraints
- **gRPC/WebSockets:** Browsers cannot initiate raw gRPC used in `src-tauri`; WebZjs supplies a gRPC-Web/WebSocket shim. A custom path would need `grpc-web` or `tonic-web` JS bindings callable from Rust via `wasm-bindgen`.
- **Threads and proofs:** `zcash_proofs`’ bundled prover depends on native threads; disable proving for browser builds and rely on lightwalletd validation. Feature-gate proving behind `native-prover` vs `browser-lite` flags.
- **Storage:** `zcash_client_sqlite` is native-only. WebZjs uses IndexedDB; a custom build would need a `sql.js`/IndexedDB adapter exposed through JS glue for note commitment trees and transactions.
- **RNG/entropy:** Enable `getrandom/js` to source randomness from the browser when deriving keys.

## Recommendation
- Use **WebZjs** for the browser target to avoid rebuilding gRPC-Web, storage, and threading primitives. Keep the API surface minimal (derive viewing keys, sync, read-only balance/history) until a remote proving story is finalized.
- When compiling shared Rust code for both Tauri and WASM, gate features:
  - `native-desktop`: enables tonic transport, SQLite, and bundled prover.
  - `browser-lite`: disables tonic, SQLite, and prover; enables `getrandom/js`, routes sync through the WebZjs JS shim, and stores data in IndexedDB.
- Plan for performance ceilings: syncing is single-threaded in WASM; expect slower block scanning and memory pressure versus the native path. Prioritize fast rescan paths (birthday scanning) and compact block pagination when using WebZjs.
