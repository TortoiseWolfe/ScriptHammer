# Phase 1: Data Model - Colorblind Mode

## Core Entities

### ColorblindType

```typescript
enum ColorblindType {
  NONE = 'none',
  PROTANOPIA = 'protanopia',
  PROTANOMALY = 'protanomaly',
  DEUTERANOPIA = 'deuteranopia',
  DEUTERANOMALY = 'deuteranomaly',
  TRITANOPIA = 'tritanopia',
  TRITANOMALY = 'tritanomaly',
  ACHROMATOPSIA = 'achromatopsia',
  ACHROMATOMALY = 'achromatomaly',
}
```

### ColorblindSettings

```typescript
interface ColorblindSettings {
  mode: ColorblindType;
  patternsEnabled: boolean;
  simulationMode: boolean;
}
```

### ColorMatrix

```typescript
type ColorMatrix = readonly [
  readonly [number, number, number, number, number],
  readonly [number, number, number, number, number],
  readonly [number, number, number, number, number],
  readonly [number, number, number, number, number],
];
```

### ColorblindFilter

```typescript
interface ColorblindFilter {
  type: ColorblindType;
  label: string;
  description: string;
  prevalence: string;
  matrix: ColorMatrix;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}
```

## Filter Registry

### colorblindFilters

```typescript
const colorblindFilters: Record<ColorblindType, ColorblindFilter> = {
  [ColorblindType.NONE]: {
    type: ColorblindType.NONE,
    label: 'Normal Vision',
    description: 'No color vision deficiency',
    prevalence: '~92% of population',
    matrix: [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    severity: 'none',
  },
  [ColorblindType.PROTANOPIA]: {
    type: ColorblindType.PROTANOPIA,
    label: 'Protanopia',
    description: 'Red-blind - Unable to perceive red light',
    prevalence: '1% of males',
    matrix: [
      [0.567, 0.433, 0, 0, 0],
      [0.558, 0.442, 0, 0, 0],
      [0, 0.242, 0.758, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    severity: 'severe',
  },
  [ColorblindType.DEUTERANOPIA]: {
    type: ColorblindType.DEUTERANOPIA,
    label: 'Deuteranopia',
    description: 'Green-blind - Unable to perceive green light',
    prevalence: '1% of males',
    matrix: [
      [0.625, 0.375, 0, 0, 0],
      [0.7, 0.3, 0, 0, 0],
      [0, 0.3, 0.7, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    severity: 'severe',
  },
  // Additional filters defined similarly...
};
```

## Pattern Definitions

### PatternType

```typescript
enum PatternType {
  NONE = 'none',
  DIAGONAL_STRIPES = 'diagonal-stripes',
  DOTS = 'dots',
  HORIZONTAL_LINES = 'horizontal-lines',
  CROSS_HATCH = 'cross-hatch',
  VERTICAL_LINES = 'vertical-lines',
}
```

### PatternConfig

```typescript
interface PatternConfig {
  type: PatternType;
  cssClass: string;
  uiElement: 'button' | 'badge' | 'alert' | 'input';
  variant: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}
```

## State Management

### ColorblindState

```typescript
interface ColorblindState {
  currentMode: ColorblindType;
  patternsEnabled: boolean;
  simulationActive: boolean;
  lastChanged: Date;
  userPreference: boolean;
}
```

### UseColorblindMode

```typescript
interface UseColorblindMode {
  // State
  mode: ColorblindType;
  patternsEnabled: boolean;
  isSimulating: boolean;

  // Actions
  setMode: (type: ColorblindType) => void;
  togglePatterns: () => void;
  toggleSimulation: () => void;
  reset: () => void;

  // Utilities
  getFilterInfo: (type: ColorblindType) => ColorblindFilter;
  isFilterActive: () => boolean;
  getActiveFilter: () => string;
}
```

## Storage Schema

### ColorblindStorageSchema

```typescript
interface ColorblindStorageSchema {
  version: number;
  mode: ColorblindType;
  patterns: boolean;
  simulation: boolean;
  timestamp: string;
}
```

### Storage Keys

```typescript
const STORAGE_KEYS = {
  COLORBLIND_MODE: 'colorblind-mode',
  COLORBLIND_PATTERNS: 'colorblind-patterns',
  COLORBLIND_SIMULATION: 'colorblind-simulation',
} as const;
```

## Component Props

### ColorblindToggleProps

```typescript
interface ColorblindToggleProps {
  className?: string;
  showLabel?: boolean;
  showDescription?: boolean;
  compact?: boolean;
  onModeChange?: (mode: ColorblindType) => void;
}
```

### ColorblindFiltersProps

```typescript
interface ColorblindFiltersProps {
  id?: string;
}
```

## Context Integration

### ExtendedAccessibilitySettings

```typescript
interface AccessibilitySettings {
  // Existing settings
  fontSize: FontSize;
  lineHeight: LineHeight;
  fontFamily: FontFamily;
  highContrast: ContrastMode;
  reduceMotion: MotionPreference;

  // New colorblind settings
  colorblindMode: ColorblindType;
  colorblindPatterns: boolean;
}
```

## Validation Rules

### Mode Validation

- Must be valid ColorblindType enum value
- Default to NONE if invalid
- Persist to localStorage on change

### Pattern Validation

- Boolean value only
- Default to false
- Only apply when mode !== NONE

### Simulation Validation

- Boolean value only
- Default to false
- Reset on mode change

## State Transitions

### Mode Change Flow

1. User selects new mode
2. Validate mode value
3. Apply filter to body
4. Update localStorage
5. Dispatch change event
6. Update UI feedback

### Pattern Toggle Flow

1. User toggles patterns
2. Check if mode active
3. Apply/remove CSS classes
4. Update localStorage
5. Re-render affected components

## Constants

### Defaults

```typescript
const COLORBLIND_DEFAULTS = {
  mode: ColorblindType.NONE,
  patterns: false,
  simulation: false,
  storageVersion: 1,
} as const;
```

### Performance Limits

```typescript
const PERFORMANCE_LIMITS = {
  maxFilterApplyTime: 10, // ms
  maxPatternRenderTime: 5, // ms
  debounceDelay: 100, // ms
} as const;
```

## Relationships

- ColorblindSettings → AccessibilityContext (extends)
- ColorblindFilter → SVG Filters (implements)
- PatternConfig → CSS Classes (generates)
- ColorblindState → localStorage (persists)
