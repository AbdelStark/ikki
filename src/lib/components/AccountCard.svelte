<script lang="ts">
  import { Copy, Check, RefreshCw, Shield, Shuffle, ArrowUpRight, Eye, EyeOff } from "lucide-svelte";
  import { ui } from "../stores/ui";
  import { wallet } from "../stores/wallet";
  import { hideAmounts, preferences } from "../stores/preferences";
  import { zecUsdPrice, pricingLoading } from "../stores/pricing";
  import { formatFiat, formatZec, maskedAmount, truncateAddress, copyToClipboard } from "../utils/format";
  import { getNewAddress } from "../utils/tauri";

  export let balance: number = 0;
  export let address: string = "";
  export let syncing: boolean = false;
  export let pendingAmount: number = 0;

  let copied = false;
  let shuffling = false;

  async function handleCopy() {
    const success = await copyToClipboard(address);
    if (success) {
      copied = true;
      ui.showToast("Address copied", "success");
      setTimeout(() => (copied = false), 2000);
    }
  }

  async function handleShuffle() {
    if (shuffling) return;
    shuffling = true;
    try {
      const newAddress = await getNewAddress();
      wallet.setAddress(newAddress);
      ui.showToast("New address generated", "success");
    } catch (e) {
      ui.showToast("Failed to generate address", "error");
    } finally {
      shuffling = false;
    }
  }

  function toggleBalanceVisibility() {
    preferences.toggleHideAmounts();
  }

  $: isHidden = $hideAmounts;
  $: formattedBalance = formatZec(balance);
  $: [intPart, decPart] = isHidden
    ? [maskedAmount(), maskedAmount("*", 2)]
    : formattedBalance.includes('.')
      ? formattedBalance.split('.')
      : [formattedBalance, '00'];
  $: formattedPending = isHidden ? maskedAmount() : formatZec(pendingAmount);
  $: usdRate = $zecUsdPrice;
  $: usdValue = usdRate ? (balance / 100_000_000) * usdRate : null;
  $: formattedUsdValue = isHidden ? maskedAmount() : usdValue !== null ? formatFiat(usdValue) : null;
</script>

