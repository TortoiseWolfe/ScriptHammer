---
title: 'Drag & Drop Dice: The Component That Started as a Joke'
slug: 'dice-tray-draggable-components'
excerpt: 'We built draggable dice for fun. Then it became our most loved feature.'
author: 'TortoiseWolfe'
publishDate: 2025-10-22
status: 'published'
featured: false
categories:
  - Components
  - Games
  - Interactive
tags:
  - dice
  - drag-drop
  - components
  - games
  - interactive
readTime: 7
ogImage: '/blog-images/2025-10-22-dice-tray-draggable-components.png'
---

# Drag & Drop Dice: The Component That Started as a Joke

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## Friday Afternoon Foolishness 🎲

"What if we made draggable dice?"
"Why?"
"Why not?"

4 hours later: Full physics simulation with shadows.

Monday morning: "Can we use this for decision making?"

## The Component Nobody Asked For (But Everyone Loved)

```tsx
<DiceTray>
  <Dice type="d6" draggable />
  <Dice type="d20" draggable />
  <DiceRoller onRoll={handleResult} />
</DiceTray>
```

Drag them. Drop them. Roll them. Feel the satisfaction.

## The Physics That Feel Real 🌟

```tsx
// Gravity and momentum
const handleDrag = (e) => {
  velocity.current = {
    x: e.clientX - lastPos.x,
    y: e.clientY - lastPos.y,
  };
};

const handleDrop = () => {
  // Dice continues moving with momentum
  animateDice(velocity.current);
  // Gradually slows down
  // Bounces off edges
  // Settles naturally
};
```

It's unnecessarily realistic. That's the point.

## The Tray That Knows Boundaries 📦

```tsx
<DiceTray bounded>
  {/* Dice can't escape */}
  {/* They bounce off walls */}
  {/* Stack naturally */}
</DiceTray>
```

Container queries detect edges.
Dice respect boundaries.
Physics handles the rest.

## Multi-Touch Magic ✨

```tsx
// Drag multiple dice simultaneously
<DiceTray multiSelect>
  <Dice id="1" />
  <Dice id="2" />
  <Dice id="3" />
</DiceTray>

// On mobile: Use multiple fingers
// On desktop: Ctrl+click to select
// Drag them all at once
```

## The Roll Animation That Sells It 🎬

```tsx
const rollDice = async () => {
  // 1. Dice jumps up
  await animate({ y: -100 });

  // 2. Spins randomly
  await animate({
    rotateX: random(720, 1440),
    rotateY: random(720, 1440),
  });

  // 3. Lands with bounce
  await animate({
    y: 0,
    bounce: 0.5,
  });

  // 4. Settles on result
  showResult(finalValue);
};
```

The animation takes 1.2 seconds.
Users watch every millisecond.

## Unexpected Use Cases 🎯

**Original intent**: Fun Easter egg

**Actual usage**:

- Team standup: "Who goes first?" _rolls dice_
- Decision making: "Should we refactor?" _rolls d20_
- Break timer: "Roll for break length!"
- Conflict resolution: "Highest roll wins"

## The Accessibility Win ♿

```tsx
<Dice
  draggable
  aria-label="Six-sided die, showing 4"
  onKeyPress={(e) => {
    if (e.key === 'Space') roll();
    if (e.key === 'Enter') grab();
  }}
/>
```

Keyboard controls:

- Space: Roll dice
- Enter: Pick up
- Arrows: Move
- Escape: Drop

## Performance Tricks 🚀

```tsx
// Use transform, not position
transform: translate3d(${x}px, ${y}px, 0)

// GPU acceleration
will-change: transform;

// RequestAnimationFrame for smooth 60fps
const animate = () => {
  updatePosition();
  requestAnimationFrame(animate);
};
```

## The Social Proof 💬

"The dice alone made me choose this template" - Reddit

"I don't need dice but I can't stop playing" - Twitter

"We use it for all team decisions now" - Actual client

## Build Your Own Game

```bash
docker compose exec scripthammer pnpm generate:component DiceTray
```

Start with dice. Add cards. Build anything.

Because work should have a little play.
