import { expect, test, type Page } from '@playwright/test';

import {
  attachExpectedPageErrorFilter,
  startSinglePlayerGame,
} from './helpers/gameSession';

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
    attachExpectedPageErrorFilter(page);
  });

  test('Begin click closes tutorial without passing clicks to the world map', async ({ page }) => {
    await startSinglePlayerGame(page);
    await installCanvasEventCounters(page);

    const tutorialDialog = page.getByTestId('tutorial-overlay-dialog');

    await expect(tutorialDialog).toBeVisible({ timeout: 45_000 });

    try {
      const beginButton = page.getByTestId('tutorial-overlay-primary-action');
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
    await startSinglePlayerGame(page);
    await installCanvasEventCounters(page);

    const tutorialDialog = page.getByTestId('tutorial-overlay-dialog');

    await expect(tutorialDialog).toBeVisible({ timeout: 45_000 });

    try {
      const openLaterButton = page.getByTestId('tutorial-overlay-open-later');
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
