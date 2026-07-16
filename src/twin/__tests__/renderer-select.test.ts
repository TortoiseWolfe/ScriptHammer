import { describe, it, expect } from 'vitest';
import { selectRenderer } from '../renderer-select';

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

  it('an explicit ?diorama beats a stray ?atlas', () => {
    expect(selectRenderer(q('?atlas&diorama'))).toBe('diorama');
  });
});
