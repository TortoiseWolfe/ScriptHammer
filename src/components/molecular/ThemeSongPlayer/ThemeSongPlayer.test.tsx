import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ThemeSongPlayer from './ThemeSongPlayer';
import { THEME_SONG, HOOK } from '@/lib/band/songs';
import { getAssetUrl } from '@/config/project.config';

describe('ThemeSongPlayer', () => {
  it('renders a native audio player that does not autoplay or preload', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('controls');
    expect(audio).toHaveAttribute('preload', 'none');
    expect(audio).not.toHaveAttribute('autoplay');
    expect(audio).toHaveAttribute('src', getAssetUrl(THEME_SONG.src));
  });

  it('offers a visible download link outside the audio element', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    const link = screen.getByRole('link', { name: /Download .*MP3/ });
    expect(link).toHaveAttribute('href', getAssetUrl(THEME_SONG.src));
    // A link inside <audio> is invisible to visitors and trips axe's
    // link-in-text-block rule, which pa11y counts as a failure.
    expect(container.querySelector('audio a')).toBeNull();
  });

  it('names the song and its length', () => {
    render(<ThemeSongPlayer song={HOOK} />);
    expect(
      screen.getByRole('heading', { level: 3, name: /The hook/ })
    ).toHaveTextContent(HOOK.length);
  });

  it('keeps the lyrics in a closed details element', () => {
    const { container } = render(<ThemeSongPlayer song={THEME_SONG} />);
    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
    expect(details?.querySelector('summary')).toHaveTextContent('Lyrics');
    expect(details?.textContent).toContain(THEME_SONG.lyrics[0].lines[0]);
  });

  it('shows every stanza label', () => {
    render(<ThemeSongPlayer song={THEME_SONG} />);
    for (const stanza of THEME_SONG.lyrics) {
      expect(screen.getAllByText(stanza.label).length).toBeGreaterThan(0);
    }
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ThemeSongPlayer song={HOOK} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
