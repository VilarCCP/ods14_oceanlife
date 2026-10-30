import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cleanExternalText, getJson, type Fetcher } from '@/services/external/http';
import { getGbifUsage, isStrongGbifMatch, matchGbifName } from '@/services/gbif.service';
import {
  buildSources,
  buildSuggestions,
  formatClassification,
  todayInBrazil,
} from '@/services/import.service';
import {
  getWormsPortugueseNames,
  getWormsRecord,
  isAcceptedRecord,
  searchWormsByName,
} from '@/services/worms.service';

/** Respostas reais gravadas em tests/fixtures/apis (ver README da pasta). */
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/apis/${name}`, import.meta.url)), 'utf8');
}

function respond(body: string | null, status = 200): Fetcher {
  return async () => new Response(body, { status });
}

function capture(body: string, status = 200) {
  const urls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    urls.push(url);
    return new Response(body, { status });
  };
  return { urls, fetcher };
}

describe('getJson', () => {
  it('trata 204 e corpo vazio como "nenhum resultado"', async () => {
    expect(await getJson('x', respond(null, 204))).toEqual({ ok: false, reason: 'empty' });
    expect(await getJson('x', respond('   '))).toEqual({ ok: false, reason: 'empty' });
  });

  it('identifica limite de requisições, erro do servidor e falha de rede', async () => {
    expect(await getJson('x', respond('{}', 429))).toEqual({ ok: false, reason: 'rate_limited' });
    expect(await getJson('x', respond('{}', 503))).toEqual({ ok: false, reason: 'unavailable' });
    const offline: Fetcher = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await getJson('x', offline)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('trata tempo esgotado como indisponibilidade', async () => {
    const slow: Fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('timeout', 'TimeoutError')),
        );
      });
    expect(await getJson('x', slow, 20)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('recusa JSON inválido', async () => {
    expect(await getJson('x', respond('<html>erro</html>'))).toEqual({
      ok: false,
      reason: 'invalid_response',
    });
  });
});

describe('cleanExternalText', () => {
  it('remove caracteres de controle, espaços extras e limita o tamanho', () => {
    expect(cleanExternalText('  Chelonia\u0000\n  mydas ')).toBe('Chelonia mydas');
    expect(cleanExternalText('a'.repeat(50), 10)).toHaveLength(10);
    expect(cleanExternalText(42)).toBeNull();
    expect(cleanExternalText('   ')).toBeNull();
  });
});

describe('WoRMS', () => {
  it('pesquisa por nome, codifica o termo e devolve o registro aceito', async () => {
    const { urls, fetcher } = capture(fixture('worms-chelonia-mydas.json'));
    const result = await searchWormsByName('  Chelonia   mydas ', fetcher);
    expect(urls[0]).toBe(
      'https://www.marinespecies.org/rest/AphiaRecordsByName/Chelonia%20mydas?like=true&marine_only=true&offset=1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [record] = result.data;
    expect(record).toMatchObject({
      aphiaId: 137206,
      scientificName: 'Chelonia mydas',
      authority: '(Linnaeus, 1758)',
      status: 'accepted',
      url: 'https://www.marinespecies.org/aphia.php?p=taxdetails&id=137206',
      classification: { kingdom: 'Animalia', phylum: 'Chordata', class: null, order: 'Testudines' },
    });
    expect(record && isAcceptedRecord(record)).toBe(true);
  });

  it('nomes ambíguos voltam como lista, com o exato e os aceitos primeiro', async () => {
    const result = await searchWormsByName(
      'Carcharodon',
      respond(fixture('worms-carcharodon-parcial.json')),
    );
    expect(result.ok && result.data.map((r) => r.scientificName)).toEqual([
      'Carcharodon',
      'Carcharodon carcharias',
      'Carcharodon albimors',
    ]);
  });

  it('marca sinônimos com o nome aceito', async () => {
    const result = await searchWormsByName(
      'Chelonia agassizii',
      respond(fixture('worms-sinonimo.json')),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isAcceptedRecord(result.data[0]!)).toBe(false);
    expect(result.data[0]?.acceptedName).toBe('Chelonia mydas');
  });

  it('nome inexistente (HTTP 204) e termo curto não geram erro', async () => {
    expect(await searchWormsByName('Inexistentia ficticia', respond(null, 204))).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(await searchWormsByName('ab', respond('[]'))).toEqual({ ok: false, reason: 'empty' });
  });

  it('ignora registros fora do formato sem interromper a pesquisa', async () => {
    const body = JSON.stringify([{ lixo: true }, ...JSON.parse(fixture('worms-sinonimo.json'))]);
    const result = await searchWormsByName('Chelonia', respond(body));
    expect(result.ok && result.data).toHaveLength(1);
  });

  it('busca o registro pelo AphiaID', async () => {
    const record = JSON.stringify(JSON.parse(fixture('worms-chelonia-mydas.json'))[0]);
    const result = await getWormsRecord(137206, respond(record));
    expect(result.ok && result.data.aphiaId).toBe(137206);
    expect(await getWormsRecord(-1, respond(record))).toEqual({ ok: false, reason: 'empty' });
  });

  it('só aproveita nomes populares em português', async () => {
    const real = await getWormsPortugueseNames(
      137206,
      respond(fixture('worms-vernaculares-137206.json')),
    );
    expect(real).toEqual({ ok: true, data: [] });

    // Exemplo fictício, só para testar o filtro de idioma.
    const withPortuguese = JSON.stringify([
      { vernacular: 'nome em inglês', language_code: 'eng' },
      { vernacular: 'Nome fictício em português', language_code: 'por' },
    ]);
    expect(await getWormsPortugueseNames(1, respond(withPortuguese))).toEqual({
      ok: true,
      data: ['Nome fictício em português'],
    });
    expect(await getWormsPortugueseNames(1, respond(null, 204))).toEqual({ ok: true, data: [] });
  });
});

describe('GBIF', () => {
  it('correspondência exata de espécie', async () => {
    const { urls, fetcher } = capture(fixture('gbif-match-chelonia-mydas.json'));
    const result = await matchGbifName('Chelonia mydas', fetcher);
    expect(urls[0]).toBe(
      'https://api.gbif.org/v1/species/match?name=Chelonia%20mydas&verbose=true',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      usageKey: 2442225,
      canonicalName: 'Chelonia mydas',
      matchType: 'EXACT',
      rank: 'SPECIES',
      url: 'https://www.gbif.org/species/2442225',
    });
    expect(isStrongGbifMatch(result.data[0]!)).toBe(true);
  });

  it('correspondência de nível superior vem com alternativas para escolha', async () => {
    const result = await matchGbifName(
      'Carcharodon',
      respond(fixture('gbif-match-carcharodon.json')),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.matchType).toBe('HIGHERRANK');
    expect(isStrongGbifMatch(result.data[0]!)).toBe(false);
    expect(result.data.map((c) => c.usageKey)).toEqual([2420693, 11699867, 12043086]);
  });

  it('sem correspondência (matchType NONE) é "nenhum resultado"', async () => {
    expect(
      await matchGbifName('Inexistentia ficticia', respond(fixture('gbif-match-inexistente.json'))),
    ).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('confirma um registro pelo usageKey', async () => {
    const usage = JSON.stringify({
      key: 2442225,
      scientificName: 'Chelonia mydas (Linnaeus, 1758)',
      canonicalName: 'Chelonia mydas',
      rank: 'SPECIES',
      taxonomicStatus: 'ACCEPTED',
      kingdom: 'Animalia',
    });
    const result = await getGbifUsage(2442225, respond(usage));
    expect(result.ok && result.data).toMatchObject({ usageKey: 2442225, status: 'ACCEPTED' });
  });
});

describe('sugestões e fontes da importação', () => {
  const record = async () => {
    const result = await getWormsRecord(
      137206,
      respond(JSON.stringify(JSON.parse(fixture('worms-chelonia-mydas.json'))[0])),
    );
    if (!result.ok) throw new Error('fixture');
    return result.data;
  };

  it('formata só os níveis existentes da classificação', () => {
    expect(
      formatClassification({
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: null,
        order: 'Testudines',
        family: 'Cheloniidae',
        genus: 'Chelonia',
      }),
    ).toBe('Reino: Animalia; Filo: Chordata; Ordem: Testudines; Família: Cheloniidae');
    expect(
      formatClassification({
        kingdom: null,
        phylum: null,
        class: null,
        order: null,
        family: null,
        genus: null,
      }),
    ).toBeNull();
  });

  it('sugere só o que a fonte fornece: nada de dieta, habitat ou conservação', async () => {
    const suggestions = buildSuggestions({
      worms: await record(),
      wormsPortugueseNames: [],
      gbif: null,
    });
    expect(suggestions.map((s) => s.field)).toEqual([
      'scientificName',
      'taxonomicGroup',
      'wormsAphiaId',
    ]);
    expect(suggestions.every((s) => s.source === 'worms')).toBe(true);
  });

  it('usa nome popular em português só quando existe', async () => {
    const suggestions = buildSuggestions({
      worms: await record(),
      wormsPortugueseNames: ['Nome fictício em português'],
      gbif: null,
    });
    expect(suggestions[0]).toEqual({
      field: 'commonName',
      value: 'Nome fictício em português',
      source: 'worms',
    });
  });

  it('o GBIF completa o identificador e só substitui o nome quando não há WoRMS', async () => {
    const gbif = await matchGbifName(
      'Chelonia mydas',
      respond(fixture('gbif-match-chelonia-mydas.json')),
    );
    if (!gbif.ok) throw new Error('fixture');
    const both = buildSuggestions({
      worms: await record(),
      wormsPortugueseNames: [],
      gbif: gbif.data[0]!,
    });
    expect(both.find((s) => s.field === 'scientificName')?.source).toBe('worms');
    expect(both.find((s) => s.field === 'gbifUsageKey')).toEqual({
      field: 'gbifUsageKey',
      value: '2442225',
      source: 'gbif',
    });

    const onlyGbif = buildSuggestions({
      worms: null,
      wormsPortugueseNames: [],
      gbif: gbif.data[0]!,
    });
    expect(onlyGbif.find((s) => s.field === 'scientificName')).toEqual({
      field: 'scientificName',
      value: 'Chelonia mydas',
      source: 'gbif',
    });
  });

  it('registra fonte com URL, identificador, data e só os campos mantidos como sugeridos', async () => {
    const worms = await record();
    const suggestions = buildSuggestions({ worms, wormsPortugueseNames: [], gbif: null });
    const [source] = buildSources(
      { worms, wormsPortugueseNames: [], gbif: null },
      suggestions,
      {
        scientificName: 'Chelonia mydas',
        taxonomicGroup: 'Classificação editada pela equipe',
        wormsAphiaId: '137206',
      },
      '2026-10-30',
    );
    expect(source).toMatchObject({
      provider: 'worms',
      sourceUrl: 'https://www.marinespecies.org/aphia.php?p=taxdetails&id=137206',
      sourceRecordId: '137206',
      accessedAt: '2026-10-30',
      fieldsImported: ['scientific_name', 'worms_aphia_id'],
      notes: null,
    });
    expect(source?.licenseOrAttribution).toContain('World Register of Marine Species');
  });

  it('registra na fonte quando o registro escolhido não é o nome aceito', async () => {
    const result = await searchWormsByName(
      'Chelonia agassizii',
      respond(fixture('worms-sinonimo.json')),
    );
    if (!result.ok) throw new Error('fixture');
    const worms = result.data[0]!;
    const [source] = buildSources(
      { worms, wormsPortugueseNames: [], gbif: null },
      buildSuggestions({ worms, wormsPortugueseNames: [], gbif: null }),
      {},
      '2026-10-30',
    );
    expect(source?.notes).toContain('Nome aceito: Chelonia mydas');
    expect(source?.fieldsImported).toEqual([]);
  });

  it('data de consulta no horário de Brasília', () => {
    expect(todayInBrazil(new Date('2026-10-31T02:00:00Z'))).toBe('2026-10-30');
  });
});
