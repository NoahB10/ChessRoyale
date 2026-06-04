import { test, expect } from '@playwright/test';

test('speed slider adjusts game speed live and persists across reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  const slider = page.getByTestId('speed-slider');
  const input = page.getByTestId('speed-input');
  const value = page.getByTestId('speed-value');

  // renders on the side of the board with the default 0.60x speed
  await expect(slider).toBeVisible();
  await expect(value).toHaveText('0.60×');
  await page.screenshot({ path: 'e2e/screenshots/speed-default.png', fullPage: true });

  // moving the slider updates the live readout and persists to localStorage
  await input.fill('1.2');
  await expect(value).toHaveText('1.20×');
  expect(await page.evaluate(() => localStorage.getItem('chessRoyale.speed'))).toBe('1.2');

  await input.fill('0.2');
  await expect(value).toHaveText('0.20×');
  await page.screenshot({ path: 'e2e/screenshots/speed-slow.png', fullPage: true });

  // reload restores the chosen speed
  await page.reload();
  await expect(page.getByTestId('speed-value')).toHaveText('0.20×');

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
