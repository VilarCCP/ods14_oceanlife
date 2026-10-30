import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/admin/LoginForm';
import { getAuthState } from '@/lib/auth';
import { safeAdminPath } from '@/lib/navigation';
import { firstParam } from '@/lib/validation/species';

export const metadata: Metadata = { title: 'Entrar' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeAdminPath(firstParam(params.next));
  const signedOut = firstParam(params.saiu) === '1';

  // Quem já é administrador vai direto para o painel.
  let state;
  try {
    state = await getAuthState();
  } catch {
    state = null;
  }
  if (state?.status === 'admin') redirect(next);
  if (state?.status === 'forbidden') redirect('/admin/sem-permissao');

  return (
    <main className="admin-auth" id="conteudo">
      <div className="admin-auth__card">
        <p className="admin-auth__brand">Painel do OceanLife</p>
        <h1>Entrar no painel</h1>
        <p className="admin-muted">
          Acesso restrito a pessoas autorizadas a manter o catálogo. Não há cadastro aberto: novas
          contas são criadas pela equipe do projeto.
        </p>
        {signedOut ? (
          <p className="admin-flash admin-flash--success" role="status">
            Você saiu do painel.
          </p>
        ) : null}
        {state === null ? (
          <p className="admin-flash admin-flash--error" role="alert">
            Não foi possível verificar sua sessão agora. Você ainda pode tentar entrar.
          </p>
        ) : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
