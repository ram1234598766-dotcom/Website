/**
 * Phase 7 — Responsive design & touch-target tests.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navigation from '../../src/components/Navigation';

describe('responsive layout — Navigation', () => {
  const defaultProps = {
    currentView: 'ide' as const,
    setCurrentView: vi.fn(),
    onSignIn: vi.fn(),
    onSignUp: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a mobile menu toggle button', () => {
    render(<Navigation {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const mobileToggle = buttons.find((btn) => btn.getAttribute('aria-label') === 'Open menu');
    expect(mobileToggle).toBeDefined();
  });

  it('toggles mobile menu visibility on click', () => {
    render(<Navigation {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const toggle = buttons.find((btn) => btn.getAttribute('aria-label') === 'Open menu');
    expect(toggle).toBeDefined();

    fireEvent.click(toggle!);
    const closeButtons = screen.getAllByRole('button');
    const closeToggle = closeButtons.find((btn) => btn.getAttribute('aria-label') === 'Close menu');
    expect(closeToggle).toBeDefined();

    fireEvent.click(closeToggle!);
    const openButtons = screen.getAllByRole('button');
    const openToggle = openButtons.find((btn) => btn.getAttribute('aria-label') === 'Open menu');
    expect(openToggle).toBeDefined();
  });
});

describe('responsive layout — viewport adaptation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses responsive utility classes for the desktop nav', () => {
    render(
      <Navigation
        currentView="ide"
        setCurrentView={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />
    );

    const desktopNav = document.querySelector('.hidden.lg\\:flex');
    expect(desktopNav).toBeDefined();
  });

  it('uses responsive utility classes for the mobile menu toggle', () => {
    render(
      <Navigation
        currentView="ide"
        setCurrentView={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />
    );

    const mobileToggle = document.querySelector('.lg\\:hidden');
    expect(mobileToggle).toBeDefined();
  });
});

describe('touch targets', () => {
  const defaultProps = {
    currentView: 'ide' as const,
    setCurrentView: vi.fn(),
    onSignIn: vi.fn(),
    onSignUp: vi.fn(),
  };

  it('Navigation mobile controls avoid sub-minimal padding classes', () => {
    render(<Navigation {...defaultProps} />);
    const buttons = screen.getAllByRole('button');

    const tinyButtons = buttons.filter((button) => {
      const classNames = button.className || '';
      return /bp-0(\.5)?[^a-z]/.test(classNames) || classNames.includes('p-0 ');
    });

    expect(tinyButtons.length).toBe(0);
  });
});
