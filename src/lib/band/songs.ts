/**
 * The band's songs and their lyrics, word for word as recorded.
 *
 * Audio and lyrics are CC BY-SA 4.0 (see public/band/NOTICE.md). The music is
 * AI-generated with ACE-Step 1.5.
 */

export interface LyricStanza {
  /** "Verse 1", "Chorus", and so on. */
  label: string;
  lines: readonly string[];
}

export interface Song {
  id: string;
  title: string;
  /** Path under /public; run it through getAssetUrl before use. */
  src: string;
  /** Shown beside the title, e.g. "0:55". */
  length: string;
  description: string;
  lyrics: readonly LyricStanza[];
}

const CHORUS: LyricStanza = {
  label: 'Chorus',
  lines: [
    'Climb on the Band Wagon, the night is ours to play!',
    'Bring a drum, a uke, a pot, a lid, and let them ring away!',
    "Who's on the wagon? Everyone!",
    "Where's the show? Every town!",
    'Climb on the Band Wagon, play it loud!',
  ],
};

export const THEME_SONG: Song = {
  id: 'theme',
  title: 'The Band Wagon (after hours)',
  src: '/band/audio/band-wagon-theme.mp3',
  length: '0:55',
  description:
    'The theme song: a music box and a steam calliope that turn into a crunchy alternative-rock chorus, with a robot vocoder lead and a kids’ shout-back.',
  lyrics: [
    {
      label: 'Verse 1',
      lines: [
        'Midnight in the wagon, the lantern flickers low,',
        "We look like trouble, but we're here for the show.",
        'Crash is on the drums, a heartbeat in the floor,',
        'Brass is on the horn, creaking through the door.',
      ],
    },
    CHORUS,
    {
      label: 'Verse 2',
      lines: [
        'One night, every city, from the east to the west,',
        'Seven ghosts in the wiring never rest.',
        'Book ScriptHammer in your town, the board is on your phone,',
        "You run the sound, and you're never alone.",
      ],
    },
    CHORUS,
  ],
};

export const HOOK: Song = {
  id: 'hook',
  title: 'The hook',
  src: '/band/audio/band-wagon-hook.mp3',
  length: '0:18',
  description:
    'The chorus on its own, short enough to learn on the first listen.',
  lyrics: [
    {
      label: 'Chorus',
      lines: [
        "Who's on the Band Wagon? Everyone!",
        "Where's the show tonight? Every town!",
        'Grab a real drum, a uke, a pot, a lid,',
        'Climb on the Band Wagon, play it loud!',
      ],
    },
  ],
};
