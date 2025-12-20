import { derived, writable } from "svelte/store";

interface PricingState {
  zecUsd: number | null;
  lastUpdated: number | null;
  loading: boolean;
  error: string | null;
  source: string | null;
}

const initialState: PricingState = {
  zecUsd: null,
  lastUpdated: null,
  loading: false,
  error: null,
  source: null,
};

async function fetchFromCoinGecko(): Promise<{ price: number; source: string }> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd",
  );
  if (!response.ok) {
    throw new Error("Coingecko request failed");
  }

  const data = await response.json();
  const price = data?.zcash?.usd;
  if (typeof price !== "number") {
    throw new Error("Invalid price data from Coingecko");
  }

  return { price, source: "coingecko" };
}

async function fetchFromCoinPaprika(): Promise<{ price: number; source: string }> {
  const response = await fetch("https://api.coinpaprika.com/v1/tickers/zec-zcash");
  if (!response.ok) {
    throw new Error("CoinPaprika request failed");
  }

  const data = await response.json();
  const price = data?.quotes?.USD?.price;
  if (typeof price !== "number") {
    throw new Error("Invalid price data from CoinPaprika");
  }

  return { price, source: "coinpaprika" };
}

function createPricingStore() {
  const { subscribe, update, set } = writable<PricingState>(initialState);
  let interval: ReturnType<typeof setInterval> | null = null;

  const fetchPrice = async () => {
    update((state) => ({ ...state, loading: true, error: null }));

    const providers = [fetchFromCoinGecko, fetchFromCoinPaprika];
    let lastError: string | null = null;

    for (const provider of providers) {
      try {
        const { price, source } = await provider();
        update((state) => ({
          ...state,
          loading: false,
          zecUsd: price,
          lastUpdated: Date.now(),
          error: null,
          source,
        }));
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown pricing error";
      }
    }

    update((state) => ({
      ...state,
      loading: false,
      error: lastError ?? "Unable to fetch ZEC price",
    }));
  };

  const start = () => {
    if (interval) return;
    fetchPrice();
    interval = setInterval(fetchPrice, 5 * 60 * 1000);
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  return {
    subscribe,
    fetchPrice,
    start,
    stop,
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
