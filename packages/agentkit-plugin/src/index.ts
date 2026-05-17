import type { X402ClientConfig, PaywallConfig } from "@x402-paywall/core";
import { PaywallEngine, MemoryPaymentStore } from "@x402-paywall/core";

/**
 * Action definitions for the x402-paywall AgentKit plugin.
 * Mirrors the expected AgentKit ActionProvider interface.
 */

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * x402 Paywall ActionProvider for AgentKit.
 *
 * Enables AI agents to:
 * - Discover paywalled APIs and their pricing
 * - Create x402 payment orders
 * - Confirm payments and access paid endpoints
 * - Check their payment history
 *
 * Usage:
 * ```ts
 * import { x402PaywallProvider } from "@x402-paywall/agentkit-plugin";
 *
 * const runtime = new ExecutionRuntime({
 *   providers: [
 *     x402PaywallProvider({
 *       apiKey: process.env.GOATX402_API_KEY,
 *       apiSecret: process.env.GOATX402_API_SECRET,
 *       merchantId: process.env.GOATX402_MERCHANT_ID,
 *       apiUrl: process.env.GOATX402_API_URL,
 *     }),
 *     // ... other providers
 *   ],
 * });
 * ```
 */
export function x402PaywallProvider(config: X402ClientConfig) {
  const engine = new PaywallEngine({
    x402: config,
    store: new MemoryPaymentStore(),
  });

  return {
    // Provider metadata
    name: "x402-paywall",
    description: "Pay for API access via x402 protocol. Create payment orders, confirm payments, and check payment status.",

    /**
     * Return available actions for this provider.
     * In AgentKit, these get registered as callable tools.
     */
    getActions(): ActionDefinition[] {
      return [
        {
          name: "x402_discover_endpoint",
          description: "Discover pricing and payment terms for a paywalled API endpoint",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: "The API endpoint to check" },
              price: { type: "string", description: "Expected price (optional)" },
            },
          },
          execute: async (params) => {
            return {
              endpoint: params.endpoint,
              requiresPayment: true,
              protocol: "x402",
              price: params.price ?? "See paywall response",
              docs: "https://docs.goat.network/docs/build/x402/overview",
            };
          },
        },

        {
          name: "x402_create_order",
          description: "Create an x402 payment order for a protected endpoint",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: "The endpoint to pay for" },
              callerIdentity: { type: "string", description: "Agent's wallet address" },
              price: { type: "string", description: "Price in token units" },
              token: { type: "string", description: "Token symbol (USDC, GOAT, etc.)" },
              chain: { type: "string", description: "Chain name (goat-testnet)" },
            },
            required: ["endpoint", "callerIdentity", "price"],
          },
          execute: async (params) => {
            const terms = await engine.createPaymentOrder({
              endpointKey: params.endpoint as string,
              callerIdentity: params.callerIdentity as string,
              price: params.price as string,
              token: (params.token as string) ?? "USDC",
              chain: (params.chain as string) ?? "goat-testnet",
            });
            return terms;
          },
        },

        {
          name: "x402_confirm_payment",
          description: "Confirm an x402 payment after sending tokens",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: "The endpoint paid for" },
              callerIdentity: { type: "string", description: "Agent's wallet address" },
              orderId: { type: "string", description: "The x402 order ID" },
            },
            required: ["endpoint", "callerIdentity", "orderId"],
          },
          execute: async (params) => {
            return engine.confirmPayment({
              endpointKey: params.endpoint as string,
              callerIdentity: params.callerIdentity as string,
              orderId: params.orderId as string,
              sessionTtl: 3600,
            });
          },
        },

        {
          name: "x402_check_access",
          description: "Check if an agent has an active paid session for an endpoint",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: "The endpoint to check" },
              callerIdentity: { type: "string", description: "Agent's wallet address" },
            },
            required: ["endpoint", "callerIdentity"],
          },
          execute: async (params) => {
            const session = await engine.getActiveSession(
              params.endpoint as string,
              params.callerIdentity as string,
            );
            return {
              hasAccess: !!session,
              session: session
                ? {
                    orderId: session.orderId,
                    tokenSymbol: session.tokenSymbol,
                    expiresAt: new Date(session.expiresAt).toISOString(),
                  }
                : null,
            };
          },
        },

        {
          name: "x402_get_merchant_info",
          description: "Get information about the x402 merchant (supported chains, tokens)",
          parameters: {
            type: "object",
            properties: {},
          },
          execute: async () => {
            return engine.getClient().getMerchantInfo();
          },
        },
      ];
    },
  };
}

export { PaywallEngine, MemoryPaymentStore };
