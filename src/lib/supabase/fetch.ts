/**
 * fetch com tempo limite para os clientes do Supabase no servidor. Sem isso,
 * um banco que não responde deixa a página carregando indefinidamente em vez
 * de mostrar a mensagem de erro (verificado na fase 08, e2e/falhas.spec.ts).
 */
export const SUPABASE_TIMEOUT_MS = 15_000;

export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}

export const fetchWithTimeout = createFetchWithTimeout(SUPABASE_TIMEOUT_MS);
