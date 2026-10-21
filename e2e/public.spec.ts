import { expect, test } from '@playwright/test';

import { fixtures } from './fixtures';

test.describe('página inicial', () => {
  test('apresenta o projeto, a pesquisa e as espécies em destaque', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Mergulhe e conheça quem vive no oceano',
    );
    await expect(page.getByRole('searchbox', { name: 'Pesquisar espécies' })).toBeVisible();

    const featured = page.getByRole('list', { name: 'Espécies em destaque' });
    await expect(featured.getByRole('link', { name: fixtures.featured.commonName })).toBeVisible();
    // Rascunhos nunca aparecem.
    await expect(page.getByText(fixtures.draft.commonName)).toHaveCount(0);
  });

  test('o primeiro Tab leva ao link "Pular para o conteúdo"', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test('a navegação pública não tem link para o painel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  });

  test('pesquisar a partir da página inicial leva ao catálogo com o termo na URL', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Pesquisar espécies' }).fill('   peixe-espelho  ');
    await page.getByRole('button', { name: 'Pesquisar' }).first().click();

    await expect(page).toHaveURL(/\/especies\?q=/);
    await expect(page.getByRole('searchbox', { name: 'Pesquisar espécies' })).toHaveValue(
      'peixe-espelho',
    );
    await expect(page.getByRole('link', { name: fixtures.featured.commonName })).toBeVisible();
  });
});

