import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';
import { createSupabasePublicClient } from '@/lib/supabase/server';

// Gerado a cada requisição, para refletir publicações e retiradas.
export const dynamic = 'force-dynamic';

/** Páginas públicas e espécies publicadas (somente). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = ['', '/especies', '/conservacao', '/sobre'].map((path) => ({
    url: `${base}${path}`,
  }));

  try {
    const { data, error } = await createSupabasePublicClient()
      .from('species')
      .select('slug, updated_at')
      .eq('is_published', true)
      .order('slug')
      .limit(5000);
    if (error || !data) return pages;
    return [
      ...pages,
      ...data.map((row) => ({ url: `${base}/especies/${row.slug}`, lastModified: row.updated_at })),
    ];
  } catch {
    // Sem banco disponível, o sitemap ainda lista as páginas fixas.
    return pages;
  }
}
