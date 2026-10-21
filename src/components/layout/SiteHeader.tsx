import Link from 'next/link';

import { siteConfig } from '@/lib/site';

import { SiteNav } from './SiteNav';

function BrandMark() {
  // Marca simples: uma bolha de ar subindo de uma onda.
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 19c3-2.5 5.5-2.5 8.5 0s5.5 2.5 8.5 0 5-2.5 5-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="10.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-width site-header__bar">
        <Link href="/" className="brand">
          <BrandMark />
          {siteConfig.name}
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
