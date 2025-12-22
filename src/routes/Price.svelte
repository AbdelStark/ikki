<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { ArrowLeft, TrendingUp, TrendingDown, Radio } from "lucide-svelte";
  import { pricing, zecUsdPrice, priceChange24h, chartData, chartLoading, priceDirection, wsConnected } from "../lib/stores/pricing";
  import { ui } from "../lib/stores/ui";
  import type { ChartDataPoint } from "../lib/stores/pricing";

  let chartCanvas: HTMLCanvasElement;
  let chart: any = null;
  let liveIndicatorStyle = "";

  // Format price with rolling digit support
  function formatPrice(price: number): string {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Create digit slots for rolling animation
  let displayedChars: string[] = [];

  function updateDisplayedChars(price: number | null) {
    if (price === null) {
      displayedChars = [];
      return;
    }
    displayedChars = formatPrice(price).split("");
  }

  $: updateDisplayedChars($zecUsdPrice);
  $: isPositive = ($priceChange24h ?? 0) >= 0;
  $: formattedChange = $priceChange24h !== null
    ? `${$priceChange24h >= 0 ? "+" : ""}${$priceChange24h.toFixed(2)}%`
    : "";

  let flashClass = "";
  $: if ($priceDirection) {
    flashClass = $priceDirection === "up" ? "flash-up" : "flash-down";
    setTimeout(() => {
      flashClass = "";
    }, 600);
  }

  // Chart.js initialization
  async function initChart() {
    if (!chartCanvas || $chartData.length === 0) return;

    // Dynamically import Chart.js
    const { Chart, registerables } = await import("chart.js");
    Chart.register(...registerables);

    if (chart) {
      chart.destroy();
    }

    const ctx = chartCanvas.getContext("2d");
    if (!ctx) return;

    const labels = $chartData.map((d) => new Date(d.timestamp));
    const data = $chartData.map((d) => d.price);

    // Add live price point
    if ($zecUsdPrice !== null) {
      labels.push(new Date());
      data.push($zecUsdPrice);
    }

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: "#ffffff",
            borderWidth: 1.5,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "#000",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            titleColor: "#666",
            bodyColor: "#fff",
            titleFont: { family: "Inter, sans-serif", size: 11, weight: "400" },
            bodyFont: { family: "Inter, sans-serif", size: 14, weight: "300" },
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items: any[]) => {
                const date = new Date(items[0].label);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              },
              label: (item: any) => {
                return (
                  "$" +
                  item.raw.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                );
              },
            },
          },
        },
        scales: {
          x: {
            display: false,
            grid: { display: false },
          },
          y: {
            display: false,
            grid: { display: false },
          },
        },
        animation: {
          duration: 0,
          onComplete: updateLiveIndicator,
        },
      },
    });
  }

  function updateLiveIndicator() {
    if (!chart || !chart.data.datasets[0].data.length) return;

    const meta = chart.getDatasetMeta(0);
    const lastPoint = meta.data[meta.data.length - 1];

    if (lastPoint) {
      liveIndicatorStyle = `left: ${lastPoint.x}px; top: ${lastPoint.y}px;`;
    }
  }

  function updateChartLiveTip() {
    if (!chart || $chartData.length === 0) return;

    const labels = $chartData.map((d) => new Date(d.timestamp));
    const data = $chartData.map((d) => d.price);

    if ($zecUsdPrice !== null) {
      labels.push(new Date());
      data.push($zecUsdPrice);
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update("none");
    updateLiveIndicator();
  }

  // Watch for price changes
  $: if ($zecUsdPrice && chart) {
    updateChartLiveTip();
  }

  // Watch for chart data changes
  $: if ($chartData.length > 0 && chartCanvas) {
    initChart();
  }

  function handleBack() {
    ui.navigate("home");
  }

  onMount(() => {
    pricing.startFull();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
    pricing.disconnectWebSocket();
  });
</script>

<div class="price-view noise-overlay">
  <header class="price-header">
    <button class="back-button" onclick={handleBack}>
      <ArrowLeft size={20} strokeWidth={2} />
    </button>
    <div class="header-center">
      <span class="header-title">ZEC</span>
      {#if $wsConnected}
        <div class="live-badge">
          <Radio size={10} strokeWidth={2.5} />
          <span>LIVE</span>
        </div>
      {/if}
    </div>
    <div class="header-spacer"></div>
  </header>

  <div class="price-content">
    <div class="price-display">
      <div class="price-wrapper">
        <span class="currency">$</span>
        <span class="price {flashClass}">
          {#each displayedChars as char, i (i)}
            <span class="digit-slot">
              {#if /\d/.test(char)}
                <span class="digit-roll" style="transform: translateY(-{parseInt(char) * 10}%)">
                  {#each Array(10) as _, d}
                    <span>{d}</span>
                  {/each}
                </span>
              {:else}
                <span class="static-char">{char}</span>
              {/if}
            </span>
          {/each}
        </span>
      </div>

      {#if formattedChange}
        <div class="change-badge" class:positive={isPositive} class:negative={!isPositive}>
          {#if isPositive}
            <TrendingUp size={14} strokeWidth={2} />
          {:else}
            <TrendingDown size={14} strokeWidth={2} />
          {/if}
          <span>{formattedChange}</span>
          <span class="change-period">24h</span>
        </div>
      {/if}
    </div>

    <div class="chart-section">
      <div class="chart-container">
        {#if $chartLoading && $chartData.length === 0}
          <div class="chart-skeleton"></div>
        {:else}
          <canvas bind:this={chartCanvas}></canvas>
          <div class="live-indicator" style={liveIndicatorStyle}></div>
        {/if}
      </div>
      <div class="chart-label">
        <span>1 Year</span>
      </div>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <span class="stat-label">24h High</span>
        <span class="stat-value">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">24h Low</span>
        <span class="stat-value">—</span>
      </div>
    </div>

    <div class="tagline">
      <span>encrypt the money</span>
    </div>
  </div>
</div>

<style>
  .price-view {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 1) 0%,
      rgba(5, 5, 7, 1) 100%
    );
  }

  .price-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    animation: floatIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .back-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .back-button:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .back-button:active {
    transform: scale(0.9);
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .header-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    letter-spacing: 0.1em;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: var(--radius-full);
    color: #22c55e;
    font-size: 9px;
    font-weight: var(--font-bold);
    letter-spacing: 0.1em;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .header-spacer {
    width: 36px;
  }

  .price-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-8) var(--space-5);
    max-width: var(--max-width);
    margin: 0 auto;
    width: 100%;
  }

  .price-display {
    text-align: center;
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.1s;
    opacity: 0;
  }

  .price-wrapper {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    margin-bottom: var(--space-3);
  }

  .currency {
    font-size: 2rem;
    font-weight: 300;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .price {
    display: inline-flex;
    font-size: 3.5rem;
    font-weight: 300;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .price.flash-up .digit-roll span,
  .price.flash-up .static-char {
    color: #22c55e;
  }

  .price.flash-down .digit-roll span,
  .price.flash-down .static-char {
    color: #ef4444;
  }

  .digit-slot {
    display: inline-block;
    height: 1.15em;
    overflow: hidden;
    position: relative;
  }

  .digit-roll {
    display: flex;
    flex-direction: column;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .digit-roll span,
  .static-char {
    height: 1.15em;
    line-height: 1.15em;
    transition: color 0.6s ease;
  }

  .change-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-2) var(--space-3);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .change-badge.positive {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.15);
  }

  .change-badge.negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.15);
  }

  .change-period {
    font-size: var(--text-xs);
    opacity: 0.6;
    margin-left: 2px;
  }

  .chart-section {
    width: 100%;
    margin-top: var(--space-10);
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.2s;
    opacity: 0;
  }

  .chart-container {
    position: relative;
    height: 200px;
    width: 100%;
    opacity: 0.85;
  }

  .chart-container canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .chart-skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.04) 50%,
      rgba(255, 255, 255, 0.02) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
    border-radius: var(--radius-lg);
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .live-indicator {
    position: absolute;
    pointer-events: none;
  }

  .live-indicator::before,
  .live-indicator::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }

  .live-indicator::after {
    opacity: 0.5;
    animation: indicatorPulse 2s ease-out infinite;
  }

  @keyframes indicatorPulse {
    0% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(3);
    }
  }

  .chart-label {
    text-align: center;
    margin-top: var(--space-3);
  }

  .chart-label span {
    font-size: var(--text-2xs);
    color: var(--text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .stats-section {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-8);
    width: 100%;
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.3s;
    opacity: 0;
  }

  .stat-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background: linear-gradient(
      145deg,
      rgba(15, 15, 17, 0.6) 0%,
      rgba(10, 10, 12, 0.8) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-lg);
  }

  .stat-label {
    font-size: 10px;
    font-weight: var(--font-medium);
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .tagline {
    margin-top: auto;
    padding-top: var(--space-10);
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.4s;
    opacity: 0;
  }

  .tagline span {
    font-size: var(--text-sm);
    font-weight: 300;
    color: var(--text-muted);
    letter-spacing: 0.15em;
    opacity: 0.5;
  }
</style>
