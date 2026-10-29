import { describe, it, expect } from 'vitest';
import weights from '../../../public/data/band-weights.json';
import shipped from '../../../public/data/band-ranking.json';
import {
  score,
  rankSongs,
  newMark,
  mergeTakes,
  buildRanking,
  dayLabel,
  daysBetween,
  type BandSong,
  type BandTake,
  type BandWeights,
} from './ranking';

const W = weights as BandWeights;
const ASOF = '2026-10-29';

function song(id: string, over: Partial<BandSong> = {}): BandSong {
  return {
    id,
    title: id,
    cover: `/band/songs/${id}.webp`,
    posted: '2026-08-30',
    shortUrl: null,
    youtube: { plays: 0, up: 0, down: 0 },
    twitch: { up: 0, down: 0 },
    review: { up: 0, down: 0 },
    site: { up: 0, down: 0 },
    ...over,
  };
}

const take = (
  id: string,
  group: string,
  over: Partial<BandSong> = {}
): BandTake => ({
  ...song(id, over),
  group,
});

describe('score', () => {
  it('weighs site 1, Twitch 3, YouTube 3 and the owner 3', () => {
    const s = song('a', {
      site: { up: 4, down: 1 },
      twitch: { up: 2, down: 0 },
      youtube: { plays: 99, up: 3, down: 1 },
      review: { up: 1, down: 0 },
    });
    expect(score(s, W)).toBe(1 * 3 + 3 * 2 + 3 * 2 + 3 * 1);
  });

  it("caps a song's site votes at 25 points either way", () => {
    expect(score(song('a', { site: { up: 900, down: 0 } }), W)).toBe(25);
    expect(score(song('a', { site: { up: 0, down: 900 } }), W)).toBe(-25);
  });

  it('is never lowered by plays', () => {
    const few = song('a', { youtube: { plays: 10, up: 1, down: 0 } });
    const many = song('a', { youtube: { plays: 10_000_000, up: 1, down: 0 } });
    expect(score(many, W)).toBe(score(few, W));
  });
});

