import { test } from '@playwright/test';

import { fixtures } from './fixtures';

/**
 * Gera capturas de tela das páginas para revisão visual (pasta e2e-capturas/).
 * Não faz asserções: os comportamentos são verificados nos outros arquivos.
 */
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'catalogo', path: '/especies' },
  { name: 'pesquisa-sem-resultado', path: '/especies?q=zzzz' },
  { name: 'especie', path: `/especies/${fixtures.featured.slug}` },
  { name: 'conservacao', path: '/conservacao' },
  { name: 'sobre', path: '/sobre' },
  { name: 'nao-encontrada', path: `/especies/${fixtures.draft.slug}` },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1366, height: 900 },
  { label: 'celular', width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  for (const target of PAGES) {
    test(`captura ${target.name} (${viewport.label})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(target.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `e2e-capturas/${viewport.label}-${target.name}.png`,
        fullPage: true,
      });
    });
  }
}
