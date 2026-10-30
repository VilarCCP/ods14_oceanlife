import type { ReactNode } from 'react';

import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Moldura do site público: ambiente "descida pelo oceano", cabeçalho,
 * conteúdo principal e rodapé. O painel administrativo usa outra moldura.
 */
export function PublicChrome({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Ambiente decorativo: invisível para leitores de tela. */}
      <div className="ocean-light" aria-hidden="true" />
      <div className="ocean-snow" aria-hidden="true" />
      <div className="depth-line" aria-hidden="true" />

      <div className="site">
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" className="site-main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
