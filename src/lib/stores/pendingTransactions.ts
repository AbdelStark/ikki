import { writable, derived } from "svelte/store";
import type { PendingTransaction, PendingTxStatus } from "../utils/tauri";

interface PendingTransactionsState {
  transactions: PendingTransaction[];
}

const initialState: PendingTransactionsState = {
  transactions: [],
};

function createPendingTransactionsStore() {
  const { subscribe, set, update } = writable<PendingTransactionsState>(initialState);

  return {
    subscribe,

    // Add a new pending transaction
    add: (tx: PendingTransaction) =>
      update((state) => ({
        ...state,
        transactions: [tx, ...state.transactions],
      })),

    // Update a pending transaction status
    updateStatus: (
      id: string,
      status: PendingTxStatus,
      txid?: string,
      error?: string
    ) =>
      update((state) => ({
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === id
            ? {
                ...tx,
                status,
                txid: txid ?? tx.txid,
                error: error ?? tx.error,
              }
            : tx
        ),
      })),

    // Remove a pending transaction
    remove: (id: string) =>
      update((state) => ({
        ...state,
        transactions: state.transactions.filter((tx) => tx.id !== id),
      })),

    // Set all pending transactions (for initial load from backend)
    setAll: (transactions: PendingTransaction[]) =>
      update((state) => ({
        ...state,
        transactions,
      })),

    // Clear all pending transactions
    clear: () => set(initialState),
  };
}

export const pendingTransactions = createPendingTransactionsStore();

// Derived store for just the transactions array
export const pendingTxList = derived(
  pendingTransactions,
  ($state) => $state.transactions
);

// Derived store for count of active (building/broadcasting) transactions
export const activePendingCount = derived(pendingTransactions, ($state) =>
  $state.transactions.filter(
    (tx) => tx.status === "building" || tx.status === "broadcasting"
  ).length
);

// Derived store to check if any transaction is in progress
export const hasActivePending = derived(
  activePendingCount,
  ($count) => $count > 0
);
