import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { fixtures, TINY_PNG } from './fixtures';
import { credentials, signIn } from './helpers';

/**
 * Painel administrativo de ponta a ponta (doc 03 §15). Os testes do fluxo
 * principal rodam em sequência, com a mesma sessão de administrador, sobre uma
 * espécie fictícia criada aqui (slug com prefixo e2e-, removida no teardown).
 */

const NEW_SPECIES = {
  slug: 'e2e-painel-especie',
  commonName: 'Espécie do painel de teste',
  scientificName: 'Fictitia lucida', // repete de propósito o nome de outra espécie
  summary: 'Resumo fictício escrito pelo teste do painel.',
};

test.describe('acesso ao painel', () => {
  test('sem login, as páginas do painel levam à tela de login', async ({ page }) => {
    const response = await page.goto('/admin/especies');
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fespecies/);
    await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible();
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
  });

  test('não existe opção de cadastro público', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('link', { name: /cadastr|criar conta/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /cadastr|criar conta/i })).toHaveCount(0);
  });

  test('senha errada mostra mensagem genérica e mantém o e-mail', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('E-mail').fill(credentials().admin.email);
    await page.getByLabel('Senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail' })).toHaveText(
      'E-mail ou senha incorretos.',
    );
    await expect(page.getByLabel('E-mail')).toHaveValue(credentials().admin.email);
  });

  test('e-mail inexistente recebe a mesma mensagem (não revela cadastro)', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('E-mail').fill('ninguem-cadastrado@teste.invalid');
    await page.getByLabel('Senha').fill('qualquer-senha');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail' })).toHaveText(
      'E-mail ou senha incorretos.',
    );
  });

  test('usuário autenticado sem permissão é bloqueado', async ({ page }) => {
    await signIn(page, 'comum');
    await expect(page).toHaveURL(/\/admin\/sem-permissao/);
    await expect(
      page.getByRole('heading', { name: 'Você não tem permissão para usar o painel' }),
    ).toBeVisible();

    for (const path of ['/admin', '/admin/especies', '/admin/especies/nova']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/sem-permissao/);
    }
    await expect(page.getByText(fixtures.draft.commonName)).toHaveCount(0);
  });

  test('o login volta para a página pedida', async ({ page }) => {
    await signIn(page, 'admin', '/admin/especies?status=draft');
    await expect(page).toHaveURL(/\/admin\/especies\?status=draft$/);
  });

  test('o login não redireciona para fora do painel', async ({ page }) => {
    await signIn(page, 'admin', '//exemplo.invalid/admin');
    await expect(page).toHaveURL(/localhost:3000\/admin$/);
  });
});

