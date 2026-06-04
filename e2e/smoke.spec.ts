import { test, expect } from '@playwright/test';

test('app loads and renders a playable board', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // first screen is the game itself
  await expect(page.getByRole('heading', { name: 'Chess Royale' })).toBeVisible();

  // board renders 64 squares
  await expect(page.getByTestId('square')).toHaveCount(64);

  // both hands render with cards
  await expect(page.getByTestId('hand-white')).toBeVisible();
  await expect(page.getByTestId('hand-black')).toBeVisible();
  expect(await page.getByTestId('hand-white').getByTestId('card').count()).toBeGreaterThan(0);

  // energy + deck counts appear for both players
  await expect(page.getByTestId('energy-white')).toBeVisible();
  await expect(page.getByTestId('energy-black')).toBeVisible();
  await expect(page.getByTestId('energy-value-white')).toContainText('/10');
  await expect(page.getByTestId('deck-white')).toBeVisible();

  // reset button works and the board is still intact afterwards
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('square')).toHaveCount(64);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
