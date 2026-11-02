import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry, withTimeout, ReviewError, ErrorCodes, isReviewError, formatError } from '../src/utils/error-handler.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns the result on first success without delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, 3, 10)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after failures and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockResolvedValue('third time lucky');
    await expect(withRetry(fn, 3, 1)).resolves.toBe('third time lucky');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws ReviewError with RETRY_EXHAUSTED after all attempts fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'));
    const promise = withRetry(fn, 3, 1);
    await expect(promise).rejects.toBeInstanceOf(ReviewError);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.RETRY_EXHAUSTED,
      metadata: { attempts: 3, lastError: 'always' }
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff with jitter between attempts', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter = 50ms
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fn = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValue('done');

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('done');

    const delays = timeoutSpy.mock.calls.map(c => c[1]);
    expect(delays).toEqual([150, 250]); // 100*2^0 + 50, 100*2^1 + 50
    expect(randomSpy).toHaveBeenCalled();
  });

  it('does not retry errors marked as non-retryable', async () => {
    const fatal = new ReviewError('bad input', ErrorCodes.VALIDATION_FAILED);
    const fn = vi.fn().mockRejectedValue(fatal);
    await expect(withRetry(fn, 3, 1, e => !(isReviewError(e) && e.code === ErrorCodes.VALIDATION_FAILED))).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('resolves when the function finishes before the timeout', async () => {
    await expect(withTimeout(async () => 'fast', 1000)).resolves.toBe('fast');
  });

  it('rejects with AGENT_TIMEOUT when the function is too slow', async () => {
    vi.useFakeTimers();
    const slow = () => new Promise<string>(resolve => setTimeout(() => resolve('late'), 10_000));
    const promise = withTimeout(slow, 50, 'Agent took too long');
    const assertion = expect(promise).rejects.toMatchObject({
      name: 'ReviewError',
      code: ErrorCodes.AGENT_TIMEOUT,
      metadata: { timeoutMs: 50 }
    });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it('propagates errors thrown by the wrapped function', async () => {
    await expect(withTimeout(async () => { throw new Error('inner'); }, 1000)).rejects.toThrow('inner');
  });
});

describe('helpers', () => {
  it('isReviewError and formatError', () => {
    const err = new ReviewError('nope', ErrorCodes.PR_NOT_FOUND);
    expect(isReviewError(err)).toBe(true);
    expect(isReviewError(new Error('x'))).toBe(false);
    expect(formatError(err)).toBe('[PR_NOT_FOUND] nope');
    expect(formatError(new Error('plain'))).toBe('plain');
    expect(formatError('string error')).toBe('string error');
  });
});
