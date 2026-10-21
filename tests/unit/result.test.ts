import { describe, expect, it } from 'vitest';

import { fromDatabaseError } from '@/lib/result';

describe('fromDatabaseError', () => {
  it('identifica slug, WoRMS e GBIF duplicados pelo nome da restrição', () => {
    expect(
      fromDatabaseError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "species_slug_key"',
      }).code,
    ).toBe('slug_taken');
    expect(
      fromDatabaseError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "species_worms_aphia_id_key"',
      }).code,
    ).toBe('worms_id_taken');
    expect(
      fromDatabaseError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "species_gbif_usage_key_key"',
      }).code,
    ).toBe('gbif_key_taken');
  });

  it('traduz o bloqueio de publicação com a lista do que falta', () => {
    const error = fromDatabaseError({
      code: 'P0001',
      message: 'species_not_publishable',
      details: 'missing_cover,missing_description',
    });
    expect(error.code).toBe('not_publishable');
    expect(error.issues).toEqual(['missing_cover', 'missing_description']);
    expect(error.message).toContain('Escolha uma imagem de capa.');
  });

  it('ignora códigos de impedimento desconhecidos', () => {
    expect(
      fromDatabaseError({
        code: 'P0001',
        message: 'species_not_publishable',
        details: 'missing_cover,algo',
      }).issues,
    ).toEqual(['missing_cover']);
  });

  it('traduz permissão negada, sessão expirada e capa duplicada', () => {
    expect(
      fromDatabaseError({ code: '42501', message: 'new row violates row-level security policy' })
        .code,
    ).toBe('forbidden');
    expect(fromDatabaseError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe(
      'unauthenticated',
    );
    expect(fromDatabaseError({ code: '23P01', message: 'conflicting key value' }).code).toBe(
      'cover_conflict',
    );
  });

  it('identifica falha de rede', () => {
    expect(fromDatabaseError({ message: 'TypeError: fetch failed' }).code).toBe('network');
  });

  it('nunca repassa a mensagem interna do banco ao usuário', () => {
    const internal = 'relation "public.species" does not exist at character 15';
    const error = fromDatabaseError({ code: '42P01', message: internal });
    expect(error.code).toBe('unknown');
    expect(error.message).not.toContain('public.species');
  });

  it('trata erro ausente', () => {
    expect(fromDatabaseError(null).code).toBe('unknown');
  });
});
