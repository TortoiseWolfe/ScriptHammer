# Dice Component Documentation

## Overview

The Dice component provides an interactive dice rolling experience for gaming applications. It supports both D6 and D20 dice with animated rolling effects and visual feedback.

## Features

- **Multiple dice types**: D6 (six-sided) and D20 (twenty-sided)
- **Visual dice faces**: Unicode characters for D6, numbers for D20
- **Rolling animation**: Smooth bounce effect during roll
- **Result display**: Shows value and special messages (Critical/Critical Fail)
- **Accessible**: Full ARIA labels and keyboard support
- **Theme-aware**: Adapts to DaisyUI theme colors

## Usage

```tsx
import Dice from '@/components/atomic/Dice/Dice';

// Basic D6 dice
<Dice />

// D20 dice
<Dice sides={20} />

// With custom styling
<Dice sides={6} className="custom-class" />
```

## Props

| Prop        | Type      | Default | Description                 |
| ----------- | --------- | ------- | --------------------------- |
| `sides`     | `6 \| 20` | `6`     | Number of sides on the dice |
| `className` | `string`  | `''`    | Additional CSS classes      |

## Examples

### D6 Dice

```tsx
<Dice sides={6} />
```

Displays a six-sided die with Unicode dice face characters (⚀ ⚁ ⚂ ⚃ ⚄ ⚅).

### D20 Dice

```tsx
<Dice sides={20} />
```

Displays a twenty-sided die with numeric values in a circular badge.

## Accessibility

- **ARIA Labels**: Descriptive labels for screen readers
- **Keyboard Support**: Roll button is keyboard accessible
- **Live Region**: Roll results announced to screen readers
- **Focus Management**: Proper focus states on interactive elements

## Theming

The component uses DaisyUI classes for consistent theming:

- `btn-primary` for the roll button
- `bg-primary` and `text-primary-content` for D20 display
- `stats` component for result display
- Automatic theme adaptation

## Testing

The component includes comprehensive tests covering:

- Rendering with different props
- Rolling functionality
- Animation states
- Critical/fail detection
- Accessibility attributes

Run tests with:

```bash
docker compose exec scripthammer pnpm test src/components/atomic/Dice/
```

## Related Components

- **DraggableDice**: A draggable version for use in DiceTray
- **DiceTray**: Container for multiple dice with drag-and-drop
