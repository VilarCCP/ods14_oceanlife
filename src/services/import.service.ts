/**
 * Importação assistida (doc 01 §7.3, doc 03 §8).
 *
 * 1. A pessoa pesquisa um nome e escolhe explicitamente um registro.
 * 2. O servidor busca de novo o registro escolhido (nada vindo do navegador é
 *    aceito como dado científico) e monta sugestões só com o que a fonte
 *    realmente fornece.
 * 3. A pessoa revisa e edita. Ao salvar, a espécie vira (ou continua) rascunho
 *    e as fontes são registradas com URL, identificador e data de consulta.
 *
 * A importação nunca publica nada.
 */
import { fail, ok, type Result } from '@/lib/result';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

import { EXTERNAL_FAILURE_MESSAGES, type ExternalFailure, type Fetcher } from './external/http';
import { getGbifUsage, type GbifCandidate } from './gbif.service';
import { addSource, listSources, updateSource } from './source.service';
import { findSpeciesByScientificName, type DuplicateMatch } from './species.service';
import {
  getWormsPortugueseNames,
  getWormsRecord,
  isAcceptedRecord,
  type WormsRecord,
} from './worms.service';

export const IMPORTABLE_FIELDS = [
  'commonName',
  'scientificName',
  'taxonomicGroup',
  'wormsAphiaId',
  'gbifUsageKey',
] as const;
export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

export type ImportProvider = 'worms' | 'gbif';

export interface ImportSuggestion {
  field: ImportableField;
  value: string;
  source: ImportProvider;
}

/** Campo do formulário → nome usado em species_sources.fields_imported. */
const SOURCE_FIELD: Record<ImportableField, string> = {
  commonName: 'common_name',
  scientificName: 'scientific_name',
  taxonomicGroup: 'taxonomic_group',
  wormsAphiaId: 'worms_aphia_id',
  gbifUsageKey: 'gbif_usage_key',
};

export interface ImportSelection {
  worms: WormsRecord | null;
  wormsPortugueseNames: string[];
  gbif: GbifCandidate | null;
}

type Classification = WormsRecord['classification'];

const RANK_LABELS: [keyof Classification, string][] = [
  ['kingdom', 'Reino'],
  ['phylum', 'Filo'],
  ['class', 'Classe'],
  ['order', 'Ordem'],
  ['family', 'Família'],
];

