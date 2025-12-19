//! Application state management

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::wallet::IkkiWallet;

/// Status of a pending transaction
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PendingTxStatus {
    /// Transaction is being built (proof generation)
    Building,
    /// Transaction is being broadcast
    Broadcasting,
    /// Transaction was broadcast successfully
    Broadcast,
    /// Transaction failed
    Failed,
}

/// A pending transaction being processed in the background
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTransaction {
    /// Unique ID for tracking (generated before txid is known)
    pub id: String,
    /// Transaction ID (available after building)
    pub txid: Option<String>,
    /// Recipient address
    pub to_address: String,
    /// Amount in zatoshis
    pub amount: u64,
    /// Optional memo
    pub memo: Option<String>,
    /// Current status
    pub status: PendingTxStatus,
    /// Error message if failed
    pub error: Option<String>,
    /// Timestamp when initiated
    pub created_at: u64,
}

/// State for tracking pending transactions
#[derive(Debug)]
pub struct PendingTxState {
    /// Map of pending transaction ID to transaction
    transactions: Mutex<HashMap<String, PendingTransaction>>,
}

impl PendingTxState {
    pub fn new() -> Self {
        Self {
            transactions: Mutex::new(HashMap::new()),
        }
    }

    pub async fn add(&self, tx: PendingTransaction) {
        let mut txs = self.transactions.lock().await;
        txs.insert(tx.id.clone(), tx);
    }

    pub async fn update_status(&self, id: &str, status: PendingTxStatus, txid: Option<String>, error: Option<String>) {
        let mut txs = self.transactions.lock().await;
        if let Some(tx) = txs.get_mut(id) {
            tx.status = status;
            if let Some(t) = txid {
                tx.txid = Some(t);
            }
            tx.error = error;
        }
    }

    pub async fn remove(&self, id: &str) {
        let mut txs = self.transactions.lock().await;
        txs.remove(id);
    }

    pub async fn get_all(&self) -> Vec<PendingTransaction> {
        let txs = self.transactions.lock().await;
        txs.values().cloned().collect()
    }

    pub async fn get(&self, id: &str) -> Option<PendingTransaction> {
        let txs = self.transactions.lock().await;
        txs.get(id).cloned()
    }
}

impl Default for PendingTxState {
    fn default() -> Self {
        Self::new()
    }
}

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
    pub pending_tx_state: Arc<PendingTxState>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            wallet: Arc::new(Mutex::new(None)),
            sync_state: Arc::new(SyncState::new()),
            pending_tx_state: Arc::new(PendingTxState::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
