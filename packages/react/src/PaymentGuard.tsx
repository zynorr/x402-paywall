import React from "react";
import { PaywallCheckout, type PaywallCheckoutProps } from "./PaywallCheckout.js";

export interface PaymentGuardProps extends Omit<PaywallCheckoutProps, "onPaid"> {
  /** Content to render once payment is confirmed */
  children: React.ReactNode;
  /** Called when payment is complete */
  onAccessGranted?: () => void;
}

/**
 * Wraps any content behind an x402 paywall.
 * Shows the checkout UI until payment is confirmed,
 * then renders the children.
 *
 * Usage:
 * ```tsx
 * <PaymentGuard
 *   backendUrl="http://localhost:3001"
 *   endpoint="/api/premium-data"
 *   callerAddress="0x..."
 * >
 *   <PremiumDataComponent />
 * </PaymentGuard>
 * ```
 */
export function PaymentGuard({
  children,
  onAccessGranted,
  ...checkoutProps
}: PaymentGuardProps) {
  const [isPaid, setIsPaid] = React.useState(false);

  return (
    <>
      {!isPaid && (
        <PaywallCheckout
          {...checkoutProps}
          onPaid={() => {
            setIsPaid(true);
            onAccessGranted?.();
          }}
        />
      )}
      {isPaid && children}
    </>
  );
}
