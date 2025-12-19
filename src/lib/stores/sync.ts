import { writable, derived } from "svelte/store";

export interface SyncProgress {
  currentBlock: number;
  targetBlock: number;
  percentage: number;
  isFirstSync: boolean;
  status: string;
}

export interface SyncState {
  isSyncing: boolean;
  isFirstSync: boolean;
  isInitialSyncComplete: boolean;
  progress: SyncProgress | null;
  error: string | null;
}

const initialState: SyncState = {
  isSyncing: false,
  isFirstSync: false,
  isInitialSyncComplete: false,
  progress: null,
  error: null,
};

function createSyncStore() {
  const { subscribe, set, update } = writable<SyncState>(initialState);

  return {
    subscribe,
    startSync: (isFirstSync: boolean = false) =>
      update((s) => ({
        ...s,
        isSyncing: true,
        isFirstSync,
        error: null,
        progress: {
          currentBlock: 0,
          targetBlock: 0,
          percentage: 0,
          isFirstSync,
          status: "Starting sync...",
        },
      })),
    updateProgress: (progress: SyncProgress) =>
      update((s) => ({
        ...s,
        progress,
      })),
    completeSync: () =>
      update((s) => ({
        ...s,
        isSyncing: false,
        isFirstSync: false,
        isInitialSyncComplete: true,
        progress: s.progress
          ? { ...s.progress, percentage: 100, status: "Sync complete" }
          : null,
      })),
    setError: (error: string) =>
      update((s) => ({
        ...s,
        isSyncing: false,
        error,
      })),
    setInitialSyncComplete: (complete: boolean) =>
      update((s) => ({
        ...s,
        isInitialSyncComplete: complete,
      })),
    reset: () => set(initialState),
  };
}

export const sync = createSyncStore();

// Derived stores
export const isSyncing = derived(sync, ($s) => $s.isSyncing);
export const isFirstSync = derived(sync, ($s) => $s.isFirstSync);
export const isInitialSyncComplete = derived(sync, ($s) => $s.isInitialSyncComplete);
export const syncProgress = derived(sync, ($s) => $s.progress);
export const syncError = derived(sync, ($s) => $s.error);
