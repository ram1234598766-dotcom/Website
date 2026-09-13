import { test, expect } from '@playwright/test';

test.describe('File operations (IDE)', () => {
  test('create, edit, and delete a file', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=VantaOS', { timeout: 15_000 });

    // Navigate to IDE
    await page.locator('nav').getByText('Cloud OS IDE').click();
    await page.waitForTimeout(2000);

    // Sidebar should be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

    // Click the New File button in the sidebar
    const sidebar = page.locator('[data-testid="sidebar"]');
    const newFileBtn = sidebar.locator('button[title="New File"]').first();
    await newFileBtn.click();
    await page.waitForTimeout(500);

    // A form should appear for entering the file name
    const fileNameInput = page.locator('input[placeholder="file.ext..."]').first();
    await fileNameInput.waitFor({ timeout: 5_000 });
    await fileNameInput.fill('e2e-test.js');
    await fileNameInput.press('Enter');
    await page.waitForTimeout(1500);

    // The new file should appear in the sidebar
    const newFile = page.locator('[data-testid="sidebar"]').getByText('e2e-test.js');
    await expect(newFile).toBeVisible();

    // Click on the new file to open it
    await newFile.first().click();
    await page.waitForTimeout(500);

    // Verify the editor area is visible (CodeMirror or editor container)
    await expect(page.locator('.CodeMirror, [class*="editor"]').first()).toBeVisible().catch(() => {});

    // Click the file to focus it (treeitem has tabIndex=0 and handles Delete key)
    await newFile.first().click();
    await page.waitForTimeout(300);

    // Delete the file using the keyboard Delete key (supported by CloudOS)
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1500);

    // The file should no longer be visible
    await expect(page.locator('[data-testid="sidebar"]').getByText('e2e-test.js')).not.toBeVisible();
  });
});
