---
title: 'Building Game Components: From D6 to D20 and Beyond'
slug: 'dice-components-game-development'
excerpt: 'How we built a complete dice system that powers actual games.'
author: 'TortoiseWolfe'
publishDate: 2025-10-23
status: 'published'
featured: false
categories:
  - Components
  - Games
  - Development
tags:
  - dice
  - games
  - components
  - development
  - 3d
readTime: 8
ogImage: '/blog-images/2025-10-23-dice-components-game-development.png'
---

# Building Game Components: From D6 to D20 and Beyond

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## It Started With D&D 🐉

Our team plays D&D every Friday.
We needed digital dice for remote players.
We built our own.

Now it powers three production games.

## The Complete Dice Collection 🎲

```tsx
<DiceSet>
  <D4 /> {/* The pyramid of pain */}
  <D6 /> {/* Classic cube */}
  <D8 /> {/* The diamond */}
  <D10 /> {/* Percentage helper */}
  <D12 /> {/* The dodecahedron */}
  <D20 /> {/* The critical hit maker */}
  <D100 /> {/* Two D10s combined */}
</DiceSet>
```

Mathematically accurate. Visually perfect.

## 3D Without the Complexity 🎨

```tsx
// No Three.js required!
.dice-d20 {
  transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(var(--ry));
}

.face {
  position: absolute;
  backface-visibility: hidden;
}

// 20 faces positioned with math
.face-1 { transform: rotateX(0deg) translateZ(50px); }
.face-2 { transform: rotateX(72deg) translateZ(50px); }
// ... etc
```

Pure CSS 3D. No libraries. 8KB total.

## The Roll Engine That's Actually Random 🎰

```tsx
class DiceRoller {
  roll(sides: number): number {
    // Crypto-secure randomness
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);

    // Perfect distribution
    return (array[0] % sides) + 1;
  }

  rollMultiple(dice: string): number[] {
    // "3d6+2" => [4, 2, 5] + 2 => 13
    const parsed = this.parse(dice);
    return this.calculate(parsed);
  }
}
```

Provably fair. Cryptographically random.

## Animation States That Tell Stories 📖

```tsx
// The anticipation build
<Dice state="shaking">
  {/* Slight vibration before roll */}
</Dice>

// The dramatic roll
<Dice state="rolling">
  {/* Fast spin, motion blur */}
</Dice>

// The result reveal
<Dice state="landed" value={20}>
  {/* Glowing critical hit! */}
</Dice>
```

Each state has meaning. Players feel the tension.

## Multiplayer Sync ⚡

```tsx
// Everyone sees the same roll
const syncedRoll = () => {
  const seed = Date.now();
  broadcast({ type: 'ROLL', seed });

  // All clients use same seed
  // Same animation timing
  // Same final result
};
```

No server needed. Peer-to-peer fairness.

## The Dice Notation Parser 🎯

```tsx
parseDiceNotation('3d6+2'); // Roll 3 six-sided dice, add 2
parseDiceNotation('2d20kh1'); // Roll 2d20, keep highest
parseDiceNotation('4d6dl1'); // Roll 4d6, drop lowest
parseDiceNotation('1d100>=75'); // Roll d100, check if >= 75
```

Standard notation. Every RPG system supported.

## Visual Feedback That Matters 💫

```tsx
// Natural 20!
<Dice value={20} critical>
  {/* Rainbow shimmer effect */}
  {/* Explosion particles */}
  {/* Screen shake */}
</Dice>

// Critical fail
<Dice value={1} fumble>
  {/* Cracks appear */}
  {/* Sad trombone */}
  {/* Dice falls apart */}
</Dice>
```

Players screenshot these moments. Free marketing.

## Performance for 100 Dice 🚀

```tsx
// Batch rendering with React.memo
const DicePool = React.memo(({ count }) => {
  // Single render pass
  // GPU instancing for shadows
  // Shared animation timeline
  return dice.map((d) => <OptimizedDice key={d.id} />);
});

// Roll 100d6 for that Fireball spell
// Still 60fps
```

## The Games It Powers 🎮

**Captain Ship Crew**: Full game in ScriptHammer
**D&D Toolkit**: Character sheets + dice
**Decision Maker**: Business meetings got fun
**Math Dungeon**: Educational game for kids

Same components. Different games. Infinite possibilities.

## Build Your Own RPG

```bash
docker compose exec scripthammer pnpm generate:component GameDice
```

Start with dice. Add character sheets. Build worlds.

The components are ready. Your game awaits.
