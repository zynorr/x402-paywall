import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { x402Paywall } from "@x402-paywall/express";
import type { Request, Response, NextFunction } from "express";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Detect if we're in demo/simulation mode
const SIMULATION_MODE = !process.env.GOATX402_API_KEY || process.env.GOATX402_API_KEY === "your_api_key_here";

// ---------------------------------------------------------------------------
// x402 Paywall setup
// ---------------------------------------------------------------------------
const paywall = x402Paywall({
  x402: {
    apiUrl: process.env.GOATX402_API_URL ?? "https://api.x402.goat.network",
    apiKey: process.env.GOATX402_API_KEY ?? "simulation",
    apiSecret: process.env.GOATX402_API_SECRET ?? "simulation",
    merchantId: process.env.GOATX402_MERCHANT_ID ?? "simulation",
  },
  defaults: {
    price: process.env.PAYWALL_DEFAULT_PRICE ?? "0.01",
    token: process.env.PAYWALL_DEFAULT_TOKEN ?? "USDC",
    chain: process.env.PAYWALL_DEFAULT_CHAIN ?? "goat-testnet",
    sessionTtl: Number(process.env.PAYWALL_SESSION_TTL) || 3600,
  },
});

// ---------------------------------------------------------------------------
// In-memory session store for simulation mode
// ---------------------------------------------------------------------------
const simulationStore = new Map<string, { paid: boolean; expiresAt: number }>();

// ---------------------------------------------------------------------------
// Public routes (no paywall)
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "x402-paywall-demo",
    mode: SIMULATION_MODE ? "simulation" : "live",
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    paywall: {
      price: process.env.PAYWALL_DEFAULT_PRICE ?? "0.01",
      token: process.env.PAYWALL_DEFAULT_TOKEN ?? "USDC",
      chain: process.env.PAYWALL_DEFAULT_CHAIN ?? "goat-testnet",
      protocol: "x402",
      docs: "https://docs.goat.network/docs/build/x402/overview",
    },
    mode: SIMULATION_MODE ? "simulation" : "live",
    note: SIMULATION_MODE
      ? "Running in simulation mode. Set GOATX402_API_KEY in .env for live x402 integration."
      : "Connected to live x402 API.",
  });
});

// ---------------------------------------------------------------------------
// Simulation middleware — returns realistic 402 responses without hitting x402 API
// ---------------------------------------------------------------------------
function simulationPaywall(req: Request, res: Response, next: NextFunction) {
  if (!SIMULATION_MODE) {
    return next();
  }

  const endpointKey = `GET:${req.originalUrl ?? req.path}`;
  const callerIdentity = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const sessionKey = `${endpointKey}:${callerIdentity}`;

  // For POST with orderId — confirm payment in simulation
  if (req.method === "POST") {
    const body = req.body ?? {};

    if (body.orderId) {
      const existing = simulationStore.get(sessionKey);
      if (existing && existing.paid) {
        res.json({ paid: true, message: "Payment confirmed. You can now access this endpoint." });
        return;
      }
      // Simulate payment confirmation
      simulationStore.set(sessionKey, { paid: true, expiresAt: Date.now() + 3600_000 });
      res.json({ paid: true, message: "Payment confirmed. You can now access this endpoint." });
      return;
    }

    if (body.intent === "pay") {
      // Return simulated 402 with payment terms
      const simOrderId = `sim_${crypto.randomUUID().slice(0, 12)}`;
      res.status(402).json({
        status: 402,
        title: "Payment Required",
        detail: "This endpoint requires payment via the x402 protocol.",
        documentation: "https://docs.goat.network/docs/build/x402/overview",
        payment: {
          orderId: simOrderId,
          payToAddress: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1",
          amountWei: "10000",  // 0.01 USDC (6 decimals)
          tokenSymbol: "USDC",
          tokenDecimals: 6,
          chainId: 48816,  // GOAT Testnet3
          flow: "ERC20_DIRECT",
          protocol: "x402",
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        },
      });
      return;
    }

    return next();
  }

  // For GET — check if paid
  const session = simulationStore.get(sessionKey);
  if (session && session.paid && session.expiresAt > Date.now()) {
    return next();
  }

  // Not paid — simulate 402
  const simOrderId = `sim_${crypto.randomUUID().slice(0, 12)}`;
  res.status(402).json({
    status: 402,
    title: "Payment Required",
    detail: "This endpoint requires payment via the x402 protocol.",
    documentation: "https://docs.goat.network/docs/build/x402/overview",
    payment: {
      orderId: simOrderId,
      payToAddress: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1",
      amountWei: "10000",  // 0.01 USDC (6 decimals)
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      chainId: 48816,  // GOAT Testnet3
      flow: "ERC20_DIRECT",
      protocol: "x402",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    },
  });
}

