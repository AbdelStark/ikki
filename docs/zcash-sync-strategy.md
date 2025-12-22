# Zcash Wallet Synchronization Strategy

This document outlines a synchronization approach for a Zcash light client that maximizes responsiveness and user experience while respecting bandwidth and storage constraints. The strategy assumes use of a lightwalletd-compatible backend and targets mobile and desktop clients.

## Goals
- **Fast start and catch-up:** Minimize time to first balance and transaction visibility for new or returning users.
- **Low resource footprint:** Constrain bandwidth, storage, and battery/CPU usage, especially on mobile.
- **Reactive UX:** Surface incoming payments quickly and reflect outgoing transaction states clearly.
- **Robustness:** Tolerate network interruptions, reorgs, and backend variance without losing correctness.

## Architectural Principles
- **Light client with compact blocks:** Consume compact blocks and relevant transactions via lightwalletd to avoid full node storage and heavy bandwidth.
- **Birthday/block-height checkpoint:** Anchor the wallet at a chosen block height (user birthday, seed derivation height, or a shipped checkpoint) to cap historical scanning.
- **Partitioned scanning:** Process blocks in small batches with resumable cursors to avoid long pauses and enable UI interleaving.
- **Selective trial decryption:** Decrypt only the Orchard/Sapling outputs in relevant ranges and skip transparent outputs unless explicitly needed.
- **Event-driven updates:** Use a streaming or poll-based notification channel for new compact blocks and mempool activity to keep the UI reactive.

## Sync Pipeline
1. **Initialization**
   - Load persisted tree states (note commitment tree/witnesses), nullifier sets, and the last fully-scanned height.
   - Validate backend chain tip freshness; if stale beyond a threshold, warn the user and back off.
2. **Checkpointed catch-up**
   - Start from the wallet birthday or last scanned height.
   - Pull compact blocks in bounded batches (e.g., 2k–5k blocks) to balance latency vs. request overhead.
   - Persist progress after each batch: last height, updated witnesses, nullifiers, scanned note metadata.
   - Use incremental Merkle tree updates to avoid recomputing from genesis.
3. **Note detection and trial decryption**
   - For each block, attempt trial decryption only on Orchard and Sapling outputs; skip transparent until a transparent address is actually used.
   - Cache derived keys/view keys to avoid repeated key derivations during scanning.
4. **Witness maintenance**
   - Maintain rolling witnesses for each spendable note; prune witnesses for spent/expired notes.
   - Persist witness checkpoints every N blocks to enable faster resume without replaying the whole batch.
5. **Nullifier tracking**
   - Track spent nullifiers as observed in blocks and compare against locally created transactions to update statuses.
6. **Outgoing transaction pipeline**
   - Construct transactions using the latest available witnesses; if sync lags, gate send with a “syncing” warning.
   - Broadcast via lightwalletd, then enter a pending pool with states: *broadcasted*, *in mempool*, *mined*, *reorged*.
7. **Foreground/reactive mode**
   - While the app is active, subscribe to compact block streams or poll frequently (e.g., every 5–10s) for new blocks.
   - On new blocks, run a mini-scan (small batch) to surface incoming payments quickly.
8. **Background/low-power mode**
   - Reduce polling frequency; rely on push notifications from a trusted service (optional) to wake for new blocks.
   - Schedule periodic maintenance syncs respecting platform background limits.

## Pending Transaction Handling
- **State machine:**
  - *broadcasted* → received ack from backend.
  - *in mempool* → observed in mempool/seen-in-broadcast response.
  - *mined* → transaction hash found in a block; update notes and clear from pending.
  - *reorged* → mined but lost in a reorg; return to mempool check and refresh witnesses.
- **UI feedback:** Show confirmations as block counts and clarify when a transaction is awaiting network inclusion.
- **Expiry handling:** Detect transaction expiry heights; if surpassed without inclusion, mark as expired and allow rebuild/rebroadcast.
- **Fee/priority:** Estimate fees based on recent mempool acceptance; if congestion detected, propose higher fee or delayed send.

## Reactivity for Incoming Payments
- **Fast path scan:** After each new block, run trial decryption only for that block (or small windows) before full batching.
- **Notification hooks:** Emit local events to update balances and history immediately after a matching note is detected.
- **Shielded-first UX:** Prefer shielded addresses to avoid transparent change tracking and to reduce scanning burden.

## Bandwidth and Storage Optimizations
- **Compact block batching with compression:** Request gzipped batches; enforce upper byte limits per request to avoid mobile spikes.
- **Memo/transaction caching:** Store only decrypted note metadata, memos, and minimal transaction context; avoid retaining full transaction data.
- **Pruning:**
  - Drop witnesses for spent/expired notes.
  - Periodically consolidate caches and vacuum storage to keep footprint bounded.
- **Lazy downloads:** Fetch full transaction details only when the user inspects a specific transaction or memo.

## Robustness Measures
- **Reorg tolerance:**
  - Keep a reorg buffer (e.g., 100 blocks). If the best tip hash changes, rescan from `tip - buffer`.
  - Snapshots of tree states within the buffer allow quick rollback/forward.
- **Backend diversity:** Allow multiple lightwalletd endpoints with health-scoring and failover.
- **Integrity checks:**
  - Verify block commitments and chainwork reported by backend.
  - Validate Orchard/Sapling anchors against expected checkpoints.
- **Crash safety:** Use transactional persistence (e.g., SQLite WAL) so partial batch failures can resume cleanly.

## UX Considerations
- **Progress visibility:** Show "syncing from block X of Y" with estimated time and a fast-lane indicator when using a checkpoint.
- **Non-blocking UI:** Keep navigation and history browsing available during sync; mark entries as "pending verification" until scanned.
- **Send gating:** If the wallet is significantly behind, warn users and optionally disable sending until a safe height is reached.
- **Pull-to-refresh:** Allow users to trigger an immediate mini-sync to reassure them when waiting for funds.

## Operational Settings (suggested defaults)
- Batch size: 2,000–5,000 blocks during catch-up; 1–10 blocks in reactive mode.
- Reorg buffer: 100 blocks.
- Background poll: every 10–15 minutes (platform-permitting); foreground poll: every 5–10 seconds.
- Storage budget target: <150 MB for metadata on a one-year-old wallet; prune aggressively beyond that.
- Backoff: exponential backoff on request failures up to 2 minutes, with UI hints when degraded.

## Implementation Checklist
- [ ] Persisted state: last scanned height, witnesses, nullifiers, note metadata, pending tx pool.
- [ ] Batch scanner with resumable cursors and periodic checkpoints.
- [ ] Fast-path single-block scan for new blocks.
- [ ] Reorg detection and rollback using buffered checkpoints.
- [ ] Pending transaction state machine with expiry handling and UI bindings.
- [ ] Configurable polling/streaming strategy for foreground/background modes.
- [ ] Storage pruning jobs and lazy fetches for memo/transaction bodies.
- [ ] Multi-endpoint health and failover for lightwalletd.
