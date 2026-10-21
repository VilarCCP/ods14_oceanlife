/**
 * Regras de negócio e acesso aos dados de espécies.
 *
 * Os serviços recebem o cliente Supabase como parâmetro: o site público usa o
 * cliente anônimo e o painel usa o cliente com a sessão do administrador. As
 * permissões são sempre garantidas pela RLS; os filtros `is_published` aqui
 * são uma segunda barreira para o site público.
 */
import { isUuid } from '@/lib/ids';
import {
  fail,
  failFromDatabase,
  failFromException,
  isPublicationIssue,
  ok,
  PUBLICATION_ISSUE_MESSAGES,
  type PublicationIssue,
  type Result,
} from '@/lib/result';
import { isValidSlug } from '@/lib/slug';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { buildSearchPattern, normalizeText } from '@/lib/text';
import {
  ADMIN_PAGE_SIZE,
  PUBLIC_PAGE_SIZE,
  speciesInputSchema,
  toFieldErrors,
  type AdminSearchParams,
} from '@/lib/validation/species';
import { IMAGE_BUCKET } from '@/lib/images';
import type {
  AdminSpeciesDetail,
  AdminSpeciesListItem,
  Paginated,
  SpeciesDetail,
  SpeciesGroup,
  SpeciesSummary,
} from '@/types/species';

import {
  pageCount,
  sortImages,
  toConservation,
  toGroup,
  toSpeciesColumns,
  toSpeciesImage,
  toSpeciesSource,
  type SpeciesRow,
} from './mappers';

// ===========================================================================
// Site público
// ===========================================================================

export interface PublicListOptions {
  q?: string;
  group?: string;
  page?: number;
  pageSize?: number;
}

/** Catálogo público: apenas espécies publicadas, com a imagem de capa. */
export async function listPublishedSpecies(
  client: TypedSupabaseClient,
  options: PublicListOptions = {},
): Promise<Result<Paginated<SpeciesSummary>>> {
  const pageSize = options.pageSize ?? PUBLIC_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * pageSize;

  try {
    let query = client
      .from('species')
      .select(
        'id, slug, common_name, scientific_name, short_description, species_groups(slug, label), species_images(id, storage_path, alt_text, caption, credit, license, source_url, is_cover, display_order)',
        { count: 'exact' },
      )
      .eq('is_published', true)
      .eq('species_images.is_cover', true);

    const pattern = buildSearchPattern(options.q);
    if (pattern) query = query.ilike('search_text', pattern);
    if (options.group) query = query.eq('display_group', options.group);

    const { data, error, count } = await query
      .order('common_name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      // Página além do fim: o PostgREST responde "Requested range not satisfiable".
      if (error.code === 'PGRST103') {
        return ok({
          items: [],
          total: count ?? 0,
          page,
          pageSize,
          pageCount: pageCount(count ?? 0, pageSize),
        });
      }
      return failFromDatabase(error);
    }

    const total = count ?? 0;
    const items: SpeciesSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      commonName: row.common_name,
      scientificName: row.scientific_name,
      shortDescription: row.short_description,
      group: toGroup(row.species_groups),
      cover: row.species_images[0] ? toSpeciesImage(client, row.species_images[0]) : null,
    }));

    return ok({ items, total, page, pageSize, pageCount: pageCount(total, pageSize) });
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Espécies em destaque (campo explícito is_featured, doc 02 §5.2). */
export async function listFeaturedSpecies(
  client: TypedSupabaseClient,
  limit = 6,
): Promise<Result<SpeciesSummary[]>> {
  try {
    const { data, error } = await client
      .from('species')
      .select(
        'id, slug, common_name, scientific_name, short_description, species_groups(slug, label), species_images(id, storage_path, alt_text, caption, credit, license, source_url, is_cover, display_order)',
      )
      .eq('is_published', true)
      .eq('is_featured', true)
      .eq('species_images.is_cover', true)
      .order('common_name', { ascending: true })
      .limit(limit);

    if (error) return failFromDatabase(error);
    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        shortDescription: row.short_description,
        group: toGroup(row.species_groups),
        cover: row.species_images[0] ? toSpeciesImage(client, row.species_images[0]) : null,
      })),
    );
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Espécies relacionadas: mesmo grupo educativo (mudança aprovada 6). */
export async function listRelatedSpecies(
  client: TypedSupabaseClient,
  species: { id: string; groupSlug: string | null },
  limit = 4,
): Promise<Result<SpeciesSummary[]>> {
  if (!species.groupSlug) return ok([]);
  try {
    const { data, error } = await client
      .from('species')
      .select(
        'id, slug, common_name, scientific_name, short_description, species_groups(slug, label), species_images(id, storage_path, alt_text, caption, credit, license, source_url, is_cover, display_order)',
      )
      .eq('is_published', true)
      .eq('display_group', species.groupSlug)
      .neq('id', species.id)
      .eq('species_images.is_cover', true)
      .order('common_name', { ascending: true })
      .limit(limit);

    if (error) return failFromDatabase(error);
    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        shortDescription: row.short_description,
        group: toGroup(row.species_groups),
        cover: row.species_images[0] ? toSpeciesImage(client, row.species_images[0]) : null,
      })),
    );
  } catch (exception) {
    return failFromException(exception);
  }
}

