import { expect, test } from '@playwright/test';

import {
  attachExpectedPageErrorFilter,
  chooseFaction,
  gotoMainMenu,
  openSinglePlayerSetup,
  startSinglePlayerGame,
} from './helpers/gameSession';

test.describe('Main Menu and Setup Smoke', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    attachExpectedPageErrorFilter(page);
  });

  test('renders key main menu actions', async ({ page }) => {
    await gotoMainMenu(page);
    await expect(page.getByTestId('main-menu-single-player')).toBeVisible();
    await expect(page.getByTestId('main-menu-local-multiplayer')).toBeVisible();
    await expect(page.getByTestId('main-menu-online-multiplayer')).toBeVisible();
    await expect(page.getByTestId('main-menu-load-saved')).toBeVisible();
  });

  test('requires faction selection before start and enables start once valid', async ({ page }) => {
    await openSinglePlayerSetup(page);

    const startGameButton = page.getByTestId('player-setup-start-game');
    await expect(startGameButton).toBeDisabled();
    await expect(page.getByTestId('player-setup-roster-status')).toContainText(/Select factions for/i);

    await chooseFaction(page, 1, 'Nephites');
    await chooseFaction(page, 2, 'Lamanites');

    await expect(startGameButton).toBeEnabled();
    await expect(page.getByTestId('player-setup-ready-count')).toContainText('Ready 2/2');
  });

  test('starts a local game after valid setup', async ({ page }) => {
    await startSinglePlayerGame(page);
  });
});
