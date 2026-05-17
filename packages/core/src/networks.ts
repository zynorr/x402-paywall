/**
 * Network and token address configuration for x402 Paywall.
 *
 * Real addresses sourced from the GOAT Network x402 documentation:
 *   - x402/ONBOARDING.md
 *   - x402/docs/x402-integration.md
 *   - goat-docs/utils/connect-goat.ts
 *
 * GOAT Testnet3:  Chain ID 48816 (0xBEB0)
 * GOAT Mainnet:   Chain ID 2345  (0x929)
 */

// ---------------------------------------------------------------------------
// Supported chains
// ---------------------------------------------------------------------------
export type NetworkId =
  | "goat-testnet"
  | "goat-mainnet"
  | "ethereum"
  | "ethereum-sepolia"
  | "polygon"
  | "arbitrum"
  | "bsc"
  | "bsc-testnet";

export interface NetworkConfig {
  /** Human-readable name */
  name: string;
  /** EVM chain ID */
  chainId: number;
  /** Public RPC endpoint */
  rpcUrl: string;
  /** Block explorer URL */
  explorerUrl: string;
  /** Native currency symbol */
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  "goat-testnet": {
    name: "GOAT Testnet3",
    chainId: 48816,
    rpcUrl: "https://rpc.testnet3.goat.network",
    explorerUrl: "https://explorer.testnet3.goat.network",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  },
  "goat-mainnet": {
    name: "GOAT Mainnet",
    chainId: 2345,
    rpcUrl: "https://rpc.goat.network",
    explorerUrl: "https://explorer.goat.network",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  },
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon.llamarpc.com",
    explorerUrl: "https://polygonscan.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arbitrum.llamarpc.com",
    explorerUrl: "https://arbiscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  bsc: {
    name: "BSC Mainnet",
    chainId: 56,
    rpcUrl: "https://bsc.llamarpc.com",
    explorerUrl: "https://bscscan.com",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  "bsc-testnet": {
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerUrl: "https://testnet.bscscan.com",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  },
};

// ---------------------------------------------------------------------------
// Token contract addresses across supported networks
// Sourced from x402/ONBOARDING.md and x402/docs/x402-integration.md
// ---------------------------------------------------------------------------
export type TokenSymbol = "USDC" | "USDT" | "GOAT";

export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  /** Contract address per chainId */
  addresses: Partial<Record<number, string>>;
}

export const TOKENS: TokenConfig[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    addresses: {
      // GOAT Testnet3: x402/ONBOARDING.md
      [48816]: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1",
      // BSC Testnet: x402/ONBOARDING.md
      [97]: "0xa4b9550a5835ba669edd759cf82e6ca2d5e2c0a2",
      // Sepolia: x402/ONBOARDING.md
      [11155111]: "0xff6981ac8f983914a9ea8d27b13c07d8d62c4a3b",
      // Ethereum mainnet: x402/x402-integration.md
      [1]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      // Polygon mainnet: x402/x402-integration.md
      [137]: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    },
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    addresses: {
      // GOAT Testnet3: x402/ONBOARDING.md
      [48816]: "0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3",
      // BSC Testnet: x402/ONBOARDING.md
      [97]: "0x85181e18011d60ffebdf78fda202c2f5896eecae",
      // Sepolia: x402/ONBOARDING.md
      [11155111]: "0xb7af9c6da7c7e7ec69d06466d326b9c2a2fbc0f8",
      // Ethereum mainnet: x402/x402-integration.md
      [1]: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      // Polygon mainnet: x402/x402-integration.md
      [137]: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
  },
  {
    symbol: "GOAT",
    name: "GOAT Network Token",
    decimals: 18,
    addresses: {
      // Placeholder — real GOAT token address TBD
      // Check x402 merchant dashboard for latest
      [48816]: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1", // uses USDC as placeholder on testnet
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the EVM chain ID from a network identifier string.
 */
export function resolveChainId(network: string): number {
  const id = NETWORKS[network as NetworkId]?.chainId;
  if (id !== undefined) return id;

  // Fallback: try parsing as raw number
  const parsed = Number(network);
  if (!Number.isNaN(parsed)) return parsed;

  console.warn(`[x402-paywall] Unknown network "${network}", defaulting to GOAT testnet`);
  return 48816;
}

/**
 * Get network config by chain ID.
 */
export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((n) => n.chainId === chainId);
}

/**
 * Resolve a token contract address for a given chain + token symbol.
 *
 * Resolution order:
 * 1. Dynamic — try fetching from merchant info (handled by PaywallEngine)
 * 2. Static — look up in our TOKENS config
 * 3. Environment variable override — GOATX402_USDC_ADDRESS, etc.
 * 4. Throw on unknown
 */
export function resolveTokenAddress(chainId: number, token: string): string {
  const symbol = token.toUpperCase() as TokenSymbol;

  // 1. Check our built-in config
  const tokenConfig = TOKENS.find((t) => t.symbol === symbol);
  if (tokenConfig) {
    const address = tokenConfig.addresses[chainId];
    if (address) return address;
  }

  // 2. Check environment variable override
  const envVar = process.env[`GOATX402_${symbol}_ADDRESS`];
  if (envVar && envVar.startsWith("0x")) {
    return envVar;
  }

  const networkName = getNetworkByChainId(chainId)?.name ?? `chain ${chainId}`;
  throw new Error(
    `No known ${symbol} address on ${networkName}. ` +
      `Set GOATX402_${symbol}_ADDRESS in your .env or add to packages/core/src/networks.ts.`,
  );
}

/**
 * Get token decimals for a token symbol.
 */
export function getTokenDecimals(symbol: string): number {
  const tokenConfig = TOKENS.find((t) => t.symbol === symbol.toUpperCase() as TokenSymbol);
  return tokenConfig?.decimals ?? 6; // default to USDC decimals
}