/** "Reino: Animalia; Filo: Chordata; Ordem: Testudines; Família: Cheloniidae" (só o que existir). */
export function formatClassification(classification: Classification): string | null {
  const parts = RANK_LABELS.filter(([rank]) => classification[rank]).map(
    ([rank, label]) => `${label}: ${classification[rank]}`,
  );
  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * Sugestões a partir dos registros escolhidos. O WoRMS tem prioridade para
 * nome e classificação; o GBIF completa apenas o que o WoRMS não trouxe.
 * Não há sugestão para dieta, habitat, comportamento, conservação etc.
 */
export function buildSuggestions(selection: ImportSelection): ImportSuggestion[] {
  const suggestions: ImportSuggestion[] = [];
  const { worms, gbif } = selection;

  const commonName = selection.wormsPortugueseNames[0];
  if (worms && commonName)
    suggestions.push({ field: 'commonName', value: commonName, source: 'worms' });

  if (worms) {
    suggestions.push({ field: 'scientificName', value: worms.scientificName, source: 'worms' });
  } else if (gbif) {
    suggestions.push({
      field: 'scientificName',
      value: gbif.canonicalName ?? gbif.scientificName,
      source: 'gbif',
    });
  }

  const wormsGroup = worms ? formatClassification(worms.classification) : null;
  const gbifGroup = gbif ? formatClassification(gbif.classification) : null;
  if (wormsGroup) suggestions.push({ field: 'taxonomicGroup', value: wormsGroup, source: 'worms' });
  else if (gbifGroup)
    suggestions.push({ field: 'taxonomicGroup', value: gbifGroup, source: 'gbif' });

  if (worms)
    suggestions.push({ field: 'wormsAphiaId', value: String(worms.aphiaId), source: 'worms' });
  if (gbif)
    suggestions.push({ field: 'gbifUsageKey', value: String(gbif.usageKey), source: 'gbif' });

  return suggestions;
}

const same = (a: string | undefined, b: string) => (a ?? '').trim() === b.trim();

export interface SourcePayload {
  provider: ImportProvider;
  referenceTitle: string;
  sourceUrl: string;
  sourceRecordId: string;
  fieldsImported: string[];
  accessedAt: string;
  licenseOrAttribution: string;
  notes: string | null;
}

/** Data de hoje no horário de Brasília (AAAA-MM-DD). */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

/**
 * Fontes a registrar. Um campo só conta como importado se o valor final for
 * igual ao sugerido; se a pessoa editou, o texto passa a ser dela (doc 03 §10).
 */
export function buildSources(
  selection: ImportSelection,
  suggestions: ImportSuggestion[],
  finalValues: Partial<Record<ImportableField, string>>,
  accessedAt: string,
): SourcePayload[] {
  const fieldsFrom = (provider: ImportProvider) =>
    suggestions
      .filter((s) => s.source === provider && same(finalValues[s.field], s.value))
      .map((s) => SOURCE_FIELD[s.field]);

  const sources: SourcePayload[] = [];
  const { worms, gbif } = selection;

  if (worms) {
    sources.push({
      provider: 'worms',
      referenceTitle: `World Register of Marine Species (WoRMS): ${worms.scientificName}${worms.authority ? ` ${worms.authority}` : ''}`,
      sourceUrl: worms.url,
      sourceRecordId: String(worms.aphiaId),
      fieldsImported: fieldsFrom('worms'),
      accessedAt,
      licenseOrAttribution:
        worms.citation ??
        'WoRMS Editorial Board. World Register of Marine Species. Disponível em https://www.marinespecies.org (VLIZ). doi:10.14284/170.',
      notes: isAcceptedRecord(worms)
        ? null
        : `Registro com situação "${worms.status ?? 'não informada'}" no WoRMS.${worms.acceptedName ? ` Nome aceito: ${worms.acceptedName}.` : ''}`,
    });
  }

  if (gbif) {
    sources.push({
      provider: 'gbif',
      referenceTitle: `GBIF Backbone Taxonomy: ${gbif.scientificName}`,
      sourceUrl: gbif.url,
      sourceRecordId: String(gbif.usageKey),
      fieldsImported: fieldsFrom('gbif'),
      accessedAt,
      licenseOrAttribution: 'GBIF Secretariat. GBIF Backbone Taxonomy. Acessado via GBIF.org.',
      notes:
        gbif.status && gbif.status !== 'ACCEPTED'
          ? `Registro com situação "${gbif.status}" no GBIF.`
          : null,
    });
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Orquestração (servidor)
// ---------------------------------------------------------------------------

export interface ImportRequest {
  aphiaId: number | null;
  gbifKey: number | null;
}

export interface LoadedSelection extends ImportSelection {
  /** Avisos sobre fontes que falharam (a importação segue com o que funcionou). */
  warnings: string[];
}

function failureMessage(source: string, reason: ExternalFailure): string {
  return `${source}: ${EXTERNAL_FAILURE_MESSAGES[reason]}`;
}

/** Busca no servidor os registros escolhidos. */
export async function loadSelection(
  request: ImportRequest,
  fetcher?: Fetcher,
): Promise<Result<LoadedSelection>> {
  if (!request.aphiaId && !request.gbifKey) {
    return fail('validation', 'Escolha um registro do WoRMS ou do GBIF.');
  }

  const [wormsRecord, wormsNames, gbif] = await Promise.all([
    request.aphiaId ? getWormsRecord(request.aphiaId, fetcher) : null,
    request.aphiaId ? getWormsPortugueseNames(request.aphiaId, fetcher) : null,
    request.gbifKey ? getGbifUsage(request.gbifKey, fetcher) : null,
  ]);

  const warnings: string[] = [];
  if (wormsRecord && !wormsRecord.ok) {
    return fail('network', failureMessage('WoRMS', wormsRecord.reason));
  }
  if (gbif && !gbif.ok) {
    if (!wormsRecord) return fail('network', failureMessage('GBIF', gbif.reason));
    warnings.push(`${failureMessage('GBIF', gbif.reason)} O identificador do GBIF não será usado.`);
  }
  if (wormsNames && !wormsNames.ok) {
    warnings.push('Não foi possível consultar os nomes populares no WoRMS.');
  }

  return ok({
    worms: wormsRecord?.ok ? wormsRecord.data : null,
    wormsPortugueseNames: wormsNames?.ok ? wormsNames.data : [],
    gbif: gbif?.ok ? gbif.data : null,
    warnings,
  });
}

export interface ImportConflicts {
  /** Espécie que já usa o mesmo identificador WoRMS (bloqueia). */
  sameWorms: DuplicateMatch | null;
  /** Espécie que já usa o mesmo identificador GBIF (bloqueia). */
  sameGbif: DuplicateMatch | null;
  /** Espécies com o mesmo nome científico (aviso; exige confirmação). */
  sameName: DuplicateMatch[];
}

async function findByExternalId(
  client: TypedSupabaseClient,
  column: 'worms_aphia_id' | 'gbif_usage_key',
  value: number,
  excludeId: string | undefined,
): Promise<DuplicateMatch | null> {
  let query = client
    .from('species')
    .select('id, slug, common_name, scientific_name')
    .eq(column, value)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.maybeSingle();
  return data
    ? {
        id: data.id,
        slug: data.slug,
        commonName: data.common_name,
        scientificName: data.scientific_name,
      }
    : null;
}

/** Prevenção de duplicidades antes de importar (mudança aprovada 9). */
export async function findImportConflicts(
  client: TypedSupabaseClient,
  selection: ImportSelection,
  scientificName: string | null,
  excludeId?: string,
): Promise<ImportConflicts> {
  const [sameWorms, sameGbif, sameName] = await Promise.all([
    selection.worms
      ? findByExternalId(client, 'worms_aphia_id', selection.worms.aphiaId, excludeId)
      : null,
    selection.gbif
      ? findByExternalId(client, 'gbif_usage_key', selection.gbif.usageKey, excludeId)
      : null,
    scientificName ? findSpeciesByScientificName(client, scientificName, excludeId) : null,
  ]);
  return {
    sameWorms,
    sameGbif,
    sameName: sameName && sameName.ok ? sameName.data : [],
  };
}

/** Registra (ou atualiza) as fontes da importação na espécie. */
export async function saveImportSources(
  client: TypedSupabaseClient,
  speciesId: string,
  sources: SourcePayload[],
): Promise<Result<number>> {
  const existing = await listSources(client, speciesId);
  if (!existing.ok) return existing;

  let saved = 0;
  for (const source of sources) {
    const match = existing.data.find(
      (item) => item.provider === source.provider && item.sourceRecordId === source.sourceRecordId,
    );
    const result = match
      ? await updateSource(client, match.id, source)
      : await addSource(client, speciesId, source);
    if (!result.ok) return result;
    saved += 1;
  }
  return ok(saved);
}
