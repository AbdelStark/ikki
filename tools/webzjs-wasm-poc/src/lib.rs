use bip0039::{English, Mnemonic};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use zcash_keys::keys::UnifiedSpendingKey;
use zip32::AccountId;

#[wasm_bindgen(module = "/js/webzjs_shim.js")]
extern "C" {
    #[wasm_bindgen(catch, js_name = fetchCompactBlocks)]
    async fn js_fetch_compact_blocks(start_height: u32, count: u32) -> Result<JsValue, JsValue>;
}

/// Derive a unified full viewing key (UFVK) from a BIP-39 mnemonic.
#[wasm_bindgen]
pub fn derive_viewing_key(mnemonic: &str, account: u32) -> Result<String, JsValue> {
    let phrase = Mnemonic::<English>::from_phrase(mnemonic)
        .map_err(|e| JsValue::from_str(&format!("Invalid mnemonic: {e}")))?;

    let seed = phrase.to_seed("");
    let account_id = AccountId::try_from(account)
        .map_err(|_| JsValue::from_str("Account index out of range"))?;

    let usk = UnifiedSpendingKey::from_seed(
        &zcash_protocol::consensus::TestNetwork,
        &seed,
        account_id,
    )
    .map_err(|e| JsValue::from_str(&format!("Unable to derive spending key: {e}")))?;

    let ufvk = usk.to_unified_full_viewing_key();
    Ok(ufvk.to_string())
}

/// Fetch compact blocks via the WebZjs shim. Returns a JS array of block JSON objects.
#[wasm_bindgen]
pub fn fetch_compact_blocks(start_height: u32, count: u32) -> js_sys::Promise {
    future_to_promise(async move {
        let blocks = js_fetch_compact_blocks(start_height, count).await?;
        Ok(blocks)
    })
}
