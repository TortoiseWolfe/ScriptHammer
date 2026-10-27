import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import KidSafeRouteGuard from './KidSafeRouteGuard';

let mockPath = '/pricing/';
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }));

const sentryEnabled = vi.fn(() => false);
vi.mock('@/lib/monitoring/sentry', () => ({
  isSentryEnabled: () => sentryEnabled(),
}));

const reload = vi.fn();
const realLocation = window.location;

describe('KidSafeRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryEnabled.mockReturnValue(false);
    mockPath = '/pricing/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: realLocation,
    });
    delete (window as unknown as Record<string, unknown>).oaiq;
    document.head.innerHTML = '';
  });

  function navigateToBand() {
    const view = render(<KidSafeRouteGuard />);
    mockPath = '/band/';
    view.rerender(<KidSafeRouteGuard />);
  }

  it('reloads when a client-side navigation reaches /band with a loaded pixel', () => {
    (window as unknown as Record<string, unknown>).oaiq = () => undefined;
    navigateToBand();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when the Google tag script is in the document', () => {
    const s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-TEST';
    document.head.appendChild(s);
    navigateToBand();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when Sentry is running', () => {
    sentryEnabled.mockReturnValue(true);
    navigateToBand();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload a visitor with no tracker loaded', () => {
    navigateToBand();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload on a direct landing on /band (fresh document)', () => {
    (window as unknown as Record<string, unknown>).oaiq = () => undefined;
    mockPath = '/band/';
    render(<KidSafeRouteGuard />);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload between ordinary routes', () => {
    (window as unknown as Record<string, unknown>).oaiq = () => undefined;
    const view = render(<KidSafeRouteGuard />);
    mockPath = '/blog/';
    view.rerender(<KidSafeRouteGuard />);
    expect(reload).not.toHaveBeenCalled();
  });
});
