import { test, expect, chromium, type Browser } from '@playwright/test';

// Two independent browser contexts share one room through the Durable Object.
test('two browsers connect to one room and the game starts', async () => {
  const browser: Browser = await chromium.launch();
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const pa = await host.newPage();
  const pb = await guest.newPage();

  try {
    // Host creates a room and sees the share overlay with a code.
    await pa.goto('/');
    await pa.getByTestId('create-online').click();
    await expect(pa.getByTestId('waiting-overlay')).toBeVisible();
    const code = (await pa.locator('.share-code').textContent())?.trim() ?? '';
    expect(code).toMatch(/^[A-Z2-9]{5}$/);

    // Guest joins with the code.
    await pb.goto('/');
    await pb.getByTestId('join-code').fill(code);
    await pb.getByTestId('join-online').click();

    // Both clients reach the playing state once the room has two players.
    await expect(pa.getByTestId('online-status')).toHaveText('Playing');
    await expect(pb.getByTestId('online-status')).toHaveText('Playing');

    // One is White, the other is Black.
    await expect(pa.getByTestId('online-bar')).toContainText('White');
    await expect(pb.getByTestId('online-bar')).toContainText('Black');

    // Both render the same authoritative board: 64 squares, two kings.
    await expect(pa.getByTestId('square')).toHaveCount(64);
    await expect(pb.getByTestId('square')).toHaveCount(64);
    await expect(pa.locator('.piece')).toHaveCount(2);
    await expect(pb.locator('.piece')).toHaveCount(2);

    // Each player sees the board from their own side: their hand is at the bottom.
    const handYs = async (page: typeof pa) => {
      const w = await page.getByTestId('hand-white').boundingBox();
      const b = await page.getByTestId('hand-black').boundingBox();
      return { white: w!.y, black: b!.y };
    };
    const host = await handYs(pa); // White: white hand below black hand
    expect(host.white).toBeGreaterThan(host.black);
    const guest = await handYs(pb); // Black (flipped): black hand below white hand
    expect(guest.black).toBeGreaterThan(guest.white);

    // Guest leaving ends the game for the host.
    await pb.getByTestId('leave').click();
    await expect(pa.getByTestId('online-overlay')).toBeVisible();
    await expect(pa.getByTestId('online-overlay')).toContainText('Opponent left');
  } finally {
    await browser.close();
  }
});
