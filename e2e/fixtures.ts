/**
 * Dados fictícios dos testes E2E. Criados no Supabase LOCAL antes dos testes e
 * removidos depois. Nenhuma informação aqui descreve uma espécie real.
 */
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../src/types/database';

export const E2E_PREFIX = 'e2e-';

export const fixtures = {
  featured: {
    slug: 'e2e-peixe-espelho',
    commonName: 'Peixe-espelho de teste',
    scientificName: 'Fictitia lucida',
    group: 'peixes',
    shortDescription: 'Espécie fictícia usada apenas nos testes automatizados.',
    habitat: 'Texto fictício de habitat para teste.',
    sourceTitle: 'Referência fictícia de teste E2E',
  },
  related: {
    slug: 'e2e-peixe-sombra',
    commonName: 'Peixe-sombra de teste',
    scientificName: 'Fictitia umbra',
    group: 'peixes',
  },
  accented: {
    slug: 'e2e-tartaruga-omega',
    commonName: 'Tartaruga Ômega de teste',
    scientificName: 'Fictitia testudo',
    group: 'repteis',
  },
  draft: {
    slug: 'e2e-rascunho-secreto',
    commonName: 'Rascunho secreto de teste',
    scientificName: 'Fictitia occulta',
  },
} as const;

export function e2eServiceClient() {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Defina SUPABASE_TEST_URL e SUPABASE_TEST_SECRET_KEY (Supabase local).');
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error('Os testes E2E só podem preparar dados num Supabase local.');
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

/** PNG válido de 1×1 pixel. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
