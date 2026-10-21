import { describe, expect, it } from 'vitest';

import { findSecrets, isForbiddenEnvFile } from '../../scripts/check-secrets.mjs';

describe('isForbiddenEnvFile', () => {
  it.each(['.env', '.env.local', '.env.production', 'apps/web/.env.local'])(
    'bloqueia %s',
    (path) => {
      expect(isForbiddenEnvFile(path)).toBe(true);
    },
  );

  it.each(['.env.example', 'src/env.ts', 'docs/.envelope.md'])('permite %s', (path) => {
    expect(isForbiddenEnvFile(path)).toBe(false);
  });
});

describe('findSecrets', () => {
  it('não acusa o .env.example vazio', () => {
    const example = 'NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\n';
    expect(findSecrets(example)).toEqual([]);
  });

  it('acusa uma chave de serviço preenchida', () => {
    expect(findSecrets('SUPABASE_SERVICE_ROLE_KEY=abc123')).toContain(
      'Variável de segredo preenchida',
    );
  });

  it('acusa uma chave secreta do Supabase', () => {
    expect(findSecrets('const k = "sb_secret_abcdefghijklmnop";')).toContain(
      'Chave secreta do Supabase',
    );
  });

  it('acusa um token JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghijklmnop';
    expect(findSecrets(jwt)).toContain('Token JWT');
  });

  it('não acusa variável vazia seguida de outra linha', () => {
    expect(findSecrets('SUPABASE_SERVICE_ROLE_KEY=\n```')).toEqual([]);
  });

  it('não acusa texto comum', () => {
    expect(findSecrets('A chave pública vem do painel do Supabase.')).toEqual([]);
  });
});
