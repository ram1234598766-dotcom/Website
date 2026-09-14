import { chromium } from '@playwright/test';
const BASE = process.argv[2] || 'http://localhost:3000';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForSelector('text=VantaOS', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 2500));

const report = await p.evaluate(() => {
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const h1 = document.querySelector('h1');
  const h2s = Array.from(document.querySelectorAll('h2')).map((x) => x.textContent.trim());
  const h3s = Array.from(document.querySelectorAll('h3')).map((x) => x.textContent.trim());
  const nav = document.querySelector('nav');
  const heroIsVisible = visible(h1);
  const gridItems = Array.from(document.querySelectorAll('.vanta-card')).length;
  const zeroSizeSections = Array.from(document.querySelectorAll('section,main,div'))
    .filter((el) => {
      if (!el.children.length) return false;
      const r = el.getBoundingClientRect();
      return r.height > 400 && (getComputedStyle(el).display === 'none' || r.height < 5);
    })
    .slice(0, 10)
    .map((el) => el.className || el.tagName);
  const imgs = Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src);
  return {
    h1: h1 ? h1.textContent.trim() : null,
    h1VisibleFloat: heroIsVisible,
    h2s,
    h3s,
    navItems: nav ? nav.querySelectorAll('button').length : 0,
    vantaCards: gridItems,
    zeroSizeSections,
    brokenImages: imgs,
    scrollHeight: document.body.scrollHeight,
  };
});

// also walk nav views and assert each renders a heading
const navLabels = ['Cloud OS IDE', 'Omni-AI', 'WebModels', 'Plugins'];
const viewChecks = {};
for (const label of navLabels) {
  await p.keyboard.press('Control+Home').catch(() => {});
  await p.locator('nav').getByText(label, { exact: true }).click().catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  viewChecks[label] = await p.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .filter((h) => h.getBoundingClientRect().height > 0)
      .map((h) => h.textContent.trim());
    const stuck = Array.from(document.querySelectorAll('*'))
      .filter((el) => { const t = (el.textContent||'').trim(); return /loading/i.test(t) && t.length < 120; })
      .slice(0,3).map((el) => el.textContent.trim());
    return { headings: headings.slice(0, 8), stuck };
  });
}
await b.close();
console.log(JSON.stringify({ report, viewChecks }, null, 2));
process.exit(0);