import { derived, writable } from "svelte/store";

// CoinGecko Pro API configuration
const API_KEY = "CG-6CM3isvQQP4nPqrW5iVR6hdC";
const API_BASE = "https://pro-api.coingecko.com/api/v3";
const COINGECKO_PRICE_URL = `${API_BASE}/simple/price?ids=zcash&vs_currencies=usd&include_24hr_change=true`;
const COINGECKO_CHART_URL = `${API_BASE}/coins/zcash/market_chart?vs_currency=usd&days=365`;

// Binance WebSocket for real-time price
const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/zecusdt@trade";

const headers = {
  "x-cg-pro-api-key": API_KEY,
};

export interface ChartDataPoint {
  timestamp: number;
  price: number;
}

interface PricingState {
  zecUsd: number | null;
  previousPrice: number | null;
  priceDirection: "up" | "down" | null;
  change24h: number | null;
  lastUpdated: number | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  chartData: ChartDataPoint[];
  chartLoading: boolean;
  chartError: string | null;
  wsConnected: boolean;
}

const initialState: PricingState = {
  zecUsd: null,
  previousPrice: null,
  priceDirection: null,
  change24h: null,
  lastUpdated: null,
  loading: false,
  error: null,
  source: null,
  chartData: [],
  chartLoading: false,
  chartError: null,
  wsConnected: false,
};

async function fetchFromCoinGeckoPro(): Promise<{
  price: number;
  change24h: number | null;
  source: string;
}> {
  const response = await fetch(COINGECKO_PRICE_URL, { headers });
  if (!response.ok) {
    throw new Error("CoinGecko Pro request failed");
  }

  const data = await response.json();
  const price = data?.zcash?.usd;
  const change24h = data?.zcash?.usd_24h_change ?? null;

  if (typeof price !== "number") {
    throw new Error("Invalid price data from CoinGecko");
  }

  return { price, change24h, source: "coingecko-pro" };
}

async function fetchFromCoinGecko(): Promise<{
  price: number;
  change24h: number | null;
  source: string;
}> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd&include_24hr_change=true"
  );
  if (!response.ok) {
    throw new Error("CoinGecko request failed");
  }

  const data = await response.json();
  const price = data?.zcash?.usd;
  const change24h = data?.zcash?.usd_24h_change ?? null;

  if (typeof price !== "number") {
    throw new Error("Invalid price data from CoinGecko");
  }

  return { price, change24h, source: "coingecko" };
}

async function fetchFromCoinPaprika(): Promise<{
  price: number;
  change24h: number | null;
  source: string;
}> {
  const response = await fetch(
    "https://api.coinpaprika.com/v1/tickers/zec-zcash"
  );
  if (!response.ok) {
    throw new Error("CoinPaprika request failed");
  }

  const data = await response.json();
  const price = data?.quotes?.USD?.price;
  const change24h = data?.quotes?.USD?.percent_change_24h ?? null;

  if (typeof price !== "number") {
    throw new Error("Invalid price data from CoinPaprika");
  }

  return { price, change24h, source: "coinpaprika" };
}

async function fetchChartData(): Promise<ChartDataPoint[]> {
  const response = await fetch(COINGECKO_CHART_URL, { headers });
  if (!response.ok) {
    throw new Error("Failed to fetch chart data");
  }

  const data = await response.json();
  const prices = data?.prices;

  if (!Array.isArray(prices)) {
    throw new Error("Invalid chart data");
  }

  return prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price,
  }));
}

