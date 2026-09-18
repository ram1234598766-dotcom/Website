import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ErrorBoundary from '../../src/components/ErrorBoundary';

const errorBoundaryPath = resolve(import.meta.dirname, '..', '..', 'src', 'components', 'ErrorBoundary.tsx');

class ThrowError extends React.Component {
  render() {
    throw new Error('Test error');
    return null;
  }
}

class ThrowSpecificError extends React.Component {
  render() {
    throw new Error('Specific test error');
    return null;
  }
}

/**
 * Phase 3 — Error Boundary tests.
 *
 * Verifies ErrorBoundary component:
 *   - Exists at src/components/ErrorBoundary.tsx
 *   - Renders children normally when no error
 *   - Catches errors and shows fallback UI
 *   - Try/reload button exists in fallback UI
 */

describe('ErrorBoundary', () => {
  beforeEach(() => {
    cleanup();
  });

  it('ErrorBoundary component file exists', () => {
    expect(existsSync(errorBoundaryPath), 'ErrorBoundary.tsx does not exist').toBe(true);
  });

  it('renders children normally when no error', () => {
    render(
      React.createElement(ErrorBoundary, null,
        React.createElement('div', { 'data-testid': 'child-1' }, 'Hello'),
      ),
    );
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders children with custom fallback when no error', () => {
    render(
      React.createElement(ErrorBoundary, { children: React.createElement('div', { 'data-testid': 'child-2' }, 'Hello'), fallback: React.createElement('div', { 'data-testid': 'custom-fallback' }, 'Custom') },
      ),
    );
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-fallback')).not.toBeInTheDocument();
  });

  it('catches errors and shows fallback UI', () => {
    render(
      React.createElement(ErrorBoundary, null,
        React.createElement(ThrowError),
      ),
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('fallback UI contains try/reload button', () => {
    render(
      React.createElement(ErrorBoundary, null,
        React.createElement(ThrowError),
      ),
    );
    const buttons = screen.getAllByRole('button');
    const hasActionButton = buttons.some(
      (btn) => (btn.textContent ?? '').match(/Try|Reload|Reset/i),
    );
    expect(hasActionButton).toBe(true);
  });

  it('fallback UI shows error details when error has message', () => {
    render(
      React.createElement(ErrorBoundary, null,
        React.createElement(ThrowSpecificError),
      ),
    );
    expect(screen.getByText('Specific test error')).toBeInTheDocument();
  });
});
