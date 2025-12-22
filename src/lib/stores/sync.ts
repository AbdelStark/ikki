import { writable, derived, get } from "svelte/store";
import { ui } from "./ui";
import { onSyncProgress, onSyncComplete, onSyncError, resetSyncState } from "../utils/tauri";
import type { SyncProgress as TauriSyncProgress } from "../utils/tauri";

export type SyncMode = "initial" | "catchup" | "incremental" | "idle";

export interface SyncProgress {
  currentBlock: number;
  targetBlock: number;
  percentage: number;
  isFirstSync: boolean;
  status: string;
}

export interface SyncMetrics {
  blocksPerSecond: number;
  estimatedSecondsRemaining: number | null;
  blocksRemaining: number;
  elapsedSeconds: number;
  startedAt: number;
  lastUpdateAt: number;
}

export interface SyncState {
  isSyncing: boolean;
  isFirstSync: boolean;
  isInitialSyncComplete: boolean;
  mode: SyncMode;
  progress: SyncProgress | null;
  metrics: SyncMetrics | null;
  error: string | null;
}

// Progress samples for calculating blocks/second
interface ProgressSample {
  block: number;
  timestamp: number;
}

const MAX_SAMPLES = 10;
const SAMPLE_WINDOW_MS = 30000; // Use last 30 seconds for speed calculation
const SYNC_TIMEOUT_MS = 120000; // 2 minutes timeout for stuck syncs
const STALE_PROGRESS_MS = 30000; // Consider sync stale if no progress for 30 seconds

const initialState: SyncState = {
  isSyncing: false,
  isFirstSync: false,
  isInitialSyncComplete: false,
  mode: "idle",
  progress: null,
  metrics: null,
  error: null,
};

