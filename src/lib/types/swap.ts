// Swap-related type definitions

export type SwapDirection = 'inbound' | 'crosspay';

export type SwapStatus =
  | 'quoting'
  | 'quoted'
  | 'awaiting_deposit'
  | 'deposit_detected'
  | 'building_tx'
  | 'broadcasting_zec'
  | 'zec_confirmed'
  | 'fulfilling'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface Asset {
  chain: string;
  symbol: string;
  identifier: string;
  name: string;
  decimals: number;
  icon?: string;
  defuseAssetId?: string; // NEAR Intents asset ID
}

export interface SwapQuote {
  quoteHash: string;
  provider: string;
  fromAmount: string;
  toAmount: string;
  feePercent: number;
  expiresAt: number;
  estimatedTime: number;
  raw?: unknown; // Original quote object from SwapKit
}

export interface ActiveSwap {
  id: string;
  direction: SwapDirection;
  status: SwapStatus;
  fromAsset: Asset;
  fromAmount: string;
  toAsset: Asset;
  toAmount: string;
  depositAddress?: string;
  receivingAddress?: string;
  recipientAddress?: string;
  refundAddress?: string;
  ephemeralAddress?: string;
  quoteHash: string;
  intentHash?: string;
  zcashTxid?: string;
  fulfillmentTxid?: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
}

export interface SwapState {
  activeSwap: ActiveSwap | null;
  quotes: SwapQuote[];
  quotesLoading: boolean;
  quotesError: string | null;
  supportedAssets: Asset[];
  swapHistory: ActiveSwap[];
}

export interface SwapAddress {
  address: string;
  addressType: 'shielded' | 'transparent';
  index: number;
}

// Backend swap record (matches Rust struct)
export interface SwapRecord {
  id: string;
  direction: SwapDirection;
  status: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  receiving_address?: string;
  ephemeral_address?: string;
  refund_address?: string;
  recipient_address?: string;
  quote_hash?: string;
  intent_hash?: string;
  zcash_txid?: string;
  fulfillment_txid?: string;
  created_at: number;
  expires_at?: number;
  completed_at?: number;
}
