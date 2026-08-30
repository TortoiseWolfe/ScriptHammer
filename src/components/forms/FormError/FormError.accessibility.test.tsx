import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormError } from './FormError';

expect.extend(toHaveNoViolations);

describe('FormError Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<FormError error="Email is required" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('contributes nothing to the accessibility tree when there is no error', async () => {
    // "Renders nothing" IS the contract here, so it is the assertion — the same shape
    // PaymentQueueSync uses for a mount-only component.
    const { container } = render(<FormError />);
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides the decorative icon from screen readers', () => {
    // The sentence beside it already says what went wrong; announcing the glyph would
    // repeat it, which is the #385 lesson.
    const { container } = render(<FormError error="Bad" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries the error text as its accessible name, not just as colour', () => {
    render(<FormError error="Password too short" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Password too short');
  });
});