function createPricingStore() {
  const { subscribe, update, set } = writable<PricingState>(initialState);
  let interval: ReturnType<typeof setInterval> | null = null;
  let chartInterval: ReturnType<typeof setInterval> | null = null;
  let ws: WebSocket | null = null;
  let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const fetchPrice = async () => {
    update((state) => ({ ...state, loading: true, error: null }));

    const providers = [
      fetchFromCoinGeckoPro,
      fetchFromCoinGecko,
      fetchFromCoinPaprika,
    ];
    let lastError: string | null = null;

    for (const provider of providers) {
      try {
        const { price, change24h, source } = await provider();
        update((state) => {
          const direction =
            state.zecUsd !== null && price !== state.zecUsd
              ? price > state.zecUsd
                ? "up"
                : "down"
              : null;
          return {
            ...state,
            loading: false,
            previousPrice: state.zecUsd,
            zecUsd: price,
            priceDirection: direction,
            change24h,
            lastUpdated: Date.now(),
            error: null,
            source,
          };
        });
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Unknown pricing error";
      }
    }

    update((state) => ({
      ...state,
      loading: false,
      error: lastError ?? "Unable to fetch ZEC price",
    }));
  };

  const fetchChart = async () => {
    update((state) => ({ ...state, chartLoading: true, chartError: null }));

    try {
      const chartData = await fetchChartData();
      update((state) => ({
        ...state,
        chartData,
        chartLoading: false,
        chartError: null,
      }));
    } catch (error) {
      update((state) => ({
        ...state,
        chartLoading: false,
        chartError:
          error instanceof Error ? error.message : "Failed to load chart",
      }));
    }
  };

  const connectWebSocket = () => {
    if (ws) {
      ws.close();
    }

    try {
      ws = new WebSocket(BINANCE_WS_URL);

      ws.onopen = () => {
        update((state) => ({ ...state, wsConnected: true }));
      };

      ws.onmessage = (event) => {
        try {
          const trade = JSON.parse(event.data);
          const price = parseFloat(trade.p);

          if (!isNaN(price)) {
            update((state) => {
              const direction =
                state.zecUsd !== null && price !== state.zecUsd
                  ? price > state.zecUsd
                    ? "up"
                    : "down"
                  : null;
              return {
                ...state,
                previousPrice: state.zecUsd,
                zecUsd: price,
                priceDirection: direction,
                lastUpdated: Date.now(),
                source: "binance-ws",
              };
            });
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        update((state) => ({ ...state, wsConnected: false }));
        // Reconnect after 2 seconds
        wsReconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      // WebSocket connection failed, will retry
      wsReconnectTimeout = setTimeout(connectWebSocket, 2000);
    }
  };

  const disconnectWebSocket = () => {
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    update((state) => ({ ...state, wsConnected: false }));
  };

  const start = () => {
    if (interval) return;
    fetchPrice();
    // Poll price every 5 minutes as fallback
    interval = setInterval(fetchPrice, 5 * 60 * 1000);
  };

  const startRealtime = () => {
    start();
    connectWebSocket();
  };

  const startWithChart = () => {
    start();
    fetchChart();
    // Refresh chart every 5 minutes
    chartInterval = setInterval(fetchChart, 5 * 60 * 1000);
  };

  const startFull = () => {
    startWithChart();
    connectWebSocket();
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (chartInterval) {
      clearInterval(chartInterval);
      chartInterval = null;
    }
    disconnectWebSocket();
  };

  return {
    subscribe,
    fetchPrice,
    fetchChart,
    start,
    startRealtime,
    startWithChart,
    startFull,
    stop,
    connectWebSocket,
    disconnectWebSocket,
    reset: () => {
      stop();
      set(initialState);
    },
  };
}

export const pricing = createPricingStore();
export const zecUsdPrice = derived(pricing, ($pricing) => $pricing.zecUsd);
export const zecUsdSource = derived(pricing, ($pricing) => $pricing.source);
export const pricingError = derived(pricing, ($pricing) => $pricing.error);
export const pricingLoading = derived(pricing, ($pricing) => $pricing.loading);
export const priceChange24h = derived(pricing, ($pricing) => $pricing.change24h);
export const priceDirection = derived(
  pricing,
  ($pricing) => $pricing.priceDirection
);
export const chartData = derived(pricing, ($pricing) => $pricing.chartData);
export const chartLoading = derived(
  pricing,
  ($pricing) => $pricing.chartLoading
);
export const wsConnected = derived(pricing, ($pricing) => $pricing.wsConnected);
