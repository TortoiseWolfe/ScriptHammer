import { supabase } from '@/lib/supabase/client';
import type { IntakeAttachment } from '@/types/commerce';

/**
 * Checkout attachments — what the buyer has, and what they want (#560, FR-014…FR-018).
 *
 * MIRRORS `src/lib/avatar/{validation,upload}.ts` RATHER THAN REUSING IT. The avatar
 * path is welded to a PUBLIC bucket, a `.webp` re-encode and an `auth.updateUser`
 * write, none of which apply here. What carries over is the shape: a pure validator,
 * a `{uid}/…` path convention, retry with backoff, and one place that turns a storage
 * error into a sentence a buyer can act on.
 *
 * THE LIMITS BELOW ARE NOT THE ENFORCEMENT. They exist to fail fast with a good
 * message. The real control is the bucket — `file_size_limit` and
 * `allowed_mime_types` on `intake-uploads`, set in the monolithic migration and
 * enforced by storage-api. FR-015 requires exactly that, and SC-011 tests it by
 * deleting the browser-side check and asserting the refusal still happens. If you
 * change a limit here, change it there; a limit that lives only in this file is
 * advisory and a buyer with devtools can walk straight past it.
 */

/** FR-014: "up to eight files". */
export const MAX_FILES = 8;

/** 10MB per file. Must match `file_size_limit` on the bucket. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Must match `allowed_mime_types` on the `intake-uploads` bucket.
 *
 * HEIC/HEIF are accepted although nothing here can draw a preview of them (FR-018) —
 * a photo straight off an iPhone is the likeliest thing a buyer sends, and refusing
 * the common case to keep the thumbnail grid tidy is the wrong trade.
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

/** Formats we can render as a thumbnail. HEIC is deliberately absent. */
export const PREVIEWABLE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

/** The minimum a validator needs — so it can be tested without a real File. */
export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * The MIME to upload this file as.
 *
 * Browsers frequently report `''` or `application/octet-stream` for `.heic`,
 * because it is not a type they can decode. Passing that through means the bucket
 * allowlist rejects a format the product promises to accept (FR-018) — the browser's
 * ignorance becoming a server-side refusal. So when the reported type is absent or
 * generic, fall back to the extension.
 *
 * Only ever RESOLVES to a type already on the allowlist; it cannot be used to smuggle
 * a disallowed file in, because `validateIntakeFile` checks the resolved value and the
 * bucket checks it again.
 */
export function resolveContentType(file: FileLike): string {
  const reported = (file.type || '').toLowerCase();
  if (reported && reported !== 'application/octet-stream') return reported;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? reported ?? '';
}

export function isPreviewable(mime: string): boolean {
  return (PREVIEWABLE_MIME_TYPES as readonly string[]).includes(
    mime.toLowerCase()
  );
}

/**
 * Fail fast with a sentence the buyer can act on.
 *
 * `alreadyAttached` is passed in rather than read from module state so this stays
 * pure — the component owns the list, this only answers questions about it.
 */
export function validateIntakeFile(
  file: FileLike,
  alreadyAttached = 0
): ValidationResult {
  if (alreadyAttached >= MAX_FILES) {
    return { valid: false, error: `${file.name} — ${MAX_FILES}-file limit` };
  }
  if (file.size <= 0) {
    return { valid: false, error: `${file.name} — file is empty` };
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `${file.name} — ${mb} MB, over the 10 MB limit`,
    };
  }
  const mime = resolveContentType(file);
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return { valid: false, error: `${file.name} — type not allowed` };
  }
  return { valid: true };
}

/** Turn a storage failure into something a buyer can act on. */
export function getUploadErrorMessage(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = msg.toLowerCase();
  // storage-api's own refusals, i.e. the checks that actually matter (FR-015).
  if (lower.includes('exceeded the maximum allowed size')) {
    return 'That file is over the 10 MB limit.';
  }
  if (lower.includes('mime type') || lower.includes('not allowed')) {
    return 'We cannot accept that file type.';
  }
  if (lower.includes('row-level security') || lower.includes('violates')) {
    return 'You are not signed in as the owner of that upload. Sign in and try again.';
  }
  if (lower.includes('jwt') || lower.includes('expired')) {
    return 'Your session expired. Sign in again and re-attach the file.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network problem while uploading. Try again.';
  }
  return msg || 'Upload failed. Try again.';
}

export interface UploadResult {
  attachment?: IntakeAttachment;
  error?: string;
}

/**
 * A storage-safe object key for this file.
 *
 * `{uid}/` prefix is the ENTIRE ownership model — the RLS policies on
 * `intake-uploads` compare `split_part(name, '/', 1)` to `auth.uid()`. Nothing else
 * ties a file to a person, which is also why create-order re-derives ownership from
 * the path server-side rather than trusting whatever the client echoes back (T021).
 *
 * The original filename is preserved in `IntakeAttachment.name` for the operator to
 * read; it is NOT used in the key, because a buyer's filename can contain anything —
 * `../`, control characters, 300 characters of Cyrillic — and the key has to stay a
 * predictable single path segment under the uid.
 */
export function buildIntakePath(
  userId: string,
  fileName: string,
  unique: string
): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? `.${ext}` : '';
  return `${userId}/${unique}${safeExt}`;
}

/**
 * Upload one attachment. Retries transient failures; never retries a refusal.
 *
 * Retrying a 413 or a MIME rejection just spends the buyer's time to arrive at the
 * same answer, so only network-shaped failures are retried.
 */
export async function uploadIntakeFile(
  file: File,
  options: {
    /** Distinguishes files within one buyer's folder. Injected for testability. */
    unique: string;
    kind?: IntakeAttachment['kind'];
    maxRetries?: number;
    onProgress?: (percent: number) => void;
  }
): Promise<UploadResult> {
  const { unique, kind = 'unspecified', maxRetries = 3 } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: 'You need to be signed in to attach files.' };
  }

  const check = validateIntakeFile(file);
  if (!check.valid) return { error: check.error };

  const contentType = resolveContentType(file);
  const path = buildIntakePath(userId, file.name, unique);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    options.onProgress?.(attempt === 1 ? 5 : 5 + attempt * 10);
    const { error } = await supabase.storage
      .from('intake-uploads')
      .upload(path, file, {
        contentType,
        upsert: true, // a retry writes the same key; do not orphan a half-object
      });

    if (!error) {
      options.onProgress?.(100);
      return {
        attachment: {
          path,
          name: file.name,
          bytes: file.size,
          mime: contentType,
          kind,
        },
      };
    }

    lastError = error;
    const msg = (error.message || '').toLowerCase();
    const isRefusal =
      msg.includes('exceeded the maximum allowed size') ||
      msg.includes('mime type') ||
      msg.includes('not allowed') ||
      msg.includes('row-level security') ||
      msg.includes('violates');
    if (isRefusal) break;

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }

  return { error: getUploadErrorMessage(lastError) };
}

/** Remove an attachment the buyer changed their mind about. */
export async function removeIntakeFile(
  path: string
): Promise<{ error?: string }> {
  const { error } = await supabase.storage
    .from('intake-uploads')
    .remove([path]);
  return error ? { error: getUploadErrorMessage(error) } : {};
}

/**
 * A short-lived URL the operator can actually open (T022).
 *
 * The bucket is private, so there is no public URL to fall back on — an
 * unauthenticated `getPublicUrl` on this bucket returns a link that 400s.
 */
export async function getIntakeSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from('intake-uploads')
    .createSignedUrl(path, expiresInSeconds);
  if (error) return { error: getUploadErrorMessage(error) };
  return { url: data?.signedUrl };
}
