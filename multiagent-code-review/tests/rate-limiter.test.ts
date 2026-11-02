import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter, DEFAULT_RATE_LIMITS, withRateLimit } from '../src/utils/rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimiter', () => {
  it('merges custom config with defaults', () => {
    const limiter = new RateLimiter({ maxConcurrent: 2 });
    expect(limiter.getConfig()).toEqual({ ...DEFAULT_RATE_LIMITS, maxConcurrent: 2 });
  });

  it('canProceed is true on a fresh limiter and records requests on acquire', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 5, maxTokensPerMinute: 10_000, maxConcurrent: 2 });
    expect(limiter.canProceed(1000)).toBe(true);

    await limiter.acquire(1000);
    const status = limiter.getStatus();
    expect(status.activeRequests).toBe(1);
    expect(status.requestsInWindow).toBe(1);
    expect(status.tokensInWindow).toBe(1000);
    expect(status.availableRequests).toBe(4);
    expect(status.availableTokens).toBe(9000);
  });

  it('canProceed respects the token budget', async () => {
    const limiter = new RateLimiter({ maxTokensPerMinute: 5000, maxConcurrent: 10, maxRequestsPerMinute: 100 });
    await limiter.acquire(4000);
    limiter.release();
    expect(limiter.canProceed(1000)).toBe(true);
    expect(limiter.canProceed(1001)).toBe(false);
  });

  it('release updates the last request with the actual token count', async () => {
    const limiter = new RateLimiter();
    await limiter.acquire(1000);
    limiter.release(2500);
    expect(limiter.getStatus().tokensInWindow).toBe(2500);
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('blocks when maxConcurrent is reached and wakes up on release', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, maxRequestsPerMinute: 100, maxTokensPerMinute: 1_000_000 });
    await limiter.acquire(10);

    let secondAcquired = false;
    const second = limiter.acquire(10).then(() => { secondAcquired = true; });
    await Promise.resolve();
    expect(secondAcquired).toBe(false);
    expect(limiter.canProceed(10)).toBe(false);

    limiter.release();
    await second;
    expect(secondAcquired).toBe(true);
    expect(limiter.getStatus().activeRequests).toBe(1);
  });

  it('prunes records older than 60 seconds (sliding window)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter({ maxRequestsPerMinute: 2, maxConcurrent: 10, maxTokensPerMinute: 1_000_000 });

    await limiter.acquire(1);
    limiter.release();
    await limiter.acquire(1);
    limiter.release();
    expect(limiter.canProceed(1)).toBe(false);
    expect(limiter.getStatus().requestsInWindow).toBe(2);

    vi.advanceTimersByTime(61_000);
    expect(limiter.getStatus().requestsInWindow).toBe(0);
    expect(limiter.canProceed(1)).toBe(true);
  });

  it('waits for the window to slide when the per-minute limit is hit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter({ maxRequestsPerMinute: 1, maxConcurrent: 10, maxTokensPerMinute: 1_000_000 });

    await limiter.acquire(1);
    limiter.release();

    let acquired = false;
    const pending = limiter.acquire(1).then(() => { acquired = true; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(acquired).toBe(false);
    await vi.advanceTimersByTimeAsync(31_000);
    await pending;
    expect(acquired).toBe(true);
  });

  it('withRateLimit acquires, runs and always releases', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1 });
    await expect(withRateLimit(limiter, async () => 42, 10)).resolves.toBe(42);
    expect(limiter.getStatus().activeRequests).toBe(0);

    await expect(withRateLimit(limiter, async () => { throw new Error('fail'); }, 10)).rejects.toThrow('fail');
    expect(limiter.getStatus().activeRequests).toBe(0);
  });
});
