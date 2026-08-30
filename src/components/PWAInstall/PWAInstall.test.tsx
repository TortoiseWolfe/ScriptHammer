import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PWAInstall from './PWAInstall';

const { trackPWAEvent } = vi.hoisted(() => ({ trackPWAEvent: vi.fn() }));
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackPWAEvent }),
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

/**
 * Drive the browser's install prompt.
 *
 * The dispatch is wrapped in act() and awaited. Without that, React has not
 * re-rendered by the time the caller asserts, so every "stays hidden" test passes
 * on an empty DOM that is empty only because nothing has happened yet — it was
 * green with the dismissal check deleted.
 */
const firePrompt = async () => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
  await act(async () => {
    window.dispatchEvent(event);
  });
  return event;
};

const setSearch = (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
};

beforeEach(() => {
  trackPWAEvent.mockClear();
  localStorage.clear();
  setSearch('');
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('PWAInstall', () => {
  it('renders NOTHING until the browser offers an install prompt', async () => {
    const { container } = render(<PWAInstall />);
    // It sits in layout.tsx on every page. Showing an install pill to someone the
    // browser has not deemed installable is an advert, not a feature.
    expect(container).toBeEmptyDOMElement();
  });

  it('appears once the browser fires beforeinstallprompt', async () => {
    render(<PWAInstall />);
    await firePrompt();
    expect(
      await screen.findByRole('button', { name: 'Install' })
    ).toBeInTheDocument();
  });

  it('reports that the prompt became available', async () => {
    render(<PWAInstall />);
    await firePrompt();
    await waitFor(() =>
      expect(trackPWAEvent).toHaveBeenCalledWith('install_prompt_shown')
    );
  });

  it('stays hidden when the app is ALREADY installed', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    const { container } = render(<PWAInstall />);
    await firePrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('honours a stored dismissal even when the prompt arrives LATER', async () => {
    // #1012. This was an it.fails until the dismissal became state and the check
    // moved into the render guard. The prompt arriving AFTER mount is the case
    // that matters, because that is the ordinary order in a real browser — the
    // mount-only read was set straight back to true by the event handler.
    localStorage.setItem('pwa-install-dismissed', 'true');
    const { container } = render(<PWAInstall />);
    await firePrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a way to dismiss the prompt for good', async () => {
    const user = userEvent.setup();
    const { container } = render(<PWAInstall />);
    await firePrompt();

    await user.click(
      screen.getByRole('button', { name: "Don't show this again" })
    );

    // Gone now, and gone on the next page too.
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('true');
    expect(trackPWAEvent).toHaveBeenCalledWith('install_prompt_dismissed');
  });

  it('keeps dismiss and minimise as DIFFERENT actions', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    await firePrompt();

    // Minimising still collapses to the trigger and is still reversible; only
    // dismiss is permanent. The old single × did the first while reading as the
    // second, which is what left visitors stuck with it.
    await user.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(
      screen.getByRole('button', { name: 'Install Progressive Web App' })
    ).toBeInTheDocument();
    expect(localStorage.getItem('pwa-install-dismissed')).toBeNull();
  });

  it('lets ?pwa-reset=true bring back a dismissed prompt', async () => {
    setSearch('?pwa-reset=true');
    localStorage.setItem('pwa-install-dismissed', 'true');
    render(<PWAInstall />);
    await waitFor(() =>
      expect(localStorage.getItem('pwa-install-dismissed')).toBeNull()
    );
    // The state has to clear too, not just the key — otherwise the reset only
    // works on the NEXT page load, which is not what the flag says it does.
    await firePrompt();
    expect(
      await screen.findByRole('button', { name: 'Install' })
    ).toBeInTheDocument();
  });

  it('hands the browser prompt over on click, and records the outcome', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    const event = await firePrompt();
    await user.click(await screen.findByRole('button', { name: 'Install' }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(trackPWAEvent).toHaveBeenCalledWith('install_accepted')
    );
    // The pill goes away once the browser has taken over.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
    );
  });

  it('minimises to a single button, and remembers that', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    await firePrompt();
    await user.click(await screen.findByRole('button', { name: 'Minimize' }));

    expect(
      screen.getByRole('button', { name: 'Install Progressive Web App' })
    ).toBeInTheDocument();
    expect(localStorage.getItem('pwa-install-minimized')).toBe('true');
    expect(trackPWAEvent).toHaveBeenCalledWith('install_prompt_minimized');
  });

  it('expands again, and forgets the minimised state', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    await firePrompt();
    await user.click(await screen.findByRole('button', { name: 'Minimize' }));
    await user.click(
      screen.getByRole('button', { name: 'Install Progressive Web App' })
    );

    expect(
      await screen.findByRole('button', { name: 'Install' })
    ).toBeInTheDocument();
    expect(localStorage.getItem('pwa-install-minimized')).toBeNull();
    expect(trackPWAEvent).toHaveBeenCalledWith('install_prompt_expanded');
  });

  it('starts minimised when it was left that way', async () => {
    localStorage.setItem('pwa-install-minimized', 'true');
    render(<PWAInstall />);
    await firePrompt();
    expect(
      await screen.findByRole('button', { name: 'Install Progressive Web App' })
    ).toBeInTheDocument();
  });

  it('?pwa-debug=true forces the pill up without a browser prompt', async () => {
    // Someone built this escape hatch and never wrote the test that uses it.
    setSearch('?pwa-debug=true');
    render(<PWAInstall />);
    expect(
      await screen.findByRole('button', { name: 'Install' })
    ).toBeInTheDocument();
  });

  it('debug mode overrides a previous dismissal', async () => {
    setSearch('?pwa-debug=true');
    localStorage.setItem('pwa-install-dismissed', 'true');
    render(<PWAInstall />);
    expect(
      await screen.findByRole('button', { name: 'Install' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem('pwa-install-dismissed')).toBeNull()
    );
  });

  it('?pwa-reset=true clears the dismissal AND removes itself from the URL', async () => {
    setSearch('?pwa-reset=true');
    localStorage.setItem('pwa-install-dismissed', 'true');
    render(<PWAInstall />);
    await waitFor(() =>
      expect(localStorage.getItem('pwa-install-dismissed')).toBeNull()
    );
    // Otherwise every subsequent navigation re-resets it.
    expect(window.location.search).toBe('');
  });
});
