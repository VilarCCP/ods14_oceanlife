import Link from 'next/link';

import { publicNavigation, siteConfig } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width site-footer__grid">
        <div>
          <p>
            <strong>{siteConfig.name}</strong> é um projeto educativo sobre a vida marinha,
            relacionado à {siteConfig.sdg}.
          </p>
          <p>
            As informações de cada espécie indicam suas fontes e a data em que foram consultadas.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="site-footer__links">
            {publicNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
