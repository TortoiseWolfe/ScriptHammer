import { describe, it, expect } from 'vitest';
import { selectRenderer, selectRendererFor } from '../renderer-select';

const q = (s: string) => new URLSearchParams(s);

describe('selectRenderer', () => {
  it('defaults to the atlas — it is the better renderer and the one we ship', () => {
    expect(selectRenderer(q(''))).toBe('atlas');
  });

  it('?diorama opts out to the R3F exhibit', () => {
    expect(selectRenderer(q('?diorama'))).toBe('diorama');
  });

  it('?atlas stays a no-op alias so shared links keep working', () => {
    expect(selectRenderer(q('?atlas'))).toBe('atlas');
  });

  it('?ortho implies the diorama — it is a diorama compare mode', () => {
    expect(selectRenderer(q('?ortho'))).toBe('diorama');
  });

  it('?edit implies the diorama — the placement editor is diorama-only', () => {
    expect(selectRenderer(q('?edit'))).toBe('diorama');
  });

  it('?house implies the diorama — the as-built framing is diorama-only', () => {
    expect(selectRenderer(q('?house'))).toBe('diorama');
  });

  // #292 review I1: ?select and ?nofx were missing from DIORAMA_ONLY even
  // though TwinCanvasHost.tsx's own comment documented both as diorama-only.
  it("?select implies the diorama — useWarehouseEditor's deep-link is not gated on ?edit", () => {
    expect(selectRenderer(q('?select=some-model'))).toBe('diorama');
  });

  it("?nofx implies the diorama — StageCore's composer-bypass diagnostic does not apply to the atlas", () => {
    expect(selectRenderer(q('?nofx'))).toBe('diorama');
  });

  // Same omission, third recurrence. The nav's Play link happens to pass `?diorama&walk`, so
  // this stayed invisible: a bare `?walk` opened Cesium, which has no first-person camera,
  // and TwinCanvas — the component that owns walk mode — never mounted at all.
  it('?walk implies the diorama — Cesium has no first-person mode', () => {
    expect(selectRenderer(q('?walk'))).toBe('diorama');
  });

  it('?at implies the diorama — a spawn coordinate is only meaningful in walk', () => {
    expect(selectRenderer(q('?at=35.045123,-85.309876'))).toBe('diorama');
  });

  it('an explicit ?diorama beats a stray ?atlas', () => {
    expect(selectRenderer(q('?atlas&diorama'))).toBe('diorama');
  });
});

describe('selectRendererFor', () => {
  it('defers to selectRenderer when the site has an atlasBox', () => {
    expect(selectRendererFor(q(''), true)).toBe('atlas');
    expect(selectRendererFor(q('?diorama'), true)).toBe('diorama');
  });

  // #292 review B1a: a site with no atlasBox (a single as-built exhibit) has
  // nothing for the atlas to add — it must always render the diorama, no
  // matter what the URL asks for.
  it('forces the diorama when the site has no atlasBox, even with no params', () => {
    expect(selectRendererFor(q(''), false)).toBe('diorama');
  });

  it('forces the diorama even under an explicit ?atlas when the site has no atlasBox', () => {
    expect(selectRendererFor(q('?atlas'), false)).toBe('diorama');
  });
});
