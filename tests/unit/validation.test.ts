import { describe, expect, it } from 'vitest';

import { imageMetadataSchema, sourceInputSchema } from '@/lib/validation/media';
import {
  adminSearchParamsSchema,
  publicSearchParamsSchema,
  speciesInputSchema,
  toFieldErrors,
} from '@/lib/validation/species';

const minimal = {
  commonName: '  Espécie de teste  ',
  scientificName: 'Fictitia exemplaris',
  slug: 'especie-de-teste',
};

describe('speciesInputSchema', () => {
  it('aceita rascunho só com nomes e slug, deixando o resto vazio', () => {
    const result = speciesInputSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.commonName).toBe('Espécie de teste');
    expect(result.data.habitat).toBeNull();
    expect(result.data.diet).toBeNull();
    expect(result.data.conservationCategory).toBeNull();
    expect(result.data.isFeatured).toBe(false);
  });

  it('transforma textos vazios ou só com espaços em null (nunca inventa conteúdo)', () => {
    const result = speciesInputSchema.safeParse({ ...minimal, habitat: '   ', description: '' });
    expect(result.success && result.data.habitat).toBeNull();
    expect(result.success && result.data.description).toBeNull();
  });

  it('exige nome popular e nome científico com mensagens claras', () => {
    const result = speciesInputSchema.safeParse({ commonName: ' ', scientificName: '', slug: 'x' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(errors.commonName).toEqual(['Informe o nome popular.']);
    expect(errors.scientificName).toEqual(['Informe o nome científico.']);
  });

  it('normaliza e valida o slug', () => {
    expect(speciesInputSchema.safeParse({ ...minimal, slug: '  Especie-Teste ' }).success).toBe(
      true,
    );
    const invalid = speciesInputSchema.safeParse({ ...minimal, slug: 'espécie com espaço' });
    expect(invalid.success).toBe(false);
  });

  it('exige sistema, fonte e data quando há categoria de conservação (D9)', () => {
    const result = speciesInputSchema.safeParse({ ...minimal, conservationCategory: 'EN' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual([
      'conservationAccessedAt',
      'conservationSourceUrl',
      'conservationSystem',
    ]);
  });

  it('aceita categoria de conservação com sistema, fonte e data', () => {
    const result = speciesInputSchema.safeParse({
      ...minimal,
      conservationCategory: 'VU',
      conservationSystem: 'Sistema fictício',
      conservationSourceUrl: 'https://exemplo.invalid/avaliacao',
      conservationAccessedAt: '2026-10-01',
      conservationAssessmentYear: '2024',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.conservationAssessmentYear).toBe(2024);
  });

  it('recusa categoria desconhecida, data futura e URL sem http', () => {
    expect(speciesInputSchema.safeParse({ ...minimal, conservationCategory: 'XX' }).success).toBe(
      false,
    );
    expect(
      speciesInputSchema.safeParse({ ...minimal, conservationAccessedAt: '2999-01-01' }).success,
    ).toBe(false);
    expect(
      speciesInputSchema.safeParse({ ...minimal, conservationSourceUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
  });

  it('converte identificadores externos numéricos e recusa valores inválidos', () => {
    const result = speciesInputSchema.safeParse({
      ...minimal,
      wormsAphiaId: '137205',
      gbifUsageKey: '',
    });
    expect(result.success && result.data.wormsAphiaId).toBe(137205);
    expect(result.success && result.data.gbifUsageKey).toBeNull();
    expect(speciesInputSchema.safeParse({ ...minimal, wormsAphiaId: '-3' }).success).toBe(false);
    expect(speciesInputSchema.safeParse({ ...minimal, wormsAphiaId: 'abc' }).success).toBe(false);
  });

  it('recusa textos acima do limite', () => {
    expect(
      speciesInputSchema.safeParse({ ...minimal, shortDescription: 'a'.repeat(301) }).success,
    ).toBe(false);
  });
});

describe('publicSearchParamsSchema', () => {
  it('limpa o termo e usa página 1 por padrão', () => {
    expect(publicSearchParamsSchema.parse({ q: '  tubarão   baleia ' })).toEqual({
      q: 'tubarão baleia',
      grupo: undefined,
      pagina: 1,
    });
  });

  it('ignora parâmetros inválidos em vez de quebrar a página', () => {
    expect(publicSearchParamsSchema.parse({ pagina: 'abc', grupo: 'Grupo Inválido' })).toEqual({
      q: '',
      grupo: undefined,
      pagina: 1,
    });
    expect(publicSearchParamsSchema.parse({ pagina: '-5' }).pagina).toBe(1);
  });

  it('lê página e grupo válidos', () => {
    expect(publicSearchParamsSchema.parse({ pagina: '3', grupo: 'peixes' })).toMatchObject({
      pagina: 3,
      grupo: 'peixes',
    });
  });
});

describe('adminSearchParamsSchema', () => {
  it('usa valores padrão seguros', () => {
    expect(adminSearchParamsSchema.parse({ status: 'qualquer', sort: 'x' })).toEqual({
      q: '',
      status: 'all',
      sort: 'updated',
      pagina: 1,
    });
  });
});

describe('imageMetadataSchema', () => {
  it('exige texto alternativo', () => {
    const result = imageMetadataSchema.safeParse({ altText: '   ' });
    expect(result.success).toBe(false);
  });

  it('aceita metadados opcionais vazios', () => {
    const result = imageMetadataSchema.parse({
      altText: 'Imagem fictícia',
      caption: '',
      sourceUrl: '',
    });
    expect(result).toEqual({
      altText: 'Imagem fictícia',
      caption: null,
      credit: null,
      license: null,
      sourceUrl: null,
    });
  });
});

describe('sourceInputSchema', () => {
  it('exige título ou endereço em fonte manual', () => {
    const result = sourceInputSchema.safeParse({ provider: 'manual', accessedAt: '2026-10-01' });
    expect(result.success).toBe(false);
  });

  it('aceita fonte de importação com campos importados', () => {
    const result = sourceInputSchema.safeParse({
      provider: 'worms',
      sourceUrl: 'https://exemplo.invalid/registro/1',
      sourceRecordId: '1',
      fieldsImported: ['scientific_name', 'taxonomic_group'],
      accessedAt: '2026-10-01',
    });
    expect(result.success).toBe(true);
  });

  it('recusa campo importado desconhecido', () => {
    const result = sourceInputSchema.safeParse({
      provider: 'gbif',
      fieldsImported: ['campo_inventado'],
      accessedAt: '2026-10-01',
    });
    expect(result.success).toBe(false);
  });
});