/**
 * Grupos que têm pelo menos uma espécie publicada. O filtro do catálogo só
 * mostra grupos com dados (doc 02 §6.3).
 */
export async function listGroupsWithPublishedSpecies(
  client: TypedSupabaseClient,
): Promise<Result<SpeciesGroup[]>> {
  try {
    const { data, error } = await client
      .from('species_groups')
      .select('slug, label, sort_order, species!inner(id)')
      .eq('species.is_published', true)
      .limit(1, { referencedTable: 'species' })
      .order('sort_order', { ascending: true });

    if (error) return failFromDatabase(error);
    return ok((data ?? []).map((row) => ({ slug: row.slug, label: row.label })));
  } catch (exception) {
    return failFromException(exception);
  }
}

function toSpeciesDetail(
  client: TypedSupabaseClient,
  row: SpeciesRow & {
    species_groups: { slug: string; label: string } | null;
    species_images: Parameters<typeof toSpeciesImage>[1][];
    species_sources: Parameters<typeof toSpeciesSource>[0][];
  },
): SpeciesDetail {
  const images = sortImages(row.species_images.map((image) => toSpeciesImage(client, image)));
  return {
    id: row.id,
    slug: row.slug,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    shortDescription: row.short_description,
    group: toGroup(row.species_groups),
    cover: images.find((image) => image.isCover) ?? null,
    taxonomicGroup: row.taxonomic_group,
    description: row.description,
    habitat: row.habitat,
    geographicDistribution: row.geographic_distribution,
    diet: row.diet,
    physicalCharacteristics: row.physical_characteristics,
    behavior: row.behavior,
    lifeExpectancy: row.life_expectancy,
    mainThreats: row.main_threats,
    ecosystemImportance: row.ecosystem_importance,
    curiosities: row.curiosities,
    conservation: toConservation(row),
    extinctionRisk: row.extinction_risk,
    images,
    sources: row.species_sources
      .map(toSpeciesSource)
      .sort((a, b) => a.accessedAt.localeCompare(b.accessedAt) || a.id.localeCompare(b.id)),
    updatedAt: row.updated_at,
  };
}

const DETAIL_SELECT =
  '*, species_groups(slug, label), species_images(id, storage_path, alt_text, caption, credit, license, source_url, is_cover, display_order), species_sources(id, provider, reference_title, source_url, source_record_id, fields_imported, accessed_at, license_or_attribution, notes)' as const;

/**
 * Página pública da espécie. Retorna `null` para slug inválido, inexistente
 * ou não publicado — sem distinguir os casos (doc 02 §7.6).
 */
export async function getPublishedSpeciesBySlug(
  client: TypedSupabaseClient,
  slug: string,
): Promise<Result<SpeciesDetail | null>> {
  if (!isValidSlug(slug)) return ok(null);
  try {
    const { data, error } = await client
      .from('species')
      .select(DETAIL_SELECT)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) return failFromDatabase(error);
    return ok(data ? toSpeciesDetail(client, data) : null);
  } catch (exception) {
    return failFromException(exception);
  }
}

// ===========================================================================
// Painel administrativo
// ===========================================================================

