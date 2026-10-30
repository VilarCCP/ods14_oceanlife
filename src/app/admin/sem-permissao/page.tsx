import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signOutAction } from '@/app/admin/actions';
import { getAuthState } from '@/lib/auth';

export const metadata: Metadata = { title: 'Acesso negado' };

/** Usuário autenticado, mas sem permissão administrativa (doc 03 §4.3). */
export default async function NoPermissionPage() {
  const state = await getAuthState();
  if (state.status === 'anonymous') redirect('/admin/login');
  if (state.status === 'admin') redirect('/admin');

  return (
    <main className="admin-auth" id="conteudo">
      <div className="admin-auth__card">
        <p className="admin-auth__brand">Painel do OceanLife</p>
        <h1>Você não tem permissão para usar o painel</h1>
        <p>
          A conta {state.email ? <strong>{state.email}</strong> : 'atual'} entrou com sucesso, mas
          não está autorizada a manter o catálogo.
        </p>
        <p className="admin-muted">
          Se você deveria ter acesso, peça a um responsável pelo projeto para autorizar sua conta.
        </p>
        <div className="form-actions">
          <form action={signOutAction}>
            <button className="button" type="submit">
              Sair e entrar com outra conta
            </button>
          </form>
          <Link className="button button--quiet" href="/">
            Ir para o site
          </Link>
        </div>
      </div>
    </main>
  );
}
