import type { NextConfig } from 'next';

/**
 * Imagens das espécies vêm do bucket público do Supabase Storage (D4).
 * Só esse caminho é aceito pelo otimizador de imagens.
 */
function storageImagePatterns(): URL[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return [];
  try {
    const base = supabaseUrl.replace(/\/$/, '');
    return [new URL(`${base}/storage/v1/object/public/species-images/**`)];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Não anunciar o framework no cabeçalho das respostas.
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: storageImagePatterns(),
    qualities: [75],
    formats: ['image/avif', 'image/webp'],
    // Apenas nos testes E2E, que usam um Supabase em 127.0.0.1. Em produção o
    // otimizador continua bloqueando endereços locais.
    dangerouslyAllowLocalIP: process.env.OCEANLIFE_E2E === '1',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // O painel nunca deve ser indexado (doc 01 §11, doc 02 §12).
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
