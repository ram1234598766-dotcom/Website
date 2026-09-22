import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname, '..', '..', 'app');
const srcDir = path.resolve(__dirname, '..', '..', 'src');

function readPage(slug: string): string {
  return fs.readFileSync(path.join(appDir, slug, 'page.tsx'), 'utf8');
}

function readSubpages(slug: string): string {
  const dir = path.join(appDir, slug);
  let out = '';
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out += fs.readFileSync(path.join(dir, entry), 'utf8') + '\n';
  }
  return out;
}

function readSourceFile(rel: string): string {
  return fs.readFileSync(path.join(srcDir, rel), 'utf8');
}

const PAGES: Record<string, string> = {
  dashboard: readPage('dashboard'),
  network: readPage('network'),
  security: readPage('security'),
  settings: readPage('settings'),
  status: readPage('status'),
  email: readPage('email'),
  messaging: readPage('messaging'),
  notifications: readPage('notifications'),
  docs: readPage('docs'),
};

const RENDER_SURFACE: Record<string, string> = {
  'components/Home': readSourceFile(path.join('components', 'Home.tsx')),
  'components/AuthForm': readSourceFile(path.join('components', 'AuthForm.tsx')),
  'components/DriveManager': readSourceFile(path.join('components', 'DriveManager.tsx')),
  'lib/client': readSourceFile(path.join('lib', 'client.ts')),
  'lib/firebase': readSourceFile(path.join('lib', 'firebase.ts')),
  'lib/firestore': readSourceFile(path.join('lib', 'firestore.ts')),
  'lib/drive': readSourceFile(path.join('lib', 'drive.ts')),
  'lib/server/api-router': readSourceFile(path.join('lib', 'server', 'api-router.ts')),
};

const FORBIDDEN_LITERALS: Array<{ literal: string; note: string }> = [
  { literal: 'website-6e8b1', note: 'Firebase project id must not appear in rendered page source' },
  { literal: 'firebaseapp.com', note: 'Firebase auth domain must not appear in rendered page source' },
  { literal: 'wss://website.vasudevaya', note: 'no hardcoded WebSocket endpoint must exist' },
  { literal: 'new WebSocket(', note: 'no client WS connection may be created (correctness: no /status/stream route exists server-side)' },
  { literal: 'Firebase (website', note: 'settings provider label must not leak the project id' },
  { literal: 'Firebase ·', note: 'email account subtitle must not expose the provider name' },
  { literal: 'Connected (Firebase)', note: 'status/settings mode text must stay vendor-neutral' },
  { literal: 'Firebase Auth', note: 'security connection label must stay vendor-neutral' },
  { literal: 'Configure a Firebase', note: 'demo-mode banners must not name a provider' },
  { literal: 'signed-in Firebase account', note: 'network demo banner must not name a provider' },
  { literal: 'label: \'Firebase\'', note: 'network topology service label must stay vendor-neutral' },
];

