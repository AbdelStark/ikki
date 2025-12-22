//! Wallet-related Tauri commands

use crate::state::AppState;
use crate::wallet::{IkkiWallet, ZcashConfig};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tracing::info;

/// Wallet information returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub address: String,
    pub balance: BalanceInfo,
    pub block_height: u64,
}

/// Balance breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceInfo {
    pub total: u64,
    pub shielded: u64,
    pub transparent: u64,
}

/// Sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub block_height: u64,
    pub balance: BalanceInfo,
}

/// Stored wallet configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredWalletConfig {
    seed: String,
    birthday_height: Option<u64>,
}

/// Get wallet data directory path
fn get_data_dir() -> Result<std::path::PathBuf, String> {
    let data_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".ikki");
    Ok(data_dir)
}

/// Get path to seed storage file
fn get_seed_path() -> Result<std::path::PathBuf, String> {
    Ok(get_data_dir()?.join("wallet_config.json"))
}

/// Store wallet config (seed + birthday) to file
fn store_wallet_config(seed: &str, birthday_height: Option<u64>) -> Result<(), String> {
    let config = StoredWalletConfig {
        seed: seed.to_string(),
        birthday_height,
    };
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    let path = get_seed_path()?;
    let mut file =
        std::fs::File::create(&path).map_err(|e| format!("Failed to create config file: {e}"))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write config: {e}"))?;

    // Set restrictive permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, permissions)
            .map_err(|e| format!("Failed to set permissions: {e}"))?;
    }

    Ok(())
}

/// Load wallet config from file
fn load_wallet_config() -> Result<Option<StoredWalletConfig>, String> {
    let path = get_seed_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let mut file =
        std::fs::File::open(&path).map_err(|e| format!("Failed to open config file: {e}"))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read config: {e}"))?;

    let config: StoredWalletConfig =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse config: {e}"))?;

    Ok(Some(config))
}

/// Delete wallet config file
fn delete_wallet_config() -> Result<(), String> {
    let path = get_seed_path()?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete config: {e}"))?;
    }
    Ok(())
}

/// Check if a wallet exists (both database and config)
#[tauri::command]
pub async fn check_wallet_exists() -> Result<bool, String> {
    let data_dir = get_data_dir()?;
    let wallet_db = data_dir.join("wallet.db");
    let config_exists = get_seed_path()?.exists();

    // Both must exist for wallet to be loadable
    Ok(wallet_db.exists() && config_exists)
}

/// Generate a new seed phrase
#[tauri::command]
pub async fn generate_seed() -> Result<String, String> {
    use bip0039::{Count, English, Mnemonic};

    let mnemonic = Mnemonic::<English>::generate(Count::Words24);
    Ok(mnemonic.phrase().to_string())
}

/// Delete all wallet data (reset wallet)
#[tauri::command]
pub async fn reset_wallet(state: State<'_, AppState>) -> Result<(), String> {
    // Clear wallet from state first
    {
        let mut wallet_lock = state.wallet.lock().await;
        *wallet_lock = None;
    }

    let data_dir = get_data_dir()?;

    // Remove wallet database
    let wallet_db = data_dir.join("wallet.db");
    if wallet_db.exists() {
        std::fs::remove_file(&wallet_db).map_err(|e| format!("Failed to delete wallet.db: {e}"))?;
    }

    // Remove any other wallet-related files
    let files_to_remove = ["wallet.db-shm", "wallet.db-wal", "wallet_cache.db"];
    for file in files_to_remove {
        let path = data_dir.join(file);
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
    }

    // Remove stored config (seed)
    delete_wallet_config()?;

    Ok(())
}

/// Initialize wallet with seed phrase (new wallet)
#[tauri::command]
pub async fn init_wallet(
    state: State<'_, AppState>,
    seed: String,
    birthday_height: Option<u64>,
) -> Result<WalletInfo, String> {
    let config = ZcashConfig::from_seed_with_birthday(&seed, birthday_height)
        .map_err(|e| format!("Invalid seed phrase: {e}"))?;

    let mut wallet = IkkiWallet::new(config)
        .await
        .map_err(|e| format!("Failed to create wallet: {e}"))?;

    wallet
        .init_account()
        .await
        .map_err(|e| format!("Failed to initialize account: {e}"))?;

    let address = wallet
        .get_address()
        .map_err(|e| format!("Failed to get address: {e}"))?;

    let breakdown = wallet
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;

    let block_height = wallet
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;

    // Store seed for persistence
    store_wallet_config(&seed, birthday_height)?;

    // Store wallet in state
    let mut wallet_lock = state.wallet.lock().await;
    *wallet_lock = Some(wallet);

    Ok(WalletInfo {
        address,
        balance: BalanceInfo {
            total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
            shielded: breakdown.sapling + breakdown.orchard,
            transparent: breakdown.transparent,
        },
        block_height,
    })
}