test.describe('catálogo', () => {
  test('mostra apenas espécies publicadas e marca o item atual da navegação', async ({ page }) => {
    await page.goto('/especies');
    const results = page.getByRole('list', { name: 'Resultados' });
    await expect(results.getByRole('link', { name: fixtures.featured.commonName })).toBeVisible();
    await expect(results.getByRole('link', { name: fixtures.accented.commonName })).toBeVisible();
    await expect(page.getByText(fixtures.draft.commonName)).toHaveCount(0);

    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Espécies' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('a pesquisa ignora acentos e maiúsculas e funciona pelo nome científico', async ({
    page,
  }) => {
    await page.goto('/especies?q=OMEGA');
    await expect(page.getByRole('link', { name: fixtures.accented.commonName })).toBeVisible();

    await page.goto(`/especies?q=${encodeURIComponent('fictitia testudo')}`);
    await expect(page.getByRole('link', { name: fixtures.accented.commonName })).toBeVisible();
    await expect(page.getByRole('link', { name: fixtures.featured.commonName })).toHaveCount(0);
  });

  test('sem resultados, explica e permite limpar a pesquisa', async ({ page }) => {
    await page.goto('/especies?q=zzzz-nada');
    await expect(page.getByText('Nenhuma espécie encontrada para “zzzz-nada”.')).toBeVisible();
    await page.getByRole('link', { name: 'Limpar pesquisa e filtros' }).click();
    await expect(page).toHaveURL(/\/especies$/);
  });

  test('caracteres especiais não quebram a pesquisa', async ({ page }) => {
    const response = await page.goto(`/especies?q=${encodeURIComponent('%_\'"()<script>')}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/Nenhuma espécie encontrada/)).toBeVisible();
  });

  test('o filtro por grupo mostra só o grupo escolhido e pode ser removido', async ({ page }) => {
    await page.goto('/especies');
    const filter = page.getByRole('navigation', { name: 'Filtrar por grupo' });
    await filter.getByRole('link', { name: 'Répteis' }).click();

    await expect(page).toHaveURL(/grupo=repteis/);
    await expect(filter.getByRole('link', { name: 'Répteis' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: fixtures.accented.commonName })).toBeVisible();
    await expect(page.getByRole('link', { name: fixtures.featured.commonName })).toHaveCount(0);

    await filter.getByRole('link', { name: 'Todos os grupos' }).click();
    await expect(page.getByRole('link', { name: fixtures.featured.commonName })).toBeVisible();
  });

  test('página além do fim mostra aviso em vez de erro', async ({ page }) => {
    await page.goto('/especies?pagina=999');
    await expect(page.getByText('Esta página não existe.')).toBeVisible();
  });
});

test.describe('página da espécie', () => {
  test('mostra nomes, capa, seções com dados e fontes', async ({ page }) => {
    await page.goto(`/especies/${fixtures.featured.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixtures.featured.commonName);
    await expect(page.getByText(fixtures.featured.scientificName, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Imagem fictícia de teste: capa' }).first(),
    ).toBeVisible();
    await expect(page.getByText('Crédito: Equipe de testes').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Habitat' })).toBeVisible();
    await expect(page.getByText(fixtures.featured.habitat)).toBeVisible();
    await expect(page.getByText(fixtures.featured.sourceTitle)).toBeVisible();
  });

  test('não exibe títulos de seções sem dados nem inventa conservação', async ({ page }) => {
    await page.goto(`/especies/${fixtures.featured.slug}`);
    for (const title of ['Comportamento', 'Alimentação', 'Curiosidades', 'Expectativa de vida']) {
      await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
    }
    const conservation = page.getByRole('region', { name: 'Estado de conservação' });
    await expect(conservation.getByText('Informação não disponível no momento.')).toBeVisible();
  });

  test('a galeria respeita a ordem cadastrada', async ({ page }) => {
    await page.goto(`/especies/${fixtures.featured.slug}`);
    const gallery = page.getByRole('region', { name: 'Galeria' });
    const alts = await gallery
      .getByRole('img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('alt')));
    expect(alts).toEqual(['Imagem fictícia de teste: capa', 'Imagem fictícia de teste: segunda']);
  });

  test('sugere espécies do mesmo grupo e termina com conservação', async ({ page }) => {
    await page.goto(`/especies/${fixtures.featured.slug}`);
    const related = page.getByRole('list', { name: 'Espécies relacionadas' });
    await expect(related.getByRole('link', { name: fixtures.related.commonName })).toBeVisible();
    await expect(related.getByRole('link', { name: fixtures.accented.commonName })).toHaveCount(0);

    const seabed = page.getByRole('complementary', {
      name: 'Cuidar do oceano também é com a gente',
    });
    await expect(seabed.getByRole('link', { name: 'Ver temas de conservação' })).toHaveAttribute(
      'href',
      '/conservacao',
    );
  });

  test('rascunho responde 404 sem revelar que existe', async ({ page }) => {
    const response = await page.goto(`/especies/${fixtures.draft.slug}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Não encontramos esta página');
    await expect(page.getByText(fixtures.draft.commonName)).toHaveCount(0);
  });

  test('slug inválido ou inexistente responde 404', async ({ page }) => {
    expect((await page.goto('/especies/Slug%20Inválido'))?.status()).toBe(404);
    expect((await page.goto('/especies/nao-existe-mesmo'))?.status()).toBe(404);
  });

  test('título da página usa o nome da espécie', async ({ page }) => {
    await page.goto(`/especies/${fixtures.featured.slug}`);
    await expect(page).toHaveTitle(`${fixtures.featured.commonName} | OceanLife`);
  });
});

test.describe('páginas institucionais e indexação', () => {
  test('conservação mostra a estrutura com conteúdo em preparação', async ({ page }) => {
    await page.goto('/conservacao');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conservação marinha');
    await expect(page.getByText('Conteúdo em preparação', { exact: true })).toBeVisible();
  });

  test('sobre explica o projeto e a ODS 14', async ({ page }) => {
    await page.goto('/sobre');
    await expect(page.getByRole('heading', { name: /ODS 14/ })).toBeVisible();
  });

  test('robots.txt bloqueia o painel', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/admin/);
  });

  test('sitemap lista espécies publicadas e não lista rascunhos', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`/especies/${fixtures.featured.slug}`);
    expect(sitemap).not.toContain(fixtures.draft.slug);
  });

  test('com "reduzir movimento", o ambiente fica parado', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const animation = await page
      .locator('.ocean-snow')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe('none');
    await context.close();
  });
});
