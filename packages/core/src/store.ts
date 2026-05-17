import { PaymentSession, PaymentStore } from "./types.js";

/**
 * In-memory payment session store.
 * Maps payment proofs (txHash or payment header) to sessions with TTL.
 * In production, swap this for Redis or KV store.
 */
export class MemoryPaymentStore implements PaymentStore {
  private store = new Map<string, { session: PaymentSession; expiresAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cleanupMs = 60_000) {
    // Periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  async get(key: string): Promise<PaymentSession | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.session;
  }

  async set(key: string, session: PaymentSession, ttl: number): Promise<void> {
    this.store.set(key, {
      session,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /** Count of active sessions */
  get size(): number {
    this.cleanup();
    return this.store.size;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}
