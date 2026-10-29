import React from 'react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import BandSongs from './BandSongs';
import weightsFile from '../../../../public/data/band-weights.json';
import rankingFile from '../../../../public/data/band-ranking.json';
import { PRIVACY_LINE } from '@/lib/band/vote';
import type { BandWeights } from '@/lib/band/ranking';

const W = weightsFile as BandWeights;
const text = (el: HTMLElement) =>
  el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('BandSongs', () => {
  it("lists every song once, in the file's ranking order", () => {
    render(<BandSongs />);
    const rows = screen.getAllByTestId('band-song');
    expect(rows.map((r) => r.getAttribute('data-song-id'))).toEqual(
      rankingFile.songs.map((s) => s.id)
    );
  });

  it('gives each row a cover with alt text, a rank, a Short link and a Twitch link', () => {
    render(<BandSongs />);
    const first = screen.getAllByTestId('band-song')[0];
    const song = rankingFile.songs[0];
    expect(
      within(first).getByAltText(`Cover for ${song.title}`)
    ).toBeInTheDocument();
    expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent(
      `Number 1: ${song.title}`
    );
    expect(
      within(first).getByRole('link', { name: /ScriptHammer on Twitch/ })
    ).toHaveAttribute('href', 'https://twitch.tv/scripthammer');
    for (const row of screen.getAllByTestId('band-song')) {
      const id = row.getAttribute('data-song-id')!;
      const s = rankingFile.songs.find((x) => x.id === id)!;
      const link = within(row).queryByRole('link', {
        name: /Watch the Short on YouTube/,
      });
      if (s.shortUrl) expect(link).toHaveAttribute('href', s.shortUrl);
      else expect(link).toBeNull();
    }
  });

  it('uses plain links to YouTube and Twitch, no embeds and no scripts', () => {
    const { container } = render(<BandSongs />);
    expect(
      container.querySelector('iframe, script, embed, object, video, audio')
    ).toBeNull();
  });

  it('says the songs were made with AI and when the numbers were taken', () => {
    render(<BandSongs />);
    expect(screen.getByText(/made with an AI music model/)).toBeInTheDocument();
    expect(screen.getByTestId('counts-as-of')).toHaveTextContent('Wed 28 Oct');
  });

  it('shows the privacy line word for word, above the list and in the rules', () => {
    render(<BandSongs />);
    expect(screen.getAllByText(PRIVACY_LINE).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('privacy-line')).toHaveTextContent(PRIVACY_LINE);
  });

  it('marks a recently posted song New and leaves an old one plain', () => {
    const base = rankingFile.songs[0];
    render(
      <BandSongs
        ranking={{
          asOf: '2026-10-29',
          songs: [
            { ...base, id: 'fresh', title: 'Fresh One', posted: '2026-10-27' },
            { ...base, id: 'aged', title: 'Aged One', posted: '2026-08-01' },
          ],
        }}
      />
    );
    const rows = screen.getAllByTestId('band-song');
    const fresh = rows.find((r) => r.getAttribute('data-song-id') === 'fresh')!;
    const aged = rows.find((r) => r.getAttribute('data-song-id') === 'aged')!;
    expect(fresh).toHaveTextContent('New, 2 days old');
    expect(aged).not.toHaveTextContent('New,');
  });
});

describe('How the score works', () => {
  it('is closed by default and names every input', () => {
    render(<BandSongs />);
    const box = screen.getByTestId('score-rules') as HTMLDetailsElement;
    expect(box.open).toBe(false);
    expect(box).toHaveTextContent('Votes on this page');
    expect(box).toHaveTextContent('Twitch chat votes');
    expect(box).toHaveTextContent('YouTube likes and dislikes');
    expect(box).toHaveTextContent("owner's review votes");
  });

  it('prints the weights the file holds', () => {
    render(<BandSongs />);
    const list = text(screen.getByTestId('score-weights'));
    expect(list).toContain(`Site votes: ${W.site}`);
    expect(list).toContain(`Twitch chat votes: ${W.twitch}`);
    expect(list).toContain(`YouTube likes and dislikes: ${W.youtube}`);
    expect(list).toContain(`review votes: ${W.owner}`);
    expect(list).toContain(`${W.siteCap}`);
    expect(text(screen.getByTestId('score-version'))).toBe(
      `Version ${W.version}, ${W.dateLabel}.`
    );
    expect(text(screen.getByTestId('score-formula'))).toContain(
      `S = ${W.site} × site net (never more than ${W.siteCap} either way) + ${W.twitch} × Twitch net + ${W.youtube} × YouTube net + ${W.owner} ×`
    );
  });

  it('follows the file: change a weight and the text changes with it', () => {
    const changed: BandWeights = {
      ...W,
      version: 7,
      dateLabel: '1 Jan 2027',
      site: 2,
      twitch: 5,
      youtube: 4,
      owner: 0,
      siteCap: 40,
    };
    render(<BandSongs weights={changed} />);
    const list = text(screen.getByTestId('score-weights'));
    expect(list).toContain('Site votes: 2');
    expect(list).toContain('Twitch chat votes: 5');
    expect(list).toContain('YouTube likes and dislikes: 4');
    expect(list).toContain('review votes: 0');
    expect(list).toContain('40');
    expect(text(screen.getByTestId('score-version'))).toBe(
      'Version 7, 1 Jan 2027.'
    );
  });

  it('lists the change log, newest first, from the file', () => {
    render(<BandSongs />);
    const items = within(screen.getByTestId('score-changelog')).getAllByRole(
      'listitem'
    );
    expect(items).toHaveLength(W.changelog.length);
    expect(items[0]).toHaveTextContent(`version ${W.changelog[0].version}`);
  });

  it('works the example through the real rule: 5 a day against 10 a day', () => {
    render(<BandSongs />);
    const ex = text(screen.getByTestId('score-example'));
    expect(ex).toContain('300 plays over 60 days (5 a day)');
    expect(ex).toContain('30 plays over 3 days (10 a day)');
    expect(ex).toContain(`S = ${5 * W.site}`);
    expect(ex).toContain('The newer one is listed first');
  });
});

describe('the song list and the database agree', () => {
  it('has the same song ids in the migration as in band-ranking.json', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20251006_complete_monolithic_setup.sql'
      ),
      'utf8'
    );
    const m = sql.match(/c_song_ids CONSTANT TEXT\[\] := ARRAY\[([^\]]+)\];/);
    expect(m).not.toBeNull();
    const inSql = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect(inSql).toEqual(rankingFile.songs.map((s) => s.id).sort());
  });
});

describe('the content gate (CONTENT-RULE.md)', () => {
  // Nothing may read as a figure near a child, or as an invitation aimed at children.
  const BANNED =
    /\b(child|children|kid|kids|girl|girls|boy|boys|little ones?|window|bed|bedroom|nursery|lullaby|sleeping|sleepover|follows?|following|stalk\w*|lurk\w*|waits?|waiting|watching you|room for every)\b/i;

  it('keeps every title clear of the banned wording', () => {
    for (const s of rankingFile.songs)
      expect(s.title, s.id).not.toMatch(BANNED);
  });

  it('keeps every cover description and all the page text clear of it', () => {
    const { container } = render(<BandSongs />);
    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('alt')).not.toMatch(BANNED);
    }
    expect(text(container)).not.toMatch(BANNED);
  });

  it('leaves out the songs on the re-render list and the purged takes', () => {
    const ids = rankingFile.songs.map((s) => s.id);
    for (const held of ['n02', 'n04', 'n06', 'psy-3', 'psy-3b'])
      expect(ids).not.toContain(held);
  });
});
