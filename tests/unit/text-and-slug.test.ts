import { describe, expect, it } from 'vitest';

import { isValidSlug, MAX_SLUG_LENGTH, slugify, suggestAvailableSlug } from '@/lib/slug';
import {
  buildSearchPattern,
  cleanSearchTerm,
  escapeLikePattern,
  MAX_SEARCH_TERM_LENGTH,
  normalizeText,
  stripAccents,
} from '@/lib/text';

describe('normalizeText', () => {
  it('remove acentos, converte para minúsculas e reduz espaços', () => {
    expect(normalizeText('  Tubarão   Baleia ')).toBe('tubarao baleia');
  });

  it('segue a mesma regra da função SQL normalize_text', () => {
    // Mesmo caso coberto em supabase/tests/database/01_schema.test.sql
    expect(normalizeText('Fictítia   Exemplaris ')).toBe('fictitia exemplaris');
  });

  it('trata ç, ã, ê e acentos combinados', () => {
    expect(stripAccents('Peixe-palhaço, água-viva, Pêra')).toBe('Peixe-palhaco, agua-viva, Pera');
    expect(stripAccents('á')).toBe('a');
  });
});

describe('cleanSearchTerm', () => {
  it('remove espaços nas pontas e repetidos, mantendo acentos', () => {
    expect(cleanSearchTerm('   tartaruga    marinha  ')).toBe('tartaruga marinha');
    expect(cleanSearchTerm('  Tubarão ')).toBe('Tubarão');
  });

  it('retorna vazio para ausência de termo', () => {
    expect(cleanSearchTerm(undefined)).toBe('');
    expect(cleanSearchTerm(null)).toBe('');
    expect(cleanSearchTerm('    ')).toBe('');
  });

  it('limita o tamanho do termo', () => {
    expect(cleanSearchTerm('a'.repeat(500))).toHaveLength(MAX_SEARCH_TERM_LENGTH);
  });
});

describe('escapeLikePattern e buildSearchPattern', () => {
  it('escapa curingas e barra invertida', () => {
    expect(escapeLikePattern('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('monta padrão "contém" normalizado', () => {
    expect(buildSearchPattern('  TUBARÃO  ')).toBe('%tubarao%');
  });

  it('caracteres especiais viram texto literal', () => {
    expect(buildSearchPattern('50%')).toBe('%50\\%%');
  });

  it('pesquisa vazia não gera filtro', () => {
    expect(buildSearchPattern('   ')).toBeNull();
  });
});

describe('slugify', () => {
  it('gera slug a partir do nome popular', () => {
    expect(slugify('Tartaruga-verde')).toBe('tartaruga-verde');
    expect(slugify('  Peixe Palhaço  ')).toBe('peixe-palhaco');
    expect(slugify('Água-viva (Medusa)!')).toBe('agua-viva-medusa');
  });

  it('retorna vazio quando não há letras ou números', () => {
    expect(slugify('!!! ---')).toBe('');
  });

  it('respeita o tamanho máximo sem terminar em hífen', () => {
    const slug = slugify(`${'palavra '.repeat(40)}`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('isValidSlug', () => {
  it.each(['tartaruga-verde', 'a', 'peixe-2'])('aceita %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['Tartaruga', 'com espaço', '-inicio', 'fim-', 'duplo--hifen', 'acentuação', ''])(
    'rejeita %s',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});

describe('suggestAvailableSlug', () => {
  it('mantém o slug quando está livre', () => {
    expect(suggestAvailableSlug('tartaruga', [])).toBe('tartaruga');
  });

  it('acrescenta sufixo numérico quando já existe', () => {
    expect(suggestAvailableSlug('tartaruga', ['tartaruga', 'tartaruga-2'])).toBe('tartaruga-3');
  });

  it('continua válido no tamanho máximo', () => {
    const base = 'a'.repeat(MAX_SLUG_LENGTH);
    const suggestion = suggestAvailableSlug(base, [base]);
    expect(suggestion.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(suggestion.endsWith('-2')).toBe(true);
    expect(isValidSlug(suggestion)).toBe(true);
  });
});
