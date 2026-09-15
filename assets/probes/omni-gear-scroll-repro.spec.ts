/**
 * FOCUSED REPRO — "dead" gear-grade buttons vs the sticky top nav (z-50, h-16).
 *
 * Mechanism: Navigation.tsx nav is `sticky top-0 z-50` (h-16). OmniAI's settings
 * gear sits ~38px below the card top (document y~96+38=134); CloudOS's
 * "Compile & Run" sits in the view header (root starts at doc y~96, button ~112).
 * On any scroll of the body (>~64px), content slides UNDER the sticky nav.
 * document.elementFromPoint() then returns the nav (or its Sign Up / nav buttons)
 * instead of the target → no :hover glow, clicks are swallowed by the nav.
 *
 * Test 1  sanity — fresh 1366x768, zero scroll: both buttons hit-test clean.
 * Test 2  CloudOS deterministic — open IDE fresh, scroll the real container until
 *         the Run button is inside y<64: expect top hit = <nav>.
 * Test 3  CloudOS user flow — scroll Home 150px, then open IDE from the nav
 *         (scroll persists): expect Run button off-screen/covered.
 * Test 4  OmniAI at 1093x614 (content overflows → page scrolls there) —
 *         open, scroll ~120px: expect gear covered by <nav> or its Sign Up.
 */

import { test } from '@playwright/test';

async function gotoHomeAndWait(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('nav').getByText('VantaOS').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .waitForSelector('[role="status"]', { state: 'detached', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
}

async function openMenu(page: any, item: string) {
  await page.locator('nav').getByText(item, { exact: false }).first().click();
  await page.waitForTimeout(1500);
}

async function hitScan(page: any, sel: string) {
  const loc = page.locator(sel).first();
  const box = await loc.boundingBox();
  if (!box) return { error: 'no boundingBox' };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const scan = await page.evaluate(({ px, py }) => {
    const el = document.elementFromPoint(px, py);
    const nav = document.querySelector('nav');
    return {
      hitTag: el ? el.tagName.toLowerCase() : null,
      hitClass: el ? String((el as any).className || '').slice(0, 200) : null,
      inNav: nav ? nav.contains(el) : false,
      hitRect: el
        ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }
        : null,
      scrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : -1,
    };
  }, { px: cx, py: cy });
  return { cx: Math.round(cx), cy: Math.round(cy), ...scan };
}

test.describe('dead-button vs sticky-nav repro', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 1366, height: 768 }, hasTouch: false });

  test('1) SANITY: fresh 1366 load, zero scroll → both buttons clean', async ({ page }) => {
    await gotoHomeAndWait(page);
    await openMenu(page, 'Omni-AI');
    let r = await hitScan(page, 'button[aria-label="Settings"]');
    console.log('fresh OmniAI gear ->', JSON.stringify(r), ' (expected hit=svg, inNav=false)');
    await page.locator('button[aria-label="Go to Home"]').click();
    await page.waitForTimeout(1200);
    await openMenu(page, 'Cloud OS IDE');
    r = await hitScan(page, 'button:has-text("Compile & Run")');
    console.log('fresh CloudOS run ->', JSON.stringify(r), ' (expected hit=span, inNav=false)');
  });

  test('2) CLOUDOS deterministic: scroll container until Run button under nav', async ({ page }) => {
    await gotoHomeAndWait(page);
    await openMenu(page, 'Cloud OS IDE');
    await page.evaluate(() => { if (document.scrollingElement) document.scrollingElement.scrollTop = 120; });
    await page.waitForTimeout(300);
    const r = await hitScan(page, 'button:has-text("Compile & Run")');
    console.log('CLOUDOS scrolled-120 run ->', JSON.stringify(r));
    const covered = r.inNav === true || r.hitTag === null;
    console.log('>>> CLOUDOS REPRO CONFIRMED (Run button covered/off-screen after scroll):', covered);
    test.info().annotations.push({ type: 'repro', description: covered ? 'CONFIRMED: Compile & Run covered/off-screen once body scrolled ≥ nav height' : 'not confirmed' });
  });

  test('3) CLOUDOS user flow: scroll Home 150px, then open IDE → Run button clears under nav', async ({ page }) => {
    await gotoHomeAndWait(page);
    await page.evaluate(() => window.scrollBy(0, 150));
    await page.waitForTimeout(300);
    await openMenu(page, 'Cloud OS IDE');
    const r = await hitScan(page, 'button:has-text("Compile & Run")');
    console.log('CLOUDOS via Home-scroll run ->', JSON.stringify(r));
    const covered = r.inNav === true || r.hitTag === null;
    console.log('>>> CLOUDOS USER-FLOW REPRO CONFIRMED:', covered);
    test.info().annotations.push({ type: 'repro', description: covered ? 'CONFIRMED via Home-scroll → IDE navigation' : 'not confirmed' });
  });

  test('4) OMNIAI at 1093x614 (content overflows): scroll then hit-test gear', async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 614 });
    await gotoHomeAndWait(page);
    await openMenu(page, 'Omni-AI');
    await page.evaluate(() => { if (document.scrollingElement) document.scrollingElement.scrollTop = 120; });
    await page.waitForTimeout(300);
    const r = await hitScan(page, 'button[aria-label="Settings"]');
    console.log('OMNIAI 1093 scrolled-120 gear ->', JSON.stringify(r));
    const covered = r.inNav === true;
    console.log('>>> OMNIAI REPRO CONFIRMED (gear covered by sticky nav after scroll):', covered);
    test.info().annotations.push({ type: 'repro', description: covered ? 'CONFIRMED at 1093x614: gear slides under sticky nav on scroll' : 'not confirmed' });
  });
});