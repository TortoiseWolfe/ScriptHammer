# DraggableDice Component Documentation

## Overview

The DraggableDice component extends the basic Dice component with drag-and-drop functionality, designed for use in interactive gaming applications like the DiceTray. It supports both manual rolling and programmatic control, with visual feedback for locked and dragging states.

## Features

- **Drag and Drop**: HTML5 drag API implementation
- **Lock/Unlock**: Visual and functional locking mechanism
- **Visual States**: Different appearances for locked, dragging, and normal states
- **Controlled Component**: Value can be set externally
- **Animation**: Smooth rolling animation with customizable duration
- **Accessibility**: Full ARIA labels and keyboard support
- **Theme Integration**: Adapts to DaisyUI theme colors

## Usage

```tsx
import DraggableDice from '@/components/atomic/DraggableDice/DraggableDice';

// Basic draggable dice
<DraggableDice
  id="dice-1"
  value={null}
  locked={false}
  onRoll={(value) => console.log('Rolled:', value)}
/>

// Locked dice with value
<DraggableDice
  id="dice-2"
  value={6}
  locked={true}
  onRoll={(value) => console.log('Rolled:', value)}
/>

// Custom styled dice
<DraggableDice
  id="dice-3"
  value={4}
  locked={false}
  label="Captain"
  className="custom-class"
  onRoll={(value) => console.log('Rolled:', value)}
/>
```

## Props

| Prop        | Type                      | Required | Default | Description                    |
| ----------- | ------------------------- | -------- | ------- | ------------------------------ |
| `id`        | `string`                  | Yes      | -       | Unique identifier for the dice |
| `value`     | `number \| null`          | No       | `null`  | Current dice value (1-6)       |
| `locked`    | `boolean`                 | No       | `false` | Whether the dice is locked     |
| `label`     | `string`                  | No       | `''`    | Label displayed above the dice |
| `className` | `string`                  | No       | `''`    | Additional CSS classes         |
| `onRoll`    | `(value: number) => void` | No       | -       | Callback when dice is rolled   |

## Drag and Drop Behavior

### Dragging

- Dice can only be dragged when not locked
- Visual opacity change (50%) during drag
- Drag data includes the dice ID for drop zone identification

### Drop Zones

- Compatible with DiceTray lock zones
- Returns to original position if dropped outside valid zone
- Visual feedback on successful drop

## States and Styling

### Normal State

```css
- Full opacity
- Cursor: grab
- Primary theme colors
```

### Locked State

```css
- Cursor: not-allowed
- Slightly muted colors
- Cannot be dragged
```

### Dragging State

```css
- 50% opacity
- Cursor: grabbing
- Elevated z-index
```

## Integration with DiceTray

The DraggableDice component is designed to work seamlessly with the DiceTray component:

```tsx
// Inside DiceTray
{
  dice.map((die) => (
    <DraggableDice
      key={die.id}
      id={die.id}
      value={die.value}
      locked={die.locked}
      onRoll={handleDiceRoll}
    />
  ));
}
```

## Accessibility

- **ARIA Labels**: Descriptive labels for screen readers
- **Keyboard Support**: Space/Enter to roll when focused
- **Draggable Attribute**: Properly set based on lock state
- **Live Region**: Roll results announced to screen readers
- **Focus Management**: Proper focus states and tab order

## Animation

The rolling animation can be customized:

- Default duration: 1000ms
- Animation interval: 100ms
- Shows random values during animation
- Smooth transition to final value

## Testing

The component includes comprehensive tests covering:

- Rendering with different props
- Drag and drop functionality
- Lock/unlock behavior
- Rolling mechanism
- Visual state changes
- Accessibility attributes

Run tests with:

```bash
docker compose exec scripthammer pnpm test src/components/atomic/DraggableDice/
```

## Related Components

- **Dice**: Base dice component without drag functionality
- **DiceTray**: Container that manages multiple DraggableDice
- **CaptainShipCrew**: Game using DraggableDice for gameplay
