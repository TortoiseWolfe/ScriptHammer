import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROSTER } from './roster';
import { THEME_SONG, HOOK } from './songs';
import { getAssetUrl, projectConfig } from '@/config/project.config';

const PUBLIC = join(process.cwd(), 'public');
const onDisk = (p: string) => existsSync(join(PUBLIC, p));

describe('band roster', () => {
  it('has seven members with unique slugs and names', () => {
    expect(ROSTER).toHaveLength(7);
    expect(new Set(ROSTER.map((m) => m.slug)).size).toBe(7);
    expect(new Set(ROSTER.map((m) => m.name)).size).toBe(7);
  });

  it('ships both portrait sizes for every member', () => {
    for (const m of ROSTER) {
      expect(onDisk(m.portrait512), m.portrait512).toBe(true);
      expect(onDisk(m.portrait700), m.portrait700).toBe(true);
    }
  });

  it('describes every picture, in words that are not just the name', () => {
    for (const m of ROSTER) {
      expect(m.alt.length, m.slug).toBeGreaterThan(30);
      expect(m.alt).toContain(m.name);
    }
  });

  it('never gives a member a gendered pronoun (none has been given)', () => {
    const text = ROSTER.map((m) => `${m.blurb} ${m.alt} ${m.role}`).join(' ');
    expect(text).not.toMatch(/\b(he|she|him|her|his|hers|himself|herself)\b/i);
  });

  it('puts the base path in front of every portrait URL', () => {
    for (const m of ROSTER) {
      const url = getAssetUrl(m.portrait512);
      expect(url.startsWith(projectConfig.basePath)).toBe(true);
      expect(url.endsWith(m.portrait512)).toBe(true);
    }
  });
});

describe('band songs', () => {
  it.each([THEME_SONG, HOOK])('$id exists on disk and has lyrics', (song) => {
    expect(onDisk(song.src), song.src).toBe(true);
    expect(song.lyrics.length).toBeGreaterThan(0);
    expect(song.length).toMatch(/^\d+:\d{2}$/);
  });

  it('keeps the show dates off the page data', () => {
    const all = JSON.stringify([THEME_SONG, HOOK, ROSTER]);
    expect(all).not.toMatch(/October|Halloween/i);
  });
});
