# NEAR Intents Integration Design

**Date:** 2025-12-19
**Status:** Approved
**Branch:** `feature/near-intents-integration`

## Overview

Integrate NEAR Intents swap functionality into Ikki, enabling users to:
1. **Inbound Swaps:** Convert BTC, SOL, USDC, and other assets directly into shielded ZEC
2. **CrossPay:** Spend shielded ZEC to pay recipients on other chains

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Swap directions | Both inbound + CrossPay | Full bidirectional support |
| Integration approach | SwapKit SDK | Battle-tested by Zashi, handles edge cases |
| Address strategy | Direct to shielded (fallback: ephemeral transparent + auto-shield) | Maximum privacy |
| CrossPay source | Ephemeral transparent addresses | Only practical option for solver visibility |
| UI integration | New Swap tab + Send integration | Clear entry points for both flows |
| Supported assets | All SwapKit chains | Dynamic from SwapKit API |
| Refund handling | Direction-based | Inbound→source wallet, CrossPay→Ikki ephemeral |
| External deposits | Copy address + QR code | Universal desktop/mobile support |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Svelte 5 Frontend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │  Swap Tab   │  │ Send (with  │  │  SwapKit SDK         │    │
│  │  Component  │  │ CrossPay)   │  │  (TypeScript)        │    │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘    │
│         │                │                     │                │
│         └────────────────┴─────────────────────┘                │
│                          │                                      │
│              ┌───────────▼───────────┐                         │
│              │  Swap Store (Svelte)  │                         │
│              │  - quotes, status,    │                         │
│              │    pending swaps      │                         │
│              └───────────┬───────────┘                         │
└──────────────────────────┼──────────────────────────────────────┘
                           │ Tauri IPC
┌──────────────────────────┼──────────────────────────────────────┐
│                   Rust Backend                                  │
│  ┌───────────────────────▼───────────────────────────────────┐ │
│  │  New Commands:                                             │ │
│  │  - get_swap_address() → shielded or ephemeral transparent │ │
│  │  - prepare_crosspay_tx() → build ZEC tx to ephemeral      │ │
│  │  - shield_received_funds() → move transparent → Orchard   │ │
│  │  - track_swap() → persist swap state to SQLite            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
   ┌───────────┐                    ┌─────────────────┐
   │ SwapKit   │◄───────────────────│ NEAR Intents    │
   │ API       │                    │ Solver Bus      │
   └───────────┘                    └─────────────────┘
```

---

## Inbound Swap Flow (External → ZEC)

**User Journey:**
1. User opens **Swap tab**, selects source asset (e.g., "1 SOL")
2. Frontend calls SwapKit to get quotes from solvers
3. User sees quote: "1 SOL → 42.5 ZEC (fee: 0.01%)"
4. User confirms, provides **refund address** on source chain
5. Ikki generates receiving address (shielded preferred, ephemeral transparent fallback)
6. SwapKit publishes intent to Solver Bus
7. UI shows deposit address + QR code for user to send from external wallet
8. User deposits SOL from their external wallet to solver's address
9. Solver fulfills: sends ZEC to Ikki's receiving address
10. If transparent was used: auto-shield to Orchard pool
11. Swap marked complete, balance updates

**State Machine:**
```
IDLE → QUOTING → QUOTED → AWAITING_DEPOSIT → DEPOSIT_DETECTED
     → FULFILLING → COMPLETED
                  ↘ FAILED → (refund to source wallet)
```

**Deposit UI:**
```
┌─────────────────────────────────────────┐
│  Deposit 1.0 SOL to complete swap       │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │         [QR CODE]               │    │
│  │   Scan with your mobile wallet  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Or copy address to send from any wallet│
│  ┌─────────────────────────────────────┐│
│  │ 7xKpQ9mR2...wN4vX8              [📋]││
│  └─────────────────────────────────────┘│
│                                         │
│  ⏱ Waiting for deposit... (28:45)       │
└─────────────────────────────────────────┘
```

---

## CrossPay Flow (ZEC → External)

**User Journey:**
1. User opens **Send**, enters recipient address (e.g., Solana address `7xKp...`)
2. Ikki detects non-ZEC address, shows: "Pay with CrossPay? Recipient gets SOL"
3. User enters amount in ZEC or target currency
4. Frontend calls SwapKit for quote: "2.1 ZEC → 0.5 SOL"
5. User confirms
6. **Backend prepares tx:**
   - Generate ephemeral transparent address
   - Build Zcash tx: shielded pool → ephemeral transparent (unshield)
   - Sign and broadcast to Zcash network
7. SwapKit publishes intent with ephemeral address + tx proof
8. Solver monitors ephemeral address, sees funds arrive
9. Solver fulfills: sends SOL to recipient's address
10. Swap complete, ephemeral address discarded

**State Machine:**
```
IDLE → QUOTING → QUOTED → BUILDING_TX → BROADCASTING_ZEC
     → ZEC_CONFIRMED → SOLVER_FULFILLING → COMPLETED
                                        ↘ FAILED → (refund to Ikki ephemeral, auto-shield)
