import { test, expect } from '@playwright/test';

test.describe('Modal Lifecycle E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Assuming game setup is required
    await page.click('[data-testid="start-game"]');
  });

  test('PlayerHUD modal lifecycle', async ({ page }) => {
    // Open PlayerHUD income details
    await page.click('[data-testid="income-breakdown-button"]');
    
    // Verify modal is open and focus-trapped
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Test focus trap
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test Esc key close
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    
    // Reopen and test B key close
    await page.click('[data-testid="income-breakdown-button"]');
    await expect(modal).toBeVisible();
    await page.keyboard.press('KeyB');
    await expect(modal).not.toBeVisible();
  });

  test('CityPanel modal lifecycle', async ({ page }) => {
    // Click on a city to open CityPanel
    await page.click('[data-testid="city-tile"]');
    
    const cityModal = page.locator('[data-testid="city-panel"]');
    await expect(cityModal).toBeVisible();
    
    // Test tab navigation within modal
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus stays within modal
    const focusedElement = page.locator(':focus');
    const isWithinModal = await focusedElement.locator('xpath=ancestor-or-self::*[@data-testid="city-panel"]').count();
    expect(isWithinModal).toBeGreaterThan(0);
    
    // Test close button
    await page.click('[data-testid="close-button"]');
    await expect(cityModal).not.toBeVisible();
  });

  test('TechPanel modal lifecycle', async ({ page }) => {
    // Open tech panel
    await page.click('[data-testid="research-button"]');
    
    const techModal = page.locator('[data-testid="tech-panel"]');
    await expect(techModal).toBeVisible();
    
    // Test gesture container interaction
    const gestureContainer = page.locator('[data-testid="gesture-container"]');
    await expect(gestureContainer).toBeVisible();
    
    // Test pinch zoom simulation with pointer events
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(150, 150);
    await page.mouse.up();
    
    // Modal should still be open after gestures
    await expect(techModal).toBeVisible();
    
    // Close with Esc
    await page.keyboard.press('Escape');
    await expect(techModal).not.toBeVisible();
  });

  test('CombatPanel modal lifecycle', async ({ page }) => {
    // Select a unit and trigger combat
    await page.click('[data-testid="unit-warrior"]');
    await page.click('[data-testid="attack-button"]');
    
    const combatModal = page.locator('[data-testid="combat-panel"]');
    await expect(combatModal).toBeVisible();
    
    // Test enemy selection
    const enemyList = page.locator('[data-testid="enemy-list"]');
    await expect(enemyList).toBeVisible();
    
    // Close combat panel
    await page.keyboard.press('KeyB');
    await expect(combatModal).not.toBeVisible();
  });

  test('mobile viewport modal behavior', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Open city panel on mobile
    await page.click('[data-testid="city-tile"]');
    
    const cityModal = page.locator('[data-testid="city-panel"]');
    await expect(cityModal).toBeVisible();
    
    // Verify responsive styling
    await expect(cityModal).toHaveClass(/max-w-\[95vw\]/);
    await expect(cityModal).toHaveClass(/max-h-\[90vh\]/);
    
    // Test touch interactions (simulated with click)
    await page.mouse.click(100, 100); // Tap inside modal
    await expect(cityModal).toBeVisible(); // Should stay open
    
    // Test swipe to close (if implemented)
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(200, 100);
    await page.mouse.up();
    
    // Close with touch (using close button)
    const closeButton = page.locator('[data-testid="close-button"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
    await expect(cityModal).not.toBeVisible();
  });

  test('keyboard navigation flow', async ({ page }) => {
    // Test full keyboard navigation workflow
    await page.keyboard.press('Tab'); // Focus first interactive element
    await page.keyboard.press('Enter'); // Activate
    
    // Navigate through modals with keyboard only
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify modal opened
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Navigate within modal
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Close with keyboard
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});