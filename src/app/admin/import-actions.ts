'use server';

/**
 * Ações da importação assistida (doc 03 §8). Todas exigem administrador e
 * consultam as APIs externas apenas no servidor (doc 01 §4). Nenhuma publica.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { speciesToFormValues } from '@/components/admin/species-form-fields';
import { requireAdminAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';
import { slugify } from '@/lib/slug';
import { EXTERNAL_FAILURE_MESSAGES, type ExternalFailure } from '@/services/external/http';
import { matchGbifName, type GbifCandidate } from '@/services/gbif.service';
import {
  buildSources,
  buildSuggestions,
  findImportConflicts,
  IMPORTABLE_FIELDS,
  loadSelection,
  saveImportSources,
  todayInBrazil,
  type ImportableField,
  type ImportConflicts,
  type ImportSuggestion,
} from '@/services/import.service';
import { createSpeciesDraft, getSpeciesForEdit, updateSpecies } from '@/services/species.service';
import { searchWormsByName, type WormsRecord } from '@/services/worms.service';

export type SearchOutcome<T> =
  { status: 'ok'; items: T[] } | { status: 'error'; reason: ExternalFailure; message: string };

export interface ExternalSearchResult {
  term: string;
  worms: SearchOutcome<WormsRecord>;
  gbif: SearchOutcome<GbifCandidate> | null;
}

const searchSchema = z.object({
  term: z
    .string()
    .trim()
    .min(3, { error: 'Digite pelo menos 3 letras do nome científico.' })
    .max(200, { error: 'Use no máximo 200 caracteres.' }),
  includeGbif: z.boolean().default(true),
});

function outcome<T>(
  result: { ok: true; data: T[] } | { ok: false; reason: ExternalFailure },
): SearchOutcome<T> {
  return result.ok
    ? { status: 'ok', items: result.data }
    : { status: 'error', reason: result.reason, message: EXTERNAL_FAILURE_MESSAGES[result.reason] };
}

/** Pesquisa no WoRMS e, opcionalmente, no GBIF. Só acontece quando a pessoa pede. */
export async function searchExternalAction(input: unknown): Promise<Result<ExternalSearchResult>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Pesquisa inválida.');
  }
  const { term, includeGbif } = parsed.data;
  const [worms, gbif] = await Promise.all([
    searchWormsByName(term),
    includeGbif ? matchGbifName(term) : null,
  ]);
  return ok({ term, worms: outcome(worms), gbif: gbif ? outcome(gbif) : null });
}

const selectionSchema = z.object({
  aphiaId: z.number().int().positive().nullable(),
  gbifKey: z.number().int().positive().nullable(),
  speciesId: z.string().nullable().optional(),
});

export interface PreparedImport {
  suggestions: ImportSuggestion[];
  worms: WormsRecord | null;
  gbif: GbifCandidate | null;
  warnings: string[];
  conflicts: ImportConflicts;
  /** Valores atuais da espécie (importação para uma espécie existente). */
  current: Partial<Record<ImportableField, string>> | null;
  /** Sugestão de slug a partir do nome popular sugerido (cadastro novo). */
  suggestedSlug: string;
}

function currentValues(values: ReturnType<typeof speciesToFormValues>) {
  return Object.fromEntries(IMPORTABLE_FIELDS.map((field) => [field, values[field]])) as Record<
    ImportableField,
    string
  >;
}

