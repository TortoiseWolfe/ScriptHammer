import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FontSizeControl, TextSettingsPanel } from './FontSizeControl';

expect.extend(toHaveNoViolations);

vi.mock('@/contexts/AccessibilityContext', () => ({
  useAccessibility: () => ({
    settings: { fontSize: 'medium', lineHeight: 'normal' },
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

describe('TextSettingsPanel Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<TextSettingsPanel />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the size buttons in full, not just "S" and "M"', () => {
    render(<TextSettingsPanel />);
    // The visible text is an abbreviation; `title` is what makes it intelligible.
    expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute(
      'title',
      'Small'
    );
    expect(screen.getByRole('button', { name: 'XL' })).toHaveAttribute(
      'title',
      'X large'
    );
  });

  it('gives the icon-only link a text alternative', () => {
    render(<TextSettingsPanel />);
    expect(
      screen.getByRole('link', { name: 'View all accessibility options' })
    ).toBeInTheDocument();
  });

  it('meets the 44px target on every control', () => {
    render(<TextSettingsPanel />);
    for (const el of [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link'),
    ]) {
      expect(el.className).toContain('min-h-11');
    }
  });
});

describe('FontSizeControl Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<FontSizeControl />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.fails('exposes its expanded state on the trigger', () => {
    // KNOWN GAP, deliberately recorded as a failing expectation rather than a
    // comment nobody reads. The trigger is a DaisyUI `:focus-within` <label>, so
    // it has no aria-expanded and Escape cannot close it without reopening —
    // stated in the component's own docblock and owned by #378's `Display ▾` work.
    //
    // it.fails means this goes RED the day someone fixes it, forcing them to
    // delete the marker. axe cannot see this: a <label tabindex=0> is not a
    // button as far as the rules are concerned, which is precisely the problem.
    render(<FontSizeControl />);
    expect(
      screen.getByTitle('Text size and spacing').getAttribute('aria-expanded')
    ).not.toBeNull();
  });
});
