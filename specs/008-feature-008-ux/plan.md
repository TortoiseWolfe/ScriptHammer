# Implementation Plan: UX Polish - Character Count & Markdown Rendering

**Branch**: `008-feature-008-ux` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-feature-008-ux/spec.md`

## Summary

Two UX fixes for the messaging interface:

1. **Character count display** - Show "0 / 10000 characters" instead of "/ 10000 characters" when input is empty
2. **Markdown rendering** - Parse `**bold**`, `*italic*`, and `` `code` `` in message bubbles

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15
**Primary Dependencies**: React, DaisyUI, Tailwind CSS 4
**Storage**: N/A (client-side display changes only)
**Testing**: Vitest for unit tests
**Target Platform**: Web (PWA, all modern browsers)
**Project Type**: Web application
**Performance Goals**: No performance impact (simple string operations)
**Constraints**: No breaking changes, preserve existing whitespace/line breaks
**Scale/Scope**: 2 components modified (MessageInput, MessageBubble)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status  | Notes                                                       |
| -------------------------- | ------- | ----------------------------------------------------------- |
| I. Component Structure     | ✅ PASS | Modifying existing components, not creating new ones        |
| II. Test-First Development | ✅ PASS | Will add unit tests for parseMarkdown function              |
| III. PRP Methodology       | ✅ PASS | Following /specify → /clarify → /plan → /tasks → /implement |
| IV. Docker-First           | ✅ PASS | All development in Docker                                   |
| V. Progressive Enhancement | ✅ PASS | Markdown gracefully degrades to plain text                  |
| VI. Privacy & Compliance   | ✅ PASS | No data collection, client-side only                        |

**Gate Status**: PASS - All constitutional requirements satisfied

## Project Structure

### Documentation (this feature)

```
specs/008-feature-008-ux/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (minimal for this feature)
├── quickstart.md        # Implementation guide
└── tasks.md             # Phase 2 output (via /tasks command)
```

### Source Code (repository root)

```
src/components/atomic/
├── MessageInput/
│   ├── MessageInput.tsx         # Fix: charCount fallback at line 192
│   └── MessageInput.test.tsx    # Add: character count edge case tests
└── MessageBubble/
    ├── MessageBubble.tsx        # Fix: Add parseMarkdown function
    └── MessageBubble.test.tsx   # Add: markdown parsing tests
```

**Structure Decision**: Modifying existing atomic components. No new components needed.

## Complexity Tracking

_No violations - this is a simple component modification._

| Aspect         | Assessment                     |
| -------------- | ------------------------------ |
| New files      | 0                              |
| Modified files | 2                              |
| Lines changed  | ~30                            |
| Test coverage  | Unit tests for parseMarkdown   |
| Risk level     | Low - isolated display changes |

## Implementation Approach

### Fix 1: Character Count (MessageInput.tsx:192)

**Current**:

```tsx
{charCount} / {charLimit} characters
```

**Fixed**:

```tsx
{charCount || 0} / {charLimit} characters
```

### Fix 2: Markdown Rendering (MessageBubble.tsx)

Add `parseMarkdown` utility function before component:

```tsx
const parseMarkdown = (text: string): React.ReactNode => {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-base-300 rounded px-1">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};
```

Update message content rendering:

```tsx
<p className="break-words whitespace-pre-wrap">
  {parseMarkdown(message.content)}
</p>
```

## Progress Tracking

| Phase             | Status      | Artifacts            |
| ----------------- | ----------- | -------------------- |
| Phase 0: Research | ✅ Complete | research.md          |
| Phase 1: Design   | ✅ Complete | quickstart.md        |
| Phase 2: Tasks    | ✅ Complete | tasks.md             |
| Phase 3: Analyze  | ✅ Complete | All issues addressed |
| Implementation    | ⏳ Pending  | (via /implement)     |
