import { expect, test, type Page } from '@playwright/test';

async function chooseFaction(page: Page, factionName: string) {
  const trigger = page.locator('button:has-text("Choose faction")').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.getByRole('option', { name: factionName });
  await expect(option).toBeVisible();
  await option.click();
}

async function startGameAndReachPlayableState(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Chronicles of the Promised Land/i })).toBeVisible();
  await page.getByRole('button', { name: /Single Player vs AI/i }).click();
  await expect(page.getByRole('heading', { name: /Local Game Setup/i })).toBeVisible();

  await chooseFaction(page, 'Nephites');
  await chooseFaction(page, 'Lamanites');

  const startGameButton = page.getByRole('button', { name: /^Start Game$/i });
  await expect(page.getByText(/Ready 2\/2/i)).toBeVisible({ timeout: 15_000 });
  await expect(startGameButton).toBeEnabled();
  await startGameButton.click();

  const endTurnButton = page.getByRole('button', { name: /End Turn/i });
  const startTurnButton = page.getByRole('button', { name: /Start Turn/i });
  const deadline = Date.now() + 90_000;

  // In pass-and-play there can be one or more handoff screens.
  while (Date.now() < deadline) {
    if (await endTurnButton.isVisible().catch(() => false)) {
      break;
    }

    if (await startTurnButton.isVisible().catch(() => false)) {
      await startTurnButton.click();
      await page.waitForTimeout(250);
      continue;
    }

    await page.waitForTimeout(250);
  }

  await expect(endTurnButton).toBeVisible({ timeout: 90_000 });
}

async function installCanvasEventCounters(page: Page) {
  await page.waitForSelector('canvas', { state: 'attached', timeout: 45_000 });

  const attached = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;

    const win = window as Window & {
      __tutorialOverlayCanary?: { click: number; pointerdown: number };
      __tutorialOverlayHandlers?: { onClick: () => void; onPointerDown: () => void };
    };

    win.__tutorialOverlayCanary = { click: 0, pointerdown: 0 };
    const onClick = () => {
      if (!win.__tutorialOverlayCanary) return;
      win.__tutorialOverlayCanary.click += 1;
    };
    const onPointerDown = () => {
      if (!win.__tutorialOverlayCanary) return;
      win.__tutorialOverlayCanary.pointerdown += 1;
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('pointerdown', onPointerDown);
    win.__tutorialOverlayHandlers = { onClick, onPointerDown };
    return true;
  });

  expect(attached).toBe(true);
}

async function readCanvasEventCounters(page: Page) {
  return page.evaluate(() => {
    const win = window as Window & {
      __tutorialOverlayCanary?: { click: number; pointerdown: number };
    };
    return win.__tutorialOverlayCanary ?? { click: -1, pointerdown: -1 };
  });
}

async function removeCanvasEventCounters(page: Page) {
  if (page.isClosed()) return;

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const win = window as Window & {
      __tutorialOverlayHandlers?: { onClick: () => void; onPointerDown: () => void };
      __tutorialOverlayCanary?: { click: number; pointerdown: number };
    };
    if (canvas && win.__tutorialOverlayHandlers) {
      canvas.removeEventListener('click', win.__tutorialOverlayHandlers.onClick);
      canvas.removeEventListener('pointerdown', win.__tutorialOverlayHandlers.onPointerDown);
    }
    delete win.__tutorialOverlayHandlers;
    delete win.__tutorialOverlayCanary;
  }).catch(() => {
    // Ignore cleanup errors when the page is torn down during timeout handling.
  });
}

test.describe('Tutorial overlay input blocking canary', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      const message = String(error?.message ?? '');
      // `/api/saves` can fail in test envs without configured DB roles;
      // app falls back to local save storage, so this noise is ignored.
      if (message.includes('Failed to list saves')) {
        return;
      }
      throw error;
    });
  });

  test('Begin click closes tutorial without passing clicks to the world map', async ({ page }) => {
    await startGameAndReachPlayableState(page);
    await installCanvasEventCounters(page);

    const tutorialDialog = page
      .locator('[data-ui-layer="modal"][role="dialog"]')
      .filter({ hasText: /Chronicles of the Promised Land/i });

    await expect(tutorialDialog).toBeVisible({ timeout: 45_000 });

    try {
      const beginButton = tutorialDialog.getByRole('button', { name: /^Begin$/i });
      await expect(beginButton).toBeVisible();
      await expect(beginButton).toBeEnabled();
      await beginButton.click();
      if (await tutorialDialog.isVisible().catch(() => false)) {
        await page.waitForTimeout(150);
        await beginButton.click();
      }
      await expect(tutorialDialog).toBeHidden({ timeout: 15_000 });
      await page.waitForTimeout(250);

      const counters = await readCanvasEventCounters(page);
      expect(counters.click).toBe(0);
      expect(counters.pointerdown).toBe(0);
    } finally {
      await removeCanvasEventCounters(page);
    }
  });

  test('Open Later click closes tutorial without passing clicks to the world map', async ({ page }) => {
    await startGameAndReachPlayableState(page);
    await installCanvasEventCounters(page);

    const tutorialDialog = page
      .locator('[data-ui-layer="modal"][role="dialog"]')
      .filter({ hasText: /Chronicles of the Promised Land/i });

    await expect(tutorialDialog).toBeVisible({ timeout: 45_000 });

    try {
      const openLaterButton = tutorialDialog.getByRole('button', { name: /Open Later/i });
      await expect(openLaterButton).toBeVisible();
      await expect(openLaterButton).toBeEnabled();
      await openLaterButton.click();
      if (await tutorialDialog.isVisible().catch(() => false)) {
        await page.waitForTimeout(150);
        await openLaterButton.click();
      }
      await expect(tutorialDialog).toBeHidden({ timeout: 15_000 });
      await page.waitForTimeout(250);

      const counters = await readCanvasEventCounters(page);
      expect(counters.click).toBe(0);
      expect(counters.pointerdown).toBe(0);
    } finally {
      await removeCanvasEventCounters(page);
    }
  });
});
