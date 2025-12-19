//! Tauri commands for swap operations

use crate::state::AppState;
use crate::swap::{SwapAddress, SwapRecord, AddressType};
use tauri::State;

/// Get a receiving address for inbound swaps
#[tauri::command]
pub async fn get_swap_receiving_address(
    state: State<'_, AppState>,
    prefer_shielded: bool,
) -> Result<SwapAddress, String> {
    if prefer_shielded {
        // Return shielded (unified) address
        let wallet_guard = state.wallet.lock().await;
        let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;
        let address = wallet.get_address().map_err(|e| e.to_string())?;
        Ok(SwapAddress {
            address,
            address_type: AddressType::Shielded,
            index: 0,
        })
    } else {
        // Generate transparent address using generate_ephemeral_address logic
        // Get next index from database
        let index = {
            let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
            let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;
            crate::swap::db::get_next_ephemeral_index(conn)
                .map_err(|e| format!("Failed to get ephemeral index: {}", e))?
        };

        // Derive address from wallet
        let address = {
            let wallet_guard = state.wallet.lock().await;
            let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;
            wallet.derive_transparent_address(index)
                .map_err(|e| format!("Failed to derive transparent address: {}", e))?
        };

        // Save to database
        {
            let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
            let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;
            crate::swap::db::save_ephemeral_address(conn, &address, index, None)
                .map_err(|e| format!("Failed to save ephemeral address: {}", e))?;
        }

        Ok(SwapAddress {
            address,
            address_type: AddressType::Transparent,
            index,
        })
    }
}

/// Generate an ephemeral transparent address for CrossPay
#[tauri::command]
pub async fn generate_ephemeral_address(
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Get next available index from database
    let index = {
        let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;
        crate::swap::db::get_next_ephemeral_index(conn)
            .map_err(|e| format!("Failed to get ephemeral index: {}", e))?
    };

    // Derive transparent address from wallet
    let address = {
        let wallet_guard = state.wallet.lock().await;
        let wallet = wallet_guard.as_ref().ok_or("Wallet not loaded")?;
        wallet.derive_transparent_address(index)
            .map_err(|e| format!("Failed to derive transparent address: {}", e))?
    };

    // Save address to database
    {
        let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;
        crate::swap::db::save_ephemeral_address(conn, &address, index, None)
            .map_err(|e| format!("Failed to save ephemeral address: {}", e))?;
    }

    tracing::info!("Generated ephemeral address {} at index {}", address, index);
    Ok(address)
}

/// Save a swap record
#[tauri::command]
pub async fn save_swap(
    state: State<'_, AppState>,
    swap: SwapRecord,
) -> Result<(), String> {
    let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::save_swap(conn, &swap)
        .map_err(|e| format!("Failed to save swap: {}", e))?;

    tracing::info!("Saved swap: {:?}", swap.id);
    Ok(())
}

/// Update swap status
#[tauri::command]
pub async fn update_swap_status(
    state: State<'_, AppState>,
    swap_id: String,
    status: String,
    intent_hash: Option<String>,
    txid: Option<String>,
) -> Result<(), String> {
    let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::update_swap_status(
        conn,
        &swap_id,
        &status,
        intent_hash.as_deref(),
        txid.as_deref(),
    )
    .map_err(|e| format!("Failed to update swap status: {}", e))?;

    tracing::info!(
        "Updated swap {} to status {} (intent: {:?}, txid: {:?})",
        swap_id, status, intent_hash, txid
    );
    Ok(())
}

/// Get swap history
#[tauri::command]
pub async fn get_swap_history(
    state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::get_swap_history(conn)
        .map_err(|e| format!("Failed to get swap history: {}", e))
}

/// Get active (non-terminal) swaps
#[tauri::command]
pub async fn get_active_swaps(
    state: State<'_, AppState>,
) -> Result<Vec<SwapRecord>, String> {
    let db_guard = state.swap_db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = db_guard.as_ref().ok_or("Swap database not initialized")?;

    crate::swap::db::get_active_swaps(conn)
        .map_err(|e| format!("Failed to get active swaps: {}", e))
}

/// Check transparent address balance (for monitoring deposits/refunds)
#[tauri::command]
pub async fn check_transparent_balance(
    _state: State<'_, AppState>,
    _address: String,
) -> Result<u64, String> {
    // TODO: Query lightwalletd
    Ok(0)
}

/// Shield funds from transparent to Orchard
#[tauri::command]
pub async fn shield_transparent_funds(
    _state: State<'_, AppState>,
    _from_address: String,
) -> Result<String, String> {
    // TODO: Build shielding transaction
    Err("Shield transaction not yet implemented".to_string())
}
