# CaptainShipCrewWithNPC Component Documentation

## Overview

The CaptainShipCrewWithNPC component extends the base CaptainShipCrew game with AI-controlled opponents and persistent player preferences. This enhanced version allows for single-player experiences against computer opponents of varying difficulty levels, making the game accessible when human opponents aren't available.

## Key Features

### NPC System

- **AI Opponents**: Computer-controlled players with intelligent decision-making
- **Difficulty Levels**:
  - Easy: Conservative play, may miss opportunities
  - Medium: Balanced strategy, good decision-making
  - Hard: Optimal play, maximizes scoring chances
- **Realistic Behavior**: NPCs make decisions based on game state and probability

### Player Persistence

- **Name Memory**: Saves human player names in localStorage
- **Auto-fill**: Previously used names automatically populate on game setup
- **Cross-session**: Names persist between browser sessions
- **Component-level**: Works wherever the component is used

## Usage

```tsx
import CaptainShipCrewWithNPC from '@/components/atomic/CaptainShipCrewWithNPC/CaptainShipCrewWithNPC';

// Default 2-player game (1 human, 1 NPC)
<CaptainShipCrewWithNPC />

// 4-player tournament with NPCs
<CaptainShipCrewWithNPC
  playerCount={4}
  gameMode="target"
  targetScore={50}
/>

// Single-round 6-player game
<CaptainShipCrewWithNPC
  playerCount={6}
  gameMode="single"
/>

// Homepage demo configuration
<CaptainShipCrewWithNPC
  playerCount={4}
  gameMode="target"
  targetScore={50}
  className="shadow-2xl"
/>
```

## Props

| Prop          | Type                   | Default    | Description                      |
| ------------- | ---------------------- | ---------- | -------------------------------- |
| `playerCount` | `number`               | `2`        | Total number of players (2-8)    |
| `gameMode`    | `'single' \| 'target'` | `'single'` | Game mode                        |
| `targetScore` | `number`               | `50`       | Target score for tournament mode |
| `className`   | `string`               | `''`       | Additional CSS classes           |

## Player Setup

### Configuration Screen

- Set player names (auto-filled from localStorage)
- Choose player types (Human or NPC)
- Select NPC difficulty levels
- Mixed games supported (humans vs NPCs)

### Default Setup

- First player defaults to human
- Additional players default to NPCs (Medium difficulty)
- Saved human names automatically restored

## NPC AI Logic

### Easy Difficulty

```javascript
// Conservative strategy
- Always keeps cargo on first qualifying roll
- May not optimize reroll decisions
- 70% chance to reroll low cargo (< 6)
```

### Medium Difficulty

```javascript
// Balanced strategy
- Rerolls cargo below 7 with remaining rolls
- Makes reasonable risk/reward decisions
- 85% optimal decision rate
```

### Hard Difficulty

```javascript
// Optimal strategy
- Always rerolls cargo below 8 with 2+ rolls
- Rerolls below 10 with 3 rolls
- Maximizes expected value
- 95% optimal decision rate
```

## Performance Optimizations

### NPC Turn Speed

- Reduced animation duration (300ms vs 1000ms for humans)
- Faster decision processing
- No artificial delays
- Smooth gameplay flow

### State Management

- Efficient update batching
- Memoized calculations
- Optimized re-renders
- Prevented infinite loops in effects

## localStorage Integration

### Saving Names

```javascript
// Automatically saves when:
- Player name is changed
- Player type is changed
- New game starts

// Storage format:
localStorage.setItem('captainShipCrew_playerNames',
  JSON.stringify(['Player 1', 'Alice', 'Bob'])
);
```

### Loading Names

```javascript
// Loads on component mount
- Retrieves saved names array
- Maps to player slots
- Falls back to defaults if none saved
```

## UI Enhancements

### Player Indicators

- 👤 Human players
- 🤖 NPC players
- Difficulty badges for NPCs
- Current player highlighting

### Turn Feedback

- Different alert colors (info for human, warning for NPC)
- NPC thinking indicator
- Previous turn result display
- Action progress tracking

## Game Flow

1. **Setup Phase**
   - Configure players and NPCs
   - Names auto-filled from localStorage
   - Select difficulties

2. **Playing Phase**
   - Humans take manual turns
   - NPCs automatically play
   - Visual feedback for all actions
   - Scores tracked in real-time

3. **End Game**
   - Winner announcement
   - Final scoreboard
   - Play again option
   - Names remain saved

## Accessibility

- **Screen Reader Support**: Full ARIA labels
- **Keyboard Navigation**: Tab through all controls
- **Status Updates**: Live regions for turn changes
- **Visual Indicators**: Clear player type markers
- **Focus Management**: Logical focus flow

## Testing

Comprehensive test suite covering:

- NPC decision logic
- localStorage persistence
- Mixed player games
- Difficulty behaviors
- Performance optimizations
- Edge cases

Run tests with:

```bash
docker compose exec scripthammer pnpm test src/components/atomic/CaptainShipCrewWithNPC/
```

## Storybook Stories

Multiple preconfigured scenarios:

- **HumanVsNPC**: Basic 1v1 game
- **HumanVsThreeNPCs**: 4-player with one human
- **AllNPCs**: Watch NPCs play each other
- **TournamentWithNPCs**: 6-player tournament mode
- **QuickMatch**: Fast 2-player to 25 points
- **MaxPlayersWithNPCs**: 8-player chaos mode

## Homepage Integration

The component is featured on the homepage as an interactive demo:

- Configured as 4-player tournament to 50 points
- Mix of human and NPC players
- Showcases full game functionality
- Demonstrates component capabilities

## Related Components

- **CaptainShipCrew**: Base game without NPC support
- **DraggableDice**: Individual dice components
- **DiceTray**: Alternative dice management system
