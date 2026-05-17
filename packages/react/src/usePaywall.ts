import { useState, useCallback, useRef } from "react";

export type PaywallState =
  | "idle"
  | "checking"
  | "payment_required"
  | "creating_order"
  | "wallet_pending"
  | "signing"
  | "confirming"
  | "paid"
  | "expired"
  | "failed";

export interface PaywallOrder {
  orderId: string;
  payToAddress: string;
  amountWei: string;
  tokenSymbol: string;
  tokenDecimals: number;
  chainId: number;
  flow: string;
  expiresAt: string;
  paymentId: string;
}

export interface UsePaywallOptions {
  /** URL of your backend proxy that holds x402 API keys */
  backendUrl: string;
  /** The endpoint path being accessed */
  endpoint: string;
  /** Wallet address of the caller */
  callerAddress?: string;
}

export interface UsePaywallReturn {
  state: PaywallState;
  order: PaywallOrder | null;
  error: string | null;
  /** Check if the current endpoint is accessible */
  checkAccess: () => Promise<void>;
  /** Start the payment flow — creates order and returns payment details */
  pay: () => Promise<PaywallOrder>;
  /** Confirm payment after wallet transaction completes */
  confirmPayment: (orderId: string) => Promise<boolean>;
  /** Reset the paywall state */
  reset: () => void;
}

/**
 * React hook that manages the full x402 paywall lifecycle:
 * idle → checking → payment_required → creating_order → wallet_pending →
 * confirming → paid | expired | failed
 */
export function usePaywall(options: UsePaywallOptions): UsePaywallReturn {
  const { backendUrl, endpoint, callerAddress } = options;
  const [state, setState] = useState<PaywallState>("idle");
  const [order, setOrder] = useState<PaywallOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setState("idle");
    setOrder(null);
    setError(null);
  }, []);

  /**
   * Check if the current endpoint is already paid for.
   * We just do a GET and see if we get 402 back.
   */
  const checkAccess = useCallback(async () => {
    setState("checking");
    setError(null);

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        headers: {
          "X-Caller-Identity": callerAddress ?? "anonymous",
        },
      });

      if (res.ok) {
        setState("paid");
        return;
      }

      if (res.status === 402) {
        setState("payment_required");
        return;
      }

      throw new Error(`Unexpected response: ${res.status}`);
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "Access check failed");
    }
  }, [backendUrl, endpoint, callerAddress]);

  /**
   * Create an x402 payment order for the endpoint.
   * Returns order details needed for wallet payment.
   */
  const pay = useCallback(async (): Promise<PaywallOrder> => {
    setState("creating_order");
    setError(null);

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "pay" }),
      });

      const data = await res.json();

      if (res.status === 402 && data.payment) {
        const paywallOrder: PaywallOrder = {
          orderId: data.payment.orderId,
          payToAddress: data.payment.payToAddress,
          amountWei: data.payment.amountWei,
          tokenSymbol: data.payment.tokenSymbol,
          tokenDecimals: data.payment.tokenDecimals,
          chainId: data.payment.chainId,
          flow: data.payment.flow,
          expiresAt: data.payment.expiresAt,
          paymentId: data.payment.paymentId ?? data.payment.orderId,
        };
        setOrder(paywallOrder);
        setState("wallet_pending");
        return paywallOrder;
      }

      throw new Error(data.detail ?? "Failed to create payment order");
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "Order creation failed");
      throw err;
    }
  }, [backendUrl, endpoint]);

  /**
   * Confirm that payment was made.
   * Polls the backend until the x402 order is confirmed.
   */
  const confirmPayment = useCallback(async (orderId: string): Promise<boolean> => {
    setState("confirming");

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();

      if (data.paid) {
        setState("paid");
        return true;
      }

      // Check if expired
      if (res.status === 402 || res.status === 410) {
        setState("expired");
        return false;
      }

      throw new Error(data.detail ?? "Payment confirmation failed");
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "Confirmation failed");
      return false;
    }
  }, [backendUrl, endpoint]);

  return {
    state,
    order,
    error,
    checkAccess,
    pay,
    confirmPayment,
    reset,
  };
}
