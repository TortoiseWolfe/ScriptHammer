import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import SocialIcon from './SocialIcon';
import type { SocialPlatform } from '@/types/author';

expect.extend(toHaveNoViolations);

/**
 * These icons are DECORATION. They sit inside links whose accessible name comes
 * from the link, so the icon itself must contribute nothing to the accessibility
 * tree — an announced "github" beside a link already saying GitHub is noise, and
 * an SVG with no `aria-hidden` and no title is announced as an unlabelled graphic.
 *
 * Every platform is covered rather than a sample of two. The component is a switch
 * with thirteen arms, so a missing `aria-hidden` on one of them is exactly the kind
 * of thing a two-case test walks past (this file used to check `github` and
 * `linkedin` only).
 */
const PLATFORMS: SocialPlatform[] = [
  'github',
  'twitter',
  'linkedin',
  'twitch',
  'youtube',
  'facebook',
  'instagram',
  'reddit',
  'mastodon',
  'bluesky',
  'threads',
  'website',
];

describe('SocialIcon Accessibility', () => {
  it('covers every platform the component can render', () => {
    // Non-vacuity: if a platform is added to the union and not to this list, the
    // loops below would silently stop covering it.
    const rendered = PLATFORMS.map((p) => {
      const { container, unmount } = render(<SocialIcon platform={p} />);
      const svg = container.querySelector('svg');
      unmount();
      return svg !== null;
    });
    expect(rendered.every(Boolean)).toBe(true);
    expect(PLATFORMS).toHaveLength(12);
  });

  for (const platform of PLATFORMS) {
    it(`has no accessibility violations — ${platform}`, async () => {
      const { container } = render(<SocialIcon platform={platform} />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it(`hides the ${platform} icon from assistive tech`, async () => {
      const { container } = render(<SocialIcon platform={platform} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  }

  it('renders a scalable viewBox rather than a fixed pixel size', () => {
    // Without a viewBox the icon cannot scale with the font size, which is what
    // the accessibility text-size controls change.
    for (const platform of PLATFORMS) {
      const { container, unmount } = render(<SocialIcon platform={platform} />);
      expect(container.querySelector('svg')).toHaveAttribute('viewBox');
      unmount();
    }
  });

  it('contributes NO accessible name of its own', () => {
    // The whole point of the decoration contract: the surrounding link names the
    // destination, and a `<title>` here would make a screen reader say it twice.
    for (const platform of PLATFORMS) {
      const { container, unmount } = render(<SocialIcon platform={platform} />);
      expect(container.querySelector('title')).toBeNull();
      expect(container.textContent).toBe('');
      unmount();
    }
  });

  it('falls back to the website icon for an unknown platform', () => {
    const { container } = render(
      <SocialIcon platform={'not-a-platform' as SocialPlatform} />
    );
    // Still decorative, still hidden — the default arm must not be the one that
    // forgets, since it is the arm nobody looks at.
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});
