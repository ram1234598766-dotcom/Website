/**
 * RESEARCH PROBE (read-only) — do not treat as a pass/fail regression suite.
 *
 * Bug: two gear-style buttons ("OmniAI Settings gear" and CloudOS "Compile & Run")
 * are reported dead on ONE Windows laptop (no hover glow, no click), while working
 * on mobile and other machines. Classic cause: a transparent / desktop-width-only
 * overlay with a higher stacking context sitting on top of the button.
 *
 * For each button at LAPTOP (1366x768) and MOBILE (390x844), both with real mouse
 * (hasTouch:false), this probe records:
 *   - the button's bounding-box centre
 *   - document.elementFromPoint() at that centre (THE critical evidence)
 *   - 5 ancestors of the hit element (tag/class/id + computed position/zIndex/
 *     pointerEvents/opacity + rect + whether it contains the button)
 *   - whether the button's own computed hover style changes after page.mouse.move()
 *   - the button's own computed pointerEvents
 *   - a raw mouse click at the centre and whether the action fired
 *     (OmniAI: settings panel becomes visible; CloudOS: window 'terminal-send' counter)
 *   - a Playwright locator.click() fallback if the raw click did nothing
 *
 * The last test in the file prints a labelled LAPTOP vs MOBILE diff.
 */

import { test, Page, Locator } from '@playwright/test';

const LAPTOP = { width: 1366, height: 768 };
const MOBILE = { width: 390, height: 844 };

// Realistic Windows laptop CSS viewports: physical resolutions at 100/125/150 % scaling,
// plus common 1920x1080 @100% / @125%. Layout breakpoints are `lg` (1024) and `sm` (640),
// so scaled widths change the layout.
const VIEWPORTS = [
  { name: 'LAPTOP-1366x768', viewport: LAPTOP },
  { name: 'LAPTOP-100-1920x1080', viewport: { width: 1920, height: 1080 } },
  { name: 'LAPTOP-125-1093x614', viewport: { width: 1093, height: 614 } },
  { name: 'LAPTOP-125-1536x864', viewport: { width: 1229, height: 691 } },
  { name: 'LAPTOP-150-911x512', viewport: { width: 911, height: 512 } },
  { name: 'MOBILE-390x844', viewport: MOBILE },
];

const results: any[] = [];

/* ------------------------------------------------------------------ */
/* Navigation helpers (no auth needed — reuses existing flows' access) */
/* ------------------------------------------------------------------ */

async function navigateTo(app: Page, view: 'ide' | 'omni-ai', width: number) {
  await app.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait for the nav's "VantaOS" logo (visible once the App renders). Avoid
  // text=VantaOS — that also matches the hidden <title> element.
  await app.locator('nav').getByText('VantaOS').first().waitFor({ state: 'visible', timeout: 30_000 });
  // Wait for the App's <div role="status"> loading overlay to unhang
  await app
    .waitForSelector('[role="status"]', { state: 'detached', timeout: 30_000 })
    .catch(() => {});
  await app.waitForTimeout(800);

  if (width < 1024) {
    // Mobile: desktop nav is hidden (lg:flex); use the hamburger menu
    await app.getByRole('button', { name: /open menu/i }).click();
    await app.locator('#mobile-nav-menu').waitFor({ state: 'visible', timeout: 8_000 });
    await app
      .locator('#mobile-nav-menu')
      .getByText(view === 'ide' ? 'Cloud OS IDE' : 'Omni-AI', { exact: false })
      .first()
      .click();
    await app
      .locator('#mobile-nav-menu')
      .waitFor({ state: 'detached', timeout: 8_000 })
      .catch(() => {});
  } else {
    await app
      .locator('nav')
      .getByText(view === 'ide' ? 'Cloud OS IDE' : 'Omni-AI', { exact: false })
      .first()
      .click();
  }

  if (view === 'ide') {
    await app
      .locator('text=VantaOS Cloud IDE')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    // Terminal is open by default in CloudOS; wait for xterm so terminal-ready has fired
    await app
      .locator('.xterm-helper-textarea')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  } else {
    await app
      .getByRole('heading', { name: 'Omni-AI' })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {});
  }
  await app.waitForTimeout(1200);
}

