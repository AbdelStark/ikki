<script lang="ts">
  import { ArrowUpRight, Loader2, Check, X } from "lucide-svelte";
  import { formatZec, truncateAddress } from "../utils/format";
  import { pendingTransactions } from "../stores/pendingTransactions";
  import { dismissPendingTransaction } from "../utils/tauri";
  import type { PendingTransaction } from "../utils/tauri";

  export let pendingTx: PendingTransaction;

  $: isBuilding = pendingTx.status === "building";
  $: isBroadcasting = pendingTx.status === "broadcasting";
  $: isBroadcast = pendingTx.status === "broadcast";
  $: isFailed = pendingTx.status === "failed";
  $: isProcessing = isBuilding || isBroadcasting;

  $: statusText = isBuilding
    ? "Building transaction..."
    : isBroadcasting
      ? "Broadcasting..."
      : isBroadcast
        ? "Broadcast"
        : "Failed";

  async function handleDismiss() {
    await dismissPendingTransaction(pendingTx.id);
    pendingTransactions.remove(pendingTx.id);
  }
</script>

<div class="pending-tx-item" class:failed={isFailed} class:broadcast={isBroadcast}>
  <div class="tx-icon">
    {#if isProcessing}
      <Loader2 size={15} strokeWidth={2} class="spin" />
    {:else if isBroadcast}
      <Check size={15} strokeWidth={2.5} />
    {:else if isFailed}
      <X size={15} strokeWidth={2.5} />
    {:else}
      <ArrowUpRight size={15} strokeWidth={2} />
    {/if}
  </div>

  <div class="tx-info">
    <div class="tx-header">
      <span class="tx-label">Sending</span>
      <span class="tx-badge" class:processing={isProcessing} class:success={isBroadcast} class:error={isFailed}>
        {statusText}
      </span>
    </div>
    <span class="tx-subtitle">
      {#if pendingTx.error}
        {pendingTx.error.length > 30 ? pendingTx.error.slice(0, 30) + "..." : pendingTx.error}
      {:else}
        To {truncateAddress(pendingTx.to_address, 6)}
      {/if}
    </span>
  </div>

  <div class="tx-amount-section">
    <span class="tx-amount">-{formatZec(pendingTx.amount)}</span>
    <span class="tx-unit">ZEC</span>
  </div>

  {#if isBroadcast || isFailed}
    <button class="dismiss-btn" onclick={handleDismiss}>
      <X size={14} />
    </button>
  {/if}
</div>

<style>
  .pending-tx-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: transparent;
    width: 100%;
    position: relative;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .pending-tx-item:hover {
    background: var(--bg-hover);
  }

  .tx-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }

  .pending-tx-item.broadcast .tx-icon {
    background: var(--receive-muted);
    color: var(--receive);
    border-color: rgba(52, 211, 153, 0.2);
  }

  .pending-tx-item.failed .tx-icon {
    background: var(--error-muted);
    color: var(--error);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .tx-icon :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .tx-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .tx-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tx-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    letter-spacing: var(--tracking-normal);
  }

  .tx-badge {
    font-size: 9px;
    font-weight: var(--font-semibold);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .tx-badge.processing {
    background: var(--bg-elevated);
    color: var(--text-tertiary);
    border: 1px solid var(--border-subtle);
  }

  .tx-badge.success {
    background: var(--receive-muted);
    color: var(--receive);
  }

  .tx-badge.error {
    background: var(--error-muted);
    color: var(--error);
  }

  .tx-subtitle {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: var(--tracking-wide);
  }

  .pending-tx-item.failed .tx-subtitle {
    color: var(--error);
  }

  .tx-amount-section {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-shrink: 0;
  }

  .tx-amount {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-tight);
    color: var(--text-secondary);
  }

  .tx-unit {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
  }

  .dismiss-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: all var(--duration-fast) var(--ease-out);
    margin-left: var(--space-2);
  }

  .pending-tx-item:hover .dismiss-btn {
    opacity: 1;
  }

  .dismiss-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
</style>
