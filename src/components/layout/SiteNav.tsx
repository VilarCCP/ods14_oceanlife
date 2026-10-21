'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { isCurrentPath } from '@/lib/navigation';
import { publicNavigation } from '@/lib/site';

export function SiteNav() {
  const pathname = usePathname();
  // O menu fica aberto apenas na página em que foi aberto: ao navegar, fecha.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const navId = useId();

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={navId}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {open ? 'Fechar menu' : 'Menu'}
      </button>
      <nav id={navId} className="site-nav" aria-label="Principal" data-open={open}>
        <ul className="nav-list">
          {publicNavigation.map((item) => {
            const current = isCurrentPath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="nav-link"
                  aria-current={current ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
