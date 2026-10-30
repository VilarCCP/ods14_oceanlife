import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { fixtures } from './fixtures';
import { signIn } from './helpers';

/**
 * Importação assistida (doc 03 §8) contra o WoRMS e o GBIF simulados
 * (e2e/mock-apis.mjs, com respostas reais gravadas). Nada é publicado.
 */
test.describe('importação assistida', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  let context: BrowserContext;
  let page: Page;
  let importedUrl = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: 'http://localhost:3000', locale: 'pt-BR' });
    page = await context.newPage();
    page.on('dialog', (dialog) => void dialog.accept());
    await signIn(page, 'admin');
  });

  test.afterAll(async () => {
    await context.close();
  });

  async function search(term: string) {
    await page.getByLabel('Nome científico').first().fill(term);
    await page.getByRole('button', { name: 'Pesquisar' }).click();
  }

  test('nome inexistente orienta a conferir a grafia', async () => {
    await page.goto('/admin/especies/importar');
    await search('Inexistentia ficticia');
    await expect(
      page
        .getByRole('group', { name: /Resultados do WoRMS/ })
        .getByText(/Nenhum registro encontrado/),
    ).toBeVisible();
  });

  test('falha da API não impede o cadastro manual', async () => {
    await page.goto('/admin/especies/importar');
    await search('Falha simulada');
    await expect(
      page.getByText(/não respondeu a tempo ou está indisponível/).first(),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Cadastrar manualmente, sem importar' }).click();
    await expect(page).toHaveURL(/\/admin\/especies\/nova$/);
  });

  test('pesquisa, escolha explícita e revisão mostram a origem de cada campo', async () => {
    await page.goto('/admin/especies/importar');
    await search('Chelonia mydas');

    const worms = page.getByRole('group', { name: /Resultados do WoRMS/ });
    await expect(worms.getByText('nome aceito', { exact: false })).toBeVisible();
    // Sem escolha explícita, não há revisão.
    await expect(page.getByRole('button', { name: 'Revisar dados' })).toBeDisabled();

    await worms.getByRole('radio', { name: /Chelonia mydas/ }).check();
    await page
      .getByRole('group', { name: 'Resultados do GBIF' })
      .getByRole('radio', { name: /Chelonia mydas/ })
      .check();
    await page.getByRole('button', { name: 'Revisar dados' }).click();

    const review = page.getByRole('region', { name: '3. Revisar antes de salvar' });
    await expect(review.getByLabel('Nome científico')).toHaveValue('Chelonia mydas');
    await expect(review.getByLabel('Classificação')).toHaveValue(
      'Reino: Animalia; Filo: Chordata; Ordem: Testudines; Família: Cheloniidae',
    );
    await expect(review.getByText('Sugerido pelo WoRMS').first()).toBeVisible();
    // O WoRMS não tem nome popular em português para esta espécie: nada é inventado.
    await expect(review.getByLabel(/Nome popular/)).toHaveValue('');
    await expect(review.getByText(/não informou nome popular em português/)).toBeVisible();
    await expect(review.getByText(/Não serão preenchidos: descrição, habitat/)).toBeVisible();
    await expect(review).toContainText('137206');
    await expect(review).toContainText('2442225');
  });

  test('salva como rascunho com as fontes registradas e sem publicar', async () => {
    const review = page.getByRole('region', { name: '3. Revisar antes de salvar' });
    await review.getByRole('button', { name: 'Salvar como rascunho' }).click();
    await expect(review.getByText('Informe o nome popular.')).toBeVisible();

    await review.getByLabel(/Nome popular/).fill('Tartaruga importada de teste');
    await review.getByLabel(/Endereço \(slug\)/).fill('e2e-tartaruga-importada');
    await review.getByLabel('Grupo').selectOption('repteis');
    await review.getByRole('button', { name: 'Salvar como rascunho' }).click();

    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}\?importada=1$/);
    importedUrl = page.url().replace('?importada=1', '');
    await expect(page.getByText('Dados importados e fontes registradas.')).toBeVisible();
    await expect(page.locator('.admin-page-head .status-badge')).toHaveText('Rascunho');
    await expect(page.locator('#campo-wormsAphiaId')).toHaveValue('137206');
    await expect(page.locator('#campo-gbifUsageKey')).toHaveValue('2442225');
    await expect(page.locator('#campo-habitat')).toHaveValue('');
    await expect(page.locator('#campo-conservationCategory')).toHaveValue('');

    const sources = page.locator('#fontes');
    await expect(sources.getByText(/Importado de WoRMS/)).toBeVisible();
    await expect(sources.getByText(/Importado de GBIF/)).toBeVisible();
    await expect(sources).toContainText(
      'Campos: Nome científico, Classificação, Identificador WoRMS.',
    );

    const site = await page.request.get('/especies/e2e-tartaruga-importada');
    expect(site.status()).toBe(404);
  });

  test('importar de novo o mesmo registro é bloqueado como duplicidade', async () => {
    await page.goto('/admin/especies/importar');
    await search('Chelonia mydas');
    await page
      .getByRole('group', { name: /Resultados do WoRMS/ })
      .getByRole('radio', { name: /Chelonia mydas/ })
      .check();
    await page.getByRole('button', { name: 'Revisar dados' }).click();
    await expect(
      page.getByText(/já está cadastrada com o mesmo identificador externo/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar como rascunho' })).toBeDisabled();
  });

  test('importar para espécie existente não substitui valores sem confirmação', async () => {
    await page.goto('/admin/especies?status=draft');
    await page
      .getByRole('table')
      .getByRole('link', { name: fixtures.draft.commonName, exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}$/);
    const editUrl = page.url();
    await page.getByRole('link', { name: 'Importar dados taxonômicos (WoRMS/GBIF)' }).click();
    await expect(page.getByText(/Importando para/)).toBeVisible();

    await search('Carcharodon');
    await page
      .getByRole('group', { name: /Resultados do WoRMS/ })
      .getByRole('radio', { name: /^Carcharodon carcharias/ })
      .check();
    await page
      .getByRole('group', { name: 'Resultados do GBIF' })
      .getByRole('radio', { name: 'Não usar o GBIF' })
      .check();
    await page.getByRole('button', { name: 'Revisar dados' }).click();

    const table = page.getByRole('table');
    const scientificRow = table.getByRole('row', { name: /Nome científico/ });
    await expect(scientificRow).toContainText(fixtures.draft.scientificName);
    await expect(scientificRow).toContainText('Carcharodon carcharias');
    await expect(scientificRow.getByRole('checkbox')).not.toBeChecked();
    await expect(table.getByRole('row', { name: /Identificador WoRMS/ })).toContainText(
      'Campo vazio: será preenchido',
    );

    await page.getByRole('button', { name: 'Aplicar à espécie' }).click();
    await expect(page).toHaveURL(new RegExp(`${editUrl.split('/').pop()}\\?importada=1$`));
    // O nome científico já preenchido foi mantido; o campo vazio foi preenchido.
    await expect(page.locator('#campo-scientificName')).toHaveValue(fixtures.draft.scientificName);
    await expect(page.locator('#campo-wormsAphiaId')).toHaveValue('105838');
  });

  test('a espécie importada pode ser excluída ao final', async () => {
    await page.goto(importedUrl);
    await page
      .getByLabel(/Para confirmar, digite o nome popular/)
      .fill('Tartaruga importada de teste');
    await page.getByRole('button', { name: 'Excluir espécie definitivamente' }).click();
    await expect(page).toHaveURL(/\/admin\/especies\?excluida=1$/);
  });
});
