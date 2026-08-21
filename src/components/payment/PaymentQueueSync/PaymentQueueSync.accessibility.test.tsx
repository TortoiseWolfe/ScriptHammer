import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PaymentQueueSync from './PaymentQueueSync';

expect.extend(toHaveNoViolations);

vi.mock('@/lib/payments/connection-listener', () => ({
  startConnectionListener: () => () => {},
}));

describe('PaymentQueueSync Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<PaymentQueueSync />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('contributes nothing to the accessibility tree', () => {
    // This is the real a11y contract for a mount-only component, and it is worth
    // pinning: it is mounted in the ROOT LAYOUT, above the skip link. Anything it
    // rendered would land ahead of "Skip to main content" for every keyboard and
    // screen-reader user on every route — the #475 failure, repeated.
    const { container } = render(<PaymentQueueSync />);
    expect(container).toBeEmptyDOMElement();
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
  });
});
