import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ContactQueueSender from './ContactQueueSender';

expect.extend(toHaveNoViolations);

const queue = vi.hoisted(() => ({ getQueueSize: vi.fn() }));
vi.mock('@/utils/offline-queue', () => queue);

const sync = vi.hoisted(() => ({
  QUEUE_CHANGED_EVENT: 'contact-queue:changed',
  sendNextQueued: vi.fn(),
  discardNextQueued: vi.fn(),
}));
vi.mock('@/utils/background-sync', () => sync);

vi.mock('@/config/captcha.config', () => ({
  captchaConfig: { provider: 'turnstile', siteKey: '0xTEST', enabled: true },
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => (
    <button
      type="button"
      data-testid="turnstile-stub"
      onClick={() => onSuccess('tok')}
    >
      solve
    </button>
  ),
}));

describe('ContactQueueSender Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  // It is mounted in the ROOT LAYOUT, so with nothing saved it must add nothing
  // to the accessibility tree on any page.
  it('contributes nothing when nothing is saved', async () => {
    queue.getQueueSize.mockResolvedValue(0);
    const { container } = render(<ContactQueueSender />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('announces progress politely, with no violations', async () => {
    queue.getQueueSize.mockResolvedValue(1);
    const { container } = render(<ContactQueueSender />);
    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the not-sent card has no violations and 44px controls', async () => {
    queue.getQueueSize.mockResolvedValue(1);
    sync.sendNextQueued.mockResolvedValue({
      outcome: 'failed',
      message: 'Network error.',
      remaining: 1,
    });
    const { container } = render(<ContactQueueSender />);
    fireEvent.click(await screen.findByTestId('turnstile-stub'));
    const retry = await screen.findByRole('button', { name: /try again/i });

    expect(await axe(container)).toHaveNoViolations();
    for (const button of [
      retry,
      screen.getByRole('button', { name: /discard/i }),
    ]) {
      expect(button).toHaveClass('min-h-11');
    }
  });
});
