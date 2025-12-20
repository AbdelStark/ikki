# NEAR Intents Phase 6: Backend Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the swap backend commands to real database persistence, configure SwapKit SDK with Vite polyfills, and implement transparent address support for CrossPay.

**Architecture:**
- Add separate SQLite database for swap persistence (parallel to wallet.db)
- Configure Vite with Node.js crypto polyfills for SwapKit SDK browser compatibility
- Extend IkkiWallet with transparent address derivation from the unified spending key
- Implement real swap data persistence and retrieval

**Tech Stack:** Rust (rusqlite, zcash_client_backend), TypeScript (Vite, @swapkit/sdk), Node.js polyfills (vite-plugin-node-polyfills)

---

## Phase 6.1: Database Integration

### Task 6.1.1: Add Swap Database to AppState

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/swap/db.rs`

**Step 1: Add swap database path helper to swap/db.rs**

Add at the top of `src-tauri/src/swap/db.rs`:

```rust
use std::path::PathBuf;

/// Get the path to the swap database file
pub fn swap_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".ikki")
        .join("swaps.db")
}

/// Open or create the swap database connection
pub fn open_swap_db() -> Result<Connection, rusqlite::Error> {
    let path = swap_db_path();
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(&path)?;
    init_swap_tables(&conn)?;
    Ok(conn)
}
```

**Step 2: Add swap database to AppState**

Modify `src-tauri/src/state.rs`:

```rust
// Add import at top
use rusqlite::Connection;
use tokio::sync::Mutex as TokioMutex;

// Add to AppState struct (around line 166):
pub struct AppState {
    pub wallet: Arc<Mutex<Option<IkkiWallet>>>,
    pub sync_state: Arc<SyncState>,
    pub pending_tx_state: Arc<PendingTxState>,
    pub swap_db: Arc<TokioMutex<Option<Connection>>>,  // Add this line
}

// Update AppState::new() (around line 173):
impl AppState {
    pub fn new() -> Self {
        Self {
            wallet: Arc::new(Mutex::new(None)),
            sync_state: Arc::new(SyncState::new()),
            pending_tx_state: Arc::new(PendingTxState::new()),
            swap_db: Arc::new(TokioMutex::new(None)),  // Add this line
        }
    }
}
```

**Step 3: Initialize swap database on app start**

Modify `src-tauri/src/lib.rs` to initialize swap DB:

```rust
// Add import at top
use crate::swap::db::open_swap_db;

// In the run() function, after tauri::Builder::default():
pub fn run() {
    // ... existing logging and dotenvy code ...

    // Initialize swap database
    let swap_db = match open_swap_db() {
        Ok(conn) => Some(conn),
        Err(e) => {
            tracing::warn!("Failed to open swap database: {}", e);
            None
        }
    };

    let app_state = AppState {
        wallet: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
        sync_state: std::sync::Arc::new(state::SyncState::new()),
        pending_tx_state: std::sync::Arc::new(state::PendingTxState::new()),
        swap_db: std::sync::Arc::new(tokio::sync::Mutex::new(swap_db)),
    };

    tauri::Builder::default()
        .manage(app_state)  // Use our initialized state
        // ... rest of builder
}
```

**Step 4: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/swap/db.rs
git commit -m "feat(backend): add swap database to AppState"
```

---

### Task 6.1.2: Wire save_swap Command to Database

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`

**Step 1: Update save_swap to use database**

Replace the `save_swap` function in `src-tauri/src/commands/swap.rs`:

```rust
/// Save a swap record
#[tauri::command]
pub async fn save_swap(
    state: State<'_, AppState>,
    swap: SwapRecord,
) -> Result<(), String> {
    let db_guard = state.swap_db.lock().await;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::save_swap(conn, &swap)
        .map_err(|e| format!("Failed to save swap: {}", e))?;

    tracing::info!("Saved swap: {:?}", swap.id);
    Ok(())
}
```

**Step 2: Add db module import**

At the top of `src-tauri/src/commands/swap.rs`, ensure the import:

```rust
use crate::swap::db as swap_db;
```

**Step 3: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add src-tauri/src/commands/swap.rs
git commit -m "feat(backend): wire save_swap command to database"
```

