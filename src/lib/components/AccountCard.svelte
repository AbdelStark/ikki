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

      {#if formattedUsdValue}
        <div class="fiat-row">
          <span class="fiat-value">≈ {formattedUsdValue}</span>
          {#if $pricingLoading}
            <span class="fiat-hint">Updating USD rate…</span>
          {:else if usdRate}
            <span class="fiat-hint">${usdRate.toFixed(2)} per ZEC</span>
          {:else}
            <span class="fiat-hint">USD value unavailable</span>
          {/if}
        </div>
      {:else}
        <div class="fiat-row muted">
          <span class="fiat-value">≈ {isHidden ? maskedAmount() : "Fetching USD value…"}</span>
          <span class="fiat-hint">Live conversion</span>
        </div>
      {/if}

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
  }

  .card-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-2xl);
  }

  /* Premium gradient overlay */
  .card-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      165deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0.01) 30%,
      transparent 60%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  /* Top edge shine */
  .card-bg::after {
    content: '';
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    pointer-events: none;
  }

  /* Subtle ambient glow */
  .card-glow {
    position: absolute;
    top: -50%;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 100%;
    background: radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 70%
    );
    pointer-events: none;
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

  .balance-row {
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
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tighter);
    line-height: var(--leading-none);
    font-variant-numeric: tabular-nums;
  }

  .balance-dec {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    letter-spacing: var(--tracking-tight);
    font-variant-numeric: tabular-nums;
  }

  .balance-unit {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    margin-left: var(--space-2);
    letter-spacing: var(--tracking-wide);
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
    align-items: baseline;
    gap: var(--space-2);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-tight);
  }

  .fiat-row.muted {
    color: var(--text-tertiary);
  }

  .fiat-value {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
  }

  .fiat-hint {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
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
