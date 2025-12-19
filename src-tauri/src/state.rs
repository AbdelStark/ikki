//! Application state management

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::wallet::IkkiWallet;

/// Sync progress state
#[derive(Debug)]
pub struct SyncState {
    /// Whether sync is currently running
    pub is_syncing: AtomicBool,
    /// Current block being processed
    pub current_block: AtomicU64,
    /// Target block (chain tip)
    pub target_block: AtomicU64,
    /// Whether this is the first sync (initial sync after wallet creation/import)
    pub is_first_sync: AtomicBool,
    /// Cancel flag for stopping sync
    pub cancel_requested: AtomicBool,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            is_syncing: AtomicBool::new(false),
            current_block: AtomicU64::new(0),
            target_block: AtomicU64::new(0),
            is_first_sync: AtomicBool::new(false),
            cancel_requested: AtomicBool::new(false),
        }
    }

    pub fn start_sync(&self, is_first: bool) {
        self.is_syncing.store(true, Ordering::SeqCst);
        self.is_first_sync.store(is_first, Ordering::SeqCst);
        self.cancel_requested.store(false, Ordering::SeqCst);
    }

    pub fn end_sync(&self) {
        self.is_syncing.store(false, Ordering::SeqCst);
        self.is_first_sync.store(false, Ordering::SeqCst);
    }

    pub fn update_progress(&self, current: u64, target: u64) {
        self.current_block.store(current, Ordering::SeqCst);
        self.target_block.store(target, Ordering::SeqCst);
    }

    pub fn is_syncing(&self) -> bool {
        self.is_syncing.load(Ordering::SeqCst)
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_requested.load(Ordering::SeqCst)
    }

    pub fn request_cancel(&self) {
        self.cancel_requested.store(true, Ordering::SeqCst);
    }

    pub fn get_progress(&self) -> (u64, u64) {
        (
            self.current_block.load(Ordering::SeqCst),
            self.target_block.load(Ordering::SeqCst),
        )
    }
}

impl Default for SyncState {
    fn default() -> Self {
        Self::new()
    }
}

/// Global application state
pub struct AppState {
    pub wallet: Arc<Mutex<Option<IkkiWallet>>>,
    pub sync_state: Arc<SyncState>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            wallet: Arc::new(Mutex::new(None)),
            sync_state: Arc::new(SyncState::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
