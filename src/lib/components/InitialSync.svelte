<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { syncProgress, isSyncing, syncError, syncMetrics, syncETA, syncMode } from "../stores/sync";

  // Cypherpunk quotes - inspiring messages from the pioneers
  const quotes = [
    {
      text: "Privacy is necessary for an open society in the electronic age.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
    {
      text: "We the Cypherpunks are dedicated to building anonymous systems.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
    {
      text: "Cypherpunks write code. We know that someone has to write software to defend privacy.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
    {
      text: "Privacy in an open society requires anonymous transaction systems.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
    {
      text: "Computer technology is on the verge of providing the ability for individuals and groups to communicate and interact with each other in a totally anonymous manner.",
      author: "Timothy C. May",
      source: "The Crypto Anarchist Manifesto, 1988",
    },
    {
      text: "These developments will alter completely the nature of government regulation, the ability to tax and control economic interactions.",
      author: "Timothy C. May",
      source: "The Crypto Anarchist Manifesto, 1988",
    },
    {
      text: "Just as the technology of printing altered and reduced the power of medieval guilds and the social power structure, so too will cryptologic methods fundamentally alter corporations and government interference in economic transactions.",
      author: "Timothy C. May",
      source: "The Crypto Anarchist Manifesto, 1988",
    },
    {
      text: "Strong cryptography can provide the technical foundation for a new kind of positive social change.",
      author: "David Chaum",
      source: "Security without Identification, 1985",
    },
    {
      text: "The solution to the problem of privacy... lies in a new kind of cryptography.",
      author: "David Chaum",
      source: "Communications of the ACM, 1981",
    },
    {
      text: "A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution.",
      author: "Satoshi Nakamoto",
      source: "Bitcoin Whitepaper, 2008",
    },
    {
      text: "What is needed is an electronic payment system based on cryptographic proof instead of trust.",
      author: "Satoshi Nakamoto",
      source: "Bitcoin Whitepaper, 2008",
    },
    {
      text: "The root problem with conventional currency is all the trust that's required to make it work.",
      author: "Satoshi Nakamoto",
      source: "P2P Foundation, 2009",
    },
    {
      text: "If you don't believe me or don't get it, I don't have time to try to convince you, sorry.",
      author: "Satoshi Nakamoto",
      source: "BitcoinTalk, 2010",
    },
    {
      text: "Privacy is the power to selectively reveal oneself to the world.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
    {
      text: "We must defend our own privacy if we expect to have any.",
      author: "Eric Hughes",
      source: "A Cypherpunk's Manifesto, 1993",
    },
  ];

  let currentQuoteIndex = 0;
  let quoteVisible = true;
  let quoteInterval: ReturnType<typeof setInterval>;

  // Shuffle quotes initially
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const shuffledQuotes = shuffleArray(quotes);

  function nextQuote() {
    quoteVisible = false;
    setTimeout(() => {
      currentQuoteIndex = (currentQuoteIndex + 1) % shuffledQuotes.length;
      quoteVisible = true;
    }, 500);
  }

  onMount(() => {
    // Start quote rotation
    quoteInterval = setInterval(nextQuote, 6000);
  });

  onDestroy(() => {
    if (quoteInterval) clearInterval(quoteInterval);
  });

  $: progress = $syncProgress;
  $: percentage = progress?.percentage ?? 0;
  $: currentQuote = shuffledQuotes[currentQuoteIndex];
  $: error = $syncError;
  $: syncing = $isSyncing;
  $: metrics = $syncMetrics;
  $: eta = $syncETA;
  $: mode = $syncMode;

  // Format blocks per second for display
  $: blocksPerSecond = metrics?.blocksPerSecond ?? 0;
  $: hasMetrics = blocksPerSecond > 0 && percentage >= 5;
</script>

<div class="initial-sync">
  <div class="sync-container">
    <!-- Header -->
    <div class="sync-header">
      <div class="logo">ikki</div>
      <h1>Syncing Your Wallet</h1>
      <p class="description">
        We're downloading and verifying your transaction history from the Zcash blockchain.
        This ensures complete privacy - your data never leaves your device.
      </p>
    </div>

    <!-- Progress Section -->
    <div class="progress-section">
      <div class="progress-ring-container">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <circle
            class="progress-ring-bg"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke-width="4"
          />
          <circle
            class="progress-ring-fill"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke-width="4"
            stroke-dasharray={2 * Math.PI * 52}
            stroke-dashoffset={syncing && percentage < 5 ? 0 : 2 * Math.PI * 52 * (1 - percentage / 100)}
            class:indeterminate={syncing && percentage < 5}
          />
        </svg>
        <div class="progress-text">
          {#if syncing && percentage < 5}
            <div class="spinner"></div>
          {:else}
            <span class="progress-percentage">{Math.round(percentage)}</span>
            <span class="progress-symbol">%</span>
          {/if}
        </div>
      </div>

      <div class="progress-details">
        {#if error}
          <div class="progress-status error">{error}</div>
        {:else if progress && progress.status}
          <div class="progress-status">{progress.status}</div>
          {#if progress.targetBlock > 0 && percentage >= 5}
            <div class="progress-blocks">
              Block {progress.currentBlock.toLocaleString()} of {progress.targetBlock.toLocaleString()}
            </div>
          {/if}
          {#if hasMetrics}
            <div class="progress-metrics">
              {#if eta}
                <span class="metric">
                  <span class="metric-value">{eta}</span>
                  <span class="metric-label">remaining</span>
                </span>
              {/if}
              <span class="metric">
                <span class="metric-value">{blocksPerSecond.toFixed(1)}</span>
                <span class="metric-label">blocks/s</span>
              </span>
            </div>
          {/if}
        {:else if syncing}
          <div class="progress-status">Connecting to network...</div>
        {:else}
          <div class="progress-status">Preparing wallet...</div>
        {/if}
      </div>
    </div>

    <!-- Quote Section -->
    <div class="quote-section">
      <div class="quote-container" class:visible={quoteVisible}>
        <blockquote class="quote-text">
          "{currentQuote.text}"
        </blockquote>
        <div class="quote-attribution">
          <span class="quote-author">{currentQuote.author}</span>
          <span class="quote-source">{currentQuote.source}</span>
        </div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-cards">
      <div class="info-card">
        <div class="info-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div class="info-content">
          <span class="info-title">End-to-End Privacy</span>
          <span class="info-desc">All data stays on your device</span>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div class="info-content">
          <span class="info-title">One-Time Process</span>
          <span class="info-desc">Future syncs will be instant</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Background Animation -->
  <div class="bg-glow"></div>
  <div class="bg-grid"></div>
</div>

<style>
  .initial-sync {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    overflow: hidden;
  }

  .sync-container {
    width: 100%;
    max-width: 400px;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    position: relative;
    z-index: 1;
    animation: fadeInUp var(--duration-slow) var(--ease-out);
  }

  .sync-header {
    text-align: center;
  }

  .logo {
    font-size: 2rem;
    font-weight: var(--font-bold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tighter);
    margin-bottom: var(--space-4);
    opacity: 0.9;
  }

  .sync-header h1 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
    letter-spacing: var(--tracking-tight);
  }

  .description {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    line-height: var(--leading-relaxed);
    max-width: 320px;
    margin: 0 auto;
  }

  /* Progress Ring */
  .progress-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
  }

  .progress-ring-container {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .progress-ring-bg {
    stroke: var(--border);
  }

  .progress-ring-fill {
    stroke: var(--text-primary);
    stroke-linecap: round;
    transition: stroke-dashoffset 0.5s var(--ease-out);
  }

  .progress-ring-fill.indeterminate {
    animation: ring-spin 1.5s linear infinite;
    stroke-dasharray: 80 250;
  }

  @keyframes ring-spin {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -326;
    }
  }

  .progress-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .progress-percentage {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tight);
    font-variant-numeric: tabular-nums;
  }

  .progress-symbol {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .progress-details {
    text-align: center;
  }

  .progress-status {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
  }

  .progress-status.error {
    color: var(--error);
  }

  .progress-blocks {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-wide);
  }

  .progress-metrics {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .metric-value {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Quote Section */
  .quote-section {
    width: 100%;
    min-height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .quote-container {
    text-align: center;
    padding: var(--space-5);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    position: relative;
    opacity: 0;
    transform: translateY(8px);
    transition: all 0.5s var(--ease-out);
  }

  .quote-container::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--gradient-card);
    pointer-events: none;
  }

  .quote-container.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .quote-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: var(--leading-relaxed);
    font-style: italic;
    margin: 0;
    margin-bottom: var(--space-4);
    position: relative;
  }

  .quote-attribution {
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  .quote-author {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .quote-source {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
  }

  /* Info Cards */
  .info-cards {
    display: flex;
    gap: var(--space-3);
    width: 100%;
  }

  .info-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    position: relative;
  }

  .info-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--gradient-card);
    pointer-events: none;
  }

  .info-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    flex-shrink: 0;
    position: relative;
  }

  .info-icon svg {
    width: 20px;
    height: 20px;
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  .info-title {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .info-desc {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
  }

  /* Background Effects */
  .bg-glow {
    position: absolute;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 70%
    );
    pointer-events: none;
    animation: pulse 4s ease-in-out infinite;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 40px 40px;
    opacity: 0.5;
    pointer-events: none;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
