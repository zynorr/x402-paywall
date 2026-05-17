import React, { useEffect, useCallback } from "react";
import { usePaywall, type PaywallState } from "./usePaywall.js";

export interface PaywallCheckoutProps {
  /** URL of your backend proxy that holds x402 API keys */
  backendUrl: string;
  /** The endpoint path being accessed */
  endpoint: string;
  /** Connected wallet address of the caller */
  callerAddress?: string;
  /** Called when payment is complete and access is granted */
  onPaid?: () => void;
  /** Label for the resource being purchased */
  resourceLabel?: string;
  /** Custom render for the payment dialog */
  renderPayment?: (props: {
    state: PaywallState;
    order: { payToAddress: string; amountWei: string; tokenSymbol: string; chainId: number } | null;
    error: string | null;
    onPay: () => void;
    onCancel: () => void;
  }) => React.ReactNode;
}

/**
 * Drop-in x402 payment checkout component.
 *
 * Usage:
 * ```tsx
 * <PaywallCheckout
 *   backendUrl="http://localhost:3001"
 *   endpoint="/api/premium-data"
 *   callerAddress="0x..."
 *   onPaid={() => fetchData()}
 * />
 * ```
 */
export function PaywallCheckout({
  backendUrl,
  endpoint,
  callerAddress,
  onPaid,
  resourceLabel = "this resource",
  renderPayment,
}: PaywallCheckoutProps) {
  const { state, order, error, checkAccess, pay, confirmPayment, reset } = usePaywall({
    backendUrl,
    endpoint,
    callerAddress,
  });

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (state === "paid" && onPaid) {
      onPaid();
    }
  }, [state, onPaid]);

  const handlePay = useCallback(async () => {
    try {
      const paymentOrder = await pay();
      if (!paymentOrder) return;

      // In production, this would open the user's wallet for payment.
      // For now we simulate the payment flow.
      // The user sends `amountWei` of `tokenSymbol` to `payToAddress`
      // on chain `chainId`, then calls confirmPayment with the orderId.

      const confirmed = await confirmPayment(paymentOrder.orderId);
      if (!confirmed) {
        // Payment not yet confirmed — the user needs to complete the transfer
        console.warn("Payment not confirmed. Please ensure you completed the transfer.");
      }
    } catch {
      // Error handled by the hook
    }
  }, [pay, confirmPayment]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  // Custom render if provided
  if (renderPayment) {
    return (
      <>
        {renderPayment({
          state,
          order,
          error,
          onPay: handlePay,
          onCancel: handleCancel,
        })}
      </>
    );
  }

  // Default payment UI
  if (state === "paid") {
    return null; // Nothing to show — access granted
  }

  return (
    <div className="x402-paywall-overlay">
      <div className="x402-paywall-modal">
        {state === "checking" && (
          <div className="x402-paywall-status">
            <div className="x402-spinner" />
            <p>Checking access to {resourceLabel}...</p>
          </div>
        )}

        {state === "payment_required" && (
          <div className="x402-paywall-prompt">
            <div className="x402-paywall-icon">🔒</div>
            <h3>Payment Required</h3>
            <p>Access to {resourceLabel} requires a micropayment via x402.</p>
            <button className="x402-paywall-btn" onClick={handlePay}>
              Pay with x402
            </button>
            <button className="x402-paywall-btn x402-paywall-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {state === "creating_order" && (
          <div className="x402-paywall-status">
            <div className="x402-spinner" />
            <p>Creating payment order...</p>
          </div>
        )}

        {state === "wallet_pending" && order && (
          <div className="x402-paywall-payment">
            <div className="x402-paywall-icon">💳</div>
            <h3>Complete Payment</h3>
            <div className="x402-paywall-details">
              <div className="x402-paywall-row">
                <span>Amount</span>
                <strong>{order.amountWei} {order.tokenSymbol}</strong>
              </div>
              <div className="x402-paywall-row">
                <span>Send to</span>
                <code className="x402-address">{order.payToAddress.slice(0, 10)}...{order.payToAddress.slice(-6)}</code>
              </div>
              <div className="x402-paywall-row">
                <span>Chain ID</span>
                <strong>{order.chainId}</strong>
              </div>
            </div>
            <p className="x402-paywall-hint">
              Send the payment from your wallet, then click confirm below.
            </p>
            <button className="x402-paywall-btn" onClick={handlePay}>
              I've Sent the Payment
            </button>
            <button className="x402-paywall-btn x402-paywall-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {state === "confirming" && (
          <div className="x402-paywall-status">
            <div className="x402-spinner" />
            <p>Verifying payment on-chain...</p>
          </div>
        )}

        {state === "expired" && (
          <div className="x402-paywall-prompt">
            <div className="x402-paywall-icon">⏰</div>
            <h3>Payment Expired</h3>
            <p>The payment order has expired. Please try again.</p>
            <button className="x402-paywall-btn" onClick={handlePay}>
              Try Again
            </button>
          </div>
        )}

        {state === "failed" && (
          <div className="x402-paywall-prompt">
            <div className="x402-paywall-icon">❌</div>
            <h3>Payment Failed</h3>
            <p>{error || "Something went wrong. Please try again."}</p>
            <button className="x402-paywall-btn" onClick={handlePay}>
              Retry
            </button>
            <button className="x402-paywall-btn x402-paywall-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
