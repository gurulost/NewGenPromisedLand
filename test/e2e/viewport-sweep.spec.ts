import { test, expect, type Locator, type Page } from '@playwright/test';

type Viewport = { name: string; width: number; height: number };

const DESKTOP_VIEWPORTS: Viewport[] = [
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1440 },
];

const TOUCH_VIEWPORTS: Viewport[] = [
  { name: 'mobile-large', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 834, height: 1112 },
];
const SUPPORTED_PROJECTS = new Set(['chromium', 'firefox', 'webkit']);

async function isVisible(locator: Locator, timeout = 1_500) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function waitForLoaderToSettle(page: Page) {
  await page.waitForFunction(() => {
    const loaderEl = document.querySelector<HTMLElement>('[data-testid="world-build-loader"]');
    if (!loaderEl) return true;
    const style = window.getComputedStyle(loaderEl);
    const hidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity || '1') === 0;
    return hidden || style.pointerEvents === 'none';
  }, undefined, { timeout: 45_000 });
}

async function openTutorialGame(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root'), 'App root did not load').toBeVisible({ timeout: 10_000 });

  const endTurnButton = page.getByRole('button', { name: /end turn/i }).first();
  if (await isVisible(endTurnButton, 2_000)) {
    await waitForLoaderToSettle(page);
    await page.waitForTimeout(300);
    return;
  }

  const tutorialMenuButton = page.locator('[data-testid="menu-tutorial-episode"]');
  if (await isVisible(tutorialMenuButton, 7_000)) {
    await tutorialMenuButton.click();
  } else {
    const tutorialMenuFallback = page.getByRole('button', { name: /tutorial episode/i }).first();
    if (await isVisible(tutorialMenuFallback, 2_500)) {
      await tutorialMenuFallback.click();
    }
  }

  const beginEpisodeButton = page.locator('[data-testid="tutorial-begin-episode"]');
  if (await isVisible(beginEpisodeButton, 7_000)) {
    await beginEpisodeButton.click();
  } else {
    const beginEpisodeFallback = page.getByRole('button', { name: /begin episode/i }).first();
    if (await isVisible(beginEpisodeFallback, 2_500)) {
      await beginEpisodeFallback.click();
    }
  }

  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(endTurnButton, 'Tutorial flow did not reach gameplay HUD').toBeVisible({ timeout: 30_000 });
  await waitForLoaderToSettle(page);
  await page.waitForTimeout(400);
}

async function openTechPanel(page: Page) {
  const byTestId = page.locator('[data-testid="hud-knowledge-button"]').first();
  if (await isVisible(byTestId, 1_000)) {
    await byTestId.click();
  } else {
    await page.getByRole('button', { name: /^knowledge$/i }).first().click();
  }
  await expect(page.locator('[data-testid="tech-panel"]')).toBeVisible({ timeout: 10_000 });
}

async function openSaveLoadMenu(page: Page) {
  const trigger = page.locator('[data-testid="utility-save-load-button"]').first();
  const panel = page.locator('[data-testid="save-load-menu"]');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await trigger.click();
    if (await isVisible(panel, 3_000)) {
      return;
    }
    await page.waitForTimeout(250);
  }

  await expect(panel).toBeVisible({ timeout: 10_000 });
}

async function waitForModalTransformToSettle(page: Page) {
  await page.waitForFunction(() => {
    const openLayer = document.querySelector<HTMLElement>('[data-ui-layer="modal-content"][data-state="open"], [data-ui-layer="modal-content"]');
    if (!openLayer) return true;
    const style = window.getComputedStyle(openLayer);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) {
      return true;
    }
    if (style.transform === 'none') return true;
    try {
      const matrix = new DOMMatrixReadOnly(style.transform);
      return Math.abs(matrix.m41) <= 1 && Math.abs(matrix.m42) <= 1;
    } catch {
      return false;
    }
  }, undefined, { timeout: 10_000 });
}