function createSyncStore() {
  const { subscribe, set, update } = writable<SyncState>(initialState);

  // Progress samples for speed calculation
  let progressSamples: ProgressSample[] = [];
  let syncStartBlock = 0;
  let syncStartTime = 0;
  let lastProgressTime = 0;

  // Watchdog timer for stuck syncs
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;

  // Event listener cleanup functions
  let unlistenProgress: (() => void) | null = null;
  let unlistenComplete: (() => void) | null = null;
  let unlistenError: (() => void) | null = null;

  function startWatchdog() {
    stopWatchdog();
    lastProgressTime = Date.now();

    watchdogTimer = setInterval(() => {
      const state = get({ subscribe });
      if (!state.isSyncing) {
        stopWatchdog();
        return;
      }

      const now = Date.now();
      const timeSinceStart = now - syncStartTime;
      const timeSinceProgress = now - lastProgressTime;

      // Check for absolute timeout
      if (timeSinceStart > SYNC_TIMEOUT_MS) {
        console.warn(`Sync watchdog: Absolute timeout (${SYNC_TIMEOUT_MS}ms) exceeded, forcing reset`);
        store.forceReset("Sync timed out");
        return;
      }

      // Check for stale progress (no updates for too long)
      if (timeSinceProgress > STALE_PROGRESS_MS && lastProgressTime > 0) {
        console.warn(`Sync watchdog: No progress for ${STALE_PROGRESS_MS}ms, forcing reset`);
        store.forceReset("Sync stalled");
        return;
      }
    }, 5000); // Check every 5 seconds
  }

  function stopWatchdog() {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function calculateMetrics(
    currentBlock: number,
    targetBlock: number,
    now: number
  ): SyncMetrics {
    // Add new sample
    progressSamples.push({ block: currentBlock, timestamp: now });

    // Remove old samples outside the window
    const cutoff = now - SAMPLE_WINDOW_MS;
    progressSamples = progressSamples.filter((s) => s.timestamp >= cutoff);

    // Keep only last MAX_SAMPLES
    if (progressSamples.length > MAX_SAMPLES) {
      progressSamples = progressSamples.slice(-MAX_SAMPLES);
    }

    // Calculate blocks per second from samples
    let blocksPerSecond = 0;
    if (progressSamples.length >= 2) {
      const oldest = progressSamples[0];
      const newest = progressSamples[progressSamples.length - 1];
      const blocksDelta = newest.block - oldest.block;
      const timeDeltaSeconds = (newest.timestamp - oldest.timestamp) / 1000;

      if (timeDeltaSeconds > 0) {
        blocksPerSecond = blocksDelta / timeDeltaSeconds;
      }
    }

    const blocksRemaining = Math.max(0, targetBlock - currentBlock);
    const elapsedSeconds = (now - syncStartTime) / 1000;

    // Estimate remaining time
    let estimatedSecondsRemaining: number | null = null;
    if (blocksPerSecond > 0 && blocksRemaining > 0) {
      estimatedSecondsRemaining = blocksRemaining / blocksPerSecond;
    }

    return {
      blocksPerSecond: Math.round(blocksPerSecond * 10) / 10,
      estimatedSecondsRemaining,
      blocksRemaining,
      elapsedSeconds: Math.round(elapsedSeconds),
      startedAt: syncStartTime,
      lastUpdateAt: now,
    };
  }

  function determineSyncMode(
    currentBlock: number,
    targetBlock: number,
    isFirst: boolean
  ): SyncMode {
    if (!targetBlock) return "idle";

    const blocksBehind = targetBlock - currentBlock;

    if (isFirst) {
      return "initial";
    } else if (blocksBehind > 100) {
      return "catchup";
    } else if (blocksBehind > 0) {
      return "incremental";
    }
    return "idle";
  }

  function getStatusMessage(mode: SyncMode, percentage: number): string {
    switch (mode) {
      case "initial":
        if (percentage === 0) return "Connecting to network...";
        if (percentage < 10) return "Downloading blocks...";
        if (percentage < 50) return "Scanning transactions...";
        if (percentage < 90) return "Processing notes...";
        return "Finalizing...";
      case "catchup":
        if (percentage === 0) return "Connecting...";
        return "Catching up...";
      case "incremental":
        return "Syncing new blocks...";
      default:
        return "Syncing...";
    }
  }

  const store = {
    subscribe,

    startSync: (isFirstSync: boolean = false) => {
      const now = Date.now();
      syncStartTime = now;
      syncStartBlock = 0;
      progressSamples = [];
      lastProgressTime = now;

      // Start watchdog to detect stuck syncs
      startWatchdog();

      update((s) => ({
        ...s,
        isSyncing: true,
        isFirstSync,
        mode: isFirstSync ? "initial" : "catchup",
        error: null,
        progress: {
          currentBlock: 0,
          targetBlock: 0,
          percentage: 0,
          isFirstSync,
          status: isFirstSync ? "Connecting to network..." : "Starting sync...",
        },
        metrics: {
          blocksPerSecond: 0,
          estimatedSecondsRemaining: null,
          blocksRemaining: 0,
          elapsedSeconds: 0,
          startedAt: now,
          lastUpdateAt: now,
        },
      }));
    },

    updateProgress: (progress: SyncProgress) => {
      const now = Date.now();
      lastProgressTime = now; // Update for watchdog

      update((s) => {
        // Initialize start block on first real progress
        if (syncStartBlock === 0 && progress.currentBlock > 0) {
          syncStartBlock = progress.currentBlock;
        }

        const mode = determineSyncMode(
          progress.currentBlock,
          progress.targetBlock,
          progress.isFirstSync
        );
        const metrics = calculateMetrics(
          progress.currentBlock,
          progress.targetBlock,
          now
        );
        const status = getStatusMessage(mode, progress.percentage);

        return {
          ...s,
          mode,
          progress: {
            ...progress,
            status,
          },
          metrics,
        };
      });
    },

    completeSync: () => {
      progressSamples = [];
      stopWatchdog();

      update((s) => ({
        ...s,
        isSyncing: false,
        isFirstSync: false,
        isInitialSyncComplete: true,
        mode: "idle",
        progress: s.progress
          ? { ...s.progress, percentage: 100, status: "Sync complete" }
          : null,
        metrics: s.metrics
          ? {
              ...s.metrics,
              blocksRemaining: 0,
              estimatedSecondsRemaining: 0,
              lastUpdateAt: Date.now(),
            }
          : null,
      }));
    },

    setError: (error: string) => {
      progressSamples = [];
      stopWatchdog();

      update((s) => ({
        ...s,
        isSyncing: false,
        mode: "idle",
        error,
      }));
    },

    // Force reset sync state (for recovery from stuck states)
    forceReset: async (reason?: string) => {
      progressSamples = [];
      syncStartBlock = 0;
      syncStartTime = 0;
      lastProgressTime = 0;
      stopWatchdog();

      const message = reason || "Sync reset";
      console.warn(`Sync force reset: ${message}`);

      // Reset backend sync state too
      try {
        await resetSyncState();
      } catch (e) {
        console.error("Failed to reset backend sync state:", e);
      }

      update((s) => ({
        ...s,
        isSyncing: false,
        isFirstSync: false,
        mode: "idle",
        error: null,
        progress: null,
        metrics: null,
      }));

      // Show toast to user
      ui.showToast(message, "warning");
    },

    // Check if sync appears stuck (for manual recovery)
    isStuck: (): boolean => {
      const state = get({ subscribe });
      if (!state.isSyncing) return false;

      const now = Date.now();
      const timeSinceProgress = now - lastProgressTime;
      return timeSinceProgress > STALE_PROGRESS_MS;
    },

    setInitialSyncComplete: (complete: boolean) =>
      update((s) => ({
        ...s,
        isInitialSyncComplete: complete,
      })),

    // Setup event listeners for reactive sync updates
    setupEventListeners: async () => {
      try {
        // Listen for sync progress events from Rust backend
        unlistenProgress = await onSyncProgress((progress: TauriSyncProgress) => {
          store.updateProgress({
            currentBlock: progress.current_block,
            targetBlock: progress.target_block,
            percentage: progress.percentage,
            isFirstSync: progress.is_first_sync,
            status: progress.status,
          });
        });

        // Listen for sync completion
        unlistenComplete = await onSyncComplete(() => {
          store.completeSync();
        });

        // Listen for sync errors
        unlistenError = await onSyncError((error: string) => {
          store.setError(error);
        });
      } catch (e) {
        console.error("Failed to setup sync event listeners:", e);
      }
    },

    // Cleanup event listeners
    cleanupEventListeners: () => {
      if (unlistenProgress) {
        unlistenProgress();
        unlistenProgress = null;
      }
      if (unlistenComplete) {
        unlistenComplete();
        unlistenComplete = null;
      }
      if (unlistenError) {
        unlistenError();
        unlistenError = null;
      }
    },

    reset: () => {
      progressSamples = [];
      syncStartBlock = 0;
      syncStartTime = 0;
      lastProgressTime = 0;
      stopWatchdog();
      set(initialState);
    },
  };

  return store;
}

export const sync = createSyncStore();

// Derived stores
export const isSyncing = derived(sync, ($s) => $s.isSyncing);
export const isFirstSync = derived(sync, ($s) => $s.isFirstSync);
export const isInitialSyncComplete = derived(
  sync,
  ($s) => $s.isInitialSyncComplete
);
export const syncProgress = derived(sync, ($s) => $s.progress);
export const syncMetrics = derived(sync, ($s) => $s.metrics);
export const syncMode = derived(sync, ($s) => $s.mode);
export const syncError = derived(sync, ($s) => $s.error);

// Formatted ETA for display
export const syncETA = derived(sync, ($s) => {
  if (!$s.metrics?.estimatedSecondsRemaining) return null;

  const seconds = Math.round($s.metrics.estimatedSecondsRemaining);

  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
});

// Formatted elapsed time
export const syncElapsed = derived(sync, ($s) => {
  if (!$s.metrics?.elapsedSeconds) return null;

  const seconds = $s.metrics.elapsedSeconds;

  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
});