/** Lista do painel: rascunhos e publicadas, com pesquisa, filtro e ordenação. */
export async function listAdminSpecies(
  client: TypedSupabaseClient,
  params: Partial<AdminSearchParams> = {},
  pageSize = ADMIN_PAGE_SIZE,
): Promise<Result<Paginated<AdminSpeciesListItem>>> {
  const page = Math.max(1, params.pagina ?? 1);
  const from = (page - 1) * pageSize;

  try {
    let query = client
      .from('species')
      .select(
        'id, slug, common_name, scientific_name, is_published, updated_at, species_images(id)',
        {
          count: 'exact',
        },
      )
      .eq('species_images.is_cover', true);

    const pattern = buildSearchPattern(params.q);
    if (pattern) query = query.ilike('search_text', pattern);
    if (params.status === 'draft') query = query.eq('is_published', false);
    if (params.status === 'published') query = query.eq('is_published', true);

    query =
      params.sort === 'name'
        ? query.order('common_name', { ascending: true })
        : query.order('updated_at', { ascending: false });

    const { data, error, count } = await query
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      if (error.code === 'PGRST103') {
        return ok({
          items: [],
          total: count ?? 0,
          page,
          pageSize,
          pageCount: pageCount(count ?? 0, pageSize),
        });
      }
      return failFromDatabase(error);
    }

    const total = count ?? 0;
    return ok({
      items: (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        isPublished: row.is_published,
        updatedAt: row.updated_at,
        hasCover: row.species_images.length > 0,
      })),
      total,
      page,
      pageSize,
      pageCount: pageCount(total, pageSize),
    });
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Contagens do resumo do painel (doc 03 §5). */
export async function countSpeciesByStatus(
  client: TypedSupabaseClient,
): Promise<Result<{ published: number; drafts: number }>> {
  try {
    const [published, drafts] = await Promise.all([
      client.from('species').select('id', { count: 'exact', head: true }).eq('is_published', true),
      client.from('species').select('id', { count: 'exact', head: true }).eq('is_published', false),
    ]);
    if (published.error) return failFromDatabase(published.error);
    if (drafts.error) return failFromDatabase(drafts.error);
    return ok({ published: published.count ?? 0, drafts: drafts.count ?? 0 });
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Espécie completa para edição. `null` se não existir ou não for visível. */
export async function getSpeciesForEdit(
  client: TypedSupabaseClient,
  id: string,
): Promise<Result<AdminSpeciesDetail | null>> {
  if (!isUuid(id)) return ok(null);
  try {
    const { data, error } = await client
      .from('species')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return ok(null);

    return ok({
      ...toSpeciesDetail(client, data),
      wormsAphiaId: data.worms_aphia_id,
      gbifUsageKey: data.gbif_usage_key,
      isFeatured: data.is_featured,
      isPublished: data.is_published,
      publishedAt: data.published_at,
      createdAt: data.created_at,
      conservationRaw: {
        category: data.conservation_category,
        system: data.conservation_system,
        assessmentYear: data.conservation_assessment_year,
        sourceUrl: data.conservation_source_url,
        accessedAt: data.conservation_accessed_at,
      },
    });
  } catch (exception) {
    return failFromException(exception);
  }
}

export interface DuplicateMatch {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
}

/** Espécies com o mesmo nome científico normalizado (mudança aprovada 9). */
export async function findSpeciesByScientificName(
  client: TypedSupabaseClient,
  scientificName: string,
  excludeId?: string,
): Promise<Result<DuplicateMatch[]>> {
  const normalized = normalizeText(scientificName);
  if (!normalized) return ok([]);
  try {
    let query = client
      .from('species')
      .select('id, slug, common_name, scientific_name')
      .eq('scientific_name_normalized', normalized)
      .limit(5);
    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query;
    if (error) return failFromDatabase(error);
    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        commonName: row.common_name,
        scientificName: row.scientific_name,
      })),
    );
  } catch (exception) {
    return failFromException(exception);
  }
}

export interface SaveOptions {
  /** O administrador confirmou que quer salvar mesmo com nome científico repetido. */
  confirmDuplicateName?: boolean;
}

async function checkDuplicateName(
  client: TypedSupabaseClient,
  scientificName: string,
  excludeId: string | undefined,
  options: SaveOptions,
): Promise<Result<null>> {
  if (options.confirmDuplicateName) return ok(null);
  const matches = await findSpeciesByScientificName(client, scientificName, excludeId);
  if (!matches.ok) return matches;
  if (matches.data.length > 0) {
    return fail(
      'duplicate_scientific_name',
      'Já existe uma espécie com este nome científico. Confira se não é a mesma antes de continuar.',
      { matches: matches.data },
    );
  }
  return ok(null);
}

/** Cria um rascunho. Nunca publica (doc 01 §7.3). */
export async function createSpeciesDraft(
  client: TypedSupabaseClient,
  input: unknown,
  options: SaveOptions = {},
): Promise<Result<{ id: string; slug: string }>> {
  const parsed = speciesInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', 'Alguns dados estão inválidos. Confira os campos destacados.', {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }

  try {
    const duplicate = await checkDuplicateName(
      client,
      parsed.data.scientificName,
      undefined,
      options,
    );
    if (!duplicate.ok) return duplicate;

    const { data, error } = await client
      .from('species')
      .insert({ ...toSpeciesColumns(parsed.data), is_published: false })
      .select('id, slug')
      .single();

    if (error) return failFromDatabase(error);
    return ok(data);
  } catch (exception) {
    return failFromException(exception);
  }
}

