# NEAR Intents Integration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to swap external assets (BTC, SOL, USDC, etc.) into shielded ZEC and spend shielded ZEC to pay recipients on other chains via NEAR Intents.

**Architecture:** SwapKit SDK in frontend for quote fetching and intent publishing. Rust backend handles Zcash address generation, transaction building, and swap persistence. New Swap tab + CrossPay integration in Send flow.

**Tech Stack:** SwapKit SDK (TypeScript), Svelte 5 stores, Tauri 2 IPC commands, Rust + zcash_client_backend, SQLite for swap persistence.

---

## Phase 1: Foundation

### Task 1.1: Add SwapKit SDK Dependency

**Files:**
- Modify: `/Users/zakimanian/ikki/package.json`

**Step 1: Add SwapKit SDK to dependencies**

```bash
cd /Users/zakimanian/ikki && bun add @swapkit/sdk
```

**Step 2: Verify installation**

```bash
bun run build
```

Expected: Build succeeds with SwapKit installed.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add SwapKit SDK dependency"
```

---

### Task 1.2: Create Swap Module Structure (Backend)

**Files:**
- Create: `/Users/zakimanian/ikki/src-tauri/src/swap/mod.rs`
- Create: `/Users/zakimanian/ikki/src-tauri/src/swap/models.rs`
- Create: `/Users/zakimanian/ikki/src-tauri/src/swap/db.rs`
- Create: `/Users/zakimanian/ikki/src-tauri/src/swap/address.rs`
- Modify: `/Users/zakimanian/ikki/src-tauri/src/lib.rs`

**Step 1: Create swap/mod.rs**

```rust
//! Swap module for NEAR Intents integration

pub mod address;
pub mod db;
pub mod models;

pub use models::*;
```

**Step 2: Create swap/models.rs**

```rust
//! Data models for swap operations

use serde::{Deserialize, Serialize};

/// Direction of swap
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SwapDirection {
    /// External asset → ZEC
    Inbound,
    /// ZEC → External asset (CrossPay)
    CrossPay,
}

/// Swap record for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRecord {
    pub id: String,
    pub direction: SwapDirection,
    pub status: String,
    pub from_asset: String,
    pub from_amount: String,
    pub to_asset: String,
    pub to_amount: String,
    pub receiving_address: Option<String>,
    pub ephemeral_address: Option<String>,
    pub refund_address: Option<String>,
    pub recipient_address: Option<String>,
    pub quote_hash: Option<String>,
    pub intent_hash: Option<String>,
    pub zcash_txid: Option<String>,
    pub fulfillment_txid: Option<String>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub completed_at: Option<i64>,
}

/// Address type for swap receiving
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AddressType {
    Shielded,
    Transparent,
}

/// Swap address response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapAddress {
    pub address: String,
    pub address_type: AddressType,
    pub index: u32,
}

/// Prepared transaction for CrossPay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreparedTransaction {
    pub id: String,
    pub from_address: String,
    pub to_address: String,
    pub amount_zatoshi: u64,
    pub fee_zatoshi: u64,
    pub expires_at: i64,
}
```

**Step 3: Create swap/db.rs (skeleton)**

```rust
//! Database operations for swaps

use super::models::{SwapDirection, SwapRecord};
use rusqlite::Connection;

/// Initialize swap tables
pub fn init_swap_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS swaps (
            id TEXT PRIMARY KEY,
            direction TEXT NOT NULL,
            status TEXT NOT NULL,
            from_asset TEXT NOT NULL,
            from_amount TEXT NOT NULL,
            to_asset TEXT NOT NULL,
            to_amount TEXT NOT NULL,
            receiving_address TEXT,
            ephemeral_address TEXT,
            refund_address TEXT,
            recipient_address TEXT,
            quote_hash TEXT,
            intent_hash TEXT,
            zcash_txid TEXT,
            fulfillment_txid TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            completed_at INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ephemeral_addresses (
            address TEXT PRIMARY KEY,
            derivation_index INTEGER NOT NULL,
            swap_id TEXT,
            created_at INTEGER NOT NULL,
            used_at INTEGER
        )",
        [],
    )?;

    Ok(())
}

/// Save a swap record
pub fn save_swap(conn: &Connection, swap: &SwapRecord) -> Result<(), rusqlite::Error> {
    let direction = match swap.direction {
        SwapDirection::Inbound => "inbound",
        SwapDirection::CrossPay => "crosspay",
    };

    conn.execute(
        "INSERT OR REPLACE INTO swaps (
            id, direction, status, from_asset, from_amount, to_asset, to_amount,
            receiving_address, ephemeral_address, refund_address, recipient_address,
            quote_hash, intent_hash, zcash_txid, fulfillment_txid,
            created_at, expires_at, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        rusqlite::params![
            swap.id,
            direction,
            swap.status,
            swap.from_asset,
            swap.from_amount,
            swap.to_asset,
            swap.to_amount,
            swap.receiving_address,
            swap.ephemeral_address,
            swap.refund_address,
            swap.recipient_address,
            swap.quote_hash,
            swap.intent_hash,
            swap.zcash_txid,
            swap.fulfillment_txid,
            swap.created_at,
            swap.expires_at,
            swap.completed_at,
        ],
    )?;

    Ok(())
}

/// Update swap status
pub fn update_swap_status(
    conn: &Connection,
    swap_id: &str,
    status: &str,
    intent_hash: Option<&str>,
    txid: Option<&str>,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE swaps SET status = ?2, intent_hash = COALESCE(?3, intent_hash),
         zcash_txid = COALESCE(?4, zcash_txid) WHERE id = ?1",
        rusqlite::params![swap_id, status, intent_hash, txid],
    )?;
    Ok(())
}

