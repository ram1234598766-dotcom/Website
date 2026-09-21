import { test, expect } from '@playwright/test';

test.describe('IDE view (CloudOS)', () => {
  test('renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Land directly on the IDE route
    await page.goto('/ide');
    await page.waitForSelector('text=VantaOS Cloud IDE', { timeout: 15_000 });

    // Main IDE container
    await expect(page.locator('text=VantaOS Cloud IDE')).toBeVisible();

    // Sidebar / file explorer
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

    // Default file should be present
    await expect(page.locator('[data-testid="sidebar"]').getByText('Untitled.js')).toBeVisible();

    // Toolbar buttons
    await expect(page.locator('text=Compile & Run')).toBeVisible();
    await expect(page.locator('text=Export Project')).toBeVisible();

    // No page errors
    const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('net::'));
    expect(realErrors).toEqual([]);
  });
});
