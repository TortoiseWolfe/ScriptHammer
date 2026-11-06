import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BandGauges, { BandGaugeDefs } from './BandGauges';
import BandSongs from '../BandSongs';
import rankingFile from '../../../../public/data/band-ranking.json';
import weightsFile from '../../../../public/data/band-weights.json';
import {
  playsPerDay,
  rankSongs,
  score,
  totalNet,
  type BandRankingFile,
  type BandWeights,
} from '@/lib/band/ranking';

const props = { score: 6, perDay: 6.2857, maxPerDay: 15, net: 2 };

describe('BandGauges', () => {
  it('writes every number the dials show as text', () => {
    render(<BandGauges {...props} />);
    expect(screen.getByTestId('gauge-score')).toHaveTextContent(
      'Score +6 on a scale from minus 15 to plus 15.'
    );
    expect(screen.getByTestId('gauge-per-day')).toHaveTextContent(
      '6.3 YouTube plays a day, on a scale from 0 to 15'
    );
    expect(screen.getByTestId('gauge-note')).toHaveTextContent('S 6 · net +2');
  });

  it('hides the drawings and leaves the text for screen readers', () => {
    const { container } = render(<BandGauges {...props} />);
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(
      screen.getByRole('group', { name: /score and plays a day/i })
    ).toBeTruthy();
  });

  it('turns the needle by the value', () => {
    const { container } = render(<BandGauges {...props} score={0} />);
    const first = container.querySelector('.band-needle') as SVGGElement;
    expect(first.style.getPropertyValue('--needle-angle')).toBe('0deg');
  });

  it('says so when the score is past the end of its scale', () => {
    render(<BandGauges {...props} score={40} />);
    expect(screen.getByTestId('gauge-score')).toHaveTextContent(
      'off the scale'
    );
  });

  it('shares one set of gradients and renders no focusable control', () => {
    const { container } = render(
      <>
        <BandGaugeDefs />
        <BandGauges {...props} />
      </>
    );
    expect(container.querySelectorAll('[id="bg-brass"]').length).toBe(1);
    expect(
      container.querySelectorAll('a, button, input, [tabindex]').length
    ).toBe(0);
  });
});

describe('BandGauges inside BandSongs', () => {
  const ranking = rankingFile as BandRankingFile;
  const weights = weightsFile as BandWeights;

  it('puts one pair of dials on every ranked song, matching the page numbers', () => {
    render(<BandSongs />);
    const rows = screen.getAllByTestId('band-song');
    const songs = rankSongs(ranking.songs, ranking.asOf, weights);
    expect(rows).toHaveLength(songs.length);
    rows.forEach((row, i) => {
      const s = songs[i];
      const note = row.querySelector('[data-testid="gauge-note"]');
      expect(note).toHaveTextContent(`S ${score(s, weights)}`);
      expect(note).toHaveTextContent(
        `net ${totalNet(s) > 0 ? '+' : ''}${totalNet(s)}`
      );
      expect(
        row.querySelector('[data-testid="gauge-per-day"]')
      ).toHaveTextContent(
        `${Math.round(playsPerDay(s, ranking.asOf, weights) * 10) / 10}/day`
      );
    });
  });

  it('draws the busiest song at the right-hand end of its a-day dial', () => {
    const { container } = render(<BandSongs />);
    const angles = Array.from(
      container.querySelectorAll<SVGGElement>('[data-testid="gauge-per-day"]')
    ).map((c) =>
      (
        c.closest('figure')!.querySelector('.band-needle') as SVGGElement
      ).style.getPropertyValue('--needle-angle')
    );
    expect(angles).toContain('135deg');
  });
});
