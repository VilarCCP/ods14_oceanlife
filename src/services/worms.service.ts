/**
 * WoRMS — World Register of Marine Species (doc 01 §7.1).
 * API REST oficial: https://www.marinespecies.org/rest/
 *
 * Só dados taxonômicos: nome científico, autoria, situação (aceito ou não),
 * classificação e nomes populares. Nada de dieta, comportamento ou
 * conservação: a API não fornece e nada é inventado (doc 03 §8.3).
 */
import { z } from 'zod';

import {
  apiBaseUrl,
  cleanExternalText,
  getJson,
  type ExternalResult,
  type Fetcher,
} from './external/http';

export const WORMS_DEFAULT_URL = 'https://www.marinespecies.org/rest';
export const WORMS_SITE_URL = 'https://www.marinespecies.org';

export function wormsBaseUrl(): string {
  return apiBaseUrl(process.env.WORMS_API_URL, WORMS_DEFAULT_URL);
}

/** Quantos registros mostrar por pesquisa (a API devolve até 50 por página). */
export const WORMS_MAX_RESULTS = 25;

const nullableText = z.string().nullable().optional();

const aphiaRecordSchema = z.object({
  AphiaID: z.number().int().positive(),
  url: nullableText,
  scientificname: z.string().min(1),
  authority: nullableText,
  status: nullableText,
  unacceptreason: nullableText,
  rank: nullableText,
  valid_AphiaID: z.number().int().positive().nullable().optional(),
  valid_name: nullableText,
  valid_authority: nullableText,
  kingdom: nullableText,
  phylum: nullableText,
  class: nullableText,
  order: nullableText,
  family: nullableText,
  genus: nullableText,
  citation: nullableText,
  isMarine: z.number().nullable().optional(),
  isExtinct: z.number().nullable().optional(),
});

const vernacularSchema = z.object({
  vernacular: z.string(),
  language_code: z.string().nullable().optional(),
});

export interface WormsRecord {
  aphiaId: number;
  scientificName: string;
  authority: string | null;
  /** "accepted", "unaccepted" ou outro valor informado pela fonte. */
  status: string | null;
  unacceptReason: string | null;
  rank: string | null;
  acceptedAphiaId: number | null;
  acceptedName: string | null;
  acceptedAuthority: string | null;
  classification: {
    kingdom: string | null;
    phylum: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
  };
  citation: string | null;
  url: string;
  isMarine: boolean | null;
  isExtinct: boolean | null;
}

export function wormsRecordUrl(aphiaId: number): string {
  return `${WORMS_SITE_URL}/aphia.php?p=taxdetails&id=${aphiaId}`;
}

function flag(value: number | null | undefined): boolean | null {
  return value === null || value === undefined ? null : value === 1;
}

export function toWormsRecord(raw: z.infer<typeof aphiaRecordSchema>): WormsRecord {
  const sourceUrl =
    raw.url && /^https:\/\/(www\.)?marinespecies\.org\//.test(raw.url) ? raw.url : null;
  return {
    aphiaId: raw.AphiaID,
    scientificName: cleanExternalText(raw.scientificname, 200) ?? String(raw.AphiaID),
    authority: cleanExternalText(raw.authority, 200),
    status: cleanExternalText(raw.status, 50),
    unacceptReason: cleanExternalText(raw.unacceptreason, 300),
    rank: cleanExternalText(raw.rank, 50),
    acceptedAphiaId: raw.valid_AphiaID ?? null,
    acceptedName: cleanExternalText(raw.valid_name, 200),
    acceptedAuthority: cleanExternalText(raw.valid_authority, 200),
    classification: {
      kingdom: cleanExternalText(raw.kingdom, 100),
      phylum: cleanExternalText(raw.phylum, 100),
      class: cleanExternalText(raw.class, 100),
      order: cleanExternalText(raw.order, 100),
      family: cleanExternalText(raw.family, 100),
      genus: cleanExternalText(raw.genus, 100),
    },
    citation: cleanExternalText(raw.citation, 500),
    url: sourceUrl ?? wormsRecordUrl(raw.AphiaID),
    isMarine: flag(raw.isMarine),
    isExtinct: flag(raw.isExtinct),
  };
}

/** O registro é o nome aceito (e não um sinônimo)? */
export function isAcceptedRecord(record: WormsRecord): boolean {
  return (
    record.status === 'accepted' &&
    (record.acceptedAphiaId === null || record.acceptedAphiaId === record.aphiaId)
  );
}

/**
 * Pesquisa por nome científico. Usa correspondência parcial (`like`) e só
 * organismos marinhos; nomes ambíguos voltam como lista para escolha
 * explícita (doc 03 §8.2).
 */
export async function searchWormsByName(
  term: string,
  fetcher?: Fetcher,
): Promise<ExternalResult<WormsRecord[]>> {
  const name = term.trim().replace(/\s+/g, ' ');
  if (name.length < 3) return { ok: false, reason: 'empty' };

  const url = `${wormsBaseUrl()}/AphiaRecordsByName/${encodeURIComponent(name)}?like=true&marine_only=true&offset=1`;
  const response = await getJson(url, fetcher);
  if (!response.ok) return response;

  const parsed = z.array(z.unknown()).safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: 'invalid_response' };

  // Registros fora do formato esperado são ignorados, não interrompem a pesquisa.
  const records = parsed.data
    .map((item) => aphiaRecordSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => toWormsRecord(item.data));
  if (records.length === 0) return { ok: false, reason: 'empty' };

  // Correspondência exata primeiro; depois aceitos; depois o restante.
  const normalized = name.toLowerCase();
  const score = (record: WormsRecord) =>
    (record.scientificName.toLowerCase() === normalized ? 0 : 2) +
    (isAcceptedRecord(record) ? 0 : 1);
  records.sort((a, b) => score(a) - score(b) || a.scientificName.localeCompare(b.scientificName));

  return { ok: true, data: records.slice(0, WORMS_MAX_RESULTS) };
}

export async function getWormsRecord(
  aphiaId: number,
  fetcher?: Fetcher,
): Promise<ExternalResult<WormsRecord>> {
  if (!Number.isInteger(aphiaId) || aphiaId <= 0) return { ok: false, reason: 'empty' };
  const response = await getJson(`${wormsBaseUrl()}/AphiaRecordByAphiaID/${aphiaId}`, fetcher);
  if (!response.ok) return response;
  const parsed = aphiaRecordSchema.safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: 'invalid_response' };
  return { ok: true, data: toWormsRecord(parsed.data) };
}

/**
 * Nomes populares em português (código "por"). Se a fonte não tiver, a lista
 * vem vazia e o nome popular fica para a equipe preencher.
 */
export async function getWormsPortugueseNames(
  aphiaId: number,
  fetcher?: Fetcher,
): Promise<ExternalResult<string[]>> {
  const response = await getJson(`${wormsBaseUrl()}/AphiaVernacularsByAphiaID/${aphiaId}`, fetcher);
  if (!response.ok) return response.reason === 'empty' ? { ok: true, data: [] } : response;
  const parsed = z.array(z.unknown()).safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: 'invalid_response' };
  const names = parsed.data
    .map((item) => vernacularSchema.safeParse(item))
    .filter((item) => item.success && item.data.language_code === 'por')
    .map((item) => (item.success ? cleanExternalText(item.data.vernacular, 150) : null))
    .filter((name): name is string => Boolean(name));
  return { ok: true, data: [...new Set(names)] };
}
