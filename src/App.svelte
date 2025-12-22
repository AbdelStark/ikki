<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ui, currentView, needsOnboarding, toasts } from "./lib/stores/ui";
  import { wallet } from "./lib/stores/wallet";
  import { sync, isInitialSyncComplete, isSyncing as isSyncingStore, isFirstSync } from "./lib/stores/sync";
  import { pendingTransactions, hasActivePending } from "./lib/stores/pendingTransactions";
  import { transactionsStore } from "./lib/stores/transactions";
  import { pricing } from "./lib/stores/pricing";
  import {
    checkWalletExists,
    autoLoadWallet,
    startBackgroundSync,
    getSyncStatus,
    getBalance,
    getPendingTransactions,
    dismissPendingTransaction,
    getTransactions,
  } from "./lib/utils/tauri";

  // Views
  import Home from "./routes/Home.svelte";
  import Send from "./routes/Send.svelte";
  import Receive from "./routes/Receive.svelte";
  import History from "./routes/History.svelte";
  import Settings from "./routes/Settings.svelte";
  import Contacts from "./routes/Contacts.svelte";
  import Onboarding from "./routes/Onboarding.svelte";
  import TransactionDetail from "./routes/TransactionDetail.svelte";
  import Swap from "./routes/Swap.svelte";
  import Price from "./routes/Price.svelte";

  // Components
  import Toast from "./lib/components/Toast.svelte";
  import InitialSync from "./lib/components/InitialSync.svelte";
  import SyncIndicator from "./lib/components/SyncIndicator.svelte";

  let loading = true;
  let showInitialSync = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pendingTxPollInterval: ReturnType<typeof setInterval> | null = null;
  let confirmationPollInterval: ReturnType<typeof setInterval> | null = null;
  // Track which transactions we've already shown completion toasts for
  let acknowledgedTxIds = new Set<string>();
  // Track txids waiting for confirmation (broadcast but not yet mined)
  let awaitingConfirmation = new Map<string, { txid: string; amount: number }>();
  // Track if sync is in initial phase for post-sync actions
  let currentSyncIsInitial = false;

  // Load transactions into global store
  async function refreshTransactions() {
    try {
      const txs = await getTransactions();
      transactionsStore.setTransactions(txs);
    } catch (e) {
      console.error("Failed to load transactions:", e);
      transactionsStore.setError(String(e));
    }
  }

  // Handle wallet ready from onboarding - trigger initial sync
  async function handleWalletReady() {
    showInitialSync = true;
    ui.setNeedsOnboarding(false);
    currentSyncIsInitial = true;

    // Start the initial sync
    try {
      sync.startSync(true);
      await startBackgroundSync(true);
      // Start fallback polling (reduced frequency since events handle updates)
      startPolling(true);
    } catch (e) {
      console.error("Failed to start initial sync:", e);
      sync.setError(String(e));
      ui.showToast(`Failed to start sync: ${e}`, "error");
    }
  }

  // Handle sync completion (called from event listener or polling)
  async function handleSyncComplete(isInitial: boolean) {
    stopPolling();

    try {
      const balance = await getBalance();
      wallet.updateBalance(balance);
    } catch (e) {
      console.error("Failed to fetch balance after sync:", e);
    }

    // Refresh transactions after sync
    await refreshTransactions();

    sync.completeSync();

    if (isInitial) {
      // Wait a moment to show 100% then dismiss
      setTimeout(() => {
        showInitialSync = false;
        currentSyncIsInitial = false;
      }, 1500);
    } else {
      ui.showToast("Wallet synced", "success");
    }
  }

  // Fallback polling for sync status (reduced frequency - events are primary)
  // Polling interval: 2s normally, 500ms during initial sync for responsiveness
  function startPolling(isInitial: boolean) {
    if (pollInterval) clearInterval(pollInterval);

    const pollIntervalMs = isInitial ? 500 : 2000;

    pollInterval = setInterval(async () => {
      try {
        const status = await getSyncStatus();

        // Update progress (events may already handle this, but poll as fallback)
        if (status.is_syncing) {
          sync.updateProgress({
            currentBlock: status.current_block,
            targetBlock: status.target_block,
            percentage: status.percentage,
            isFirstSync: status.is_first_sync,
            status: status.percentage > 0 ? "Syncing..." : "Connecting to network...",
          });
        } else {
          // Sync completed
          await handleSyncComplete(currentSyncIsInitial);
        }
      } catch (e) {
        console.error("Failed to poll sync status:", e);
      }
    }, pollIntervalMs);

    // Safety timeout - stop polling after 10 minutes
    setTimeout(() => stopPolling(), 600000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Poll for pending transaction status updates
  function startPendingTxPolling() {
    if (pendingTxPollInterval) return;

    pendingTxPollInterval = setInterval(async () => {
      try {
        const pending = await getPendingTransactions();
        pendingTransactions.setAll(pending);

        // Handle completed transactions (broadcast or failed)
        for (const tx of pending) {
          if ((tx.status === "broadcast" || tx.status === "failed") && !acknowledgedTxIds.has(tx.id)) {
            // Mark as acknowledged so we don't show toast again
            acknowledgedTxIds.add(tx.id);

            // Show toast once
            if (tx.status === "broadcast") {
              ui.showToast("Transaction broadcast successfully", "success");
              // Refresh balance and transactions after successful broadcast
              try {
                const balance = await getBalance();
                wallet.updateBalance(balance);
                await refreshTransactions();

                // Track this transaction for confirmation polling
                if (tx.txid) {
                  awaitingConfirmation.set(tx.id, { txid: tx.txid, amount: tx.amount });
                  startConfirmationPolling();
                }

                // Trigger a background sync to ensure wallet state is fully updated
                // This helps catch the transaction confirmation and update final balance
                currentSyncIsInitial = false;
                sync.startSync(false);
                await startBackgroundSync(false);
                startPolling(false);
              } catch (e) {
                console.error("Failed to refresh after broadcast:", e);
              }
            } else if (tx.status === "failed") {
              ui.showToast(`Transaction failed: ${tx.error || "Unknown error"}`, "error");
            }

            // Auto-remove completed transactions after 5 seconds
            const txId = tx.id;
            setTimeout(async () => {
              try {
                await dismissPendingTransaction(txId);
                pendingTransactions.remove(txId);
              } catch (e) {
                console.error("Failed to dismiss transaction:", e);
              }
            }, 5000);
          }
        }

        // Stop polling if no active pending transactions
        const hasActive = pending.some(tx =>
          tx.status === "building" || tx.status === "broadcasting"
        );
        if (!hasActive && pending.length === 0) {
          stopPendingTxPolling();
        }
      } catch (e) {
        console.error("Failed to poll pending transactions:", e);
      }
    }, 1000); // Poll every second for responsive updates
  }

  function stopPendingTxPolling() {
    if (pendingTxPollInterval) {
      clearInterval(pendingTxPollInterval);
      pendingTxPollInterval = null;
    }
  }

  // Start polling for transaction confirmations
  // This runs periodic syncs until all awaited transactions are confirmed
  function startConfirmationPolling() {
    if (confirmationPollInterval) return;

    // Initial delay before first check (give time for tx to be mined)
    const INITIAL_DELAY = 30000; // 30 seconds
    const POLL_INTERVAL = 60000; // 60 seconds between syncs

    let initialDelayPassed = false;

    confirmationPollInterval = setInterval(async () => {
      // Skip if no transactions awaiting confirmation
      if (awaitingConfirmation.size === 0) {
        stopConfirmationPolling();
        return;
      }

      // Wait for initial delay before first sync
      if (!initialDelayPassed) {
        initialDelayPassed = true;
        return;
      }

      // Skip if already syncing
      if ($isSyncingStore) return;

      try {
        // Trigger a background sync
        currentSyncIsInitial = false;
        sync.startSync(false);
        await startBackgroundSync(false);

        // After sync, check if any awaited transactions are now confirmed
        await refreshTransactions();

        const txs = $transactionsStore.transactions;
        for (const [pendingId, { txid, amount }] of awaitingConfirmation.entries()) {
          const confirmedTx = txs.find(t => t.txid === txid && t.confirmations > 0);
          if (confirmedTx) {
            // Transaction is confirmed!
            awaitingConfirmation.delete(pendingId);
            ui.showToast(`Transaction confirmed (${confirmedTx.confirmations} conf)`, "success");

            // Refresh balance
            try {
              const balance = await getBalance();
              wallet.updateBalance(balance);
            } catch (e) {
              console.error("Failed to refresh balance after confirmation:", e);
            }
          }
        }

        // Stop polling if all transactions confirmed
        if (awaitingConfirmation.size === 0) {
          stopConfirmationPolling();
        }
      } catch (e) {
        console.error("Failed to check transaction confirmations:", e);
      }
    }, POLL_INTERVAL);

    // Also do an immediate check after the initial delay
    setTimeout(async () => {
      if (awaitingConfirmation.size === 0) return;

      try {
        currentSyncIsInitial = false;
        sync.startSync(false);
        await startBackgroundSync(false);
      } catch (e) {
        console.error("Failed to start initial confirmation sync:", e);
      }
    }, INITIAL_DELAY);
  }

  function stopConfirmationPolling() {
    if (confirmationPollInterval) {
      clearInterval(confirmationPollInterval);
      confirmationPollInterval = null;
    }
  }

  onMount(async () => {
    // Setup sync event listeners for reactive updates
    await sync.setupEventListeners();

    pricing.start();
    try {
      const exists = await checkWalletExists();
      if (exists) {
        // Try to auto-load the wallet
        const walletInfo = await autoLoadWallet();
        if (walletInfo) {
          wallet.setInfo({
            address: walletInfo.address,
            balance: {
              total: walletInfo.balance.total,
              shielded: walletInfo.balance.shielded,
              transparent: walletInfo.balance.transparent,
            },
            blockHeight: walletInfo.block_height,
          });
          ui.setNeedsOnboarding(false);
          // Mark initial sync as complete for existing wallets
          sync.setInitialSyncComplete(true);

          // Load transactions into global store
          await refreshTransactions();

          // Load any pending transactions from backend
          try {
            const pending = await getPendingTransactions();
            if (pending.length > 0) {
              pendingTransactions.setAll(pending);
              startPendingTxPolling();
            }
          } catch (e) {
            console.error("Failed to load pending transactions:", e);
          }
        } else {
          // Config exists but couldn't load - show onboarding
          ui.setNeedsOnboarding(true);
        }
      } else {
        ui.setNeedsOnboarding(true);
      }
    } catch (e) {
      console.error("Failed to load wallet:", e);
      ui.setNeedsOnboarding(true);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    stopPolling();
    stopPendingTxPolling();
    stopConfirmationPolling();
    sync.cleanupEventListeners();
    pricing.stop();
  });

  // Start polling when pending transactions are added
  $: if ($hasActivePending && !pendingTxPollInterval) {
    startPendingTxPolling();
  }

  // Show sync indicator when background syncing (not first sync)
  $: showSyncIndicator = $isSyncingStore && !$isFirstSync && !showInitialSync;
</script>

<main class="app">
  {#if loading}
    <div class="loading-screen">
      <div class="loading-logo">
        <span class="logo-text">ikki</span>
      </div>
      <div class="loading-spinner"></div>
    </div>
  {:else if $needsOnboarding}
    <Onboarding onWalletReady={handleWalletReady} />
  {:else if showInitialSync}
    <InitialSync />
  {:else}
    <div class="app-content">
      {#if $currentView === "home"}
        <Home />
      {:else if $currentView === "send"}
        <Send />
      {:else if $currentView === "receive"}
        <Receive />
      {:else if $currentView === "history"}
        <History />
      {:else if $currentView === "settings"}
        <Settings />
      {:else if $currentView === "contacts"}
        <Contacts />
      {:else if $currentView === "transaction-detail"}
        <TransactionDetail />
      {:else if $currentView === "swap"}
        <Swap />
      {:else if $currentView === "price"}
        <Price />
      {/if}
    </div>

    <!-- Background Sync Indicator -->
    {#if showSyncIndicator}
      <div class="sync-indicator-container">
        <SyncIndicator />
      </div>
    {/if}
  {/if}

  <!-- Toasts -->
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</main>

<style>
  .app {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    position: relative;
  }

  .loading-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    animation: fadeIn var(--duration-normal) var(--ease-out);
  }

  .loading-logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-text {
    font-size: 3rem;
    font-weight: var(--font-bold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tighter);
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border);
    border-top-color: var(--text-primary);
    border-radius: var(--radius-full);
    animation: spin 0.9s linear infinite;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
  }

  .toast-container {
    position: fixed;
    bottom: var(--space-6);
    left: var(--space-4);
    right: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    z-index: 1000;
    pointer-events: none;
    max-width: var(--max-width);
    margin: 0 auto;
  }

  .toast-container > :global(*) {
    pointer-events: auto;
  }

  .sync-indicator-container {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    right: var(--space-4);
    max-width: var(--max-width);
    margin: 0 auto;
    z-index: 100;
    animation: fadeInDown var(--duration-normal) var(--ease-out);
  }
</style>