/// Load existing wallet (import or from stored config)
#[tauri::command]
pub async fn load_wallet(
    state: State<'_, AppState>,
    seed: String,
    birthday_height: Option<u64>,
) -> Result<WalletInfo, String> {
    let config = ZcashConfig::from_seed_with_birthday(&seed, birthday_height)
        .map_err(|e| format!("Invalid seed phrase: {e}"))?;

    let mut wallet = IkkiWallet::new(config)
        .await
        .map_err(|e| format!("Failed to load wallet: {e}"))?;

    // Initialize account to ensure we have an address
    wallet
        .init_account()
        .await
        .map_err(|e| format!("Failed to initialize account: {e}"))?;

    let address = wallet
        .get_address()
        .map_err(|e| format!("Failed to get address: {e}"))?;

    let breakdown = wallet
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;

    let block_height = wallet
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;

    // Store seed for persistence
    store_wallet_config(&seed, birthday_height)?;

    // Store wallet in state
    let mut wallet_lock = state.wallet.lock().await;
    *wallet_lock = Some(wallet);

    Ok(WalletInfo {
        address,
        balance: BalanceInfo {
            total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
            shielded: breakdown.sapling + breakdown.orchard,
            transparent: breakdown.transparent,
        },
        block_height,
    })
}

/// Auto-load wallet from stored config (called on app startup)
#[tauri::command]
pub async fn auto_load_wallet(state: State<'_, AppState>) -> Result<Option<WalletInfo>, String> {
    // Check if config exists
    let stored_config = match load_wallet_config()? {
        Some(c) => c,
        None => return Ok(None),
    };

    // Check if wallet database exists
    let data_dir = get_data_dir()?;
    let wallet_db = data_dir.join("wallet.db");
    if !wallet_db.exists() {
        return Ok(None);
    }

    // Load wallet with stored config
    let config =
        ZcashConfig::from_seed_with_birthday(&stored_config.seed, stored_config.birthday_height)
            .map_err(|e| format!("Invalid stored seed: {e}"))?;

    let mut wallet = IkkiWallet::new(config)
        .await
        .map_err(|e| format!("Failed to load wallet: {e}"))?;

    let address = wallet
        .get_address()
        .map_err(|e| format!("Failed to get address: {e}"))?;

    let breakdown = wallet
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;

    let block_height = wallet
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;

    // Store wallet in state
    let mut wallet_lock = state.wallet.lock().await;
    *wallet_lock = Some(wallet);

    Ok(Some(WalletInfo {
        address,
        balance: BalanceInfo {
            total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
            shielded: breakdown.sapling + breakdown.orchard,
            transparent: breakdown.transparent,
        },
        block_height,
    }))
}

/// Get current balance
#[tauri::command]
pub async fn get_balance(state: State<'_, AppState>) -> Result<BalanceInfo, String> {
    let wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_ref().ok_or("Wallet not initialized")?;

    let breakdown = wallet
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;

    Ok(BalanceInfo {
        total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
        shielded: breakdown.sapling + breakdown.orchard,
        transparent: breakdown.transparent,
    })
}

/// Get wallet address
#[tauri::command]
pub async fn get_address(state: State<'_, AppState>) -> Result<String, String> {
    let wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_ref().ok_or("Wallet not initialized")?;

    wallet
        .get_address()
        .map_err(|e| format!("Failed to get address: {e}"))
}

/// Generate a new diversified address
#[tauri::command]
pub async fn get_new_address(state: State<'_, AppState>) -> Result<String, String> {
    let mut wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_mut().ok_or("Wallet not initialized")?;

    wallet
        .get_new_address()
        .map_err(|e| format!("Failed to generate new address: {e}"))
}

/// Get all wallet addresses
#[tauri::command]
pub async fn get_all_addresses(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_ref().ok_or("Wallet not initialized")?;

    wallet
        .get_all_addresses()
        .map_err(|e| format!("Failed to get addresses: {e}"))
}

/// Sync wallet with blockchain (blocking - kept for compatibility)
#[tauri::command]
pub async fn sync_wallet(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let mut wallet_lock = state.wallet.lock().await;
    let wallet = wallet_lock.as_mut().ok_or("Wallet not initialized")?;

    wallet
        .sync()
        .await
        .map_err(|e| format!("Sync failed: {e}"))?;

    let breakdown = wallet
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;
    let block_height = wallet
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;

    Ok(SyncResult {
        block_height,
        balance: BalanceInfo {
            total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
            shielded: breakdown.sapling + breakdown.orchard,
            transparent: breakdown.transparent,
        },
    })
}

/// Sync progress event payload
#[derive(Debug, Clone, Serialize)]
pub struct SyncProgress {
    pub current_block: u64,
    pub target_block: u64,
    pub percentage: f64,
    pub is_first_sync: bool,
    pub status: String,
}

