// NEAR Intents API integration for cross-chain swaps
// Provides swap quotes, execution, and status tracking via 1Click API

import type { Asset, SwapQuote } from '../types/swap';

// ZEC asset identifier
const ZEC_ASSET = 'ZEC.ZEC';

// NEAR Intents API endpoints
const NEAR_INTENTS_TOKENS_API = 'https://api-mng-console.chaindefuser.com/api/tokens';
const NEAR_INTENTS_1CLICK_API = 'https://1click.chaindefuser.com';

// NEAR Intents API key for production integration
const NEAR_INTENTS_API_KEY = import.meta.env.VITE_NEAR_INTENTS_API_KEY || '';

// Helper to make authenticated API calls to NEAR Intents 1Click API
async function nearIntentsApiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (NEAR_INTENTS_API_KEY) {
    headers['Authorization'] = `Bearer ${NEAR_INTENTS_API_KEY}`;
  }

  return fetch(`${NEAR_INTENTS_1CLICK_API}${endpoint}`, {
    ...options,
    headers,
  });
}

// Mock mode for development (requires API key for real mode)
const USE_MOCK = import.meta.env.VITE_USE_MOCK_NEAR_INTENTS !== 'false' || !NEAR_INTENTS_API_KEY;

// Cache for supported assets
let cachedAssets: Asset[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Mock swap status tracking (for simulating progress in dev mode)
const mockSwapProgress: Map<string, { startTime: number; depositDetected: boolean }> = new Map();

// Mock implementation for development
const mockNearIntents = {
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

    const headers: Record<string, string> = {};
    if (NEAR_INTENTS_API_KEY) {
      headers['Authorization'] = `Bearer ${NEAR_INTENTS_API_KEY}`;
    }

    const response = await fetch(NEAR_INTENTS_TOKENS_API, {
      signal: controller.signal,
      headers,
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
        // Build identifier in standard format (CHAIN.SYMBOL or CHAIN.SYMBOL-CONTRACT)
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

// Static fallback assets with NEAR Intents defuse_asset_id
const FALLBACK_ASSETS: Asset[] = [
  { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8, defuseAssetId: 'nep141:btc.omft.near' },
  { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18, defuseAssetId: 'nep141:eth.omft.near' },
  { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9, defuseAssetId: 'nep141:sol.omft.near' },
  { chain: 'NEAR', symbol: 'NEAR', identifier: 'NEAR.NEAR', name: 'NEAR Protocol', decimals: 24, defuseAssetId: 'nep141:wrap.near' },
  { chain: 'ETH', symbol: 'USDC', identifier: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USD Coin', decimals: 6, defuseAssetId: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near' },
  { chain: 'ETH', symbol: 'USDT', identifier: 'ETH.USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether', decimals: 6, defuseAssetId: 'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near' },
  { chain: 'DOGE', symbol: 'DOGE', identifier: 'DOGE.DOGE', name: 'Dogecoin', decimals: 8, defuseAssetId: 'nep141:doge.omft.near' },
  { chain: 'LTC', symbol: 'LTC', identifier: 'LTC.LTC', name: 'Litecoin', decimals: 8, defuseAssetId: 'nep141:ltc.omft.near' },
  { chain: 'ARB', symbol: 'ETH', identifier: 'ARB.ETH', name: 'Arbitrum ETH', decimals: 18, defuseAssetId: 'nep141:arb.omft.near' },
  { chain: 'BASE', symbol: 'ETH', identifier: 'BASE.ETH', name: 'Base ETH', decimals: 18, defuseAssetId: 'nep141:base.omft.near' },
];

/**
 * Get list of supported assets that can swap with ZEC
 * Fetches from NEAR Intents API with caching
 */
export async function getSupportedAssets(): Promise<Asset[]> {
  console.log('getSupportedAssets called, USE_MOCK:', USE_MOCK, 'HAS_API_KEY:', !!NEAR_INTENTS_API_KEY);

  // In mock mode, use fallback assets directly
  if (USE_MOCK) {
    console.log('Mock mode: Returning fallback assets:', FALLBACK_ASSETS.length);
    return FALLBACK_ASSETS;
  }

  // Check cache first
  if (cachedAssets && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('Returning cached assets:', cachedAssets.length);
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
}


/**
 * Map our asset identifier to NEAR Intents defuse_asset_id format
 * Format is NEP-141 tokens on NEAR: nep141:xxx.omft.near
 * @param assetIdentifier - The asset identifier in our format (e.g., "BTC.BTC")
 * @param defuseAssetId - Optional: the defuse_asset_id if already known from API
 */
function getDefuseAssetId(assetIdentifier: string, defuseAssetId?: string): string {
  // If defuseAssetId is provided directly, use it
  if (defuseAssetId) {
    return defuseAssetId;
  }
  // Map common identifiers to defuse asset IDs
  const assetMap: Record<string, string> = {
    // Native coins
    'BTC.BTC': 'nep141:btc.omft.near',
    'ETH.ETH': 'nep141:eth.omft.near',
    'SOL.SOL': 'nep141:sol.omft.near',
    'NEAR.NEAR': 'nep141:wrap.near',
    'ZEC.ZEC': 'nep141:zec.omft.near',
    'DOGE.DOGE': 'nep141:doge.omft.near',
    'LTC.LTC': 'nep141:ltc.omft.near',
    'AVAX.AVAX': 'nep245:v2_1.omni.hot.tg:43114_11111111111111111111', // AVAX uses nep245
    'ARB.ARB': 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near', // ARB token

    // Ethereum stablecoins
    'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    'ETH.USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7': 'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near',

    // Near native USDC
    'NEAR.USDC': 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',

    // Solana tokens
    'SOL.USDC': 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',

    // Base tokens
    'BASE.ETH': 'nep141:base.omft.near',
    'BASE.USDC': 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',

    // Arbitrum tokens
    'ARB.ETH': 'nep141:arb.omft.near',
    'ARB.USDC': 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
  };

  // First check if it's already in defuse format
  if (assetIdentifier.startsWith('nep141:') || assetIdentifier.startsWith('nep245:')) {
    return assetIdentifier;
  }

  return assetMap[assetIdentifier] || assetIdentifier;
}

/**
 * Convert amount to smallest units based on decimals
 */
function toSmallestUnits(amount: string, decimals: number): string {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return '0';
  const smallest = Math.floor(parsed * Math.pow(10, decimals));
  return smallest.toString();
}

/**
 * Get decimals for an asset
 */
function getAssetDecimals(assetIdentifier: string): number {
  // Common decimals by asset
  const decimalsMap: Record<string, number> = {
    'BTC.BTC': 8,
    'ETH.ETH': 18,
    'SOL.SOL': 9,
    'NEAR.NEAR': 24,
    'ZEC.ZEC': 8,
    'DOGE.DOGE': 8,
    'LTC.LTC': 8,
    'USDC': 6,
    'USDT': 6,
  };

  // Check exact match first
  if (decimalsMap[assetIdentifier]) {
    return decimalsMap[assetIdentifier];
  }

  // Check if it contains USDC or USDT
  if (assetIdentifier.includes('USDC')) return 6;
  if (assetIdentifier.includes('USDT')) return 6;

  // Default to 18 (most common for EVM tokens)
  return 18;
}

/**
 * Get quotes for inbound swap (external asset → ZEC)
 */
export async function getInboundQuotes(
  fromAsset: string,
  fromAmount: string,
  receivingAddress: string,
  defuseAssetId?: string,
  sourceChainRefundAddress?: string,
  fromDecimals?: number
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    return mockNearIntents.getQuote(fromAsset, fromAmount, ZEC_ASSET);
  }

  try {
    // Use NEAR Intents 1Click API directly
    const originAsset = getDefuseAssetId(fromAsset, defuseAssetId);
    const destinationAsset = getDefuseAssetId(ZEC_ASSET);

    // Calculate deadline (5 minutes from now)
    const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Refund address must be on the origin chain (e.g., ETH address for USDC)
    // If not provided, we can't get a quote
    if (!sourceChainRefundAddress) {
      throw new Error('Refund address is required for swap quotes');
    }

    // For dry run quotes, use a valid mainnet ZEC address format
    // The wallet may be on testnet, but NEAR Intents requires mainnet addresses
    // For actual execution, we'll need to use the real wallet address
    // This is a known valid mainnet transparent address format for quote validation
    const quoteRecipient = receivingAddress.startsWith('t1') || receivingAddress.startsWith('t3')
      ? receivingAddress
      : 't1VpYecBW4UudbGcy4ufh61eWxQCoFaUrPs'; // Placeholder for testnet wallets

    // Convert amount to smallest units (e.g., 100 USDC -> 100000000)
    const decimals = fromDecimals ?? getAssetDecimals(fromAsset);
    const amountInSmallestUnits = toSmallestUnits(fromAmount, decimals);

    const quoteRequest = {
      dry: true, // Dry run to get quote without executing
      swapType: 'EXACT_INPUT',
      slippageTolerance: 300, // 3% in basis points
      originAsset,
      destinationAsset,
      amount: amountInSmallestUnits,
      recipient: quoteRecipient,
      recipientType: 'DESTINATION_CHAIN', // Receive on destination chain (ZEC)
      depositType: 'ORIGIN_CHAIN', // Deposit on origin chain
      refundTo: sourceChainRefundAddress.toLowerCase(), // Refund to source chain address (lowercase required)
      refundType: 'ORIGIN_CHAIN', // Refund on origin chain if swap fails
      deadline,
    };

    console.log('NEAR Intents quote request:', JSON.stringify(quoteRequest, null, 2));
    console.log('Recipient address:', receivingAddress, 'length:', receivingAddress.length);

    const response = await nearIntentsApiFetch('/v0/quote', {
      method: 'POST',
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NEAR Intents API error:', response.status, errorText);
      throw new Error(`NEAR Intents API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('NEAR Intents quote response:', data);

    // API response structure: { quote: { amountOut, ... }, quoteRequest: {...}, signature, ... }
    const quoteData = data.quote || data;

    // Convert amountOut from smallest units to human readable (ZEC has 8 decimals)
    const amountOutRaw = quoteData.amountOut || quoteData.expectedOutput || '0';
    const amountOutFormatted = quoteData.amountOutFormatted || (parseFloat(amountOutRaw) / 1e8).toFixed(8);

    // Map to our SwapQuote format
    const quote: SwapQuote = {
      quoteHash: data.correlationId || `near-${Date.now()}`,
      provider: 'NEAR_INTENTS',
      fromAmount: fromAmount,
      toAmount: amountOutFormatted, // Human readable ZEC amount
      feePercent: 0.003, // ~0.3% fee
      expiresAt: new Date(deadline).getTime(),
      estimatedTime: quoteData.timeEstimate || 120,
      raw: data, // Store full response for execution
    };

    return [quote];
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
  sourceAddress?: string,
  defuseAssetId?: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    // For mock, calculate reverse - how much ZEC needed for toAmount
    return mockNearIntents.getQuote(ZEC_ASSET, toAmount, toAsset);
  }

  try {
    // Use NEAR Intents 1Click API directly
    const originAsset = getDefuseAssetId(ZEC_ASSET);
    const destinationAsset = getDefuseAssetId(toAsset, defuseAssetId);

    // Calculate deadline (5 minutes from now)
    const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const quoteRequest = {
      dry: true,
      swapType: 'EXACT_INPUT', // We're specifying how much ZEC to send
      slippageTolerance: 300, // 3% in basis points
      originAsset,
      destinationAsset,
      amount: toAmount,
      recipient: recipientAddress,
      recipientType: 'DESTINATION_CHAIN', // Receive on destination chain
      depositType: 'ORIGIN_CHAIN', // Deposit ZEC on origin chain
      refundTo: recipientAddress, // Refund to recipient if swap fails
      refundType: 'DESTINATION_CHAIN', // Refund on destination chain
      deadline,
    };

    console.log('CrossPay quote request:', quoteRequest);

    const response = await nearIntentsApiFetch('/v0/quote', {
      method: 'POST',
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NEAR Intents API error:', response.status, errorText);
      throw new Error(`NEAR Intents API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('CrossPay quote response:', data);

    // Map to our SwapQuote format
    const quote: SwapQuote = {
      quoteHash: data.quoteHash || `near-${Date.now()}`,
      provider: 'NEAR_INTENTS',
      fromAmount: toAmount, // ZEC amount
      toAmount: data.amountOut || data.expectedOutput || '0',
      feePercent: data.feePercent || 0.003,
      expiresAt: new Date(deadline).getTime(),
      estimatedTime: data.estimatedTime || 120,
      raw: data,
    };

    return [quote];
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
    return mockNearIntents.executeSwap(quote);
  }

  try {
    // For NEAR Intents, re-submit the quote with dry: false to get deposit address
    const rawQuote = quote.raw as {
      quoteRequest?: {
        originAsset: string;
        destinationAsset: string;
        amount: string;
        recipient: string;
        recipientType: string;
        depositType: string;
        refundTo: string;
        refundType: string;
        slippageTolerance: number;
        deadline: string;
      };
    };

    if (!rawQuote.quoteRequest) {
      throw new Error('Invalid quote data - missing quoteRequest');
    }

    // Use the destination address from params if it's a valid mainnet address
    const recipient = params.destinationAddress.startsWith('t1') || params.destinationAddress.startsWith('t3')
      ? params.destinationAddress
      : rawQuote.quoteRequest.recipient;

    // Create execution request (dry: false)
    const execRequest = {
      ...rawQuote.quoteRequest,
      dry: false, // Actually execute to get deposit address
      recipient,
      deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Fresh deadline
    };

    console.log('NEAR Intents execute request:', execRequest);

    const response = await nearIntentsApiFetch('/v0/quote', {
      method: 'POST',
      body: JSON.stringify(execRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NEAR Intents execution error:', response.status, errorText);
      throw new Error(`NEAR Intents execution error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('NEAR Intents execution response:', data);

    // Extract deposit address from response (it's inside data.quote for NEAR Intents)
    const depositAddress = data.quote?.depositAddress || data.depositAddress || data.deposit_address;
    if (!depositAddress) {
      console.error('Response structure:', JSON.stringify(data, null, 2));
      throw new Error('No deposit address in execution response');
    }

    return {
      intentHash: data.signature || data.correlationId || quote.quoteHash,
      depositAddress,
    };
  } catch (error) {
    console.error('Failed to execute swap:', error);
    throw error;
  }
}

// NEAR Intents Explorer API for status tracking
const NEAR_INTENTS_EXPLORER_API = 'https://explorer.near-intents.org/api/v0';

/**
 * Get swap status from NEAR Intents Explorer API
 * @param depositAddress - The deposit address from the quote
 * @param intentHash - Optional intent hash (correlation ID)
 */
export async function getSwapStatus(depositAddress: string, intentHash?: string): Promise<{
  status: string;
  txHash?: string;
  error?: string;
  fromAmount?: string;
  toAmount?: string;
}> {
  if (USE_MOCK) {
    return mockNearIntents.getStatus(intentHash || depositAddress);
  }

  try {
    // Query NEAR Intents Explorer API by deposit address
    const searchParam = depositAddress || intentHash;
    if (!searchParam) {
      return { status: 'UNKNOWN' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (NEAR_INTENTS_API_KEY) {
      headers['Authorization'] = `Bearer ${NEAR_INTENTS_API_KEY}`;
    }

    const response = await fetch(
      `${NEAR_INTENTS_EXPLORER_API}/transactions?search=${encodeURIComponent(searchParam)}`,
      { headers }
    );

    if (!response.ok) {
      console.error('Explorer API error:', response.status);
      return { status: 'UNKNOWN' };
    }

    const data = await response.json();
    console.log('Explorer API response:', data);

    // Find the matching transaction
    const transactions = data.transactions || data.items || [];
    if (transactions.length === 0) {
      // No transaction found yet - still pending deposit
      return { status: 'PENDING' };
    }

    // Get the most recent transaction for this deposit address
    const tx = transactions[0];

    // Map NEAR Intents status to our simplified format
    const statusMap: Record<string, string> = {
      'PENDING_DEPOSIT': 'PENDING',
      'PROCESSING': 'CONFIRMING',
      'SUCCESS': 'COMPLETED',
      'INCOMPLETE_DEPOSIT': 'PENDING',
      'REFUNDED': 'REFUNDED',
      'FAILED': 'FAILED',
    };

    return {
      status: statusMap[tx.status] || 'UNKNOWN',
      txHash: tx.depositTxHash || tx.txHash,
      fromAmount: tx.amountIn || tx.fromAmount,
      toAmount: tx.amountOut || tx.toAmount,
      error: tx.status === 'FAILED' ? tx.errorMessage || 'Transaction failed' : undefined,
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
