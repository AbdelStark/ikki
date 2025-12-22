//! Zcash wallet module for Ikki
//!
//! Provides wallet management, sync, and transaction operations.

#[cfg(feature = "wallet")]
mod config;
#[cfg(feature = "wallet")]
mod core;

#[cfg(feature = "wallet")]
pub use config::*;
#[cfg(feature = "wallet")]
pub use core::*;

// Stub implementation for mobile (iOS/Android) where wallet feature is disabled
#[cfg(not(feature = "wallet"))]
pub struct IkkiWallet;

#[cfg(not(feature = "wallet"))]
impl IkkiWallet {
    pub fn new(_seed_phrase: &str, _birthday_height: Option<u32>) -> anyhow::Result<Self> {
        Err(anyhow::anyhow!("Wallet functionality not available on this platform"))
    }
}