/** Busca de novo os registros escolhidos e monta as sugestões para revisão. */
export async function prepareImportAction(input: unknown): Promise<Result<PreparedImport>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return fail('validation', 'Seleção inválida.');
  const { aphiaId, gbifKey, speciesId } = parsed.data;
  if (speciesId && !isUuid(speciesId)) return fail('not_found', 'Espécie não encontrada.');

  const selection = await loadSelection({ aphiaId, gbifKey });
  if (!selection.ok) return selection;

  let current: PreparedImport['current'] = null;
  if (speciesId) {
    const species = await getSpeciesForEdit(auth.data.client, speciesId);
    if (!species.ok) return species;
    if (!species.data) return fail('not_found', 'Espécie não encontrada.');
    current = currentValues(speciesToFormValues(species.data));
  }

  const suggestions = buildSuggestions(selection.data);
  const scientificName = suggestions.find((s) => s.field === 'scientificName')?.value ?? null;
  const conflicts = await findImportConflicts(
    auth.data.client,
    selection.data,
    scientificName,
    speciesId ?? undefined,
  );
  const commonName = suggestions.find((s) => s.field === 'commonName')?.value ?? '';

  return ok({
    suggestions,
    worms: selection.data.worms,
    gbif: selection.data.gbif,
    warnings: selection.data.warnings,
    conflicts,
    current,
    suggestedSlug: slugify(commonName),
  });
}

const saveSchema = selectionSchema.extend({
  /** Cadastro novo: valores revisados e editáveis. */
  values: z.record(z.string(), z.string()).optional(),
  /** Espécie existente: campos que podem ser substituídos. */
  replace: z.record(z.string(), z.boolean()).optional(),
  confirmDuplicateName: z.boolean().optional(),
});

/**
 * Salva a importação: cria um rascunho (ou atualiza a espécie, respeitando as
 * substituições confirmadas) e registra as fontes. Nunca publica.
 */
export async function saveImportAction(
  input: unknown,
): Promise<Result<{ id: string; sourcesSaved: number }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return fail('validation', 'Dados da importação inválidos.');
  const {
    aphiaId,
    gbifKey,
    speciesId,
    values = {},
    replace = {},
    confirmDuplicateName,
  } = parsed.data;
  const { client } = auth.data;

  // As sugestões são recalculadas no servidor; o navegador só envia escolhas e edições.
  const selection = await loadSelection({ aphiaId, gbifKey });
  if (!selection.ok) return selection;
  const suggestions = buildSuggestions(selection.data);
  const accessedAt = todayInBrazil();
  const options = { confirmDuplicateName: confirmDuplicateName === true };

  let id: string;
  let finalValues: Partial<Record<ImportableField, string>>;

  if (speciesId) {
    if (!isUuid(speciesId)) return fail('not_found', 'Espécie não encontrada.');
    const species = await getSpeciesForEdit(client, speciesId);
    if (!species.ok) return species;
    if (!species.data) return fail('not_found', 'Espécie não encontrada.');

    const formValues = speciesToFormValues(species.data);
    for (const suggestion of suggestions) {
      const currentValue = formValues[suggestion.field].trim();
      // Campo vazio recebe a sugestão; campo preenchido só com confirmação (doc 03 §8.3).
      if (currentValue === '' || replace[suggestion.field] === true) {
        formValues[suggestion.field] = suggestion.value;
      }
    }
    const updated = await updateSpecies(client, speciesId, formValues, options);
    if (!updated.ok) return updated;
    id = updated.data.id;
    finalValues = currentValues(formValues);
  } else {
    const draft = {
      commonName: values.commonName ?? '',
      scientificName: values.scientificName ?? '',
      slug: values.slug ?? '',
      displayGroup: values.displayGroup ?? '',
      taxonomicGroup: values.taxonomicGroup ?? '',
      wormsAphiaId: selection.data.worms ? String(selection.data.worms.aphiaId) : '',
      gbifUsageKey: selection.data.gbif ? String(selection.data.gbif.usageKey) : '',
    };
    const created = await createSpeciesDraft(client, draft, options);
    if (!created.ok) return created;
    id = created.data.id;
    finalValues = draft;
  }

  const sources = buildSources(selection.data, suggestions, finalValues, accessedAt);
  const saved = await saveImportSources(client, id, sources);
  revalidatePath('/admin', 'layout');
  if (!saved.ok) {
    return fail(
      'unknown',
      'A espécie foi salva, mas não foi possível registrar as fontes. Adicione-as na página da espécie.',
    );
  }
  return ok({ id, sourcesSaved: saved.data });
}
