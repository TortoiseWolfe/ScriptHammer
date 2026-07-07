import { describe, it, expect } from 'vitest';
import type { Event, Breadcrumb } from '@sentry/react';
import { scrubString, scrubEvent, scrubBreadcrumb } from './scrub';

const REDACTED = '[REDACTED]';

describe('scrubString', () => {
  it('redacts email addresses', () => {
    expect(scrubString('contact user@example.com now')).toBe(
      `contact ${REDACTED} now`
    );
    expect(scrubString('first.last+tag@sub.domain.co.uk')).toBe(REDACTED);
  });

  it('redacts JWT-shaped tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(scrubString(`token=${jwt} end`)).toBe(`token=${REDACTED} end`);
  });

  it('redacts Bearer tokens but keeps the scheme word', () => {
    expect(scrubString('Authorization: Bearer abc.def-ghi_123')).toBe(
      `Authorization: Bearer ${REDACTED}`
    );
  });

  it('redacts access_token / refresh_token key-value pairs, keeping the key', () => {
    expect(scrubString('access_token=secretvalue123&x=1')).toBe(
      `access_token=${REDACTED}&x=1`
    );
    expect(scrubString('"refresh_token":"abc-def-ghi"')).toBe(
      `"refresh_token":"${REDACTED}"`
    );
  });

  it('redacts Supabase auth localStorage keys', () => {
    expect(scrubString('key sb-huvitqubafsrazpjxsax-auth-token here')).toBe(
      `key ${REDACTED} here`
    );
  });

  it('leaves non-sensitive strings untouched', () => {
    expect(scrubString('a perfectly normal error message')).toBe(
      'a perfectly normal error message'
    );
    expect(scrubString('')).toBe('');
  });
});

describe('scrubEvent', () => {
  it('scrubs event.message', () => {
    const ev: Event = { message: 'failed for user@example.com' };
    expect(scrubEvent(ev)?.message).toBe(`failed for ${REDACTED}`);
  });

  it('scrubs exception values', () => {
    const ev: Event = {
      exception: {
        values: [{ type: 'Error', value: 'login failed: admin@corp.com' }],
      },
    };
    expect(scrubEvent(ev)?.exception?.values?.[0].value).toBe(
      `login failed: ${REDACTED}`
    );
  });

  it('whole-value-redacts sensitive object keys regardless of content', () => {
    const ev: Event = {
      extra: {
        content: 'this is a decrypted private message',
        plaintext_content: 'another secret',
        new_content: 'edited secret',
        encrypted_content: 'base64ciphertext==',
        password: 'hunter2',
        harmless: 'keep me',
      },
    };
    const out = scrubEvent(ev)!;
    expect(out.extra?.content).toBe(REDACTED);
    expect(out.extra?.plaintext_content).toBe(REDACTED);
    expect(out.extra?.new_content).toBe(REDACTED);
    expect(out.extra?.encrypted_content).toBe(REDACTED);
    expect(out.extra?.password).toBe(REDACTED);
    expect(out.extra?.harmless).toBe('keep me');
  });

  it('recurses into nested objects and arrays', () => {
    const ev: Event = {
      extra: {
        nested: { deep: { email: 'x@y.com', list: ['a@b.com', 'fine'] } },
      },
    };
    const out = scrubEvent(ev)!;
    const nested = out.extra?.nested as Record<string, unknown>;
    const deep = nested.deep as Record<string, unknown>;
    expect(deep.email).toBe(REDACTED);
    expect(deep.list).toEqual([REDACTED, 'fine']);
  });

  it('scrubs request fields', () => {
    const ev: Event = {
      request: {
        url: 'https://app/path?email=a@b.com',
        headers: { Authorization: 'Bearer secrettoken' },
      },
    };
    const out = scrubEvent(ev)!;
    expect(out.request?.url).toContain(REDACTED);
    expect((out.request?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${REDACTED}`
    );
  });

  it('scrubs breadcrumbs', () => {
    const ev: Event = {
      breadcrumbs: [
        { message: 'navigated as user@example.com', data: { password: 'p' } },
      ],
    };
    const out = scrubEvent(ev)!;
    expect(out.breadcrumbs?.[0].message).toBe(`navigated as ${REDACTED}`);
    expect(
      (out.breadcrumbs?.[0].data as Record<string, unknown>).password
    ).toBe(REDACTED);
  });

  it('preserves primitive/null values and never throws on empty events', () => {
    expect(() => scrubEvent({})).not.toThrow();
    const ev: Event = {
      extra: { n: 42, b: true, z: null, u: undefined },
    };
    const out = scrubEvent(ev)!;
    expect(out.extra?.n).toBe(42);
    expect(out.extra?.b).toBe(true);
    expect(out.extra?.z).toBeNull();
  });

  it('returns the same event reference (mutated in place)', () => {
    const ev: Event = { message: 'fine' };
    expect(scrubEvent(ev)).toBe(ev);
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs message and data', () => {
    const b: Breadcrumb = {
      message: 'token=Bearer xyz.abc',
      data: { content: 'private', ok: 'visible' },
    };
    const out = scrubBreadcrumb(b);
    expect(out.message).toContain(REDACTED);
    expect((out.data as Record<string, unknown>).content).toBe(REDACTED);
    expect((out.data as Record<string, unknown>).ok).toBe('visible');
  });
});
