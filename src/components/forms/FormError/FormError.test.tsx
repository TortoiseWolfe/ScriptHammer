import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormError } from './FormError';

describe('FormError', () => {
  it('renders NOTHING when there is no error', () => {
    // The early return at FormError.tsx:38 is the component's most-exercised branch —
    // every clean field renders this one.
    const { container } = render(<FormError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message when there is one', () => {
    render(<FormError error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('announces as an alert so a screen reader hears it without moving focus', () => {
    render(<FormError error="Email is required" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });

  it('accepts the id that a field points its aria-describedby at', () => {
    render(<FormError error="Bad" id="email-error" />);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'email-error');
  });

  it('can drop the animation', () => {
    const { rerender } = render(<FormError error="Bad" animate />);
    expect(screen.getByRole('alert').className).toMatch(/animate-in/);
    rerender(<FormError error="Bad" animate={false} />);
    expect(screen.getByRole('alert').className).not.toMatch(/animate-in/);
  });
});
