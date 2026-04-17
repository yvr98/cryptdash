import { expect, test } from '@playwright/test';

test('playwright is wired and can run a browser test', async ({ page }) => {
  await page.setContent('<main><h1>Playwright Ready</h1></main>');
  await expect(page.getByRole('heading', { name: 'Playwright Ready' })).toBeVisible();
});