---

### Task 6.1.3: Wire update_swap_status Command

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`

**Step 1: Update update_swap_status to use database**

Replace the `update_swap_status` function:

```rust
/// Update swap status
#[tauri::command]
pub async fn update_swap_status(
    state: State<'_, AppState>,
    swap_id: String,
    status: String,
    intent_hash: Option<String>,
    txid: Option<String>,
) -> Result<(), String> {
    let db_guard = state.swap_db.lock().await;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::update_swap_status(
        conn,
        &swap_id,
        &status,
        intent_hash.as_deref(),
        txid.as_deref(),
    )
    .map_err(|e| format!("Failed to update swap status: {}", e))?;

    tracing::info!(
        "Updated swap {} to status {} (intent: {:?}, txid: {:?})",
        swap_id, status, intent_hash, txid
    );
    Ok(())
}
```

**Step 2: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src-tauri/src/commands/swap.rs
git commit -m "feat(backend): wire update_swap_status command to database"
```

---

### Task 6.1.4: Wire get_swap_history Command

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`

**Step 1: Update get_swap_history to use database**

Replace the `get_swap_history` function:

```rust
/// Get swap history
#[tauri::command]
pub async fn get_swap_history(
    state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    let db_guard = state.swap_db.lock().await;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::get_swap_history(conn)
        .map_err(|e| format!("Failed to get swap history: {}", e))
}
```

**Step 2: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src-tauri/src/commands/swap.rs
git commit -m "feat(backend): wire get_swap_history command to database"
```

---

### Task 6.1.5: Wire get_active_swaps Command

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`

**Step 1: Update get_active_swaps to use database**

Replace the `get_active_swaps` function:

```rust
/// Get active (non-terminal) swaps
#[tauri::command]
pub async fn get_active_swaps(
    state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    let db_guard = state.swap_db.lock().await;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::get_active_swaps(conn)
        .map_err(|e| format!("Failed to get active swaps: {}", e))
}
```

**Step 2: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src-tauri/src/commands/swap.rs
git commit -m "feat(backend): wire get_active_swaps command to database"
```

---

## Phase 6.2: SwapKit SDK Browser Configuration

### Task 6.2.1: Install Vite Node Polyfills Plugin

**Files:**
- Modify: `package.json`

**Step 1: Install the polyfill plugin**

Run: `bun add -D vite-plugin-node-polyfills`

**Step 2: Verify package.json updated**

