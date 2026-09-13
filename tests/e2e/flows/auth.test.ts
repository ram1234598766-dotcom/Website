import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('sign-in modal appears', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=VantaOS', { timeout: 15_000 });

    // Click Sign In button in navigation
    await page.locator('nav').getByText('Sign In', { exact: true }).click();
    await page.waitForTimeout(1000);

    // Auth modal should be visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Sign in');

    // Should have email and password inputs
    const emailInput = modal.locator('input[type="email"], input[name="email"], input').first();
    await expect(emailInput).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible();
  });

  test('sign-up modal switches to sign-up mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=VantaOS', { timeout: 15_000 });

    // Click Sign Up button
    await page.locator('nav').getByText('Sign Up', { exact: true }).click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Create Account');
  });
});
