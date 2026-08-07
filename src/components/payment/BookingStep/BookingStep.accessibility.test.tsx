import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import BookingStep from './BookingStep';

describe('BookingStep accessibility', () => {
  it('has no violations', async () => {
    const { container } = render(
      <BookingStep orderId="o_1" buyerName="Rigo" buyerEmail="r@w.example" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces the paid confirmation to a screen reader', () => {
    render(<BookingStep orderId="o_1" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('labels its own section', () => {
    const { container } = render(<BookingStep orderId="o_1" />);
    expect(
      container.querySelector('section[aria-labelledby="booking-heading"]')
    ).toBeTruthy();
  });
});
