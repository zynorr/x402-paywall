import type { Request, Response, NextFunction } from "express";
import { PaywallEngine, MemoryPaymentStore } from "@x402-paywall/core";
import type { PaywallConfig, PaymentStore, X402ClientConfig } from "@x402-paywall/core";

export { PaywallEngine, MemoryPaymentStore };

/**
 * Configuration for the x402 Express paywall middleware.
 */
export interface ExpressPaywallConfig {
  /** x402 API credentials */
  x402: X402ClientConfig;
  /** Default paywall settings applied to all protected routes */
  defaults?: Partial<PaywallConfig>;
  /** Custom payment store (defaults to in-memory) */
  store?: PaymentStore;
  /** How to extract caller identity from request (defaults to IP) */
  identityResolver?: (req: Request) => string;
}

/**
 * Resolve a PaywallConfig, removing undefined keys so defaults can be
 * cleanly overridden.
 */
function mergeConfig(base: PaywallConfig, override?: Partial<PaywallConfig>): PaywallConfig {
  const merged: PaywallConfig = { ...base, ...override };
  for (const key of Object.keys(merged) as Array<keyof PaywallConfig>) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}

/**
 * Create an Express middleware that paywalls specific routes with x402.
 *
 * Usage:
 * ```ts
 * const paywall = x402Paywall({
 *   x402: { apiKey, apiSecret, merchantId, apiUrl },
 *   defaults: { price: "0.01", token: "USDC", chain: "goat-testnet" },
 * });
 *
 * app.get("/api/data", paywall.protect({ price: "0.05" }), handler);
 * ```
 */
export function x402Paywall(config: ExpressPaywallConfig) {
  const engine = new PaywallEngine({
    x402: config.x402,
    store: config.store ?? new MemoryPaymentStore(),
  });

  const defaults: PaywallConfig = mergeConfig(
    {
      price: "0.01",
      token: "USDC",
      chain: "goat-testnet",
      sessionTtl: 3600,
    },
    config.defaults,
  );

  const resolveIdentity = config.identityResolver ?? ((req: Request) => {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  });

  /** Extract params from merged config for createPaymentOrder calls. */
  function orderParams(merged: PaywallConfig) {
    return {
      price: merged.price,
      token: merged.token ?? defaults.token ?? "USDC",
      chain: merged.chain ?? defaults.chain ?? "goat-testnet",
      chainId: merged.chainId,
      tokenAddress: merged.tokenAddress,
      tokenDecimals: merged.tokenDecimals,
      sessionTtl: merged.sessionTtl ?? defaults.sessionTtl ?? 3600,
    };
  }

  /**
   * Returns Express middleware that protects the route with x402 paywall.
   *
   * Flow:
   * 1. GET/HEAD requests → check active session, 402 if none
   * 2. POST with { intent: "pay" } → creates order, returns 402 with payment terms
   * 3. POST with { orderId } → confirms payment, caches session
   * 4. Subsequent requests with valid session → pass through
   */
  function protect(routeConfig?: Partial<PaywallConfig>) {
    const merged = mergeConfig(defaults, routeConfig);

    return async (req: Request, res: Response, next: NextFunction) => {
      const endpointKey = `${req.method}:${req.originalUrl ?? req.path}`;
      const callerIdentity = resolveIdentity(req);

      try {
        // ── POST handler: order creation or payment confirmation ──
        if (req.method === "POST") {
          const body = req.body ?? {};

          // Confirm payment after user transfers tokens
          if (body.orderId) {
            const result = await engine.confirmPayment({
              endpointKey: `GET:${req.originalUrl ?? req.path}`,
              callerIdentity,
              orderId: body.orderId,
              sessionTtl: merged.sessionTtl ?? defaults.sessionTtl ?? 3600,
            });

            if (result.paid) {
              res.json({ paid: true, message: "Payment confirmed. You can now access this endpoint." });
              return;
            }

            res.status(402).json({
              status: 402,
              title: "Payment Required",
              detail: result.error ?? "Payment not yet confirmed. Please complete the transfer.",
            });
            return;
          }

          // Create a new payment order
          if (body.intent === "pay") {
            const terms = await engine.createPaymentOrder({
              endpointKey: `GET:${req.originalUrl ?? req.path}`,
              callerIdentity,
              ...orderParams(merged),
            });

            res.status(402).json(engine.paymentRequiredResponse(terms));
            return;
          }

          // Unknown POST body — pass through to handler
          return next();
        }

        // ── GET/HEAD handler: check session, 402 if unpaid ──
        const session = await engine.getActiveSession(endpointKey, callerIdentity);
        if (session) {
          return next();
        }

        // No active session — create payment order and return 402
        const terms = await engine.createPaymentOrder({
          endpointKey,
          callerIdentity,
          ...orderParams(merged),
        });

        res.status(402).json(engine.paymentRequiredResponse(terms));
      } catch (err) {
        next(err);
      }
    };
  }

  return {
    protect,
    engine,
  };
}
