# x402 Paywall — Stripe for AI Agents

> **Plug-and-play middleware that turns any API endpoint into an x402-payable service.**  
> Built on [GOAT Network](https://goat.network) — Bitcoin-secured infrastructure for the AI agent economy.

[![GOAT Network](https://img.shields.io/badge/Powered%20by-GOAT%20Network-6366f1)](https://goat.network)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402-22c55e)](https://docs.goat.network/docs/build/x402/overview)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## What is x402 Paywall?

**x402 Paywall** is a developer toolkit for monetizing APIs through the [x402 protocol](https://docs.goat.network/docs/build/x402/overview) (HTTP 402 Payment Required). It lets you:

- **Add micropayments** to any API endpoint in **one line of code**
- **Enable AI agents** to pay programmatically without human intervention
- **Cache verified sessions** so users don't pay per-request
- **Support dynamic pricing** per endpoint, user, or request

### The Problem

Every builder on GOAT Network who wants to accept agent payments via x402 currently has to:
1. Read the full x402 spec + API reference
2. Build a backend server with HMAC-SHA256 auth
3. Implement order creation, status polling, proof retrieval
4. Build a frontend payment state machine
5. Handle edge cases (expired orders, failed payments, retries)

**That's 2-3 weeks of integration work per project.** x402 Paywall reduces this to one line.

### The Solution

```typescript
// Before: 2-3 weeks of custom integration
// After: one line
app.use("/api/premium", x402Paywall().protect({ price: "0.01" }));
```

---

## Architecture

```
x402-paywall/
├── packages/
│   ├── core/              # Framework-agnostic paywall engine + x402 API client
│   ├── express/           # Express.js middleware adapter
│   ├── react/             # React checkout components + hooks
│   ├── agentkit-plugin/   # AgentKit ActionProvider for AI agents
├── apps/
│   └── demo/              # Full-stack demo app with examples
```

### How It Works

```
┌─────────┐     GET /api/data      ┌──────────────┐
│  Client  │ ──────────────────►   │  x402 Paywall │
│ (Agent)  │                       │  Middleware   │
│          │ ◄───────── 402 ─────  │              │
│          │   { payment: {        └──────┬───────┘
│          │     orderId,                 │
│          │     payToAddress,            │
│          │     amountWei } }            │
│          │                             ▼
│          │                   ┌──────────────┐
│          │  Pay tokens to   │  x402 API     │
│          │  payToAddress ──►│  (GOAT)       │
│          │                   └──────┬───────┘
│          │                          │
│          │  POST { orderId }        │ WaitForConfirmation
│          │ ──────────────────►      │
│          │                          ▼
│          │                   ┌──────────────┐
│          │  GET /api/data    │  Access       │
│          │ ────────────────► │  Granted!     │
│          │ ◄──── 200 OK ────│  (session     │
│          │                   │   cached 1hr) │
└─────────┘                   └──────────────┘
```

---

## Quick Start

### 1. Install

```bash
pnpm add @x402-paywall/express @x402-paywall/core
```

### 2. Set up environment

```bash
# .env
GOATX402_API_URL=https://api.x402.goat.network
GOATX402_API_KEY=your_api_key
GOATX402_API_SECRET=your_api_secret
GOATX402_MERCHANT_ID=your_merchant_id
```

### 3. Add paywall to any route

```typescript
import { x402Paywall } from "@x402-paywall/express";

const paywall = x402Paywall({
  x402: {
    apiUrl: process.env.GOATX402_API_URL,
    apiKey: process.env.GOATX402_API_KEY,
    apiSecret: process.env.GOATX402_API_SECRET,
    merchantId: process.env.GOATX402_MERCHANT_ID,
  },
  defaults: { price: "0.01", token: "USDC", chain: "goat-testnet" },
});

// Paywall an entire router:
app.use("/api/premium", paywall.protect());

// Paywall a specific route:
app.get("/api/ai-inference", paywall.protect({ price: "0.05" }), handler);
```

### 4. Add the React checkout (optional)

```tsx
import { PaymentGuard } from "@x402-paywall/react";

function App() {
  return (
    <PaymentGuard
      backendUrl="http://localhost:3001"
      endpoint="/api/premium-data"
    >
      <PremiumDashboard />
    </PaymentGuard>
  );
}
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@x402-paywall/core` | Framework-agnostic paywall engine, x402 API client, session store |
| `@x402-paywall/express` | Express.js middleware — one-line route protection |
| `@x402-paywall/react` | React components (`PaywallCheckout`, `PaymentGuard`, `usePaywall`) |
| `@x402-paywall/agentkit-plugin` | AgentKit ActionProvider for AI agent integration |

### AgentKit Integration

AI agents can discover, pay for, and access APIs autonomously:

```typescript
import { x402PaywallProvider } from "@x402-paywall/agentkit-plugin";

const runtime = new ExecutionRuntime({
  providers: [
    x402PaywallProvider({
      apiKey: process.env.GOATX402_API_KEY,
      apiSecret: process.env.GOATX402_API_SECRET,
      merchantId: process.env.GOATX402_MERCHANT_ID,
      apiUrl: process.env.GOATX402_API_URL,
    }),
  ],
});
```

Available agent actions:
- `x402_discover_endpoint` — Check endpoint pricing
- `x402_create_order` — Create payment order
- `x402_confirm_payment` — Confirm payment after transfer
- `x402_check_access` — Check active sessions
- `x402_get_merchant_info` — Get merchant configuration

---

## Demo

```bash
# Install dependencies
pnpm install

# Start the demo (server + frontend)
pnpm run demo
```

- **Frontend:** http://localhost:5173
- **Server:** http://localhost:3001
- **Paywalled APIs:**
  - `GET /api/premium-data` — 0.01 USDC
  - `GET /api/ai-inference` — 0.05 GOAT

---

## Development

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Typecheck everything
pnpm typecheck

# Run demo
pnpm demo
```

---

## License

MIT — Built for the GOAT Network ecosystem.
