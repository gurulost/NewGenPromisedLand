import { expect, test, type Locator, type Page } from '@playwright/test';

import { openSinglePlayerSetup } from './helpers/gameSession';

type Viewport = { name: string; width: number; height: number };

const DESKTOP_VIEWPORTS: Viewport[] = [
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const TOUCH_VIEWPORTS: Viewport[] = [
  { name: 'mobile-large', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 834, height: 1112 },
];

async function assertInViewport(
  locator: Locator,
  page: Page,
  options: { allowVerticalOverflow?: boolean } = {}
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  if (!options.allowVerticalOverflow) {
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

async function openPlayerSetup(page: Page) {
  await openSinglePlayerSetup(page);
}

test.describe('Viewport Sweep', () => {
  test.describe.configure({ timeout: 60_000 });

  test('main menu controls stay visible on desktop viewports', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome' || testInfo.project.name === 'mobile-safari',
      'Desktop viewport sweep is covered on desktop/tablet projects; mobile projects are covered by touch viewport checks.'
    );

    for (const viewport of DESKTOP_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const startButton = page.getByTestId('main-menu-single-player');
      const onlineButton = page.getByTestId('main-menu-online-multiplayer');

      await expect(startButton, `${viewport.name}: missing start button`).toBeVisible();
      await expect(onlineButton, `${viewport.name}: missing online button`).toBeVisible();
      await assertInViewport(startButton, page);
      await assertInViewport(onlineButton, page);
    }
  });

  test('player setup remains usable on touch viewports', async ({ browser }) => {
    const browserName = browser.browserType().name();

    for (const viewport of TOUCH_VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: true,
        ...(browserName === 'firefox' ? {} : { isMobile: true }),
      });
      const page = await context.newPage();

      try {
        await openPlayerSetup(page);

        const addPlayerButton = page.getByTestId('player-setup-add-player');
        const startGameButton = page.getByTestId('player-setup-start-game');

        await expect(addPlayerButton, `${viewport.name}: missing add player button`).toBeVisible();
        await expect(startGameButton, `${viewport.name}: missing start game button`).toBeVisible();
        await assertInViewport(addPlayerButton, page, { allowVerticalOverflow: true });
        await assertInViewport(startGameButton, page, { allowVerticalOverflow: true });

        const overflow = await page.evaluate(() => ({
          widthOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          heightOverflow:
            document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }));

        // Vertical scroll is expected in setup; horizontal overflow should be absent.
        expect(overflow.widthOverflow, `${viewport.name}: horizontal overflow detected`).toBeLessThanOrEqual(2);
      } finally {
        await context.close();
      }
    }
  });
});
