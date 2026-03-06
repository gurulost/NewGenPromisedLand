import { expect, type Page } from '@playwright/test';

const ACTIVE_TURN_TIMEOUT_MS = 90_000;

export function attachExpectedPageErrorFilter(page: Page) {
  page.on('pageerror', (error) => {
    const message = String(error?.message ?? '');
    if (message.includes('Failed to list saves')) {
      return;
    }
    throw error;
  });
}

export async function gotoMainMenu(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Chronicles of the Promised Land/i })).toBeVisible();
}

export async function openSinglePlayerSetup(page: Page) {
  await gotoMainMenu(page);
  await page.getByTestId('main-menu-single-player').click();
  await expect(page.getByTestId('player-setup-screen')).toBeVisible();
}

export async function chooseFaction(page: Page, playerId: number | string, factionName: string) {
  const trigger = page.getByTestId(`player-setup-faction-${playerId}`);
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.getByRole('option', { name: factionName });
  await expect(option).toBeVisible();
  await option.click();
}

export async function advanceHandoffToActiveTurn(page: Page) {
  const endTurnButton = page.getByTestId('hud-end-turn-button');
  const startTurnButton = page.getByTestId('handoff-start-turn-button');
  const deadline = Date.now() + ACTIVE_TURN_TIMEOUT_MS;

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

  await expect(endTurnButton).toBeVisible({ timeout: ACTIVE_TURN_TIMEOUT_MS });
}

export async function startSinglePlayerGame(page: Page) {
  await openSinglePlayerSetup(page);
  await chooseFaction(page, 1, 'Nephites');
  await chooseFaction(page, 2, 'Lamanites');

  await expect(page.getByTestId('player-setup-ready-count')).toContainText('Ready 2/2');
  const startGameButton = page.getByTestId('player-setup-start-game');
  await expect(startGameButton).toBeEnabled();
  await startGameButton.click();

  await advanceHandoffToActiveTurn(page);
}

export async function dismissTutorialOverlay(
  page: Page,
  action: 'openLater' | 'primary' = 'openLater',
) {
  const dialog = page.getByTestId('tutorial-overlay-dialog');
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  const button = page.getByTestId(
    action === 'primary' ? 'tutorial-overlay-primary-action' : 'tutorial-overlay-open-later',
  );
  await expect(button).toBeVisible();
  await button.click();

  if (await dialog.isVisible().catch(() => false)) {
    await page.waitForTimeout(150);
    await button.click();
  }

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(250);
}

export async function openSaveLoadMenu(page: Page) {
  const desktopButton = page.getByTestId('utility-save-load-button');
  if (await desktopButton.isVisible().catch(() => false)) {
    await desktopButton.click();
  } else {
    const mobileMenuButton = page.getByTestId('mobile-hud-menu-button');
    await expect(mobileMenuButton).toBeVisible();
    await mobileMenuButton.click();
    const mobileSaveLoadButton = page.getByTestId('mobile-hud-save-load-button');
    await expect(mobileSaveLoadButton).toBeVisible();
    await mobileSaveLoadButton.click();
  }

  await expect(page.getByTestId('save-load-menu')).toBeVisible();
}

export async function cycleTurn(page: Page) {
  const endTurnButton = page.getByTestId('hud-end-turn-button');
  await expect(endTurnButton).toBeVisible();
  await endTurnButton.click();

  const startTurnButton = page.getByTestId('handoff-start-turn-button');
  await expect(startTurnButton).toBeVisible({ timeout: 15_000 });
  await startTurnButton.click();
  await expect(endTurnButton).toBeVisible({ timeout: ACTIVE_TURN_TIMEOUT_MS });
}
