/**
 * Campos do formulário de espécie (doc 03 §7.1), agrupados como aparecem na
 * tela. Os nomes batem com o esquema Zod `speciesInputSchema`.
 */
import { conservationLabel } from '@/lib/format';
import { CONSERVATION_CATEGORIES } from '@/lib/validation/species';
import type { AdminSpeciesDetail } from '@/types/species';

export const TEXT_FIELD_NAMES = [
  'commonName',
  'scientificName',
  'slug',
  'displayGroup',
  'taxonomicGroup',
  'shortDescription',
  'description',
  'physicalCharacteristics',
  'habitat',
  'geographicDistribution',
  'diet',
  'behavior',
  'lifeExpectancy',
  'ecosystemImportance',
  'curiosities',
  'conservationCategory',
  'conservationSystem',
  'conservationAssessmentYear',
  'conservationSourceUrl',
  'conservationAccessedAt',
  'extinctionRisk',
  'mainThreats',
  'wormsAphiaId',
  'gbifUsageKey',
] as const;

export type TextFieldName = (typeof TEXT_FIELD_NAMES)[number];

export type SpeciesFormValues = Record<TextFieldName, string> & { isFeatured: boolean };

export interface FieldConfig {
  name: TextFieldName;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'number' | 'url' | 'date';
  required?: boolean;
  hint?: string;
  rows?: number;
  maxLength?: number;
  options?: { value: string; label: string }[];
  className?: string;
}

const NO_SOURCE_HINT = 'Deixe em branco se não houver fonte confiável.';

export const CONSERVATION_OPTIONS = [
  { value: '', label: 'Sem avaliação cadastrada' },
  ...CONSERVATION_CATEGORIES.map((code) => ({ value: code, label: conservationLabel(code) })),
];

export const EDUCATIONAL_FIELDS: FieldConfig[] = [
  {
    name: 'shortDescription',
    label: 'Resumo curto',
    kind: 'textarea',
    rows: 3,
    maxLength: 300,
    hint: 'Aparece nos cartões do catálogo. Resumo ou descrição geral é exigido para publicar.',
  },
  { name: 'description', label: 'Descrição geral', kind: 'textarea', rows: 6, maxLength: 10_000 },
  {
    name: 'physicalCharacteristics',
    label: 'Características físicas',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'habitat',
    label: 'Habitat',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'geographicDistribution',
    label: 'Distribuição geográfica',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'diet',
    label: 'Alimentação',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'behavior',
    label: 'Comportamento',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'lifeExpectancy',
    label: 'Expectativa de vida',
    kind: 'text',
    maxLength: 500,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'ecosystemImportance',
    label: 'Importância para o ecossistema',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'curiosities',
    label: 'Curiosidades',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: 'Apenas curiosidades verificadas em fonte confiável.',
  },
];

export const CONSERVATION_FIELDS: FieldConfig[] = [
  {
    name: 'conservationCategory',
    label: 'Categoria',
    kind: 'select',
    options: CONSERVATION_OPTIONS,
    hint: 'Ao escolher uma categoria, informe também sistema, endereço da fonte e data de consulta.',
  },
  {
    name: 'conservationSystem',
    label: 'Sistema de avaliação',
    kind: 'text',
    maxLength: 300,
    hint: 'Ex.: Lista Vermelha da IUCN.',
  },
  { name: 'conservationAssessmentYear', label: 'Ano da avaliação', kind: 'number' },
  { name: 'conservationSourceUrl', label: 'Endereço da fonte', kind: 'url', maxLength: 2000 },
  { name: 'conservationAccessedAt', label: 'Data de consulta', kind: 'date' },
  {
    name: 'extinctionRisk',
    label: 'Risco de extinção (texto explicativo)',
    kind: 'textarea',
    rows: 3,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
  {
    name: 'mainThreats',
    label: 'Principais ameaças',
    kind: 'textarea',
    rows: 4,
    maxLength: 5_000,
    hint: NO_SOURCE_HINT,
  },
];

export const IDENTIFIER_FIELDS: FieldConfig[] = [
  {
    name: 'wormsAphiaId',
    label: 'Identificador WoRMS (AphiaID)',
    kind: 'number',
    hint: 'Preenchido pela importação. Não pode se repetir entre espécies.',
  },
  {
    name: 'gbifUsageKey',
    label: 'Identificador GBIF (usageKey)',
    kind: 'number',
    hint: 'Preenchido pela importação. Não pode se repetir entre espécies.',
  },
];

/** Rótulo legível de cada campo, para o resumo de erros. */
export const FIELD_LABELS: Record<string, string> = {
  commonName: 'Nome popular',
  scientificName: 'Nome científico',
  slug: 'Endereço (slug)',
  displayGroup: 'Grupo',
  taxonomicGroup: 'Classificação',
  isFeatured: 'Destaque',
  ...Object.fromEntries(
    [...EDUCATIONAL_FIELDS, ...CONSERVATION_FIELDS, ...IDENTIFIER_FIELDS].map((field) => [
      field.name,
      field.label,
    ]),
  ),
};

export function emptySpeciesFormValues(): SpeciesFormValues {
  const values = Object.fromEntries(TEXT_FIELD_NAMES.map((name) => [name, ''])) as Record<
    TextFieldName,
    string
  >;
  return { ...values, isFeatured: false };
}

const asText = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export function speciesToFormValues(species: AdminSpeciesDetail): SpeciesFormValues {
  return {
    commonName: species.commonName,
    scientificName: species.scientificName,
    slug: species.slug,
    displayGroup: species.group?.slug ?? '',
    taxonomicGroup: asText(species.taxonomicGroup),
    shortDescription: asText(species.shortDescription),
    description: asText(species.description),
    physicalCharacteristics: asText(species.physicalCharacteristics),
    habitat: asText(species.habitat),
    geographicDistribution: asText(species.geographicDistribution),
    diet: asText(species.diet),
    behavior: asText(species.behavior),
    lifeExpectancy: asText(species.lifeExpectancy),
    ecosystemImportance: asText(species.ecosystemImportance),
    curiosities: asText(species.curiosities),
    conservationCategory: asText(species.conservationRaw.category),
    conservationSystem: asText(species.conservationRaw.system),
    conservationAssessmentYear: asText(species.conservationRaw.assessmentYear),
    conservationSourceUrl: asText(species.conservationRaw.sourceUrl),
    conservationAccessedAt: asText(species.conservationRaw.accessedAt),
    extinctionRisk: asText(species.extinctionRisk),
    mainThreats: asText(species.mainThreats),
    wormsAphiaId: asText(species.wormsAphiaId),
    gbifUsageKey: asText(species.gbifUsageKey),
    isFeatured: species.isFeatured,
  };
}

/** Os dados do formulário são iguais? (para indicar alterações não salvas) */
export function sameValues(a: SpeciesFormValues, b: SpeciesFormValues): boolean {
  return a.isFeatured === b.isFeatured && TEXT_FIELD_NAMES.every((name) => a[name] === b[name]);
}

/** Lê um backup salvo no navegador, ignorando qualquer conteúdo inesperado. */
export function parseBackup(raw: string | null): SpeciesFormValues | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const record = data as Record<string, unknown>;
    const values = emptySpeciesFormValues();
    for (const name of TEXT_FIELD_NAMES) {
      const value = record[name];
      if (typeof value === 'string') values[name] = value.slice(0, 20_000);
    }
    values.isFeatured = record.isFeatured === true;
    return values;
  } catch {
    return null;
  }
}
