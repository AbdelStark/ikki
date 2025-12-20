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
  import {
    getSupportedAssets,
    getInboundQuotes,
    executeSwap,
  } from "../lib/services/swapkit";
  import { getSwapReceivingAddress } from "../lib/utils/tauri";
  import type { Asset, ActiveSwap } from "../lib/types/swap";
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
        sourceAddress: address.address, // ZEC address (used for CrossPay, not inbound)
        destinationAddress: address.address, // ZEC address where user receives funds
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
          <div class="field-label">From</div>
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
          <div class="field-label">To</div>
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
            <span>{(($bestQuote?.feePercent ?? 0) * 100).toFixed(2)}%</span>
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
          quote={$bestQuote!}
          depositAddress={$activeSwap.depositAddress ?? ""}
          fromAmount={$activeSwap.fromAmount}
          fromSymbol={$activeSwap.fromAsset.symbol}
          toAmount={$activeSwap.toAmount}
          toSymbol="ZEC"
          onCancel={reset}
        />

        <SwapStatus
          status={$activeSwap.status}
          txid={$activeSwap.zcashTxid}
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
