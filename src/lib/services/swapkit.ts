// SwapKit SDK wrapper for NEAR Intents integration

import type { Asset, SwapQuote } from '../types/swap';

// SwapKit SDK types (we'll refine these as we integrate)
interface SwapKitQuoteParams {
  sellAsset: string;
  buyAsset: string;
  sellAmount?: string;
  buyAmount?: string;
  recipientAddress?: string;
}

interface SwapKitExecuteParams {
  route: unknown;
  userAddress: string;
  refundAddress?: string;
}

interface SwapKitStatusResponse {
  status: string;
  txHash?: string;
  error?: string;
}

// ZEC asset identifier
const ZEC_ASSET = 'ZEC.ZEC';

// Mock mode for development
const USE_MOCK = import.meta.env.VITE_USE_MOCK_SWAPKIT === 'true';

// Mock implementation for development
const mockSwapKit = {
  async getAssets(): Promise<Asset[]> {
    return [
      { chain: 'BTC', symbol: 'BTC', identifier: 'BTC.BTC', name: 'Bitcoin', decimals: 8 },
      { chain: 'ETH', symbol: 'ETH', identifier: 'ETH.ETH', name: 'Ethereum', decimals: 18 },
      { chain: 'SOL', symbol: 'SOL', identifier: 'SOL.SOL', name: 'Solana', decimals: 9 },
      { chain: 'ETH', symbol: 'USDC', identifier: 'ETH.USDC', name: 'USD Coin', decimals: 6 },
    ];
  },

  async getQuote(_params: SwapKitQuoteParams): Promise<SwapQuote[]> {
    await new Promise((r) => setTimeout(r, 500)); // Simulate network delay
    return [
      {
        quoteHash: `mock-${Date.now()}`,
        provider: 'NEAR_INTENTS',
        fromAmount: '1.0',
        toAmount: '42.5',
        feePercent: 0.01,
        expiresAt: Date.now() + 60000,
        estimatedTime: 120,
        raw: {},
      },
    ];
  },

  async executeSwap(_params: SwapKitExecuteParams): Promise<{ intentHash: string; depositAddress: string }> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      intentHash: `mock-intent-${Date.now()}`,
      depositAddress: 'mock-deposit-address-abc123',
    };
  },

  async getStatus(_intentHash: string): Promise<SwapKitStatusResponse> {
    return { status: 'PENDING' };
  },
};

// Real SwapKit implementation
// NOTE: SwapKit SDK requires Node.js crypto polyfills for browser use.
// When ready to use real SDK:
// 1. Configure Vite with crypto polyfills (crypto-browserify, buffer, stream-browserify)
// 2. Uncomment the import below
// 3. Set VITE_USE_MOCK_SWAPKIT=false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRealSwapKitClient(): Promise<any> {
  // TODO: Enable when Vite is configured with Node.js polyfills
  // const { SwapKitApi } = await import('@swapkit/sdk');
  // return new SwapKitApi({ /* config */ });
  throw new Error(
    'SwapKit SDK not configured. Set VITE_USE_MOCK_SWAPKIT=true or configure Vite polyfills.'
  );
}

/**
 * Get list of supported assets that can swap with ZEC
 */
export async function getSupportedAssets(): Promise<Asset[]> {
  if (USE_MOCK) {
    return mockSwapKit.getAssets();
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('SwapKit client:', client);
    return [];
  } catch (error) {
    console.error('Failed to get supported assets:', error);
    return [];
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
    return mockSwapKit.getQuote({
      sellAsset: fromAsset,
      buyAsset: ZEC_ASSET,
      sellAmount: fromAmount,
      recipientAddress: receivingAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting quotes:', { fromAsset, fromAmount, receivingAddress, client });
    return [];
  } catch (error) {
    console.error('Failed to get inbound quotes:', error);
    throw error;
  }
}

/**
 * Get quotes for CrossPay (ZEC → external asset)
 */
export async function getCrossPayQuotes(
  toAsset: string,
  toAmount: string,
  recipientAddress: string
): Promise<SwapQuote[]> {
  if (USE_MOCK) {
    return mockSwapKit.getQuote({
      sellAsset: ZEC_ASSET,
      buyAsset: toAsset,
      buyAmount: toAmount,
      recipientAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting CrossPay quotes:', { toAsset, toAmount, recipientAddress, client });
    return [];
  } catch (error) {
    console.error('Failed to get CrossPay quotes:', error);
    throw error;
  }
}

/**
 * Execute a swap (publish intent to solver bus)
 */
export async function executeSwap(
  quote: SwapQuote,
  params: {
    userAddress: string;
    refundAddress?: string;
  }
): Promise<{ intentHash: string; depositAddress: string }> {
  if (USE_MOCK) {
    return mockSwapKit.executeSwap({
      route: quote.raw,
      userAddress: params.userAddress,
      refundAddress: params.refundAddress,
    });
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Executing swap:', { quote, params, client });
    throw new Error('Not implemented');
  } catch (error) {
    console.error('Failed to execute swap:', error);
    throw error;
  }
}

/**
 * Get swap status from solver bus
 */
export async function getSwapStatus(intentHash: string): Promise<{
  status: string;
  txHash?: string;
  error?: string;
}> {
  if (USE_MOCK) {
    return mockSwapKit.getStatus(intentHash);
  }

  try {
    const client = await getRealSwapKitClient();
    // TODO: Implement based on actual SwapKit API
    console.log('Getting status:', { intentHash, client });
    return { status: 'UNKNOWN' };
  } catch (error) {
    console.error('Failed to get swap status:', error);
    throw error;
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
