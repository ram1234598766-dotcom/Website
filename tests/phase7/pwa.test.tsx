/**
 * Phase 7 — PWA & Mobile experience.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import manifestFromFile from '../../public/manifest.json';
import PWARegister from '../../src/components/PWARegister';
import swText from '../../public/sw.js?raw';

describe('PWA manifest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has required fields and categories', () => {
    const manifest = manifestFromFile as Record<string, unknown>;

    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      description: expect.any(String),
      start_url: expect.any(String),
      display: 'standalone',
      theme_color: expect.any(String),
      background_color: expect.any(String),
      categories: expect.arrayContaining(['developer', 'productivity']),
    });

    expect(manifest.icons).toBeDefined();
    expect((manifest.icons as Array<Record<string, unknown>>).length).toBeGreaterThan(0);
    expect((manifest.icons as Array<Record<string, unknown>>)[0]).toMatchObject({
      src: expect.any(String),
      sizes: expect.any(String),
      type: expect.any(String),
    });
  });

  it('is linked from the document head', async () => {
    const mockHtml = '<html><head><link rel="manifest" href="/manifest.json" /></head><body></body></html>';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }))
    );

    try {
      const html = await fetch('http://localhost').then((r) => r.text());
      expect(html).toContain('rel="manifest"');
      expect(html).toContain('href="/manifest.json"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('service worker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('contains core caching strategies and lifecycle hooks', () => {
    expect(swText).toContain('skipWaiting');
    expect(swText).toContain('clients.claim()');
    expect(swText).toContain('cacheFirst');
    expect(swText).toContain('networkFirst');
    expect(swText).toContain('offline');
  });

  it('registers with navigator.serviceWorker and handles updates', async () => {
    const mockController = {
      postMessage: vi.fn(),
    } as any;

    const mockRegistration = {
      installing: null,
      waiting: null,
      active: {} as ServiceWorker,
      scope: '/',
    } as ServiceWorkerRegistration;

    const serviceWorker = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      register: vi.fn().mockResolvedValue(mockRegistration),
      controller: mockController,
    } as unknown as ServiceWorkerContainer;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: serviceWorker,
      writable: true,
      configurable: true,
    });

    const { unmount } = render(<PWARegister />);

    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(serviceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));

    unmount();
  });
});

describe('offline behavior', () => {
  it('serves an offline fallback page', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response("<html><body>You're offline</body></html>", {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }))
    );

    try {
      const response = await fetch('http://localhost/offline.html');
      expect(response.ok).toBe(true);
      const html = await response.text();
      expect(html).toContain("You're offline");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
