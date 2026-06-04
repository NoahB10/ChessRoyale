import { test, expect } from '@playwright/test';
import { startLocalGame } from './helpers';

test('bots play on their own, pause freezes them, and restart works', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await startLocalGame(page);

  // Bot vs Bot: white hard, black easy (set via the in-game controls).
  await page.getByTestId('controller-white').selectOption('hard');
  await page.getByTestId('controller-black').selectOption('easy');

  // Both sides advertise that a bot is in control.
  await expect(page.getByTestId('bot-badge-white')).toContainText('Hard');
  await expect(page.getByTestId('bot-badge-black')).toContainText('Easy');

  // The bots deploy pieces by themselves within a few seconds (no human input).
  await expect
    .poll(() => page.locator('.piece').count(), { timeout: 12_000 })
    .toBeGreaterThan(2);

  // Pause freezes the world — no new deployments or movement.
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toContainText('Resume');
  const frozen = await page.locator('.piece').count();
  await page.waitForTimeout(2500);
  expect(await page.locator('.piece').count()).toBe(frozen);

  // Resume, then restart back to a clean board (mode is preserved).
  await page.getByTestId('pause').click();
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('square')).toHaveCount(64);
  await expect(page.getByTestId('bot-badge-white')).toContainText('Hard');

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
