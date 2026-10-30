import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFetchWithTimeout } from '@/lib/supabase/fetch';

/** Simula um servidor que nunca responde, mas obedece ao cancelamento. */
function hangingFetch(signals: AbortSignal[]) {
  return (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        signals.push(signal);
        signal.addEventListener('abort', () => reject(signal.reason));
      }
    });
}

describe('fetch com tempo limite (clientes do Supabase)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('desiste quando o servidor não responde dentro do tempo limite', async () => {
    vi.stubGlobal('fetch', hangingFetch([]));
    const started = Date.now();
    await expect(createFetchWithTimeout(50)('http://exemplo.invalid')).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('respeita o cancelamento pedido por quem chamou', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', hangingFetch(signals));
    const controller = new AbortController();
    const request = createFetchWithTimeout(60_000)('http://exemplo.invalid', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(request).rejects.toBeDefined();
    expect(signals[0]?.aborted).toBe(true);
  });
});
