import { expect, type Page } from '@playwright/test';

/**
 * The app now opens on the start menu. This drives the menu into a local game
 * with the given matchup (defaults to Human vs Human) and waits for the board.
 */
export async function startLocalGame(
  page: Page,
  white: 'human' | 'easy' | 'medium' | 'hard' = 'human',
  black: 'human' | 'easy' | 'medium' | 'hard' = 'human',
): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('menu')).toBeVisible();
  await page.getByTestId('menu-white').selectOption(white);
  await page.getByTestId('menu-black').selectOption(black);
  await page.getByTestId('play-local').click();
  await expect(page.getByTestId('square')).toHaveCount(64);
}
