import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import CheckoutSummary from './CheckoutSummary';
import { landingPage } from '../__fixtures__/products';

describe('CheckoutSummary accessibility', () => {
  it('has no violations with a deposit', async () => {
    const { container } = render(
      <CheckoutSummary product={landingPage} amountDueNow={60000} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations while loading', async () => {
    const { container } = render(
      <CheckoutSummary product={null} amountDueNow={null} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses a description list so the figures are associated', () => {
    // A row of divs reads as loose text; dt/dd pairs each amount with its label.
    const { container } = render(
      <CheckoutSummary product={landingPage} amountDueNow={60000} />
    );
    expect(container.querySelectorAll('dt').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('dd').length).toBe(
      container.querySelectorAll('dt').length
    );
  });
});
