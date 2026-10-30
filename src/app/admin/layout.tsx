import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// O painel nunca é indexado (doc 01 §11). O cabeçalho X-Robots-Tag em
// next.config.ts reforça isto para todas as respostas de /admin.
export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s | Painel OceanLife' },
  robots: { index: false, follow: false },
};

// Todas as páginas do painel dependem da sessão: nunca são pré-renderizadas.
export const dynamic = 'force-dynamic';

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="admin">{children}</div>;
}