```

**Refund Handling:**
- If solver fails after ZEC sent: refund returns to ephemeral address
- Backend monitors ephemeral address for refund
- On refund detected: auto-shield back to Orchard pool
- User notified: "CrossPay failed. Funds returned to your wallet."

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Swap.svelte` | `/src/routes/` | Main swap tab with asset selector, quote display |
| `AssetSelector.svelte` | `/src/lib/components/` | Dropdown with search, chain icons, grouped by chain |
| `CrossPayPrompt.svelte` | `/src/lib/components/` | Inline prompt in Send when non-ZEC address detected |
| `SwapStatus.svelte` | `/src/lib/components/` | Progress indicator with states and tx links |
| `SwapHistory.svelte` | `/src/lib/components/` | List of past swaps with direction, amounts, status |
| `DepositPrompt.svelte` | `/src/lib/components/` | QR code + copy address for inbound deposits |

### Modified Components

| Component | Changes |
|-----------|---------|
| `Send.svelte` | Add address detection + CrossPay integration |
| `BottomNav.svelte` | Add Swap tab icon |
| `Home.svelte` | Show pending swaps indicator |

### Swap Tab Layout

```
┌─────────────────────────────────┐
│  Swap to ZEC                    │
├─────────────────────────────────┤
│  From:  [SOL ▼] [1.0    ]       │
│         Balance: 5.2 SOL        │
│                                 │
│         ⇅ (swap direction)      │
│                                 │
│  To:    [ZEC  ] [≈ 42.5 ]       │
│         Rate: 1 SOL = 42.5 ZEC  │
├─────────────────────────────────┤
│  Refund address (SOL):          │
│  [7xKp...                    ]  │
├─────────────────────────────────┤
│  Fee: 0.01% · ETA: ~2 min       │
│  [      Get Quote      ]        │
└─────────────────────────────────┘
```

---

## Data Models

### Frontend Types (`/src/lib/types/swap.ts`)

```typescript
interface SwapState {
  activeSwap: ActiveSwap | null
  quotes: SwapQuote[]
  quotesLoading: boolean
  quotesError: string | null
  supportedAssets: Asset[]
  swapHistory: CompletedSwap[]
}

interface ActiveSwap {
  id: string
  direction: 'inbound' | 'crosspay'
  status: SwapStatus
  fromAsset: Asset
  fromAmount: string
  toAsset: Asset
  toAmount: string
  depositAddress?: string
  receivingAddress?: string
  recipientAddress?: string
  refundAddress?: string
  ephemeralAddress?: string
  quoteHash: string
  intentHash?: string
  zcashTxid?: string
  fulfillmentTxid?: string
  createdAt: number
  expiresAt: number
  completedAt?: number
}

type SwapStatus =
  | 'quoting' | 'quoted' | 'awaiting_deposit' | 'deposit_detected'
  | 'building_tx' | 'broadcasting_zec' | 'zec_confirmed'
  | 'fulfilling' | 'completed' | 'failed' | 'refunded'

interface SwapQuote {
  quoteHash: string
  provider: string
  fromAmount: string
  toAmount: string
  feePercent: number
  expiresAt: number
  estimatedTime: number
}

interface Asset {
  chain: string
  symbol: string
  identifier: string
  name: string
  decimals: number
  icon?: string
}
```

### Backend Types (`/src-tauri/src/swap/models.rs`)

```rust
#[derive(Serialize, Deserialize)]
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
    pub zcash_txid: Option<String>,
    pub intent_hash: Option<String>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Serialize, Deserialize)]
pub enum SwapDirection {
    Inbound,
    CrossPay,
}
```

### SQLite Schema

```sql
CREATE TABLE swaps (
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
);
```

---

## Backend Commands

### New Tauri Commands (`/src-tauri/src/commands/swap.rs`)

