import { test, expect, type Page } from '@playwright/test';
import { startLocalGame } from './helpers';

const SOAK_MS = 60_000;

const WHITE_SQUARES = [
  'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
  'a1', 'b1', 'c1', 'd1', 'f1', 'g1', 'h1',
];
const BLACK_SQUARES = [
  'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
  'a8', 'b8', 'c8', 'd8', 'f8', 'g8', 'h8',
];

async function emptySquare(page: Page, names: string[]): Promise<string | null> {
  for (const name of names) {
    const occupied = await page.locator(`[data-square="${name}"] .piece`).count();
    if (occupied === 0) return name;
  }
  return null;
}

/** Drag the first card of a hand onto an empty deployment square (best-effort). */
async function deployOne(page: Page, player: 'white' | 'black', squares: string[]) {
  const card = page.getByTestId(`hand-${player}`).getByTestId('card').first();
  if ((await card.count()) === 0) return;
  const target = await emptySquare(page, squares);
  if (!target) return;

  const cb = await card.boundingBox();
  const sb = await page.locator(`[data-square="${target}"]`).boundingBox();
  if (!cb || !sb) return;

  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 12, cb.y + cb.height / 2 + 12, { steps: 3 });
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('runs for 60s of real-time play without crashing or console errors', async ({ page }) => {
  test.setTimeout(SOAK_MS + 60_000);

  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await startLocalGame(page); // Human vs Human so both hands can be deployed

  const start = Date.now();
  let maxPieces = 2; // two kings
  let gamesCompleted = 0;

  while (Date.now() - start < SOAK_MS) {
    // if a king was captured, that's a valid win — reset and keep playing
    if ((await page.getByTestId('winner-overlay').count()) > 0) {
      gamesCompleted++;
      await page.getByTestId('reset').click();
      await expect(page.getByTestId('winner-overlay')).toHaveCount(0, { timeout: 8000 });
      continue;
    }

    await deployOne(page, 'white', WHITE_SQUARES);
    await deployOne(page, 'black', BLACK_SQUARES);

    // board must stay intact every cycle (no crash / unmount)
    await expect(page.getByTestId('square')).toHaveCount(64);
    maxPieces = Math.max(maxPieces, await page.locator('.piece').count());

    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'e2e/screenshots/soak.png', fullPage: true });

  // ran the full duration
  expect(Date.now() - start).toBeGreaterThanOrEqual(SOAK_MS);
  // pieces were actually deployed and fought
  expect(maxPieces).toBeGreaterThan(2);
  // board still alive and interactive at the end
  await expect(page.getByTestId('square')).toHaveCount(64);
  await expect(page.getByTestId('energy-white')).toBeVisible();
  // no runtime/console errors the entire run
  expect(errors, `console errors during soak:\n${errors.join('\n')}`).toEqual([]);

  console.log(
    `[soak] ran ${Math.round((Date.now() - start) / 1000)}s, peak pieces: ${maxPieces}, games completed: ${gamesCompleted}`,
  );
});
