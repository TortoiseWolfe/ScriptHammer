---
title: 'Why Build One Game When You Can Build All the Games?'
author: TortoiseWolfe
date: 2026-08-09
slug: ride-the-open-source-city
seoTitle: 'Why Build 1 Game? Build an Open-Source Three.js Game Engine'
seoDescription: 'Learn to build browser games on an open-source Three.js game engine. Explore a playable 3D city, then help build the engine that makes all the games.'
keywords:
  - three.js game engine
  - open source game engine
  - react three fiber
  - javascript game engine
  - learn game development
  - indie game dev
tags:
  - three-js
  - game-engine
  - open-source
  - react-three-fiber
  - game-dev
  - indie
categories:
  - features
excerpt: 'You have a notebook full of game ideas and zero shipped, because each one means re-solving physics, camera, materials, and sound. Build the engine once and get all the games. Here is an open-source Three.js game engine, a playable city built on it, and an open invitation to help build the rest.'
featuredImage: /blog-images/ride-the-open-source-city/featured-og.png
featuredImageAlt: 'Open-source Three.js game engine: a tilt-shift 3D city built with React Three Fiber, under the headline Build all the games'
ogImage: /blog-images/ride-the-open-source-city/featured-og.png
ogTitle: 'Build All the Games: An Open-Source Three.js Game Engine'
ogDescription: 'A free, MIT, asset-free Three.js + React Three Fiber game engine, with a playable 3D city as the demo. Learn best practices and help build it.'
twitterCard: summary_large_image
---

# 🕹️ Why Build One Game When You Can Build All the Games?

You have a notebook — or a Notes app, or a Discord full of half-finished pitches — with ten game ideas in it. You have shipped zero. Not because the ideas are bad, but because every single one starts in the same place: collision, a camera that doesn't make people seasick, materials that aren't flat gray, footstep sounds, a sky. You burn three weekends re-solving the boring 20% and never reach the part that was actually your idea.

So here is the bet I am making out loud: **don't build one game. Build the engine that builds all of them.** Solve the boring 20% once, in the open, and every idea after that gets cheaper.