const CLOUD_NEUTRAL_LITERALS: Array<{ literal: string; note: string }> = [
  { literal: 'Connect Firebase for Google/GitHub', note: 'AuthForm offline mode hint must stay vendor-neutral (scrubbed)' },
  { literal: 'requires Firebase. Use email sign-up', note: 'AuthForm OAuth banner must stay vendor-neutral (scrubbed)' },
  { literal: 'connect Firebase in your environment', note: 'AuthForm banner tail must stay vendor-neutral (scrubbed)' },
  { literal: 'Firebase OAuth if configured', note: 'Home GitHub sync card must stay vendor-neutral (scrubbed)' },
  { literal: "Firebase isn't connected", note: 'Home offline-first bullet must stay vendor-neutral (scrubbed)' },
  { literal: 'Firebase</strong> (optional)', note: 'Home feature chip row must stay vendor-neutral (scrubbed)' },
  { literal: 'Configure Firebase for user accounts', note: '/api/status tips must stay vendor-neutral (scrubbed)' },
  { literal: 'Firebase not configured', note: 'healthz detail must stay vendor-neutral (scrubbed)' },
  { literal: "detail: 'Firebase connected'", note: 'healthz healthy detail must stay vendor-neutral (scrubbed)' },
  { literal: 'Firebase is not configured', note: 'api-router 503 body must stay vendor-neutral (scrubbed)' },
  { literal: 'Missing firebaseToken', note: 'api-router auth errors must stay field-name neutral to users (scrubbed)' },
  { literal: 'Expired Firebase session', note: 'api-router auth errors must stay vendor-neutral (scrubbed)' },
  { literal: 'configured Firebase project', note: 'firestore error strings must stay vendor-neutral (scrubbed)' },
  { literal: 'No active Firebase session', note: 'client bind-GitHub error must stay vendor-neutral (scrubbed)' },
  { literal: 'OAuth sign-in requires a configured Firebase', note: 'client OAuth error must stay vendor-neutral (scrubbed)' },
  { literal: 'Firebase sign-in. Add it in Firebase console', note: 'firebase unauthorized-domain hint must stay vendor-neutral (scrubbed)' },
  { literal: 'not enabled in your Firebase project', note: 'firebase operation-not-allowed hint must stay vendor-neutral (scrubbed)' },
  { literal: 'Drive needs Firebase configured', note: 'DriveManager unconfigured state must stay vendor-neutral (scrubbed)' },
  { literal: 'Add NEXT_PUBLIC_FIREBASE_*', note: 'DriveManager instructions must not surface env vars (scrubbed)' },
  { literal: 'Set NEXT_PUBLIC_FIREBASE_*', note: 'thrown install errors must not surface env vars (scrubbed)' },
  { literal: 'Firebase connected', note: 'dashboard/settings connection text must stay vendor-neutral (scrubbed)' },
];

describe('Phase 5 — no hardcoded or mock data in UI pages', () => {
  it.each(FORBIDDEN_LITERALS)('app pages contain no "$literal" ($note)', ({ literal }) => {
    for (const [slug, source] of Object.entries(PAGES)) {
      expect(source, `app/${slug}/page.tsx`).not.toContain(literal);
    }
  });

  it.each(CLOUD_NEUTRAL_LITERALS)('render surface stays vendor-neutral: "$literal" ($note)', ({ literal }) => {
    for (const [slug, source] of Object.entries({ ...PAGES, ...RENDER_SURFACE })) {
      expect(source, slug).not.toContain(literal);
    }
  });

  it('dashboard reads real endpoints (/api/status, /api/models, /api/peers)', () => {
    const src = PAGES.dashboard;
    expect(src).toContain('fetch(\'/api/status\')');
    expect(src).toContain('fetch(\'/api/models\')');
    expect(src).toContain('fetch(\'/api/peers\')');
  });

  it('network reads real endpoints and real presence stream', () => {
    const src = PAGES.network;
    expect(src).toContain('fetch(\'/api/status\')');
    expect(src).toContain('subscribePresence');
    expect(src).toContain('from \'../../src/lib/firestore\'');
  });

  it('security reads verbose healthz and GitHub session endpoints', () => {
    const src = PAGES.security;
    expect(src).toContain('fetch(\'/api/healthz?verbose=true\')');
    expect(src).toContain('fetch(\'/api/gh/session\'');
  });

  it('status reads /api/status', () => {
    expect(PAGES.status).toContain('fetch(\'/api/status\')');
  });

  it('settings persists to real local state storage', () => {
    const src = PAGES.settings;
    expect(src).toContain("localStorage");
    expect(src).toContain("'vantaos-settings'");
  });

  it('email is backed by the real mailbox data source', () => {
    const src = PAGES.email;
    expect(src).toContain('subscribeMailbox');
    expect(src).toContain('from \'../../src/lib/firestore\'');
  });

  it('messaging is backed by real presence and inbox streams', () => {
    const src = PAGES.messaging;
    expect(src).toContain('subscribePresence');
    expect(src).toContain('subscribeDirectInbox');
    expect(src).toContain('from \'../../src/lib/firestore\'');
  });

  it('notifications are backed by the real notification stream', () => {
    const src = PAGES.notifications;
    expect(src).toContain('subscribeNotifications');
    expect(src).toContain('from \'../../src/lib/firestore\'');
  });

  it('api subpages contain no test-only mocks or seed data', () => {
    const src = readSubpages('api');
    expect(src).not.toMatch(/seedWithMock|seedData|fixtures?\.ts|mock[A-Z]/);
  });
});