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

/** Navegação pública. O painel administrativo nunca aparece aqui (doc 02 §4). */
export const publicNavigation = [
  { href: '/', label: 'Início' },
  { href: '/especies', label: 'Espécies' },
  { href: '/conservacao', label: 'Conservação' },
  { href: '/sobre', label: 'Sobre o projeto' },
] as const;

/**
 * Imagem de destaque da página inicial. Só deve ser preenchida com uma imagem
 * cujo direito de uso foi confirmado pela equipe (doc 02 §5.2). Enquanto for
 * `null`, a página inicial é exibida sem foto.
 */
export const heroImage: {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit: string;
} | null = null;

/** Monta o título de uma página no formato "Página | OceanLife". */
export function pageTitle(page?: string): string {
  const trimmed = page?.trim();
  return trimmed ? `${trimmed} | ${siteConfig.name}` : siteConfig.name;
}

/** Endereço público do site, usado no sitemap e nos metadados. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!raw) return 'http://localhost:3000';
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;
}
