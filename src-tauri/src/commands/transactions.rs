//! Transaction-related Tauri commands

use crate::state::{AppState, PendingTransaction, PendingTxState, PendingTxStatus};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tracing::{info, error};
use uuid::Uuid;

/// Transaction type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionType {
    Sent,
    Received,
    Shielding,
    Internal,
}

/// Transaction status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

/// Transaction data for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub txid: String,
    pub tx_type: TransactionType,
    pub amount: i64,
    pub timestamp: u64,
    pub address: Option<String>,
    pub memo: Option<String>,
    pub status: TransactionStatus,
    pub confirmations: u32,
}

/// Send result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendResult {
    pub txid: String,
    pub amount: u64,
    pub fee: u64,
}

/// Send transaction
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, AppState>,
    to_address: String,
    amount: u64,
    memo: Option<String>,
) -> Result<SendResult, String> {
    let mut wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_mut().ok_or("Wallet not initialized")?;

    let memo_bytes = memo.map(|m| m.into_bytes());

    let result = wallet
        .send_to_address(&to_address, amount, memo_bytes)
        .await
        .map_err(|e| format!("Send failed: {e}"))?;

    Ok(SendResult {
        txid: result.txid,
        amount,
        fee: result.fee,
    })
}

/// Get transaction history
#[tauri::command]
pub async fn get_transactions(state: State<'_, AppState>) -> Result<Vec<Transaction>, String> {
    let wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_ref().ok_or("Wallet not initialized")?;

    // Get recent transactions from the wallet
    let records = wallet
        .get_recent_transactions(50)
        .map_err(|e| format!("Failed to get transactions: {e}"))?;

    // Convert to frontend format
    let transactions: Vec<Transaction> = records
        .into_iter()
        .map(|r| Transaction {
            txid: r.txid,
            tx_type: if r.is_sent {
                TransactionType::Sent
            } else {
                TransactionType::Received
            },
            amount: r.amount,
            timestamp: r.timestamp,
            address: None,
            memo: r.memo,
            status: TransactionStatus::Confirmed,
            confirmations: 1, // Simplified - would need to calculate from block height
        })
        .collect();

    Ok(transactions)
}

/// Start a transaction in the background
/// Returns immediately with a pending transaction ID
#[tauri::command]
pub async fn send_transaction_background(
    state: State<'_, AppState>,
    to_address: String,
    amount: u64,
    memo: Option<String>,
) -> Result<PendingTransaction, String> {
    // Generate unique ID for tracking
    let pending_id = Uuid::new_v4().to_string();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Create pending transaction record
    let pending_tx = PendingTransaction {
        id: pending_id.clone(),
        txid: None,
        to_address: to_address.clone(),
        amount,
        memo: memo.clone(),
        status: PendingTxStatus::Building,
        error: None,
        created_at,
    };

    // Add to pending state
    state.pending_tx_state.add(pending_tx.clone()).await;

    info!("Starting background transaction {}", pending_id);

    // Clone what we need for the background task
    let wallet = state.wallet.clone();
    let pending_state = state.pending_tx_state.clone();
    let id = pending_id.clone();

    // Spawn background task for transaction
    tokio::spawn(async move {
        run_background_transaction(wallet, pending_state, id, to_address, amount, memo).await;
    });

    Ok(pending_tx)
}

/// Background task that builds and broadcasts the transaction
async fn run_background_transaction(
    wallet: Arc<tokio::sync::Mutex<Option<crate::wallet::IkkiWallet>>>,
    pending_state: Arc<PendingTxState>,
    id: String,
    to_address: String,
    amount: u64,
    memo: Option<String>,
) {
    info!("Building transaction {} to {} for {} zatoshis", id, to_address, amount);

    // Build and send the transaction
    let result = {
        let mut wallet_lock = wallet.lock().await;
        let wallet = match wallet_lock.as_mut() {
            Some(w) => w,
            None => {
                error!("Wallet not initialized for transaction {}", id);
                pending_state.update_status(&id, PendingTxStatus::Failed, None, Some("Wallet not initialized".to_string())).await;
                return;
            }
        };

        let memo_bytes = memo.map(|m| m.into_bytes());
        wallet.send_to_address(&to_address, amount, memo_bytes).await
    };

    match result {
        Ok(send_result) => {
            info!("Transaction {} broadcast successfully with txid {}", id, send_result.txid);
            pending_state.update_status(&id, PendingTxStatus::Broadcast, Some(send_result.txid), None).await;
        }
        Err(e) => {
            error!("Transaction {} failed: {}", id, e);
            pending_state.update_status(&id, PendingTxStatus::Failed, None, Some(e.to_string())).await;
        }
    }
}

/// Get all pending transactions
#[tauri::command]
pub async fn get_pending_transactions(
    state: State<'_, AppState>,
) -> Result<Vec<PendingTransaction>, String> {
    Ok(state.pending_tx_state.get_all().await)
}

/// Get a specific pending transaction by ID
#[tauri::command]
pub async fn get_pending_transaction(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<PendingTransaction>, String> {
    Ok(state.pending_tx_state.get(&id).await)
}

/// Remove a pending transaction (after it's been acknowledged)
#[tauri::command]
pub async fn dismiss_pending_transaction(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.pending_tx_state.remove(&id).await;
    Ok(())
}
