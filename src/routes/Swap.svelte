<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-svelte";
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
  import {
    getSupportedAssets,
    getInboundQuotes,
    getCrossPayQuotes,
    executeSwap,
    getSwapStatus,
  } from "../lib/services/near-intents";
  import type { SwapDirection } from "../lib/types/swap";
  import {
    getSwapReceivingAddress,
    sendTransactionBackground,
    getPendingTransaction,
    updateSwapStatus,
    saveSwap,
  } from "../lib/utils/tauri";
  import type { Asset, ActiveSwap, SwapRecord } from "../lib/types/swap";
  import AssetSelector from "../lib/components/AssetSelector.svelte";
  import DepositPrompt from "../lib/components/DepositPrompt.svelte";
  import SwapStatus from "../lib/components/SwapStatus.svelte";
  import Button from "../lib/components/Button.svelte";
  import Input from "../lib/components/Input.svelte";

  // Convert ZEC amount (string) to zatoshis (integer)
  function zecToZatoshis(zec: string): number {
    const parsed = parseFloat(zec);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100_000_000);
  }

  // Poll for pending transaction completion
  async function waitForTxBroadcast(pendingId: string, maxAttempts = 60): Promise<{ txid: string | null; error: string | null }> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second between polls
      const pending = await getPendingTransaction(pendingId);

      if (!pending) {
        return { txid: null, error: "Transaction not found" };
      }

      if (pending.status === "broadcast" && pending.txid) {
        return { txid: pending.txid, error: null };
      }

      if (pending.status === "failed") {
        return { txid: null, error: pending.error || "Transaction failed" };
      }
    }
    return { txid: null, error: "Transaction timed out" };
  }

  // Check if we're in mock mode
  const isMockMode = import.meta.env.VITE_USE_MOCK_NEAR_INTENTS !== 'false' || !import.meta.env.VITE_NEAR_INTENTS_API_KEY;

  // Polling state
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let isPolling = false;
  let lastPolledStatus = '';

  // Map API status to our SwapStatus type
  function mapApiStatusToSwapStatus(apiStatus: string, direction: SwapDirection): import("../lib/types/swap").SwapStatus {
    const statusMap: Record<string, import("../lib/types/swap").SwapStatus> = {
      'PENDING': direction === 'inbound' ? 'awaiting_deposit' : 'broadcasting_zec',
      'CONFIRMING': 'deposit_detected',
      'SWAPPING': 'fulfilling',
      'COMPLETING': 'fulfilling',
      'COMPLETED': 'completed',
      'REFUNDED': 'refunded',
      'FAILED': 'failed',
    };
    return statusMap[apiStatus] || 'awaiting_deposit';
  }

  // Start polling for swap status
  async function startStatusPolling(depositAddress: string, swapId: string, swapDirection: SwapDirection) {
    if (isPolling) return;
    isPolling = true;
    lastPolledStatus = '';

    console.log('Starting status polling for deposit address:', depositAddress);

    pollingInterval = setInterval(async () => {
      try {
        const status = await getSwapStatus(depositAddress);
        console.log('Poll result:', status);

        // Only process if status changed
        if (status.status === lastPolledStatus) return;

        const previousStatus = lastPolledStatus;
        lastPolledStatus = status.status;

        const mappedStatus = mapApiStatusToSwapStatus(status.status, swapDirection);

        // Update the swap store
        swap.updateSwapStatus(mappedStatus);

        // Update database
        await updateSwapStatus(
          swapId,
          mappedStatus,
          undefined,
          status.txHash
        );

        // Handle terminal states
        if (status.status === 'COMPLETED') {
          ui.showToast('Swap completed successfully!', 'success');
          stopStatusPolling();
        } else if (status.status === 'FAILED') {
          ui.showToast('Swap failed', 'error');
          stopStatusPolling();
        } else if (status.status === 'REFUNDED') {
          ui.showToast('Swap was refunded', 'info');
          stopStatusPolling();
        } else if (status.status === 'CONFIRMING' && previousStatus !== 'CONFIRMING') {
          // Show deposit detected toast only once
          ui.showToast('Deposit detected! Processing...', 'info');
        } else if (status.status === 'SWAPPING' && previousStatus !== 'SWAPPING') {
          ui.showToast('Swap in progress...', 'info');
        }
      } catch (error) {
        console.error('Status polling error:', error);
        // Don't stop polling on transient errors
      }
    }, 5000); // Poll every 5 seconds
  }

  // Stop polling
  function stopStatusPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    isPolling = false;
  }

  // Cleanup on component destroy
  onDestroy(() => {
    stopStatusPolling();
  });

  // Form state
  let direction: SwapDirection = "inbound"; // inbound = external→ZEC, crosspay = ZEC→external
  let selectedAsset: Asset | null = null;
  let amount = "";
  let amountError = "";
  let refundAddress = ""; // Source chain refund (external chain for inbound, ZEC for outbound)
  let destinationAddress = ""; // For outbound: where to receive external asset
  let phase: "input" | "quote" | "deposit" | "status" = "input";
  let confirmLoading = false;

  // ZEC asset constant
  const ZEC_ASSET: Asset = {
    chain: "ZEC",
    symbol: "ZEC",
    identifier: "ZEC.ZEC",
    name: "Zcash",
    decimals: 8,
  };

  // Amount validation
  function validateAmount(value: string): string {
    if (!value) return "";

    // Check if it's a valid number
    if (!/^\d*\.?\d*$/.test(value)) {
      return "Please enter a valid number";
    }

    const num = parseFloat(value);
    if (isNaN(num)) return "Please enter a valid number";
    if (num <= 0) return "Amount must be greater than 0";
    if (num < 0.0001) return "Amount too small (min: 0.0001)";

    return "";
  }

  function handleAmountInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    // Only allow digits and one decimal point
    const cleaned = target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    amount = cleaned;
    amountError = validateAmount(cleaned);
  }

  onMount(async () => {
    // Load supported assets
    const assets = await getSupportedAssets();
    swap.setSupportedAssets(assets);
  });

  async function fetchQuotes() {
    if (!selectedAsset || !amount) return;

    // Validate amount before fetching
    const error = validateAmount(amount);
    if (error) {
      amountError = error;
      return;
    }

    // For outbound, destination address is required
    if (direction === "crosspay" && !destinationAddress) {
      ui.showToast("Please enter a destination address", "error");
      return;
    }

    swap.setQuotesLoading(true);
    try {
      let fetchedQuotes;
      if (direction === "inbound") {
        // External asset → ZEC
        // NEAR Intents only supports transparent addresses (t1...) for now, not unified addresses
        const address = await getSwapReceivingAddress(false);
        fetchedQuotes = await getInboundQuotes(
          selectedAsset.identifier,
          amount,
          address.address,
          selectedAsset.defuseAssetId,
          refundAddress, // Source chain refund address (e.g., ETH address for USDC swaps)
          selectedAsset.decimals // Pass decimals for unit conversion
        );
      } else {
        // ZEC → External asset (CrossPay)
        const zecAddress = await getSwapReceivingAddress(true);
        fetchedQuotes = await getCrossPayQuotes(
          selectedAsset.identifier,
          amount,
          destinationAddress,
          zecAddress.address,
          selectedAsset.defuseAssetId
        );
      }
      swap.setQuotes(fetchedQuotes);
      phase = "quote";
    } catch (error) {
      swap.setQuotesError(String(error));
    }
  }

  async function confirmSwap() {
    if (!$bestQuote || !selectedAsset) return;

    // Check if quote has expired
    if ($bestQuote.expiresAt < Date.now()) {
      ui.showToast("Quote has expired. Please get a new quote.", "error");
      swap.clearQuotes();
      phase = "input";
      return;
    }

    confirmLoading = true;
    try {
      const zecAddress = await getSwapReceivingAddress(true);

      // Build params based on direction
      const swapParams = direction === "inbound"
        ? {
            sourceAddress: zecAddress.address,
            destinationAddress: zecAddress.address, // Receive ZEC here
            sourceChainRefundAddress: refundAddress || undefined,
            zecRefundAddress: zecAddress.address,
          }
        : {
            sourceAddress: zecAddress.address, // Send ZEC from here
            destinationAddress: destinationAddress, // Receive external asset here
            sourceChainRefundAddress: zecAddress.address, // ZEC refund goes back to shielded
            zecRefundAddress: zecAddress.address,
          };

      const result = await executeSwap($bestQuote, swapParams);

      // Build swap record based on direction
      const fromAsset = direction === "inbound" ? selectedAsset : ZEC_ASSET;
      const toAsset = direction === "inbound" ? ZEC_ASSET : selectedAsset;
      const fromAmount = direction === "inbound" ? amount : $bestQuote.fromAmount;
      const toAmount = direction === "inbound" ? $bestQuote.toAmount : amount;

      const swapId = crypto.randomUUID();
      const now = Date.now();

      const newSwap: ActiveSwap = {
        id: swapId,
        direction,
        status: direction === "crosspay" ? "building_tx" : "awaiting_deposit",
        fromAsset,
        fromAmount,
        toAsset,
        toAmount,
        depositAddress: result.depositAddress,
        receivingAddress: direction === "inbound" ? zecAddress.address : destinationAddress,
        recipientAddress: direction === "crosspay" ? destinationAddress : undefined,
        refundAddress: direction === "inbound" ? refundAddress : zecAddress.address,
        quoteHash: $bestQuote.quoteHash,
        intentHash: result.intentHash,
        createdAt: now,
        expiresAt: now + 30 * 60 * 1000, // 30 minutes
      };

      swap.setActiveSwap(newSwap);
      phase = "deposit";

      // For inbound swaps, start polling immediately after showing deposit address
      if (direction === "inbound" && result.intentHash) {
        // Save swap record for inbound
        const swapRecord: SwapRecord = {
          id: swapId,
          direction,
          status: "awaiting_deposit",
          from_asset: fromAsset.identifier,
          from_amount: fromAmount,
          to_asset: toAsset.identifier,
          to_amount: toAmount,
          receiving_address: zecAddress.address,
          ephemeral_address: result.depositAddress,
          refund_address: refundAddress || undefined,
          quote_hash: $bestQuote.quoteHash,
          intent_hash: result.intentHash,
          created_at: Math.floor(now / 1000),
          expires_at: Math.floor((now + 30 * 60 * 1000) / 1000),
        };
        await saveSwap(swapRecord);

        // Start polling for deposit detection and swap progress
        startStatusPolling(result.depositAddress, swapId, direction);
      }

      // For outbound swaps, send ZEC to the deposit address
      if (direction === "crosspay" && result.depositAddress) {
        // Save the swap record first
        const swapRecord: SwapRecord = {
          id: swapId,
          direction,
          status: "building_tx",
          from_asset: fromAsset.identifier,
          from_amount: fromAmount,
          to_asset: toAsset.identifier,
          to_amount: toAmount,
          receiving_address: destinationAddress,
          ephemeral_address: result.depositAddress,
          refund_address: zecAddress.address,
          recipient_address: destinationAddress,
          quote_hash: $bestQuote.quoteHash,
          intent_hash: result.intentHash,
          created_at: Math.floor(now / 1000),
          expires_at: Math.floor((now + 30 * 60 * 1000) / 1000),
        };
        await saveSwap(swapRecord);

        // Convert ZEC amount to zatoshis and send
        const zatoshis = zecToZatoshis(fromAmount);
        if (zatoshis <= 0) {
          throw new Error("Invalid ZEC amount");
        }

        ui.showToast("Building ZEC transaction...", "info");

        // Update status to broadcasting
        swap.updateSwapStatus("broadcasting_zec");
        await updateSwapStatus(swapId, "broadcasting_zec");

        // Send ZEC to the deposit address
        const pendingTx = await sendTransactionBackground(
          result.depositAddress,
          zatoshis,
          `NEAR Intents swap: ${toAmount} ${toAsset.symbol}`
        );

        ui.showToast("Broadcasting ZEC transaction...", "info");

        // Wait for broadcast to complete
        const txResult = await waitForTxBroadcast(pendingTx.id);

        if (txResult.error) {
          throw new Error(txResult.error);
        }

        if (txResult.txid) {
          // Update swap with ZEC txid
          swap.updateZcashTxid(txResult.txid);
          await updateSwapStatus(swapId, "zec_confirmed", undefined, txResult.txid);
          ui.showToast("ZEC sent! Waiting for swap fulfillment...", "success");

          // Start polling for swap completion
          if (result.depositAddress) {
            startStatusPolling(result.depositAddress, swapId, direction);
          }
        }
      }
    } catch (error) {
      ui.showToast(`Failed to start swap: ${error}`, "error");
      // Reset on failure
      swap.updateSwapStatus("failed");
    } finally {
      confirmLoading = false;
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
    stopStatusPolling(); // Stop any active polling
    selectedAsset = null;
    amount = "";
    refundAddress = "";
    destinationAddress = "";
    swap.clearQuotes();
    swap.clearActiveSwap();
    phase = "input";
  }

  function toggleDirection() {
    direction = direction === "inbound" ? "crosspay" : "inbound";
    // Reset form when switching direction
    selectedAsset = null;
    amount = "";
    amountError = "";
    refundAddress = "";
    destinationAddress = "";
    swap.clearQuotes();
  }

  // For outbound swaps, also need destination address
  $: canGetQuote = selectedAsset && parseFloat(amount) > 0 && !amountError &&
    (direction === "inbound" || destinationAddress.length > 0);
</script>

<div class="swap-page">
  {#if isMockMode}
    <div class="mock-banner">
      <AlertTriangle size={14} />
      <span>Test Mode - Swaps are simulated</span>
    </div>
  {/if}

  {#if phase !== "deposit" && phase !== "status"}
    <header class="swap-header">
      <button class="back-button" onclick={handleBack}>
        <ArrowLeft size={20} strokeWidth={2} />
      </button>
      <h1>{direction === "inbound" ? "Swap to ZEC" : "Swap from ZEC"}</h1>
      <div class="header-spacer"></div>
    </header>
  {/if}

  <div class="swap-content">
    {#if phase === "input"}
      <div class="input-phase">
        <!-- Direction Toggle -->
        <div class="direction-toggle">
          <button
            class="direction-btn"
            class:active={direction === "inbound"}
            onclick={() => direction !== "inbound" && toggleDirection()}
          >
            Receive ZEC
          </button>
          <button
            class="direction-btn"
            class:active={direction === "crosspay"}
            onclick={() => direction !== "crosspay" && toggleDirection()}
          >
            Send ZEC
          </button>
        </div>

        {#if direction === "inbound"}
          <!-- INBOUND: External → ZEC -->
          <div class="form-section">
            <div class="field-label">From</div>
            <div class="from-row">
              <AssetSelector
                assets={$supportedAssets}
                selected={selectedAsset}
                onSelect={(a) => (selectedAsset = a)}
              />
              <div class="amount-input-wrap">
                <Input
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  value={amount}
                  oninput={handleAmountInput}
                />
                {#if amountError}
                  <p class="amount-error">{amountError}</p>
                {/if}
              </div>
            </div>
          </div>

          <div class="form-section refund-section">
            <Input
              label={`${selectedAsset?.symbol || "Source"} refund address`}
              placeholder={`Your ${selectedAsset?.symbol || ""} wallet address`}
              value={refundAddress}
              oninput={(e) => (refundAddress = e.currentTarget.value)}
            />
            <div class="refund-warning">
              <AlertTriangle size={14} />
              <p>
                <strong>Important:</strong> If the swap fails, your {selectedAsset?.symbol || "funds"} will be returned to this address.
                Without a refund address, failed swaps may result in lost funds.
              </p>
            </div>
          </div>

          <div class="swap-arrow">
            <RefreshCw size={20} />
          </div>

          <div class="form-section">
            <div class="field-label">To</div>
            <div class="to-display">
              <span class="zec-badge">ZEC</span>
              <span class="estimated">≈ {$bestQuote?.toAmount || "—"}</span>
            </div>
          </div>
        {:else}
          <!-- OUTBOUND: ZEC → External (CrossPay) -->
          <div class="form-section">
            <div class="field-label">From</div>
            <div class="to-display">
              <span class="zec-badge">ZEC</span>
              <span class="balance-hint">Shielded balance</span>
            </div>
          </div>

          <div class="swap-arrow">
            <RefreshCw size={20} />
          </div>

          <div class="form-section">
            <div class="field-label">To</div>
            <div class="from-row">
              <AssetSelector
                assets={$supportedAssets}
                selected={selectedAsset}
                onSelect={(a) => (selectedAsset = a)}
              />
              <div class="amount-input-wrap">
                <Input
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  value={amount}
                  oninput={handleAmountInput}
                />
                {#if amountError}
                  <p class="amount-error">{amountError}</p>
                {/if}
              </div>
            </div>
          </div>

          <div class="form-section">
            <Input
              label={`${selectedAsset?.symbol || "Destination"} receiving address`}
              placeholder={`Your ${selectedAsset?.symbol || ""} wallet address`}
              value={destinationAddress}
              oninput={(e) => (destinationAddress = e.currentTarget.value)}
            />
            <p class="field-hint">
              Where you'll receive your {selectedAsset?.symbol || "funds"} after the swap
            </p>
          </div>

          {#if $bestQuote}
            <div class="form-section">
              <div class="zec-cost">
                <span class="cost-label">ZEC required</span>
                <span class="cost-value">≈ {$bestQuote.fromAmount} ZEC</span>
              </div>
            </div>
          {/if}
        {/if}

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
          {#if direction === "inbound"}
            <div class="quote-from">
              <span class="quote-amount">{amount}</span>
              <span class="quote-symbol">{selectedAsset?.symbol}</span>
            </div>
            <div class="quote-arrow">→</div>
            <div class="quote-to">
              <span class="quote-amount">{$bestQuote?.toAmount}</span>
              <span class="quote-symbol">ZEC</span>
            </div>
          {:else}
            <div class="quote-from">
              <span class="quote-amount">{$bestQuote?.fromAmount}</span>
              <span class="quote-symbol">ZEC</span>
            </div>
            <div class="quote-arrow">→</div>
            <div class="quote-to">
              <span class="quote-amount">{amount}</span>
              <span class="quote-symbol">{selectedAsset?.symbol}</span>
            </div>
          {/if}
        </div>

        <div class="quote-details">
          <div class="detail-row">
            <span>Provider</span>
            <span>{$bestQuote?.provider}</span>
          </div>
          <div class="detail-row">
            <span>Fee</span>
            <span>{(($bestQuote?.feePercent ?? 0) * 100).toFixed(2)}%</span>
          </div>
          <div class="detail-row">
            <span>Estimated time</span>
            <span>~{Math.ceil(($bestQuote?.estimatedTime ?? 0) / 60)} min</span>
          </div>
        </div>

        <div class="form-actions">
          <Button variant="primary" size="lg" fullWidth onclick={confirmSwap} disabled={confirmLoading}>
            {confirmLoading ? "Confirming..." : "Confirm Swap"}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onclick={handleBack} disabled={confirmLoading}>
            Back
          </Button>
        </div>
      </div>

    {:else if phase === "deposit" && $activeSwap}
      <div class="deposit-phase">
        {#if direction === "inbound"}
          <!-- Inbound: Show deposit address for user to send external asset -->
          <DepositPrompt
            quote={$bestQuote!}
            depositAddress={$activeSwap.depositAddress ?? ""}
            fromAmount={$activeSwap.fromAmount}
            fromSymbol={$activeSwap.fromAsset.symbol}
            toAmount={$activeSwap.toAmount}
            toSymbol="ZEC"
            onCancel={reset}
          />
        {:else}
          <!-- Outbound: Show ZEC sending progress -->
          <div class="outbound-progress">
            <h2>Sending ZEC</h2>
            <div class="progress-summary">
              <div class="progress-from">
                <span class="progress-amount">{$activeSwap.fromAmount}</span>
                <span class="progress-symbol">ZEC</span>
              </div>
              <div class="progress-arrow">→</div>
              <div class="progress-to">
                <span class="progress-amount">{$activeSwap.toAmount}</span>
                <span class="progress-symbol">{$activeSwap.toAsset.symbol}</span>
              </div>
            </div>
            <p class="progress-hint">
              {#if $activeSwap.status === "building_tx"}
                Building transaction...
              {:else if $activeSwap.status === "broadcasting_zec"}
                Broadcasting to Zcash network...
              {:else if $activeSwap.status === "zec_confirmed"}
                ZEC sent! Waiting for {$activeSwap.toAsset.symbol} to arrive...
              {:else if $activeSwap.status === "fulfilling"}
                Swap in progress...
              {:else if $activeSwap.status === "completed"}
                Swap complete!
              {:else if $activeSwap.status === "failed"}
                Swap failed
              {:else}
                Processing...
              {/if}
            </p>
            {#if $activeSwap.zcashTxid}
              <div class="txid-display">
                <span class="txid-label">ZEC Txid:</span>
                <code class="txid-value">{$activeSwap.zcashTxid.slice(0, 16)}...</code>
              </div>
            {/if}
          </div>
        {/if}

        <SwapStatus
          status={$activeSwap.status}
          txid={$activeSwap.zcashTxid}
        />

        <div class="form-actions">
          <Button variant="ghost" size="lg" fullWidth onclick={reset}>
            {$activeSwap.status === "completed" || $activeSwap.status === "failed" ? "Done" : "Cancel"}
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

  .mock-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: rgba(245, 158, 11, 0.15);
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    color: rgb(245, 158, 11);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .direction-toggle {
    display: flex;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-1);
    gap: var(--space-1);
  }

  .direction-btn {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .direction-btn:hover {
    color: var(--text-primary);
  }

  .direction-btn.active {
    background: var(--accent-muted);
    color: var(--text-primary);
  }

  .balance-hint {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .zec-cost {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .cost-label {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .cost-value {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    font-family: var(--font-mono);
    color: var(--text-primary);
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

  .amount-input-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .amount-error {
    font-size: var(--text-xs);
    color: var(--error);
    margin: 0;
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

  .refund-warning {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: var(--radius-md);
    color: rgb(217, 119, 6);
  }

  .refund-warning p {
    font-size: var(--text-xs);
    line-height: var(--leading-relaxed);
    margin: 0;
  }

  .refund-warning strong {
    font-weight: var(--font-semibold);
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

  /* Outbound swap progress */
  .outbound-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .outbound-progress h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .progress-summary {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .progress-from,
  .progress-to {
    text-align: center;
  }

  .progress-amount {
    display: block;
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .progress-symbol {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .progress-arrow {
    font-size: var(--text-xl);
    color: var(--text-tertiary);
  }

  .progress-hint {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
  }

  .txid-display {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
  }

  .txid-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .txid-value {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }
</style>
