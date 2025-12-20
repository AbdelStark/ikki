// Thin JS shim that lets the Rust WASM call into WebZjs (or any compatible lightwalletd bridge).
// The shim defers loading the dependency until first use to keep wasm-pack builds lightweight.
let webzModule;

async function loadWebZjs() {
  if (!webzModule) {
    // Expect the `webzjs` npm package to be resolvable by the bundler.
    webzModule = import('webzjs');
  }
  return webzModule;
}

/**
 * Fetch compact blocks from lightwalletd.
 * @param {number} startHeight - First block height to request (inclusive).
 * @param {number} count - Number of blocks to fetch.
 * @param {string} [endpoint] - Optional lightwalletd endpoint (wss:// or https:// for grpc-web).
 * @returns {Promise<any[]>}
 */
export async function fetchCompactBlocks(startHeight, count, endpoint = 'https://testnet.lightwalletd.com:9067') {
  const mod = await loadWebZjs();
  const WebZClient = mod.WebZClient || (mod.default && mod.default.WebZClient);
  if (!WebZClient || typeof WebZClient.connect !== 'function') {
    throw new Error('WebZjs WebZClient.connect was not found; ensure the `webzjs` package is installed');
  }

  const client = await WebZClient.connect(endpoint);
  const result = await client.getCompactBlocks(startHeight, count);
  return Array.isArray(result) ? result : (result?.blocks ?? []);
}
