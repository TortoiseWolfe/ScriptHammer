'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  MAX_FILES,
  isPreviewable,
  validateIntakeFile,
  uploadIntakeFile,
  removeIntakeFile,
} from '@/lib/commerce/intake-upload';
import type { IntakeAttachment } from '@/types/commerce';

/**
 * "Show us what you have and what you want" (#560, FR-014 … FR-018).
 *
 * Behaviour comes from the approved comp at docs/design/commerce/pricing-demo.html
 * (the dropzone, the have/want toggle, the rejection copy); the LOOK comes from the
 * app's own design language, because the comp is a standalone HTML file with its own
 * palette and this has to sit inside the checkout panel next to IntakeForm.
 *
 * ONE DELIBERATE DEVIATION FROM THE COMP. Its have/want chips set `min-height: 0`.
 * This repo requires 44px touch targets and gates on it, so the chips get `min-h-11`
 * and the comp loses. A control the operator needs a buyer to actually press on a
 * phone is the wrong place to save 20 vertical pixels.
 *
 * THE LIMITS HERE ARE A COURTESY, NOT THE CONTROL. Everything this component refuses,
 * the `intake-uploads` bucket refuses again server-side (FR-015) — that is what
 * SC-011 tests by deleting this check. Its job is a fast, specific error, not
 * security.
 */

export interface IntakeUploaderProps {
  /** Completed attachments. The parent owns them; this reports changes. */
  value: IntakeAttachment[];
  onChange: (attachments: IntakeAttachment[]) => void;
  disabled?: boolean;
  className?: string;
}

/** A file mid-flight: on screen, not yet an IntakeAttachment. */
interface PendingItem {
  id: string;
  name: string;
  bytes: number;
  mime: string;
  percent: number;
  error?: string;
}

const KIND_LABEL: Record<'current' | 'target', string> = {
  current: 'What I have',
  target: 'What I want',
};

