import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** Cliente Supabase tipado com o esquema do projeto. */
export type TypedSupabaseClient = SupabaseClient<Database>;
