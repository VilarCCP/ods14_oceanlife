import { describe, expect, it } from 'vitest';

import {
  emptySpeciesFormValues,
  parseBackup,
  sameValues,
} from '@/components/admin/species-form-fields';
import { formatDateTime } from '@/lib/format';
import { loginHref, safeAdminPath } from '@/lib/navigation';
import { speciesInputSchema } from '@/lib/validation/species';

describe('safeAdminPath', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/especies', '/admin/especies'],
    ['/admin/especies?status=draft', '/admin/especies?status=draft'],
  ])('aceita %s', (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://exemplo.invalid/admin'],
    ['//exemplo.invalid/admin'],
    ['/especies'],
    ['/administrador'],
    ['/admin\\..\\x'],
    ['/admin/login'],
    ['/admin/login?next=/admin'],
    ['/admin\r\nSet-Cookie: x=1'],
  ])('rejeita %s e volta para /admin', (input) => {
    expect(safeAdminPath(input)).toBe('/admin');
  });
});

describe('loginHref', () => {
  it('leva o destino seguro para depois do login', () => {
    expect(loginHref('/admin/especies/nova')).toBe('/admin/login?next=%2Fadmin%2Fespecies%2Fnova');
    expect(loginHref('/admin')).toBe('/admin/login');
    expect(loginHref('//fora')).toBe('/admin/login');
  });
});

describe('formatDateTime', () => {
  it('mostra o horário de Brasília', () => {
    expect(formatDateTime('2026-10-21T12:30:00Z')).toBe('21/10/2026, 09:30');
  });

  it('devolve o valor original se não for uma data', () => {
    expect(formatDateTime('sem data')).toBe('sem data');
  });
});

describe('formulário de espécie', () => {
  it('valores vazios produzem um rascunho inválido só por falta de nomes e slug', () => {
    const result = speciesInputSchema.safeParse(emptySpeciesFormValues());
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = new Set(result.error.issues.map((issue) => issue.path[0]));
    expect([...fields].sort()).toEqual(['commonName', 'scientificName', 'slug']);
  });

  it('compara valores para indicar alterações não salvas', () => {
    const a = emptySpeciesFormValues();
    const b = { ...emptySpeciesFormValues(), habitat: 'texto' };
    expect(sameValues(a, emptySpeciesFormValues())).toBe(true);
    expect(sameValues(a, b)).toBe(false);
    expect(sameValues(a, { ...a, isFeatured: true })).toBe(false);
  });

  it('lê a cópia local ignorando conteúdo inesperado', () => {
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup('não é json')).toBeNull();
    expect(parseBackup('42')).toBeNull();

    const restored = parseBackup(
      JSON.stringify({ commonName: 'Teste', habitat: 7, isFeatured: 'sim', campoEstranho: 'x' }),
    );
    expect(restored?.commonName).toBe('Teste');
    expect(restored?.habitat).toBe('');
    expect(restored?.isFeatured).toBe(false);
    expect(restored && 'campoEstranho' in restored).toBe(false);
  });
});
