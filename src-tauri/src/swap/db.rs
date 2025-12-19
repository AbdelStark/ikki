//! Database operations for swaps

use super::models::{SwapDirection, SwapRecord};
use rusqlite::Connection;
use std::path::PathBuf;

/// Get the path to the swap database file
pub fn swap_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".ikki")
        .join("swaps.db")
}

/// Open or create the swap database connection
pub fn open_swap_db() -> Result<Connection, rusqlite::Error> {
    let path = swap_db_path();
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(&path)?;
    init_swap_tables(&conn)?;
    Ok(conn)
}

/// Initialize swap tables
pub fn init_swap_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS swaps (
            id TEXT PRIMARY KEY,
            direction TEXT NOT NULL,
            status TEXT NOT NULL,
            from_asset TEXT NOT NULL,
            from_amount TEXT NOT NULL,
            to_asset TEXT NOT NULL,
            to_amount TEXT NOT NULL,
            receiving_address TEXT,
            ephemeral_address TEXT,
            refund_address TEXT,
            recipient_address TEXT,
            quote_hash TEXT,
            intent_hash TEXT,
            zcash_txid TEXT,
            fulfillment_txid TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            completed_at INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ephemeral_addresses (
            address TEXT PRIMARY KEY,
            derivation_index INTEGER NOT NULL,
            swap_id TEXT,
            created_at INTEGER NOT NULL,
            used_at INTEGER
        )",
        [],
    )?;

    Ok(())
}

/// Save a swap record
pub fn save_swap(conn: &Connection, swap: &SwapRecord) -> Result<(), rusqlite::Error> {
    let direction = match swap.direction {
        SwapDirection::Inbound => "inbound",
        SwapDirection::CrossPay => "crosspay",
    };

    conn.execute(
        "INSERT OR REPLACE INTO swaps (
            id, direction, status, from_asset, from_amount, to_asset, to_amount,
            receiving_address, ephemeral_address, refund_address, recipient_address,
            quote_hash, intent_hash, zcash_txid, fulfillment_txid,
            created_at, expires_at, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        rusqlite::params![
            swap.id,
            direction,
            swap.status,
            swap.from_asset,
            swap.from_amount,
            swap.to_asset,
            swap.to_amount,
            swap.receiving_address,
            swap.ephemeral_address,
            swap.refund_address,
            swap.recipient_address,
            swap.quote_hash,
            swap.intent_hash,
            swap.zcash_txid,
            swap.fulfillment_txid,
            swap.created_at,
            swap.expires_at,
            swap.completed_at,
        ],
    )?;

    Ok(())
}

/// Update swap status
pub fn update_swap_status(
    conn: &Connection,
    swap_id: &str,
    status: &str,
    intent_hash: Option<&str>,
    txid: Option<&str>,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE swaps SET status = ?2, intent_hash = COALESCE(?3, intent_hash),
         zcash_txid = COALESCE(?4, zcash_txid) WHERE id = ?1",
        rusqlite::params![swap_id, status, intent_hash, txid],
    )?;
    Ok(())
}

/// Get all swaps
pub fn get_swap_history(conn: &Connection) -> Result<Vec<SwapRecord>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, direction, status, from_asset, from_amount, to_asset, to_amount,
         receiving_address, ephemeral_address, refund_address, recipient_address,
         quote_hash, intent_hash, zcash_txid, fulfillment_txid,
         created_at, expires_at, completed_at
         FROM swaps ORDER BY created_at DESC"
    )?;

    let swaps = stmt.query_map([], |row| {
        let direction_str: String = row.get(1)?;
        let direction = if direction_str == "inbound" {
            SwapDirection::Inbound
        } else {
            SwapDirection::CrossPay
        };

        Ok(SwapRecord {
            id: row.get(0)?,
            direction,
            status: row.get(2)?,
            from_asset: row.get(3)?,
            from_amount: row.get(4)?,
            to_asset: row.get(5)?,
            to_amount: row.get(6)?,
            receiving_address: row.get(7)?,
            ephemeral_address: row.get(8)?,
            refund_address: row.get(9)?,
            recipient_address: row.get(10)?,
            quote_hash: row.get(11)?,
            intent_hash: row.get(12)?,
            zcash_txid: row.get(13)?,
            fulfillment_txid: row.get(14)?,
            created_at: row.get(15)?,
            expires_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(swaps)
}

/// Get active (non-terminal) swaps
pub fn get_active_swaps(conn: &Connection) -> Result<Vec<SwapRecord>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, direction, status, from_asset, from_amount, to_asset, to_amount,
         receiving_address, ephemeral_address, refund_address, recipient_address,
         quote_hash, intent_hash, zcash_txid, fulfillment_txid,
         created_at, expires_at, completed_at
         FROM swaps
         WHERE status NOT IN ('completed', 'failed', 'refunded')
         ORDER BY created_at DESC"
    )?;

    let swaps = stmt.query_map([], |row| {
        let direction_str: String = row.get(1)?;
        let direction = if direction_str == "inbound" {
            SwapDirection::Inbound
        } else {
            SwapDirection::CrossPay
        };

        Ok(SwapRecord {
            id: row.get(0)?,
            direction,
            status: row.get(2)?,
            from_asset: row.get(3)?,
            from_amount: row.get(4)?,
            to_asset: row.get(5)?,
            to_amount: row.get(6)?,
            receiving_address: row.get(7)?,
            ephemeral_address: row.get(8)?,
            refund_address: row.get(9)?,
            recipient_address: row.get(10)?,
            quote_hash: row.get(11)?,
            intent_hash: row.get(12)?,
            zcash_txid: row.get(13)?,
            fulfillment_txid: row.get(14)?,
            created_at: row.get(15)?,
            expires_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(swaps)
}