function humanSize(bytes: number): string {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export default function IntakeUploader({
  value,
  onChange,
  disabled = false,
  className = '',
}: IntakeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const total = value.length + pending.length;
  const full = total >= MAX_FILES;

  const addFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || disabled) return;
      const bad: string[] = [];
      const accepted: { file: File; item: PendingItem }[] = [];
      let running = total;

      for (const file of Array.from(list)) {
        const check = validateIntakeFile(file, running);
        if (!check.valid) {
          bad.push(check.error!);
          continue;
        }
        running++;
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`;
        accepted.push({
          file,
          item: {
            id,
            name: file.name,
            bytes: file.size,
            mime: file.type,
            percent: 0,
          },
        });
      }

      setRejected(bad);
      if (accepted.length === 0) return;
      setPending((p) => [...p, ...accepted.map((a) => a.item)]);

      // NO CLIENT-SIDE THUMBNAILS, deliberately. The comp draws one from a
      // FileReader data URL, but it only has to survive the length of its own demo.
      // Here the bucket is private (FR-016), so a stored attachment has no URL to
      // render without minting a signed one — that is T022, and it belongs to
      // /admin/orders where the operator actually needs to look at the file. A
      // preview that appears during upload and vanishes the moment it succeeds is
      // worse than a consistent chip, and building one that persists means signing
      // a URL per file on the buyer's own checkout for no purpose.

      // Sequential, not parallel: eight 10MB uploads at once on a phone connection
      // is how you get eight timeouts instead of eight files.
      for (const { file, item } of accepted) {
        const result = await uploadIntakeFile(file, {
          unique: item.id,
          onProgress: (percent) =>
            setPending((p) =>
              p.map((x) => (x.id === item.id ? { ...x, percent } : x))
            ),
        });

        if (result.attachment) {
          setPending((p) => p.filter((x) => x.id !== item.id));
          onChange([...value, result.attachment]);
        } else {
          setPending((p) =>
            p.map((x) =>
              x.id === item.id ? { ...x, error: result.error, percent: 0 } : x
            )
          );
        }
      }
    },
    [disabled, total, value, onChange]
  );

  const setKind = (path: string, kind: 'current' | 'target') => {
    onChange(
      value.map((a) =>
        a.path === path
          ? { ...a, kind: a.kind === kind ? 'unspecified' : kind }
          : a
      )
    );
  };

  const remove = async (path: string) => {
    onChange(value.filter((a) => a.path !== path));
    await removeIntakeFile(path); // best effort; the 7-day sweep is the backstop
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="label mb-2">
        <span className="label-text">
          Show us what you have and what you want
        </span>
      </p>

      {/*
        A div, not a <button>, because a button cannot legally contain the file
        input and the drop affordances, and role=button + keydown is the pattern the
        comp uses. Enter AND Space both activate, which is what a real button does
        and what a keyboard user will try.
      */}
      <div
        role="button"
        tabIndex={disabled || full ? -1 : 0}
        aria-disabled={disabled || full}
        aria-label="Add screenshots or sketches"
        data-testid="intake-dropzone"
        onClick={() => !disabled && !full && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled || full) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={[
          'sh-groove bg-base-100 flex min-h-11 cursor-pointer flex-col items-center',
          'gap-1 rounded-[14px] border border-dashed px-4 py-6 text-center transition',
          dragging ? 'border-primary' : 'border-base-300',
          disabled || full ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <span className="text-base-content text-sm font-semibold">
          {full
            ? `That is ${MAX_FILES} files — the limit`
            : 'Drop screenshots or sketches here'}
        </span>
        <span className="text-base-content text-xs">
          PNG, JPG, WebP, HEIC or PDF · up to 10 MB each · max {MAX_FILES}
        </span>
      </div>

      {/*
        The real control; the div above is its visible proxy. It carries its own
        accessible name and tabIndex={-1} rather than relying on `hidden` to keep it
        out of the accessibility tree — Tailwind's `hidden` is display:none, which
        works in a browser and NOT anywhere the stylesheet is absent. The a11y test
        caught exactly that: axe flagged an unlabelled file input because jsdom
        loads no CSS. Naming it is correct in both environments and costs nothing.
      */}
      <input
        ref={inputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-label="Choose screenshots or sketches to attach"
        accept="image/*,application/pdf,.heic,.heif"
        className="hidden"
        disabled={disabled || full}
        onChange={(e) => {
          void addFiles(e.target.files);
          // Reset so re-selecting the same file fires change again.
          e.target.value = '';
        }}
      />

      {rejected.length > 0 && (
        <p role="alert" className="text-error mt-2 text-xs">
          Rejected: {rejected.join(' · ')}
          <br />
          <span className="text-base-content">
            The bucket enforces these limits server-side too — this check is a
            courtesy, not the control.
          </span>
        </p>
      )}

      {(value.length > 0 || pending.length > 0) && (
        <ul className="mt-3 flex list-none flex-col gap-2 p-0">
          {value.map((a) => (
            <li
              key={a.path}
              className="sh-groove bg-base-100 flex min-w-0 items-center gap-3 rounded-[10px] p-2"
            >
              <span
                aria-hidden="true"
                className="bg-base-200 text-base-content flex h-11 w-11 flex-none items-center justify-center rounded text-[10px] font-semibold"
              >
                {/* No thumbnail for HEIC/PDF — a generic chip, never a broken img. */}
                {a.mime === 'application/pdf'
                  ? 'PDF'
                  : isPreviewable(a.mime)
                    ? 'IMG'
                    : 'FILE'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-base-content block truncate text-sm">
                  {a.name}
                </span>
                <span className="text-base-content block text-xs">
                  {humanSize(a.bytes)} · stored
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {(['current', 'target'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={a.kind === k}
                      disabled={disabled}
                      onClick={() => setKind(a.path, k)}
                      className={[
                        'min-h-11 rounded px-3 text-xs',
                        a.kind === k
                          ? 'sh-btn sh-btn-primary'
                          : 'sh-btn sh-btn-ghost',
                      ].join(' ')}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void remove(a.path)}
                aria-label={`Remove ${a.name}`}
                className="btn btn-ghost min-h-11 min-w-11 flex-none"
              >
                ×
              </button>
            </li>
          ))}

          {pending.map((p) => (
            <li
              key={p.id}
              className="sh-groove bg-base-100 flex min-w-0 items-center gap-3 rounded-[10px] p-2"
            >
              <span
                aria-hidden="true"
                className="bg-base-200 h-11 w-11 flex-none rounded"
              />
              <span className="min-w-0 flex-1">
                <span className="text-base-content block truncate text-sm">
                  {p.name}
                </span>
                {p.error ? (
                  <span role="alert" className="text-error block text-xs">
                    {p.error}
                  </span>
                ) : (
                  <>
                    <span className="text-base-content block text-xs">
                      {humanSize(p.bytes)} · uploading {p.percent}%
                    </span>
                    <progress
                      className="progress progress-primary w-full"
                      value={p.percent}
                      max={100}
                      aria-label={`Uploading ${p.name}`}
                    />
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/*
        Only when there is something to tag. The tag chips render per SUCCESSFULLY
        uploaded file, so before any upload lands — and, worse, when every upload
        has FAILED — this sentence instructed the buyer to use controls that were
        not on the screen. Reported from production the day uploads went live: the
        bucket did not exist, every row showed "Bucket not found", and underneath
        them the page still said "Tag each one".

        Telling someone to do something they cannot see how to do is worse than
        saying nothing; they assume the fault is theirs.
      */}
      {value.length > 0 && (
        <p className="text-base-content mt-2 text-xs">
          Use <strong>What I have</strong> and <strong>What I want</strong> on
          each file above, so we know which is your current site and which is
          the look you&apos;re after — it saves a round of emails.
        </p>
      )}
    </div>
  );
}
