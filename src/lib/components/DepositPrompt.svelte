<script lang="ts">
  import { Copy, Check, Clock, X } from "lucide-svelte";
  import QRCode from "qrcode";
  import { onMount, onDestroy } from "svelte";
  import type { SwapQuote } from "../types/swap";

  export let quote: SwapQuote;
  export let depositAddress: string;
  export let fromAmount: string;
  export let fromSymbol: string;
  export let toAmount: string;
  export let toSymbol: string = "ZEC";
  export let onCancel: () => void = () => {};

  let copied = false;
  let qrDataUrl = "";
  let remainingTime = "";
  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Generate QR code
    QRCode.toDataURL(depositAddress, {
      width: 200,
      margin: 2,
      color: { dark: "#ffffff", light: "#00000000" },
    }).then((url) => {
      qrDataUrl = url;
    });

    // Update remaining time
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, quote.expiresAt - now);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      remainingTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      if (remaining <= 0 && intervalId) {
        clearInterval(intervalId);
      }
    };

    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(depositAddress);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }

  function truncate(addr: string, chars = 8): string {
    if (addr.length <= chars * 2 + 3) return addr;
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
  }
</script>

<div class="deposit-prompt">
  <div class="header">
    <h3>Deposit {fromAmount} {fromSymbol}</h3>
    <button class="close-button" onclick={onCancel}>
      <X size={18} />
    </button>
  </div>

  <p class="instruction">Send from your external wallet to complete the swap</p>

  <div class="amounts-display">
    <div class="amount-row">
      <span class="amount-label">You send</span>
      <span class="amount-value">{fromAmount} {fromSymbol}</span>
    </div>
    <div class="amount-row">
      <span class="amount-label">You receive</span>
      <span class="amount-value receive">{toAmount} {toSymbol}</span>
    </div>
  </div>

  <div class="qr-section">
    {#if qrDataUrl}
      <div class="qr-wrap">
        <img src={qrDataUrl} alt="Deposit address QR code" />
      </div>
    {:else}
      <div class="qr-loading">Loading QR...</div>
    {/if}
    <p class="qr-hint">Scan with your mobile wallet</p>
  </div>

  <div class="address-section">
    <p class="address-label">Or copy deposit address</p>
    <button class="address-copy" onclick={copyAddress}>
      <span class="address-text">{truncate(depositAddress, 12)}</span>
      {#if copied}
        <Check size={14} class="copy-icon success" />
      {:else}
        <Copy size={14} class="copy-icon" />
      {/if}
    </button>
  </div>

  <div class="timer">
    <Clock size={14} />
    <span>Expires in {remainingTime}</span>
  </div>

  <div class="warning">
    <p>Send only {fromSymbol} to this address. Sending other assets may result in permanent loss.</p>
  </div>
</div>

<style>
  .deposit-prompt {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .close-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-hover);
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .close-button:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  .instruction {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    text-align: center;
  }

  .amounts-display {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-sm);
  }

  .amount-label {
    color: var(--text-tertiary);
  }

  .amount-value {
    font-weight: var(--font-semibold);
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .amount-value.receive {
    color: var(--receive);
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .qr-wrap {
    padding: var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .qr-wrap img {
    display: block;
    width: 160px;
    height: 160px;
  }

  .qr-loading {
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .qr-hint {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .address-section {
    width: 100%;
    text-align: center;
  }

  .address-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
  }

  .address-copy {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    font-family: var(--font-sans);
  }

  .address-copy:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }

  .address-text {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-primary);
  }

  .address-copy :global(.copy-icon) {
    color: var(--text-tertiary);
  }

  .address-copy :global(.copy-icon.success) {
    color: var(--receive);
  }

  .timer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .warning {
    padding: var(--space-3);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--radius-md);
  }

  .warning p {
    font-size: var(--text-xs);
    color: var(--error);
    text-align: center;
    line-height: var(--leading-relaxed);
    margin: 0;
  }
</style>
