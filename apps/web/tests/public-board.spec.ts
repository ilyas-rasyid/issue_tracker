import { test, expect } from '@playwright/test';
test('public board opens in List view and has usable search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Search issues' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search issues' }).fill('login');
  await expect(page).toHaveURL(/search=login/);
});
test('guest sees login entry and registration fields', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
});
test('theme preference is persisted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
