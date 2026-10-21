import { describe, expect, it } from 'vitest';

import { pageTitle, siteConfig } from '@/lib/site';

describe('siteConfig', () => {
  it('usa o português do Brasil como idioma', () => {
    expect(siteConfig.locale).toBe('pt-BR');
  });
});

describe('pageTitle', () => {
  it('retorna apenas o nome do site quando não há página', () => {
    expect(pageTitle()).toBe('OceanLife');
  });

  it('ignora títulos vazios ou só com espaços', () => {
    expect(pageTitle('   ')).toBe('OceanLife');
  });

  it('combina o título da página com o nome do site', () => {
    expect(pageTitle('  Espécies ')).toBe('Espécies | OceanLife');
  });
});
