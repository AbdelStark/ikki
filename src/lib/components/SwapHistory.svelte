<script lang="ts">
  import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-svelte";
  import type { SwapRecord } from "../types/swap";

  export let swaps: SwapRecord[] = [];

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: string): string {
    if (status === "completed") return "var(--receive)";
    if (status === "failed") return "var(--error)";
    if (status === "refunded") return "var(--text-secondary)";
    return "var(--text-tertiary)";
  }

  function getStatusLabel(status: string): string {
    return status.replace(/_/g, " ");
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
              {swap.from_asset} → {swap.to_asset}
            </div>
            <div class="swap-date">{formatDate(swap.created_at)}</div>
          </div>
          <div class="swap-amounts">
            <div class="swap-from">-{swap.from_amount} {swap.from_asset}</div>
            <div class="swap-to">+{swap.to_amount} {swap.to_asset}</div>
          </div>
          <div class="swap-status" style="color: {getStatusColor(swap.status)}">
            {getStatusLabel(swap.status)}
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
    overflow: hidden;
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
    transition: background var(--duration-fast) var(--ease-out);
  }

  .swap-item:last-child {
    border-bottom: none;
  }

  .swap-item:hover {
    background: var(--bg-hover);
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
    flex-shrink: 0;
  }

  .swap-icon.inbound {
    color: var(--receive);
  }

  .swap-info {
    flex: 1;
    min-width: 0;
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
    min-width: 0;
  }

  .swap-from {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .swap-to {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--receive);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .swap-status {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    text-transform: capitalize;
    letter-spacing: var(--tracking-wider);
    flex-shrink: 0;
    min-width: fit-content;
    margin-left: var(--space-2);
  }
</style>
