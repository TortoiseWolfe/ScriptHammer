import React from 'react';
import { getAssetUrl } from '@/config/project.config';
import type { Song } from '@/lib/band/songs';

export interface ThemeSongPlayerProps {
  /** The song to play. */
  song: Song;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ThemeSongPlayer component
 *
 * A native audio player with the song's lyrics in a closed details element.
 * No autoplay and no preloading: the file is fetched when the visitor presses
 * play. Sits on the fixed night-stage colours of /band.
 *
 * @category molecular
 */
export default function ThemeSongPlayer({
  song,
  className = '',
}: ThemeSongPlayerProps) {
  const titleId = `song-title-${song.id}`;
  return (
    <section
      aria-labelledby={titleId}
      data-testid="song-player"
      className={`theme-song-player rounded-2xl border border-[#3a3f66] bg-[#1c1f34] p-5 text-[#f6ecd0] shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)] sm:p-6${className ? ` ${className}` : ''}`}
    >
      <h3
        id={titleId}
        className="sh-font-special-elite !m-0 !text-2xl text-balance text-[#f5b335]"
      >
        {song.title}{' '}
        <span className="mt-1 block font-sans text-lg font-normal text-[#f6ecd0]">
          ({song.length})
        </span>
      </h3>
      <p className="!mt-2 !mb-4 max-w-[68ch] text-lg leading-[1.65]">
        {song.description}
      </p>
      <audio
        controls
        preload="none"
        src={getAssetUrl(song.src)}
        aria-label={`${song.title}, ${song.length}`}
        className="w-full"
      >
        Your browser cannot play audio.
      </audio>
      <p className="!mt-3 !mb-0">
        <a
          href={getAssetUrl(song.src)}
          download
          className="inline-flex min-h-11 items-center text-lg font-semibold text-[#f5b335] underline underline-offset-4"
        >
          Download {song.title} (MP3)
        </a>
      </p>
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-[#f5b335] underline underline-offset-4">
          Lyrics
        </summary>
        <div className="mt-2 flex max-w-[68ch] flex-col gap-4">
          {song.lyrics.map((stanza, i) => (
            <div key={`${stanza.label}-${i}`}>
              <h4 className="!m-0 text-lg font-semibold text-[#f5b335]">
                {stanza.label}
              </h4>
              <p className="!m-0 text-lg leading-[1.65] whitespace-pre-line">
                {stanza.lines.join('\n')}
              </p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
