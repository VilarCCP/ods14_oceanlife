import { createBrowserClient } from '@supabase/ssr';

import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

import type { TypedSupabaseClient } from './types';

/**
 * Cliente para Client Components (ex.: envio de imagem direto para o Storage
 * com URL assinada, decisão D3). Usa a mesma sessão dos cookies.
 */
export function createSupabaseBrowserClient(): TypedSupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
