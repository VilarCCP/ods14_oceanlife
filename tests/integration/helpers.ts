/**
 * Infraestrutura dos testes de integração. Rodam contra um Supabase LOCAL
 * (no CI do GitHub Actions) e nunca contra o projeto na nuvem.
 *
 * A chave secreta local é usada apenas aqui, para criar e remover usuários de
 * teste. A aplicação nunca usa chave secreta (decisão D2).
 */
import { createClient } from '@supabase/supabase-js';

import type { TypedSupabaseClient } from '@/lib/supabase/types';
import type { Database } from '@/types/database';

export const env = {
  url: process.env.SUPABASE_TEST_URL ?? '',
  publishableKey: process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? '',
  secretKey: process.env.SUPABASE_TEST_SECRET_KEY ?? '',
};

export const hasIntegrationEnv = Boolean(env.url && env.publishableKey && env.secretKey);

if (hasIntegrationEnv && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.url)) {
  throw new Error('Os testes de integração só podem rodar contra um Supabase local.');
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Cliente com privilégios totais — somente para preparar e limpar dados. */
export function serviceClient(): TypedSupabaseClient {
  return createClient<Database>(env.url, env.secretKey, noSession);
}

/** Cliente de visitante anônimo. */
export function anonClient(): TypedSupabaseClient {
  return createClient<Database>(env.url, env.publishableKey, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: TypedSupabaseClient;
}

/** Cria um usuário confirmado, opcionalmente administrador, e devolve um cliente logado. */
export async function createTestUser(
  label: string,
  options: { admin: boolean },
): Promise<TestUser> {
  const service = serviceClient();
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@teste.invalid`;
  const password = `Senha-${crypto.randomUUID()}`;

  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`Falha ao criar usuário de teste: ${created.error?.message}`);
  }
  const id = created.data.user.id;

  if (options.admin) {
    const { error } = await service
      .from('admin_users')
      .insert({ user_id: id, note: 'teste de integração' });
    if (error) throw new Error(`Falha ao autorizar administrador de teste: ${error.message}`);
  }

  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error)
    throw new Error(`Falha ao entrar como usuário de teste: ${signedIn.error.message}`);

  return { id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await user.client.auth.signOut();
  await serviceClient().auth.admin.deleteUser(user.id);
}

/** PNG válido de 1×1 pixel. */
export const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

/** Prefixo dos slugs criados por esta execução, para limpeza segura. */
export const RUN_PREFIX = `it-${crypto.randomUUID().slice(0, 8)}`;
