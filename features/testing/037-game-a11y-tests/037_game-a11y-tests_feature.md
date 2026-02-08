# Feature: Game Component A11y Tests

**Feature ID**: 037
**Category**: testing
**Source**: ScriptHammer_v_001 README (SPEC-064)
**Status**: Ready for SpecKit

## Description

Add accessibility tests for game components including keyboard navigation, ARIA verification, and focus management. Ensures game features are usable by all users including those with disabilities.

### Target Game Components

The following game components require accessibility testing:

| Component             | Location                                  | Key A11y Concerns                      |
| --------------------- | ----------------------------------------- | -------------------------------------- |
| **DiceRoller**        | `src/components/games/DiceRoller/`        | Keyboard roll, result announcement     |
| **CardDeck**          | `src/components/games/CardDeck/`          | Card selection, draw/discard focus     |
| **CharacterSheet**    | `src/components/games/CharacterSheet/`    | Form inputs, stat modifiers            |
| **InitiativeTracker** | `src/components/games/InitiativeTracker/` | Turn order, active player focus        |
| **MapGrid**           | `src/components/games/MapGrid/`           | Grid navigation, token placement       |
| **ChatPanel**         | `src/components/games/ChatPanel/`         | Message list, input focus, live region |
| **RollLog**           | `src/components/games/RollLog/`           | Roll history, live announcements       |

**Note**: If additional game components exist at implementation time, add them to this list.

## User Scenarios

### US-1: Keyboard Navigation Tests (P1)

Tests verify all game interactions work with keyboard only.

**Acceptance Criteria**:

1. Given game controls, when using Tab, then all interactive elements reachable
2. Given game action, when using Enter/Space, then action triggers
3. Given modal open, when pressing Escape, then modal closes

### US-2: ARIA Verification Tests (P1)

Tests verify proper ARIA attributes for screen readers.

**Acceptance Criteria**:

1. Given game state, when screen reader reads, then state announced
2. Given interactive element, when focused, then role and label announced
3. Given live region, when content updates, then change announced

### US-3: Focus Management Tests (P2)

Tests verify focus is properly managed during game interactions.

**Acceptance Criteria**:

1. Given game start, when focus set, then correct element focused
2. Given modal open, when trap active, then focus stays in modal
3. Given modal close, when returning, then focus returns to trigger

### US-4: Color Contrast Tests (P3)

Tests verify game elements meet color contrast requirements.

**Acceptance Criteria**:

1. Given game text, when checked, then meets WCAG AA contrast
2. Given colorblind mode, when enabled, then all elements distinguishable
3. Given focus indicator, when visible, then meets contrast requirements

## Requirements

### Functional

**Keyboard Navigation**

- FR-001: Test Tab navigation order
- FR-002: Test Enter/Space activation
- FR-003: Test Escape for dismissal
- FR-004: Test Arrow key navigation (where applicable)
- FR-005: Test shortcut keys

**ARIA Attributes**

- FR-006: Test role attributes
- FR-007: Test aria-label and aria-labelledby
- FR-008: Test aria-describedby
- FR-009: Test aria-live regions
- FR-010: Test aria-expanded/aria-hidden states

**Focus Management**

- FR-011: Test initial focus
- FR-012: Test focus trap in modals
- FR-013: Test focus restoration
- FR-014: Test visible focus indicators
- FR-015: Test focus order logic

**Visual Accessibility**

- FR-016: Test color contrast ratios
- FR-017: Test with colorblind filters
- FR-018: Test high contrast mode
- FR-019: Test reduced motion preference

### Test Files

```
tests/a11y/games/
├── keyboard-navigation.test.tsx
├── aria-attributes.test.tsx
├── focus-management.test.tsx
└── visual-accessibility.test.tsx
```

### Tools

- jest-axe for automated a11y checking
- @testing-library/user-event for keyboard simulation
- Custom matchers for focus verification

### Out of Scope

- Manual accessibility audit
- Screen reader compatibility testing
- Mobile touch accessibility

## Success Criteria

- SC-001: All game components pass automated a11y checks
- SC-002: Keyboard navigation works for all interactions
- SC-003: ARIA attributes properly set on all elements
- SC-004: Focus management correct in all scenarios
- SC-005: No violations at WCAG AA level
