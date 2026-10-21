/**
 * Informações institucionais do OceanLife usadas em metadados e no layout.
 * Não contém dados científicos.
 */
export const siteConfig = {
  name: 'OceanLife',
  description:
    'Plataforma educativa para explorar espécies marinhas e aprender sobre a conservação dos oceanos.',
  locale: 'pt-BR',
  sdg: 'ODS 14 — Vida na Água',
} as const;

/** Monta o título de uma página no formato "Página | OceanLife". */
export function pageTitle(page?: string): string {
  const trimmed = page?.trim();
  return trimmed ? `${trimmed} | ${siteConfig.name}` : siteConfig.name;
}
