# DiceTray Component Documentation

## Overview

The DiceTray component provides an advanced dice management system with drag-and-drop functionality, allowing users to roll multiple dice while preserving specific values through a locking mechanism.

## Features

- **Multiple dice management**: Handle 1-10 dice simultaneously
- **Drag and drop**: Move dice between active tray and lock zone
- **Lock mechanism**: Preserve dice values from rolling
- **Batch rolling**: Roll all unlocked dice at once
- **Total calculation**: Automatic sum of all dice values
- **Visual feedback**: Drag states and zone highlighting
- **Quick toggle**: Click dice to toggle lock status
- **Reset functionality**: Clear all dice values and locks

## Usage

```tsx
import DiceTray from '@/components/atomic/DiceTray/DiceTray';

// Basic usage with 5 D6 dice
<DiceTray />

// Custom number of dice
<DiceTray numberOfDice={3} />

// D20 dice tray
<DiceTray numberOfDice={4} sides={20} />

// With custom styling
<DiceTray numberOfDice={5} sides={6} className="custom-class" />
```

## Props

| Prop           | Type      | Default | Description                       |
| -------------- | --------- | ------- | --------------------------------- |
| `numberOfDice` | `number`  | `5`     | Number of dice in the tray (1-10) |
| `sides`        | `6 \| 20` | `6`     | Type of dice (D6 or D20)          |
| `className`    | `string`  | `''`    | Additional CSS classes            |

## Interaction Guide

### Drag and Drop

1. **Drag to lock**: Drag dice from the active tray to the lock zone to preserve their values
2. **Drag to unlock**: Drag dice from the lock zone back to the active tray to include them in rolls
3. **Visual feedback**: Zones highlight when dragging over them

### Quick Actions

- **Click to toggle**: Click any die to quickly toggle its lock status
- **Roll button**: Rolls all dice in the active tray (unlocked)
- **Reset button**: Clears all values and unlocks all dice

### Lock Zone

- Dice in the lock zone maintain their values
- Locked dice display a lock icon
- Locked dice won't roll when "Roll Unlocked Dice" is clicked
- Total includes both locked and unlocked dice values

## Component Structure

```
DiceTray
├── Control Panel
│   ├── Roll Button
│   └── Reset Button
├── Total Display
│   ├── Sum of all dice
│   └── Lock count
├── Active Tray
│   └── Unlocked DraggableDice
└── Lock Zone
    └── Locked DraggableDice
```

## Examples

### Basic Gaming Setup

```tsx
// 5 D6 for a typical dice game
<DiceTray numberOfDice={5} sides={6} />
```

### D&D Setup

```tsx
// 4 D20 for multiple attack rolls
<DiceTray numberOfDice={4} sides={20} />
```

### Minimal Setup

```tsx
// Single die with lock capability
<DiceTray numberOfDice={1} sides={6} />
```

## Accessibility

- **Keyboard navigation**: All interactive elements keyboard accessible
- **ARIA labels**: Descriptive labels for zones and dice states
- **Focus management**: Proper focus handling during interactions
- **Screen reader support**: Status announcements for actions

## Theming

Uses DaisyUI classes for consistent theming:

- `border-primary` for active drop zones
- `border-warning` and `bg-warning` for lock zone
- `btn-primary` for main actions
- `stats` component for total display
- Responsive to theme changes

## State Management

The component manages:

- Individual dice values
- Lock status per die
- Position (tray or lock zone)
- Rolling animation state
- Drag and drop states

## Testing

Comprehensive test coverage includes:

- Rendering with various configurations
- Drag and drop functionality
- Rolling mechanics
- Lock/unlock behavior
- Total calculation
- Reset functionality

Run tests with:

```bash
docker compose exec scripthammer pnpm test src/components/atomic/DiceTray/
```

## Performance Considerations

- Efficient re-renders using React state
- Optimized drag operations
- Smooth animations using CSS transitions
- Lightweight DOM manipulation

## Browser Compatibility

- Modern browsers with HTML5 drag-and-drop API
- Touch device support for drag operations
- Fallback click interactions for all features

## Related Components

- **Dice**: Individual dice component
- **DraggableDice**: Draggable dice variant used within DiceTray
