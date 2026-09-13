import { test, expect, Page } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows the VantaOS interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=VantaOS', { timeout: 15_000 });

    // Hero section
    await expect(page.locator('h1')).toContainText('Intelligent');

    // Navigation bar
    await expect(page.locator('nav')).toBeVisible();

    // Feature cards
    await expect(page.locator('h3').filter({ hasText: 'Cloud OS Web IDE' }).first()).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Omni-AI Assistant' }).first()).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Built-in Terminal' }).first()).toBeVisible();

    // CTA buttons
    await expect(page.locator('text=Get Started for Free')).toBeVisible();
    await expect(page.locator('nav').getByText('Sign In', { exact: true })).toBeVisible();

    // Navigation items
    await page.locator('nav').getByText('Cloud OS IDE').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=VantaOS Cloud IDE')).toBeVisible();
  });
});
