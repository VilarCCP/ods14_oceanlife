/**
 * GBIF — fonte complementar de informação taxonômica (doc 01 §7.2).
 * Species API v1, correspondência de nomes: https://api.gbif.org/v1/species/match
 *
 * Usa a GBIF Backbone Taxonomy (padrão do /v1/species/match). Observação: o
 * GBIF informa que a Backbone não recebe mais atualizações, mas continua
 * disponível; por isso o WoRMS é a fonte principal e o GBIF é complementar.
 */
import { z } from 'zod';

import {
  apiBaseUrl,
  cleanExternalText,
  getJson,
  type ExternalResult,
  type Fetcher,
} from './external/http';

export const GBIF_DEFAULT_URL = 'https://api.gbif.org';

export function gbifBaseUrl(): string {
  return apiBaseUrl(process.env.GBIF_API_URL, GBIF_DEFAULT_URL);
}

export function gbifSpeciesUrl(usageKey: number): string {
  return `https://www.gbif.org/species/${usageKey}`;
}

const nullableText = z.string().nullable().optional();

const matchSchema = z.object({
  usageKey: z.number().int().positive().optional(),
  scientificName: nullableText,
  canonicalName: nullableText,
  rank: nullableText,
  status: nullableText,
  confidence: z.number().optional(),
  matchType: z.string(),
  kingdom: nullableText,
  phylum: nullableText,
  class: nullableText,
  order: nullableText,
  family: nullableText,
  genus: nullableText,
  acceptedUsageKey: z.number().int().positive().optional(),
});

const matchResponseSchema = matchSchema.extend({
  alternatives: z.array(z.unknown()).optional(),
});

export interface GbifCandidate {
  usageKey: number;
  scientificName: string;
  canonicalName: string | null;
  rank: string | null;
  /** ACCEPTED, SYNONYM, DOUBTFUL… */
  status: string | null;
  /** EXACT, FUZZY, HIGHERRANK… */
  matchType: string;
  confidence: number | null;
  acceptedUsageKey: number | null;
  classification: {
    kingdom: string | null;
    phylum: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
  };
  url: string;
}

function toCandidate(raw: z.infer<typeof matchSchema>): GbifCandidate | null {
  if (!raw.usageKey || raw.matchType === 'NONE') return null;
  const scientificName =
    cleanExternalText(raw.scientificName, 250) ?? cleanExternalText(raw.canonicalName, 200);
  if (!scientificName) return null;
  return {
    usageKey: raw.usageKey,
    scientificName,
    canonicalName: cleanExternalText(raw.canonicalName, 200),
    rank: cleanExternalText(raw.rank, 50),
    status: cleanExternalText(raw.status, 50),
    matchType: cleanExternalText(raw.matchType, 30) ?? 'NONE',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    acceptedUsageKey: raw.acceptedUsageKey ?? null,
    classification: {
      kingdom: cleanExternalText(raw.kingdom, 100),
      phylum: cleanExternalText(raw.phylum, 100),
      class: cleanExternalText(raw.class, 100),
      order: cleanExternalText(raw.order, 100),
      family: cleanExternalText(raw.family, 100),
      genus: cleanExternalText(raw.genus, 100),
    },
    url: gbifSpeciesUrl(raw.usageKey),
  };
}

/**
 * Correspondência de nome no GBIF. Devolve a melhor correspondência e as
 * alternativas, para escolha explícita: nunca escolhe sozinho um registro
 * ambíguo (doc 03 §8.2).
 */
export async function matchGbifName(
  term: string,
  fetcher?: Fetcher,
): Promise<ExternalResult<GbifCandidate[]>> {
  const name = term.trim().replace(/\s+/g, ' ');
  if (name.length < 3) return { ok: false, reason: 'empty' };

  const url = `${gbifBaseUrl()}/v1/species/match?name=${encodeURIComponent(name)}&verbose=true`;
  const response = await getJson(url, fetcher);
  if (!response.ok) return response;

  const parsed = matchResponseSchema.safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: 'invalid_response' };

  const candidates: GbifCandidate[] = [];
  const best = toCandidate(parsed.data);
  if (best) candidates.push(best);
  for (const item of parsed.data.alternatives ?? []) {
    const alternative = matchSchema.safeParse(item);
    if (!alternative.success) continue;
    const candidate = toCandidate(alternative.data);
    if (candidate && !candidates.some((existing) => existing.usageKey === candidate.usageKey)) {
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, data: candidates.slice(0, 10) };
}

/** Correspondência exata e de nível espécie (as demais exigem mais atenção na escolha). */
export function isStrongGbifMatch(candidate: GbifCandidate): boolean {
  return (
    candidate.matchType === 'EXACT' &&
    candidate.rank === 'SPECIES' &&
    candidate.status === 'ACCEPTED'
  );
}

const usageSchema = z.object({
  key: z.number().int().positive(),
  scientificName: z.string().min(1),
  canonicalName: nullableText,
  rank: nullableText,
  taxonomicStatus: nullableText,
  kingdom: nullableText,
  phylum: nullableText,
  class: nullableText,
  order: nullableText,
  family: nullableText,
  genus: nullableText,
  acceptedKey: z.number().int().positive().optional(),
});

/**
 * Busca um registro pelo identificador. Usado para confirmar no servidor o
 * registro escolhido no painel (nada vindo do navegador é aceito como dado).
 */
export async function getGbifUsage(
  usageKey: number,
  fetcher?: Fetcher,
): Promise<ExternalResult<GbifCandidate>> {
  if (!Number.isInteger(usageKey) || usageKey <= 0) return { ok: false, reason: 'empty' };
  const response = await getJson(`${gbifBaseUrl()}/v1/species/${usageKey}`, fetcher);
  if (!response.ok) return response;
  const parsed = usageSchema.safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: 'invalid_response' };
  const raw = parsed.data;
  const candidate = toCandidate({
    usageKey: raw.key,
    scientificName: raw.scientificName,
    canonicalName: raw.canonicalName,
    rank: raw.rank,
    status: raw.taxonomicStatus,
    matchType: 'EXACT',
    kingdom: raw.kingdom,
    phylum: raw.phylum,
    class: raw.class,
    order: raw.order,
    family: raw.family,
    genus: raw.genus,
    acceptedUsageKey: raw.acceptedKey,
  });
  if (!candidate) return { ok: false, reason: 'invalid_response' };
  return { ok: true, data: { ...candidate, confidence: null } };
}
