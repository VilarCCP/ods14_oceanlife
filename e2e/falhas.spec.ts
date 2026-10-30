import { execFileSync } from 'node:child_process';

import { expect, test, type BrowserContext } from '@playwright/test';

import { fixtures } from './fixtures';
import { signIn } from './helpers';

/**
 * Estados de falha com o banco fora do ar (doc 02 §13, doc 03 §13). Para a API
 * de dados do Supabase LOCAL (contêiner PostgREST) durante os testes e a religa
 * no final. Roda isolado no projeto "falhas", depois dos demais testes.
 */

const REST_CONTAINER = 'supabase_rest_oceanlife';

function docker(...args: string[]) {
  execFileSync('docker', args, { stdio: 'pipe', timeout: 60_000 });
}

async function waitForRest(baseUrl: string, up: boolean) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    let ok = false;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
      });
      ok = response.status < 500;
    } catch {
      ok = false;
    }
    if (ok === up) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`A API de dados não ficou ${up ? 'disponível' : 'indisponível'} a tempo.`);
}

test.describe('com o banco indisponível', () => {
  test.describe.configure({ mode: 'serial' });
  const supabaseUrl = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';

  let adminContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Entra no painel antes de derrubar o banco, para testar a sessão já aberta.
    adminContext = await browser.newContext({ baseURL: 'http://localhost:3000', locale: 'pt-BR' });
    await signIn(await adminContext.newPage(), 'admin');
    docker('stop', REST_CONTAINER);
  });

  test.afterAll(async () => {
    await adminContext?.close();
    docker('start', REST_CONTAINER);
    await waitForRest(supabaseUrl, true);
  });

  test('a API de dados está mesmo fora do ar', async () => {
    await waitForRest(supabaseUrl, false);
  });

  const PUBLIC_FAILURES = [
    { path: '/', message: 'Não foi possível carregar as espécies em destaque.' },
    { path: '/especies', message: 'Não foi possível carregar o catálogo.' },
    {
      path: `/especies/${fixtures.featured.slug}`,
      message: 'Não foi possível carregar esta página',
    },
  ];

  for (const { path, message } of PUBLIC_FAILURES) {
    test(`o site mostra uma mensagem de erro clara em ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      const alert = page.getByRole('alert').filter({ hasText: message });
      await expect(alert).toBeVisible();
      // Sempre oferece tentar de novo.
      await expect(alert.getByText(/tent(ar|e) novamente/i).first()).toBeVisible();
      // Nem "catálogo vazio" nem "página não encontrada": é uma falha, não ausência de dados.
      await expect(
        page.getByText(/nenhuma espécie encontrada|ainda está sendo preparado|não encontrada/i),
      ).toHaveCount(0);
      expect(response?.status()).not.toBe(404);
      // Nenhum detalhe interno exposto.
      await expect(page.locator('body')).not.toContainText(/PGRST|fetch failed|ECONNREFUSED/i);
    });
  }

  test('o painel mostra o erro e oferece tentar de novo ou entrar novamente', async () => {
    const page = await adminContext.newPage();
    await page.goto('/admin/especies');
    await expect(
      page.getByRole('heading', { name: 'Não foi possível carregar esta página do painel' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar novamente' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/PGRST|fetch failed|ECONNREFUSED/i);
  });
});
