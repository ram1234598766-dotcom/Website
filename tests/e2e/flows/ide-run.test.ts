import { test, expect } from '@playwright/test';

test.describe('IDE Run button (CloudOS)', () => {
  test('Compile & Run executes the current file in the terminal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/ide');
    await page.waitForSelector('text=VantaOS Cloud IDE', { timeout: 15_000 });

    // Click the Run button — this should send "js <code>" to the terminal.
    // The button's accessible name is its aria-label, not the visible text.
    await page
      .getByRole('button', { name: 'Compile and run active file' })
      .click();

    // Terminal is mounted on demand; wait for it and for the output.
    const terminalArea = page.locator('.xterm-helper-textarea').first();
    await terminalArea.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    const combined =
      (await page.locator('.xterm-viewport').first().innerText().catch(() => '')) +
      (await page.locator('.xterm').first().innerText().catch(() => ''));
    expect(combined).toContain('Hello from VantaOS!');

    const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('net::'));
    expect(realErrors).toEqual([]);
  });
});