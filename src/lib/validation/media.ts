import { z } from 'zod';

function optionalText(max: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z
      .string()
      .max(max, { error: `Use no máximo ${max} caracteres.` })
      .nullable(),
  );
}

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .url({ protocol: /^https?$/, error: 'Informe um endereço que comece com http:// ou https://.' })
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
);

// ---------------------------------------------------------------------------
// Imagens (doc 03 §9)
// ---------------------------------------------------------------------------

/** Metadados de uma imagem. O texto alternativo é exigido em todas as imagens. */
export const imageMetadataSchema = z.object({
  altText: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({ error: 'Descreva a imagem (texto alternativo).' })
      .min(1, { error: 'Descreva a imagem (texto alternativo).' })
      .max(500, { error: 'Use no máximo 500 caracteres.' }),
  ),
  caption: optionalText(500),
  credit: optionalText(300),
  license: optionalText(200),
  sourceUrl: optionalHttpUrl,
});

export type ImageMetadataInput = z.output<typeof imageMetadataSchema>;

// ---------------------------------------------------------------------------
// Fontes (doc 01 §6.3, doc 03 §10)
// ---------------------------------------------------------------------------

export const SOURCE_PROVIDERS = ['worms', 'gbif', 'manual'] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

/** Campos da espécie que podem ser associados a uma fonte. */
export const SPECIES_SOURCE_FIELDS = [
  'common_name',
  'scientific_name',
  'taxonomic_group',
  'short_description',
  'description',
  'habitat',
  'geographic_distribution',
  'diet',
  'physical_characteristics',
  'behavior',
  'life_expectancy',
  'main_threats',
  'ecosystem_importance',
  'curiosities',
  'conservation',
  'extinction_risk',
  'worms_aphia_id',
  'gbif_usage_key',
] as const;

export const sourceInputSchema = z
  .object({
    provider: z.enum(SOURCE_PROVIDERS, { error: 'Fonte inválida.' }),
    referenceTitle: optionalText(500),
    sourceUrl: optionalHttpUrl,
    sourceRecordId: optionalText(200),
    fieldsImported: z
      .array(z.enum(SPECIES_SOURCE_FIELDS))
      .max(SPECIES_SOURCE_FIELDS.length)
      .default([]),
    accessedAt: z.iso
      .date({ error: 'Informe a data de consulta.' })
      .refine((value) => value <= new Date().toISOString().slice(0, 10), {
        error: 'A data não pode estar no futuro.',
      }),
    licenseOrAttribution: optionalText(500),
    notes: optionalText(2_000),
  })
  .superRefine((data, ctx) => {
    if (data.provider === 'manual' && data.referenceTitle === null && data.sourceUrl === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['referenceTitle'],
        message: 'Informe o título ou o endereço da referência.',
      });
    }
  });

export type SourceInput = z.output<typeof sourceInputSchema>;
