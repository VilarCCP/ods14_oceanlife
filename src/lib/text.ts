/**
 * Utilitários de texto compartilhados por pesquisa, slugs e detecção de
 * duplicidade. `normalizeText` segue a mesma regra da função SQL
 * `public.normalize_text` (sem acentos, minúsculas, espaços simples).
 */

const COMBINING_MARKS = /\p{M}+/gu;

/** Remove acentos e outros sinais diacríticos. */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').normalize('NFC');
}

/** Sem acentos, em minúsculas, sem espaços nas pontas e com espaços simples. */
export function normalizeText(value: string): string {
  return stripAccents(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Tamanho máximo aceito para um termo de pesquisa. */
export const MAX_SEARCH_TERM_LENGTH = 100;

/**
 * Prepara o termo digitado pelo visitante para exibição e para a URL:
 * remove espaços extras e limita o tamanho. Não remove acentos (isso é feito
 * só na comparação), para que o termo apareça como foi digitado.
 */
export function cleanSearchTerm(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_TERM_LENGTH).trim();
}

/**
 * Escapa os curingas do LIKE/ILIKE (`%`, `_`) e a barra invertida, para que
 * caracteres especiais digitados pelo visitante sejam tratados como texto.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Padrão ILIKE "contém", já normalizado e escapado, para a coluna `search_text`. */
export function buildSearchPattern(raw: string | null | undefined): string | null {
  const term = normalizeText(cleanSearchTerm(raw));
  if (!term) return null;
  return `%${escapeLikePattern(term)}%`;
}
