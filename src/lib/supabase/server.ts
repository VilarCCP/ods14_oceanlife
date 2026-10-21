import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

import type { TypedSupabaseClient } from './types';

/**
 * Cliente com a sessão do usuário (cookies). Usado no painel, em Server
 * Components, Server Actions e Route Handlers. Todas as permissões vêm da RLS.
 */
export async function createSupabaseServerClient(): Promise<TypedSupabaseClient> {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component, que não pode gravar
          // cookies. A renovação da sessão é feita pelo proxy (fase 06).
        }
      },
    },
  });
}

/**
 * Cliente sem sessão para o site público: sempre age como visitante anônimo,
 * mesmo que um administrador esteja logado no mesmo navegador. Assim o site
 * público nunca mostra rascunhos por engano.
 */
export function createSupabasePublicClient(): TypedSupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
