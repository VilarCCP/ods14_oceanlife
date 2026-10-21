import { describe, expect, it } from 'vitest';

import { conservationLabel, formatDate, providerLabel, speciesCount } from '@/lib/format';
import { catalogHref, isCurrentPath } from '@/lib/navigation';
import { publicNavigation } from '@/lib/site';

describe('conservationLabel', () => {
  it('mostra o nome da categoria e o código', () => {
    expect(conservationLabel('EN')).toBe('Em perigo (EN)');
    expect(conservationLabel('DD')).toBe('Dados insuficientes (DD)');
  });

  it('mantém códigos desconhecidos sem inventar nome', () => {
    expect(conservationLabel('ZZ')).toBe('ZZ');
  });
});

describe('formatDate', () => {
  it('formata data no padrão brasileiro sem deslocar o dia por fuso horário', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate('2026-10-21T00:00:00Z')).toBe('21/10/2026');
  });

  it('devolve o valor original quando não é uma data', () => {
    expect(formatDate('ontem')).toBe('ontem');
  });
});

describe('providerLabel e speciesCount', () => {
  it('nomeia as fontes conhecidas', () => {
    expect(providerLabel('worms')).toContain('WoRMS');
    expect(providerLabel('manual')).toBe('Referência');
  });

  it('usa singular e plural', () => {
    expect(speciesCount(1)).toBe('1 espécie');
    expect(speciesCount(0)).toBe('0 espécies');
    expect(speciesCount(12)).toBe('12 espécies');
  });
});

describe('isCurrentPath', () => {
  it('marca o início só na página inicial', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath('/especies', '/')).toBe(false);
  });

  it('marca a seção nas subpáginas', () => {
    expect(isCurrentPath('/especies/tartaruga-verde', '/especies')).toBe(true);
    expect(isCurrentPath('/especiesx', '/especies')).toBe(false);
  });
});

describe('catalogHref', () => {
  it('omite parâmetros vazios e a primeira página', () => {
    expect(catalogHref({})).toBe('/especies');
    expect(catalogHref({ q: '', pagina: 1 })).toBe('/especies');
  });

  it('preserva pesquisa, grupo e página e codifica caracteres especiais', () => {
    expect(catalogHref({ q: 'tubarão & cia', grupo: 'peixes', pagina: 2 })).toBe(
      '/especies?q=tubar%C3%A3o+%26+cia&grupo=peixes&pagina=2',
    );
  });
});

describe('navegação pública', () => {
  it('não tem links para o painel administrativo', () => {
    expect(publicNavigation.some((item) => item.href.startsWith('/admin'))).toBe(false);
  });
});
