/* Phase 1 audit: real-browser console / network / hydration / stuck-loading sweep.
   Usage: node scripts/phase1-audit.mjs [baseURL]
   BaseURL defaults to http://localhost:3000 (next dev). */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:3000';
const results = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  stuckLoading: [],
  brokenLinks: [],
};

function curView() {
  return new URL(BASE).pathname;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') results.consoleErrors.push({ view: curView(), text });
  if (type === 'warning' && /hydration/i.test(text)) results.consoleWarnings.push({ view: curView(), text });
});

page.on('pageerror', (err) => {
  results.pageErrors.push({ view: curView(), text: String(err.message || err) + '\n' + String(err.stack || '') });
});

page.on('requestfailed', (req) => {
  results.failedRequests.push({ view: curView(), url: req.url(), failure: req.failure()?.errorText || 'unknown' });
});

page.on('response', (res) => {
  const url = res.url();
  if (res.status() >= 400) {
    results.badResponses.push({ view: curView(), status: res.status(), url });
  }
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function screenshot(name) {
  await page.screenshot({ path: `scripts/_artifacts/${name}.png`, fullPage: true }).catch(() => {});
}

async function checkStuck() {
  const stuck = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    return els
      .filter((el) => {
        const t = (el.textContent || '').trim();
        return /loading/i.test(t) && t.length < 120;
      })
      .slice(0, 5)
      .map((el) => ({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 80) }));
  });
  if (stuck.length) results.stuckLoading.push({ view: curView(), after: 'final', stuck });
}

async function collectBrokenLinks() {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('/'))
  );
  const uniq = [...new Set(links)];
  for (const href of uniq) {
    try {
      const res = await page.request.get(BASE.replace(/\/$/, '') + href);
      if (res.status() >= 400 && href !== '/__nextjs_original-stack-frame') {
        results.brokenLinks.push({ view: curView(), href, status: res.status() });
      }
    } catch (e) {
      results.brokenLinks.push({ view: curView(), href, error: String(e.message || e) });
    }
  }
}

async function visit(label, fn) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('text=VantaOS', { timeout: 20000 }).catch(() => {});
  await pause(2500);
  await fn();
  await pause(3000);
  await checkStuck();
  await collectBrokenLinks();
}

// 1) Home load + scroll to bottom (hero, feature reveals, about, guides, footer)
await visit('home', async () => {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await screenshot('home');
});

// 2) Nav views
const nav = [
  ['ide', 'Cloud OS IDE'],
  ['omni-ai', 'Omni-AI'],
  ['models', 'WebModels'],
  ['plugins', 'Plugins'],
];

for (const [, label] of nav) {
  await visit(label, async () => {
    await page.locator('nav').getByText(label, { exact: true }).click().catch(() => {});
  });
}

// 3) Command palette -> less commonly used views (forum, learn, cloud, github, drive, privacy)
const paletteViews = ['Forum', 'Learn', 'Cloud OS', 'GitHub', 'Drive', 'Privacy', 'Security'];
for (const name of paletteViews) {
  await visit('palette:' + name, async () => {
    await page.keyboard.press('Control+k').catch(() => {});
    await pause(500);
    await page.keyboard.type(name.slice(0, Math.min(name.length, 12)), { delay: 30 }).catch(() => {});
    await pause(600);
    await page.keyboard.press('Enter').catch(() => {});
  });
}

// 4) Auth modal open/close
await visit('auth-modal', async () => {
  await page.locator('nav').getByText('Sign In', { exact: true }).click().catch(() => {});
  await pause(1000);
  await page.keyboard.press('Escape').catch(() => {});
});

await browser.close();

const clean = (arr) => arr.map((r) => ({ ...r, text: (r.text || '').slice(0, 500) }));

console.log('\n═══ PHASE 1 AUDIT RESULTS ═══');
console.log('\n— console errors (' + results.consoleErrors.length + ')');
console.log(clean(results.consoleErrors));
console.log('\n— hydration warnings (' + results.consoleWarnings.length + ')');
console.log(clean(results.consoleWarnings));
console.log('\n— page errors (' + results.pageErrors.length + ')');
console.log(results.pageErrors.map((r) => ({ view: r.view, text: r.text.slice(0, 900) })));
console.log('\n— failed requests (' + results.failedRequests.length + ')');
console.log(results.failedRequests);
console.log('\n— bad responses 4xx/5xx (' + results.badResponses.length + ')');
console.log(results.badResponses.filter((r) => !r.url.includes('firebase.auth') && !r.url.includes('googleapis')).slice(0, 60));
console.log('\n— stuck loading UI (' + results.stuckLoading.length + ')');
console.log(results.stuckLoading);
console.log('\n— broken links (' + results.brokenLinks.length + ')');
console.log(results.brokenLinks);
process.exit(0);