<div class="card">
  <!-- Premium gradient background -->
  <div class="card-bg">
    <div class="card-glow"></div>
  </div>

  <div class="card-content">
    <!-- Header with badge and sync -->
    <div class="card-header">
      <div class="badge">
        <Shield size={10} strokeWidth={2.5} />
        <span>Shielded</span>
      </div>
      {#if syncing}
        <div class="sync-indicator" title="Syncing...">
          <RefreshCw size={14} class="spinning" />
        </div>
      {/if}
    </div>

    <!-- Balance display -->
    <div class="balance-section">
      <div class="balance-container">
        <div class="balance-glow"></div>
        <div class="balance-row">
          <div class="balance">
            <span class="balance-int">{intPart}</span>
            <span class="balance-dec">.{decPart}</span>
            <span class="balance-unit">ZEC</span>
          </div>
          <button class="toggle-visibility" onclick={toggleBalanceVisibility} aria-label={isHidden ? "Show balances" : "Hide balances"}>
            {#if isHidden}
              <EyeOff size={16} strokeWidth={2.25} />
            {:else}
              <Eye size={16} strokeWidth={2.25} />
            {/if}
          </button>
        </div>

        <div class="fiat-row" class:muted={!formattedUsdValue}>
          {#if formattedUsdValue}
            <span class="fiat-value">{formattedUsdValue}</span>
            {#if usdRate && !isHidden}
              <span class="fiat-rate">@ ${usdRate.toFixed(2)}</span>
            {/if}
          {:else}
            <span class="fiat-value">{isHidden ? maskedAmount() : "—"}</span>
          {/if}
          {#if $pricingLoading}
            <span class="fiat-loading"></span>
          {/if}
        </div>
      </div>

      {#if pendingAmount > 0}
        <div class="pending-amount">
          <ArrowUpRight size={11} strokeWidth={2.5} />
          <span>-{formattedPending} ZEC pending</span>
        </div>
      {/if}
    </div>

    <!-- Address actions -->
    <div class="address-row">
      <button class="address-btn" onclick={handleCopy} class:copied>
        <span class="address-text">{truncateAddress(address, 8)}</span>
        <div class="address-icon">
          {#if copied}
            <Check size={13} strokeWidth={2.5} />
          {:else}
            <Copy size={13} strokeWidth={2} />
          {/if}
        </div>
      </button>
      <button
        class="shuffle-btn"
        onclick={handleShuffle}
        disabled={shuffling}
        title="Generate new address"
      >
        <Shuffle size={14} strokeWidth={2} class={shuffling ? "shuffling" : ""} />
      </button>
    </div>
  </div>
</div>

<style>
  .card {
    position: relative;
    border-radius: var(--radius-2xl);
    overflow: hidden;
    transform: translateZ(0);
    will-change: transform;
  }

  .card-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.95) 0%,
      rgba(12, 12, 14, 0.98) 100%
    );
    border: 1px solid var(--border);
    border-radius: var(--radius-2xl);
    transition: border-color 0.4s ease;
  }

  .card:hover .card-bg {
    border-color: rgba(255, 255, 255, 0.08);
  }

  /* Premium gradient overlay - liquid metal effect */
  .card-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.02) 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.01) 75%,
      rgba(255, 255, 255, 0.03) 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  /* Top edge shine - enhanced */
  .card-bg::after {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.15) 30%,
      rgba(255, 255, 255, 0.15) 70%,
      transparent
    );
    pointer-events: none;
  }

  /* Subtle ambient glow - enhanced */
  .card-glow {
    position: absolute;
    top: -60%;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 120%;
    background: radial-gradient(
      ellipse 60% 40% at 50% 0%,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 60%
    );
    pointer-events: none;
    opacity: 0.8;
    transition: opacity 0.4s ease;
  }

  .card:hover .card-glow {
    opacity: 1;
  }

  .card-content {
    position: relative;
    z-index: 1;
    padding: var(--space-5) var(--space-5) var(--space-4);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2-5);
    background: var(--accent-subtle);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    color: var(--text-tertiary);
  }

  .badge span {
    font-size: var(--text-2xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .sync-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-tertiary);
  }

  .sync-indicator :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  .balance-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .balance-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .balance-glow {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 60%;
    height: 200%;
    background: radial-gradient(
      ellipse 100% 80% at 0% 50%,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 50%
    );
    pointer-events: none;
    animation: glowPulse 4s ease-in-out infinite;
  }

  .balance-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .balance {
    display: flex;
    align-items: baseline;
  }

  .balance-int {
    font-size: 2.5rem;
    font-weight: var(--font-bold);
    color: var(--text-primary);
    letter-spacing: -0.035em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    text-shadow:
      0 0 60px rgba(255, 255, 255, 0.15),
      0 0 30px rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(255, 255, 255, 0.85) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .balance-dec {
    font-size: 1.375rem;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }

  .balance-unit {
    font-size: 10px;
    font-weight: var(--font-bold);
    color: var(--text-muted);
    margin-left: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.5;
  }

  .toggle-visibility {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .toggle-visibility:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: var(--border-emphasis);
    color: var(--text-secondary);
  }

  .toggle-visibility:active {
    transform: scale(0.97);
  }

  .fiat-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-secondary);
  }

  .fiat-row.muted {
    color: var(--text-tertiary);
  }

  .fiat-value {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-tight);
  }

  .fiat-rate {
    font-size: var(--text-2xs);
    color: var(--text-muted);
    font-weight: var(--font-normal);
    letter-spacing: var(--tracking-normal);
  }

  .fiat-loading {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--text-muted);
    animation: pulse 1.5s ease-in-out infinite;
    opacity: 0.5;
  }

  .pending-amount {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
    animation: fadeIn var(--duration-normal) var(--ease-out);
  }

  .pending-amount span {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-xs);
  }

  .address-row {
    display: flex;
    gap: var(--space-2);
  }

  .address-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    min-height: var(--touch-min);
    padding: 0 var(--space-3);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .address-btn:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: var(--border-emphasis);
  }

  .address-btn:active {
    transform: scale(0.98);
  }

  .address-btn.copied {
    border-color: var(--success);
    background: rgba(34, 197, 94, 0.08);
  }

  .shuffle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-min);
    height: var(--touch-min);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-tertiary);
    flex-shrink: 0;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .shuffle-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.4);
    border-color: var(--border-emphasis);
    color: var(--text-secondary);
  }

  .shuffle-btn:active:not(:disabled) {
    transform: scale(0.92);
  }

  .shuffle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shuffle-btn :global(.shuffling) {
    animation: shuffle 0.4s ease-in-out infinite;
  }

  @keyframes shuffle {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }

  .address-text {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    letter-spacing: var(--tracking-normal);
  }

  .address-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: color var(--duration-fast) var(--ease-out);
  }

  .address-btn:hover .address-icon {
    color: var(--text-secondary);
  }

  .address-btn.copied .address-icon {
    color: var(--success);
  }
</style>
