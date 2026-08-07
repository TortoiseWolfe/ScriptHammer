import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  resolveContentType,
  isPreviewable,
  validateIntakeFile,
  getUploadErrorMessage,
  buildIntakePath,
} from '@/lib/commerce/intake-upload';

const f = (name: string, size: number, type: string) => ({ name, size, type });

describe('resolveContentType', () => {
  it('uses what the browser reports when it reports something real', () => {
    expect(resolveContentType(f('a.png', 10, 'image/png'))).toBe('image/png');
  });

  // FR-018. Browsers routinely report '' or application/octet-stream for HEIC
  // because they cannot decode it. Passing that through means the BUCKET rejects a
  // format the product promises to accept — the browser's ignorance turning into a
  // server-side refusal.
  it('falls back to the extension when the browser says nothing', () => {
    expect(resolveContentType(f('IMG_0001.HEIC', 10, ''))).toBe('image/heic');
  });

  it('falls back when the browser says application/octet-stream', () => {
    expect(
      resolveContentType(f('scan.heic', 10, 'application/octet-stream'))
    ).toBe('image/heic');
  });

  it('cannot be used to smuggle a disallowed type in', () => {
    // An .exe with no reported type resolves to nothing on the allowlist, so the
    // validator still refuses it.
    const file = f('payload.exe', 10, '');
    expect(
      (ALLOWED_MIME_TYPES as readonly string[]).includes(
        resolveContentType(file)
      )
    ).toBe(false);
    expect(validateIntakeFile(file).valid).toBe(false);
  });
});

describe('isPreviewable', () => {
  it('excludes HEIC — accepted, but no thumbnail (FR-018)', () => {
    expect(isPreviewable('image/heic')).toBe(false);
    expect(isPreviewable('application/pdf')).toBe(false);
    expect(isPreviewable('image/png')).toBe(true);
  });
});

describe('validateIntakeFile', () => {
  it('accepts a normal photo', () => {
    expect(
      validateIntakeFile(f('roof.jpg', 2_000_000, 'image/jpeg')).valid
    ).toBe(true);
  });

  it('refuses the ninth file (FR-014)', () => {
    const r = validateIntakeFile(f('x.png', 10, 'image/png'), MAX_FILES);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('8-file limit');
  });

  it('allows exactly the eighth', () => {
    expect(
      validateIntakeFile(f('x.png', 10, 'image/png'), MAX_FILES - 1).valid
    ).toBe(true);
  });

  it('refuses a file over 10 MB and says how big it was', () => {
    const r = validateIntakeFile(f('huge.png', MAX_FILE_SIZE + 1, 'image/png'));
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/10 MB limit/);
  });

  it('accepts a file exactly at the limit', () => {
    expect(
      validateIntakeFile(f('edge.png', MAX_FILE_SIZE, 'image/png')).valid
    ).toBe(true);
  });

  it('refuses an empty file', () => {
    expect(validateIntakeFile(f('empty.png', 0, 'image/png')).valid).toBe(
      false
    );
  });

  it('refuses a disallowed type', () => {
    expect(validateIntakeFile(f('a.svg', 10, 'image/svg+xml')).valid).toBe(
      false
    );
  });

  it('accepts HEIC even though nothing can preview it', () => {
    expect(validateIntakeFile(f('IMG.HEIC', 3_000_000, '')).valid).toBe(true);
  });
});

describe('buildIntakePath', () => {
  const uid = '11111111-2222-3333-4444-555555555555';

  it('always prefixes the uid — the entire ownership model', () => {
    expect(buildIntakePath(uid, 'roof.png', 'abc')).toBe(`${uid}/abc.png`);
  });

  // A buyer's filename can contain anything. The key must stay one predictable
  // segment under the uid, or RLS's split_part(name,'/',1) stops meaning what the
  // policy thinks it means.
  it('never lets a filename escape the uid folder', () => {
    for (const evil of [
      '../../etc/passwd',
      'a/b/c.png',
      '....//x.png',
      'x.png/../../y',
    ]) {
      const p = buildIntakePath(uid, evil, 'k');
      expect(p.startsWith(`${uid}/`)).toBe(true);
      expect(p.split('/').length).toBe(2);
    }
  });

  it('drops an implausible extension rather than trusting it', () => {
    expect(buildIntakePath(uid, 'x.thisisnotanextension', 'k')).toBe(
      `${uid}/k`
    );
  });
});

describe('getUploadErrorMessage', () => {
  it('translates the refusals that actually matter', () => {
    expect(
      getUploadErrorMessage(
        new Error('The object exceeded the maximum allowed size')
      )
    ).toMatch(/10 MB/);
    expect(getUploadErrorMessage(new Error('mime type not supported'))).toMatch(
      /file type/
    );
    expect(
      getUploadErrorMessage(
        new Error('new row violates row-level security policy')
      )
    ).toMatch(/signed in/);
  });

  it('never returns an empty string', () => {
    expect(getUploadErrorMessage(null).length).toBeGreaterThan(0);
    expect(getUploadErrorMessage(undefined).length).toBeGreaterThan(0);
  });
});

/**
 * The limits live in two places by necessity: this module (fast, friendly error)
 * and the bucket (the actual enforcement — FR-015/SC-011). Two copies of a
 * security control drift, and the drift is invisible because the client-side one
 * is the one you see while developing.
 *
 * So: assert they agree, by reading the migration.
 */
describe('client limits match the bucket (FR-015)', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20251006_complete_monolithic_setup.sql'
    ),
    'utf8'
  );
  const block = sql.slice(sql.indexOf("'intake-uploads'"));

  it('the bucket exists in the migration', () => {
    expect(sql).toContain("'intake-uploads'");
  });

  it('file_size_limit equals MAX_FILE_SIZE', () => {
    const m = block.match(/(\d{6,})[,\s]*--\s*10MB/);
    expect(m, 'could not find the file_size_limit literal').not.toBeNull();
    expect(Number(m![1])).toBe(MAX_FILE_SIZE);
  });

  it('allowed_mime_types matches ALLOWED_MIME_TYPES exactly', () => {
    const arr = block.slice(
      block.indexOf('ARRAY['),
      block.indexOf(']', block.indexOf('ARRAY['))
    );
    const inSql = [...arr.matchAll(/'([a-z]+\/[a-z0-9.+-]+)'/g)].map(
      (x) => x[1]
    );
    expect([...inSql].sort()).toEqual([...ALLOWED_MIME_TYPES].sort());
  });

  it('the bucket is private (FR-016)', () => {
    expect(block).toMatch(/false,\s*--\s*FR-016/);
  });

  // DO NOTHING would make a limit change here a silent no-op on any project where
  // the bucket already exists.
  it('re-running the migration re-applies the limits', () => {
    expect(block).toContain('ON CONFLICT (id) DO UPDATE');
  });
});
