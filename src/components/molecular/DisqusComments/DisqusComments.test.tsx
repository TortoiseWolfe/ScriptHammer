import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DisqusComments from './DisqusComments';

vi.mock('next/script', () => {
  // Named, uppercase, and returned from the factory: an anonymous `default:`
  // arrow is not a React component as far as rules-of-hooks is concerned, and
  // calling useEffect inside it is a lint error.
  const MockScript = ({
    onLoad,
    id,
    src,
  }: {
    onLoad?: () => void;
    id?: string;
    src?: string;
  }) => {
    // Actually calls onLoad. scriptReady gates the disqus_config builder, so a
    // mock that only renders a tag leaves the component permanently
    // half-initialised and every config assertion reads `undefined`. Passing
    // onLoad as a `ref` is worse than useless: React calls it with the DOM node at
    // an unpredictable moment, which also makes the loading-state test race.
    React.useEffect(() => {
      onLoad?.();
    }, [onLoad]);
    return <script data-testid="disqus-script" data-id={id} data-src={src} />;
  };
  return { default: MockScript };
});

let dark = false;
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => ({ isDark: dark, hex: '4f46e5' }),
}));

const { getAccessibleEmbedColor } = vi.hoisted(() => ({
  getAccessibleEmbedColor: vi.fn(() => '#93c5fd'),
}));
vi.mock('@/utils/embed-theme', () => ({ getAccessibleEmbedColor }));

/** Capture observers so a test can decide when the component scrolls into view. */
let observers: Array<{ cb: IntersectionObserverCallback }>;

beforeEach(() => {
  dark = false;
  observers = [];
  getAccessibleEmbedColor.mockClear();
  window.IntersectionObserver = vi.fn((cb: IntersectionObserverCallback) => {
    const instance = {
      cb,
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    };
    observers.push(instance as never);
    return instance;
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  document
    .querySelectorAll('style[data-disqus-override]')
    .forEach((s) => s.remove());
  delete window.disqus_config;
});

const scrollIntoView = () =>
  observers[0].cb(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    null as never
  );

/** Read back what the component hands Disqus. */
const readConfig = () => {
  const ctx: { page: Record<string, unknown> } = { page: {} };
  window.disqus_config?.call(ctx);
  return ctx.page;
};

/** Comments stripped: the stylesheet's OWN comment mentions OKLCH. */
const injectedCss = () =>
  document
    .querySelector('style[data-disqus-override]')!
    .textContent!.replace(/\/\*[\s\S]*?\*\//g, '');

const PROPS = {
  slug: 'hello-world',
  title: 'Hello World',
  url: 'https://example.com/blog/hello-world',
  shortname: 'demo',
};

describe('DisqusComments', () => {
  it('renders NOTHING without a shortname', () => {
    const { container } = render(<DisqusComments {...PROPS} shortname="" />);
    // No Disqus account is the default for a fresh fork. An empty "Discussion"
    // heading over a dead thread is worse than silence.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the heading and thread container when configured', () => {
    render(<DisqusComments {...PROPS} />);
    expect(
      screen.getByRole('heading', { name: 'Discussion' })
    ).toBeInTheDocument();
    expect(document.getElementById('disqus_thread')).not.toBeNull();
  });

  it('does NOT load the third-party script until scrolled into view', () => {
    render(<DisqusComments {...PROPS} />);
    // Disqus is heavy and most readers never reach the comments; loading it on
    // mount spends that on every article view.
    expect(screen.queryByTestId('disqus-script')).toBeNull();
  });

  it('loads the script once the reader arrives', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    const script = await screen.findByTestId('disqus-script');
    expect(script.getAttribute('data-src')).toBe(
      'https://demo.disqus.com/embed.js'
    );
  });

  it('injects hex, never OKLCH, because Disqus embed.js cannot parse OKLCH', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() =>
      expect(
        document.querySelector('style[data-disqus-override]')
      ).not.toBeNull()
    );
    expect(injectedCss()).not.toMatch(/oklch/i);
    expect(injectedCss()).toContain('--disqus-link: #93c5fd');
  });

  it('follows the dark/light split on the thread surface', async () => {
    dark = true;
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() =>
      expect(
        document.querySelector('style[data-disqus-override]')
      ).not.toBeNull()
    );
    expect(injectedCss()).toContain('--disqus-bg: rgb(17, 24, 39)');
  });

  it('asks for an AA-legible link colour instead of using the theme primary blindly', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(getAccessibleEmbedColor).toHaveBeenCalled());
    // NFR-002 (#46): many DaisyUI primaries are pale accents that would be
    // illegible as link text on the thread background.
    expect(getAccessibleEmbedColor).toHaveBeenCalledWith(
      '#ffffff',
      '#2563eb',
      'p'
    );
  });

  it('picks the dark-theme link fallback on a dark theme', async () => {
    dark = true;
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(getAccessibleEmbedColor).toHaveBeenCalled());
    // blue-300 on the dark surface; the old blue-500 measured 3.68:1 and failed AA.
    expect(getAccessibleEmbedColor).toHaveBeenCalledWith(
      '#111827',
      '#93c5fd',
      'p'
    );
  });

  it('removes its injected style on unmount', async () => {
    const { unmount } = render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() =>
      expect(
        document.querySelector('style[data-disqus-override]')
      ).not.toBeNull()
    );
    unmount();
    // A global !important stylesheet left behind restyles whatever page the
    // reader navigates to next.
    expect(document.querySelector('style[data-disqus-override]')).toBeNull();
  });

  it('keys the thread on the slug, so a domain change does not orphan comments', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(window.disqus_config).toBeDefined());
    expect(readConfig().identifier).toBe('hello-world');
    expect(readConfig().title).toBe('Hello World');
  });

  it('tells Disqus which colour scheme to render in', async () => {
    dark = true;
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(window.disqus_config).toBeDefined());
    expect(readConfig().colorScheme).toBe('dark');
  });

  it('uses the URL it is GIVEN, in preference to its own fallback', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(window.disqus_config).toBeDefined());
    expect(readConfig().url).toBe('https://example.com/blog/hello-world');
  });

  it("falls back to THIS SITE's origin, not the template's (#1014)", async () => {
    // Stubbed to a fork-like origin ON PURPOSE. This container runs with
    // NEXT_PUBLIC_DEPLOY_URL=https://scripthammer.com, so asserting that string
    // would pass whether the value were resolved or hardcoded — which is exactly
    // how the previous version of this test stopped meaning anything the moment
    // the hardcoding was removed. A value no one would hardcode is what makes the
    // assertion discriminate.
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_URL', 'https://a-fork.example');
    render(<DisqusComments {...PROPS} url="/blog/hello-world" />);
    scrollIntoView();
    await waitFor(() => expect(window.disqus_config).toBeDefined());
    expect(readConfig().url).toBe('https://a-fork.example/blog/hello-world');
    vi.unstubAllEnvs();
  });

  it('prefers an absolute URL it is given over its own fallback', async () => {
    // The caller always supplies one in practice (blog/[slug]/page.tsx), so this
    // is the path that actually runs; the fallback above is the fork trap.
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_URL', 'https://a-fork.example');
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(window.disqus_config).toBeDefined());
    expect(readConfig().url).toBe('https://example.com/blog/hello-world');
    vi.unstubAllEnvs();
  });
});
