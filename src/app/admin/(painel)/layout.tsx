import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { signOutAction } from '@/app/admin/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { getAuthState } from '@/lib/auth';

/**
 * Moldura das páginas protegidas do painel. A verificação aqui é a primeira
 * barreira; cada página e cada ação verificam de novo no servidor, porque um
 * layout pode não ser executado de novo em navegações entre páginas.
 */
export default async function AdminPanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  const state = await getAuthState();
  if (state.status === 'anonymous') redirect('/admin/login');
  if (state.status === 'forbidden') redirect('/admin/sem-permissao');

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="admin-header">
        <div className="admin-width admin-header__bar">
          <Link className="admin-header__brand" href="/admin">
            Painel do OceanLife
          </Link>
          <AdminNav />
          <div className="admin-header__account">
            {state.email ? <span className="admin-muted">{state.email}</span> : null}
            <form action={signOutAction}>
              <button className="button button--small button--quiet" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="conteudo" className="admin-width admin-main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
