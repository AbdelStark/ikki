import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Types matching Rust structs
export interface BalanceInfo {
  total: number;
  shielded: number;
  transparent: number;
}

export interface WalletInfo {
  address: string;
  balance: BalanceInfo;
  block_height: number;
}

export interface SyncResult {
  block_height: number;
  balance: BalanceInfo;
}

export interface SyncProgress {
  current_block: number;
  target_block: number;
  percentage: number;
  is_first_sync: boolean;
  status: string;
}

export interface SyncStatus {
  is_syncing: boolean;
  is_first_sync: boolean;
  current_block: number;
  target_block: number;
  percentage: number;
}

export interface SendResult {
  txid: string;
  amount: number;
  fee: number;
}

export interface Transaction {
  txid: string;
  tx_type: "sent" | "received" | "shielding" | "internal";
  amount: number;
  timestamp: number;
  address: string | null;
  memo: string | null;
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
}

// Wallet API
export async function checkWalletExists(): Promise<boolean> {
  return invoke<boolean>("check_wallet_exists");
}

export async function generateSeed(): Promise<string> {
  return invoke<string>("generate_seed");
}

export async function initWallet(
  seed: string,
  birthdayHeight?: number
): Promise<WalletInfo> {
  return invoke<WalletInfo>("init_wallet", {
    seed,
    birthdayHeight: birthdayHeight ?? null,
  });
}

export async function loadWallet(
  seed: string,
  birthdayHeight?: number
): Promise<WalletInfo> {
  return invoke<WalletInfo>("load_wallet", {
    seed,
    birthdayHeight: birthdayHeight ?? null,
  });
}

export async function resetWallet(): Promise<void> {
  return invoke<void>("reset_wallet");
}

export async function autoLoadWallet(): Promise<WalletInfo | null> {
  return invoke<WalletInfo | null>("auto_load_wallet");
}

export async function getBalance(): Promise<BalanceInfo> {
  return invoke<BalanceInfo>("get_balance");
}

export async function getAddress(): Promise<string> {
  return invoke<string>("get_address");
}

export async function getNewAddress(): Promise<string> {
  return invoke<string>("get_new_address");
}

export async function getAllAddresses(): Promise<string[]> {
  return invoke<string[]>("get_all_addresses");
}

export async function syncWallet(): Promise<SyncResult> {
  return invoke<SyncResult>("sync_wallet");
}

// Transaction API
export async function sendTransaction(
  toAddress: string,
  amount: number,
  memo?: string
): Promise<SendResult> {
  return invoke<SendResult>("send_transaction", {
    toAddress,
    amount,
    memo: memo || null,
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  return invoke<Transaction[]>("get_transactions");
}

// Background Sync API
export async function startBackgroundSync(isFirstSync: boolean = false): Promise<void> {
  return invoke<void>("start_background_sync", { isFirstSync });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>("get_sync_status");
}

export async function cancelSync(): Promise<void> {
  return invoke<void>("cancel_sync");
}

// Sync event listeners (kept for potential future use, but polling is primary)
export function onSyncProgress(
  callback: (progress: SyncProgress) => void
): Promise<UnlistenFn> {
  return listen<SyncProgress>("sync-progress", (event) => {
    callback(event.payload);
  });
}

export function onSyncComplete(
  callback: (result: SyncResult) => void
): Promise<UnlistenFn> {
  return listen<SyncResult>("sync-complete", (event) => {
    callback(event.payload);
  });
}

export function onSyncError(
  callback: (error: string) => void
): Promise<UnlistenFn> {
  return listen<string>("sync-error", (event) => {
    callback(event.payload);
  });
}
