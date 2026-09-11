import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordLead,
  scheduleLeadId,
  SCHEDULE_LEAD_KEY,
} from '@/lib/leads/record-lead';

/**
 * One recorder, two callers (#562). `BookingCta` uses it for a storefront click and
 * `/schedule` for a direct arrival, so the request shape can only be wrong in one place —
 * which is the point of extracting it, and the thing worth pinning.
 */

const LEAD = '3f6c1a2e-8b4d-4c7a-9e1f-2b5d6c7a8e90';

describe('recordLead', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => LEAD });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  it('returns the id it minted, without waiting for the server', () => {
    // The caller needs it immediately: it becomes the booking's hidden lead_ref, and waiting
    // on a cold Edge Function is what lost the attribution in #1166.
    expect(recordLead('pricing')).toBe(LEAD);
  });

  it('sends the same id it returned', () => {
    // Two different ids would be worse than none — the lead would exist, the booking would
    // carry something else, and the join would fail while everything looked correct.
    const id = recordLead('pricing', 'svc-landing');
    expect(body()).toEqual({
      id,
      source: 'pricing',
      product_id: 'svc-landing',
    });
  });

  it('omits product_id when there is no SKU', () => {
    recordLead('schedule');
    expect(body()).toEqual({ id: LEAD, source: 'schedule' });
  });

  it('uses keepalive, since callers navigate immediately after', () => {
    recordLead('pricing');
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('sends the anonymous key, because the caller has no session', () => {
    recordLead('pricing');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.apikey).toBe('anon-key');
    expect(headers.Authorization).toBe('Bearer anon-key');
  });

  it('returns null rather than fetching an undefined URL when unconfigured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(recordLead('pricing')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null where crypto.randomUUID does not exist', () => {
    // An id the caller cannot mint is an attribution it cannot carry. Better to skip the
    // whole thing than to record a lead nothing can ever join to.
    vi.stubGlobal('crypto', {});
    expect(recordLead('pricing')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws at the caller when the request fails', () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(() => recordLead('pricing')).not.toThrow();
    expect(recordLead('pricing')).toBe(LEAD);
  });
});

describe('scheduleLeadId — once per session, not per render', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => LEAD });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    // `restoreAllMocks` before touching storage: one case replaces the sessionStorage getter
    // with a throwing stub, and `unstubAllGlobals` does not undo a `spyOn`. Without this the
    // stub leaks into the next test's setup, where it fails as "clear is not a function" —
    // a failure in a case that has nothing to do with the one that caused it.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('records once and remembers the id', () => {
    expect(scheduleLeadId()).toBe(LEAD);
    expect(window.sessionStorage.getItem(SCHEDULE_LEAD_KEY)).toBe(LEAD);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored id on a reload instead of counting a second visitor', () => {
    scheduleLeadId();
    fetchMock.mockClear();
    expect(scheduleLeadId()).toBe(LEAD);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still records when sessionStorage refuses, rather than losing the lead', () => {
    // Private modes throw on access. A duplicate on refresh is a far smaller problem than
    // an unattributable booking, so the failure direction is deliberate.
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      // `clear` is never called by the code under test; it is here so a leaked stub fails
      // loudly in THIS test rather than quietly in the next one's setup.
      clear: () => {},
    };
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(
      throwing as unknown as Storage
    );
    expect(scheduleLeadId()).toBe(LEAD);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records the schedule surface, not the storefront one', () => {
    scheduleLeadId();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe('schedule');
  });
});