describe('rankSongs', () => {
  it('puts the highest score first, whatever the plays', () => {
    const six = song('six', {
      twitch: { up: 2, down: 0 },
      youtube: { plays: 1, up: 0, down: 0 },
    });
    const five = song('five', {
      site: { up: 5, down: 0 },
      youtube: { plays: 9999, up: 0, down: 0 },
    });
    expect(rankSongs([five, six], ASOF, W).map((s) => s.id)).toEqual([
      'six',
      'five',
    ]);
  });

  it('breaks a tie by plays a day, so a new song is judged by its pace', () => {
    // Both S = 5. 300 plays over 60 days = 5 a day; 30 plays over 3 days = 10 a day.
    const old = song('old', {
      posted: '2026-08-30',
      site: { up: 5, down: 0 },
      youtube: { plays: 300, up: 0, down: 0 },
    });
    const young = song('young', {
      posted: '2026-10-26',
      site: { up: 5, down: 0 },
      youtube: { plays: 30, up: 0, down: 0 },
    });
    expect(score(old, W)).toBe(5);
    expect(score(young, W)).toBe(5);
    expect(rankSongs([old, young], ASOF, W).map((s) => s.id)).toEqual([
      'young',
      'old',
    ]);
  });

  it('counts a song posted today as one day, not zero', () => {
    const today = song('today', {
      posted: ASOF,
      youtube: { plays: 8, up: 0, down: 0 },
    });
    expect(rankSongs([today], ASOF, W)).toHaveLength(1);
    const slower = song('slower', {
      posted: '2026-10-27',
      youtube: { plays: 10, up: 0, down: 0 },
    });
    // 8 a day beats 5 a day.
    expect(rankSongs([slower, today], ASOF, W)[0].id).toBe('today');
  });

  it('then goes to the fewest down votes', () => {
    const clean = song('clean', { site: { up: 2, down: 0 } });
    const noisy = song('noisy', { site: { up: 3, down: 1 } });
    expect(score(clean, W)).toBe(score(noisy, W));
    expect(rankSongs([noisy, clean], ASOF, W).map((s) => s.id)).toEqual([
      'clean',
      'noisy',
    ]);
  });

  it('finally goes to the title, A to Z', () => {
    const b = song('b', { title: 'Brass Door' });
    const a = song('a', { title: 'Amber Gears' });
    expect(rankSongs([b, a], ASOF, W).map((s) => s.title)).toEqual([
      'Amber Gears',
      'Brass Door',
    ]);
  });

  it('does not change the list it is given', () => {
    const list = [song('b', { title: 'B' }), song('a', { title: 'A' })];
    rankSongs(list, ASOF, W);
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('newMark', () => {
  it('marks a song first shown in the last 14 days', () => {
    expect(newMark(song('a', { posted: '2026-10-26' }), ASOF, W)).toBe(
      'New, 3 days old'
    );
    expect(newMark(song('a', { posted: '2026-10-28' }), ASOF, W)).toBe(
      'New, 1 day old'
    );
    expect(newMark(song('a', { posted: ASOF }), ASOF, W)).toBe(
      'New, posted today'
    );
  });

  it('stops after 14 days', () => {
    expect(newMark(song('a', { posted: '2026-10-15' }), ASOF, W)).toBe(
      'New, 14 days old'
    );
    expect(newMark(song('a', { posted: '2026-10-14' }), ASOF, W)).toBeNull();
  });
});

describe('daysBetween and dayLabel', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-26', '2026-10-29')).toBe(3);
  });
  it('writes a day the same way on every machine', () => {
    expect(dayLabel('2026-10-29')).toBe('Thu 29 Oct');
  });
});

describe('mergeTakes', () => {
  it('shows one song for two takes and adds the numbers', () => {
    const a = take('x1', 'x', {
      title: 'Same Words',
      posted: '2026-10-10',
      shortUrl: 'https://youtube.com/shorts/aaa',
      youtube: { plays: 100, up: 5, down: 1 },
      twitch: { up: 2, down: 0 },
    });
    const b = take('x2', 'x', {
      title: 'Same Words',
      posted: '2026-10-05',
      youtube: { plays: 40, up: 1, down: 0 },
      twitch: { up: 0, down: 1 },
    });
    const m = mergeTakes([a, b], ASOF, W);
    expect(m.id).toBe('x');
    expect(m.youtube).toEqual({ plays: 140, up: 6, down: 1 });
    expect(m.twitch).toEqual({ up: 2, down: 1 });
    expect(m.posted).toBe('2026-10-05');
    expect(m.shortUrl).toBe('https://youtube.com/shorts/aaa');
  });
});

describe('buildRanking', () => {
  const takes = [
    take('good', 'good', { youtube: { plays: 10, up: 4, down: 0 } }),
    take('twin-a', 'twin', { youtube: { plays: 5, up: 1, down: 0 } }),
    take('twin-b', 'twin', { youtube: { plays: 500, up: 90, down: 0 } }),
    take('n02', 'n02', { youtube: { plays: 900, up: 99, down: 0 } }),
  ];

  it('drops a purged take before it can reach the file', () => {
    const file = buildRanking({
      takes,
      purged: ['twin-b'],
      held: [],
      weights: W,
      asOf: ASOF,
    });
    const text = JSON.stringify(file);
    expect(text).not.toContain('twin-b');
    expect(text).not.toContain('"plays":500');
  });

  it("does not add a purged take's numbers to its partner take", () => {
    const file = buildRanking({
      takes,
      purged: ['twin-b'],
      held: [],
      weights: W,
      asOf: ASOF,
    });
    const twin = file.songs.find((s) => s.id === 'twin');
    expect(twin?.youtube).toEqual({ plays: 5, up: 1, down: 0 });
  });

  it('leaves out a song on the re-render list', () => {
    const file = buildRanking({
      takes,
      purged: [],
      held: ['n02'],
      weights: W,
      asOf: ASOF,
    });
    expect(file.songs.map((s) => s.id)).not.toContain('n02');
  });

  it('writes the list in ranking order and stamps the day', () => {
    const file = buildRanking({
      takes,
      purged: [],
      held: ['n02'],
      weights: W,
      asOf: ASOF,
    });
    expect(file.asOf).toBe(ASOF);
    expect(file.songs.map((s) => s.id)).toEqual(['twin', 'good']);
  });
});

describe('the shipped files', () => {
  const HELD = ['n02', 'n04', 'n06', 'psy-3', 'psy-3b'];

  it('lists no song that is held for a re-render', () => {
    const ids = shipped.songs.map((s) => s.id);
    for (const id of HELD) expect(ids).not.toContain(id);
  });

  it('has each song once', () => {
    const ids = shipped.songs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is already in ranking order', () => {
    const songs = shipped.songs as BandSong[];
    expect(rankSongs(songs, shipped.asOf, W).map((s) => s.id)).toEqual(
      songs.map((s) => s.id)
    );
  });

  it('gives every song a cover file name that matches its id', () => {
    for (const s of shipped.songs)
      expect(s.cover).toBe(`/band/songs/${s.id}.webp`);
  });
});
