/**
 * The band's client jingle samples, shown on /band.
 *
 * The two takes are the pair approved by ear on 2026-11-07. They are a client
 * commission, so unlike the house songs they are not released under the
 * CC BY-SA licence in public/band/NOTICE.md.
 */

export interface Jingle {
  id: string;
  title: string;
  /** Path under /public; run it through getAssetUrl before use. */
  src: string;
  /** The name the browser suggests when the listener downloads the file. */
  downloadName: string;
  /** Shown beside the title, e.g. "0:10". */
  length: string;
  description: string;
}

/**
 * Placeholder until the client's own wording arrives. Keep this as one line so
 * swapping in the approved credit is a single change.
 */
export const JINGLE_CLIENT_CREDIT =
  'A jingle the band made for Estimify, the app contractors use to price jobs.';

/** What a jingle is, in one plain line (the blog's wording). */
export const JINGLE_INTRO =
  'A jingle is a short song about your business, written and recorded by the band.';

export const JINGLES: readonly Jingle[] = [
  {
    id: 'estimify-hook',
    title: 'The hook',
    src: '/band/audio/estimify-jingle-hook.mp3',
    downloadName: 'estimify-jingle-hook.mp3',
    length: '0:10',
    description: 'The short cut: the part that sticks after one listen.',
  },
  {
    id: 'estimify-full',
    title: 'The full jingle',
    src: '/band/audio/estimify-jingle-full.mp3',
    downloadName: 'estimify-jingle-full.mp3',
    length: '0:27',
    description: 'The whole thing, with room for the name and the work.',
  },
];
