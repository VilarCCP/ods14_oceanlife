/**
 * Testes de contrato contra as APIs REAIS do WoRMS e do GBIF. Confirmam que o
 * formato das respostas continua o esperado. Rodam no CI num job separado e
 * não bloqueante: uma instabilidade externa não deve impedir o desenvolvimento.
 */
import { describe, expect, it } from 'vitest';

import { getGbifUsage, matchGbifName } from '@/services/gbif.service';
import { getWormsRecord, isAcceptedRecord, searchWormsByName } from '@/services/worms.service';

const enabled = process.env.RUN_CONTRACT_TESTS === '1';

describe.skipIf(!enabled)('contrato das APIs externas', () => {
  it('WoRMS: pesquisa por nome devolve o registro aceito de Chelonia mydas', async () => {
    const result = await searchWormsByName('Chelonia mydas');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.data.find((item) => item.aphiaId === 137206);
    expect(record).toBeDefined();
    expect(record && isAcceptedRecord(record)).toBe(true);
  });

  it('WoRMS: registro por AphiaID tem classificação e URL', async () => {
    const result = await getWormsRecord(137206);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.classification.kingdom).toBe('Animalia');
    expect(result.data.url).toMatch(/^https:\/\/www\.marinespecies\.org\//);
  });

  it('WoRMS: nome inexistente é tratado como "nenhum resultado"', async () => {
    expect(await searchWormsByName('Inexistentia ficticia oceanlife')).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('GBIF: correspondência exata e consulta por usageKey', async () => {
    const match = await matchGbifName('Chelonia mydas');
    expect(match.ok).toBe(true);
    if (!match.ok) return;
    expect(match.data[0]).toMatchObject({ matchType: 'EXACT', rank: 'SPECIES' });
    const usage = await getGbifUsage(match.data[0]!.usageKey);
    expect(usage.ok).toBe(true);
  });
});
