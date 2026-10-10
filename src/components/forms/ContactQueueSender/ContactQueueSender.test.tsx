import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ContactQueueSender from './ContactQueueSender';

/**
 * The sender for messages saved while offline (#1321). It renders nothing until there is
 * something to send, sends with a fresh token per message, and never drops a message that
 * failed. The visitor decides whether to try again or discard it.
 */

const queue = vi.hoisted(() => ({ getQueueSize: vi.fn() }));
vi.mock('@/utils/offline-queue', () => queue);

const sync = vi.hoisted(() => ({
  QUEUE_CHANGED_EVENT: 'contact-queue:changed',
  sendNextQueued: vi.fn(),
  discardNextQueued: vi.fn(),
}));
vi.mock('@/utils/background-sync', () => sync);

const mockCaptcha = vi.hoisted(() => ({
  captchaConfig: {
    provider: 'turnstile',
    siteKey: '0xTEST' as string | undefined,
    enabled: true,
  },
}));
vi.mock('@/config/captcha.config', () => mockCaptcha);

// Each click is one solved challenge, so it yields a fresh token. The ref is wired so
// the test can see the widget being reset: a real Turnstile issues no new token
// until it is.
let solved = 0;
const turnstileReset = vi.hoisted(() => vi.fn());
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({
    onSuccess,
    onError,
    ref,
  }: {
    onSuccess: (t: string) => void;
    onError: () => void;
    ref?: { current: { reset: () => void } | null };
  }) => {
    if (ref) ref.current = { reset: turnstileReset };
    return (
      <>
        <button
          type="button"
          data-testid="turnstile-stub"
          onClick={() => onSuccess(`tok-${++solved}`)}
        >
          solve
        </button>
        <button
          type="button"
          data-testid="turnstile-fail"
          onClick={() => onError()}
        >
          fail
        </button>
      </>
    );
  },
}));

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });

describe('ContactQueueSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    solved = 0;
    setOnline(true);
    mockCaptcha.captchaConfig = {
      provider: 'turnstile',
      siteKey: '0xTEST',
      enabled: true,
    };
    sync.discardNextQueued.mockResolvedValue(undefined);
  });

  afterEach(() => setOnline(true));

  it('renders nothing when nothing is saved', async () => {
    queue.getQueueSize.mockResolvedValue(0);
    const { container } = render(<ContactQueueSender />);
    await waitFor(() => expect(queue.getQueueSize).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('does not even look while offline', async () => {
    setOnline(false);
    queue.getQueueSize.mockResolvedValue(2);
    const { container } = render(<ContactQueueSender />);
    await new Promise((r) => setTimeout(r, 0));
    expect(queue.getQueueSize).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('sends a saved message with the token it gets, then says it was sent', async () => {
    queue.getQueueSize.mockResolvedValue(1);
    sync.sendNextQueued.mockResolvedValue({ outcome: 'sent', remaining: 0 });

    render(<ContactQueueSender />);
    expect(
      await screen.findByText(/sending the message you saved while offline/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('turnstile-stub'));

    await waitFor(() =>
      expect(sync.sendNextQueued).toHaveBeenCalledWith('tok-1')
    );
    expect(
      await screen.findByText(/your saved message was sent/i)
    ).toBeInTheDocument();
  });

  // Tokens are single-use, so each saved message needs its own.
  it('uses a fresh token for each of several saved messages', async () => {
    queue.getQueueSize.mockResolvedValue(2);
    sync.sendNextQueued
      .mockResolvedValueOnce({ outcome: 'sent', remaining: 1 })
      .mockResolvedValueOnce({ outcome: 'sent', remaining: 0 });

    render(<ContactQueueSender />);
    fireEvent.click(await screen.findByTestId('turnstile-stub'));
    await waitFor(() => expect(sync.sendNextQueued).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByTestId('turnstile-stub'));
    await waitFor(() => expect(sync.sendNextQueued).toHaveBeenCalledTimes(2));

    expect(sync.sendNextQueued.mock.calls.map((c) => c[0])).toEqual([
      'tok-1',
      'tok-2',
    ]);
    // The real widget only produces the second token because it was reset.
    expect(turnstileReset).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText(/your saved message was sent/i)
    ).toBeInTheDocument();
  });

  it('sends without a token when no site key is configured', async () => {
    mockCaptcha.captchaConfig = {
      provider: 'turnstile',
      siteKey: undefined,
      enabled: false,
    };
    queue.getQueueSize.mockResolvedValue(1);
    sync.sendNextQueued.mockResolvedValue({ outcome: 'sent', remaining: 0 });

    render(<ContactQueueSender />);
    await waitFor(() => expect(sync.sendNextQueued).toHaveBeenCalledWith(null));
  });

  // A blocked script or a network blip means no token is ever coming. Waiting for one
  // would leave "Sending…" on screen forever.
  it('says so when the spam check cannot load, instead of waiting forever', async () => {
    queue.getQueueSize.mockResolvedValue(1);
    render(<ContactQueueSender />);

    fireEvent.click(await screen.findByTestId('turnstile-fail'));

    expect(
      await screen.findByText(/spam check couldn.t load/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument();
    expect(sync.sendNextQueued).not.toHaveBeenCalled();
  });

  describe('when a saved message will not send', () => {
    beforeEach(() => {
      queue.getQueueSize.mockResolvedValue(1);
      sync.sendNextQueued.mockResolvedValueOnce({
        outcome: 'failed',
        message: 'Network error. Please check your connection and try again.',
        remaining: 1,
      });
    });

    it('says so, with the reason, and offers to try again', async () => {
      render(<ContactQueueSender />);
      fireEvent.click(await screen.findByTestId('turnstile-stub'));

      expect(
        await screen.findByText(/hasn.t been sent yet/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();

      sync.sendNextQueued.mockResolvedValueOnce({
        outcome: 'sent',
        remaining: 0,
      });
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      fireEvent.click(await screen.findByTestId('turnstile-stub'));

      await waitFor(() =>
        expect(sync.sendNextQueued).toHaveBeenLastCalledWith('tok-2')
      );
      expect(
        await screen.findByText(/your saved message was sent/i)
      ).toBeInTheDocument();
    });

    it('discards only when the visitor asks', async () => {
      const { container } = render(<ContactQueueSender />);
      fireEvent.click(await screen.findByTestId('turnstile-stub'));
      await screen.findByText(/hasn.t been sent yet/i);
      expect(sync.discardNextQueued).not.toHaveBeenCalled();

      queue.getQueueSize.mockResolvedValue(0);
      fireEvent.click(screen.getByRole('button', { name: /discard/i }));

      await waitFor(() => expect(sync.discardNextQueued).toHaveBeenCalled());
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });
});
