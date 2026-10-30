'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Resumo', exact: true },
  { href: '/admin/especies', label: 'Espécies', exact: false },
  { href: '/', label: 'Ver o site', exact: true },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel">
      <ul className="admin-nav">
        {ITEMS.map((item) => {
          const current =
            item.href !== '/' &&
            (item.exact ? pathname === item.href : pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                className="admin-nav__link"
                href={item.href}
                aria-current={current ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
