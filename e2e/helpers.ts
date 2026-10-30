import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { USERS_FILE, type E2ECredentials } from './fixtures';

export function credentials(): E2ECredentials {
  return JSON.parse(readFileSync(USERS_FILE, 'utf8')) as E2ECredentials;
}

/** Entra no painel pela tela de login, como uma pessoa faria. */
export async function signIn(page: Page, role: keyof E2ECredentials, next?: string) {
  const user = credentials()[role];
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}
