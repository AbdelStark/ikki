<script lang="ts">
  import { Loader2, Check, X, Clock, ArrowRight, AlertCircle } from "lucide-svelte";
  import type { SwapStatus } from "../types/swap";

  export let status: SwapStatus;
  export let txid: string | undefined = undefined;
  export let error: string | undefined = undefined;

  interface StatusConfig {
    label: string;
    icon: typeof Loader2;
    color: string;
    description?: string;
  }

  const statusConfig: Record<SwapStatus, StatusConfig> = {
    quoting: {
      label: "Getting quotes",
      icon: Loader2,
      color: "var(--text-tertiary)",
      description: "Fetching best rates from providers...",
    },
    quoted: {
      label: "Quote ready",
      icon: Check,
      color: "var(--receive)",
      description: "Ready to proceed with swap",
    },
    awaiting_deposit: {
      label: "Awaiting deposit",
      icon: Clock,
      color: "var(--text-secondary)",
      description: "Waiting for your deposit to be detected",
    },
    deposit_detected: {
      label: "Deposit detected",
      icon: Check,
      color: "var(--receive)",
      description: "Your deposit has been confirmed",
    },
    building_tx: {
      label: "Building transaction",
      icon: Loader2,
      color: "var(--text-tertiary)",
      description: "Preparing Zcash transaction...",
    },
    broadcasting_zec: {
      label: "Broadcasting to Zcash",
      icon: Loader2,
      color: "var(--text-tertiary)",
      description: "Sending transaction to network...",
    },
    zec_confirmed: {
      label: "ZEC confirmed",
      icon: Check,
      color: "var(--receive)",
      description: "Zcash transaction confirmed",
    },
    fulfilling: {
      label: "Solver fulfilling",
      icon: Loader2,
      color: "var(--text-tertiary)",
      description: "Solver processing your swap...",
    },
    completed: {
      label: "Swap complete",
      icon: Check,
      color: "var(--receive)",
      description: "Your swap has been successfully completed",
    },
    failed: {
      label: "Swap failed",
      icon: X,
      color: "var(--error)",
      description: error || "The swap encountered an error",
    },
    refunded: {
      label: "Refunded",
      icon: ArrowRight,
      color: "var(--text-secondary)",
      description: "Funds have been returned to your refund address",
    },
  };

  $: config = statusConfig[status];
  $: isSpinning = ["quoting", "building_tx", "broadcasting_zec", "fulfilling"].includes(status);
  $: isError = status === "failed";
  $: isComplete = status === "completed" || status === "zec_confirmed";
</script>

<div class="swap-status" class:error={isError} class:complete={isComplete}>
  <div class="status-header">
    <div class="status-icon" class:spinning={isSpinning} style="--status-color: {config.color}">
      <svelte:component this={config.icon} size={24} />
    </div>

    <div class="status-info">
      <h4 class="status-label">{config.label}</h4>
      {#if config.description}
        <p class="status-description">{config.description}</p>
      {/if}
    </div>
  </div>

  {#if txid}
    <div class="txid-section">
      <a
        href="https://explorer.zcha.in/transactions/{txid}"
        target="_blank"
        rel="noopener noreferrer"
        class="txid-link"
      >
        <span class="txid-label">View transaction</span>
        <ArrowRight size={14} />
      </a>
    </div>
  {/if}

  {#if error && isError}
    <div class="error-details">
      <AlertCircle size={14} />
      <span>{error}</span>
    </div>
  {/if}

  <div class="progress-track">
    <div
      class="progress-fill"
      style="--progress: {
        status === 'quoting' || status === 'quoted' ? 10 :
        status === 'awaiting_deposit' ? 25 :
        status === 'deposit_detected' ? 40 :
        status === 'building_tx' ? 55 :
        status === 'broadcasting_zec' ? 70 :
        status === 'zec_confirmed' ? 85 :
        status === 'fulfilling' ? 90 :
        status === 'completed' ? 100 :
        status === 'failed' ? 0 :
        status === 'refunded' ? 100 : 0
      }%"
    ></div>
  </div>
</div>

<style>
  .swap-status {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: border-color var(--duration-fast) var(--ease-out);
  }

  .swap-status.error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .swap-status.complete {
    border-color: rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.05);
  }

  .status-header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .status-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--status-color);
  }

  .status-icon.spinning :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .status-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .status-label {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .status-description {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    line-height: var(--leading-relaxed);
    margin: 0;
  }

  .txid-section {
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-subtle);
  }

  .txid-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--accent);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .txid-link:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .txid-label {
    font-size: var(--text-sm);
  }

  .error-details {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--error);
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--bg-elevated);
    border-radius: var(--radius-full);
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    width: var(--progress);
    background: linear-gradient(
      90deg,
      var(--accent) 0%,
      var(--accent-soft) 100%
    );
    border-radius: var(--radius-full);
    transition: width var(--duration-slow) var(--ease-out);
    position: relative;
  }

  .progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
