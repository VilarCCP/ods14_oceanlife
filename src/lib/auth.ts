import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { loginHref } from '@/lib/navigation';
import { fail, ok, type Result } from '@/lib/result';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

/**
 * Autorização do painel (doc 03 §4). Sempre verificada no servidor, em cada
 * página e em cada ação, e reforçada pela RLS no banco. Ser usuário
 * autenticado não basta: é preciso estar em admin_users (decisão D1).
 */

export interface AdminSession {
  client: TypedSupabaseClient;
  userId: string;
  email: string | null;
}

export type AuthState =
  | { status: 'anonymous' }
  | { status: 'forbidden'; email: string | null }
  | ({ status: 'admin' } & AdminSession);

/** Falha do provedor de autenticação (rede, indisponibilidade). */
export class AuthUnavailableError extends Error {
  constructor() {
    super('Não foi possível verificar a sessão.');
    this.name = 'AuthUnavailableError';
  }
}

/** Estado de autenticação da requisição atual (consultado uma vez por requisição). */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const client = await createSupabaseServerClient();
  // getUser valida a sessão no servidor de autenticação (não confia só no cookie).
  const { data, error } = await client.auth.getUser();

  if (error) {
    if (error.name === 'AuthRetryableFetchError') throw new AuthUnavailableError();
    return { status: 'anonymous' };
  }
  if (!data.user) return { status: 'anonymous' };

  const admin = await client.rpc('is_admin');
  // is_admin() pode ser chamada por qualquer usuário autenticado e só devolve
  // true/false. Um erro aqui é falha do banco ou da rede, nunca "sem permissão":
  // tratar como permissão negada mostraria a um administrador que ele perdeu o
  // acesso quando o banco está fora do ar (achado na fase 08).
  if (admin.error) throw new AuthUnavailableError();
  if (admin.data !== true) return { status: 'forbidden', email: data.user.email ?? null };

  return { status: 'admin', client, userId: data.user.id, email: data.user.email ?? null };
});

/**
 * Para páginas do painel: devolve a sessão de administrador ou redireciona
 * (sem login → tela de login; sem permissão → aviso de acesso negado).
 */
export async function requireAdminPage(currentPath: string): Promise<AdminSession> {
  const state = await getAuthState();
  if (state.status === 'anonymous') redirect(loginHref(currentPath));
  if (state.status === 'forbidden') redirect('/admin/sem-permissao');
  return { client: state.client, userId: state.userId, email: state.email };
}

/** Para ações do painel: nunca redireciona; devolve um erro explicável. */
export async function requireAdminAction(): Promise<Result<AdminSession>> {
  let state: AuthState;
  try {
    state = await getAuthState();
  } catch {
    return fail(
      'network',
      'Não foi possível verificar sua sessão. Verifique a conexão e tente de novo.',
    );
  }
  if (state.status === 'anonymous') {
    return fail('unauthenticated', 'Sua sessão expirou. Entre novamente para continuar.');
  }
  if (state.status === 'forbidden') {
    return fail('forbidden', 'Sua conta não tem permissão para usar o painel.');
  }
  return ok({ client: state.client, userId: state.userId, email: state.email });
}
