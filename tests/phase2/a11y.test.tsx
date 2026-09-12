/**
 * Phase 2 — Screen-reader accessibility (axe-core).
 *
 * Verifies that the file tree, editor area, and terminal panel expose the
 * correct ARIA roles and labels so assistive technology can navigate the IDE.
 *
 * Uses `axe-core` directly — runs axe against the rendered container and
 * asserts that the violations array is empty.
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';

// jsdom has no Worker — stub a minimal one before CloudOS mounts.
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  postMessage(_msg: unknown) {}
  terminate() { this.onmessage = null; this.onerror = null; }
}

vi.stubGlobal('Worker', MockWorker);

// react-virtuoso relies on real layout measurements which jsdom cannot provide.
// Replace it with a simple sequential renderer so tests can query tree items.
vi.mock('react-virtuoso', () => {
  return {
    Virtuoso: ({ totalCount, itemContent, ...rest }: any) => {
      const count = typeof totalCount === 'function' ? totalCount() : (totalCount || 0);
      const items = [];
      for (let i = 0; i < count; i++) {
        const child = itemContent(i);
        if (child) items.push(React.createElement('div', { key: i, 'data-index': i }, child));
      }
      return React.createElement('div', { 'data-testid': 'virtuoso-mock', ...rest }, items);
    },
  };
});

import { renderWithProviders } from './test-utils';
import CloudOS from '../../src/components/CloudOS';
import { waitFor } from '@testing-library/react';
import axe from 'axe-core';

async function runAxe(container: Element) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });
  return results.violations;
}

describe('CloudOS accessibility', () => {
  it('file tree has proper tree role and no axe violations', async () => {
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      const sidebar = container.querySelector('[data-testid="sidebar"]');
      if (!sidebar) throw new Error('sidebar not rendered');
      const items = sidebar.querySelectorAll('[role="treeitem"]');
      if (items.length === 0) throw new Error('no tree items');
    });

    const tree = container.querySelector('[role="tree"]');
    expect(tree).toBeTruthy();

    const items = container.querySelectorAll('[role="treeitem"]');
    expect(items.length).toBeGreaterThan(0);

    const violations = await runAxe(container);
    if (violations.length > 0) {
      const msg = 'Axe violations: ' + JSON.stringify(violations, null, 2);
      throw new Error(msg);
    }
    expect(violations).toHaveLength(0);
  });

  it('editor language selector has an accessible label and no violations', async () => {
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const langSelect = container.querySelector('#cloudos-language');
    expect(langSelect).toBeTruthy();

    const label = container.querySelector('label[for="cloudos-language"]');
    expect(label).toBeTruthy();
    expect(label?.textContent).toContain('Language');

    const violations = await runAxe(container);
    expect(violations).toHaveLength(0);
    if (violations.length > 0) {
      console.error('Axe violations:', JSON.stringify(violations, null, 2));
    }
  });

  it('terminal panel is discoverable and has no violations', async () => {
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const terminalBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => (btn.textContent ?? '').includes('Terminal')
    );
    expect(terminalBtn).toBeTruthy();

    const violations = await runAxe(container);
    expect(violations).toHaveLength(0);
    if (violations.length > 0) {
      console.error('Axe violations:', JSON.stringify(violations, null, 2));
    }
  });
});
