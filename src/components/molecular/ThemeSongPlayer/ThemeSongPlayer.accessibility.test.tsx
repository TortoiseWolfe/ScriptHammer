import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ThemeSongPlayer from './ThemeSongPlayer';
import { THEME_SONG } from '@/lib/band/songs';

expect.extend(toHaveNoViolations);

describe('ThemeSongPlayer Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    // `no-autoplay-audio` is switched off because axe answers it by loading the
    // media, which jsdom cannot do (it waits out a 10 s preload timeout). The
    // condition it checks is asserted directly instead, in the next test.
    const results = await axe(container, {
      rules: { 'no-autoplay-audio': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('never autoplays, so the no-autoplay-audio rule has nothing to flag', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    const audio = container.querySelector('audio');
    expect(audio).not.toHaveAttribute('autoplay');
    expect(audio).toHaveAttribute('controls');
  });

  it('labels the audio control and the region', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    expect(container.querySelector('audio')).toHaveAttribute('aria-label');
    const section = container.querySelector('section');
    const labelId = section?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(container.querySelector(`#${labelId}`)).toHaveTextContent(
      THEME_SONG.title
    );
  });

  it('puts the only interactive controls in a sensible order', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    const order = Array.from(
      container.querySelectorAll('audio, summary, a[href]')
    ).map((el) => el.tagName.toLowerCase());
    expect(order.indexOf('audio')).toBeLessThan(order.indexOf('summary'));
  });
});