/// Get all swaps
pub fn get_swap_history(conn: &Connection) -> Result<Vec<SwapRecord>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, direction, status, from_asset, from_amount, to_asset, to_amount,
         receiving_address, ephemeral_address, refund_address, recipient_address,
         quote_hash, intent_hash, zcash_txid, fulfillment_txid,
         created_at, expires_at, completed_at
         FROM swaps ORDER BY created_at DESC"
    )?;

    let swaps = stmt.query_map([], |row| {
        let direction_str: String = row.get(1)?;
        let direction = if direction_str == "inbound" {
            SwapDirection::Inbound
        } else {
            SwapDirection::CrossPay
        };

        Ok(SwapRecord {
            id: row.get(0)?,
            direction,
            status: row.get(2)?,
            from_asset: row.get(3)?,
            from_amount: row.get(4)?,
            to_asset: row.get(5)?,
            to_amount: row.get(6)?,
            receiving_address: row.get(7)?,
            ephemeral_address: row.get(8)?,
            refund_address: row.get(9)?,
            recipient_address: row.get(10)?,
            quote_hash: row.get(11)?,
            intent_hash: row.get(12)?,
            zcash_txid: row.get(13)?,
            fulfillment_txid: row.get(14)?,
            created_at: row.get(15)?,
            expires_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(swaps)
}

/// Get active (non-terminal) swaps
pub fn get_active_swaps(conn: &Connection) -> Result<Vec<SwapRecord>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, direction, status, from_asset, from_amount, to_asset, to_amount,
         receiving_address, ephemeral_address, refund_address, recipient_address,
         quote_hash, intent_hash, zcash_txid, fulfillment_txid,
         created_at, expires_at, completed_at
         FROM swaps
         WHERE status NOT IN ('completed', 'failed', 'refunded')
         ORDER BY created_at DESC"
    )?;

    let swaps = stmt.query_map([], |row| {
        let direction_str: String = row.get(1)?;
        let direction = if direction_str == "inbound" {
            SwapDirection::Inbound
        } else {
            SwapDirection::CrossPay
        };

        Ok(SwapRecord {
            id: row.get(0)?,
            direction,
            status: row.get(2)?,
            from_asset: row.get(3)?,
            from_amount: row.get(4)?,
            to_asset: row.get(5)?,
            to_amount: row.get(6)?,
            receiving_address: row.get(7)?,
            ephemeral_address: row.get(8)?,
            refund_address: row.get(9)?,
            recipient_address: row.get(10)?,
            quote_hash: row.get(11)?,
            intent_hash: row.get(12)?,
            zcash_txid: row.get(13)?,
            fulfillment_txid: row.get(14)?,
            created_at: row.get(15)?,
            expires_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(swaps)
}
```

**Step 4: Create swap/address.rs (skeleton)**

```rust
//! Ephemeral address generation for swaps

use super::models::{AddressType, SwapAddress};

/// Next ephemeral address index (in-memory, will be persisted in DB later)
static NEXT_INDEX: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Generate an ephemeral transparent address for swaps
/// This is a placeholder - actual implementation needs wallet access
pub fn generate_ephemeral_transparent_address() -> SwapAddress {
    let index = NEXT_INDEX.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

    // TODO: Derive actual transparent address from wallet seed
    // For now return placeholder
    SwapAddress {
        address: format!("t_ephemeral_{}", index),
        address_type: AddressType::Transparent,
        index,
    }
}

/// Get a shielded receiving address for swaps
/// This is a placeholder - actual implementation needs wallet access
pub fn get_shielded_receiving_address() -> SwapAddress {
    SwapAddress {
        address: "shielded_placeholder".to_string(),
        address_type: AddressType::Shielded,
        index: 0,
    }
}
```

**Step 5: Add swap module to lib.rs**

Edit `/Users/zakimanian/ikki/src-tauri/src/lib.rs` to add after line 6:

```rust
pub mod swap;
```

**Step 6: Verify compilation**

```bash
cd /Users/zakimanian/ikki/src-tauri && cargo check
```

Expected: Compiles without errors.

**Step 7: Commit**

```bash
git add src-tauri/src/swap src-tauri/src/lib.rs
git commit -m "feat: add swap module structure with models and db schema"
```

---

### Task 1.3: Create Swap Commands (Backend)

**Files:**
- Create: `/Users/zakimanian/ikki/src-tauri/src/commands/swap.rs`
- Modify: `/Users/zakimanian/ikki/src-tauri/src/commands/mod.rs`
- Modify: `/Users/zakimanian/ikki/src-tauri/src/lib.rs`

**Step 1: Create commands/swap.rs**

```rust
//! Tauri commands for swap operations

use crate::state::AppState;
use crate::swap::{SwapAddress, SwapRecord, AddressType};
use tauri::State;

/// Get a receiving address for inbound swaps
#[tauri::command]
pub async fn get_swap_receiving_address(
    state: State<'_, AppState>,
    prefer_shielded: bool,
) -> Result<SwapAddress, String> {
    let wallet_guard = state.wallet.lock().await;
    let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;

    if prefer_shielded {
        // Try to get shielded address
        let address = wallet.get_address().map_err(|e| e.to_string())?;
        Ok(SwapAddress {
            address,
            address_type: AddressType::Shielded,
            index: 0,
        })
    } else {
        // Generate ephemeral transparent
        // TODO: Implement proper transparent address derivation
        Err("Transparent address generation not yet implemented".to_string())
    }
}

/// Generate an ephemeral transparent address for CrossPay
#[tauri::command]
pub async fn generate_ephemeral_address(
    _state: State<'_, AppState>,
) -> Result<String, String> {
    // TODO: Implement proper transparent address derivation from seed
    Err("Ephemeral address generation not yet implemented".to_string())
}

/// Save a swap record
#[tauri::command]
pub async fn save_swap(
    _state: State<'_, AppState>,
    swap: SwapRecord,
) -> Result<(), String> {
    // TODO: Get DB connection and save
    tracing::info!("Saving swap: {:?}", swap.id);
    Ok(())
}

/// Update swap status
#[tauri::command]
pub async fn update_swap_status(
    _state: State<'_, AppState>,
    swap_id: String,
    status: String,
    intent_hash: Option<String>,
    txid: Option<String>,
) -> Result<(), String> {
    tracing::info!(
        "Updating swap {} to status {} (intent: {:?}, txid: {:?})",
        swap_id, status, intent_hash, txid
    );
    Ok(())
}

/// Get swap history
#[tauri::command]
pub async fn get_swap_history(
    _state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    // TODO: Get from DB
    Ok(vec![])
}

/// Get active (non-terminal) swaps
#[tauri::command]
pub async fn get_active_swaps(
    _state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    // TODO: Get from DB
    Ok(vec![])
}

/// Check transparent address balance (for monitoring deposits/refunds)
#[tauri::command]
pub async fn check_transparent_balance(
    _state: State<'_, AppState>,
    _address: String,
) -> Result<u64, String> {
    // TODO: Query lightwalletd
    Ok(0)
}

/// Shield funds from transparent to Orchard
#[tauri::command]
pub async fn shield_transparent_funds(
    _state: State<'_, AppState>,
    _from_address: String,
) -> Result<String, String> {
    // TODO: Build shielding transaction
    Err("Shield transaction not yet implemented".to_string())
}
```

**Step 2: Update commands/mod.rs**

Replace contents of `/Users/zakimanian/ikki/src-tauri/src/commands/mod.rs`:

```rust
//! Tauri commands

pub mod swap;
pub mod transactions;
pub mod wallet;
```

**Step 3: Register swap commands in lib.rs**

Edit `/Users/zakimanian/ikki/src-tauri/src/lib.rs` to add swap commands to the invoke_handler (after line 48):

```rust
            // Swap commands
            commands::swap::get_swap_receiving_address,
            commands::swap::generate_ephemeral_address,
            commands::swap::save_swap,
            commands::swap::update_swap_status,
            commands::swap::get_swap_history,
            commands::swap::get_active_swaps,
            commands::swap::check_transparent_balance,
            commands::swap::shield_transparent_funds,
```

**Step 4: Verify compilation**

```bash
cd /Users/zakimanian/ikki/src-tauri && cargo check
```

Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add src-tauri/src/commands
git commit -m "feat: add swap Tauri commands (stubs)"
```

---

### Task 1.4: Create Swap Types (Frontend)

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/types/swap.ts`

**Step 1: Create the swap types file**

```typescript
// Swap-related type definitions

export type SwapDirection = 'inbound' | 'crosspay';

export type SwapStatus =
  | 'quoting'
  | 'quoted'
  | 'awaiting_deposit'
  | 'deposit_detected'
  | 'building_tx'
  | 'broadcasting_zec'
  | 'zec_confirmed'
  | 'fulfilling'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface Asset {
  chain: string;
  symbol: string;
  identifier: string;
  name: string;
  decimals: number;
  icon?: string;
}

export interface SwapQuote {
  quoteHash: string;
  provider: string;
  fromAmount: string;
  toAmount: string;
  feePercent: number;
  expiresAt: number;
  estimatedTime: number;
  raw?: unknown; // Original quote object from SwapKit
}

export interface ActiveSwap {
  id: string;
  direction: SwapDirection;
  status: SwapStatus;
  fromAsset: Asset;
  fromAmount: string;
  toAsset: Asset;
  toAmount: string;
  depositAddress?: string;
  receivingAddress?: string;
  recipientAddress?: string;
  refundAddress?: string;
  ephemeralAddress?: string;
  quoteHash: string;
  intentHash?: string;
  zcashTxid?: string;
  fulfillmentTxid?: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
}

export interface SwapState {
  activeSwap: ActiveSwap | null;
  quotes: SwapQuote[];
  quotesLoading: boolean;
  quotesError: string | null;
  supportedAssets: Asset[];
  swapHistory: ActiveSwap[];
}

export interface SwapAddress {
  address: string;
  addressType: 'shielded' | 'transparent';
  index: number;
}

// Backend swap record (matches Rust struct)
export interface SwapRecord {
  id: string;
  direction: SwapDirection;
  status: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  receiving_address?: string;
  ephemeral_address?: string;
  refund_address?: string;
  recipient_address?: string;
  quote_hash?: string;
  intent_hash?: string;
  zcash_txid?: string;
  fulfillment_txid?: string;
  created_at: number;
  expires_at?: number;
  completed_at?: number;
}
```

**Step 2: Commit**

```bash
git add src/lib/types
git commit -m "feat: add swap TypeScript type definitions"
```

---

### Task 1.5: Create Swap Store (Frontend)

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/stores/swap.ts`

**Step 1: Create the swap store**

```typescript
import { writable, derived } from 'svelte/store';
import type {
  SwapState,
  SwapQuote,
  ActiveSwap,
  Asset,
  SwapStatus,
} from '../types/swap';

const initialState: SwapState = {
  activeSwap: null,
  quotes: [],
  quotesLoading: false,
  quotesError: null,
  supportedAssets: [],
  swapHistory: [],
};

function createSwapStore() {
  const { subscribe, set, update } = writable<SwapState>(initialState);

  return {
    subscribe,

    // Quote management
    setQuotesLoading: (loading: boolean) =>
      update((s) => ({ ...s, quotesLoading: loading, quotesError: null })),

    setQuotes: (quotes: SwapQuote[]) =>
      update((s) => ({ ...s, quotes, quotesLoading: false })),

    setQuotesError: (error: string) =>
      update((s) => ({ ...s, quotesError: error, quotesLoading: false, quotes: [] })),

    clearQuotes: () =>
      update((s) => ({ ...s, quotes: [], quotesError: null })),

    // Active swap management
    setActiveSwap: (swap: ActiveSwap) =>
      update((s) => ({ ...s, activeSwap: swap })),

    updateSwapStatus: (status: SwapStatus, extras?: Partial<ActiveSwap>) =>
      update((s) => ({
        ...s,
        activeSwap: s.activeSwap
          ? { ...s.activeSwap, status, ...extras }
          : null,
      })),

    clearActiveSwap: () =>
      update((s) => ({ ...s, activeSwap: null })),

    // Assets
    setSupportedAssets: (assets: Asset[]) =>
      update((s) => ({ ...s, supportedAssets: assets })),

    // History
    setSwapHistory: (history: ActiveSwap[]) =>
      update((s) => ({ ...s, swapHistory: history })),

    addToHistory: (swap: ActiveSwap) =>
      update((s) => ({
        ...s,
        swapHistory: [swap, ...s.swapHistory],
      })),

    // Reset
    reset: () => set(initialState),
  };
}

export const swap = createSwapStore();

// Derived stores
export const activeSwap = derived(swap, ($s) => $s.activeSwap);
export const quotes = derived(swap, ($s) => $s.quotes);
export const quotesLoading = derived(swap, ($s) => $s.quotesLoading);
export const quotesError = derived(swap, ($s) => $s.quotesError);
export const supportedAssets = derived(swap, ($s) => $s.supportedAssets);
export const swapHistory = derived(swap, ($s) => $s.swapHistory);
export const hasActiveSwap = derived(swap, ($s) => $s.activeSwap !== null);
export const bestQuote = derived(swap, ($s) =>
  $s.quotes.length > 0 ? $s.quotes[0] : null
);
```

**Step 2: Commit**

```bash
git add src/lib/stores/swap.ts
git commit -m "feat: add swap Svelte store"
```

---

### Task 1.6: Add Swap View to Navigation

**Files:**
- Modify: `/Users/zakimanian/ikki/src/lib/stores/ui.ts`
- Modify: `/Users/zakimanian/ikki/src/lib/components/BottomNav.svelte`

**Step 1: Add 'swap' to View type in ui.ts**

Edit `/Users/zakimanian/ikki/src/lib/stores/ui.ts` line 3:

```typescript
export type View = "home" | "send" | "receive" | "history" | "settings" | "contacts" | "transaction-detail" | "swap";
```

**Step 2: Add Swap to BottomNav**

Edit `/Users/zakimanian/ikki/src/lib/components/BottomNav.svelte`:

Add import at line 2:
```typescript
  import { Home, Clock, Settings, ArrowLeftRight } from "lucide-svelte";
```

Update navItems array (lines 5-9):
```typescript
  const navItems = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "swap" as const, icon: ArrowLeftRight, label: "Swap" },
    { id: "history" as const, icon: Clock, label: "Activity" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
  ];
```

**Step 3: Verify build**

```bash
cd /Users/zakimanian/ikki && bun run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/stores/ui.ts src/lib/components/BottomNav.svelte
git commit -m "feat: add Swap tab to bottom navigation"
```

---

### Task 1.7: Create Swap Route Placeholder

**Files:**
- Create: `/Users/zakimanian/ikki/src/routes/Swap.svelte`
- Modify: `/Users/zakimanian/ikki/src/App.svelte`

**Step 1: Create Swap.svelte placeholder**

```svelte
<script lang="ts">
  import { ArrowLeftRight } from "lucide-svelte";
</script>

<div class="swap">
  <header class="swap-header">
    <h1>Swap</h1>
  </header>

  <div class="swap-content">
    <div class="coming-soon">
      <div class="icon-wrap">
        <ArrowLeftRight size={32} strokeWidth={1.5} />
      </div>
      <h2>Swap Coming Soon</h2>
      <p>
        Swap BTC, SOL, USDC, and other assets directly to shielded ZEC using NEAR Intents.
      </p>
    </div>
  </div>
</div>

<style>
  .swap {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .swap-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }

  .swap-header h1 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-wide);
  }

  .swap-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
  }

  .coming-soon {
    text-align: center;
    max-width: 280px;
  }

  .icon-wrap {
    width: 72px;
    height: 72px;
    margin: 0 auto var(--space-4);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
  }

  .coming-soon h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .coming-soon p {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    line-height: var(--leading-relaxed);
  }
</style>
```

**Step 2: Add Swap route to App.svelte**

Read App.svelte first to find the route structure, then add the Swap import and route case.

Add import near other route imports:
```typescript
import Swap from "./routes/Swap.svelte";
```

Add case in the view switch (find the pattern with other routes):
```svelte
{:else if $currentView === "swap"}
  <Swap />
```

**Step 3: Verify build and test**

```bash
cd /Users/zakimanian/ikki && bun run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/routes/Swap.svelte src/App.svelte
git commit -m "feat: add Swap route placeholder"
```

---

## Phase 2: SwapKit Integration

### Task 2.1: Create SwapKit Service

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/services/swapkit.ts`

**Step 1: Create the SwapKit service wrapper**

```typescript
// SwapKit SDK wrapper for NEAR Intents integration

import type { Asset, SwapQuote } from '../types/swap';

// SwapKit SDK types (we'll refine these as we integrate)
interface SwapKitQuoteParams {
  sellAsset: string;
  buyAsset: string;
  sellAmount?: string;
  buyAmount?: string;
  recipientAddress?: string;
}

interface SwapKitExecuteParams {
  route: unknown;
  userAddress: string;
  refundAddress?: string;
}

interface SwapKitStatusResponse {
  status: string;
  txHash?: string;
  error?: string;
}

// ZEC asset identifier
const ZEC_ASSET = 'ZEC.ZEC';

// Mock mode for development
const USE_MOCK = import.meta.env.VITE_USE_MOCK_SWAPKIT === 'true';

// Mock implementation for development
const mockSwapKit = {
  async getAssets(): Promise<Asset[]> {
    return [
      { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8 },
      { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18 },
      { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9 },
      { chain: 'ETH', symbol: 'USDC', identifier: 'ETH.USDC', name: 'USD Coin', decimals: 6 },
    ];
  },

  async getQuote(_params: SwapKitQuoteParams): Promise<SwapQuote[]> {
    await new Promise((r) => setTimeout(r, 500)); // Simulate network delay
    return [
      {
        quoteHash: `mock-${Date.now()}`,
        provider: 'NEAR_INTENTS',
        fromAmount: '1.0',
        toAmount: '42.5',
        feePercent: 0.01,
        expiresAt: Date.now() + 60000,
        estimatedTime: 120,
      },
    ];
  },

  async executeSwap(_params: SwapKitExecuteParams): Promise<{ intentHash: string; depositAddress: string }> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      intentHash: `mock-intent-${Date.now()}`,
      depositAddress: 'mock-deposit-address-abc123',
    };
  },

  async getStatus(_intentHash: string): Promise<SwapKitStatusResponse> {
    return { status: 'PENDING' };
  },
};

// Real SwapKit implementation (to be completed when integrating SDK)
async function getRealSwapKitClient() {
  // Dynamic import to avoid loading SDK during mock mode
  const { SwapKitApi } = await import('@swapkit/sdk');
  return new SwapKitApi({
    // Configuration will be added based on SDK docs
  });
}

/**
 * Get list of supported assets that can swap with ZEC
 */
export async function getSupportedAssets(): Promise<Asset[]> {
  if (USE_MOCK) {
    return mockSwapKit.getAssets();
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('SwapKit client:', client);
    return [];
  } catch (error) {
    console.error('Failed to get supported assets:', error);
    return [];
  }
}

/**
 * Get quotes for inbound swap (external asset → ZEC)
 */
export async function getInboundQuotes(
  fromAsset: string,
  fromAmount: string,
  receivingAddress: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    return mockSwapKit.getQuote({
      sellAsset: fromAsset,
      buyAsset: ZEC_ASSET,
      sellAmount: fromAmount,
      recipientAddress: receivingAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting quotes:', { fromAsset, fromAmount, receivingAddress, client });
    return [];
  } catch (error) {
    console.error('Failed to get inbound quotes:', error);
    throw error;
  }
}

/**
 * Get quotes for CrossPay (ZEC → external asset)
 */
export async function getCrossPayQuotes(
  toAsset: string,
  toAmount: string,
  recipientAddress: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    return mockSwapKit.getQuote({
      sellAsset: ZEC_ASSET,
      buyAsset: toAsset,
      buyAmount: toAmount,
      recipientAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting CrossPay quotes:', { toAsset, toAmount, recipientAddress, client });
    return [];
  } catch (error) {
    console.error('Failed to get CrossPay quotes:', error);
    throw error;
  }
}

/**
 * Execute a swap (publish intent to solver bus)
 */
export async function executeSwap(
  quote: SwapQuote,
  params: {
    userAddress: string;
    refundAddress?: string;
  }
): Promise<{ intentHash: string; depositAddress: string }> {
  if (USE_MOCK) {
    return mockSwapKit.executeSwap({
      route: quote.raw,
      userAddress: params.userAddress,
      refundAddress: params.refundAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Executing swap:', { quote, params, client });
    throw new Error('Not implemented');
  } catch (error) {
    console.error('Failed to execute swap:', error);
    throw error;
  }
}

/**
 * Get swap status from solver bus
 */
export async function getSwapStatus(intentHash: string): Promise<{
  status: string;
  txHash?: string;
  error?: string;
}> {
  if (USE_MOCK) {
    return mockSwapKit.getStatus(intentHash);
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting status:', { intentHash, client });
    return { status: 'UNKNOWN' };
  } catch (error) {
    console.error('Failed to get swap status:', error);
    throw error;
  }
}

/**
 * Detect which chain an address belongs to
 */
export function detectChain(address: string): string | null {
  // Zcash unified addresses
  if (address.startsWith('u1')) return 'zcash';
  // Zcash sapling
  if (address.startsWith('zs')) return 'zcash';
  // Zcash transparent
  if (address.startsWith('t1') || address.startsWith('t3')) return 'zcash';

  // Bitcoin
  if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) return 'bitcoin';

  // Ethereum / EVM
  if (address.startsWith('0x') && address.length === 42) return 'ethereum';

  // Solana (base58, 32-44 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'solana';

  // NEAR (account.near or implicit)
  if (address.endsWith('.near') || /^[a-f0-9]{64}$/.test(address)) return 'near';

  return null;
}

/**
 * Check if an address is a Zcash address
 */
export function isZcashAddress(address: string): boolean {
  return detectChain(address) === 'zcash';
}
```

**Step 2: Commit**

```bash
git add src/lib/services
git commit -m "feat: add SwapKit service wrapper with mock mode"
```

---

### Task 2.2: Add Tauri Bridge Functions for Swap

**Files:**
- Modify: `/Users/zakimanian/ikki/src/lib/utils/tauri.ts`

**Step 1: Read current tauri.ts**

Read the file to understand the pattern used.

**Step 2: Add swap-related invoke functions**

Add to the end of `/Users/zakimanian/ikki/src/lib/utils/tauri.ts`:

```typescript
// Swap commands
import type { SwapAddress, SwapRecord } from '../types/swap';

export async function getSwapReceivingAddress(preferShielded: boolean): Promise<SwapAddress> {
  return invoke<SwapAddress>('get_swap_receiving_address', { preferShielded });
}

export async function generateEphemeralAddress(): Promise<string> {
  return invoke<string>('generate_ephemeral_address');
}

export async function saveSwap(swap: SwapRecord): Promise<void> {
  return invoke<void>('save_swap', { swap });
}

export async function updateSwapStatus(
  swapId: string,
  status: string,
  intentHash?: string,
  txid?: string
): Promise<void> {
  return invoke<void>('update_swap_status', { swapId, status, intentHash, txid });
}

export async function getSwapHistory(): Promise<SwapRecord[]> {
  return invoke<SwapRecord[]>('get_swap_history');
}

export async function getActiveSwaps(): Promise<SwapRecord[]> {
  return invoke<SwapRecord[]>('get_active_swaps');
}

export async function checkTransparentBalance(address: string): Promise<number> {
  return invoke<number>('check_transparent_balance', { address });
}

export async function shieldTransparentFunds(fromAddress: string): Promise<string> {
  return invoke<string>('shield_transparent_funds', { fromAddress });
}
```

**Step 3: Commit**

```bash
git add src/lib/utils/tauri.ts
git commit -m "feat: add Tauri bridge functions for swap commands"
```

---

## Phase 3: Inbound Swap UI

### Task 3.1: Create AssetSelector Component

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/components/AssetSelector.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import { ChevronDown, Search } from "lucide-svelte";
  import type { Asset } from "../types/swap";

  export let assets: Asset[] = [];
  export let selected: Asset | null = null;
  export let onSelect: (asset: Asset) => void = () => {};
  export let disabled = false;

  let open = false;
  let search = "";

  $: filteredAssets = assets.filter(
    (a) =>
      a.symbol.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.chain.toLowerCase().includes(search.toLowerCase())
  );

  // Group by chain
  $: groupedAssets = filteredAssets.reduce(
    (acc, asset) => {
      if (!acc[asset.chain]) acc[asset.chain] = [];
      acc[asset.chain].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>
  );

  function handleSelect(asset: Asset) {
    onSelect(asset);
    open = false;
    search = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      search = "";
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="selector" class:open class:disabled>
  <button
    class="selector-trigger"
    onclick={() => !disabled && (open = !open)}
    {disabled}
  >
    {#if selected}
      <span class="asset-symbol">{selected.symbol}</span>
      <span class="asset-chain">{selected.chain}</span>
    {:else}
      <span class="placeholder">Select asset</span>
    {/if}
    <ChevronDown size={16} class="chevron" />
  </button>

  {#if open}
    <div class="dropdown">
      <div class="search-wrap">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search assets..."
          bind:value={search}
          class="search-input"
        />
      </div>

      <div class="asset-list">
        {#each Object.entries(groupedAssets) as [chain, chainAssets]}
          <div class="chain-group">
            <div class="chain-header">{chain}</div>
            {#each chainAssets as asset}
              <button
                class="asset-item"
                class:selected={selected?.identifier === asset.identifier}
                onclick={() => handleSelect(asset)}
              >
                <span class="asset-symbol">{asset.symbol}</span>
                <span class="asset-name">{asset.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="no-results">No assets found</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .selector {
    position: relative;
  }

  .selector.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .selector-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--ease-out);
    min-width: 120px;
  }

  .selector-trigger:hover {
    border-color: var(--border-hover);
  }

  .selector.open .selector-trigger {
    border-color: var(--accent);
  }

  .asset-symbol {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }

  .asset-chain {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
  }

  .placeholder {
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  .selector-trigger :global(.chevron) {
    margin-left: auto;
    color: var(--text-tertiary);
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .selector.open .selector-trigger :global(.chevron) {
    transform: rotate(180deg);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    right: 0;
    min-width: 200px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 50;
    max-height: 300px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .search-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
    color: var(--text-tertiary);
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .asset-list {
    overflow-y: auto;
    flex: 1;
  }

  .chain-group {
    padding: var(--space-1) 0;
  }

  .chain-header {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-2xs);
    font-weight: var(--font-semibold);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .asset-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
    text-align: left;
  }

  .asset-item:hover {
    background: var(--bg-hover);
  }

  .asset-item.selected {
    background: var(--accent-muted);
  }

  .asset-item .asset-symbol {
    font-size: var(--text-sm);
  }

  .asset-name {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .no-results {
    padding: var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/AssetSelector.svelte
git commit -m "feat: add AssetSelector component for swap"
```

---

### Task 3.2: Create DepositPrompt Component

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/components/DepositPrompt.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import { Copy, Check, Clock } from "lucide-svelte";
  import QRCode from "qrcode";
  import { onMount } from "svelte";

  export let address: string;
  export let amount: string;
  export let symbol: string;
  export let expiresAt: number;

  let copied = false;
  let qrDataUrl = "";
  let remainingTime = "";

  onMount(() => {
    // Generate QR code
    QRCode.toDataURL(address, {
      width: 200,
      margin: 2,
      color: { dark: "#ffffff", light: "#00000000" },
    }).then((url) => {
      qrDataUrl = url;
    });

    // Update remaining time
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      remainingTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }

  function truncate(addr: string, chars = 8): string {
    if (addr.length <= chars * 2 + 3) return addr;
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
  }
</script>

<div class="deposit-prompt">
  <div class="header">
    <h3>Deposit {amount} {symbol}</h3>
    <p>Send from your external wallet to complete the swap</p>
  </div>

  <div class="qr-section">
    {#if qrDataUrl}
      <div class="qr-wrap">
        <img src={qrDataUrl} alt="Deposit address QR code" />
      </div>
    {:else}
      <div class="qr-loading">Loading...</div>
    {/if}
    <p class="qr-hint">Scan with your mobile wallet</p>
  </div>

  <div class="address-section">
    <p class="address-label">Or copy address</p>
    <button class="address-copy" onclick={copyAddress}>
      <span class="address-text">{truncate(address, 12)}</span>
      {#if copied}
        <Check size={14} class="copy-icon success" />
      {:else}
        <Copy size={14} class="copy-icon" />
      {/if}
    </button>
  </div>

  <div class="timer">
    <Clock size={14} />
    <span>Expires in {remainingTime}</span>
  </div>
</div>

<style>
  .deposit-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-5);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .header {
    text-align: center;
  }

  .header h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }

  .header p {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .qr-wrap {
    padding: var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .qr-wrap img {
    display: block;
    width: 160px;
    height: 160px;
  }

  .qr-loading {
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
  }

  .qr-hint {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .address-section {
    width: 100%;
    text-align: center;
  }

  .address-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
  }

  .address-copy {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .address-copy:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }

  .address-text {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-primary);
  }

  .address-copy :global(.copy-icon) {
    color: var(--text-tertiary);
  }

  .address-copy :global(.copy-icon.success) {
    color: var(--receive);
  }

  .timer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/DepositPrompt.svelte
git commit -m "feat: add DepositPrompt component with QR code"
```

---

### Task 3.3: Create SwapStatus Component

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/components/SwapStatus.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import { Loader2, Check, X, Clock, ArrowRight } from "lucide-svelte";
  import type { SwapStatus } from "../types/swap";

  export let status: SwapStatus;
  export let fromSymbol = "";
  export let toSymbol = "";
  export let txHash: string | undefined = undefined;

  const statusConfig: Record<SwapStatus, { label: string; icon: typeof Loader2; color: string }> = {
    quoting: { label: "Getting quotes...", icon: Loader2, color: "var(--text-tertiary)" },
    quoted: { label: "Quote ready", icon: Check, color: "var(--receive)" },
    awaiting_deposit: { label: "Waiting for deposit", icon: Clock, color: "var(--text-secondary)" },
    deposit_detected: { label: "Deposit confirmed", icon: Check, color: "var(--receive)" },
    building_tx: { label: "Building transaction", icon: Loader2, color: "var(--text-tertiary)" },
    broadcasting_zec: { label: "Broadcasting to Zcash", icon: Loader2, color: "var(--text-tertiary)" },
    zec_confirmed: { label: "ZEC confirmed", icon: Check, color: "var(--receive)" },
    fulfilling: { label: "Solver fulfilling", icon: Loader2, color: "var(--text-tertiary)" },
    completed: { label: "Swap complete!", icon: Check, color: "var(--receive)" },
    failed: { label: "Swap failed", icon: X, color: "var(--error)" },
    refunded: { label: "Refunded", icon: ArrowRight, color: "var(--text-secondary)" },
  };

  $: config = statusConfig[status];
  $: isSpinning = ["quoting", "building_tx", "broadcasting_zec", "fulfilling"].includes(status);
</script>

<div class="swap-status" style="--status-color: {config.color}">
  <div class="status-icon" class:spinning={isSpinning}>
    <svelte:component this={config.icon} size={24} />
  </div>

  <div class="status-info">
    <span class="status-label">{config.label}</span>
    {#if fromSymbol && toSymbol}
      <span class="status-pair">{fromSymbol} → {toSymbol}</span>
    {/if}
  </div>

  {#if txHash}
    <a
      href="https://explorer.zcash.co/tx/{txHash}"
      target="_blank"
      rel="noopener noreferrer"
      class="tx-link"
    >
      View tx
    </a>
  {/if}
</div>

<style>
  .swap-status {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .status-icon {
    color: var(--status-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-icon.spinning :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .status-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .status-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .status-pair {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .tx-link {
    font-size: var(--text-xs);
    color: var(--accent);
    text-decoration: none;
  }

  .tx-link:hover {
    text-decoration: underline;
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/SwapStatus.svelte
git commit -m "feat: add SwapStatus component"
```

---

### Task 3.4: Build Full Swap UI

**Files:**
- Modify: `/Users/zakimanian/ikki/src/routes/Swap.svelte`

**Step 1: Replace placeholder with full implementation**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft, RefreshCw } from "lucide-svelte";
  import { ui } from "../lib/stores/ui";
  import {
    swap,
    quotes,
    quotesLoading,
    quotesError,
    activeSwap,
    supportedAssets,
    bestQuote,
  } from "../lib/stores/swap";
  import { wallet } from "../lib/stores/wallet";
  import {
    getSupportedAssets,
    getInboundQuotes,
    executeSwap,
  } from "../lib/services/swapkit";
  import { getSwapReceivingAddress } from "../lib/utils/tauri";
  import type { Asset, SwapQuote, ActiveSwap } from "../lib/types/swap";
  import AssetSelector from "../lib/components/AssetSelector.svelte";
  import DepositPrompt from "../lib/components/DepositPrompt.svelte";
  import SwapStatus from "../lib/components/SwapStatus.svelte";
  import Button from "../lib/components/Button.svelte";
  import Input from "../lib/components/Input.svelte";

  // Form state
  let selectedAsset: Asset | null = null;
  let amount = "";
  let refundAddress = "";
  let phase: "input" | "quote" | "deposit" | "status" = "input";

  onMount(async () => {
    // Load supported assets
    const assets = await getSupportedAssets();
    swap.setSupportedAssets(assets);
  });

  async function fetchQuotes() {
    if (!selectedAsset || !amount) return;

    swap.setQuotesLoading(true);
    try {
      const address = await getSwapReceivingAddress(true);
      const fetchedQuotes = await getInboundQuotes(
        selectedAsset.identifier,
        amount,
        address.address
      );
      swap.setQuotes(fetchedQuotes);
      phase = "quote";
    } catch (error) {
      swap.setQuotesError(String(error));
    }
  }

  async function confirmSwap() {
    if (!$bestQuote || !selectedAsset) return;

    try {
      const address = await getSwapReceivingAddress(true);
      const result = await executeSwap($bestQuote, {
        userAddress: address.address,
        refundAddress: refundAddress || undefined,
      });

      const newSwap: ActiveSwap = {
        id: crypto.randomUUID(),
        direction: "inbound",
        status: "awaiting_deposit",
        fromAsset: selectedAsset,
        fromAmount: amount,
        toAsset: {
          chain: "ZEC",
          symbol: "ZEC",
          identifier: "ZEC.ZEC",
          name: "Zcash",
          decimals: 8,
        },
        toAmount: $bestQuote.toAmount,
        depositAddress: result.depositAddress,
        receivingAddress: address.address,
        refundAddress,
        quoteHash: $bestQuote.quoteHash,
        intentHash: result.intentHash,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
      };

      swap.setActiveSwap(newSwap);
      phase = "deposit";
    } catch (error) {
      ui.showToast(`Failed to start swap: ${error}`, "error");
    }
  }

  function handleBack() {
    if (phase === "quote") {
      swap.clearQuotes();
      phase = "input";
    } else if (phase === "input") {
      ui.navigate("home");
    }
  }

  function reset() {
    selectedAsset = null;
    amount = "";
    refundAddress = "";
    swap.clearQuotes();
    swap.clearActiveSwap();
    phase = "input";
  }

  $: canGetQuote = selectedAsset && parseFloat(amount) > 0;
</script>

<div class="swap-page">
  {#if phase !== "deposit" && phase !== "status"}
    <header class="swap-header">
      <button class="back-button" onclick={handleBack}>
        <ArrowLeft size={20} strokeWidth={2} />
      </button>
      <h1>Swap to ZEC</h1>
      <div class="header-spacer"></div>
    </header>
  {/if}

  <div class="swap-content">
    {#if phase === "input"}
      <div class="input-phase">
        <div class="form-section">
          <label class="field-label">From</label>
          <div class="from-row">
            <AssetSelector
              assets={$supportedAssets}
              selected={selectedAsset}
              onSelect={(a) => (selectedAsset = a)}
            />
            <Input
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              value={amount}
              oninput={(e) => (amount = e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="swap-arrow">
          <RefreshCw size={20} />
        </div>

        <div class="form-section">
          <label class="field-label">To</label>
          <div class="to-display">
            <span class="zec-badge">ZEC</span>
            <span class="estimated">≈ {$bestQuote?.toAmount || "—"}</span>
          </div>
        </div>

        <div class="form-section">
          <Input
            label="Refund address (optional)"
            placeholder={`Your ${selectedAsset?.symbol || ""} address`}
            value={refundAddress}
            oninput={(e) => (refundAddress = e.currentTarget.value)}
          />
          <p class="field-hint">
            If the swap fails, funds will be returned here
          </p>
        </div>

        <div class="form-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canGetQuote || $quotesLoading}
            onclick={fetchQuotes}
          >
            {$quotesLoading ? "Getting quote..." : "Get Quote"}
          </Button>
        </div>

        {#if $quotesError}
          <p class="error-text">{$quotesError}</p>
        {/if}
      </div>

    {:else if phase === "quote"}
      <div class="quote-phase">
        <div class="quote-summary">
          <div class="quote-from">
            <span class="quote-amount">{amount}</span>
            <span class="quote-symbol">{selectedAsset?.symbol}</span>
          </div>
          <div class="quote-arrow">→</div>
          <div class="quote-to">
            <span class="quote-amount">{$bestQuote?.toAmount}</span>
            <span class="quote-symbol">ZEC</span>
          </div>
        </div>

        <div class="quote-details">
          <div class="detail-row">
            <span>Provider</span>
            <span>{$bestQuote?.provider}</span>
          </div>
          <div class="detail-row">
            <span>Fee</span>
            <span>{($bestQuote?.feePercent ?? 0 * 100).toFixed(2)}%</span>
          </div>
          <div class="detail-row">
            <span>Estimated time</span>
            <span>~{Math.ceil(($bestQuote?.estimatedTime ?? 0) / 60)} min</span>
          </div>
        </div>

        <div class="form-actions">
          <Button variant="primary" size="lg" fullWidth onclick={confirmSwap}>
            Confirm Swap
          </Button>
          <Button variant="ghost" size="lg" fullWidth onclick={handleBack}>
            Back
          </Button>
        </div>
      </div>

    {:else if phase === "deposit" && $activeSwap}
      <div class="deposit-phase">
        <DepositPrompt
          address={$activeSwap.depositAddress ?? ""}
          amount={$activeSwap.fromAmount}
          symbol={$activeSwap.fromAsset.symbol}
          expiresAt={$activeSwap.expiresAt}
        />

        <SwapStatus
          status={$activeSwap.status}
          fromSymbol={$activeSwap.fromAsset.symbol}
          toSymbol="ZEC"
        />

        <div class="form-actions">
          <Button variant="ghost" size="lg" fullWidth onclick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .swap-page {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .swap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }

  .back-button {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .back-button:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .swap-header h1 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .header-spacer {
    width: 40px;
  }

  .swap-content {
    flex: 1;
    padding: var(--space-5);
    max-width: var(--max-width);
    margin: 0 auto;
    width: 100%;
  }

  .input-phase,
  .quote-phase,
  .deposit-phase {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .from-row {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
  }

  .swap-arrow {
    display: flex;
    justify-content: center;
    color: var(--text-tertiary);
  }

  .to-display {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .zec-badge {
    padding: var(--space-1) var(--space-2);
    background: var(--accent-muted);
    border-radius: var(--radius-sm);
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .estimated {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    color: var(--text-secondary);
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .form-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .error-text {
    color: var(--error);
    font-size: var(--text-sm);
    text-align: center;
  }

  /* Quote phase */
  .quote-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-6) 0;
  }

  .quote-from,
  .quote-to {
    text-align: center;
  }

  .quote-amount {
    display: block;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .quote-symbol {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .quote-arrow {
    font-size: var(--text-xl);
    color: var(--text-tertiary);
  }

  .quote-details {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) 0;
    font-size: var(--text-sm);
  }

  .detail-row span:first-child {
    color: var(--text-tertiary);
  }

  .detail-row span:last-child {
    color: var(--text-primary);
  }
</style>
```

**Step 2: Verify build**

```bash
cd /Users/zakimanian/ikki && bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/routes/Swap.svelte
git commit -m "feat: implement full Swap UI with quote and deposit flows"
```

---

## Phase 4: CrossPay Integration

### Task 4.1: Add Address Detection to Send

**Files:**
- Modify: `/Users/zakimanian/ikki/src/routes/Send.svelte`

**Step 1: Add CrossPay detection**

Add imports near the top of the script section:
```typescript
import { detectChain, isZcashAddress } from "../lib/services/swapkit";
```

Add derived value after other reactive declarations (around line 96):
```typescript
$: detectedChain = $sendAddress ? detectChain($sendAddress) : null;
$: isCrossPay = detectedChain !== null && detectedChain !== 'zcash';
```

**Step 2: Add CrossPay prompt in the input phase**

After the address Input component (around line 149), add:
```svelte
{#if isCrossPay}
  <div class="crosspay-notice">
    <span class="chain-badge">{detectedChain?.toUpperCase()}</span>
    <span>This is a {detectedChain} address. Send via CrossPay?</span>
  </div>
{/if}
```

**Step 3: Add styles for CrossPay notice**

Add to the style section:
```css
.crosspay-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--accent-muted);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.chain-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-weight: var(--font-semibold);
  font-size: var(--text-2xs);
  color: var(--text-primary);
}
```

**Step 4: Commit**

```bash
git add src/routes/Send.svelte
git commit -m "feat: add CrossPay address detection to Send flow"
```

---

## Phase 5: Polish & Testing

### Task 5.1: Add Swap History Component

**Files:**
- Create: `/Users/zakimanian/ikki/src/lib/components/SwapHistory.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-svelte";
  import type { ActiveSwap } from "../types/swap";

  export let swaps: ActiveSwap[] = [];

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: string): string {
    if (status === "completed") return "var(--receive)";
    if (status === "failed") return "var(--error)";
    return "var(--text-tertiary)";
  }
</script>

<div class="swap-history">
  {#if swaps.length === 0}
    <div class="empty">
      <Clock size={24} />
      <p>No swap history yet</p>
    </div>
  {:else}
    <ul class="swap-list">
      {#each swaps as swap}
        <li class="swap-item">
          <div class="swap-icon" class:inbound={swap.direction === "inbound"}>
            {#if swap.direction === "inbound"}
              <ArrowDownLeft size={16} />
            {:else}
              <ArrowUpRight size={16} />
            {/if}
          </div>
          <div class="swap-info">
            <div class="swap-pair">
              {swap.fromAsset.symbol} → {swap.toAsset.symbol}
            </div>
            <div class="swap-date">{formatDate(swap.createdAt)}</div>
          </div>
          <div class="swap-amounts">
            <div class="swap-from">-{swap.fromAmount} {swap.fromAsset.symbol}</div>
            <div class="swap-to">+{swap.toAmount} {swap.toAsset.symbol}</div>
          </div>
          <div class="swap-status" style="color: {getStatusColor(swap.status)}">
            {swap.status}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .swap-history {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-8);
    color: var(--text-tertiary);
  }

  .empty p {
    font-size: var(--text-sm);
  }

  .swap-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .swap-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .swap-item:last-child {
    border-bottom: none;
  }

  .swap-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border-radius: var(--radius-full);
    color: var(--send);
  }

  .swap-icon.inbound {
    color: var(--receive);
  }

  .swap-info {
    flex: 1;
  }

  .swap-pair {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .swap-date {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .swap-amounts {
    text-align: right;
  }

  .swap-from {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .swap-to {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--receive);
  }

  .swap-status {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/SwapHistory.svelte
git commit -m "feat: add SwapHistory component"
```

---

### Task 5.2: Final Integration Test

**Step 1: Build the project**

```bash
cd /Users/zakimanian/ikki && bun run build
```

Expected: Build succeeds with no errors.

**Step 2: Run the app in dev mode**

```bash
cd /Users/zakimanian/ikki && npm run tauri dev
```

Expected: App launches, Swap tab is visible, clicking shows the swap UI.

**Step 3: Test with mock mode**

Create `.env` file if needed:
```bash
echo "VITE_USE_MOCK_SWAPKIT=true" > /Users/zakimanian/ikki/.env
```

Restart dev server and test:
1. Navigate to Swap tab
2. Select an asset
3. Enter an amount
4. Click "Get Quote"
5. Verify quote appears
6. Click "Confirm Swap"
7. Verify deposit prompt shows

**Step 4: Commit any final fixes**

```bash
git add .
git commit -m "chore: finalize phase 1 integration"
```

---

## Summary

This implementation plan provides 15 bite-sized tasks across 5 phases:

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1.1-1.7 | Foundation: dependencies, module structure, types, stores, navigation |
| 2 | 2.1-2.2 | SwapKit integration: service wrapper, Tauri bridge |
| 3 | 3.1-3.4 | Inbound swap UI: AssetSelector, DepositPrompt, SwapStatus, full Swap page |
| 4 | 4.1 | CrossPay: address detection in Send flow |
| 5 | 5.1-5.2 | Polish: SwapHistory, integration testing |

Each task follows TDD principles with explicit verification steps and commits.

---

**Plan complete and saved to `docs/plans/2025-12-19-near-intents-implementation.md`.**

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
