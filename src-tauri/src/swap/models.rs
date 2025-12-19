//! Data models for swap operations

use serde::{Deserialize, Serialize};

/// Direction of swap
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SwapDirection {
    /// External asset → ZEC
    Inbound,
    /// ZEC → External asset (CrossPay)
    CrossPay,
}

/// Swap record for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRecord {
    pub id: String,
    pub direction: SwapDirection,
    pub status: String,
    pub from_asset: String,
    pub from_amount: String,
    pub to_asset: String,
    pub to_amount: String,
    pub receiving_address: Option<String>,
    pub ephemeral_address: Option<String>,
    pub refund_address: Option<String>,
    pub recipient_address: Option<String>,
    pub quote_hash: Option<String>,
    pub intent_hash: Option<String>,
    pub zcash_txid: Option<String>,
    pub fulfillment_txid: Option<String>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub completed_at: Option<i64>,
}

/// Address type for swap receiving
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AddressType {
    Shielded,
    Transparent,
}

/// Swap address response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapAddress {
    pub address: String,
    pub address_type: AddressType,
    pub index: u32,
}

/// Prepared transaction for CrossPay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreparedTransaction {
    pub id: String,
    pub from_address: String,
    pub to_address: String,
    pub amount_zatoshi: u64,
    pub fee_zatoshi: u64,
    pub expires_at: i64,
}
