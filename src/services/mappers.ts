import { IMAGE_BUCKET } from '@/lib/images';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import type { SpeciesInput } from '@/lib/validation/species';
import type { Database, Json } from '@/types/database';
import type {
  ConservationAssessment,
  SpeciesGroup,
  SpeciesImage,
  SpeciesSource,
} from '@/types/species';

type Tables = Database['public']['Tables'];
export type SpeciesRow = Tables['species']['Row'];
export type SpeciesImageRow = Tables['species_images']['Row'];
export type SpeciesSourceRow = Tables['species_sources']['Row'];
export type SpeciesInsert = Tables['species']['Insert'];

/** Colunas de imagem usadas em todas as consultas. */
export const IMAGE_COLUMNS =
  'id, storage_path, alt_text, caption, credit, license, source_url, is_cover, display_order';

/** Colunas de fonte usadas em todas as consultas. */
export const SOURCE_COLUMNS =
  'id, provider, reference_title, source_url, source_record_id, fields_imported, accessed_at, license_or_attribution, notes';

type ImageColumns = Pick<
  SpeciesImageRow,
  | 'id'
  | 'storage_path'
  | 'alt_text'
  | 'caption'
  | 'credit'
  | 'license'
  | 'source_url'
  | 'is_cover'
  | 'display_order'
>;

type SourceColumns = Pick<
  SpeciesSourceRow,
  | 'id'
  | 'provider'
  | 'reference_title'
  | 'source_url'
  | 'source_record_id'
  | 'fields_imported'
  | 'accessed_at'
  | 'license_or_attribution'
  | 'notes'
>;

export function publicImageUrl(client: TypedSupabaseClient, storagePath: string): string {
  return client.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function toSpeciesImage(client: TypedSupabaseClient, row: ImageColumns): SpeciesImage {
  return {
    id: row.id,
    storagePath: row.storage_path,
    url: publicImageUrl(client, row.storage_path),
    altText: row.alt_text,
    caption: row.caption,
    credit: row.credit,
    license: row.license,
    sourceUrl: row.source_url,
    isCover: row.is_cover,
    displayOrder: row.display_order,
  };
}

/** Imagens na ordem do painel (display_order, depois data de inclusão implícita no id). */
export function sortImages<T extends { displayOrder: number; id: string }>(images: T[]): T[] {
  return [...images].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
}

function toStringArray(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function toSpeciesSource(row: SourceColumns): SpeciesSource {
  const provider =
    row.provider === 'worms' || row.provider === 'gbif' || row.provider === 'manual'
      ? row.provider
      : 'manual';
  return {
    id: row.id,
    provider,
    referenceTitle: row.reference_title,
    sourceUrl: row.source_url,
    sourceRecordId: row.source_record_id,
    fieldsImported: toStringArray(row.fields_imported),
    accessedAt: row.accessed_at,
    licenseOrAttribution: row.license_or_attribution,
    notes: row.notes,
  };
}

/** Só devolve a avaliação quando está completa: categoria, sistema, fonte e data. */
export function toConservation(row: SpeciesRow): ConservationAssessment | null {
  if (
    !row.conservation_category ||
    !row.conservation_system ||
    !row.conservation_source_url ||
    !row.conservation_accessed_at
  ) {
    return null;
  }
  return {
    category: row.conservation_category,
    system: row.conservation_system,
    assessmentYear: row.conservation_assessment_year,
    sourceUrl: row.conservation_source_url,
    accessedAt: row.conservation_accessed_at,
  };
}

export function toGroup(
  value: { slug: string; label: string } | { slug: string; label: string }[] | null | undefined,
): SpeciesGroup | null {
  const group = Array.isArray(value) ? value[0] : value;
  return group ? { slug: group.slug, label: group.label } : null;
}

/** Converte os dados validados do formulário para colunas do banco. */
export function toSpeciesColumns(input: SpeciesInput): Omit<SpeciesInsert, 'id' | 'is_published'> {
  return {
    slug: input.slug,
    common_name: input.commonName,
    scientific_name: input.scientificName,
    display_group: input.displayGroup,
    taxonomic_group: input.taxonomicGroup,
    short_description: input.shortDescription,
    description: input.description,
    habitat: input.habitat,
    geographic_distribution: input.geographicDistribution,
    diet: input.diet,
    physical_characteristics: input.physicalCharacteristics,
    behavior: input.behavior,
    life_expectancy: input.lifeExpectancy,
    main_threats: input.mainThreats,
    ecosystem_importance: input.ecosystemImportance,
    curiosities: input.curiosities,
    conservation_category: input.conservationCategory,
    conservation_system: input.conservationSystem,
    conservation_assessment_year: input.conservationAssessmentYear,
    conservation_source_url: input.conservationSourceUrl,
    conservation_accessed_at: input.conservationAccessedAt,
    extinction_risk: input.extinctionRisk,
    worms_aphia_id: input.wormsAphiaId,
    gbif_usage_key: input.gbifUsageKey,
    is_featured: input.isFeatured,
  };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
