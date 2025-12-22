//! Ikki - A beautiful Zcash wallet for everyone
//!
//! This is the Tauri application library providing wallet functionality.

#[cfg(feature = "wallet")]
mod commands;
mod state;
pub mod wallet;

use state::AppState;

#[cfg(feature = "wallet")]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Wallet commands
            commands::wallet::check_wallet_exists,
            commands::wallet::init_wallet,
            commands::wallet::load_wallet,
            commands::wallet::auto_load_wallet,
            commands::wallet::reset_wallet,
            commands::wallet::get_balance,
            commands::wallet::get_address,
            commands::wallet::get_new_address,
            commands::wallet::get_all_addresses,
            commands::wallet::sync_wallet,
            commands::wallet::generate_seed,
            // Sync commands
            commands::wallet::start_background_sync,
            commands::wallet::get_sync_status,
            commands::wallet::cancel_sync,
            commands::wallet::reset_sync_state,
            // Transaction commands
            commands::transactions::send_transaction,
            commands::transactions::get_transactions,
            commands::transactions::send_transaction_background,
            commands::transactions::get_pending_transactions,
            commands::transactions::get_pending_transaction,
            commands::transactions::dismiss_pending_transaction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Stub implementation for mobile platforms where wallet feature is disabled
#[cfg(not(feature = "wallet"))]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Stub commands for mobile - all return "not available"
            mobile_stub::check_wallet_exists,
            mobile_stub::init_wallet,
            mobile_stub::load_wallet,
            mobile_stub::auto_load_wallet,
            mobile_stub::reset_wallet,
            mobile_stub::get_balance,
            mobile_stub::get_address,
            mobile_stub::get_new_address,
            mobile_stub::get_all_addresses,
            mobile_stub::sync_wallet,
            mobile_stub::generate_seed,
            mobile_stub::start_background_sync,
            mobile_stub::get_sync_status,
            mobile_stub::cancel_sync,
            mobile_stub::reset_sync_state,
            mobile_stub::send_transaction,
            mobile_stub::get_transactions,
            mobile_stub::send_transaction_background,
            mobile_stub::get_pending_transactions,
            mobile_stub::get_pending_transaction,
            mobile_stub::dismiss_pending_transaction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Stub commands for mobile platforms
#[cfg(not(feature = "wallet"))]
mod mobile_stub {
    use serde::{Deserialize, Serialize};

    const NOT_AVAILABLE: &str = "Wallet functionality not available on this platform";

    #[derive(Serialize, Deserialize)]
    pub struct BalanceInfo {
        pub spendable: u64,
        pub total: u64,
        pub pending: u64,
    }

    #[derive(Serialize, Deserialize)]
    pub struct SyncStatus {
        pub is_syncing: bool,
        pub current_block: u64,
        pub target_block: u64,
        pub progress_percent: f32,
        pub is_first_sync: bool,
    }

    #[tauri::command]
    pub fn check_wallet_exists() -> bool {
        false
    }

    #[tauri::command]
    pub async fn init_wallet(_seed_phrase: String, _birthday_height: Option<u32>) -> Result<(), String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn load_wallet() -> Result<(), String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn auto_load_wallet() -> Result<bool, String> {
        Ok(false)
    }

    #[tauri::command]
    pub async fn reset_wallet() -> Result<(), String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_balance() -> Result<BalanceInfo, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_address() -> Result<String, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_new_address() -> Result<String, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_all_addresses() -> Result<Vec<String>, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn sync_wallet() -> Result<(), String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub fn generate_seed() -> String {
        "not-available".to_string()
    }

    #[tauri::command]
    pub async fn start_background_sync() -> Result<(), String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_sync_status() -> Result<SyncStatus, String> {
        Ok(SyncStatus {
            is_syncing: false,
            current_block: 0,
            target_block: 0,
            progress_percent: 0.0,
            is_first_sync: false,
        })
    }

    #[tauri::command]
    pub async fn cancel_sync() -> Result<(), String> {
        Ok(())
    }

    #[tauri::command]
    pub async fn reset_sync_state() -> Result<(), String> {
        Ok(())
    }

    #[tauri::command]
    pub async fn send_transaction(
        _to_address: String,
        _amount: u64,
        _memo: Option<String>,
    ) -> Result<String, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_transactions() -> Result<Vec<()>, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn send_transaction_background(
        _to_address: String,
        _amount: u64,
        _memo: Option<String>,
    ) -> Result<String, String> {
        Err(NOT_AVAILABLE.to_string())
    }

    #[tauri::command]
    pub async fn get_pending_transactions() -> Result<Vec<()>, String> {
        Ok(vec![])
    }

    #[tauri::command]
    pub async fn get_pending_transaction(_id: String) -> Result<Option<()>, String> {
        Ok(None)
    }

    #[tauri::command]
    pub async fn dismiss_pending_transaction(_id: String) -> Result<(), String> {
        Ok(())
    }
}
