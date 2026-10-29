import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BandSongVote from './BandSongVote';
import { VOTE_KEY_PREFIX } from '@/lib/band/vote';

const ENDPOINT = {
  url: 'https://example.supabase.co/rest/v1/rpc/cast_band_vote',
  key: 'anon-key',
};

const answer = (v: string) =>
  vi.fn(async () => new Response(JSON.stringify(v), { status: 200 }));

beforeEach(() => window.localStorage.clear());

describe('BandSongVote', () => {
  it('renders nothing when voting is not open', () => {
    const { container } = render(
      <BandSongVote songId="n05" title="The Night Watch" endpoint={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the song on both buttons', () => {
    render(
      <BandSongVote songId="n05" title="The Night Watch" endpoint={ENDPOINT} />
    );
    expect(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Down vote for The Night Watch' })
    ).toBeInTheDocument();
  });

  it('sends one request, remembers the vote on the device, and sets no cookie', async () => {
    const f = answer('ok');
    render(
      <BandSongVote
        songId="n05"
        title="The Night Watch"
        endpoint={ENDPOINT}
        doFetch={f as unknown as typeof fetch}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You voted up')
    );
    expect(f).toHaveBeenCalledTimes(1);
    expect(document.cookie).toBe('');
    expect(
      JSON.parse(window.localStorage.getItem(`${VOTE_KEY_PREFIX}n05`)!)
    ).toEqual({
      dir: 'up',
      changed: false,
    });
    expect(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('blocks a second click on the same choice without a second request', async () => {
    const f = answer('ok');
    render(
      <BandSongVote
        songId="n05"
        title="The Night Watch"
        endpoint={ENDPOINT}
        doFetch={f as unknown as typeof fetch}
      />
    );
    const up = screen.getByRole('button', {
      name: 'Up vote for The Night Watch',
    });
    await userEvent.click(up);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You voted up')
    );
    await userEvent.click(up);
    expect(f).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Your vote is up.');
  });

  it('allows one change, then locks both buttons', async () => {
    const f = answer('ok');
    render(
      <BandSongVote
        songId="n05"
        title="The Night Watch"
        endpoint={ENDPOINT}
        doFetch={f as unknown as typeof fetch}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You voted up')
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Down vote for The Night Watch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Changed to down')
    );
    expect(f).toHaveBeenCalledTimes(2);
    const body = JSON.parse(
      (f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body).toEqual({
      p_song_id: 'n05',
      p_direction: 'down',
      p_previous: 'up',
    });
    expect(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Down vote for The Night Watch' })
    ).toBeDisabled();
  });

  it('reads an earlier vote from the device on load', async () => {
    window.localStorage.setItem(
      `${VOTE_KEY_PREFIX}n05`,
      JSON.stringify({ dir: 'down', changed: true })
    );
    render(
      <BandSongVote songId="n05" title="The Night Watch" endpoint={ENDPOINT} />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Down vote for The Night Watch' })
      ).toHaveAttribute('aria-pressed', 'true')
    );
    expect(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    ).toBeDisabled();
  });

  it('keeps no flag when the server says try again later', async () => {
    const f = answer('later');
    render(
      <BandSongVote
        songId="n05"
        title="The Night Watch"
        endpoint={ENDPOINT}
        doFetch={f as unknown as typeof fetch}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Up vote for The Night Watch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Try again later')
    );
    expect(window.localStorage.getItem(`${VOTE_KEY_PREFIX}n05`)).toBeNull();
  });

  it('keeps no flag when the request fails', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    render(
      <BandSongVote
        songId="n05"
        title="The Night Watch"
        endpoint={ENDPOINT}
        doFetch={f as unknown as typeof fetch}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Down vote for The Night Watch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('did not go through')
    );
    expect(window.localStorage.getItem(`${VOTE_KEY_PREFIX}n05`)).toBeNull();
  });
});
