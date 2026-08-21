import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentQueueSync from './PaymentQueueSync';

const stop = vi.fn();
const start = vi.fn(() => stop);

vi.mock('@/lib/payments/connection-listener', () => ({
  startConnectionListener: () => start(),
}));

describe('PaymentQueueSync', () => {
  beforeEach(() => {
    start.mockClear();
    stop.mockClear();
  });

  it('starts the connection listener on mount', () => {
    // The entire point of this component (#895). The listener existed for months
    // with zero callers, so "it starts" is the contract, not an implementation
    // detail.
    render(<PaymentQueueSync />);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('stops the listener on unmount', () => {
    // The listener is a module-level singleton holding a 30s interval plus two
    // window listeners. Leaking it across unmounts would accumulate intervals.
    const { unmount } = render(<PaymentQueueSync />);
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('renders no DOM at all', () => {
    // Mount-only, like StylesheetGuard. If this ever renders something it has
    // stopped being safe to drop into the root layout above the skip link.
    const { container } = render(<PaymentQueueSync />);
    expect(container).toBeEmptyDOMElement();
  });
});
