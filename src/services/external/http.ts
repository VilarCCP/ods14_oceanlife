/**
 * Chamadas HTTP às APIs externas (doc 01 §7.4): tempo limite, tratamento de
 * erros e respostas vazias. Nunca lança exceção: devolve um resultado tipado.
 * O conteúdo recebido é tratado sempre como dado, nunca como instrução.
 */

export type ExternalFailure =
  | 'empty' // nenhum resultado
  | 'rate_limited' // limite de requisições da fonte
  | 'unavailable' // fonte fora do ar, erro 5xx ou tempo esgotado
  | 'invalid_response'; // resposta em formato inesperado

export type ExternalResult<T> = { ok: true; data: T } | { ok: false; reason: ExternalFailure };

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export const EXTERNAL_TIMEOUT_MS = 10_000;

/** Mensagens para o painel (doc 03 §8.4). */
export const EXTERNAL_FAILURE_MESSAGES: Record<ExternalFailure, string> = {
  empty: 'Nenhum registro encontrado. Verifique a grafia do nome científico.',
  rate_limited:
    'A fonte limitou o número de consultas. Aguarde alguns minutos antes de tentar de novo.',
  unavailable:
    'A fonte não respondeu a tempo ou está indisponível. Tente de novo mais tarde ou cadastre manualmente.',
  invalid_response:
    'A fonte respondeu em um formato inesperado. Tente de novo mais tarde ou cadastre manualmente.',
};

/**
 * Faz um GET e devolve o JSON já interpretado. HTTP 204 e corpo vazio contam
 * como "nenhum resultado".
 */
export async function getJson(
  url: string,
  fetcher: Fetcher = fetch,
  timeoutMs = EXTERNAL_TIMEOUT_MS,
): Promise<ExternalResult<unknown>> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OceanLife (projeto educativo, ODS 14)',
      },
      signal: AbortSignal.timeout(timeoutMs),
      // Respostas taxonômicas mudam pouco: reaproveita por 1 dia no servidor.
      next: { revalidate: 86_400 },
    } as RequestInit);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 204 || response.status === 404) return { ok: false, reason: 'empty' };
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (!response.ok) return { ok: false, reason: 'unavailable' };

  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (text.trim() === '') return { ok: false, reason: 'empty' };

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_response' };
  }
}

/** Texto externo seguro para exibir e guardar: sem caracteres de controle e com tamanho limitado. */
export function cleanExternalText(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' ? null : cleaned.slice(0, max);
}

/** Lê a URL base de uma API a partir de uma variável de ambiente (só no servidor). */
export function apiBaseUrl(envValue: string | undefined, fallback: string): string {
  if (!envValue) return fallback;
  try {
    const url = new URL(envValue);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return envValue.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}