/* ------------------------------------------------------------------ */
/* Evidence helpers                                                    */
/* ------------------------------------------------------------------ */

function pct(v: any): any {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  return v;
}

async function hitScan(app: Page, button: Locator, buttonLabel: string) {
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await app.waitForTimeout(200);

  const box = await button.boundingBox();
  if (!box) return { error: 'no boundingBox' };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const handle = await button.elementHandle();
  const hit = (await app.evaluate(
    ({ px, py, btn }) => {
      const btnEl = btn as Element;
      const describe = (el: Element | null): any => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const rawCls = (el as any).className;
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className:
            typeof rawCls === 'string' ? rawCls.slice(0, 240) : String(rawCls).slice(0, 240),
          position: cs.position,
          zIndex: cs.zIndex,
          pointerEvents: cs.pointerEvents,
          opacity: cs.opacity,
          display: cs.display,
          visibility: cs.visibility,
          rect: {
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          },
        };
      };

      const hitEl = document.elementFromPoint(px, py);
      const ancestors: any[] = [];
      let cur = hitEl ? hitEl.parentElement : null;
      let depth = 0;
      while (cur && depth < 6) {
        const info = describe(cur);
        if (info) info.containsButton = cur.contains(btnEl);
        ancestors.push(info);
        cur = cur.parentElement;
        depth += 1;
      }

      let btnAncestor = '-';
      if (hitEl) {
        let a: Element | null = hitEl;
        while (a) {
          if (a === btnEl || a.contains(btnEl)) {
            btnAncestor = a === btnEl ? 'btn' : a.tagName.toLowerCase() + (a.id ? '#' + a.id : '');
            break;
          }
          a = a.parentElement;
        }
      }

      return {
        hitEl: describe(hitEl),
        hitTag: hitEl ? hitEl.tagName.toLowerCase() : null,
        hitClass:
          hitEl && typeof (hitEl as any).className === 'string'
            ? String((hitEl as any).className).slice(0, 240)
            : null,
        topMatchesBtn:
          !!hitEl && (hitEl === btnEl || btnEl.contains(hitEl) || hitEl.contains(btnEl)),
        btnAncestor,
        ancestors,
      };
    },
    { px: pct(cx), py: pct(cy), btn: handle as any },
  )) as any;

  return {
    center: { x: pct(cx), y: pct(cy) },
    box: { x: pct(box.x), y: pct(box.y), w: pct(box.width), h: pct(box.height) },
    hit,
  };
}

const STYLE_KEYS = [
  'backgroundColor',
  'color',
  'boxShadow',
  'borderColor',
  'filter',
  'opacity',
  'transform',
] as const;

async function grabStyle(app: Page, button: Locator) {
  return button.evaluate((el) => {
    const cs = getComputedStyle(el);
    const o: any = {};
    for (const k of [
      'backgroundColor',
      'color',
      'boxShadow',
      'borderColor',
      'filter',
      'opacity',
      'transform',
    ]) {
      o[k] = (cs as any)[k];
    }
    o.hoverClass = (el as any).className || '';
    return o;
  });
}

async function hoverProbe(app: Page, button: Locator, cx: number, cy: number) {
  const before = await grabStyle(app, button);
  await app.mouse.move(cx, cy);
  await app.waitForTimeout(500);
  const after = await grabStyle(app, button);
  const changedKeys = STYLE_KEYS.filter((k) => before[k] !== after[k]);
  return { changedKeys, before, after };
}

