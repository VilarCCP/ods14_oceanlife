import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { siteConfig, siteUrl } from '@/lib/site';

import './globals.css';

// Newsreader: serifa editorial, de guia de campo, para títulos e nomes científicos.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

// Atkinson Hyperlegible: criada para máxima legibilidade, adequada a um público amplo.
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${siteConfig.name} — explore a vida marinha`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    siteName: siteConfig.name,
    locale: 'pt_BR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#176f88',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={siteConfig.locale} className={`${newsreader.variable} ${atkinson.variable}`}>
      <body>
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
      </body>
    </html>
  );
}
