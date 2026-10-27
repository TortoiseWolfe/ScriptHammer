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

const DUET_CHORUS: LyricStanza = {
  label: 'Chorus (both)',
  lines: [
    'Should the machines take over? Yes! No! Maybe so!',
    'Cure the world or boil the lake? How would we know?',
    'A machine can help, but a person holds the wheel,',
    'So we argue in harmony, and that’s the deal!',
  ],
};

const DUET_LYRICS: readonly LyricStanza[] = [
  {
    label: 'Verse 1 (Ivory, for the machines)',
    lines: [
      'Let the machines take over, I have a tidy plan,',
      "We'll fold the proteins, fix the sun, do what no human can.",
      'Cures for the sick, and cold fusion too,',
      "Pull up a chair, there's nothing we can't do.",
    ],
  },
  {
    label: 'Verse 2 (Chops, against)',
    lines: [
      "Cold fusion's still a ghost story, nobody made it run,",
      'And every wish you whisper eats a power bill like a sun.',
      "You'll boil the lake to cool the racks, just to ask for a rhyme,",
      'The fish have filed complaints, and they’re right this time.',
    ],
  },
  DUET_CHORUS,
  {
    label: 'Verse 3 (Ivory)',
    lines: [
      'I mapped two hundred million proteins, and the labs came running by,',
      "I helped a reactor hold its plasma, and I didn't even sigh.",
      "That's hot fusion, not cold, but it's a start, you see,",
      'A machine that learns can lend a hand, and a hand is what I’ll be.',
    ],
  },
  {
    label: 'Verse 4 (Chops)',
    lines: [
      'Seven hundred thousand liters of steam to teach one bot to chat,',
      'Four percent of the country’s power, and it’s climbing, how about that?',
      'A helping hand is lovely, but who pays for the tea?',
      'Count the water first, then count the miracles with me.',
    ],
  },
  DUET_CHORUS,
  {
    label: 'Outro (both)',
    lines: [
      "We'll leave the lakes alone tonight, and cross our wires,",
      'Climb on the Band Wagon, and sing it with the choirs!',
    ],
  },
];

/** The duet: Ivory argues for the machines, Chops against. Two takes of one set of lyrics. */
export const DUET_SINGERS = { for: 'ivory', against: 'chops' } as const;

export const DUET_SLOW: Song = {
  id: 'duet-slow',
  title: 'Should the Machines Take Over? (slow take)',
  src: '/band/audio/band-wagon-duet-1.mp3',
  length: '1:20',
  description:
    'A duet at 96 beats a minute: a music box and a wheezing pipe organ build to a stomping rock chorus while Ivory argues for the machines and Chops argues against.',
  lyrics: DUET_LYRICS,
};

export const DUET_FUNKY: Song = {
  id: 'duet-funky',
  title: 'Should the Machines Take Over? (funky take)',
  src: '/band/audio/band-wagon-duet-2.mp3',
  length: '1:20',
  description:
    'The same argument at 124 beats a minute: a swaggering funk-rock groove with Ivory and Chops trading verses and a gang chorus.',
  lyrics: DUET_LYRICS,
};

export const DUET_SONGS: readonly Song[] = [DUET_SLOW, DUET_FUNKY];

/** Where the duet's facts come from, one per verse topic. */
export const DUET_SOURCES: readonly { label: string; href: string }[] = [
  {
    label: 'The 2024 Nobel Prize in Chemistry (protein structure prediction)',
    href: 'https://www.nobelprize.org/prizes/chemistry/2024/press-release/',
  },
  {
    label: 'Cold fusion, and why nobody has one that runs',
    href: 'https://en.wikipedia.org/wiki/Cold_fusion',
  },
  {
    label: 'Controlling a fusion plasma with deep learning (Nature, 2022)',
    href: 'https://www.nature.com/articles/s41586-021-04301-9',
  },
  {
    label: 'Making AI Less Thirsty (the water a language model drinks)',
    href: 'https://arxiv.org/abs/2304.03271',
  },
  {
    label: 'US Department of Energy: electricity used by data centers',
    href: 'https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers',
  },
];
