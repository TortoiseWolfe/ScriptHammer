---
title: 'What If Your City Were Playable? A Chattanooga Brainstorm'
author: TortoiseWolfe
date: 2026-07-17
slug: playable-city-chattanooga
tags:
  - chattanooga
  - digital-twin
  - civic-tech
  - game-design
  - open-data
categories:
  - ideas
excerpt: A 3D digital twin of Chattanooga left me asking a bigger question. What if the map weren't just to look at, but to play? Explore the idea and weigh in.
featuredImage: /blog-images/playable-city-chattanooga/featured-og.svg
featuredImageAlt: 'A playable civic digital twin of Chattanooga: neighborhoods over the Tennessee River, with a live city-health score'
ogImage: /chatt-atlas-og.jpg
ogTitle: What If Your City Were Playable? A Chattanooga Brainstorm
ogDescription: A speculative, open brainstorm about turning a 3D digital twin of Chattanooga into a participatory civic model, with three questions I need help answering.
twitterCard: summary_large_image
---

# 🌆 What If Your City Were Playable? A Chattanooga Brainstorm

A while back I built a 3D digital twin of Chattanooga. It's about eight thousand buildings at real rooftop heights, floating over the actual street grid and terrain, running in a browser tab. You can [walk the atlas yourself](https://scripthammer.com/chatt/); it's the honest version of the city, drawn from open data with no server behind it.

> 🚲 **Update (August 2026):** the twin isn't read-only anymore. You can now [walk and ride a bike through it](https://scripthammer.com/blog/ride-the-open-source-city) in first person. This post is the brainstorm that came first; that one is where it actually started moving.

Then I made the mistake of leaving it open on a second monitor for a week. And a question started nagging at me that I can't shake:

**What if the map weren't just something you _look at_, but something you _play_?**

This post is me thinking out loud. It isn't a launch or a pitch. It's a brainstorm with the door propped open, because the interesting version of this idea isn't the one I sketch alone. It's the one that gets argued about. There are three specific things I want your help figuring out, and they're near the bottom. Everything before that is me showing you what's rattling around in my head so the questions make sense.

## 🗺️ The twin we already have

Start with what actually exists, because everything else is speculation built on top of it.

