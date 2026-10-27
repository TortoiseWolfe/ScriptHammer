/**
 * ScriptHammer, the house band: seven animatronic bots.
 *
 * Kept out of src/twin, src/stage, src/world and src/lib/cod on purpose, so the
 * first-load budget's three.js gate ignores it and a later 3D stage can import it
 * without pulling the page into the 3D chunk.
 *
 * Roster source: TortoiseWolfe/wp-dev, devscripts/scripthammer.sh. Pronouns are
 * "they" for every member; none has been given.
 */

export interface BandMember {
  /** Lowercase, unique. Also the portrait file stem. */
  slug: string;
  name: string;
  instrument: string;
  /** The band's own name for what they do. */
  role: string;
  /** One line for the card. */
  blurb: string;
  /** Path under /public; run it through getAssetUrl before use. */
  portrait512: string;
  portrait700: string;
  /** Describes the picture, not the person. */
  alt: string;
}

export const BAND_NAME = 'ScriptHammer';
export const BAND_TAGLINE = 'Looks scary. Plays nice.';

export const ROSTER: readonly BandMember[] = [
  {
    slug: 'ivory',
    name: 'Ivory',
    instrument: 'Jazz piano and vintage synths',
    role: 'Melody Master',
    blurb: 'Finds the tune the rest of the band builds on.',
    portrait512: '/band/members/ivory-512.webp',
    portrait700: '/band/members/ivory-700.webp',
    alt: 'Ivory, a cream-colored robot with glowing blue eyes and a ribbed chest panel, gripping the handlebars of an old bicycle.',
  },
  {
    slug: 'crash',
    name: 'Crash',
    instrument: 'Full drum kit',
    role: 'Pulse Engine',
    blurb: 'Keeps the heartbeat under the floorboards.',
    portrait512: '/band/members/crash-512.webp',
    portrait700: '/band/members/crash-700.webp',
    alt: 'Crash, a brass robot with round glowing eyes and a cap-like helmet, drumsticks raised over a drum kit with cymbals.',
  },
  {
    slug: 'chops',
    name: 'Chops',
    instrument: 'Franken-guitar',
    role: 'Harmonic Hacker',
    blurb: 'Rewires every riff until it sounds like nobody else.',
    portrait512: '/band/members/chops-512.webp',
    portrait700: '/band/members/chops-700.webp',
    alt: 'Chops, a boxy-headed robot with two square glowing eyes, playing a worn, patched-together electric guitar.',
  },
  {
    slug: 'reed',
    name: 'Reed',
    instrument: 'Alto sax',
    role: 'Lyrical Breeze',
    blurb: 'Plays the line you hum on the way home.',
    portrait512: '/band/members/reed-512.webp',
    portrait700: '/band/members/reed-700.webp',
    alt: 'Reed, a robot in a long coat with headphones and glowing eyes, holding an alto saxophone.',
  },
  {
    slug: 'brass',
    name: 'Brass',
    instrument: 'Trumpet',
    role: 'Frontline Flame',
    blurb: 'Takes the first note and sets the room on fire.',
    portrait512: '/band/members/brass-512.webp',
    portrait700: '/band/members/brass-700.webp',
    alt: 'Brass, a riveted golden robot with goggle-like eyes, blowing a trumpet with its flared bell pointed to the right.',
  },
  {
    slug: 'verse',
    name: 'Verse',
    instrument: 'Vocoder and mic',
    role: 'Soul Node',
    blurb: 'A screen for a face, and a waveform where a smile goes.',
    portrait512: '/band/members/verse-512.webp',
    portrait700: '/band/members/verse-700.webp',
    alt: 'Verse, a robot whose monitor-shaped head shows a glowing sound wave, holding a microphone.',
  },
  {
    slug: 'form',
    name: 'Form',
    instrument: 'Control surface',
    role: 'Architect',
    blurb: 'Lays out the song, knob by knob and key by key.',
    portrait512: '/band/members/form-512.webp',
    portrait700: '/band/members/form-700.webp',
    alt: 'Form, a blocky robot with a grille for a face and a chest covered in knobs, keys and buttons, hands on the handlebars of a bicycle.',
  },
];
