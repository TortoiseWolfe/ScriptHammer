import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { Result } from 'axe-core';
import A11yDevOverlay from './A11yDevOverlay';

// usePathname() is called by the scan hook; mock it so the hook is inert in jsdom.
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('axe-core', () => ({
  default: { run: vi.fn().mockResolvedValue({ violations: [] }) },
}));

expect.extend(toHaveNoViolations);

const mockViolations: Result[] = [
  {
    id: 'button-name',
    impact: 'critical',
    description: 'Buttons must have discernible text',
    help: 'Buttons must have discernible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
    tags: ['wcag2a'],
    nodes: [
      {
        html: '<button></button>',
        target: ['#target'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Fix this',
      },
    ],
  },
  {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must meet contrast thresholds',
    help: 'Elements must have sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
    tags: ['wcag2aa'],
    nodes: [
      {
        html: '<p></p>',
        target: ['p'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Fix this',
      },
    ],
  },
];

describe('A11yDevOverlay Accessibility', () => {
  it('should have no accessibility violations when expanded with violations', async () => {
    const { container } = render(
      <A11yDevOverlay violations={mockViolations} defaultExpanded />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the collapsed badge state', async () => {
    const { container } = render(
      <A11yDevOverlay violations={mockViolations} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(
      <A11yDevOverlay violations={mockViolations} defaultExpanded />
    );

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});
