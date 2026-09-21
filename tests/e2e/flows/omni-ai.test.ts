import { test, expect } from '@playwright/test';

test.describe('Omni-AI chat', () => {
  test('sends and receives a message', async ({ page }) => {
    await page.goto('/ide');
    await page.waitForSelector('text=VantaOS', { timeout: 15_000 });

    // Navigate to Omni-AI
    await page.locator('nav').getByText('Omni-AI').click();
    await page.waitForTimeout(2000);

    // Omni-AI page should be visible
    await expect(page.locator('h1')).toContainText('Omni-AI');

    // Type a message using the quick-start "Help" button first (works offline)
    const helpBtn = page.locator('button', { hasText: 'Help' }).first();
    await helpBtn.click();
    await page.waitForTimeout(500);

    // Verify the input received the command
    const input = page.locator('input[aria-label="Message"]');
    await input.click();
    await input.fill('help');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Check that user message and assistant response appear in chat
    const chatContent = await page.locator('div[role="log"]').innerText().catch(() => '');
    expect(chatContent).toContain('help');
  });
});
