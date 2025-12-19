//! Ikki - A beautiful Zcash wallet for everyone
//!
//! This is the Tauri application library providing wallet functionality.

mod commands;
mod state;
pub mod swap;
pub mod wallet;

use state::AppState;

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
            // Transaction commands
            commands::transactions::send_transaction,
            commands::transactions::get_transactions,
            commands::transactions::send_transaction_background,
            commands::transactions::get_pending_transactions,
            commands::transactions::get_pending_transaction,
            commands::transactions::dismiss_pending_transaction,
            // Swap commands
            commands::swap::get_swap_receiving_address,
            commands::swap::generate_ephemeral_address,
            commands::swap::save_swap,
            commands::swap::update_swap_status,
            commands::swap::get_swap_history,
            commands::swap::get_active_swaps,
            commands::swap::check_transparent_balance,
            commands::swap::shield_transparent_funds,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
