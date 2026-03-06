import { expect, test } from '@playwright/test';

import {
  attachExpectedPageErrorFilter,
  cycleTurn,
  dismissTutorialOverlay,
  openSaveLoadMenu,
  startSinglePlayerGame,
} from './helpers/gameSession';

test.describe('In-game regression coverage', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    attachExpectedPageErrorFilter(page);
  });

  test('can open save/load and create a manual save from an active turn', async ({ page }) => {
    await startSinglePlayerGame(page);
    await dismissTutorialOverlay(page, 'openLater');
    await openSaveLoadMenu(page);

    const saveLoadMenu = page.getByTestId('save-load-menu');
    const saveName = `Playwright Save ${Date.now()}`;

    await page.getByTestId('save-load-save-name-input').fill(saveName);
    await page.getByTestId('save-load-save-button').click();

    await expect(saveLoadMenu.getByText(saveName)).toBeVisible({ timeout: 15_000 });
  });

  test('end turn shows the handoff screen and resumes the next player turn', async ({ page }) => {
    await startSinglePlayerGame(page);
    await dismissTutorialOverlay(page, 'openLater');

    await cycleTurn(page);
    await expect(page.getByTestId('tutorial-overlay-dialog')).toBeHidden();
  });
});
