/**
 * Tipos de domínio usados pela interface. Os serviços convertem as linhas do
 * banco (snake_case, ver src/types/database.ts) para estes formatos.
 */

export interface SpeciesImage {
  id: string;
  storagePath: string;
  /** URL pública da imagem no Storage. */
  url: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  license: string | null;
  sourceUrl: string | null;
  isCover: boolean;
  displayOrder: number;
}

export interface SpeciesSource {
  id: string;
  provider: 'worms' | 'gbif' | 'manual';
  referenceTitle: string | null;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  fieldsImported: string[];
  accessedAt: string;
  licenseOrAttribution: string | null;
  notes: string | null;
}

/** Avaliação de conservação. Só existe com sistema, fonte e data (D9). */
export interface ConservationAssessment {
  category: string;
  system: string;
  assessmentYear: number | null;
  sourceUrl: string;
  accessedAt: string;
}

export interface SpeciesGroup {
  slug: string;
  label: string;
}

/** Cartão do catálogo. */
export interface SpeciesSummary {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  shortDescription: string | null;
  group: SpeciesGroup | null;
  cover: SpeciesImage | null;
}

/** Página da espécie. Campos ausentes ficam null — nunca inventados. */
export interface SpeciesDetail extends SpeciesSummary {
  taxonomicGroup: string | null;
  description: string | null;
  habitat: string | null;
  geographicDistribution: string | null;
  diet: string | null;
  physicalCharacteristics: string | null;
  behavior: string | null;
  lifeExpectancy: string | null;
  mainThreats: string | null;
  ecosystemImportance: string | null;
  curiosities: string | null;
  conservation: ConservationAssessment | null;
  extinctionRisk: string | null;
  /** Todas as imagens na ordem definida no painel. */
  images: SpeciesImage[];
  sources: SpeciesSource[];
  updatedAt: string;
}

/** Espécie completa para o formulário do painel. */
export interface AdminSpeciesDetail extends SpeciesDetail {
  wormsAphiaId: number | null;
  gbifUsageKey: number | null;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  /** Campos crus de conservação (podem estar incompletos num rascunho antigo). */
  conservationRaw: {
    category: string | null;
    system: string | null;
    assessmentYear: number | null;
    sourceUrl: string | null;
    accessedAt: string | null;
  };
}

/** Linha da lista do painel. */
export interface AdminSpeciesListItem {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  isPublished: boolean;
  updatedAt: string;
  hasCover: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
