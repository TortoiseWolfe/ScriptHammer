---
title: 'The Band Wagon: Meet ScriptHammer, the House Band That Looks Scary and Plays Nice'
author: TortoiseWolfe
date: 2026-10-29
slug: the-band-wagon-house-band
tags:
  - band
  - music
  - ai
  - live-stream
  - open-source
categories:
  - announcements
excerpt: Seven robots, a little scary to look at, who play for everyone. Tonight the house band goes on the air with The Band Wagon, and this post says who they are, how the music and the animation were made, how the votes are counted, and how to book them.
featuredImage: /blog-images/the-band-wagon-house-band/featured.jpg
featuredImageAlt: The Band Wagon cover. Seven robot band members stand in lit arches under the words "The Band Wagon, one night only, every city on earth".
ogImage: /blog-images/the-band-wagon-house-band/featured-og.jpg
ogTitle: 'The Band Wagon: Meet ScriptHammer, the House Band'
ogDescription: Seven robots who look scary and play nice, on the air tonight from 5:30 PM Eastern, first set at 6:00. How the music was made with AI (artificial intelligence), how the votes work, and how to book the band.
twitterCard: summary_large_image
---

# 🎺 The Band Wagon: Meet ScriptHammer, the House Band

_Tonight, Thursday 29 October, ScriptHammer's house band goes on the air. This post says who they are and how they were made. It also tells you how to hear them._

Every site needs a little music. ScriptHammer's [house band](/band) is seven robots who are, by design, **a little scary to look at, and who play for everyone.** The band's tagline sums it up: **Looks scary. Plays nice.**

## 🎸 What a House Band Is

A house band is the group that plays at a venue every night, whoever else is on the bill. ScriptHammer is a free template for building websites, and this is the band that lives in it. The [/band page](/band) holds the songs, the portraits and a ranked list you can vote on.

The music and the art are free to listen to, share and remix. They are licensed under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0, a licence that lets anyone reuse the work if they credit it and share their version the same way). Credit it as "ScriptHammer, the house band". The site's code is under the MIT licence (a permission that lets anyone use, change and share the code for free).

## 🤖 Meet the Band

All seven players use "they" and "them". Their names, instruments and roles come straight from the band's roster file in the [ScriptHammer repository](https://github.com/TortoiseWolfe/ScriptHammer/blob/main/src/lib/band/roster.ts).

| Robot | Plays                         | Role            | In one line                                             |
| ----- | ----------------------------- | --------------- | ------------------------------------------------------- |
| Ivory | Jazz piano and vintage synths | Melody Master   | Finds the tune the rest of the band builds on.          |
| Crash | Full drum kit                 | Pulse Engine    | Keeps the heartbeat under the floorboards.              |
| Chops | Franken-guitar                | Harmonic Hacker | Rewires every riff until it sounds like nobody else.    |
| Reed  | Alto sax                      | Lyrical Breeze  | Plays the line you hum on the way home.                 |
| Brass | Trumpet                       | Frontline Flame | Takes the first note and sets the room on fire.         |
| Verse | Vocoder and mic               | Soul Node       | A screen for a face, and a waveform where a smile goes. |
| Form  | Control surface               | Architect       | Lays out the song, knob by knob and key by key.         |

Ivory leads. Chops is the gravel-voiced skeptic. Verse is the most human of the seven, and Form rarely speaks but always has a hand on the board.

## 🛠️ How It Was Made

**The music is made with AI (artificial intelligence), and every take says so.** The songs come from ACE-Step 1.5 (an open music-generation model whose code and model weights are MIT-licensed). We run it in Docker (software that packages a program with everything it needs) on our own graphics cards. No account and no per-song fee is involved. ACE-Step's authors ask people to say when AI was involved, so every take is labelled "music made with AI", and the [credits page](/credits) says exactly how each piece was made. The prompts name no song, artist, album or label.

**The art is AI-assisted.** The seven portraits come from a public repository, [wp-dev](https://github.com/TortoiseWolfe/wp-dev). The cover was composed in code from those portraits, with the wagon, moon, lights and borders drawn as SVG (Scalable Vector Graphics, pictures made of shapes instead of pixels).

**The drummer plays in time, and we can prove it.** Crash is being built as a three-dimensional model in Blender (free modelling software). We fit the model to the portrait's outline, then key each drum strike to the moment it sounds in the audio. A separate check watches only the finished video and compares each stick hit with the real hit times. On a test drum loop of 53 hits, it found all 53, and the worst miss was 4.9 milliseconds, about 0.15 of one video frame. That test used one loop, so we treat it as a start, not a promise about every song.

**The stream is an ordinary program.** ffmpeg (a free tool for audio and video) plays the songs out to Twitch, and the playout code is in the public [OBS_MCP_bot repository](https://github.com/TortoiseWolfe/OBS_MCP_bot).

## 🗳️ How the Votes Count

The ranked list on [/band](/band) follows one published rule, kept in a small file in the repository, [`band-weights.json`](https://github.com/TortoiseWolfe/ScriptHammer/blob/main/public/data/band-weights.json). Each vote is worth a different amount:

- **A vote on the site** is worth 1, and the site can move a song by at most 25 points either way. Site votes are anonymous and easy to repeat, so they count the least.
- **A Twitch chat vote** is worth 3. Viewers type `!up` or `!down` in chat.
- **A YouTube like or dislike** is worth 3.
- **The owner's review votes** are worth 3.

Twitch and YouTube accounts need a minimum age of 13 and allow one vote per account per song, which is why those votes weigh more. Ties go to plays per day since posting, then to the fewest down votes, then to the title. If the rule ever changes, the new version goes in the file's change log with its date.

## 📅 Tonight's Show, As We Run It

The stream is on the [ScriptHammer Twitch channel](https://www.twitch.tv/scripthammer), free to watch.

- **Thursday 29 October (Eastern time):** on the air from 5:30 PM to 10:00 PM. The opening set starts at **6:00 PM** and the headline set at **8:00 PM**.
- **Saturday 31 October:** the replay, in the same time slots.

Both sets open with Pedal Beat Rave (A minor), Boiler Room Boogie, then a new song, Finding the Bottom. At 6:00 PM the album follows in order, then the votes; at 8:00 PM the votes follow straight away.

Add the show to your calendar with the [calendar file](/band/the-band-wagon.ics). To listen without the stream, find the songs on the Turtle Wolfe [YouTube channel](https://www.youtube.com/@JonathanPohlner).

## 🎤 Book the Band for a Jingle

A jingle is a short song about your business. The band can make one for you:

- **The words are checked against your own material.** We start from what you have already published about your work, and we check every claim in the lyrics against it.
- **It is made on our own hardware.** There are no per-song fees from a music service.
- **The first step is a free 15-minute call.** No price is quoted on this page.

[Book a free 15-minute call](/schedule?from=band) and tell us what you would like the band to sing about.

---

_Looks scary. Plays nice. See you at 6:00 PM._
