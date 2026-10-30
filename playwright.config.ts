import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta do site público. Rodam no CI contra o build de
 * produção (`npm run start`) e um Supabase local com dados fictícios criados em
 * e2e/global-setup.ts. Ver .github/workflows/e2e.yml.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(capturas|mobile|falhas)\.spec\.ts/,
    },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      // Derruba a API de dados do Supabase local; roda sozinho, depois dos demais.
      name: 'falhas',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /falhas\.spec\.ts/,
    },
    {
      // Capturas de tela para revisão visual (não fazem asserções de layout).
      name: 'capturas',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /capturas\.spec\.ts/,
    },
  ],
  webServer: [
    {
      // WoRMS e GBIF simulados para a importação assistida.
      command: 'node e2e/mock-apis.mjs',
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
