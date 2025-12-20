# WebZjs wasm-pack proof of concept

A minimal Rust crate compiled with `wasm-pack` that shows two browser-facing capabilities:

1. Derive a unified full viewing key from a BIP-39 mnemonic (read-only path).
2. Fetch compact blocks by delegating to the WebZjs JS client (grpc-web/WebSocket capable).

## Building

```sh
wasm-pack build --target web --release tools/webzjs-wasm-poc
```

Notes:
- The build assumes `webzjs` is available to the bundler when the generated JS glue runs. The shim defers loading until first call.
- Network access is required to download the `webzjs` NPM dependency and to contact a lightwalletd endpoint; neither step was executed in this workspace.

## Exposed bindings

- `derive_viewing_key(mnemonic: string, account: number) -> string`
  - Derives the account UFVK using `zcash_keys` with the testnet consensus parameters.
- `fetch_compact_blocks(start_height: number, count: number, endpoint?: string) -> Promise<any[]>`
  - Calls into `js/webzjs_shim.js` which in turn expects `WebZClient.connect` from `webzjs`.

## Limitations
- Proving is intentionally absent; only viewing/sync primitives are exposed.
- The shim targets testnet by default; pass a mainnet lightwalletd URL to override.
- Browser RNG is enabled through `getrandom/js`; do not run this build in Node without adjusting features.