The [atlas](https://scripthammer.com/chatt/) is a **[digital twin](https://en.wikipedia.org/wiki/Digital_twin)**: a spatial, data-driven model of a real place. Chattanooga's version stitches together building footprints and street data from [OpenStreetMap](https://www.openstreetmap.org/), rooftop heights from [Light Detection and Ranging (lidar)](https://en.wikipedia.org/wiki/Lidar) surveys, and ground elevation from the [United States Geological Survey 3D Elevation Program (USGS 3DEP)](https://www.usgs.gov/3d-elevation-program). No login, no backend, no invented numbers. Every building sits where the open data says it does, at the height the survey measured.

![The live /chatt atlas: about 8,000 Chattanooga buildings shaded by type over aerial imagery, with the Tennessee River curving through and a pop-up reading 38.7 meters of measured lidar height for one downtown building](/blog-images/playable-city-chattanooga/chatt-atlas.jpg)

_The live atlas. Every building sits where the open data puts it, at the height the lidar measured; that pop-up is reading 38.7 meters off a real downtown address. This read-only twin is the canvas the rest of the post builds on._

Right now the twin is read-only. You fly around, you admire the river, you find your own house. It's a beautiful diorama. But a diorama is a strange thing to build and then leave under glass. The whole promise of a twin is that it's a _model_. And models are for asking "what if."

So the real subject of this post is the layer that doesn't exist yet: **what you'd do with a city once you could act on it, not just look at it.** I've been prototyping two very different answers, fast and rough, just to make the ideas concrete enough to react to.

## 🏙️ From a map you look at to a city you play

The first prototype I call **Model City**. It borrows the interaction grammar of the city-builder video game (think [SimCity](https://en.wikipedia.org/wiki/SimCity) and [Cities: Skylines](https://en.wikipedia.org/wiki/Cities:_Skylines)) and points it at the real Chattanooga instead of an imaginary one.

![A SimCity-style board of eight Chattanooga neighborhoods over the Tennessee River, tinted amber by an equity lens, with a city-health score of 82 out of 100](/blog-images/playable-city-chattanooga/model-city-board.svg)

_Model City (concept mockup): the real neighborhoods as a board you can act on, tinted here by the "equity lens." A sketch to argue with, not a shipping product._

Here's the loop. You pick a real neighborhood: North Shore, Southside, Alton Park, St. Elmo, Highland Park, Brainerd. You propose something for it, maybe a bike lane or bus route, some affordable homes, or a flood basin. In the mockup, the model _would_ show the knock-on effects across six dials: Fiscal, Safety, Health, **Equity**, Mobility, and Mood. There's a "run the next five years forward" button to watch a decision drift over time. Advisors chime in the way they do in the games ("this rezone worsens congestion here"), except these advisors wear local hats: one speaks for transit, one for the budget, and one for the equity board that asks who's getting left behind.

Two things make this more than a toy, and both are worth arguing about.

First, **Equity is weighted highest.** In the prototype, the overall city-health score leans on the equity dial more than any other, and the map has an "equity lens" that recolors every neighborhood by how underserved it is. That's an opinion baked into a game mechanic. It claims that a plan which lifts the whole city but leaves Alton Park behind is a worse plan. Maybe you agree. Maybe you think a civic model has no business encoding that. That tension is _exactly_ the kind of thing I want a playable city to surface instead of hide.

Second, and it's the design principle I care about most:

💡 **Explainable over accurate.** Every number a resident sees should trace back to a stated assumption, not a black box. A model that's directionally honest and legible beats one that's precisely wrong. The goal isn't to predict the future; it's to make tradeoffs _visible_ and _arguable_.

This is where the genre question gets fun, and where I don't know the answer. City-builders are only one branch of the family tree. There's the individual-agent lineage of _The Sims_, where you don't manage a city so much as follow the households inside it. A school closing doesn't subtract points; it makes a specific family move. There's the property-and-consequence logic of Monopoly. There's the resource-and-logistics world of real-time strategy and transport-tycoon games, which, for a city built on a river bend and a railroad junction like Chattanooga, is almost too on the nose. **Rivers and rail lines are the original strategy map.**

I don't know which of those _feels_ like civic participation and which feels like a distraction. That's the first thing I want to ask you about.

## 🧭 You're not the mayor, you're the crew

The second prototype goes the opposite direction, and I think it might be the more important one.

Model City casts you as the planner with the god's-eye view. But most of us aren't the mayor and never will be. So the other prototype, the one I've been calling the **Civic League**, starts from a different sentence: _the city is already running; you're not the mayor, you're the crew._

Instead of simulating decisions, it hands out **missions tied to real open data**. Tag the heights of five buildings on Market Street with a laser app. Name ten streets that OpenStreetMap has left blank. Walk Martin Luther King (MLK) Boulevard and verify twenty half-finished addresses. Capture the Walnut Street Bridge as a 3D [Gaussian splat](https://en.wikipedia.org/wiki/Gaussian_splatting). Ride a [Chattanooga Area Regional Transportation Authority (CARTA)](https://www.gocarta.org/) route and log where the real stops diverge from the published schedule. Photo-document a good rooftop for a [PurpleAir](https://www2.purpleair.com/) air-quality sensor.

![The Civic League board in a dark theme, showing the live city score up top, data vitals including a live air-quality reading, mission cards with point values, and a crew leaderboard down the side](/blog-images/playable-city-chattanooga/civic-league-board.svg)

_Civic League (concept mockup): the mission board and crew leaderboard, rebuilt in ScriptHammer's own theme. The air-quality reading is already live; the rest is a prototype to pressure-test._

Every one of those is a real action against a real feed. And the mechanic that ties it together is simple: **the city has a score, and finishing a mission moves it.** In the prototype, that score is a transparent formula: data completeness, air quality, transit coverage, landmark captures. The air-quality piece is already live, pulled every few minutes from the free [Open-Meteo](https://open-meteo.com/) Air Quality Index (AQI) endpoint. No invented numbers here either; each metric wears a little dot saying whether it's live, simulated, or locally computed.

I love this version because it inverts the usual civic-tech relationship: a neighborhood improving the shared, public picture of _itself_, and watching the number go up because they did the work.

Which brings me to the questions.

## 🎯 The three things I actually need help with

This is where I stop narrating and start asking. I have prototypes; I don't have answers. If you read one section of this post, read this one. Then tell me where I'm wrong.

**1. User Interface / User Experience (UI/UX): what would make you _want_ to take part in your own city?**

Both prototypes look plausible in a screenshot and I still don't know if either is something a normal person would open twice. What interaction makes engaging with your city feel _civic_ rather than gimmicky? Is it the god's-eye planning board? The neighborhood-crew mission list? A map you scribble on? Something on your phone that pings you when a project pops up near your address? What have you used, for your city or any city, that actually felt good, and what felt like homework?

**2. Metrics: what would you want to track, and what would mislead you?**

The prototypes track equity, air quality, tree canopy, transit access, flood risk, median rent, data completeness, mood. That list is a guess. What's missing that you'd actually care about on your block? Which of these is a trap: a number that looks objective but quietly smuggles in a value judgment (like weighting equity highest)? A metric that's easy to game is worse than no metric at all, so I especially want to hear which of these you _don't_ trust.

**3. The community and the score: what could a neighborhood actually _do_ to move its own number?**

This is the one I'm most curious about and least sure of. The Civic League version says the community moves the score by doing real work: mapping a block, hosting a sensor, capturing a landmark. The number becomes a shared scoreboard the neighborhood builds together and can see all the way down to the assumption. But that's just one design. What else could a community legitimately do to raise its city's score? And this is the part I want us to think hard about: how would you keep such a thing **honest, opt-in, and owned by the neighborhood itself**? I'm open to every version of this idea. I'd rather brainstorm it in the open than pretend the question isn't interesting.

## ⚠️ Where this could go wrong

I'd be doing the brainstorm a disservice if I only sold you the upside. A few things worry me, and they're features of the problem, not bugs I can patch:

- **A wrong model can mislead a real decision.** If a simulated impact is confidently incorrect, it can push policy the wrong way. The mitigation is that "explainable over accurate" principle, plus labeling everything as illustrative. The risk never fully goes away.
- **Someone can weaponize a model of "cut this service" or "rezone this block."** Any tool honest enough to be useful is also a tool someone can point at a neighborhood. Governance matters as much as graphics.
- **Scope is a trap.** The full menu of city-builder mechanics I've been sketching is more than twenty deep. That's a research program, not a first version. The discipline is choosing _one_ honest slice (probably "propose a change, see the tradeoffs, leave feedback" over the real map) and resisting the other nineteen.

And one meta note, because this post is meta by nature: these are prototypes I threw together quickly with artificial-intelligence design tools, precisely _so_ they'd be concrete enough to disagree with. The rough edges are the point. The deliverable here isn't a product. It's the conversation.

## 💬 Join the brainstorm

So: three questions, no answers, and an open door. If any of this snagged on something in your brain, I want to hear it. Maybe an interaction you'd want, a metric you don't trust, or a way a community could move its own number that I haven't thought of.

- **Leave a comment right here** on this post. The messy first thought is the useful one.
- **Come find the project at [Chattanooga.Digital](https://chattanooga.digital)**, where this civic-twin work lives and where "join in" is an actual invitation.
- **Open a discussion or an issue** on the [ScriptHammer repository](https://github.com/TortoiseWolfe/ScriptHammer) if you're the kind of person who'd rather file a well-formed thread than write a paragraph.

Go [explore the twin](https://scripthammer.com/chatt/) first if you haven't. It's the shared reference point for all of this. Then tell me what your city should let you do.
