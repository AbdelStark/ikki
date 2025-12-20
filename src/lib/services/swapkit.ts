// SwapKit SDK wrapper for NEAR Intents integration

import type { Asset, SwapQuote } from '../types/swap';

// ZEC asset identifier for SwapKit
const ZEC_ASSET = 'ZEC.ZEC';

// NEAR Intents API endpoint for token list
const NEAR_INTENTS_TOKENS_API = 'https://api-mng-console.chaindefuser.com/api/tokens';

// Mock mode for development (requires API key for real mode)
// Set VITE_USE_MOCK_SWAPKIT=false and VITE_SWAPKIT_API_KEY=xxx to use real API
const USE_MOCK = import.meta.env.VITE_USE_MOCK_SWAPKIT !== 'false' || !import.meta.env.VITE_SWAPKIT_API_KEY;

// Cache for supported assets
let cachedAssets: Asset[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// SwapKit API (imported dynamically)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swapKitApi: any = null;

async function getSwapKitApi() {
  if (swapKitApi) return swapKitApi;

  try {
    // Import the SwapKitApi from @swapkit/helpers/api subpath
    const apiModule = await import('@swapkit/helpers/api');
    swapKitApi = apiModule.SwapKitApi;
    console.log('SwapKitApi loaded:', Object.keys(swapKitApi));
    return swapKitApi;
  } catch (error) {
    console.error('Failed to import SwapKit API:', error);
    // Fallback: try main package
    try {
      const { SwapKitApi } = await import('@swapkit/helpers');
      swapKitApi = SwapKitApi;
      console.log('SwapKitApi loaded from main:', Object.keys(swapKitApi));
      return swapKitApi;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw new Error('SwapKit API initialization failed');
    }
  }
}

// Mock swap status tracking (for simulating progress in dev mode)
const mockSwapProgress: Map<string, { startTime: number; depositDetected: boolean }> = new Map();

// Mock implementation for development
const mockSwapKit = {
  async getAssets(): Promise<Asset[]> {
    return [
      { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8 },
      { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18 },
      { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9 },
      { chain: 'ETH', symbol: 'USDC', identifier: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USD Coin', decimals: 6 },
    ];
  },

  async getQuote(sellAsset: string, sellAmount: string, buyAsset: string): Promise<SwapQuote[]> {
    await new Promise((r) => setTimeout(r, 500)); // Simulate network delay
    // Calculate mock rate based on assets
    const mockRates: Record<string, number> = {
      'BTC.BTC': 42000,
      'ETH.ETH': 2200,
      'SOL.SOL': 100,
      'ZEC.ZEC': 25,
    };
    const sellRate = mockRates[sellAsset] || 100;
    const buyRate = mockRates[buyAsset] || 100;
    const sellAmountNum = parseFloat(sellAmount);
    const buyAmount = (sellAmountNum * sellRate / buyRate).toFixed(8);

    return [
      {
        quoteHash: `mock-${Date.now()}`,
        provider: 'NEAR_INTENTS',
        fromAmount: sellAmount,
        toAmount: buyAmount,
        feePercent: 0.003, // 0.3% fee
        expiresAt: Date.now() + 60000,
        estimatedTime: 120,
        raw: { sellAsset, buyAsset, sellAmount, buyAmount },
      },
    ];
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeSwap(_quote: SwapQuote): Promise<{ intentHash: string; depositAddress: string }> {
    await new Promise((r) => setTimeout(r, 300));
    const intentHash = `mock-intent-${Date.now()}`;
    // Initialize mock progress tracking
    mockSwapProgress.set(intentHash, { startTime: Date.now(), depositDetected: false });
    return {
      intentHash,
      depositAddress: 't1MockDepositAddress123456789abcdef',
    };
  },

  async getStatus(intentHash: string): Promise<{ status: string; txHash?: string; error?: string }> {
    // Simulate realistic status progression based on time elapsed
    const progress = mockSwapProgress.get(intentHash);
    if (!progress) {
      return { status: 'UNKNOWN' };
    }

    const elapsed = Date.now() - progress.startTime;

    // Simulate status progression:
    // 0-10s: PENDING (waiting for deposit)
    // 10-20s: CONFIRMING (deposit detected, confirming)
    // 20-35s: SWAPPING (swap in progress)
    // 35-45s: COMPLETING (sending output)
    // 45s+: COMPLETED

    if (elapsed < 10000) {
      return { status: 'PENDING' };
    } else if (elapsed < 20000) {
      return { status: 'CONFIRMING', txHash: `mock-deposit-tx-${intentHash.slice(-8)}` };
    } else if (elapsed < 35000) {
      return { status: 'SWAPPING', txHash: `mock-deposit-tx-${intentHash.slice(-8)}` };
    } else if (elapsed < 45000) {
      return { status: 'COMPLETING', txHash: `mock-output-tx-${intentHash.slice(-8)}` };
    } else {
      return { status: 'COMPLETED', txHash: `mock-output-tx-${intentHash.slice(-8)}` };
    }
  },
};

/**
 * Fetch assets from NEAR Intents API
 */
async function fetchNearIntentsAssets(): Promise<Asset[]> {
  try {
    // Add timeout to prevent hanging (3 seconds - fast fallback if CORS blocks it)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(NEAR_INTENTS_TOKENS_API, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    // Map NEAR Intents token format to our Asset type
    const assets: Asset[] = items
      .filter((token: { symbol: string }) => token.symbol !== 'ZEC') // Exclude ZEC itself
      .map((token: {
        defuse_asset_id: string;
        symbol: string;
        blockchain: string;
        decimals: number;
        price?: number;
        contract_address?: string;
      }) => {
        // Build identifier in SwapKit format (CHAIN.SYMBOL or CHAIN.SYMBOL-CONTRACT)
        const chain = mapBlockchainToChain(token.blockchain);
        let identifier = `${chain}.${token.symbol}`;
        if (token.contract_address && token.contract_address !== 'native') {
          identifier = `${chain}.${token.symbol}-${token.contract_address}`;
        }

        return {
          chain,
          symbol: token.symbol,
          identifier,
          name: token.symbol, // API doesn't provide full name
          decimals: token.decimals,
          defuseAssetId: token.defuse_asset_id, // Keep original ID for NEAR Intents API
        };
      });

    // Sort by popular assets first
    const popularOrder = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'NEAR', 'ARB', 'MATIC', 'AVAX', 'DOT'];
    assets.sort((a, b) => {
      const aIdx = popularOrder.indexOf(a.symbol);
      const bIdx = popularOrder.indexOf(b.symbol);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return assets;
  } catch (error) {
    console.error('Failed to fetch NEAR Intents assets:', error);
    throw error;
  }
}

/**
 * Map NEAR Intents blockchain names to standard chain identifiers
 */
function mapBlockchainToChain(blockchain: string): string {
  const mapping: Record<string, string> = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'solana': 'SOL',
    'near': 'NEAR',
    'arbitrum': 'ARB',
    'base': 'BASE',
    'polygon': 'MATIC',
    'bsc': 'BSC',
    'avalanche': 'AVAX',
    'optimism': 'OP',
    'sui': 'SUI',
    'dogecoin': 'DOGE',
    'litecoin': 'LTC',
    'xrp': 'XRP',
    'zcash': 'ZEC',
    'aurora': 'AURORA',
    'turbochain': 'TURBO',
  };
  return mapping[blockchain.toLowerCase()] || blockchain.toUpperCase();
}

// Static fallback assets
const FALLBACK_ASSETS: Asset[] = [
  { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8 },
  { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18 },
  { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9 },
  { chain: 'NEAR', symbol: 'NEAR', identifier: 'NEAR.NEAR', name: 'NEAR Protocol', decimals: 24 },
  { chain: 'ARB', symbol: 'ARB', identifier: 'ARB.ARB', name: 'Arbitrum', decimals: 18 },
  { chain: 'ETH', symbol: 'USDC', identifier: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USD Coin', decimals: 6 },
  { chain: 'ETH', symbol: 'USDT', identifier: 'ETH.USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether', decimals: 6 },
  { chain: 'DOGE', symbol: 'DOGE', identifier: 'DOGE.DOGE', name: 'Dogecoin', decimals: 8 },
  { chain: 'LTC', symbol: 'LTC', identifier: 'LTC.LTC', name: 'Litecoin', decimals: 8 },
  { chain: 'AVAX', symbol: 'AVAX', identifier: 'AVAX.AVAX', name: 'Avalanche', decimals: 18 },
];

/**
 * Get list of supported assets that can swap with ZEC
 * Fetches from NEAR Intents API with caching
 */
export async function getSupportedAssets(): Promise<Asset[]> {
  console.log('getSupportedAssets called, USE_MOCK:', USE_MOCK);

  // In mock mode or dev, use fallback assets directly (avoids CORS issues)
  // For testing, always return fallback immediately
  console.log('Returning fallback assets:', FALLBACK_ASSETS.length);
  return FALLBACK_ASSETS;

  /* Disabled for now due to CORS issues in Tauri webview
  // Check cache first
  if (cachedAssets && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedAssets;
  }

  try {
    // Try to fetch from NEAR Intents API
    const assets = await fetchNearIntentsAssets();
    cachedAssets = assets;
    cacheTimestamp = Date.now();
    console.log(`Loaded ${assets.length} assets from NEAR Intents`);
    return assets;
  } catch (error) {
    console.warn('Failed to fetch from NEAR Intents API, using fallback:', error);
    // Fallback to static list if API fails
    return FALLBACK_ASSETS;
  }
  */
}


/**
 * Get quotes for inbound swap (external asset → ZEC)
 */
export async function getInboundQuotes(
  fromAsset: string,
  fromAmount: string,
  receivingAddress: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    return mockSwapKit.getQuote(fromAsset, fromAmount, ZEC_ASSET);
  }

  try {
    const api = await getSwapKitApi();

    // Get swap quotes from SwapKit API
    const response = await api.getSwapQuote({
      sellAsset: fromAsset,
      buyAsset: ZEC_ASSET,
      sellAmount: fromAmount,
      destinationAddress: receivingAddress,
      slippage: 3, // 3% default slippage
      providers: ['NEAR_INTENTS', 'GARDEN', 'CHAINFLIP', 'THORCHAIN'], // Prefer NEAR Intents
    });

    console.log('Quote response:', response);

    // Map the routes to our SwapQuote format
    const quotes: SwapQuote[] = (response.routes || []).map((route: {
      routeId: string;
      providers: string[];
      sellAmount: string;
      expectedBuyAmount: string;
      fees: Array<{ amount: string; asset: string }>;
      expiration?: string;
      estimatedTime?: { total: number };
      meta?: { near?: unknown; garden?: unknown; chainflip?: unknown };
    }) => {
      // Calculate fee percentage from fees
      const totalFeeAmount = route.fees?.reduce((sum: number, fee: { amount: string }) => sum + parseFloat(fee.amount || '0'), 0) || 0;
      const sellAmountNum = parseFloat(route.sellAmount || fromAmount);
      const feePercent = sellAmountNum > 0 ? totalFeeAmount / sellAmountNum : 0;

      return {
        quoteHash: route.routeId,
        provider: route.providers?.[0] || 'UNKNOWN',
        fromAmount: route.sellAmount || fromAmount,
        toAmount: route.expectedBuyAmount,
        feePercent,
        expiresAt: route.expiration ? new Date(route.expiration).getTime() : Date.now() + 60000,
        estimatedTime: route.estimatedTime?.total || 120,
        raw: route, // Store full route for execution
      };
    });

    return quotes;
  } catch (error) {
    console.error('Failed to get inbound quotes:', error);
    throw error;
  }
}

/**
 * Get quotes for CrossPay (ZEC → external asset)
 * Note: For CrossPay, we need to calculate the ZEC amount needed to get the desired output
 */
export async function getCrossPayQuotes(
  toAsset: string,
  toAmount: string,
  recipientAddress: string,
  sourceAddress?: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    // For mock, calculate reverse - how much ZEC needed for toAmount
    return mockSwapKit.getQuote(ZEC_ASSET, toAmount, toAsset);
  }

  try {
    const api = await getSwapKitApi();

    // For CrossPay, we want to know how much ZEC we need to send
    // to receive a specific amount of the target asset.
    // SwapKit API works with sellAmount, so we estimate by getting a quote first.

    // Get a quote for selling ZEC to get the target asset
    const response = await api.getSwapQuote({
      sellAsset: ZEC_ASSET,
      buyAsset: toAsset,
      sellAmount: toAmount, // Use toAmount as initial estimate
      destinationAddress: recipientAddress,
      sourceAddress: sourceAddress,
      slippage: 3,
      providers: ['NEAR_INTENTS', 'GARDEN', 'CHAINFLIP', 'THORCHAIN'],
    });

    console.log('CrossPay quote response:', response);

    // Map to our format
    const quotes: SwapQuote[] = (response.routes || []).map((route: {
      routeId: string;
      providers: string[];
      sellAmount: string;
      expectedBuyAmount: string;
      fees: Array<{ amount: string; asset: string }>;
      expiration?: string;
      estimatedTime?: { total: number };
      meta?: { near?: unknown; garden?: unknown };
    }) => {
      const totalFeeAmount = route.fees?.reduce((sum: number, fee: { amount: string }) => sum + parseFloat(fee.amount || '0'), 0) || 0;
      const sellAmountNum = parseFloat(route.sellAmount || toAmount);
      const feePercent = sellAmountNum > 0 ? totalFeeAmount / sellAmountNum : 0;

      return {
        quoteHash: route.routeId,
        provider: route.providers?.[0] || 'UNKNOWN',
        fromAmount: route.sellAmount, // ZEC amount needed
        toAmount: route.expectedBuyAmount, // Target asset amount received
        feePercent,
        expiresAt: route.expiration ? new Date(route.expiration).getTime() : Date.now() + 60000,
        estimatedTime: route.estimatedTime?.total || 120,
        raw: route,
      };
    });

    return quotes;
  } catch (error) {
    console.error('Failed to get CrossPay quotes:', error);
    throw error;
  }
}

/**
 * Execute a swap (publish intent to solver bus)
 * For NEAR Intents, this creates a deposit channel and returns the deposit address
 */
export async function executeSwap(
  quote: SwapQuote,
  params: {
    sourceAddress: string; // ZEC address for CrossPay source
    destinationAddress: string; // Destination address for receiving funds
    sourceChainRefundAddress?: string; // Refund address on source chain (BTC, ETH, etc.)
    zecRefundAddress: string; // Shielded ZEC address for any ZEC-side refunds
  }
): Promise<{ intentHash: string; depositAddress: string }> {
  if (USE_MOCK) {
    return mockSwapKit.executeSwap(quote);
  }

  try {
    const api = await getSwapKitApi();
    const route = quote.raw as {
      meta?: {
        near?: {
          sellAsset: string;
          buyAsset: string;
          sellAmount: string;
          slippage: number;
          destinationAddress: string;
          sourceAddress: string;
        };
        garden?: {
          sellAsset: string;
          buyAsset: string;
          sellAmount: string;
          slippage: number;
          destinationAddress: string;
          sourceAddress: string;
        };
      };
      sellAsset: string;
      buyAsset: string;
      sellAmount: string;
    };

    // Check if this is a NEAR Intents route
    const nearMeta = route.meta?.near || route.meta?.garden;
    if (nearMeta) {
      // Use the NEAR deposit channel API
      const result = await api.getNearDepositChannel({
        sellAsset: nearMeta.sellAsset || route.sellAsset,
        buyAsset: nearMeta.buyAsset || route.buyAsset,
        sellAmount: nearMeta.sellAmount || route.sellAmount,
        slippage: nearMeta.slippage || 3,
        destinationAddress: params.destinationAddress,
        sourceAddress: params.sourceAddress,
        // Refund addresses
        refundAddress: params.sourceChainRefundAddress, // Source chain refund
        zecRefundAddress: params.zecRefundAddress, // ZEC-side refund (shielded)
      });

      console.log('NEAR deposit channel result:', result);

      return {
        intentHash: result.signature || quote.quoteHash,
        depositAddress: result.depositAddress,
      };
    }

    // For other providers (THORChain, Chainflip), use the inbound address from the route
    // The user needs to send funds to the inboundAddress with the memo
    const inboundAddress = (route as { inboundAddress?: string }).inboundAddress;
    if (inboundAddress) {
      return {
        intentHash: quote.quoteHash,
        depositAddress: inboundAddress,
      };
    }

    throw new Error('No deposit address available for this route');
  } catch (error) {
    console.error('Failed to execute swap:', error);
    throw error;
  }
}

/**
 * Get swap status from solver bus / tracker
 */
export async function getSwapStatus(intentHash: string, txHash?: string): Promise<{
  status: string;
  txHash?: string;
  error?: string;
  fromAmount?: string;
  toAmount?: string;
}> {
  if (USE_MOCK) {
    return mockSwapKit.getStatus(intentHash);
  }

  try {
    const api = await getSwapKitApi();

    // Try to track by hash or intentHash
    const trackingParams: { hash?: string; intentHash?: string } = {};
    if (txHash) {
      trackingParams.hash = txHash;
    } else {
      trackingParams.hash = intentHash;
    }

    const result = await api.getTrackerDetails(trackingParams);
    console.log('Tracking result:', result);

    // Map the tracking status to our simplified format
    const statusMap: Record<string, string> = {
      'not_started': 'PENDING',
      'starting': 'PENDING',
      'broadcasted': 'PENDING',
      'mempool': 'PENDING',
      'inbound': 'CONFIRMING',
      'swapping': 'SWAPPING',
      'outbound': 'COMPLETING',
      'completed': 'COMPLETED',
      'refunded': 'REFUNDED',
      'partially_refunded': 'REFUNDED',
      'dropped': 'FAILED',
      'reverted': 'FAILED',
      'replaced': 'FAILED',
      'retries_exceeded': 'FAILED',
      'parsing_error': 'FAILED',
    };

    return {
      status: statusMap[result.trackingStatus || result.status] || 'UNKNOWN',
      txHash: result.hash,
      fromAmount: result.fromAmount,
      toAmount: result.toAmount,
      error: result.status === 'failed' ? 'Transaction failed' : undefined,
    };
  } catch (error) {
    console.error('Failed to get swap status:', error);
    // Return unknown status if tracking fails (might just not be indexed yet)
    return { status: 'UNKNOWN' };
  }
}

/**
 * Detect which chain an address belongs to
 */
export function detectChain(address: string): string | null {
  // Zcash unified addresses
  if (address.startsWith('u1')) return 'zcash';
  // Zcash sapling
  if (address.startsWith('zs')) return 'zcash';
  // Zcash transparent
  if (address.startsWith('t1') || address.startsWith('t3')) return 'zcash';

  // Bitcoin (CHECK BEFORE SOLANA - legacy addresses start with 1 or 3)
  if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) return 'bitcoin';

  // Ethereum / EVM
  if (address.startsWith('0x') && address.length === 42) return 'ethereum';

  // Solana (base58, 32-44 chars, AFTER Bitcoin and Zcash checks)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'solana';

  // NEAR (account.near or implicit)
  if (address.endsWith('.near') || /^[a-f0-9]{64}$/.test(address)) return 'near';

  return null;
}

/**
 * Check if an address is a Zcash address
 */
export function isZcashAddress(address: string): boolean {
  return detectChain(address) === 'zcash';
}
