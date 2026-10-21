import { stripAccents } from './text';

/** Mesmo formato exigido pelo banco (restrição species_slug_format). */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 120;

export function isValidSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

/**
 * Gera um slug a partir de um texto: sem acentos, minúsculas, palavras
 * separadas por hífen. Pode retornar string vazia (ex.: texto só com símbolos).
 */
export function slugify(value: string): string {
  const slug = stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= MAX_SLUG_LENGTH) return slug;
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

/**
 * Sugere um slug livre: o próprio `base` ou `base-2`, `base-3`... O resultado
 * respeita o tamanho máximo. A unicidade definitiva é garantida pelo banco.
 */
export function suggestAvailableSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const head = base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, '');
    const candidate = `${head}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
