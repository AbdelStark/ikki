import { writable, derived } from 'svelte/store';
import type {
  SwapState,
  SwapQuote,
  ActiveSwap,
  Asset,
  SwapStatus,
} from '../types/swap';

const initialState: SwapState = {
  activeSwap: null,
  quotes: [],
  quotesLoading: false,
  quotesError: null,
  supportedAssets: [],
  swapHistory: [],
};

function createSwapStore() {
  const { subscribe, set, update } = writable<SwapState>(initialState);

  return {
    subscribe,

    // Quote management
    setQuotesLoading: (loading: boolean) =>
      update((s) => ({ ...s, quotesLoading: loading, quotesError: null })),

    setQuotes: (quotes: SwapQuote[]) =>
      update((s) => ({ ...s, quotes, quotesLoading: false })),

    setQuotesError: (error: string) =>
      update((s) => ({ ...s, quotesError: error, quotesLoading: false, quotes: [] })),

    clearQuotes: () =>
      update((s) => ({ ...s, quotes: [], quotesError: null })),

    // Active swap management
    setActiveSwap: (swap: ActiveSwap) =>
      update((s) => ({ ...s, activeSwap: swap })),

    updateSwapStatus: (status: SwapStatus, extras?: Partial<ActiveSwap>) =>
      update((s) => ({
        ...s,
        activeSwap: s.activeSwap
          ? { ...s.activeSwap, status, ...extras }
          : null,
      })),

    clearActiveSwap: () =>
      update((s) => ({ ...s, activeSwap: null })),

    // Assets
    setSupportedAssets: (assets: Asset[]) =>
      update((s) => ({ ...s, supportedAssets: assets })),

    // History
    setSwapHistory: (history: ActiveSwap[]) =>
      update((s) => ({ ...s, swapHistory: history })),

    addToHistory: (swap: ActiveSwap) =>
      update((s) => ({
        ...s,
        swapHistory: [swap, ...s.swapHistory],
      })),

    // Reset
    reset: () => set(initialState),
  };
}

export const swap = createSwapStore();

// Derived stores
export const activeSwap = derived(swap, ($s) => $s.activeSwap);
export const quotes = derived(swap, ($s) => $s.quotes);
export const quotesLoading = derived(swap, ($s) => $s.quotesLoading);
export const quotesError = derived(swap, ($s) => $s.quotesError);
export const supportedAssets = derived(swap, ($s) => $s.supportedAssets);
export const swapHistory = derived(swap, ($s) => $s.swapHistory);
export const hasActiveSwap = derived(swap, ($s) => $s.activeSwap !== null);
export const bestQuote = derived(swap, ($s) =>
  $s.quotes.length > 0 ? $s.quotes[0] : null
);
