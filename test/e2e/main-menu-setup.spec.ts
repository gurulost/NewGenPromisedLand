import { expect, test, type Page } from '@playwright/test';

async function openPlayerSetup(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Chronicles of the Promised Land/i })).toBeVisible();
  await page.getByRole('button', { name: /Single Player vs AI/i }).click();
  await expect(page.getByRole('heading', { name: /Local Game Setup/i })).toBeVisible();
}

async function advanceHandoffToActiveTurn(page: Page) {
  const startTurnButton = page.getByRole('button', { name: /Start Turn/i });

  // In pass-and-play there can be one or more handoff screens before action HUD appears.
  for (let i = 0; i < 8; i += 1) {
    if (await page.getByRole('button', { name: /End Turn/i }).isVisible().catch(() => false)) {
      return;
    }

    if (await startTurnButton.isVisible().catch(() => false)) {
      await startTurnButton.click();
      await page.waitForTimeout(250);
      continue;
    }

    await page.waitForTimeout(250);
  }
}

async function chooseFaction(page: Page, factionName: string) {
  const trigger = page.locator('button:has-text("Choose faction")').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.getByRole('option', { name: factionName });
  await expect(option).toBeVisible();
  await option.click();
}

test.describe('Main Menu and Setup Smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      const message = String(error?.message ?? '');
      // `/api/saves` can fail in test environments without a configured DB role;
      // the app falls back to local storage saves, so we ignore this expected noise.
      if (message.includes('Failed to list saves')) {
        return;
      }
      throw error;
    });
  });

  test('renders key main menu actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Chronicles of the Promised Land/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Single Player vs AI/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Local Multiplayer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Online Multiplayer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Load Saved Game/i })).toBeVisible();
  });

  test('requires faction selection before start and enables start once valid', async ({ page }) => {
    await openPlayerSetup(page);

    const startGameButton = page.getByRole('button', { name: /^Start Game$/i });
    await expect(startGameButton).toBeDisabled();
    await expect(page.getByText(/Select factions for/i)).toBeVisible();

    await chooseFaction(page, 'Nephites');
    await chooseFaction(page, 'Lamanites');

    await expect(startGameButton).toBeEnabled();
    await expect(page.getByText(/Ready 2\/2/i)).toBeVisible();
  });

  test('starts a local game after valid setup', async ({ page }) => {
    await openPlayerSetup(page);
    await chooseFaction(page, 'Nephites');
    await chooseFaction(page, 'Lamanites');

    await page.getByRole('button', { name: /^Start Game$/i }).click();
    await advanceHandoffToActiveTurn(page);
    await expect(page.getByRole('button', { name: /End Turn/i })).toBeVisible({ timeout: 20000 });
  });
});
