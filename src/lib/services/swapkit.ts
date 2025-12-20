// SwapKit SDK wrapper for NEAR Intents integration

import type { Asset, SwapQuote } from '../types/swap';

// ZEC asset identifier for SwapKit
const ZEC_ASSET = 'ZEC.ZEC';

// Mock mode for development (requires API key for real mode)
// Set VITE_USE_MOCK_SWAPKIT=false and VITE_SWAPKIT_API_KEY=xxx to use real API
const USE_MOCK = import.meta.env.VITE_USE_MOCK_SWAPKIT !== 'false' || !import.meta.env.VITE_SWAPKIT_API_KEY;

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
    return {
      intentHash: `mock-intent-${Date.now()}`,
      depositAddress: 't1MockDepositAddress123456789abcdef',
    };
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStatus(_intentHash: string): Promise<{ status: string; txHash?: string; error?: string }> {
    return { status: 'PENDING' };
  },
};

/**
 * Get list of supported assets that can swap with ZEC
 */
export async function getSupportedAssets(): Promise<Asset[]> {
  if (USE_MOCK) {
    return mockSwapKit.getAssets();
  }

  try {
    const api = await getSwapKitApi();

    // Get token list from NEAR Intents provider (garden/near)
    // We'll fetch from multiple providers to get a comprehensive list
    const providers = await api.getTokenListProviders();
    console.log('Available providers:', providers);

    // Filter for relevant providers (NEAR Intents, THORChain, Chainflip)
    const relevantProviders = ['thorswap', 'chainflip', 'garden'];
    const assets: Asset[] = [];
    const seenIdentifiers = new Set<string>();

    for (const providerInfo of providers) {
      if (!relevantProviders.includes(providerInfo.provider.toLowerCase())) continue;

      try {
        const tokenList = await api.getTokenList(providerInfo.provider);
        for (const token of tokenList.tokens || []) {
          // Skip ZEC itself and duplicates
          if (token.identifier === ZEC_ASSET || seenIdentifiers.has(token.identifier)) continue;
          seenIdentifiers.add(token.identifier);

          // Map to our Asset type
          assets.push({
            chain: token.chain || token.identifier.split('.')[0],
            symbol: token.symbol || token.ticker,
            identifier: token.identifier,
            name: token.name || token.ticker,
            decimals: token.decimals,
            icon: token.logoURI,
          });
        }
      } catch (providerError) {
        console.warn(`Failed to get tokens from ${providerInfo.provider}:`, providerError);
      }
    }

    // Sort by popular assets first
    const popularAssets = ['BTC.BTC', 'ETH.ETH', 'SOL.SOL'];
    assets.sort((a, b) => {
      const aPopular = popularAssets.indexOf(a.identifier);
      const bPopular = popularAssets.indexOf(b.identifier);
      if (aPopular >= 0 && bPopular >= 0) return aPopular - bPopular;
      if (aPopular >= 0) return -1;
      if (bPopular >= 0) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return assets;
  } catch (error) {
    console.error('Failed to get supported assets:', error);
    // Return a static fallback list if API fails
    return [
      { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8 },
      { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18 },
      { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9 },
    ];
  }
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
