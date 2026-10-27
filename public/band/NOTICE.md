# ScriptHammer, the house band: notice and licences

Everything under `public/band/` (music, portraits, cover art and the lyrics shown on `/band`) is licensed
**CC BY-SA 4.0** (Creative Commons Attribution-ShareAlike 4.0 International,
https://creativecommons.org/licenses/by-sa/4.0/). Credit it as "ScriptHammer, the house band". The site's code stays
under the repository's MIT licence.

## How it was made, said plainly

- **The music is AI-generated.** The songs were made with ACE-Step 1.5 (https://github.com/ace-step/ACE-Step-1.5), whose
  code and model weights are MIT-licensed. ACE-Step states no terms about its output: nothing assigns or restricts
  ownership of generated audio, and nothing requires attribution. Its authors ask that users disclose AI involvement,
  which is what this paragraph does. The prompts name no song, artist, album or label. Whether a purely AI-generated
  recording can be copyrighted at all is a legal question this notice does not settle; the lyrics are the part that is
  clearly the author's to license.
- **The art is AI-assisted.** The seven portraits come from the public repository TortoiseWolfe/wp-dev
  (devscripts/assets), cropped square and lightly brightened. The tool that drew the portraits was not recorded. The
  cover (`public/band/cover/`) and the social card (`og-1200x630.jpg`) were composed in code from those portraits; the
  wagon, moon, lights and borders are SVG drawn for it. No image-generation service was used for the cover.
- **Fonts.** The cover lettering is rendered into the picture from four fonts, all SIL Open Font License 1.1: Rye
  (Sorkin Type Co), Alfa Slab One (The Alfa Slab One Project Authors), Lilita One (Juan Montoreano) and Pirata One
  (Rodrigo Fuenzalida and Nicolas Massi). The font files are not shipped.

## Files

| Path | What |
|---|---|
| `audio/band-wagon-theme.mp3` | The theme song, "The Band Wagon (after hours)", 55 s, 128 kbps |
| `audio/band-wagon-hook.mp3` | The hook, 18 s, 128 kbps |
| `members/<name>-512.webp`, `-700.webp` | Portraits of the seven players |
| `cover/band-wagon-*.{jpg,webp}` | The cover at 600, 1200 and 3000 px |
| `og-1200x630.jpg` | The social card |
