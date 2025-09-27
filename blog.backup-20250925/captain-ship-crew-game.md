---
title: 'Captain Ship Crew: A Complete Game Built with Components'
slug: 'captain-ship-crew-game'
excerpt: 'How atomic design principles created a full multiplayer dice game.'
author: 'TortoiseWolfe'
publishDate: 2025-10-24
status: 'published'
featured: false
categories:
  - Games
  - Components
  - Tutorial
tags:
  - games
  - dice
  - components
  - tutorial
  - complete-app
readTime: 10
ogImage: '/blog-images/2025-10-24-captain-ship-crew-game.png'
---

# Captain Ship Crew: A Complete Game Built with Components

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Bar Game That Became a PWA 🍺

Captain, Ship, Crew is a classic bar dice game.
We needed a team building activity.
We built it in ScriptHammer.

2 hours. Fully playable. Multiplayer ready.

## The Rules (Dead Simple) ⚓

1. Roll 5 dice
2. Keep 6 (Ship), 5 (Captain), 4 (Crew) in order
3. Remaining dice are your "cargo" (score)
4. Highest cargo wins

Sounds simple? The component architecture makes it trivial.

## The Component Breakdown 🧩

```tsx
<Game>
  {/* Atomic Components */}
  <DicePool count={5} />
  <Button onClick={roll}>Roll</Button>
  <ScoreDisplay score={cargo} />

  {/* Molecular Components */}
  <TurnIndicator player={currentPlayer} />
  <RollResult dice={dice} locked={locked} />

  {/* Organism */}
  <GameBoard players={players} />
</Game>
```

30 lines. Complete game.

## State Management That Makes Sense 🎯

```tsx
const gameState = {
  phase: 'rolling',        // rolling | locking | scoring
  currentRoll: [1,3,6,5,2], // Current dice values
  locked: {
    ship: 6,              // Locked 6
    captain: 5,           // Locked 5
    crew: null            // Still need 4
  },
  rollsRemaining: 2,      // 3 rolls per turn
  players: [...]          // Multiplayer state
};
```

One object. Entire game state. Easy to sync.

## The Locking Logic ⚓

```tsx
const lockDice = (dice: number[]) => {
  const sorted = [...dice].sort((a, b) => b - a);

  // Must get ship (6) first
  if (!locked.ship && sorted.includes(6)) {
    locked.ship = 6;
    dice = dice.filter((d) => d !== 6);
  }

  // Then captain (5)
  if (locked.ship && !locked.captain && dice.includes(5)) {
    locked.captain = 5;
    dice = dice.filter((d) => d !== 5);
  }

  // Finally crew (4)
  if (locked.captain && !locked.crew && dice.includes(4)) {
    locked.crew = 4;
    dice = dice.filter((d) => d !== 4);
  }

  return dice; // Remaining dice are cargo
};
```

Clear rules. Clean code. No ambiguity.

## The Animations That Sell It 🎬

```tsx
// Dice fly into position when locked
<motion.div
  animate={{
    x: locked ? lockPosition.x : 0,
    y: locked ? lockPosition.y : 0,
  }}
  transition={{ type: 'spring' }}
>
  <Dice value={value} locked={locked} />
</motion.div>;

// Victory celebration
{
  winner && <Confetti />;
}
```

## Multiplayer in 50 Lines 🌐

```tsx
// WebRTC peer-to-peer
const game = new P2PGame({
  onPlayerJoin: (player) => addPlayer(player),
  onStateSync: (state) => setGameState(state),
  onRoll: (dice) => handleOpponentRoll(dice),
});

// Share room code
<ShareCode code={roomCode} />;

// Everyone stays in sync
// No server needed
// Works offline too
```

## Progressive Difficulty 📈

```tsx
// Beginner: Visual hints
<HintSystem>
  "You need a 6 first!" // Highlights sixes
  "Now get your captain!" // Highlights fives
</HintSystem>

// Advanced: Speed rounds
<TimedMode seconds={10} />

// Expert: Blind mode
<BlindMode revealAfterLock />
```

Same game. Different challenges. Infinite replay value.

## The PWA Magic 📱

```tsx
// Install on phone
<InstallPrompt />;

// Play offline
serviceWorker.register();

// Sync scores when online
<OfflineSync />;

// Push notifications
('Your turn in Captain Ship Crew!');
```

Feels native. Works everywhere. Zero app store hassle.

## The Leaderboard That Motivates 🏆

```tsx
<Leaderboard>
  <TopScores /> {/* Global high scores */}
  <DailyChallenge /> {/* New challenge each day */}
  <Achievements /> {/* "Win 10 games" */}
  <Statistics /> {/* Win rate, average cargo */}
</Leaderboard>
```

IndexedDB stores everything locally.
Optional cloud sync for competitive players.

## Component Reuse Victory 🎯

Components built for Captain Ship Crew now power:

- Yahtzee clone (same dice, different scoring)
- Liar's Dice (same dice, add betting)
- Farkle (same dice, different locking rules)
- Bunco (same dice, add rounds)

One dice system. Five games. Countless hours saved.

## Play It Now

```bash
docker compose exec scripthammer pnpm run dev
# Navigate to /games/captain-ship-crew
```

Or build your own:

```bash
docker compose exec scripthammer pnpm generate:component DiceGame
```

From components to complete games. That's atomic design.

Roll the dice. Build something fun.
