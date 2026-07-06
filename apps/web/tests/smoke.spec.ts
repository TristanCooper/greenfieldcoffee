import { test, expect } from '@playwright/test';

test('marketing page renders the product name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Greenfield Coffee' })).toBeVisible();
});

test('login page renders and accepts navigation to signup', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Sign in to Greenfield Coffee')).toBeVisible();
  await page.getByRole('link', { name: 'Create your roastery' }).click();
  await expect(page.getByText('Create your roastery')).toBeVisible();
});