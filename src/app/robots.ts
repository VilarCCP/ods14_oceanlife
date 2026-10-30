import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/** Páginas públicas indexáveis; painel administrativo fora dos buscadores. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/api/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
