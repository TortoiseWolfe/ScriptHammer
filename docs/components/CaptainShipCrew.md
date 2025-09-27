# CaptainShipCrew Component Documentation

## Overview

The CaptainShipCrew component implements the classic dice game "Captain, Ship & Crew" (also known as "Ship, Captain, and Crew" or "6-5-4"). This is a sequential dice game where players must roll specific numbers in order to score points. The component provides a complete game experience with turn management, scoring, and multi-round gameplay.

## Game Rules

### Objective

Roll a 6 (Ship), 5 (Captain), and 4 (Crew) in that exact sequence, then maximize your cargo score with the remaining two dice.

### Gameplay

1. **Sequential Requirements**: Must roll 6→5→4 in order
   - Cannot keep a Captain (5) without a Ship (6)
   - Cannot keep Crew (4) without both Ship and Captain
2. **Three Rolls Per Turn**: Each player gets up to 3 rolls
3. **Automatic Locking**: Required dice lock automatically when rolled in sequence
4. **Cargo Scoring**: After getting 6-5-4, sum of remaining two dice becomes your score
5. **Reroll Option**: Can reroll cargo dice if rolls remain

## Features

- **Complete Game Logic**: Full implementation of official rules
- **Turn Management**: Automatic turn progression for 2-8 players
- **Visual Feedback**: Clear indication of locked dice and requirements
- **Score Tracking**: Round and total score management
- **Game Modes**:
  - Single round mode
  - Target score mode (play to specified points)
- **Animations**: Smooth dice rolling animations
- **Responsive Design**: Works on all screen sizes

## Usage

```tsx
import CaptainShipCrew from '@/components/atomic/CaptainShipCrew/CaptainShipCrew';

// Basic 2-player game
<CaptainShipCrew />

// 4-player game
<CaptainShipCrew playerCount={4} />

// Tournament mode (play to 100 points)
<CaptainShipCrew
  playerCount={4}
  gameMode="target"
  targetScore={100}
/>

// With custom styling
<CaptainShipCrew
  playerCount={3}
  className="custom-class"
/>
```

## Props

| Prop          | Type                   | Default    | Description                        |
| ------------- | ---------------------- | ---------- | ---------------------------------- |
| `playerCount` | `number`               | `2`        | Number of players (2-8)            |
| `gameMode`    | `'single' \| 'target'` | `'single'` | Game mode                          |
| `targetScore` | `number`               | `50`       | Target score for multi-round games |
| `className`   | `string`               | `''`       | Additional CSS classes             |

## Game States

### Setup State

- Configure number of players
- Choose game mode
- Set target score (if applicable)

### Playing State

- Current player indicator
- Rolls remaining counter
- Dice display with lock indicators
- Score tracking
- Turn controls

### Game Over State

- Winner announcement
- Final scores
- Play again option

## UI Components

### Dice Display

- Five dice with visual states
- Automatic locking for required sequence
- Labels for Ship/Captain/Crew/Cargo
- Rolling animation during play

### Control Panel

- Roll button with remaining count
- End turn button when applicable
- Reroll cargo option when sequence complete
- Keep cargo button to lock in score

### Scoreboard

- All players listed with scores
- Current player highlighted
- Round number display
- Target score indicator (if applicable)

## Turn Flow

1. **Initial State**: Player sees 5 dice, 3 rolls available
2. **First Roll**: Dice roll, any 6s automatically lock as Ship
3. **Subsequent Rolls**:
   - If Ship locked, 5s lock as Captain
   - If Ship+Captain locked, 4s lock as Crew
4. **Cargo Phase**: When 6-5-4 complete, remaining dice score
5. **Decision Point**: Keep cargo or reroll (if rolls remain)
6. **Turn End**: Score recorded, next player begins

## Scoring System

- **No Sequence**: 0 points
- **Partial Sequence**: 0 points (must complete 6-5-4)
- **Complete Sequence**: Sum of two cargo dice (2-12 points)
- **Strategy**: Higher cargo scores win rounds

## Accessibility

- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard control
- **Focus Management**: Logical tab order
- **Status Announcements**: Turn changes and scores announced
- **High Contrast**: Works with all theme modes

## Testing

The component includes extensive test coverage:

- Game initialization
- Turn mechanics
- Dice rolling and locking
- Score calculation
- Game state transitions
- Multi-round gameplay
- Edge cases and error handling

Run tests with:

```bash
docker compose exec scripthammer pnpm test src/components/atomic/CaptainShipCrew/
```

## Performance

- Optimized re-renders with React.memo
- Efficient state updates
- Smooth animations without blocking UI
- Lightweight component (~15KB)

## Related Components

- **DraggableDice**: Individual dice used in the game
- **CaptainShipCrewWithNPC**: Enhanced version with AI opponents
- **DiceTray**: Alternative dice container component
