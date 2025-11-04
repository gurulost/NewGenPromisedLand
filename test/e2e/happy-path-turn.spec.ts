import { test, expect } from '@playwright/test';

test.describe('Happy Path Turn E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="start-game"]');
    
    // Wait for game to load
    await page.waitForSelector('[data-testid="player-hud"]');
  });

  test('complete turn with building construction', async ({ page }) => {
    // Record initial star count
    const initialStars = await page.locator('[data-testid="star-count"]').textContent();
    const starCount = parseInt(initialStars?.match(/\d+/)?.[0] || '0');
    
    // Open city panel
    await page.click('[data-testid="city-tile"]');
    await expect(page.locator('[data-testid="city-panel"]')).toBeVisible();
    
    // Navigate to Build tab
    await page.click('[data-testid="build-tab"]');
    
    // Find an affordable structure
    const affordableStructure = page.locator('[data-testid="structure-card"]:not([disabled])').first();
    await expect(affordableStructure).toBeVisible();
    
    // Get structure cost
    const costElement = affordableStructure.locator('[data-testid="structure-cost"]');
    const structureCost = parseInt(await costElement.textContent() || '0');
    
    // Verify player can afford it
    expect(starCount).toBeGreaterThanOrEqual(structureCost);
    
    // Build the structure
    await affordableStructure.click();
    
    // Confirm construction if needed
    const confirmButton = page.locator('[data-testid="confirm-build"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Close city panel
    await page.click('[data-testid="close-city-panel"]');
    
    // End turn
    await page.click('[data-testid="end-turn-button"]');
    
    // Wait for turn processing
    await page.waitForSelector('[data-testid="turn-processing"]', { state: 'hidden' });
    
    // Verify star count decreased
    const newStarsText = await page.locator('[data-testid="star-count"]').textContent();
    const newStarCount = parseInt(newStarsText?.match(/\d+/)?.[0] || '0');
    expect(newStarCount).toBe(starCount - structureCost);
    
    // Verify structure appears in city
    await page.click('[data-testid="city-tile"]');
    const structureList = page.locator('[data-testid="structure-list"]');
    await expect(structureList).toBeVisible();
    
    // Should show new structure
    const structures = structureList.locator('[data-testid="structure-item"]');
    const structureCount = await structures.count();
    expect(structureCount).toBeGreaterThan(0);
  });

  test('recruit unit and verify placement', async ({ page }) => {
    // Open city panel
    await page.click('[data-testid="city-tile"]');
    
    // Navigate to Recruit tab
    await page.click('[data-testid="recruit-tab"]');
    
    // Find affordable unit
    const affordableUnit = page.locator('[data-testid="unit-card"]:not([disabled])').first();
    await expect(affordableUnit).toBeVisible();
    
    // Record unit type
    const unitType = await affordableUnit.getAttribute('data-unit-type');
    
    // Recruit the unit
    await affordableUnit.click();
    
    // Close city panel
    await page.click('[data-testid="close-city-panel"]');
    
    // End turn
    await page.click('[data-testid="end-turn-button"]');
    await page.waitForSelector('[data-testid="turn-processing"]', { state: 'hidden' });
    
    // Verify unit appears on map
    const newUnit = page.locator(`[data-testid="unit-${unitType}"]`);
    await expect(newUnit).toBeVisible();
    
    // Unit should be selectable
    await newUnit.click();
    const unitPanel = page.locator('[data-testid="selected-unit-panel"]');
    await expect(unitPanel).toBeVisible();
  });

  test('multi-action turn sequence', async ({ page }) => {
    // Complex turn with multiple actions
    
    // 1. Move a unit
    await page.click('[data-testid="unit-warrior"]');
    const moveButton = page.locator('[data-testid="move-unit-button"]');
    if (await moveButton.isVisible()) {
      await moveButton.click();
      await page.click('[data-testid="valid-move-tile"]');
    }
    
    // 2. Research technology
    await page.click('[data-testid="research-button"]');
    const techPanel = page.locator('[data-testid="tech-panel"]');
    await expect(techPanel).toBeVisible();
    
    const availableTech = page.locator('[data-testid="tech-node"][data-status="available"]').first();
    if (await availableTech.isVisible()) {
      await availableTech.click();
      const researchButton = page.locator('[data-testid="start-research"]');
      await researchButton.click();
    }
    
    await page.keyboard.press('Escape'); // Close tech panel
    
    // 3. Build improvement
    await page.click('[data-testid="city-tile"]');
    await page.click('[data-testid="build-tab"]');
    
    const improvement = page.locator('[data-testid="improvement-card"]').first();
    if (await improvement.isVisible()) {
      await improvement.click();
    }
    
    await page.click('[data-testid="close-city-panel"]');
    
    // 4. End turn
    await page.click('[data-testid="end-turn-button"]');
    await page.waitForSelector('[data-testid="turn-processing"]', { state: 'hidden' });
    
    // Verify all actions took effect
    // Unit moved
    const movedUnit = page.locator('[data-testid="unit-warrior"]');
    await expect(movedUnit).toBeVisible();
    
    // Tech is researching
    await page.click('[data-testid="research-button"]');
    const researchingTech = page.locator('[data-testid="tech-node"][data-status="researching"]');
    await expect(researchingTech).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Improvement built
    await page.click('[data-testid="city-tile"]');
    const improvements = page.locator('[data-testid="improvement-list"]');
    await expect(improvements).toBeVisible();
  });

  test('turn validation and error handling', async ({ page }) => {
    // Test invalid actions are prevented
    
    // Try to build unaffordable structure
    await page.click('[data-testid="city-tile"]');
    await page.click('[data-testid="build-tab"]');
    
    const expensiveStructure = page.locator('[data-testid="structure-card"][disabled]').first();
    if (await expensiveStructure.isVisible()) {
      await expensiveStructure.click();
      
      // Should show error message or do nothing
      const errorMessage = page.locator('[data-testid="insufficient-resources"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText('insufficient');
      }
    }
    
    // Try to end turn without actions (should be allowed)
    await page.click('[data-testid="close-city-panel"]');
    await page.click('[data-testid="end-turn-button"]');
    
    // Should proceed to next turn
    await page.waitForSelector('[data-testid="turn-processing"]', { state: 'hidden' });
    
    // Turn should increment
    const turnCounter = page.locator('[data-testid="turn-counter"]');
    await expect(turnCounter).toContainText('2');
  });
});