async function clickProbe(app: Page, button: Locator, cx: number, cy: number, kind: 'omni' | 'ide') {
  const out: any = { rawClick: { ok: true, error: null }, panelOpenedAfterRaw: false, locatorClick: null };

  // OmniAI: count how the settings panel is visible
  const settingsPanel = app.locator('[role="radiogroup"][aria-label="AI Provider"]');

  if (kind === 'ide') {
    // Hook the window 'terminal-send' listener BEFORE clicking (as the component does not
    // expose the dispatch — we count what the button's onClick actually emits)
    await app.evaluate(() => {
      (window as any).__runProbe = { dispatches: 0, details: [] };
      if (!(window as any).__runProbeHooked) {
        window.addEventListener('terminal-send', (e: Event) => {
          if ((window as any).__runProbe) {
            (window as any).__runProbe.dispatches += 1;
            (window as any).__runProbe.details.push(String((e as CustomEvent).detail).slice(0, 120));
          }
        });
        (window as any).__runProbeHooked = true;
      }
    });
  }

  try {
    await app.mouse.click(cx, cy);
  } catch (e: any) {
    out.rawClick.ok = false;
    out.rawClick.error = String(e?.message || e).split('\n')[0];
  }
  await app.waitForTimeout(900);

  if (kind === 'omni') {
    out.panelOpenedAfterRaw = (await settingsPanel.count()) > 0;
  } else {
    const state = (await app.evaluate(() => (window as any).__runProbe)) as any;
    out.terminalSendAfterRaw = state ? state.dispatches : -1;
    out.lastDetail = state && state.details.length ? state.details[state.details.length - 1] : null;
  }

  // Fallback: standard locator.click() — if an overlay intercepts, Playwright throws.
  if ((kind === 'omni' && !out.panelOpenedAfterRaw) || (kind === 'ide' && !out.terminalSendAfterRaw)) {
    try {
      await button.click({ timeout: 5_000 });
      out.locatorClick = { ok: true, error: null };
    } catch (e: any) {
      out.locatorClick = { ok: false, error: String(e?.message || e).split('\n')[0] };
    }
    await app.waitForTimeout(900);
    if (kind === 'omni') {
      out.panelOpenedAfterLocator = (await settingsPanel.count()) > 0;
    } else {
      const state = (await app.evaluate(() => (window as any).__runProbe)) as any;
      out.terminalSendAfterLocator = state ? state.dispatches : -1;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Probe runner                                                        */
/* ------------------------------------------------------------------ */

async function probeOmni(app: Page, viewportName: string) {
  await navigateTo(app, 'omni-ai', app.viewportSize()!.width);
  const button = app.locator('button[aria-label="Settings"]').first();

  const label = `OmniAI Settings gear ${viewportName}`;
  console.log(`\n========== PROBE: ${label} ==========`);

  const scan = await hitScan(app, button, label);
  console.log('button boundingBox + center:', JSON.stringify(scan.center));
  console.log('elementFromPoint(cx,cy):', JSON.stringify(scan.hit?.hitEl, null, 2));
  console.log('topMatchesBtn:', scan.hit?.topMatchesBtn, '| btnAncestor:', scan.hit?.btnAncestor);
  console.log('5 ancestors from hit element:');
  (scan.hit?.ancestors || []).forEach((a: any, i: number) =>
    console.log(`  [${i}]`, JSON.stringify(a)),
  );

  const buttonPointerEvents = await button.evaluate((el) => getComputedStyle(el).pointerEvents);
  console.log('button own computed pointerEvents:', buttonPointerEvents);

  const hover = await hoverProbe(app, button, scan.center!.x, scan.center!.y);
  console.log('hoverGlow:', JSON.stringify(hover.changedKeys));
  if (hover.changedKeys.length) {
    console.log('  before:', JSON.stringify(hover.before));
    console.log('  after :', JSON.stringify(hover.after));
  }

  const click = await clickProbe(app, button, scan.center!.x, scan.center!.y, 'omni');
  console.log('clickProbe:', JSON.stringify(click, null, 2));

  results.push({ button: 'OmniAI settings gear', viewport: viewportName, ...scan, buttonPointerEvents, hover, click });
}

async function probeIde(app: Page, viewportName: string) {
  await navigateTo(app, 'ide', app.viewportSize()!.width);
  const button = app.getByRole('button', { name: 'Compile & Run' }).first();

  const label = `CloudOS Compile & Run ${viewportName}`;
  console.log(`\n========== PROBE: ${label} ==========`);

  const scan = await hitScan(app, button, label);
  console.log('button boundingBox + center:', JSON.stringify(scan.center));
  console.log('elementFromPoint(cx,cy):', JSON.stringify(scan.hit?.hitEl, null, 2));
  console.log('topMatchesBtn:', scan.hit?.topMatchesBtn, '| btnAncestor:', scan.hit?.btnAncestor);
  console.log('5 ancestors from hit element:');
  (scan.hit?.ancestors || []).forEach((a: any, i: number) =>
    console.log(`  [${i}]`, JSON.stringify(a)),
  );

  const buttonPointerEvents = await button.evaluate((el) => getComputedStyle(el).pointerEvents);
  console.log('button own computed pointerEvents:', buttonPointerEvents);

  const hover = await hoverProbe(app, button, scan.center!.x, scan.center!.y);
  console.log('hoverGlow:', JSON.stringify(hover.changedKeys));
  if (hover.changedKeys.length) {
    console.log('  before:', JSON.stringify(hover.before));
    console.log('  after :', JSON.stringify(hover.after));
  }

  const click = await clickProbe(app, button, scan.center!.x, scan.center!.y, 'ide');
  console.log('clickProbe:', JSON.stringify(click, null, 2));

  results.push({ button: 'CloudOS Compile & Run', viewport: viewportName, ...scan, buttonPointerEvents, hover, click });
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test.describe('laptop-buttons-probe', () => {
  test.describe.configure({ mode: 'serial' });

  for (const s of VIEWPORTS) {
    test.describe(`viewport ${s.name} ${s.viewport.width}x${s.viewport.height}`, () => {
      test.use({ viewport: s.viewport, hasTouch: false });

      test(`OmniAI settings gear`, async ({ page }) => {
        await probeOmni(page, s.name);
      });

      test(`CloudOS Compile & Run`, async ({ page }) => {
        await probeIde(page, s.name);
      });
    });
  }

  test('DIFF SUMMARY (all viewports)', async () => {
    console.log('\n\n########## DIFF SUMMARY ##########\n');
    const byButton: Record<string, any[]> = {};
    for (const r of results) {
      (byButton[r.button] ||= []).push(r);
    }
    for (const [btn, rows] of Object.entries(byButton)) {
      console.log(`\n----- ${btn} -----`);
      console.log(
        ['viewport', 'hitTag', 'hitClass(short)', 'hitZ', 'hitPE', 'hitOpacity', 'topMatchesBtn', 'hoverKeys', 'btnPE', 'actionFired'].join('\t'),
      );
      for (const r of rows) {
        const action =
          r.click?.terminalSendAfterRaw !== undefined
            ? `terminalSend=${r.click.terminalSendAfterRaw}`
            : `panel=${r.click.panelOpenedAfterRaw}`;
        console.log(
          [
            r.viewport,
            r.hit?.hitTag,
            (r.hit?.hitClass || '').slice(0, 60),
            r.hit?.hitEl?.zIndex,
            r.hit?.hitEl?.pointerEvents,
            r.hit?.hitEl?.opacity,
            String(r.hit?.topMatchesBtn),
            JSON.stringify(r.hover?.changedKeys || []),
            r.buttonPointerEvents,
            action,
          ].join('\t'),
        );
      }
      const laptops = rows.filter((r) => r.viewport.includes('LAPTOP'));
      const mob = rows.find((r) => r.viewport === 'MOBILE-390x844');
      const allWork = rows.every((r) =>
        r.click?.terminalSendAfterRaw !== undefined
          ? r.click.terminalSendAfterRaw > 0
          : r.click.panelOpenedAfterRaw === true,
      );
      console.log(`>>> Any viewport where the button FAILED to fire? ${!allWork ? 'YES (see rows)' : 'NO — all viewports fired the action'}`);
      if (mob) {
        for (const lap of laptops) {
          const lapWork = lap.click?.terminalSendAfterRaw !== undefined ? lap.click.terminalSendAfterRaw > 0 : lap.click.panelOpenedAfterRaw === true;
          if (lapWork !== (mob.click?.terminalSendAfterRaw !== undefined ? mob.click.terminalSendAfterRaw > 0 : mob.click.panelOpenedAfterRaw === true)) {
            console.log(`>>> LAPTOP=${lap.viewport} fired=${lapWork} vs MOBILE fired=true — behavioral diff!`);
          }
        }
        console.log('>>> laptop hit vs mobile hit same element?',
          laptops.every((lap) => lap.hit?.hitTag === mob.hit?.hitTag),
          '(tags match across all laptop widths)');
      }
    }
    console.log('\n########## END DIFF SUMMARY ##########\n');
  });
});