import React, { useState, useEffect } from "react";

// Response types
type PremiumDataResponse = {
  data: {
    timestamp: string;
    message: string;
    insights: Array<{ label: string; value: string }>;
  };
  payment: { method: string; provider: string; accessExpiresIn: string };
} | null;

type AiResultResponse = Record<string, unknown> | null;

type PaywallStep = "idle" | "checking" | "payment_required" | "creating_order" | "wallet_pending" | "confirming" | "paid" | "failed";

function App() {
  const [step, setStep] = useState<PaywallStep>("idle");
  const [premiumData, setPremiumData] = useState<PremiumDataResponse>(null);
  const [aiResult, setAiResult] = useState<AiResultResponse>(null);
  const [error, setError] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [orderDetails, setOrderDetails] = useState<{
    payToAddress: string;
    amountWei: string;
    tokenSymbol: string;
    chainId: number;
  } | null>(null);

  // Fetch health & config on mount
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => console.log("[demo] Health:", data))
      .catch(() => {});
  }, []);

  const handleAccessPremium = async () => {
    setStep("checking");
    setError("");

    try {
      const res = await fetch("/api/premium-data");
      if (res.ok) {
        const data = await res.json();
        setPremiumData(data);
        setStep("paid");
        return;
      }

      if (res.status === 402) {
        // Parse the payment order details from the 402 response
        const data = await res.json();
        if (data.payment) {
          setOrderDetails({
            payToAddress: data.payment.payToAddress,
            amountWei: data.payment.amountWei,
            tokenSymbol: data.payment.tokenSymbol,
            chainId: data.payment.chainId,
          });
          setOrderId(data.payment.orderId);
        }
        setStep("payment_required");
        return;
      }

      throw new Error(`Unexpected: ${res.status}`);
    } catch (err) {
      setStep("failed");
      setError(err instanceof Error ? err.message : "Check failed");
    }
  };

  const handleCreateOrder = async () => {
    setStep("creating_order");
    setError("");

    try {
      // GET already created the order on the initial check.
      // The payment details are stored in orderDetails.
      // Show the payment UI directly.
      if (orderDetails) {
        setStep("wallet_pending");
        return;
      }

      // Fallback: POST with intent to pay
      const res = await fetch("/api/premium-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "pay" }),
      });

      const data = await res.json();

      if (res.status === 402 && data.payment) {
        setOrderDetails({
          payToAddress: data.payment.payToAddress,
          amountWei: data.payment.amountWei,
          tokenSymbol: data.payment.tokenSymbol,
          chainId: data.payment.chainId,
        });
        setOrderId(data.payment.orderId);
        setStep("wallet_pending");
      } else {
        throw new Error(data.detail ?? "Order creation failed");
      }
    } catch (err) {
      setStep("failed");
      setError(err instanceof Error ? err.message : "Order creation failed");
    }
  };

  const handleConfirmPayment = async () => {
    setStep("confirming");
    setError("");

    try {
      const res = await fetch("/api/premium-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();

      if (data.paid) {
        // Payment confirmed — now fetch the data
        const dataRes = await fetch("/api/premium-data");
        if (dataRes.ok) {
          const premium = await dataRes.json();
          setPremiumData(premium);
        }
        setStep("paid");
      } else if (res.status === 402 || res.status === 410) {
        setStep("failed");
        setError("Payment expired. Please try again.");
      } else {
        throw new Error(data.detail ?? "Confirmation failed");
      }
    } catch (err) {
      setStep("failed");
      setError(err instanceof Error ? err.message : "Confirmation failed");
    }
  };

  const handleAccessAi = async () => {
    try {
      const res = await fetch("/api/ai-inference");
      if (res.ok) {
        const data = await res.json();
        setAiResult(data);
      } else if (res.status === 402) {
        alert("AI Inference requires a GOAT token payment. Try the Premium Data first to see the flow.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const reset = () => {
    setStep("idle");
    setPremiumData(null);
    setAiResult(null);
    setError("");
    setOrderId("");
    setOrderDetails(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-badge">⚡ x402 Paywall Demo</div>
        <h1>
          Pay-to-Access APIs with{" "}
          <span className="gradient-text">x402 Protocol</span>
        </h1>
        <p className="subtitle">
          Built on <strong>GOAT Network</strong> — Bitcoin-secured infrastructure for the AI agent economy
        </p>
        <div className="header-links">
          <a href="https://docs.goat.network/docs/build/x402/overview" target="_blank" rel="noopener">📖 x402 Docs</a>
          <a href="https://github.com/GOATNetwork/x402" target="_blank" rel="noopener">🐙 GitHub</a>
        </div>
      </header>

      <main className="app-main">
        {/* Card 1: Premium Data */}
        <section className="card premium-card">
          <div className="card-header">
            <span className="card-icon">📊</span>
            <h2>Premium Market Data</h2>
            <span className="price-badge">0.01 USDC</span>
          </div>
          <p className="card-desc">
            Real-time BTC, ETH, GOAT prices and protocol TVL.
            Pay once, access for 1 hour.
          </p>

          {step === "idle" && !premiumData && (
            <button className="btn btn-primary" onClick={handleAccessPremium}>
              Access Premium Data
            </button>
          )}

          {step === "checking" && (
            <div className="status-row">
              <span className="spinner" /> Checking access...
            </div>
          )}

          {step === "payment_required" && (
            <div className="paywall-prompt">
              <div className="prompt-icon">🔒</div>
              <p>This endpoint requires a micropayment via x402.</p>
              <button className="btn btn-primary" onClick={handleCreateOrder}>
                Pay 0.01 USDC
              </button>
            </div>
          )}

          {step === "creating_order" && (
            <div className="status-row">
              <span className="spinner" /> Creating payment order...
            </div>
          )}

          {step === "wallet_pending" && orderDetails && (
            <div className="payment-details">
              <div className="prompt-icon">💳</div>
              <h3>Complete Payment</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Amount</span>
                  <span className="detail-value">
                    <strong>{orderDetails.amountWei} {orderDetails.tokenSymbol}</strong>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Send to</span>
                  <code className="detail-address">
                    {orderDetails.payToAddress.slice(0, 10)}...{orderDetails.payToAddress.slice(-6)}
                  </code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Chain ID</span>
                  <span className="detail-value">{orderDetails.chainId}</span>
                </div>
              </div>
              <p className="hint">
                Send the payment from your wallet, then click confirm.
              </p>
              <button className="btn btn-primary" onClick={handleConfirmPayment}>
                ✅ Confirm Payment
              </button>
            </div>
          )}

          {step === "confirming" && (
            <div className="status-row">
              <span className="spinner" /> Verifying payment on-chain...
            </div>
          )}

          {step === "paid" && premiumData && (
            <div className="premium-content">
              <div className="success-badge">✅ Access Granted</div>
              <div className="data-grid">
                {(premiumData?.data?.insights ?? []).map((item, i) => (
                  <div key={i} className="data-card">
                    <span className="data-label">{item.label}</span>
                    <span className="data-value">{item.value}</span>
                  </div>
                ))}
              </div>
              <p className="data-message">
                {(premiumData as PremiumDataResponse)?.data?.message}
              </p>
              <button className="btn btn-secondary" onClick={reset}>
                Reset Demo
              </button>
            </div>
          )}

          {step === "failed" && (
            <div className="error-box">
              <p>❌ {error || "Something went wrong"}</p>
              <button className="btn btn-secondary" onClick={reset}>
                Try Again
              </button>
            </div>
          )}
        </section>

        {/* Card 2: AI Inference */}
        <section className="card ai-card">
          <div className="card-header">
            <span className="card-icon">🤖</span>
            <h2>AI Model Inference</h2>
            <span className="price-badge">0.05 GOAT</span>
          </div>
          <p className="card-desc">
            On-chain AI inference powered by GOAT Network.
            Different pricing tier — demonstrates flexible paywalls.
          </p>
          {aiResult ? (
            <div className="premium-content">
              <div className="success-badge">✅ Inference Complete</div>
              <pre className="ai-result">{JSON.stringify(aiResult, null, 2)}</pre>
              <button className="btn btn-secondary" onClick={() => setAiResult(null)}>
                Clear
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-outline" onClick={handleAccessAi}>
              Run Inference
            </button>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Built with{" "}
          <a href="https://github.com/GOATNetwork" target="_blank" rel="noopener">GOAT Network</a>{" "}
          · <a href="https://docs.goat.network/docs/build/x402/overview" target="_blank" rel="noopener">x402 Protocol</a>{" "}
          · <a href="https://www.goat.network/builder-program" target="_blank" rel="noopener">Builder Grants</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
