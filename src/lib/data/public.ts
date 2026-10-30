import 'server-only';

import { cache } from 'react';

import { createSupabasePublicClient } from '@/lib/supabase/server';
import { getPublishedSpeciesBySlug } from '@/services/species.service';

/**
 * Busca da página da espécie compartilhada entre generateMetadata e a página,
 * para não consultar o banco duas vezes na mesma requisição.
 */
export const loadPublishedSpecies = cache(async (slug: string) => {
  return getPublishedSpeciesBySlug(createSupabasePublicClient(), slug);
});
