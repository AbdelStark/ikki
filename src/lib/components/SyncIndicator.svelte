<script lang="ts">
  import { RefreshCw, Check, X, XCircle } from "lucide-svelte";
  import { sync, isSyncing, syncProgress, syncError, syncMetrics, syncETA, syncMode, syncElapsed } from "../stores/sync";
  import { slide, fade } from "svelte/transition";

  export let compact: boolean = false;

  $: progress = $syncProgress;
  $: percentage = progress?.percentage ?? 0;
  $: error = $syncError;
  $: isIndeterminate = percentage < 5 || percentage > 95;
  $: metrics = $syncMetrics;
  $: eta = $syncETA;
  $: mode = $syncMode;
  $: elapsed = $syncElapsed;
  $: blocksRemaining = metrics?.blocksRemaining ?? 0;
  $: hasDetailedProgress = !isIndeterminate && blocksRemaining > 0;
  // Show elapsed time if syncing for more than 10 seconds without detailed progress
  $: showElapsed = !hasDetailedProgress && (metrics?.elapsedSeconds ?? 0) > 10;

  function handleCancel() {
    sync.forceReset("Sync cancelled");
  }
</script>

{#if $isSyncing || error}
  <div
    class="sync-indicator"
    class:compact
    class:error={!!error}
    transition:slide={{ duration: 200 }}
  >
    <div class="indicator-content">
      {#if error}
        <div class="indicator-icon error">
          <X size={14} />
        </div>
        <div class="indicator-text">
          <span class="indicator-label">Sync failed</span>
        </div>
        <button class="dismiss-btn" onclick={() => sync.setError(null)}>
          Dismiss
        </button>
      {:else if percentage >= 100}
        <div class="indicator-icon success" in:fade={{ duration: 200 }}>
          <Check size={14} />
        </div>
        <div class="indicator-text">
          <span class="indicator-label">Synced</span>
        </div>
      {:else}
        <div class="indicator-icon syncing">
          <RefreshCw size={14} class="spin" />
        </div>
        <div class="indicator-text">
          <span class="indicator-label">
            {#if mode === "catchup"}
              Catching up
            {:else if mode === "incremental"}
              Syncing
            {:else}
              Syncing
            {/if}
          </span>
          {#if hasDetailedProgress && eta}
            <span class="indicator-eta">{eta}</span>
          {:else if showElapsed && elapsed}
            <span class="indicator-eta">{elapsed}</span>
          {/if}
        </div>
        {#if !compact}
          <div class="progress-section">
            <div class="progress-bar-container" class:indeterminate={isIndeterminate}>
              <div class="progress-bar" class:indeterminate={isIndeterminate} style="width: {isIndeterminate ? '30%' : percentage + '%'}"></div>
            </div>
            {#if hasDetailedProgress}
              <span class="progress-percent">{Math.round(percentage)}%</span>
            {/if}
          </div>
          <button class="cancel-btn" onclick={handleCancel} title="Cancel sync">
            <XCircle size={14} />
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .sync-indicator {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    position: relative;
    overflow: hidden;
  }

  .sync-indicator::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--gradient-card);
    pointer-events: none;
  }

  .sync-indicator.compact {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
  }

  .sync-indicator.error {
    border-color: var(--error-muted);
    background: var(--error-muted);
  }

  .indicator-content {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    position: relative;
  }

  .indicator-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .indicator-icon.syncing {
    color: var(--text-secondary);
  }

  .indicator-icon.success {
    background: var(--success-muted);
    color: var(--success);
  }

  .indicator-icon.error {
    background: var(--error-muted);
    color: var(--error);
  }

  .indicator-icon :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .indicator-text {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
  }

  .indicator-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .indicator-eta {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    padding-left: var(--space-1);
    border-left: 1px solid var(--border);
    margin-left: var(--space-1);
  }

  .indicator-progress {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .progress-section {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .progress-percent {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
  }

  .progress-bar-container {
    flex: 1;
    max-width: 100px;
    height: 4px;
    background: var(--border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--text-primary);
    border-radius: var(--radius-full);
    transition: width 0.3s var(--ease-out);
  }

  .progress-bar-container.indeterminate {
    background: linear-gradient(
      90deg,
      var(--border) 0%,
      var(--border-emphasis) 50%,
      var(--border) 100%
    );
  }

  .progress-bar.indeterminate {
    animation: indeterminate 1.5s ease-in-out infinite;
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(200%);
    }
    100% {
      transform: translateX(-100%);
    }
  }

  .dismiss-btn {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .dismiss-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast) var(--ease-out);
    opacity: 0.5;
  }

  .cancel-btn:hover {
    color: var(--error);
    background: var(--error-muted);
    opacity: 1;
  }

  .compact .indicator-icon {
    width: 20px;
    height: 20px;
  }

  .compact .indicator-text {
    gap: var(--space-1);
  }

  .compact .indicator-label {
    font-size: var(--text-2xs);
  }
</style>
