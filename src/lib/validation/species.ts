import { z } from 'zod';

import { cleanSearchTerm } from '@/lib/text';
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from '@/lib/slug';

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/** Texto opcional: espaços nas pontas removidos; vazio vira null. */
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

/** Texto obrigatório com mensagem própria. */
function requiredText(max: number, requiredMessage: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({ error: requiredMessage })
      .min(1, { error: requiredMessage })
      .max(max, { error: `Use no máximo ${max} caracteres.` }),
  );
}

/** URL http(s) opcional; vazio vira null. */
const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .url({ protocol: /^https?$/, error: 'Informe um endereço que comece com http:// ou https://.' })
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
);

/** Data AAAA-MM-DD opcional; vazio vira null. Não aceita datas futuras. */
const optionalPastDate = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.iso
    .date({ error: 'Informe uma data válida.' })
    .refine((value) => value <= new Date().toISOString().slice(0, 10), {
      error: 'A data não pode estar no futuro.',
    })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
);

/** Inteiro positivo opcional (aceita texto numérico do formulário). */
function optionalPositiveInt(max: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
      }
      return value;
    },
    z
      .number({ error: 'Informe um número inteiro.' })
      .int({ error: 'Informe um número inteiro.' })
      .positive({ error: 'Informe um número maior que zero.' })
      .max(max)
      .nullable(),
  );
}

// ---------------------------------------------------------------------------
// Espécie
// ---------------------------------------------------------------------------

export const CONSERVATION_CATEGORIES = [
  'EX',
  'EW',
  'RE',
  'CR',
  'EN',
  'VU',
  'NT',
  'LC',
  'DD',
  'NE',
] as const;
export type ConservationCategory = (typeof CONSERVATION_CATEGORIES)[number];

export const slugSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z
    .string({ error: 'Informe o endereço (slug).' })
    .min(1, { error: 'Informe o endereço (slug).' })
    .max(MAX_SLUG_LENGTH, { error: `Use no máximo ${MAX_SLUG_LENGTH} caracteres.` })
    .regex(SLUG_PATTERN, {
      error: 'Use apenas letras minúsculas sem acento, números e hífens (ex.: tartaruga-verde).',
    }),
);

const groupSlugSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().regex(SLUG_PATTERN, { error: 'Grupo inválido.' }).nullable().optional(),
);

/**
 * Dados de uma espécie vindos do formulário do painel. Todos os campos
 * educativos são opcionais: dado desconhecido fica vazio (doc 03 §7.2, §11).
 */
export const speciesInputSchema = z
  .object({
    commonName: requiredText(150, 'Informe o nome popular.'),
    scientificName: requiredText(200, 'Informe o nome científico.'),
    slug: slugSchema,
    displayGroup: groupSlugSchema.transform((value) => value ?? null),
    taxonomicGroup: optionalText(300),
    shortDescription: optionalText(300),
    description: optionalText(10_000),
    habitat: optionalText(5_000),
    geographicDistribution: optionalText(5_000),
    diet: optionalText(5_000),
    physicalCharacteristics: optionalText(5_000),
    behavior: optionalText(5_000),
    lifeExpectancy: optionalText(500),
    mainThreats: optionalText(5_000),
    ecosystemImportance: optionalText(5_000),
    curiosities: optionalText(5_000),
    conservationCategory: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.enum(CONSERVATION_CATEGORIES, { error: 'Categoria de conservação inválida.' }).nullable(),
    ),
    conservationSystem: optionalText(300),
    conservationAssessmentYear: optionalPositiveInt(2100).refine(
      (year) => year === null || (year >= 1900 && year <= new Date().getFullYear()),
      { error: 'Informe um ano entre 1900 e o ano atual.' },
    ),
    conservationSourceUrl: optionalHttpUrl,
    conservationAccessedAt: optionalPastDate,
    extinctionRisk: optionalText(5_000),
    wormsAphiaId: optionalPositiveInt(2_147_483_647),
    gbifUsageKey: optionalPositiveInt(Number.MAX_SAFE_INTEGER),
    isFeatured: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // Categoria de conservação só com fonte (D9, doc 01 §7.5).
    if (data.conservationCategory === null) return;
    const required: [keyof typeof data, string][] = [
      ['conservationSystem', 'Informe o sistema de avaliação (ex.: Lista Vermelha da IUCN).'],
      ['conservationSourceUrl', 'Informe o endereço da fonte da avaliação.'],
      ['conservationAccessedAt', 'Informe a data em que a fonte foi consultada.'],
    ];
    for (const [field, message] of required) {
      if (data[field] === null || data[field] === undefined) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }
    }
  });

export type SpeciesInput = z.output<typeof speciesInputSchema>;
export type SpeciesFormValues = z.input<typeof speciesInputSchema>;

/** Converte erros do Zod em { campo: [mensagens] } para o formulário. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parâmetros de pesquisa
// ---------------------------------------------------------------------------

export const PUBLIC_PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE).catch(1);

/** Parâmetros da URL do catálogo público (/especies?q=&grupo=&pagina=). */
export const publicSearchParamsSchema = z.object({
  q: z
    .string()
    .default('')
    .catch('')
    .transform((value) => cleanSearchTerm(value)),
  grupo: z.string().regex(SLUG_PATTERN).optional().catch(undefined),
  pagina: pageSchema.default(1),
});

export type PublicSearchParams = z.output<typeof publicSearchParamsSchema>;

/** Parâmetros da lista do painel. */
export const adminSearchParamsSchema = z.object({
  q: z
    .string()
    .default('')
    .catch('')
    .transform((value) => cleanSearchTerm(value)),
  status: z.enum(['all', 'draft', 'published']).default('all').catch('all'),
  sort: z.enum(['updated', 'name']).default('updated').catch('updated'),
  pagina: pageSchema.default(1),
});

export type AdminSearchParams = z.output<typeof adminSearchParamsSchema>;

/** Lê o primeiro valor de um parâmetro de URL do Next.js. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