```rust
// Address generation
#[tauri::command]
pub async fn get_swap_receiving_address(
    state: State<'_, AppState>,
    prefer_shielded: bool,
) -> Result<SwapAddress, String>

#[tauri::command]
pub async fn generate_ephemeral_address(
    state: State<'_, AppState>,
) -> Result<String, String>

// CrossPay transaction building
#[tauri::command]
pub async fn prepare_crosspay_transaction(
    state: State<'_, AppState>,
    amount_zatoshi: u64,
    ephemeral_address: String,
) -> Result<PreparedTransaction, String>

#[tauri::command]
pub async fn send_crosspay_transaction(
    state: State<'_, AppState>,
    prepared_tx_id: String,
) -> Result<String, String>

// Auto-shielding
#[tauri::command]
pub async fn shield_transparent_funds(
    state: State<'_, AppState>,
    from_address: String,
) -> Result<String, String>

#[tauri::command]
pub async fn check_transparent_balance(
    state: State<'_, AppState>,
    address: String,
) -> Result<u64, String>

// Swap persistence
#[tauri::command]
pub async fn save_swap(state: State<'_, AppState>, swap: SwapRecord) -> Result<(), String>

#[tauri::command]
pub async fn update_swap_status(
    state: State<'_, AppState>,
    swap_id: String,
    status: String,
    intent_hash: Option<String>,
    txid: Option<String>,
) -> Result<(), String>

#[tauri::command]
pub async fn get_swap_history(state: State<'_, AppState>) -> Result<Vec<SwapRecord>, String>

#[tauri::command]
pub async fn get_active_swaps(state: State<'_, AppState>) -> Result<Vec<SwapRecord>, String>
```

### New Module Structure

```
src-tauri/src/
├── commands/
│   ├── mod.rs          (add swap)
│   ├── wallet.rs
│   ├── transactions.rs
│   └── swap.rs         ← NEW
├── swap/
│   ├── mod.rs          ← NEW
│   ├── models.rs       ← NEW
│   ├── address.rs      ← NEW (ephemeral address derivation)
│   └── db.rs           ← NEW (swap table operations)
```

---

## SwapKit Integration

### Service Layer (`/src/lib/services/swapkit.ts`)

```typescript
import { SwapKitApi } from '@swapkit/sdk'

const swapkit = new SwapKitApi({
  providers: ['NEAR_INTENTS', 'THORCHAIN', 'MAYA', 'CHAINFLIP']
})

export async function getSupportedAssets(): Promise<Asset[]>
export async function getInboundQuotes(fromAsset: string, fromAmount: string, receivingAddress: string): Promise<SwapQuote[]>
export async function getCrossPayQuotes(toAsset: string, toAmount: string, recipientAddress: string): Promise<SwapQuote[]>
export async function executeSwap(quote: SwapQuote, params: ExecuteParams): Promise<{ intentHash: string, depositAddress: string }>
export async function getSwapStatus(intentHash: string): Promise<SwapStatusResponse>
export function detectChain(address: string): string | null
```

### Swap Store (`/src/lib/stores/swap.ts`)

Key actions:
- `fetchInboundQuotes(fromAsset, amount)` - Get quotes for inbound swap
- `startInboundSwap(quote, refundAddress)` - Initiate swap, start polling
- `startCrossPay(toAsset, amount, recipient)` - Build ZEC tx, publish intent
- `startPolling(swapId)` - Poll status every 5 seconds
- `handleSwapComplete(swap)` - Auto-shield if needed, refresh balance
- `resumeActiveSwaps()` - Resume polling on app restart

---

## Error Handling

| Category | Examples | Handling |
|----------|----------|----------|
| Quote Errors | No liquidity, amount too small | Show message, suggest alternatives |
| Network Errors | API down, node unreachable | Retry with backoff, show status |
| Timeout Errors | Quote expired, deposit window passed | Cancel swap, prompt to retry |
| Fulfillment Errors | Solver failed, slippage exceeded | Trigger refund flow |
| Zcash Tx Errors | Insufficient balance, proof failed | Show error, don't publish intent |

### Edge Cases

1. **Quote expires before confirm** - Clear quotes, prompt for new quote
2. **App closes during swap** - Resume polling on startup via `get_active_swaps`
3. **Deposit timeout (inbound)** - After 30 min, mark failed, notify user
4. **Fulfillment timeout (CrossPay)** - Monitor ephemeral for refund, auto-shield
5. **Shielded not supported** - Fallback to ephemeral transparent + auto-shield

