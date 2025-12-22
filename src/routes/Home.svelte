<script lang="ts">
  import { Settings, RefreshCw } from "lucide-svelte";
  import { wallet, balance, address } from "../lib/stores/wallet";
  import { sync, isSyncing, syncProgress } from "../lib/stores/sync";
  import { ui } from "../lib/stores/ui";
  import { transactions, transactionsLoaded } from "../lib/stores/transactions";
  import { totalPendingAmount } from "../lib/stores/pendingTransactions";
  import { startBackgroundSync, getSyncStatus, getBalance } from "../lib/utils/tauri";
  import AccountCard from "../lib/components/AccountCard.svelte";
  import ActionButton from "../lib/components/ActionButton.svelte";
  import TransactionItem from "../lib/components/TransactionItem.svelte";
  import PriceSparkline from "../lib/components/PriceSparkline.svelte";

  // Use global transactions store
  $: recentTransactions = $transactions;
  $: loading = !$transactionsLoaded;

  let syncPollInterval: ReturnType<typeof setInterval> | null = null;

  async function handleSync() {
    if ($isSyncing) return;

    try {
      sync.startSync(false);
      await startBackgroundSync(false);
      pollSyncStatus();
    } catch (e) {
      sync.setError(String(e));
      ui.showToast(`Failed to start sync: ${e}`, "error");
    }
  }

  function pollSyncStatus() {
    if (syncPollInterval) clearInterval(syncPollInterval);

    syncPollInterval = setInterval(async () => {
      try {
        const status = await getSyncStatus();

        if (status.is_syncing) {
          sync.updateProgress({
            currentBlock: status.current_block,
            targetBlock: status.target_block,
            percentage: status.percentage,
            isFirstSync: status.is_first_sync,
            status: status.percentage > 0 ? "Syncing..." : "Connecting...",
          });
        } else {
          if (syncPollInterval) clearInterval(syncPollInterval);
          syncPollInterval = null;

          try {
            const newBalance = await getBalance();
            wallet.updateBalance(newBalance);
          } catch (e) {
            console.error("Failed to fetch balance after sync:", e);
          }

          sync.completeSync();
          ui.showToast("Wallet synced", "success");
        }
      } catch (e) {
        console.error("Failed to poll sync status:", e);
        if (syncPollInterval) clearInterval(syncPollInterval);
        syncPollInterval = null;
      }
    }, 500);

    setTimeout(() => {
      if (syncPollInterval) {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
      }
    }, 300000);
  }
</script>

<div class="home noise-overlay">
  <header class="home-header">
    <div class="header-spacer"></div>
    <span class="header-title">ikki</span>
    <div class="header-actions">
      <button
        class="header-btn"
        class:syncing={$isSyncing}
        onclick={handleSync}
        disabled={$isSyncing}
        aria-label="Sync wallet"
      >
        <RefreshCw size={18} strokeWidth={1.5} />
      </button>
      <button class="header-btn" onclick={() => ui.navigate("settings")} aria-label="Settings">
        <Settings size={18} strokeWidth={1.5} />
      </button>
    </div>
  </header>

  <div class="home-content">
    <div class="animate-card">
      <AccountCard
        balance={$balance}
        address={$address}
        syncing={$isSyncing ?? false}
        pendingAmount={$totalPendingAmount}
      />
    </div>

    <div class="animate-price">
      <PriceSparkline />
    </div>

    <div class="actions animate-actions">
      <ActionButton variant="send" onclick={() => ui.navigate("send")} />
      <ActionButton variant="receive" onclick={() => ui.navigate("receive")} />
      <ActionButton variant="buy" disabled />
      <ActionButton variant="swap" disabled />
    </div>

    <section class="recent-section animate-section">
      <div class="section-header">
        <h3>Recent Activity</h3>
        {#if recentTransactions.length > 0}
          <button class="see-all" onclick={() => ui.navigate("history")}>
            See all
          </button>
        {/if}
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="skeleton-list">
            {#each [1, 2, 3] as _}
              <div class="skeleton-item">
                <div class="skeleton skeleton-icon"></div>
                <div class="skeleton-content">
                  <div class="skeleton skeleton-title"></div>
                  <div class="skeleton skeleton-subtitle"></div>
                </div>
                <div class="skeleton skeleton-amount"></div>
              </div>
            {/each}
          </div>
        </div>
      {:else if recentTransactions.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <p class="empty-title">No transactions yet</p>
          <p class="empty-subtitle">Your activity will appear here</p>
        </div>
      {:else}
        <div class="transaction-list">
          {#each recentTransactions.slice(0, 5) as tx}
            <TransactionItem
              txid={tx.txid}
              txType={tx.tx_type}
              amount={tx.amount}
              timestamp={tx.timestamp}
              address={tx.address}
              memo={tx.memo}
              status={tx.status}
              confirmations={tx.confirmations}
            />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .home {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      180deg,
      var(--bg-primary) 0%,
      rgba(8, 8, 10, 1) 100%
    );
  }

  /* Staggered entrance animations */
  .animate-card {
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.05s;
    opacity: 0;
  }

  .animate-price {
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.12s;
    opacity: 0;
  }

  .animate-actions {
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.18s;
    opacity: 0;
  }

  .animate-section {
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.25s;
    opacity: 0;
  }

  .home-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    max-width: var(--max-width);
    width: 100%;
    margin: 0 auto;
  }

  .header-spacer {
    width: 72px;
  }

  .header-title {
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--text-secondary);
    letter-spacing: 0.08em;
    text-transform: lowercase;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .header-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .header-btn:hover:not(:disabled) {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .header-btn:active:not(:disabled) {
    transform: scale(0.9);
    background: rgba(255, 255, 255, 0.06);
  }

  .header-btn:disabled {
    cursor: default;
  }

  .header-btn.syncing {
    color: var(--text-secondary);
  }

  .header-btn.syncing :global(svg) {
    animation: spin 1s linear infinite;
  }

  .home-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 var(--space-5) var(--space-6);
    width: 100%;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
  }

  .recent-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-2);
  }

  .section-header h3 {
    font-size: 10px;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .see-all {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: var(--radius-full);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: 0.02em;
  }

  .see-all:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  .see-all:active {
    transform: scale(0.95);
  }

  .transaction-list {
    background: linear-gradient(
      180deg,
      rgba(15, 15, 17, 0.6) 0%,
      rgba(12, 12, 14, 0.8) 100%
    );
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.04);
    overflow: hidden;
    position: relative;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .transaction-list::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.08),
      transparent
    );
    pointer-events: none;
  }

  .transaction-list > :global(*:not(:last-child)) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .loading-state {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .skeleton-list {
    padding: var(--space-1);
  }

  .skeleton-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      var(--bg-elevated) 0%,
      var(--bg-hover) 50%,
      var(--bg-elevated) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }

  .skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-title {
    height: 12px;
    width: 64px;
  }

  .skeleton-subtitle {
    height: 10px;
    width: 88px;
  }

  .skeleton-amount {
    width: 56px;
    height: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-14) var(--space-4);
    text-align: center;
    background: linear-gradient(
      180deg,
      rgba(15, 15, 17, 0.5) 0%,
      rgba(12, 12, 14, 0.7) 100%
    );
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
    opacity: 0.25;
    animation: softPulse 3s ease-in-out infinite;
  }

  .empty-title {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
    letter-spacing: -0.01em;
  }

  .empty-subtitle {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
</style>
