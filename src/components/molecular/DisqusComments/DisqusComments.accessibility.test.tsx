import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import DisqusComments from './DisqusComments';

expect.extend(toHaveNoViolations);

vi.mock('next/script', () => {
  const MockScript = ({ onLoad }: { onLoad?: () => void }) => {
    React.useEffect(() => {
      onLoad?.();
    }, [onLoad]);
    return <script data-testid="disqus-script" />;
  };
  return { default: MockScript };
});

let dark = false;
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => ({ isDark: dark, hex: '4f46e5' }),
}));
vi.mock('@/utils/embed-theme', () => ({
  getAccessibleEmbedColor: vi.fn(() => '#93c5fd'),
}));

let observers: Array<{ cb: IntersectionObserverCallback }>;
beforeEach(() => {
  dark = false;
  observers = [];
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

const PROPS = {
  slug: 'hello-world',
  title: 'Hello World',
  url: 'https://example.com/blog/hello-world',
  shortname: 'demo',
};

/**
 * The comment thread itself is Disqus's iframe and Disqus's accessibility — not
 * ours, and not visible to axe. Ours is the section heading, the loading state, and
 * the stylesheet this component injects into the page, which is the interesting
 * one: it uses `!important` on `#disqus_thread *`, so a wrong colour there is a
 * contrast failure we caused inside someone else's markup.
 */
describe('DisqusComments Accessibility', () => {
  it('has no violations before the thread loads', async () => {
    const { container } = render(<DisqusComments {...PROPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in the loading state', async () => {
    const { container } = render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('gives the section a heading so it can be navigated to', () => {
    render(<DisqusComments {...PROPS} />);
    // Comments are a destination — readers jump to them. Without a heading there
    // is nothing to jump to.
    expect(
      screen.getByRole('heading', { name: 'Discussion' })
    ).toBeInTheDocument();
  });

  it('says what is loading, not just that something is', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    expect(await screen.findByText('Loading comments...')).toBeInTheDocument();
  });

  it('never lets a link colour be decided by the theme alone', async () => {
    const { getAccessibleEmbedColor } = await import('@/utils/embed-theme');
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() => expect(getAccessibleEmbedColor).toHaveBeenCalled());
    // The helper's whole job is to reject a theme primary that fails AA against
    // the thread background and substitute a legible fallback (#46 NFR-002).
    // Calling it is the accessibility contract; the value it returns is its own
    // tested concern.
    expect(getAccessibleEmbedColor).toHaveBeenCalled();
  });

  it('does not force a colour onto thread CHILDREN, only the container', async () => {
    render(<DisqusComments {...PROPS} />);
    scrollIntoView();
    await waitFor(() =>
      expect(
        document.querySelector('style[data-disqus-override]')
      ).not.toBeNull()
    );
    const css = document
      .querySelector('style[data-disqus-override]')!
      .textContent!.replace(/\/\*[\s\S]*?\*\//g, '');
    // `color: inherit !important` on every descendant is deliberate: hardcoding a
    // colour there would flatten Disqus's own emphasis and error states, and we
    // cannot know their contrast pairs.
    expect(css).toContain('color: inherit !important');
  });
});
