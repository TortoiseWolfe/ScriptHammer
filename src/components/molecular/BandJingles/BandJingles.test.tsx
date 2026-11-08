import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BandJingles from './BandJingles';
import { JINGLES, JINGLE_CLIENT_CREDIT } from '@/lib/band/jingles';
import { getAssetUrl } from '@/config/project.config';

const CREDIT_TEXT = JINGLE_CLIENT_CREDIT.map((segment) => segment.text).join('');

describe('BandJingles', () => {
  it('names the section and says what a jingle is', () => {
    render(<BandJingles />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Jingles' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A jingle is a short song about your business/)
    ).toBeInTheDocument();
  });

  it('shows the client credit line, with the product linked', () => {
    render(<BandJingles />);
    const credit = screen.getByTestId('jingle-client-credit');
    expect(credit).toHaveTextContent(CREDIT_TEXT);

    const link = within(credit).getByRole('link', { name: 'Estimify' });
    expect(link).toHaveAttribute('href', 'https://estimify.pro');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders one player and one download link for each take', () => {
    const { container } = render(<BandJingles />);
    const cards = screen.getAllByTestId('jingle-player');
    expect(cards).toHaveLength(JINGLES.length);

    const audios = container.querySelectorAll('audio');
    expect(audios).toHaveLength(JINGLES.length);

    for (const jingle of JINGLES) {
      const card = cards.find(
        (c) => c.getAttribute('data-jingle-id') === jingle.id
      )!;
      const audio = card.querySelector('audio')!;
      expect(audio).toHaveAttribute('controls');
      expect(audio).toHaveAttribute('preload', 'none');
      expect(audio).not.toHaveAttribute('autoplay');
      expect(audio).toHaveAttribute('src', getAssetUrl(jingle.src));

      const link = card.querySelector('a[download]')!;
      expect(link).toHaveAttribute('href', getAssetUrl(jingle.src));
      expect(link).toHaveAttribute('download', jingle.downloadName);
      expect(link).toHaveTextContent(jingle.downloadName);
    }
  });

  it('points the two takes at their own distinct files', () => {
    const { container } = render(<BandJingles />);
    const hrefs = Array.from(container.querySelectorAll('a[download]')).map(
      (a) => a.getAttribute('href')
    );
    expect(hrefs).toEqual([
      getAssetUrl('/band/audio/estimify-jingle-hook.mp3'),
      getAssetUrl('/band/audio/estimify-jingle-full.mp3'),
    ]);
    const names = Array.from(container.querySelectorAll('a[download]')).map(
      (a) => a.getAttribute('download')
    );
    expect(names).toEqual([
      'estimify-jingle-hook.mp3',
      'estimify-jingle-full.mp3',
    ]);
  });

  it('applies a custom className when provided', () => {
    const { container } = render(<BandJingles className="custom-test-class" />);
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