async function getViewportViolations(page: Page, stage: string) {
  return page.evaluate((currentStage) => {
    const layoutRect = document.documentElement.getBoundingClientRect();
    const vw = Math.max(
      window.innerWidth,
      document.documentElement.clientWidth,
      Math.round(layoutRect.width || 0),
      Math.round(window.visualViewport?.width ?? 0)
    );
    const vh = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight,
      Math.round(layoutRect.height || 0),
      Math.round(window.visualViewport?.height ?? 0)
    );
    const tolerance = 6;
    const selectors = [
      'button',
      'a[href]',
      '[role="button"]',
      '[data-ui-layer="modal"]',
      '[data-ui-layer="modal-content"]',
      '[data-testid="tech-panel"]',
      '[data-testid="city-panel"]',
      '[data-testid="building-menu"]',
      '[data-testid="advanced-save-system"]',
      '[data-testid="unit-actions-panel"]',
    ].join(',');

    const describeElement = (el: HTMLElement) => {
      const testId = el.getAttribute('data-testid');
      const ariaLabel = el.getAttribute('aria-label');
      const role = el.getAttribute('role');
      const text = (el.textContent || '').trim().slice(0, 32);
      return testId || ariaLabel || role || text || el.tagName.toLowerCase();
    };

    const isVisible = (el: HTMLElement) => {
      if (el.getAttribute('data-state') === 'closed') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity || '1') === 0) return false;
      const rect = el.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0 || rect.top >= vh) return false;
      const intersectionWidth = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
      const intersectionHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      const intersectionArea = intersectionWidth * intersectionHeight;
      const area = rect.width * rect.height;
      if (intersectionArea < 4) return false;
      if (area > 0 && intersectionArea / area < 0.05) return false;
      return rect.width > 0 && rect.height > 0;
    };

    const outOfBounds: Array<{
      stage: string;
      element: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
      viewport: string;
    }> = [];

    const all = Array.from(new Set(Array.from(document.querySelectorAll<HTMLElement>(selectors))));
    for (const el of all) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const centerX = Math.min(Math.max(rect.left + rect.width / 2, 1), vw - 1);
      const centerY = Math.min(Math.max(rect.top + rect.height / 2, 1), vh - 1);
      const topEl = document.elementFromPoint(centerX, centerY);
      if (!topEl) continue;
      if (!el.contains(topEl) && !(topEl as HTMLElement).contains(el)) continue;

      if (
        rect.left < -tolerance ||
        rect.top < -tolerance ||
        rect.right > vw + tolerance ||
        rect.bottom > vh + tolerance
      ) {
        outOfBounds.push({
          stage: currentStage,
          element: describeElement(el),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          viewport: `${vw}x${vh}`,
        });
      }
    }

    return outOfBounds;
  }, stage);
}

async function assertModalLayersAboveUtilityDock(page: Page, stage: string) {
  const stacking = await page.evaluate((currentStage) => {
    const utilityDock = document.querySelector<HTMLElement>('[data-testid="utility-dock"]');
    const utilityButton = document.querySelector<HTMLElement>('[data-testid="utility-settings-button"]');
    if (!utilityDock || !utilityButton) {
      return { stage: currentStage, found: false, utilityDockZ: -1, coveredAtCenter: false, violations: [] as string[] };
    }

    const toZ = (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const resolveEffectiveZ = (el: HTMLElement) => {
      let node: HTMLElement | null = el;
      while (node) {
        const z = window.getComputedStyle(node).zIndex;
        if (z && z !== 'auto') return toZ(z);
        node = node.parentElement;
      }
      return 0;
    };

    const isVisible = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const utilityDockZ = resolveEffectiveZ(utilityDock);
    const modalLayers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-ui-layer="modal"], [data-ui-layer="modal-content"]')
    ).filter(isVisible);

    const violations = modalLayers
      .filter((layer) => resolveEffectiveZ(layer) <= utilityDockZ)
      .map((layer) => {
        const testId = layer.getAttribute('data-testid');
        const role = layer.getAttribute('role');
        const cls = layer.className ? String(layer.className).slice(0, 40) : '';
        return `${testId || role || cls || layer.tagName.toLowerCase()}:z=${resolveEffectiveZ(layer)}`;
      });

    const rect = utilityButton.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
    const topEl = document.elementFromPoint(x, y) as HTMLElement | null;
    const coveredAtCenter = !!topEl && !utilityButton.contains(topEl) && !topEl.contains(utilityButton);

    return {
      stage: currentStage,
      found: modalLayers.length > 0,
      utilityDockZ,
      coveredAtCenter,
      violations,
    };
  }, stage);

  expect(stacking.found, `No visible modal layers for ${stage}`).toBe(true);
  expect(stacking.violations, `Modal layers beneath utility dock at ${stage}: ${JSON.stringify(stacking, null, 2)}`).toEqual([]);
  expect(stacking.coveredAtCenter, `Utility control still exposed above modal at ${stage}: ${JSON.stringify(stacking, null, 2)}`).toBe(true);
}