Check that `package.json` devDependencies includes:
```json
"vite-plugin-node-polyfills": "^0.22.0"
```

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat(frontend): add vite-plugin-node-polyfills dependency"
```

---

### Task 6.2.2: Configure Vite with Node Polyfills

**Files:**
- Modify: `vite.config.ts`

**Step 1: Update vite.config.ts**

Replace the entire `vite.config.ts` with:

```typescript
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    nodePolyfills({
      // Enable polyfills for crypto, buffer, stream (required by SwapKit SDK)
      include: ["crypto", "buffer", "stream", "util", "process"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Optimize SwapKit SDK dependencies
  optimizeDeps: {
    include: ["@swapkit/sdk"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build completes without crypto-related errors

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat(frontend): configure Vite with Node.js polyfills for SwapKit SDK"
```

---

### Task 6.2.3: Enable Real SwapKit SDK Import

**Files:**
- Modify: `src/lib/services/swapkit.ts`
- Modify: `.env`

**Step 1: Update swapkit.ts to enable real SDK**

In `src/lib/services/swapkit.ts`, replace the `getRealSwapKitClient` function (around line 72-87):

```typescript
// Real SwapKit implementation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swapKitClient: any = null;

async function getRealSwapKitClient() {
  if (swapKitClient) return swapKitClient;

  try {
    const { SwapKit } = await import('@swapkit/sdk');
    swapKitClient = new SwapKit({
      config: {
        thorswapApiKey: import.meta.env.VITE_THORSWAP_API_KEY || '',
      },
    });
    return swapKitClient;
  } catch (error) {
    console.error('Failed to initialize SwapKit:', error);
    throw new Error('SwapKit SDK initialization failed');
  }
}
```

**Step 2: Update .env to disable mock mode**

Update `/Users/zakimanian/ikki/.env`:

```bash
# SwapKit Mode (set to 'true' to use mock data for development)
VITE_USE_MOCK_SWAPKIT=false

# ThorSwap API Key (optional, for production use)
# VITE_THORSWAP_API_KEY=your-api-key-here
```

**Step 3: Test build with real SDK**

Run: `bun run build`
Expected: Build succeeds (may have warnings but no errors)

**Step 4: If build fails, revert to mock mode**

If the build fails due to SDK issues, update `.env`:
```bash
VITE_USE_MOCK_SWAPKIT=true
```

This allows development to continue while SDK issues are resolved.

**Step 5: Commit**

```bash
git add src/lib/services/swapkit.ts .env
git commit -m "feat(frontend): enable SwapKit SDK with Vite polyfills"
```

---

## Phase 6.3: Transparent Address Support

### Task 6.3.1: Add Transparent Address Derivation to Wallet

**Files:**
- Modify: `src-tauri/src/wallet/core.rs`

**Step 1: Add transparent address derivation method**

Add this method to the `IkkiWallet` impl block in `src-tauri/src/wallet/core.rs` (after `get_all_addresses`):

```rust
/// Derive a transparent address at a specific index for swap operations
///
/// Uses the transparent receiver derivation path:
/// m/44'/133'/account'/0/index (for testnet, use 133; mainnet would be 133)
pub fn derive_transparent_address(&self, index: u32) -> anyhow::Result<String> {
    use zcash_keys::keys::UnifiedSpendingKey;
    use zcash_primitives::legacy::keys::AccountPrivKey;
    use zcash_protocol::consensus::NetworkConstants;

    let account_id = zip32::AccountId::ZERO;

    // Derive USK from seed
    let usk = UnifiedSpendingKey::from_seed(&TEST_NETWORK, &self.seed, account_id)
        .map_err(|e| anyhow::anyhow!("Failed to derive spending key: {e:?}"))?;

    // Get the transparent component
    let transparent_key = usk.transparent();

    // Derive the external address at the given index
    let secp = secp256k1::Secp256k1::new();
    let external_key = transparent_key
        .derive_external_secret_key(index)
        .map_err(|e| anyhow::anyhow!("Failed to derive transparent key: {e:?}"))?;

    // Convert to public key and then to address
    let public_key = secp256k1::PublicKey::from_secret_key(&secp, &external_key);
    let pubkey_hash = {
        use sha2::{Sha256, Digest};
        use ripemd::Ripemd160;
        let sha = Sha256::digest(&public_key.serialize());
        Ripemd160::digest(&sha)
    };

    // Create transparent address (t-address)
    let address = zcash_primitives::legacy::TransparentAddress::PublicKeyHash(
        pubkey_hash.into()
    );

    // Encode for testnet
    Ok(address.to_zcash_address(&TEST_NETWORK).to_string())
}
```

**Step 2: Add required imports**

At the top of `src-tauri/src/wallet/core.rs`, add:

```rust
use secp256k1;
use sha2;
use ripemd;
```

**Step 3: Add dependencies to Cargo.toml**

In `src-tauri/Cargo.toml`, add to [dependencies]:

```toml
secp256k1 = { version = "0.29", features = ["std"] }
sha2 = "0.10"
ripemd = "0.1"
```

**Step 4: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/wallet/core.rs src-tauri/Cargo.toml
git commit -m "feat(backend): add transparent address derivation for swaps"
```

---

### Task 6.3.2: Wire generate_ephemeral_address Command

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`
- Modify: `src-tauri/src/swap/db.rs`

**Step 1: Add ephemeral address tracking functions to db.rs**

Add to `src-tauri/src/swap/db.rs`:

```rust
/// Get the next available derivation index for ephemeral addresses
pub fn get_next_ephemeral_index(conn: &Connection) -> Result<u32, rusqlite::Error> {
    let max_index: Option<u32> = conn.query_row(
        "SELECT MAX(derivation_index) FROM ephemeral_addresses",
        [],
        |row| row.get(0),
    ).ok().flatten();

    Ok(max_index.map(|i| i + 1).unwrap_or(0))
}

/// Save an ephemeral address
pub fn save_ephemeral_address(
    conn: &Connection,
    address: &str,
    derivation_index: u32,
    swap_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO ephemeral_addresses (address, derivation_index, swap_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![address, derivation_index, swap_id, now],
    )?;

    Ok(())
}
```

**Step 2: Update generate_ephemeral_address command**

Replace in `src-tauri/src/commands/swap.rs`:

```rust
/// Generate an ephemeral transparent address for CrossPay
#[tauri::command]
pub async fn generate_ephemeral_address(
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Get wallet for address derivation
    let wallet_guard = state.wallet.lock().await;
    let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;

    // Get database for index tracking
    let db_guard = state.swap_db.lock().await;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    // Get next available index
    let index = crate::swap::db::get_next_ephemeral_index(conn)
        .map_err(|e| format!("Failed to get ephemeral index: {}", e))?;

    // Derive transparent address
    let address = wallet.derive_transparent_address(index)
        .map_err(|e| format!("Failed to derive transparent address: {}", e))?;

    // Save address to database
    crate::swap::db::save_ephemeral_address(conn, &address, index, None)
        .map_err(|e| format!("Failed to save ephemeral address: {}", e))?;

    tracing::info!("Generated ephemeral address {} at index {}", address, index);
    Ok(address)
}
```

**Step 3: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add src-tauri/src/commands/swap.rs src-tauri/src/swap/db.rs
git commit -m "feat(backend): implement ephemeral transparent address generation"
```

---

### Task 6.3.3: Update get_swap_receiving_address for Transparent

**Files:**
- Modify: `src-tauri/src/commands/swap.rs`

**Step 1: Update get_swap_receiving_address**

Replace in `src-tauri/src/commands/swap.rs`:

```rust
/// Get a receiving address for inbound swaps
#[tauri::command]
pub async fn get_swap_receiving_address(
    state: State<'_, AppState>,
    prefer_shielded: bool,
) -> Result<SwapAddress, String> {
    let wallet_guard = state.wallet.lock().await;
    let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;

    if prefer_shielded {
        // Return shielded (unified) address
        let address = wallet.get_address().map_err(|e| e.to_string())?;
        Ok(SwapAddress {
            address,
            address_type: AddressType::Shielded,
            index: 0,
        })
    } else {
        // Get database for ephemeral address tracking
        drop(wallet_guard); // Release wallet lock before acquiring db lock

        let db_guard = state.swap_db.lock().await;
        let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

        // Get next index
        let index = crate::swap::db::get_next_ephemeral_index(conn)
            .map_err(|e| format!("Failed to get ephemeral index: {}", e))?;

        // Re-acquire wallet lock for derivation
        drop(db_guard);
        let wallet_guard = state.wallet.lock().await;
        let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;

        // Derive transparent address
        let address = wallet.derive_transparent_address(index)
            .map_err(|e| format!("Failed to derive transparent address: {}", e))?;

        // Save to database
        drop(wallet_guard);
        let db_guard = state.swap_db.lock().await;
        let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

        crate::swap::db::save_ephemeral_address(conn, &address, index, None)
            .map_err(|e| format!("Failed to save ephemeral address: {}", e))?;

        Ok(SwapAddress {
            address,
            address_type: AddressType::Transparent,
            index,
        })
    }
}
```

**Step 2: Verify compilation**

Run: `cargo check -p ikki-tauri`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src-tauri/src/commands/swap.rs
git commit -m "feat(backend): support transparent addresses in get_swap_receiving_address"
```

---

## Phase 6.4: Final Integration

### Task 6.4.1: Full Backend Build Verification

**Step 1: Clean build**

Run: `cargo clean -p ikki-tauri && cargo build -p ikki-tauri`
Expected: Build succeeds with no errors

**Step 2: Check for warnings**

Run: `cargo clippy -p ikki-tauri`
Expected: No critical warnings (minor warnings acceptable)

**Step 3: Commit any fixes**

If any fixes were needed:
```bash
git add -A
git commit -m "fix(backend): address clippy warnings"
```

---

### Task 6.4.2: Full Frontend Build Verification

**Step 1: Clean install**

Run: `rm -rf node_modules && bun install`

**Step 2: Build**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Check bundle size**

Verify the output shows reasonable bundle sizes (JS < 500KB gzipped)

**Step 4: Commit any fixes**

If any fixes were needed:
```bash
git add -A
git commit -m "fix(frontend): resolve build issues"
```

---

### Task 6.4.3: Integration Test - Swap Database

**Step 1: Start the app**

Run: `bun run tauri dev`

**Step 2: Open DevTools**

In the app window, open developer tools (Cmd+Option+I on macOS)

**Step 3: Test save_swap**

In console, run:
```javascript
await window.__TAURI__.invoke('save_swap', {
  swap: {
    id: 'test-swap-1',
    direction: 'inbound',
    status: 'awaiting_deposit',
    from_asset: 'BTC',
    from_amount: '0.01',
    to_asset: 'ZEC',
    to_amount: '10.5',
    receiving_address: 'u1test...',
    created_at: Date.now() / 1000
  }
})
```
Expected: No error

**Step 4: Test get_swap_history**

In console, run:
```javascript
await window.__TAURI__.invoke('get_swap_history')
```
Expected: Returns array containing the test swap

**Step 5: Verify database file exists**

Check: `~/.ikki/swaps.db` exists and has data

**Step 6: Document results**

If tests pass, proceed. If not, fix issues and re-test.

---

### Task 6.4.4: Final Commit and Summary

**Step 1: Review all changes**

Run: `git status && git diff --stat main`

**Step 2: Create summary commit if needed**

```bash
git add -A
git commit -m "feat: complete Phase 6 - backend integration for NEAR Intents

- Wire swap commands to SQLite database persistence
- Configure Vite with Node.js polyfills for SwapKit SDK
- Implement transparent address derivation for CrossPay
- Add ephemeral address tracking

Backend swap commands now fully functional:
- save_swap: Persists swap records
- update_swap_status: Updates swap status and txids
- get_swap_history: Retrieves all swaps
- get_active_swaps: Retrieves non-terminal swaps
- get_swap_receiving_address: Returns shielded or transparent
- generate_ephemeral_address: Creates tracked transparent addresses

🤖 Generated with Claude Code"
```

---

## Summary

**Phase 6 Tasks:**

| Task | Description | Complexity |
|------|-------------|------------|
| 6.1.1 | Add swap database to AppState | Medium |
| 6.1.2 | Wire save_swap command | Low |
| 6.1.3 | Wire update_swap_status command | Low |
| 6.1.4 | Wire get_swap_history command | Low |
| 6.1.5 | Wire get_active_swaps command | Low |
| 6.2.1 | Install Vite polyfills plugin | Low |
| 6.2.2 | Configure Vite with polyfills | Medium |
| 6.2.3 | Enable real SwapKit SDK | Medium |
| 6.3.1 | Add transparent address derivation | High |
| 6.3.2 | Wire generate_ephemeral_address | Medium |
| 6.3.3 | Update get_swap_receiving_address | Medium |
| 6.4.1 | Backend build verification | Low |
| 6.4.2 | Frontend build verification | Low |
| 6.4.3 | Integration test | Medium |
| 6.4.4 | Final commit | Low |

**Total: 15 tasks**

**Dependencies:**
- Tasks 6.1.2-6.1.5 depend on 6.1.1
- Tasks 6.2.2-6.2.3 depend on 6.2.1
- Tasks 6.3.2-6.3.3 depend on 6.3.1
- Task 6.4.x depends on all prior tasks

**Risk Areas:**
- Transparent address derivation (6.3.1) - complex crypto, may need library version adjustments
- SwapKit SDK (6.2.3) - may have runtime issues even with polyfills
- Database locking (6.1.x) - async mutex handling needs care

**Fallback:**
- If SwapKit SDK fails, keep VITE_USE_MOCK_SWAPKIT=true
- If transparent derivation fails, use shielded-only mode initially
