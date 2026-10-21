/**
 * Fontes e referências das espécies (doc 01 §6.3, doc 03 §10).
 */
import { isUuid } from '@/lib/ids';
import { fail, failFromDatabase, failFromException, ok, type Result } from '@/lib/result';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { sourceInputSchema, type SourceInput } from '@/lib/validation/media';
import { toFieldErrors } from '@/lib/validation/species';
import type { SpeciesSource } from '@/types/species';

import { SOURCE_COLUMNS, toSpeciesSource } from './mappers';

function toSourceColumns(input: SourceInput) {
  return {
    provider: input.provider,
    reference_title: input.referenceTitle,
    source_url: input.sourceUrl,
    source_record_id: input.sourceRecordId,
    fields_imported: input.fieldsImported,
    accessed_at: input.accessedAt,
    license_or_attribution: input.licenseOrAttribution,
    notes: input.notes,
  };
}

function parse(input: unknown): Result<SourceInput> {
  const parsed = sourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', 'Confira os dados da fonte.', {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }
  return ok(parsed.data);
}

export async function listSources(
  client: TypedSupabaseClient,
  speciesId: string,
): Promise<Result<SpeciesSource[]>> {
  if (!isUuid(speciesId)) return ok([]);
  try {
    const { data, error } = await client
      .from('species_sources')
      .select(SOURCE_COLUMNS)
      .eq('species_id', speciesId)
      .order('accessed_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) return failFromDatabase(error);
    return ok((data ?? []).map(toSpeciesSource));
  } catch (exception) {
    return failFromException(exception);
  }
}

export async function addSource(
  client: TypedSupabaseClient,
  speciesId: string,
  input: unknown,
): Promise<Result<SpeciesSource>> {
  if (!isUuid(speciesId)) return fail('not_found', 'Espécie não encontrada.');
  const parsed = parse(input);
  if (!parsed.ok) return parsed;
  try {
    const { data, error } = await client
      .from('species_sources')
      .insert({ species_id: speciesId, ...toSourceColumns(parsed.data) })
      .select(SOURCE_COLUMNS)
      .single();
    if (error) return failFromDatabase(error);
    return ok(toSpeciesSource(data));
  } catch (exception) {
    return failFromException(exception);
  }
}

export async function updateSource(
  client: TypedSupabaseClient,
  sourceId: string,
  input: unknown,
): Promise<Result<SpeciesSource>> {
  if (!isUuid(sourceId)) return fail('not_found', 'Fonte não encontrada.');
  const parsed = parse(input);
  if (!parsed.ok) return parsed;
  try {
    const { data, error } = await client
      .from('species_sources')
      .update(toSourceColumns(parsed.data))
      .eq('id', sourceId)
      .select(SOURCE_COLUMNS)
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Fonte não encontrada ou sem permissão para editar.');
    return ok(toSpeciesSource(data));
  } catch (exception) {
    return failFromException(exception);
  }
}

export async function deleteSource(
  client: TypedSupabaseClient,
  sourceId: string,
): Promise<Result<{ id: string }>> {
  if (!isUuid(sourceId)) return fail('not_found', 'Fonte não encontrada.');
  try {
    const { data, error } = await client
      .from('species_sources')
      .delete()
      .eq('id', sourceId)
      .select('id')
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Fonte não encontrada ou sem permissão para excluir.');
    return ok(data);
  } catch (exception) {
    return failFromException(exception);
  }
}
