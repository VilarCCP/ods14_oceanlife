import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { fixtures } from './fixtures';
import { credentials, signIn } from './helpers';

/**
 * Verificações transversais da fase 08: acessibilidade automática (axe, regras
 * WCAG 2.1 A e AA), navegação por teclado, cabeçalhos de segurança e sessão
 * expirada no meio da edição.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    regra: violation.id,
    impacto: violation.impact,
    descricao: violation.help,
    elementos: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
  }));
  expect(summary, `Violações de acessibilidade em ${page.url()}`).toEqual([]);
}

const PUBLIC_PAGES = [
  '/',
  '/especies',
  `/especies?grupo=${fixtures.featured.group}`,
  '/especies?q=termo-que-nao-existe',
  `/especies/${fixtures.featured.slug}`,
  '/conservacao',
  '/sobre',
  '/pagina-que-nao-existe',
];

test.describe('acessibilidade automática (axe)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`site: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });
  }

  test('painel: login, resumo, lista, formulários e importação', async ({ page }) => {
    await page.goto('/admin/login');
    await expectNoAxeViolations(page);

    await signIn(page, 'admin');
    for (const path of ['/admin', '/admin/especies', '/admin/especies/nova']) {
      await page.goto(path);
      await expectNoAxeViolations(page);
    }

    await page.goto(`/admin/especies?q=${encodeURIComponent(fixtures.draft.scientificName)}`);
    await page.getByRole('table').getByRole('link', { name: fixtures.draft.commonName }).click();
    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}$/);
    await expectNoAxeViolations(page);

    await page.goto('/admin/especies/importar');
    await expectNoAxeViolations(page);
  });

  test('painel: erros de validação continuam acessíveis', async ({ page }) => {
    await signIn(page, 'admin', '/admin/especies/nova');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Corrija' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('navegação por teclado', () => {
  test('"Pular para o conteúdo" leva o foco ao conteúdo principal', async ({ page }) => {
    await page.goto('/especies');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
    // O próximo Tab sai do cabeçalho e entra no conteúdo principal.
    await page.keyboard.press('Tab');
    const insideMain = await page.evaluate(
      () => document.activeElement?.closest('main') !== null,
    );
    expect(insideMain).toBe(true);
  });

  test('a pesquisa do catálogo funciona só com o teclado', async ({ page }) => {
    await page.goto('/especies');
    const search = page.getByRole('searchbox', { name: 'Pesquisar espécies' });
    await search.focus();
    await page.keyboard.type('fictitia umbra');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/especies\?q=fictitia\+umbra/);
    await expect(
      page.getByRole('list', { name: 'Resultados' }).getByRole('link', {
        name: fixtures.related.commonName,
      }),
    ).toBeVisible();
  });

  test('todo elemento focável do site tem indicador de foco visível', async ({ page }) => {
    await page.goto('/');
    const withoutIndicator: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
        const hasShadow = style.boxShadow !== 'none';
        return {
          label: `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`,
          visible: hasOutline || hasShadow,
        };
      });
      if (!info) break;
      if (!info.visible) withoutIndicator.push(info.label);
    }
    expect(withoutIndicator, 'Elementos sem indicador de foco').toEqual([]);
  });

  test('o login do painel funciona só com o teclado', async ({ page }) => {
    const user = credentials().admin;
    await page.goto('/admin/login');
    await page.getByLabel('E-mail').focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Senha')).toBeFocused();
    await page.keyboard.type(user.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe('cabeçalhos de segurança', () => {
  for (const path of ['/', `/especies/${fixtures.featured.slug}`, '/admin/login']) {
    test(`presentes em ${path}`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['x-powered-by']).toBeUndefined();
      if (path.startsWith('/admin')) {
        expect(headers['x-robots-tag']).toContain('noindex');
      } else {
        expect(headers['x-robots-tag']).toBeUndefined();
      }
    });
  }

  test('robots.txt bloqueia o painel e o sitemap só lista o site público', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`/especies/${fixtures.featured.slug}`);
    expect(sitemap).not.toContain('/admin');
    expect(sitemap).not.toContain(fixtures.draft.slug);
  });
});

test.describe('sessão expirada durante a edição', () => {
  test('salvar mostra o aviso, oferece entrar de novo e não perde o texto', async ({
    page,
    context,
  }) => {
    await signIn(page, 'admin');
    await page.goto(`/admin/especies?q=${encodeURIComponent(fixtures.draft.scientificName)}`);
    await page.getByRole('table').getByRole('link', { name: fixtures.draft.commonName }).click();
    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}$/);

    const habitat = page.locator('#campo-habitat');
    await habitat.fill('Texto fictício digitado antes de a sessão expirar');

    // Simula a expiração: o navegador perde os cookies de sessão.
    await context.clearCookies();
    await page.getByRole('button', { name: /^Salvar/ }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: 'Entrar novamente' })).toHaveAttribute(
      'href',
      /\/admin\/login\?next=%2Fadmin%2Fespecies%2F/,
    );
    await expect(habitat).toHaveValue('Texto fictício digitado antes de a sessão expirar');
    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}$/);
  });
});

test.describe('larguras de tela (celular, tablet e desktop)', () => {
  const WIDTHS = [
    { name: 'celular pequeno', width: 360, height: 740 },
    { name: 'tablet retrato', width: 768, height: 1024 },
    { name: 'tablet paisagem', width: 1024, height: 768 },
    { name: 'desktop largo', width: 1440, height: 900 },
  ];
  const PAGES = ['/', '/especies', `/especies/${fixtures.featured.slug}`, '/conservacao', '/sobre'];

  for (const size of WIDTHS) {
    test(`${size.name} (${size.width}px): sem rolagem horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const overflowing: string[] = [];
      for (const path of PAGES) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) overflowing.push(`${path} (+${overflow}px)`);
      }
      expect(overflowing, 'Páginas com rolagem horizontal').toEqual([]);
    });
  }
});
