import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'public/data', file), 'utf8'));

const tracks = read('band-tracks.json') as Record<
  string,
  { videoUrl?: string }
>;
const songs = (read('band-ranking.json') as { songs: { id: string }[] }).songs;

describe('full-song links on /band', () => {
  it('every videoUrl is a plain YouTube watch link', () => {
    for (const [id, info] of Object.entries(tracks)) {
      if (info.videoUrl === undefined) continue;
      expect(info.videoUrl, id).toMatch(
        /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/
      );
    }
  });

  it('no two songs share one video', () => {
    const urls = Object.values(tracks)
      .map((t) => t.videoUrl)
      .filter(Boolean);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('every ranked song has a full-song link', () => {
    for (const song of songs) {
      expect(tracks[song.id]?.videoUrl, song.id).toBeTruthy();
    }
  });
});
