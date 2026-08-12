import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The credits page must credit everything that ships (#714).
 *
 * A hand-maintained credits list is wrong the first time a model is added, and nobody
 * notices, because nothing renders differently. The page therefore reads `models.json` at
 * build time; this asserts the two things that could still silently rot — that the source
 * data can actually support a credit, and that the page is generated from it rather than
 * from a copied list.
 *
 * Attribution is NOT required by the 3D Warehouse licence — it contains no attribution
 * clause. This is courtesy, and courtesy that quietly stops working is worse than none.
 */
const ROOT = process.cwd();
const MODELS = join(ROOT, 'public', 'twins', 'chatt', 'models', 'models.json');
const PAGE = join(ROOT, 'src', 'app', 'credits', 'page.tsx');

interface Entry {
  slug: string;
  title: string;
  creator: string;
  url: string;
}

const parsed = JSON.parse(readFileSync(MODELS, 'utf8')) as
  | { models: Entry[] }
  | Entry[];
const models: Entry[] = Array.isArray(parsed) ? parsed : parsed.models;

describe('model credits (#714)', () => {
  it('every shipped model can actually be credited', () => {
    expect(models.length).toBeGreaterThan(0);
    const noCreator = models.filter((m) => !m.creator?.trim());
    const noUrl = models.filter((m) => !m.url?.trim());
    expect(
      noCreator.map((m) => m.slug),
      'these models ship with no creator, so the credits page would list them anonymously'
    ).toEqual([]);
    expect(
      noUrl.map((m) => m.slug),
      'these models ship with no source URL, so the credit could not link back'
    ).toEqual([]);
  });

  it('every model URL points at 3D Warehouse', () => {
    // A credit that links somewhere else is not a credit; it is a broken promise.
    for (const m of models) {
      expect(m.url, `${m.slug} links off 3D Warehouse`).toMatch(
        /^https:\/\/3dwarehouse\.sketchup\.com\//
      );
    }
  });

  it('the page is generated from models.json, not a copied list', () => {
    const src = readFileSync(PAGE, 'utf8');
    expect(src).toContain('models.json');
    // A literal model title in the source means someone pasted the list in, and it will
    // drift the next time the bake changes.
    const pasted = models.filter((m) => src.includes(m.title));
    expect(
      pasted.map((m) => m.slug),
      'model titles are hard-coded in the credits page — regenerate instead'
    ).toEqual([]);
  });

  it('states the licence restrictions and that attribution is not required', () => {
    const src = readFileSync(PAGE, 'utf8');
    // The two clauses that actually constrain a fork, in the author's own words.
    expect(src).toContain('mapping or geographic application');
    expect(src).toContain('standalone basis');
    expect(src).toContain('3dwarehouse-tou@sketchup.com');
    expect(src).toMatch(/not legal advice/i);
  });

  it('the in-world provenance strip credits the models too', () => {
    // The HUD line listed every data source except the 129 models and their authors.
    const manifest = JSON.parse(
      readFileSync(
        join(ROOT, 'public', 'twins', 'chatt', 'manifest.json'),
        'utf8'
      )
    ) as { provenance?: string };
    expect(manifest.provenance ?? '').toMatch(/3D Warehouse/);
  });
});