It is real, it is open source ([React Three Fiber](https://r3f.docs.pmnd.rs/) on [Three.js](https://threejs.org/)), and you can [clone it today](https://github.com/TortoiseWolfe/ScriptHammer). And because a game engine with no game is just a README, I built a whole playable 3D city on it as proof. You can **[walk it right now](https://scripthammer.com/chatt/?diorama&walk)** — first person, in a browser tab, nothing to install.

![Open-source Three.js game engine running a tilt-shift 3D city built from real open data](/blog-images/ride-the-open-source-city/diorama.png)

_The city is the demo, not the point. The point is the engine underneath it — the same one that runs [a bare test level](https://scripthammer.com/game/cod-skeleton) with no city at all._

## 🎮 The engine is the actual point

The thing that makes any of this move is a small, honestly-scoped game toolkit called **CoD**. It is **asset-free and procedural**: the materials, sky, and sound are generated on your graphics card and CPU at load time, so it ships **zero** texture, model, or audio files. That is why a whole playable city fits on a static site with no server behind it, and why cloning it doesn't mean downloading a gigabyte of assets.

Here is what it actually gives you today, and it is more than a tech demo:

- 🧱 **Physics and collision** — a fast static-world spatial index plus swept-capsule collide-and-slide, so you don't fall through walls or tunnel through corners.
- 🚶 **A first-person controller** — walk, sprint, crouch, go prone under a low overhang, and hop on a **bike**. Real ground contact and step-ups.
- 🎨 **A procedural material forge** — physically-based textures (color, normal, roughness) generated on the fly, no image files.
- 🌤️ **An atmospheric sky with image-based lighting**, procedural **footstep and ambient audio**, **graphics-card particles** (dust, weather), and **camera feel** (head-bob, landing punch) — the small stuff that makes a scene feel alive.
- ⚙️ **An event bus and four quality tiers** (`?q=low` … `ultra`) so it scales from a laptop to a desktop.

It is **[Massachusetts Institute of Technology (MIT) licensed](https://opensource.org/license/mit)** and vendored from Matt Shumer's [Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) — full credit to him for the original. In your own code it is one import: `@/lib/cod`.

Now the honest part, because overpromising is exactly the thing I want to teach you to spot: **this is not a finished general-purpose engine, and I am not going to pretend it is.** Today it is a strong _first-person, 3D, walking-and-riding_ foundation. It has **no** entity system, **no** save format, **no** multiplayer, **no** 2D, and **no** model or animation loaders yet. "All the games" is the _ambition_, not a shipped fact. That gap is not a disclaimer — **it is the invitation.** Come build the missing layers with people who will review your work.

## 🏙️ Proof it's reusable, not a one-off

A toolkit that only runs the thing its author built is a lie you tell yourself. So here is the check: the exact same engine drives **two completely different scenes**.

One is a bare [test level](https://scripthammer.com/game/cod-skeleton) — a floor, a step, a wall, a crate, and a low bar you have to crouch under. No city, no data, just the engine proving it walks, collides, and crouches.

The other is [Chattanooga](https://scripthammer.com/chatt/?diorama&walk): roughly **8,000 buildings** at real rooftop heights, pulled from [OpenStreetMap](https://www.openstreetmap.org/) footprints, lidar heights, and [United States Geological Survey](https://www.usgs.gov/3d-elevation-program) elevation. Same physics, same controller, same sky and audio, pointed at a real city instead of a box. If it can carry 8,000 real buildings and a bike, it can carry your idea.

## 🧪 It's a beta — here's the first bug

Shipping something rough and asking people to break it is itself a best practice, so let me practice it. Right now, first-person Walk mode has a real bug: sometimes it spawns you **below the city** and you just fall — the whole thing hangs above you like a floating island while you drop through the sky. I hit it myself:

![First-person Walk mode: the bicycle drops through the sky while the Chattanooga diorama floats above it, because the spawn point is placed below the city](/blog-images/ride-the-open-source-city/walk-fall-bug.png)

_You press B to ride the bike, and the bike rides off through the sky. Spawned below the city, falling — at a smooth 60 fps, so the frame rate is fine and the spawn is just wrong. This is the reason to play a beta, not the reason to skip it._

So I did the exact thing I am about to ask you to do. I filed it as a bug report: **[issue #651](https://github.com/TortoiseWolfe/ScriptHammer/issues/651)**. Open it and look at the _shape_ of it, because that shape is the whole ask:

- **Where** you were — the URL (`/chatt?diorama&walk`).
- **What you did** — opened it, clicked to look, pressed WASD.
- **What you expected** vs **what actually happened** — "spawn on the street" vs "fell through the sky."
- **Your setup** — browser and graphics card. It matters more than you'd think; the same scene runs very differently on different hardware.
- **A screenshot**, if you can grab one.

That's it. A boring, specific report like that is worth more than a hundred "it's broken" messages.

Here's the ask, concretely:

1. 🎯 **[Play it](https://scripthammer.com/chatt/?diorama&walk)** — and yes, you might fall through the world first. Try anyway: press **B** for the bike, **V** to watch yourself go.
2. 🐛 **File what broke** on the [issues page](https://github.com/TortoiseWolfe/ScriptHammer/issues), in the shape above. Finding a new one is genuinely helpful.
3. 💬 **Not sure it's worth a full report?** File it anyway — a rough note beats staying quiet.

## 🧠 The skill isn't prompting. It's telling slop from craft.

Honest meta-layer, since this is a teaching project: AI helped build a lot of this, including drafts of this post. Left unchecked, AI produces **slop** — output that reads right and is confidently wrong. This post tried it. An early draft cheerfully told you to "ride a bike through downtown." You just saw the screenshot: the bike drops you through the sky. The sentence was fluent. It was also false.

Fluent versus true is the whole game, and it's the actual skill I want to teach — not "how do I prompt the robot," but "how do I know if what came out is real?"

- **Slop** says "it works." **Craft** writes a test that fails when it doesn't.
- **Slop** makes a confident claim. **Craft** checks it against the source and links it.
- **Slop** hides the rough edge. **Craft** files the bug with steps to reproduce, like [#651](https://github.com/TortoiseWolfe/ScriptHammer/issues/651).
- **Slop** invents specifics. **Craft** says "I don't know yet," then finds out.

None of that is advanced. It is verifying before you ship, reading the code you paste, and being willing to write "this is broken" in public. A real game engine is a great place to learn it, because the game either runs or it doesn't — the feedback is honest whether you like it or not.

## 🚀 You don't need money to get in

Back to you and your notebook of ideas. Here's the part I care about most: **the price of admission isn't cash.** Learning is free, and the most valuable thing you can bring to an open-source engine isn't a credit card — it's another set of eyes and another game idea stress-testing it.

The cheapest way in is also the best one. [Clone ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer), read the source, and [watch me build it live on Twitch](https://twitch.tv/TurtleWolfe). It is MIT — take it, ship it, keep it. No dollars required, ever.

Short on cash? **Trade instead.** Playtest this and file a good bug. Fork it and prototype your idea. Build one of those missing layers — a save system, a third-person camera, an enemy. Every playtester is another set of eyes, every fork is street cred you earn in public, and more people in the project make the engine better for everyone.

If you'd rather have hands-on help on _your_ game, there's a paid lane too: live **Office Hours** (bring a goal, leave with something running, the recording is yours to keep), and [Field Study](https://scripthammer.com/pricing) for a bigger build done with you. Prices are on the [pricing page](https://scripthammer.com/pricing), and if cash is tight, see two paragraphs up — trade instead. The paid tiers exist to fund the free ones, not to gate them.

## 💬 Come build it

- 🎮 **[Try the engine demo](https://scripthammer.com/game/cod-skeleton)** — the bare test level, no city.
- 🚲 **[Play the city](https://scripthammer.com/chatt/?diorama&walk)** — first person, press **B** for the bike.
- 📦 **[Clone the engine](https://github.com/TortoiseWolfe/ScriptHammer)** — MIT, asset-free, `@/lib/cod`.
- 📺 **[Watch me build it live](https://twitch.tv/TurtleWolfe)** — on Twitch, with the replays on [YouTube](https://youtube.com/@JonathanPohlner).
- 💳 **[See what help costs](https://scripthammer.com/pricing)** — free to Office Hours to done-for-you.
- 📅 **[Book 15 minutes](https://calendly.com/turtlewolfe/15min-1)** — bring a screenshot of what you have in mind.
- 🗺️ **[Read the brainstorm that started this](https://scripthammer.com/blog/playable-city-chattanooga)**.

Find me everywhere: [scripthammer.com](https://scripthammer.com) · [Twitch](https://twitch.tv/TurtleWolfe) · [YouTube](https://youtube.com/@JonathanPohlner) · [X](https://twitter.com/JonPohlner) · [LinkedIn](https://linkedin.com/in/pohlner) · [GitHub](https://github.com/TortoiseWolfe)

Then tell me in the comments: what's the one game in your notebook you'd build first if the boring 20% were already done?