/// Sync status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub is_first_sync: bool,
    pub current_block: u64,
    pub target_block: u64,
    pub percentage: f64,
}

/// Get current sync status
#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let sync_state = &state.sync_state;
    let (current, target) = sync_state.get_progress();
    let percentage = if target > 0 {
        (current as f64 / target as f64 * 100.0).min(100.0)
    } else {
        0.0
    };

    Ok(SyncStatus {
        is_syncing: sync_state.is_syncing(),
        is_first_sync: sync_state.is_first_sync.load(std::sync::atomic::Ordering::SeqCst),
        current_block: current,
        target_block: target,
        percentage,
    })
}

/// Start background sync
#[tauri::command]
pub async fn start_background_sync(
    app: AppHandle,
    state: State<'_, AppState>,
    is_first_sync: bool,
) -> Result<(), String> {
    // Check if already syncing
    if state.sync_state.is_syncing() {
        return Err("Sync already in progress".to_string());
    }

    // Mark sync as started
    state.sync_state.start_sync(is_first_sync);

    // Clone what we need for the spawned task
    let wallet = state.wallet.clone();
    let sync_state = state.sync_state.clone();
    let app_handle = app.clone();

    // Spawn the sync task
    tokio::spawn(async move {
        info!("Sync task started");
        let result = run_background_sync(wallet, sync_state.clone(), app_handle.clone()).await;

        // End sync and emit completion event
        sync_state.end_sync();
        info!("Sync state ended, emitting completion event...");

        match result {
            Ok(sync_result) => {
                info!("Sync successful, emitting sync-complete event");
                let emit_result = app_handle.emit("sync-complete", &sync_result);
                info!("sync-complete emit result: {:?}", emit_result);
            }
            Err(e) => {
                info!("Sync failed with error: {}", e);
                let emit_result = app_handle.emit("sync-error", &e);
                info!("sync-error emit result: {:?}", emit_result);
            }
        }
        info!("Sync task finished");
    });

    Ok(())
}

/// Cancel ongoing sync
#[tauri::command]
pub async fn cancel_sync(state: State<'_, AppState>) -> Result<(), String> {
    state.sync_state.request_cancel();
    Ok(())
}

/// Force reset sync state (for recovery from stuck states)
#[tauri::command]
pub async fn reset_sync_state(state: State<'_, AppState>) -> Result<(), String> {
    info!("Force resetting sync state");
    state.sync_state.end_sync();
    Ok(())
}

/// Run the background sync with progress updates
async fn run_background_sync(
    wallet: Arc<tokio::sync::Mutex<Option<IkkiWallet>>>,
    sync_state: Arc<crate::state::SyncState>,
    app: AppHandle,
) -> Result<SyncResult, String> {
    info!("Background sync: acquiring wallet lock...");
    let mut wallet_lock = wallet.lock().await;
    let wallet_ref = wallet_lock.as_mut().ok_or("Wallet not initialized")?;
    info!("Background sync: wallet lock acquired");

    // Get target block height first
    let target_height = wallet_ref
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;
    info!("Background sync: target height is {}", target_height);

    // Emit initial progress
    let is_first = sync_state.is_first_sync.load(std::sync::atomic::Ordering::SeqCst);
    sync_state.update_progress(0, target_height);
    let _ = app.emit(
        "sync-progress",
        SyncProgress {
            current_block: 0,
            target_block: target_height,
            percentage: 0.0,
            is_first_sync: is_first,
            status: "Starting sync...".to_string(),
        },
    );

    // Run sync
    info!("Background sync: starting sync to block {}", target_height);
    wallet_ref
        .sync()
        .await
        .map_err(|e| format!("Sync failed: {e}"))?;
    info!("Background sync: sync completed!");

    // Get final state
    info!("Background sync: getting final balance...");
    let breakdown = wallet_ref
        .get_balance_breakdown()
        .map_err(|e| format!("Failed to get balance: {e}"))?;
    let final_height = wallet_ref
        .get_block_height()
        .await
        .map_err(|e| format!("Failed to get block height: {e}"))?;
    info!("Background sync: final height is {}, balance updated", final_height);

    // Emit 100% progress
    sync_state.update_progress(final_height, final_height);
    info!("Background sync: emitting sync-progress 100%");
    let _ = app.emit(
        "sync-progress",
        SyncProgress {
            current_block: final_height,
            target_block: final_height,
            percentage: 100.0,
            is_first_sync: is_first,
            status: "Sync complete".to_string(),
        },
    );

    info!("Background sync: returning result");
    Ok(SyncResult {
        block_height: final_height,
        balance: BalanceInfo {
            total: breakdown.sapling + breakdown.orchard + breakdown.transparent,
            shielded: breakdown.sapling + breakdown.orchard,
            transparent: breakdown.transparent,
        },
    })
}
