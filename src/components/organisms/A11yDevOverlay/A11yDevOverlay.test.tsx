import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Result } from 'axe-core';
import A11yDevOverlay from './A11yDevOverlay';

// The overlay's hook calls usePathname(); the live axe import is never reached in tests
// because violations are passed as a prop (controlled mode).
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

// Guard against any accidental real scan.
vi.mock('axe-core', () => ({
  default: { run: vi.fn().mockResolvedValue({ violations: [] }) },
}));

function makeViolation(overrides: Partial<Result> & { id: string }): Result {
  return {
    id: overrides.id,
    impact: overrides.impact ?? 'moderate',
    description: overrides.description ?? `${overrides.id} description`,
    help: overrides.help ?? `${overrides.id} help text`,
    helpUrl:
      overrides.helpUrl ??
      `https://dequeuniversity.com/rules/axe/${overrides.id}`,
    tags: overrides.tags ?? ['wcag2aa'],
    nodes: overrides.nodes ?? [
      {
        html: '<button></button>',
        target: ['#target'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Fix this',
      },
    ],
  };
}

const mockViolations: Result[] = [
  makeViolation({ id: 'button-name', impact: 'critical' }),
  makeViolation({ id: 'color-contrast', impact: 'serious' }),
  makeViolation({ id: 'label', impact: 'moderate' }),
  makeViolation({ id: 'region', impact: 'minor' }),
];

describe('A11yDevOverlay', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the collapsed badge with the violation count', () => {
    render(<A11yDevOverlay violations={mockViolations} />);
    const badge = screen.getByRole('button', {
      name: /accessibility violations: 4/i,
    });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('4');
  });

  it('colors the badge by worst impact (critical → error)', () => {
    render(
      <A11yDevOverlay
        violations={[makeViolation({ id: 'button-name', impact: 'critical' })]}
      />
    );
    const badge = screen.getByRole('button', {
      name: /accessibility violations: 1/i,
    });
    expect(badge).toHaveClass('badge-error');
  });

  it('expands to a panel showing rule id, impact, selector, and a help link', () => {
    render(<A11yDevOverlay violations={mockViolations} />);
    fireEvent.click(
      screen.getByRole('button', { name: /accessibility violations/i })
    );

    expect(
      screen.getByRole('region', { name: /accessibility violations panel/i })
    ).toBeInTheDocument();
    expect(screen.getByText('button-name')).toBeInTheDocument();

    const link = screen.getAllByRole('link', { name: /learn more/i })[0];
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('dequeuniversity.com')
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders a zero-state when there are no violations', () => {
    render(<A11yDevOverlay violations={[]} defaultExpanded />);
    expect(
      screen.getByText(/no accessibility violations/i)
    ).toBeInTheDocument();
  });

  it('filters by impact chip and searches by rule id', () => {
    render(<A11yDevOverlay violations={mockViolations} defaultExpanded />);

    // Filter to only "critical" — button-name should remain, color-contrast should not.
    fireEvent.click(screen.getByRole('button', { name: 'critical' }));
    expect(screen.getByText('button-name')).toBeInTheDocument();
    expect(screen.queryByText('color-contrast')).not.toBeInTheDocument();

    // Clear the filter, then search by rule id.
    fireEvent.click(screen.getByRole('button', { name: 'critical' }));
    fireEvent.change(
      screen.getByRole('searchbox', {
        name: /search violations by rule id/i,
      }),
      { target: { value: 'contrast' } }
    );
    expect(screen.getByText('color-contrast')).toBeInTheDocument();
    expect(screen.queryByText('button-name')).not.toBeInTheDocument();
  });

  it('highlights the target element on click and cleans up after the timeout', () => {
    vi.useFakeTimers();
    const target = document.createElement('button');
    target.id = 'target';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(
      <A11yDevOverlay
        violations={[makeViolation({ id: 'button-name', impact: 'critical' })]}
        defaultExpanded
      />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /highlight element for button-name/i,
      })
    );

    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target.style.outline).not.toBe('');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(target.style.outline).toBe('');

    target.remove();
    vi.useRealTimers();
  });

  it('applies a custom className', () => {
    render(
      <A11yDevOverlay
        violations={mockViolations}
        className="custom-test-class"
      />
    );
    expect(
      screen.getByRole('button', { name: /accessibility violations/i })
    ).toHaveClass('custom-test-class');
  });
});