test.describe('fluxo do administrador', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  let editUrl = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: 'http://localhost:3000', locale: 'pt-BR' });
    page = await context.newPage();
    // Aceita o aviso de "alterações não salvas" ao recarregar ou navegar.
    page.on('dialog', (dialog) => void dialog.accept());
    await signIn(page, 'admin');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('o resumo mostra as contagens e a lista mostra rascunhos', async () => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
    await expect(page.getByText('Publicadas', { exact: true })).toBeVisible();
    await expect(page.getByText('Rascunhos', { exact: true })).toBeVisible();

    await page.goto('/admin/especies?status=draft');
    const table = page.getByRole('table');
    await expect(
      table.getByRole('link', { name: fixtures.draft.commonName, exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole('link', { name: fixtures.featured.commonName, exact: true }),
    ).toHaveCount(0);
  });

  test('a pesquisa da lista funciona por nome científico, sem acento', async () => {
    await page.goto(`/admin/especies?q=${encodeURIComponent('FICTITIA OCCULTA')}`);
    await expect(
      page.getByRole('table').getByRole('link', { name: fixtures.draft.commonName, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('1 espécie', { exact: true })).toBeVisible();
  });

  test('o formulário valida os campos obrigatórios antes de enviar', async () => {
    await page.goto('/admin/especies/nova');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    const summary = page.getByRole('alert').filter({ hasText: 'Corrija' });
    await expect(summary).toContainText('Nome popular: Informe o nome popular.');
    await expect(summary).toContainText('Nome científico: Informe o nome científico.');
    await expect(page.locator('#campo-commonName')).toHaveAttribute('aria-invalid', 'true');
  });

  test('o slug é gerado do nome e um slug repetido é recusado no campo', async () => {
    await page.goto('/admin/especies/nova');
    await page.locator('#campo-commonName').fill('Peixe Ácido de Teste');
    await expect(page.locator('#campo-slug')).toHaveValue('peixe-acido-de-teste');

    await page.locator('#campo-slug').fill(fixtures.featured.slug);
    await page.locator('#campo-scientificName').fill('Fictitia repetita');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.locator('#campo-slug-erro')).toHaveText(
      'Este endereço (slug) já está em uso por outra espécie.',
    );
    // Nada do que foi digitado se perde.
    await expect(page.locator('#campo-commonName')).toHaveValue('Peixe Ácido de Teste');
  });

  test('nome científico repetido pede confirmação antes de salvar o rascunho', async () => {
    await page.goto('/admin/especies/nova');
    await page.locator('#campo-commonName').fill(NEW_SPECIES.commonName);
    await page.locator('#campo-slug').fill(NEW_SPECIES.slug);
    await page.locator('#campo-scientificName').fill(NEW_SPECIES.scientificName);
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();

    const warning = page.locator('#aviso-duplicidade');
    await expect(warning).toContainText(
      /Já existem? (uma espécie|espécies) com este nome científico/,
    );
    await expect(
      warning.getByRole('link', { name: new RegExp(fixtures.featured.commonName) }),
    ).toBeVisible();

    await warning
      .getByLabel('Confirmo que é um registro diferente e quero salvar mesmo assim')
      .check();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();

    await expect(page).toHaveURL(/\/admin\/especies\/[0-9a-f-]{36}\?criada=1$/);
    await expect(page.getByText('Rascunho criado.')).toBeVisible();
    editUrl = page.url().replace('?criada=1', '');
  });

  test('o rascunho não aparece no site', async () => {
    const response = await page.request.get(`/especies/${NEW_SPECIES.slug}`);
    expect(response.status()).toBe(404);
  });

  test('a publicação fica bloqueada e explica o que falta', async () => {
    await page.goto(editUrl);
    const checklist = page.getByRole('list', { name: 'Requisitos de publicação' });
    await expect(
      checklist.getByRole('listitem').filter({ hasText: 'Imagem de capa definida' }),
    ).toContainText('Falta');
    await expect(
      checklist.getByRole('listitem').filter({ hasText: 'Resumo curto ou descrição geral' }),
    ).toContainText('Falta');
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });

  test('um arquivo que não é imagem é recusado antes do envio', async () => {
    await page.getByLabel('Escolher arquivos').setInputFiles({
      name: 'falsa.png',
      mimeType: 'image/png',
      buffer: Buffer.from('isto não é uma imagem'),
    });
    const pendingItem = page.locator('.pending-item');
    await expect(pendingItem).toContainText(
      'O conteúdo do arquivo não é uma imagem WebP, JPEG ou PNG.',
    );
    await expect(page.getByRole('button', { name: /^Enviar/ })).toHaveCount(0);
    await pendingItem.getByRole('button', { name: /Remover da lista/ }).click();
  });

  test('o envio de imagem exige texto alternativo e mostra a imagem na galeria', async () => {
    await page.getByLabel('Escolher arquivos').setInputFiles({
      name: 'foto-teste.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await page.getByRole('button', { name: 'Enviar imagem' }).click();
    await expect(page.getByText('Descreva a imagem (texto alternativo).')).toBeVisible();

    const pending = page.getByRole('list', { name: 'Imagens a enviar' });
    await pending.getByLabel(/Texto alternativo/).fill('Foto fictícia enviada pelo teste');
    await pending.getByLabel('Crédito').fill('Equipe de testes');
    await page.getByRole('button', { name: 'Enviar imagem' }).click();

    await expect(page.getByText('Imagem enviada.')).toBeVisible();
    const gallery = page.getByRole('list', { name: 'Imagens na ordem da galeria' });
    await expect(gallery.getByRole('listitem')).toHaveCount(1);
    await expect(gallery).toContainText('Foto fictícia enviada pelo teste');
  });

  test('define a capa, completa o resumo e publica', async () => {
    await page.getByRole('button', { name: /Definir como capa/ }).click();
    await expect(page.getByText('Capa definida.')).toBeVisible();

    await page.locator('#campo-shortDescription').fill(NEW_SPECIES.summary);
    await expect(page.getByText('Há alterações não salvas.')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByText('Rascunho salvo.')).toBeVisible();

    const publish = page.getByRole('button', { name: 'Publicar' });
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText('Espécie publicada.')).toBeVisible();

    const site = await page.request.get(`/especies/${NEW_SPECIES.slug}`);
    expect(site.status()).toBe(200);
    expect(await site.text()).toContain(NEW_SPECIES.commonName);
  });

  test('não deixa a espécie publicada incompleta', async () => {
    await page.goto(editUrl);
    // Remover a capa de uma espécie publicada é bloqueado.
    await page.getByRole('button', { name: /^Excluir imagem 1/ }).click();
    await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'publicada incompleta' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Imagens na ordem da galeria' }).getByRole('listitem'),
    ).toHaveCount(1);

    // Apagar o único texto também é bloqueado, sem perder o que foi digitado.
    await page.locator('#campo-shortDescription').fill('');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'publicada incompleta' })).toBeVisible();
    await page.locator('#campo-shortDescription').fill(NEW_SPECIES.summary);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Alterações salvas e já visíveis no site.')).toBeVisible();
  });

  test('envia várias imagens de uma vez e reordena a galeria', async () => {
    await page.goto(editUrl);
    await page.getByLabel('Escolher arquivos').setInputFiles([
      { name: 'segunda.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'terceira.png', mimeType: 'image/png', buffer: TINY_PNG },
    ]);
    const pending = page.getByRole('list', { name: 'Imagens a enviar' });
    const alts = pending.getByLabel(/Texto alternativo/);
    await expect(alts).toHaveCount(2);
    await alts.nth(0).fill('Segunda foto fictícia');
    await alts.nth(1).fill('Terceira foto fictícia');
    await page.getByRole('button', { name: 'Enviar 2 imagens' }).click();

    const gallery = page.getByRole('list', { name: 'Imagens na ordem da galeria' });
    await expect(gallery.getByRole('listitem')).toHaveCount(3);

    // A terceira sobe para a segunda posição.
    await page.getByRole('button', { name: 'Mover para cima (imagem 3)' }).click();
    await expect(gallery.getByRole('listitem').nth(1)).toContainText('Terceira foto fictícia');
    await expect(gallery.getByRole('listitem').nth(2)).toContainText('Segunda foto fictícia');

    // O site mostra a mesma ordem.
    const site = await context.newPage();
    await site.goto(`/especies/${NEW_SPECIES.slug}`);
    const order = await site
      .getByRole('region', { name: 'Galeria' })
      .getByRole('img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('alt')));
    expect(order).toEqual([
      'Foto fictícia enviada pelo teste',
      'Terceira foto fictícia',
      'Segunda foto fictícia',
    ]);
    await site.close();
  });

  test('fontes: exige título ou endereço, adiciona e remove', async () => {
    await page.goto(editUrl);
    const sources = page.locator('#fontes');
    await sources.getByRole('button', { name: 'Adicionar fonte' }).click();
    await expect(sources.getByText('Informe o título ou o endereço da referência.')).toBeVisible();

    await sources.getByLabel('Título da referência').fill('Referência fictícia do painel');
    await sources.getByLabel('Resumo curto').check();
    await sources.getByRole('button', { name: 'Adicionar fonte' }).click();
    await expect(sources.getByText('Fonte adicionada.')).toBeVisible();
    await expect(sources.getByText('Referência fictícia do painel')).toBeVisible();
    await expect(sources).toContainText('Campos: Resumo curto.');

    await sources.getByRole('button', { name: 'Remover fonte' }).click();
    await sources.getByRole('button', { name: 'Confirmar remoção' }).click();
    await expect(sources.getByText('Fonte removida.')).toBeVisible();
    await expect(sources.getByText('Nenhuma fonte registrada.')).toBeVisible();
  });

  test('retirar do site tira a espécie do catálogo público', async () => {
    await page.goto(editUrl);
    await page.getByRole('button', { name: 'Retirar do site' }).click();
    await expect(page.getByText('Publicação retirada.')).toBeVisible();
    const site = await page.request.get(`/especies/${NEW_SPECIES.slug}`);
    expect(site.status()).toBe(404);
  });

  test('alterações não salvas ficam guardadas no navegador', async () => {
    await page.goto(editUrl);
    await page.locator('#campo-habitat').fill('Texto fictício ainda não salvo');
    await page.reload();
    await page.getByRole('button', { name: 'Recuperar alterações' }).click();
    await expect(page.locator('#campo-habitat')).toHaveValue('Texto fictício ainda não salvo');
    // Descarta para não afetar os próximos testes.
    await page.locator('#campo-habitat').fill('');
  });

  test('a exclusão exige digitar o nome e remove a espécie', async () => {
    await page.goto(editUrl);
    const remove = page.getByRole('button', { name: 'Excluir espécie definitivamente' });
    await expect(remove).toBeDisabled();
    await page.getByLabel(/Para confirmar, digite o nome popular/).fill(NEW_SPECIES.commonName);
    await expect(remove).toBeEnabled();
    await remove.click();

    await expect(page).toHaveURL(/\/admin\/especies\?excluida=1$/);
    await expect(page.getByText('Espécie excluída.')).toBeVisible();
    const gone = await page.request.get(editUrl);
    expect(gone.status()).toBe(404);
  });

  test('sair encerra a sessão', async () => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/admin\/login\?saiu=1$/);
    await expect(page.getByText('Você saiu do painel.')).toBeVisible();
    await page.goto('/admin/especies');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
