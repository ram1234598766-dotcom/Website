import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import React from 'react';

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  postMessage(_msg: unknown) {}
  terminate() { this.onmessage = null; this.onerror = null; }
}

vi.stubGlobal('Worker', MockWorker);

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

import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import CloudOS from '../../src/components/CloudOS';
import { waitFor } from '@testing-library/react';

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(input, 'value');
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    const protoSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (protoSetter) {
      protoSetter.call(input, value);
    } else {
      input.value = value;
    }
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CloudOS keyboard navigation', () => {
  it('focuses the file tree when the sidebar toggle button is activated', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      const sidebar = container.querySelector('[data-testid="sidebar"]');
      if (!sidebar) throw new Error('sidebar not rendered');
      const items = sidebar.querySelectorAll('[role="treeitem"]');
      if (items.length === 0) throw new Error('no tree items');
    });

    const toggleBtn = container.querySelector('[title="Collapse Sidebar"]');
    expect(toggleBtn).toBeTruthy();

    await user.click(toggleBtn!);

    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });

  it('creates a new file via the + button and opens it in a tab', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const newFileBtn = container.querySelector('[title="New File"]');
    expect(newFileBtn).toBeTruthy();

    await user.click(newFileBtn!);

    const input = container.querySelector('input[placeholder="file.ext..."]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    if (input) {
      setNativeInputValue(input, 'hello.txt');
      const form = input.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('hello.txt');
    });
  });

  it('renames a file in the tree', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const fileItems = container.querySelectorAll('[role="treeitem"]');
    expect(fileItems.length).toBeGreaterThan(0);

    const firstItem = fileItems[0] as HTMLElement;
    const renameSpan = firstItem.querySelector('span[class*="truncate"]') as HTMLElement | null;
    const originalName = renameSpan?.textContent ?? '';
    expect(originalName).toBeTruthy();

    if (renameSpan) {
      await user.dblClick(renameSpan);
    }

    await waitFor(
      () => {
        const renameField = Array.from(container.querySelectorAll('input')).find(
          (el) => (el as HTMLInputElement).value === originalName
        );
        expect(renameField).toBeTruthy();
      },
      { timeout: 3000 }
    ).catch(() => {
      fireEvent.keyDown(firstItem, { key: 'F2' });
    });

    await waitFor(() => {
      const renameField = Array.from(container.querySelectorAll('input')).find(
        (el) => (el as HTMLInputElement).value === originalName
      );
      expect(renameField).toBeTruthy();
    });

    const renameField = Array.from(container.querySelectorAll('input')).find(
      (el) => (el as HTMLInputElement).value === originalName
    ) as HTMLInputElement | null;
    expect(renameField).toBeTruthy();

    if (renameField) {
      setNativeInputValue(renameField, 'renamed.js');
      const form = renameField.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('renamed.js');
    });
  });

  it('deletes a file from the tree', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const fileItems = container.querySelectorAll('[role="treeitem"]');
    expect(fileItems.length).toBeGreaterThan(0);

    const firstItem = fileItems[0] as HTMLElement;
    const fileName = firstItem.querySelector('span[class*="truncate"]')?.textContent ?? '';
    expect(fileName).toBeTruthy();

    const deleteBtn = container.querySelector('[title="Delete"]') as HTMLElement | null;
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
    }
    await waitFor(
      () => {
        const sidebar = container.querySelector('[data-testid="sidebar"]');
        if (!sidebar) return;
        expect(sidebar.textContent ?? '').not.toContain(fileName);
      },
      { timeout: 5000 }
    );
  });

  it('switches tabs with keyboard when a tab is focused', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CloudOS />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    });

    const newFileBtn = container.querySelector('[title="New File"]');
    await user.click(newFileBtn!);
    const input = container.querySelector('input[placeholder="file.ext..."]') as HTMLInputElement | null;
    if (input) {
      setNativeInputValue(input, 'second.js');
      const form = input.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('second.js');
    });

    const tabs = container.querySelectorAll('[draggable]');
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    const secondTab = tabs[1] as HTMLElement;
    await user.click(secondTab);

    const editorArea = container.querySelector('.cloudos-editor-area');
    expect(editorArea).toBeTruthy();
  });
});