/**
 * Atualiza uma espécie (rascunho ou publicada). Se a alteração deixar uma
 * espécie publicada incompleta, o banco bloqueia e o erro lista o motivo.
 */
export async function updateSpecies(
  client: TypedSupabaseClient,
  id: string,
  input: unknown,
  options: SaveOptions = {},
): Promise<Result<{ id: string; slug: string }>> {
  if (!isUuid(id)) return fail('not_found', 'Espécie não encontrada.');
  const parsed = speciesInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', 'Alguns dados estão inválidos. Confira os campos destacados.', {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }

  try {
    const duplicate = await checkDuplicateName(client, parsed.data.scientificName, id, options);
    if (!duplicate.ok) return duplicate;

    const { data, error } = await client
      .from('species')
      .update(toSpeciesColumns(parsed.data))
      .eq('id', id)
      .select('id, slug')
      .maybeSingle();

    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Espécie não encontrada ou sem permissão para editar.');
    return ok(data);
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Lista do que falta para publicar (vazia = pode publicar). */
export async function getPublicationIssues(
  client: TypedSupabaseClient,
  id: string,
): Promise<Result<PublicationIssue[]>> {
  if (!isUuid(id)) return fail('not_found', 'Espécie não encontrada.');
  try {
    const { data, error } = await client.rpc('species_publication_issues', { p_species_id: id });
    if (error) return failFromDatabase(error);
    if (data === null) return fail('not_found', 'Espécie não encontrada.');
    return ok(data.filter(isPublicationIssue));
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Publica após validar no servidor; explica cada impedimento (doc 03 §11). */
export async function publishSpecies(
  client: TypedSupabaseClient,
  id: string,
): Promise<Result<{ id: string }>> {
  const issues = await getPublicationIssues(client, id);
  if (!issues.ok) return issues;
  if (issues.data.length > 0) {
    return fail(
      'not_publishable',
      'A espécie ainda não pode ser publicada. ' +
        issues.data.map((issue) => PUBLICATION_ISSUE_MESSAGES[issue]).join(' '),
      { issues: issues.data },
    );
  }

  try {
    const { data, error } = await client
      .from('species')
      .update({ is_published: true })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Espécie não encontrada ou sem permissão para publicar.');
    return ok(data);
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Retira a publicação: some do site, continua no painel (doc 03 §12). */
export async function unpublishSpecies(
  client: TypedSupabaseClient,
  id: string,
): Promise<Result<{ id: string }>> {
  if (!isUuid(id)) return fail('not_found', 'Espécie não encontrada.');
  try {
    const { data, error } = await client
      .from('species')
      .update({ is_published: false, is_featured: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Espécie não encontrada ou sem permissão.');
    return ok(data);
  } catch (exception) {
    return failFromException(exception);
  }
}

export interface DeleteSpeciesResult {
  id: string;
  removedFiles: number;
  /** Arquivos que não puderam ser apagados do Storage (para limpeza posterior). */
  orphanedFiles: string[];
}

/**
 * Exclui a espécie (registros de imagens e fontes saem em cascata) e depois os
 * arquivos no Storage. O banco é a fonte de verdade: se a remoção de arquivos
 * falhar, a exclusão continua válida e os caminhos são devolvidos para que o
 * painel avise e a limpeza possa ser feita depois (doc 03 §13).
 */
export async function deleteSpecies(
  client: TypedSupabaseClient,
  id: string,
): Promise<Result<DeleteSpeciesResult>> {
  if (!isUuid(id)) return fail('not_found', 'Espécie não encontrada.');
  try {
    const images = await client.from('species_images').select('storage_path').eq('species_id', id);
    if (images.error) return failFromDatabase(images.error);
    const paths = (images.data ?? []).map((row) => row.storage_path);

    const { data, error } = await client
      .from('species')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Espécie não encontrada ou sem permissão para excluir.');

    if (paths.length === 0) return ok({ id, removedFiles: 0, orphanedFiles: [] });

    const removal = await client.storage.from(IMAGE_BUCKET).remove(paths);
    if (removal.error) return ok({ id, removedFiles: 0, orphanedFiles: paths });

    const removed = new Set((removal.data ?? []).map((file) => file.name));
    const orphaned = paths.filter((path) => !removed.has(path));
    return ok({ id, removedFiles: paths.length - orphaned.length, orphanedFiles: orphaned });
  } catch (exception) {
    return failFromException(exception);
  }
}
