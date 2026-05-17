import crypto from "node:crypto";
import { X402Client } from "./client.js";
import { MemoryPaymentStore } from "./store.js";
import {
  resolveChainId,
  resolveTokenAddress,
  getTokenDecimals,
} from "./networks.js";
import type {
  PaywallConfig,
  PaywallVerification,
  PaymentSession,
  PaymentStore,
  X402ClientConfig,
} from "./types.js";

/**
 * Configuration for the PaywallMiddleware engine.
 */
export interface PaywallEngineConfig {
  x402: X402ClientConfig;
  store?: PaymentStore;
}

/**
 * Payment order terms returned to the caller when payment is required.
 */
export interface PaymentTerms {
  orderId: string;
  payToAddress: string;
  amountWei: string;
  tokenSymbol: string;
  tokenDecimals: number;
  chainId: number;
  chain: string;
  flow: string;
  expiresAt: string;
  protocol: "x402";
  paymentId: string;
}

/**
 * The core x402 Paywall Engine.
 *
 * Framework-agnostic. Handles:
 * 1. Check if request has a valid cached payment session
 * 2. If not, create an x402 order and return payment terms (HTTP 402)
 * 3. Verify payment when the client returns with a confirmed order ID
 * 4. Cache verified sessions for configurable TTL
 */
export class PaywallEngine {
  private readonly client: X402Client;
  private readonly store: PaymentStore;

  constructor(config: PaywallEngineConfig) {
    this.client = new X402Client(config.x402);
    this.store = config.store ?? new MemoryPaymentStore();
  }

  /** Expose the underlying x402 client for advanced use */
  getClient(): X402Client {
    return this.client;
  }

  /**
   * Check if a caller has an active paid session for an endpoint.
   */
  async getActiveSession(
    endpointKey: string,
    callerIdentity: string,
  ): Promise<PaymentSession | null> {
    const sessionKey = this.sessionKey(endpointKey, callerIdentity);
    const session = await this.store.get(sessionKey);
    if (session && session.expiresAt > Date.now()) {
      return session;
    }
    return null;
  }

  /**
   * Verify a request against the paywall.
   *
   * Returns paid=true if caller has a valid session.
   * Returns paid=false + order details if payment is needed.
   */
  async verify(
    endpointKey: string,
    callerIdentity: string,
    config: PaywallConfig,
  ): Promise<PaywallVerification> {
    if (config.allowFree) {
      return { paid: true };
    }

    // Check for existing valid payment session
    const session = await this.getActiveSession(endpointKey, callerIdentity);
    if (session) {
      return { paid: true };
    }

    return {
      paid: false,
      error: "Payment required. Send a POST to this endpoint with x402 order ID to pay.",
    };
  }

  /**
   * Create an x402 payment order for a protected resource.
   * Returns the payment terms the client needs to send to their wallet.
   */
  async createPaymentOrder(params: {
    endpointKey: string;
    callerIdentity: string;
    price: string;
    token: string;
    chain: string;
    chainId?: number;
    tokenAddress?: string;
    tokenDecimals?: number;
    sessionTtl?: number;
  }): Promise<PaymentTerms> {
    const chainId = params.chainId ?? this.resolveChainId(params.chain);
    const tokenAddress = params.tokenAddress ?? await this.resolveTokenAddress(params.chain, params.token, chainId);

    // Resolve token decimals dynamically
    const tokenDecimals =
      params.tokenDecimals ?? getTokenDecimals(params.token);
    const amountWei = parseUnits(params.price, tokenDecimals);

    const order = await this.client.createOrder({
      chainId,
      tokenAddress,
      amountWei,
      fromAddress: params.callerIdentity,
    });

    return {
      orderId: order.orderId,
      payToAddress: order.payToAddress,
      amountWei: order.amountWei,
      tokenSymbol: order.tokenSymbol,
      tokenDecimals: order.tokenDecimals ?? params.tokenDecimals ?? 6,
      chainId: order.chainId,
      chain: params.chain,
      flow: order.flow,
      expiresAt: order.expiresAt,
      protocol: "x402",
      paymentId: crypto.randomUUID(),
    };
  }

  /**
   * Confirm a payment was made and cache the session.
   * Call this after the client pays and provides the confirmed orderId.
   */
  async confirmPayment(params: {
    endpointKey: string;
    callerIdentity: string;
    orderId: string;
    sessionTtl: number;
  }): Promise<PaywallVerification> {
    try {
      const order = await this.client.waitForConfirmation(params.orderId, {
        timeoutMs: 30_000,
      });

      const ttlMs = params.sessionTtl * 1000;
      const session: PaymentSession = {
        orderId: order.orderId,
        payToAddress: order.payToAddress,
        amountWei: order.amountWei,
        tokenSymbol: order.tokenSymbol,
        chainId: order.chainId,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      };

      const sessionKey = this.sessionKey(params.endpointKey, params.callerIdentity);
      await this.store.set(sessionKey, session, params.sessionTtl);

      return { paid: true };
    } catch (err) {
      return {
        paid: false,
        error: err instanceof Error ? err.message : "Payment verification failed",
      };
    }
  }

  /**
   * Build a standard HTTP 402 response body with payment terms.
   */
  paymentRequiredResponse(terms: PaymentTerms): Record<string, unknown> {
    return {
      status: 402,
      title: "Payment Required",
      detail: "This endpoint requires payment via the x402 protocol.",
      documentation: "https://docs.goat.network/docs/build/x402/overview",
      payment: {
        orderId: terms.orderId,
        payToAddress: terms.payToAddress,
        amountWei: terms.amountWei,
        tokenSymbol: terms.tokenSymbol,
        tokenDecimals: terms.tokenDecimals,
        chainId: terms.chainId,
        flow: terms.flow,
        protocol: terms.protocol,
        expiresAt: terms.expiresAt,
      },
    };
  }

  private sessionKey(endpoint: string, caller: string): string {
    return `paywall:${endpoint}:${caller}`;
  }

  private resolveChainId(chain: string): number {
    return resolveChainId(chain);
  }

  private async resolveTokenAddress(chain: string, token: string, chainIdOverride?: number): Promise<string> {
    const chainId = chainIdOverride ?? this.resolveChainId(chain);

    // 1. Try dynamic resolution from merchant info
    try {
      const merchantInfo = (await this.client.getMerchantInfo()) as {
        supportedTokens?: Array<{ chainId: number; address: string; symbol: string }>;
      };
      const matched = merchantInfo.supportedTokens?.find(
        (t) => t.chainId === chainId && t.symbol.toUpperCase() === token.toUpperCase(),
      );
      if (matched) return matched.address;
    } catch {
      // Fall back to static config
    }

    // 2. Static resolution from networks.ts
    return resolveTokenAddress(chainId, token);
  }

}

/**
 * Parse a human-readable amount string into wei (smallest unit).
 * E.g., parseUnits("0.01", 6) => "10000"
 */
function parseUnits(amount: string, decimals: number): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  const combined = whole.replace(/^0+/, "") + paddedFraction;
  return combined === "" ? "0" : combined.replace(/^0+/, "") || "0";
}
