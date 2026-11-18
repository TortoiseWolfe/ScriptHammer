import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandSongs from './BandSongs';
import BandSongVote from './BandSongVote';

expect.extend(toHaveNoViolations);

const ENDPOINT = {
  url: 'https://example.supabase.co/rest/v1/rpc/cast_band_vote',
  key: 'k',
};

// `no-autoplay-audio` is switched off for the song list because axe answers it
// by loading every song's media, which jsdom cannot do: each run sat out axe's
// 10 s preload wait. The condition is asserted directly in the last test
// instead, the same way BandJingles does it.
const AXE_OPTIONS = { rules: { 'no-autoplay-audio': { enabled: false } } };

describe('BandSongs Accessibility', () => {
  it('has no violations with the rules closed', async () => {
    const { container } = render(<BandSongs />);
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });

  it('has no violations with the rules open', async () => {
    const { container } = render(<BandSongs />);
    container.querySelector('details')?.setAttribute('open', '');
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });

  it('has no violations with the vote buttons showing', async () => {
    const { container } = render(
      <BandSongVote songId="n05" title="The Night Watch" endpoint={ENDPOINT} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a labelled region with headings in order and a numbered list', () => {
    const { container } = render(<BandSongs />);
    expect(container.querySelector('section')).toHaveAttribute(
      'aria-labelledby',
      'songs'
    );
    expect(container.querySelector('h2#songs')).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('ol')).not.toBeNull();
  });

  it('never autoplays and gives every song player a label', () => {
    const { container } = render(<BandSongs />);
    const audios = container.querySelectorAll('audio');
    expect(audios.length).toBeGreaterThan(0);
    for (const audio of audios) {
      expect(audio).not.toHaveAttribute('autoplay');
      expect(audio).toHaveAttribute('controls');
      expect(audio).toHaveAttribute('aria-label');
    }
  });

  it('gives every cover alt text and every button a name', () => {
    const { container } = render(
      <BandSongVote songId="n05" title="The Night Watch" endpoint={ENDPOINT} />
    );
    for (const b of Array.from(container.querySelectorAll('button'))) {
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
    const list = render(<BandSongs />).container;
    for (const img of Array.from(list.querySelectorAll('img'))) {
      expect(img.getAttribute('alt')).toBeTruthy();
    }
  });
});
