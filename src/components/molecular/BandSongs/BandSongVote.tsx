'use client';

import React, { useEffect, useState } from 'react';
import {
  planVote,
  readFlag,
  sendVote,
  voteEndpoint,
  writeFlag,
  type Direction,
  type VoteEndpoint,
  type VoteFlag,
} from '@/lib/band/vote';

export interface BandSongVoteProps {
  songId: string;
  title: string;
  /** Pin the endpoint (tests). Left out, the build's Supabase address decides. */
  endpoint?: VoteEndpoint | null;
  /** Pin the request function (tests). */
  doFetch?: typeof fetch;
}

const CHOICE =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border-2 border-[#b5873a] px-4 py-2 text-base font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#f6ecd0] disabled:cursor-not-allowed disabled:opacity-60';

function Arrow({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={up ? '' : 'rotate-180'}
    >
      <path d="M7 2 L13 12 L1 12 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Up and down buttons for one song. The vote is anonymous: one request to the
 * site's own Supabase function; the visitor's own choice lives in this browser's
 * storage only. One vote per song per device; a visitor may change it once.
 */
export default function BandSongVote({
  songId,
  title,
  endpoint,
  doFetch,
}: BandSongVoteProps) {
  const [target] = useState<VoteEndpoint | null>(() =>
    endpoint === undefined ? voteEndpoint() : endpoint
  );
  const [flag, setFlag] = useState<VoteFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFlag(readFlag(songId));
  }, [songId]);

  if (!target) return null;

  const cast = async (dir: Direction) => {
    const plan = planVote(flag, dir);
    if (plan.kind === 'same') {
      setMessage(`Your vote is ${dir}.`);
      return;
    }
    if (plan.kind === 'blocked') {
      setMessage('You already changed your vote. It stays.');
      return;
    }
    setBusy(true);
    const result = await sendVote(target, songId, dir, plan.previous, doFetch);
    setBusy(false);
    if (result === 'later') {
      setMessage('Lots of votes right now. Try again later.');
      return;
    }
    if (result === 'error') {
      setMessage('The vote did not go through. Try again.');
      return;
    }
    const next: VoteFlag = { dir, changed: plan.kind === 'change' };
    writeFlag(songId, next);
    setFlag(next);
    setMessage(
      next.changed
        ? `Changed to ${dir}. Thank you.`
        : `Thank you. You voted ${dir}. You can change it once.`
    );
  };

  const locked = busy || flag?.changed === true;
  const pick = (dir: Direction) =>
    `${CHOICE} ${
      flag?.dir === dir
        ? 'bg-[#f5b335] text-[#14172b]'
        : 'bg-[#14172b] text-[#f6ecd0] hover:bg-[#2a2f52]'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="song-vote">
      <button
        type="button"
        className={pick('up')}
        aria-pressed={flag?.dir === 'up'}
        aria-label={`Up vote for ${title}`}
        disabled={locked}
        onClick={() => cast('up')}
      >
        <Arrow up />
        Up
      </button>
      <button
        type="button"
        className={pick('down')}
        aria-pressed={flag?.dir === 'down'}
        aria-label={`Down vote for ${title}`}
        disabled={locked}
        onClick={() => cast('down')}
      >
        <Arrow up={false} />
        Down
      </button>
      <span role="status" className="text-base leading-snug">
        {message}
      </span>
    </div>
  );
}
