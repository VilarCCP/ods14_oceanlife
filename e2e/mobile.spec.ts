import { expect, test } from '@playwright/test';

import { fixtures } from './fixtures';

test('no celular, o menu abre e fecha com o botão e é acessível', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();

  await toggle.click();
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Espécies' })
    .click();

  await expect(page).toHaveURL(/\/especies$/);
  // Ao navegar, o menu fecha.
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('no celular, a página não tem rolagem horizontal', async ({ page }) => {
  for (const path of [
    '/',
    '/especies',
    `/especies/${fixtures.featured.slug}`,
    '/conservacao',
    '/sobre',
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(1);
  }
});