### User Notifications

| Event | Type | Message |
|-------|------|---------|
| Quote received | info | "Quote ready: 1 SOL → 42.5 ZEC" |
| Deposit detected | success | "Deposit confirmed! Swap in progress..." |
| Swap complete | success | "Swap complete! 42.5 ZEC added to wallet" |
| Swap failed | error | "Swap failed. Check refund address." |
| CrossPay refunded | warning | "Payment failed. Funds returned." |
| Auto-shield complete | info | "Funds moved to shielded pool" |

---

## Testing Strategy

### Unit Tests

| Component | Tests |
|-----------|-------|
| `swapkit.ts` | Quote normalization, address detection, error mapping |
| `swap.ts` store | State transitions, polling logic, timeout handling |
| `swap/address.rs` | Ephemeral address derivation, index tracking |
| `swap/db.rs` | CRUD operations, status updates, query filters |

### Integration Tests

```rust
#[tokio::test]
async fn test_ephemeral_address_uniqueness()

#[tokio::test]
async fn test_crosspay_tx_building()
```

### E2E Scenarios (Testnet)

| Scenario | Steps | Expected |
|----------|-------|----------|
| Inbound happy path | Quote → Confirm → Deposit → Wait | ZEC arrives, auto-shielded |
| Inbound timeout | Quote → Wait 60s | Quote expires, UI resets |
| CrossPay happy path | Enter SOL addr → Quote → Confirm | Recipient gets SOL |
| CrossPay refund | Start → Solver fails | ZEC returns, auto-shielded |
| App restart | Start swap → Kill → Reopen | Swap resumes |

### Mock Mode

```typescript
// Toggle: USE_MOCK_SWAPKIT=true
export const mockSwapKit = {
  getQuote: async () => [{ quoteHash: 'mock-123', ... }],
  executeSwap: async () => ({ intentHash: 'mock-456', ... }),
  getStatus: async () => ({ status: 'completed' }),
}
```

---

## Implementation Phases

### Phase 1: Foundation
- Add SwapKit SDK dependency
- Create `/src-tauri/src/swap/` module structure
- Add `swaps` table + migration
- Implement `swap` Svelte store skeleton
- Add Swap tab placeholder to BottomNav

### Phase 2: Backend - Address & Transaction
- Ephemeral transparent address derivation
- `get_swap_receiving_address` command
- `generate_ephemeral_address` command
- `prepare_crosspay_transaction` command
- `shield_transparent_funds` command
- Swap CRUD commands

### Phase 3: SwapKit Integration
- Create `/src/lib/services/swapkit.ts` wrapper
- Quote fetching (inbound + CrossPay)
- `executeSwap` and `getSwapStatus`
- Address chain detection
- Mock mode for development

### Phase 4: Inbound Swap UI
- Build `Swap.svelte` route
- `AssetSelector.svelte` component
- `DepositPrompt.svelte` with QR + copy
- Quote display and confirmation
- `SwapStatus.svelte` progress
- Polling and status updates

### Phase 5: CrossPay UI
- Address detection in `Send.svelte`
- `CrossPayPrompt.svelte` component
- CrossPay quote + confirmation flow
- ZEC tx building and broadcasting
- Refund monitoring

### Phase 6: Polish & Edge Cases
- Swap resume on app restart
- `SwapHistory.svelte` component
- Error states with proper UI
- Pending swap indicator on Home
- Timeout and cleanup

### Phase 7: Testing & Hardening
- Unit tests
- Rust integration tests
- E2E testnet swaps
- Error injection testing
- Security review

---

## Future Enhancements (Out of Scope for v1)

- **WalletConnect integration** - Connect external wallets directly in Ikki
- **Recurring swaps** - DCA into ZEC
- **Limit orders** - Execute when price target hit
- **Multi-swap batching** - Combine multiple swaps
- **Fiat on-ramp** - Direct card → ZEC via partner

---

## References

- [NEAR Intents Documentation](https://docs.near.org/chain-abstraction/intents/overview)
- [NEAR Intents API](https://docs.near-intents.org/near-intents/market-makers/bus/solver-relay)
- [SwapKit SDK](https://swapkit.dev/near-intents/)
- [Zashi Swaps Announcement](https://electriccoin.co/blog/zashi-swaps-decentralized-on-ramp-is-live/)
- [open-web-academy/near-intents-zcash](https://github.com/open-web-academy/near-intents-zcash)
