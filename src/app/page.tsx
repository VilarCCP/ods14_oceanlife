import { siteConfig } from '@/lib/site';

/**
 * Página provisória da fase 02 (fundação).
 * A página inicial definitiva é construída na fase 05, conforme docs/02-site-publico.md.
 */
export default function HomePage() {
  return (
    <main className="placeholder">
      <h1>{siteConfig.name}</h1>
      <p>{siteConfig.description}</p>
      <p className="placeholder__note">Projeto em desenvolvimento.</p>
    </main>
  );
}
