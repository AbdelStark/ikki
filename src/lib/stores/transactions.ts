import { writable, derived } from "svelte/store";
import type { Transaction } from "../utils/tauri";

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  transactions: [],
  loading: false,
  loaded: false,
  error: null,
};

function createTransactionsStore() {
  const { subscribe, set, update } = writable<TransactionsState>(initialState);

  return {
    subscribe,

    // Set loading state
    setLoading: (loading: boolean) =>
      update((state) => ({ ...state, loading })),

    // Set transactions (marks as loaded)
    setTransactions: (transactions: Transaction[]) =>
      update((state) => ({
        ...state,
        transactions,
        loading: false,
        loaded: true,
        error: null,
      })),

    // Set error
    setError: (error: string) =>
      update((state) => ({
        ...state,
        error,
        loading: false,
      })),

    // Reset store
    reset: () => set(initialState),
  };
}

export const transactionsStore = createTransactionsStore();

// Derived stores
export const transactions = derived(
  transactionsStore,
  ($state) => $state.transactions
);

export const transactionsLoading = derived(
  transactionsStore,
  ($state) => $state.loading
);

export const transactionsLoaded = derived(
  transactionsStore,
  ($state) => $state.loaded
);
