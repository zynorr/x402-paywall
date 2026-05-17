import { X402ClientConfig, Order, OrderStatus, X402ApiError } from "./types.js";
import crypto from "node:crypto";
import fetch from "node-fetch";

/**
 * Low-level x402 API client with HMAC-SHA256 authentication.
 * Handles order creation, status polling, and proof retrieval.
 */
export class X402Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly merchantId: string;

  constructor(config: X402ClientConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.merchantId = config.merchantId;
  }

  /**
   * Generate HMAC-SHA256 signature for x402 API auth.
   */
  private sign(timestamp: string, method: string, path: string, body?: string): string {
    const message = [timestamp, method, path, body || ""].join(":");
    return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex");
  }

  /**
   * Build authenticated headers for x402 API requests.
   */
  private authHeaders(method: string, path: string, body?: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(timestamp, method, path, body);
    return {
      "X-API-Key": this.apiKey,
      "X-Timestamp": timestamp,
      "X-Sign": signature,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a payment order. Returns the order + payment instructions.
   * This is what gets sent to the client as HTTP 402.
   */
  async createOrder(params: {
    chainId: number;
    tokenAddress: string;
    amountWei: string;
    fromAddress?: string;
    flow?: string;
  }): Promise<Order> {
    const path = "/api/v1/orders";
    const body = JSON.stringify({
      merchantId: this.merchantId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      amountWei: params.amountWei,
      fromAddress: params.fromAddress,
      flow: params.flow || "ERC20_DIRECT",
    });

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.authHeaders("POST", path, body),
      body,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as Partial<X402ApiError>;
      throw new Error(`x402 createOrder failed: ${response.status} — ${error.message || response.statusText}`);
    }

    return response.json() as Promise<Order>;
  }

  /**
   * Poll order status until confirmed or terminal state.
   */
  async getOrderStatus(orderId: string): Promise<Order> {
    const path = `/api/v1/orders/${orderId}`;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.authHeaders("GET", path),
    });

    if (!response.ok) {
      throw new Error(`x402 getOrderStatus failed: ${response.status}`);
    }

    return response.json() as Promise<Order>;
  }

  /**
   * Poll until order reaches a terminal state.
   */
  async waitForConfirmation(
    orderId: string,
    options?: { intervalMs?: number; timeoutMs?: number },
  ): Promise<Order> {
    const interval = options?.intervalMs ?? 2000;
    const timeout = options?.timeoutMs ?? 60_000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const order = await this.getOrderStatus(orderId);
      if (order.status === OrderStatus.PAYMENT_CONFIRMED) return order;
      if ([OrderStatus.FAILED, OrderStatus.EXPIRED, OrderStatus.CANCELLED].includes(order.status)) {
        throw new Error(`x402 order ${orderId} terminated with status: ${order.status}`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`x402 order ${orderId} timed out waiting for confirmation`);
  }

  /**
   * Retrieve payment proof for audit/reconciliation.
   */
  async getPaymentProof(orderId: string): Promise<unknown> {
    const path = `/api/v1/orders/${orderId}/proof`;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.authHeaders("GET", path),
    });

    if (!response.ok) {
      throw new Error(`x402 getPaymentProof failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Cancel an unpaid/abandoned order.
   */
  async cancelOrder(orderId: string): Promise<void> {
    const path = `/api/v1/orders/${orderId}/cancel`;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.authHeaders("POST", path),
    });

    if (!response.ok) {
      throw new Error(`x402 cancelOrder failed: ${response.status}`);
    }
  }

  /**
   * Get public merchant info (supported chains, tokens).
   */
  async getMerchantInfo(): Promise<unknown> {
    const path = `/merchants/${this.merchantId}`;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.authHeaders("GET", path),
    });

    if (!response.ok) {
      throw new Error(`x402 getMerchantInfo failed: ${response.status}`);
    }

    return response.json();
  }
}
