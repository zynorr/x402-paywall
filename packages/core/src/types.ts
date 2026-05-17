/** Payment flow modes supported by x402 */
export type PaymentFlow = "ERC20_DIRECT" | "ERC20_3009" | "ERC20_APPROVE_XFER";

/** Order status from the x402 API */
export enum OrderStatus {
  CHECKOUT_VERIFIED = "CHECKOUT_VERIFIED",
  PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
  INVOICED = "INVOICED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

/** A payment order from the x402 API */
export interface Order {
  orderId: string;
  flow: PaymentFlow;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  fromAddress: string;
  payToAddress: string;
  amountWei: string;
  amountHuman: string;
  status: OrderStatus;
  calldataSignRequest?: CalldataSignRequest;
  createdAt: string;
  expiresAt: string;
}

/** EIP-712 calldata signing request (DELEGATE mode) */
export interface CalldataSignRequest {
  domain: EIP712Domain;
  types: Record<string, EIP712Type[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface EIP712Type {
  name: string;
  type: string;
}

/** x402 API client configuration */
export interface X402ClientConfig {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  merchantId: string;
}

/** Paywall configuration for a protected endpoint */
export interface PaywallConfig {
  /** Price in token units (e.g., "0.01") */
  price: string;
  /** Token symbol (e.g., "USDC") */
  token?: string;
  /** Chain identifier (e.g., "goat-testnet") */
  chain?: string;
  /** Chain ID override (e.g., 48816 for GOAT Testnet3) */
  chainId?: number;
  /** Token contract address override (auto-resolved if not provided) */
  tokenAddress?: string;
  /** Token decimals override (auto-resolved if not provided) */
  tokenDecimals?: number;
  /** Duration in seconds that a paid request remains valid (default: 3600) */
  sessionTtl?: number;
  /** Custom handler for determining price based on request */
  priceResolver?: (request: unknown) => Promise<string> | string;
  /** Whether to allow free access (default: false) */
  allowFree?: boolean;
}

/** Result of paywall verification */
export interface PaywallVerification {
  paid: boolean;
  order?: Order;
  error?: string;
  remainingRequests?: number;
}

/** Payment session stored in cache */
export interface PaymentSession {
  orderId: string;
  payToAddress: string;
  amountWei: string;
  tokenSymbol: string;
  chainId: number;
  verifiedAt: number;
  expiresAt: number;
}

/** x402 API error response */
export interface X402ApiError {
  code: string;
  message: string;
  statusCode: number;
}

/** Healthy payment store interface */
export interface PaymentStore {
  get(key: string): Promise<PaymentSession | null>;
  set(key: string, session: PaymentSession, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}