// ---------------------------------------------------------------------------
// Paywalled routes — use simulation middleware if in simulation mode
// ---------------------------------------------------------------------------
const paywallMiddleware = SIMULATION_MODE
  ? simulationPaywall
  : paywall.protect({ price: "0.01", token: "USDC", chain: "goat-testnet" });

const paywallMiddlewareAi = SIMULATION_MODE
  ? simulationPaywall
  : paywall.protect({ price: "0.05", token: "GOAT", chain: "goat-testnet" });

/**
 * Premium data endpoint — requires x402 payment.
 */
app.get("/api/premium-data", paywallMiddleware, (_req, res) => {
  res.json({
    data: {
      timestamp: new Date().toISOString(),
      message: "This is premium data unlocked via x402 payment!",
      insights: [
        { label: "BTC Price", value: "$67,432" },
        { label: "ETH Price", value: "$3,521" },
        { label: "GOAT Staking APY", value: "12.4%" },
        { label: "TVL", value: "$142.5M" },
      ],
    },
    payment: {
      method: "x402",
      provider: "GOAT Network",
      accessExpiresIn: "1 hour",
    },
  });
});

/**
 * AI model inference endpoint — priced differently.
 */
app.get("/api/ai-inference", paywallMiddlewareAi, (_req, res) => {
  res.json({
    model: "goat-nlp-v1",
    result: "Analysis complete. 3 market signals detected.",
    tokensUsed: 142,
  });
});

/**
 * POST route for payment confirmation / order creation.
 */
app.post("/api/premium-data", paywallMiddleware, (_req, res) => {
  // Should only reach here in live mode with unexpected POST bodies
  res.status(400).json({ error: "Expected { orderId } or { intent: 'pay' } in request body." });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[x402-paywall] Error:", err);
  res.status(500).json({
    status: 500,
    title: "Internal Server Error",
    detail: SIMULATION_MODE
      ? "Simulation error — check server logs."
      : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║           x402 Paywall Demo Server                  ║
╠══════════════════════════════════════════════════════╣
║  Mode: ${SIMULATION_MODE ? "🧪 SIMULATION (no API keys)" : "🔴 LIVE (x402 API connected)".padEnd(39)}║
║                                                     ║
║  Public endpoints:                                  ║
║    GET  /api/health        → Health check           ║
║    GET  /api/config        → Paywall config         ║
║                                                     ║
║  Paywalled endpoints (x402 required):               ║
║    GET  /api/premium-data  → Premium market data    ║
║    GET  /api/ai-inference  → AI inference results   ║
║                                                     ║
║  Payment flow:                                      ║
║    1. GET /api/premium-data → receives HTTP 402     ║
║    2. POST { intent: "pay" } → receives 402 again   ║
║    3. POST { orderId } → confirms payment           ║
║    4. GET /api/premium-data → access granted (1hr)  ║
║                                                     ║
║  Server running on http://localhost:${PORT}            ║
╚══════════════════════════════════════════════════════╝
  `);
});
