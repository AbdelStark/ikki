<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { TrendingUp, TrendingDown, ChevronRight } from "lucide-svelte";
  import { pricing, zecUsdPrice, priceChange24h, chartData, chartLoading, priceDirection } from "../stores/pricing";
  import { ui } from "../stores/ui";
  import type { ChartDataPoint } from "../stores/pricing";

  // Generate SVG path from chart data
  function generateSparklinePath(data: ChartDataPoint[], width: number, height: number): string {
    if (data.length < 2) return "";

    const prices = data.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const padding = 2;
    const effectiveHeight = height - padding * 2;
    const effectiveWidth = width;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((point.price - minPrice) / priceRange) * effectiveHeight;
      return { x, y };
    });

    // Create smooth curve using quadratic bezier
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x} ${prev.y}, ${midX} ${(prev.y + curr.y) / 2}`;
    }
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
  }

  // Use last 30 days for sparkline
  $: recentData = $chartData.slice(-30);
  $: sparklinePath = generateSparklinePath(recentData, 120, 40);
  $: isPositive = ($priceChange24h ?? 0) >= 0;
  $: formattedPrice = $zecUsdPrice?.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) ?? "—";
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

  function handleClick() {
    ui.navigate("price");
  }

  onMount(() => {
    pricing.startWithChart();
  });

  onDestroy(() => {
    // Don't stop pricing here as it's used elsewhere
  });
</script>

<button class="sparkline-card" onclick={handleClick}>
  <div class="sparkline-content">
    <div class="price-info">
      <span class="ticker">ZEC</span>
      <div class="price-row">
        <span class="currency">$</span>
        <span class="price {flashClass}">{formattedPrice}</span>
      </div>
      {#if formattedChange}
        <div class="change" class:positive={isPositive} class:negative={!isPositive}>
          {#if isPositive}
            <TrendingUp size={10} strokeWidth={2.5} />
          {:else}
            <TrendingDown size={10} strokeWidth={2.5} />
          {/if}
          <span>{formattedChange}</span>
        </div>
      {/if}
    </div>

    <div class="sparkline-wrapper">
      {#if $chartLoading && recentData.length === 0}
        <div class="sparkline-skeleton"></div>
      {:else if sparklinePath}
        <svg class="sparkline" viewBox="0 0 120 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.1)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
            </linearGradient>
          </defs>
          <path
            d={sparklinePath}
            fill="none"
            stroke="url(#sparklineGradient)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="sparkline-path"
          />
        </svg>
        <div class="live-dot"></div>
      {/if}
    </div>
  </div>

  <div class="chevron">
    <ChevronRight size={16} strokeWidth={1.5} />
  </div>
</button>

<style>
  .sparkline-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-4);
    background: linear-gradient(
      145deg,
      rgba(18, 18, 20, 0.6) 0%,
      rgba(12, 12, 14, 0.8) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }

  .sparkline-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.06),
      transparent
    );
    pointer-events: none;
  }

  .sparkline-card:hover {
    background: linear-gradient(
      145deg,
      rgba(22, 22, 25, 0.7) 0%,
      rgba(15, 15, 17, 0.85) 100%
    );
    border-color: rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
  }

  .sparkline-card:active {
    transform: scale(0.99);
  }

  .sparkline-content {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex: 1;
  }

  .price-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .ticker {
    font-size: 10px;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .price-row {
    display: flex;
    align-items: baseline;
  }

  .currency {
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    color: var(--text-muted);
    margin-right: 1px;
  }

  .price {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    transition: color 0.4s ease;
  }

  .price.flash-up {
    color: #22c55e;
  }

  .price.flash-down {
    color: #ef4444;
  }

  .change {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: var(--font-medium);
    letter-spacing: 0.02em;
  }

  .change.positive {
    color: #22c55e;
  }

  .change.negative {
    color: #ef4444;
  }

  .sparkline-wrapper {
    position: relative;
    width: 120px;
    height: 40px;
    flex-shrink: 0;
  }

  .sparkline {
    width: 100%;
    height: 100%;
  }

  .sparkline-path {
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15));
  }

  .sparkline-skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.02) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .live-dot {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
  }

  .live-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.6;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(2.5);
    }
  }

  .chevron {
    color: var(--text-muted);
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sparkline-card:hover .chevron {
    opacity: 0.6;
    transform: translateX(0);
  }
</style>