test.describe('Viewport Sweep', () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !SUPPORTED_PROJECTS.has(testInfo.project.name),
      'Viewport sweep manages its own emulation and runs on base browser projects only.'
    );
  });

  test('desktop viewport sweep keeps interactive UI in bounds', async ({ page }) => {
    for (const viewport of DESKTOP_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openTutorialGame(page);

      const baselineViolations = await getViewportViolations(page, `${viewport.name}:baseline`);
      expect(
        baselineViolations,
        `Out-of-bounds baseline UI at ${viewport.name}: ${JSON.stringify(baselineViolations, null, 2)}`
      ).toEqual([]);

      await openTechPanel(page);
      await page.waitForTimeout(250);

      const modalViolations = await getViewportViolations(page, `${viewport.name}:tech-modal`);
      expect(
        modalViolations,
        `Out-of-bounds modal UI at ${viewport.name}: ${JSON.stringify(modalViolations, null, 2)}`
      ).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="tech-panel"]')).toBeHidden();
    }
  });

  test('touch viewport sweep keeps mobile HUD and sheet in bounds', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit mobile viewport metrics over-report bottom sheet bounds in this environment.');
    for (const viewport of TOUCH_VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        ...(browserName !== 'firefox' ? { isMobile: true } : {}),
        hasTouch: true,
      });
      const page = await context.newPage();
      try {
        await openTutorialGame(page);

        const baselineViolations = await getViewportViolations(page, `${viewport.name}:baseline`);
        expect(
          baselineViolations,
          `Out-of-bounds mobile baseline UI at ${viewport.name}: ${JSON.stringify(baselineViolations, null, 2)}`
        ).toEqual([]);

        await page.getByRole('button', { name: /open menu/i }).click();
        await expect(page.getByRole('heading', { name: /game menu/i })).toBeVisible({ timeout: 10_000 });
        await waitForModalTransformToSettle(page);
        await page.waitForTimeout(200);

        const menuViolations = await getViewportViolations(page, `${viewport.name}:menu-sheet`);
        expect(
          menuViolations,
          `Out-of-bounds mobile menu UI at ${viewport.name}: ${JSON.stringify(menuViolations, null, 2)}`
        ).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test('modal stacking keeps utility dock controls beneath modal layers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTutorialGame(page);

    const utilitySettings = page.locator('[data-testid="utility-settings-button"]');
    await expect(utilitySettings).toBeVisible();

    await openTechPanel(page);
    await assertModalLayersAboveUtilityDock(page, 'tech-panel');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="tech-panel"]')).toBeHidden();

    await openSaveLoadMenu(page);
    await expect(page.locator('[data-testid="save-load-menu"]')).toBeVisible();
    await assertModalLayersAboveUtilityDock(page, 'save-load-menu');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="save-load-menu"]')).toBeHidden();

    await page.locator('[data-testid="utility-advanced-save-button"]').click();
    await expect(page.locator('[data-testid="advanced-save-system"]')).toBeVisible();
    await assertModalLayersAboveUtilityDock(page, 'advanced-save-system');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="advanced-save-system"]')).toBeHidden();

  });
});
