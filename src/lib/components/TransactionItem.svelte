<script lang="ts">
  import { ArrowUpRight, ArrowDownLeft, Layers, RefreshCw, ChevronRight } from "lucide-svelte";
  import { formatZec, truncateAddress, formatRelativeTime } from "../utils/format";
  import { transaction } from "../stores/transaction";
  import { ui } from "../stores/ui";
  import type { Transaction } from "../utils/tauri";

  export let txid: string;
  export let txType: "sent" | "received" | "shielding" | "internal";
  export let amount: number;
  export let timestamp: number;
  export let address: string | null = null;
  export let memo: string | null = null;
  export let status: "pending" | "confirmed" | "failed" = "confirmed";
  export let confirmations: number = 0;

  const labels = {
    sent: "Sent",
    received: "Received",
    shielding: "Shielded",
    internal: "Internal",
  };

  const icons = {
    sent: ArrowUpRight,
    received: ArrowDownLeft,
    shielding: Layers,
    internal: RefreshCw,
  };

  $: isOutgoing = txType === "sent";
  $: displayAmount = Math.abs(amount);
  $: subtitle = address
    ? truncateAddress(address, 6)
    : memo
      ? memo.length > 20
        ? memo.slice(0, 20) + "..."
        : memo
      : formatRelativeTime(timestamp);

  $: IconComponent = icons[txType];

  function handleClick() {
    const tx: Transaction = {
      txid,
      tx_type: txType,
      amount,
      timestamp,
      address,
      memo,
      status,
      confirmations,
    };
    transaction.select(tx);
    ui.navigate("transaction-detail");
  }
</script>

<button class="transaction-item" class:pending={status === "pending"} onclick={handleClick}>
  <div class="tx-icon" class:outgoing={isOutgoing} class:incoming={!isOutgoing}>
    <svelte:component this={IconComponent} size={16} strokeWidth={2} />
  </div>

  <div class="tx-info">
    <div class="tx-header">
      <span class="tx-label">{labels[txType]}</span>
      {#if status === "pending"}
        <span class="tx-badge pending">Pending</span>
      {:else if status === "failed"}
        <span class="tx-badge failed">Failed</span>
      {/if}
    </div>
    <span class="tx-subtitle">{subtitle}</span>
  </div>

  <div class="tx-amount-section">
    <span class="tx-amount" class:outgoing={isOutgoing} class:incoming={!isOutgoing}>
      {isOutgoing ? "-" : "+"}{formatZec(displayAmount)}
    </span>
    <span class="tx-unit">ZEC</span>
  </div>

  <div class="tx-chevron">
    <ChevronRight size={16} strokeWidth={1.5} />
  </div>
</button>

<style>
  .transaction-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    min-height: 64px;
    background: transparent;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    transition:
      background var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .transaction-item:hover {
    background: var(--bg-hover);
  }

  .transaction-item:active {
    background: var(--bg-active);
    transform: scale(0.99);
  }

  .transaction-item.pending {
    opacity: 0.65;
  }

  /* Icon container */
  .tx-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    transition:
      transform var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .transaction-item:hover .tx-icon {
    transform: scale(1.04);
  }

  .tx-icon.outgoing {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .tx-icon.incoming {
    background: linear-gradient(
      135deg,
      rgba(228, 228, 231, 0.08) 0%,
      rgba(228, 228, 231, 0.04) 100%
    );
    border: 1px solid rgba(228, 228, 231, 0.1);
    color: var(--text-primary);
  }

  /* Transaction info */
  .tx-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
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
    font-size: var(--text-2xs);
    font-weight: var(--font-semibold);
    padding: var(--space-0-5) var(--space-1-5);
    border-radius: var(--radius-xs);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .tx-badge.pending {
    background: var(--bg-elevated);
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    animation: pulse 2s ease-in-out infinite;
  }

  .tx-badge.failed {
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

  /* Amount display */
  .tx-amount-section {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .tx-amount {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-tight);
  }

  .tx-amount.outgoing {
    color: var(--text-secondary);
  }

  .tx-amount.incoming {
    color: var(--text-primary);
  }

  .tx-unit {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    letter-spacing: var(--tracking-wide);
  }

  /* Chevron indicator */
  .tx-chevron {
    color: var(--text-muted);
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
    margin-left: var(--space-1);
  }

  .transaction-item:hover .tx-chevron {
    opacity: 0.6;
    transform: translateX(0);
  }
</style>
