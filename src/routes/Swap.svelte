<script lang="ts">
  import { ArrowLeftRight } from "lucide-svelte";
</script>

<div class="swap">
  <header class="swap-header">
    <h1>Swap</h1>
  </header>

  <div class="swap-content">
    <div class="coming-soon">
      <div class="icon-wrap">
        <ArrowLeftRight size={32} strokeWidth={1.5} />
      </div>
      <h2>Swap Coming Soon</h2>
      <p>
        Swap BTC, SOL, USDC, and other assets directly to shielded ZEC using NEAR Intents.
      </p>
    </div>
  </div>
</div>

<style>
  .swap {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .swap-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }

  .swap-header h1 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-wide);
  }

  .swap-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
  }

  .coming-soon {
    text-align: center;
    max-width: 280px;
  }

  .icon-wrap {
    width: 72px;
    height: 72px;
    margin: 0 auto var(--space-4);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
  }

  .coming-soon h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .coming-soon p {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    line-height: var(--leading-relaxed);
  }
</style>
