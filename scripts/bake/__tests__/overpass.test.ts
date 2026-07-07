import { describe, it, expect, vi, beforeEach } from 'vitest';
import { overpassQuery, USER_AGENT } from '../overpass';

beforeEach(() => vi.restoreAllMocks());

describe('overpassQuery', () => {
  it('POSTs with a User-Agent and the QL body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [{ type: 'way', id: 1 }] }), {
        status: 200,
      })
    );
    const r = await overpassQuery('[out:json];out count;');
    expect(r.elements[0].id).toBe(1);
    const [, init] = spy.mock.calls[0];
    expect((init!.headers as Record<string, string>)['User-Agent']).toBe(
      USER_AGENT
    );
    const sentBody = decodeURIComponent(String(init!.body));
    expect(sentBody).toContain('out count');
  });
  it('retries then throws on repeated 406', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('no', { status: 406 })
    );
    await expect(
      overpassQuery('x', { retries: 2, backoffMs: 0 })
    ).rejects.toThrow(/406/);
  });
});
