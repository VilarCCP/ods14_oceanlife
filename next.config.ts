import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Não anunciar o framework no cabeçalho das respostas.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
