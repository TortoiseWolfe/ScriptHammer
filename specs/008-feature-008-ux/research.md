# Research: UX Polish - Character Count & Markdown Rendering

**Feature**: 008-feature-008-ux
**Date**: 2025-11-29

## Research Questions

### Q1: Why does charCount show blank instead of 0?

**Investigation**: Read MessageInput.tsx to understand the character count implementation.

**Finding**: At line 192, the code displays `{charCount} / {charLimit} characters`. The `charCount` is derived from `message.length` where `message` is initialized to empty string `''`. In JavaScript, `''.length` is `0`, which is a falsy value but should still render as "0".

**Root Cause**: Likely a hydration issue or initial state mismatch where `charCount` is `undefined` briefly before the component fully mounts.

**Decision**: Add `|| 0` fallback to ensure explicit zero display.
**Rationale**: Simple, defensive fix that handles undefined/NaN edge cases.
**Alternatives Considered**:

- `Number(charCount)` - more verbose
- `charCount ?? 0` - doesn't handle NaN

### Q2: Best approach for simple markdown rendering?

**Investigation**: Evaluate markdown parsing options for `**bold**`, `*italic*`, `` `code` ``.

**Options Evaluated**:

| Option             | Bundle Size | Complexity | Suitability |
| ------------------ | ----------- | ---------- | ----------- |
| marked/markdown-it | 30-50KB     | High       | Overkill    |
| react-markdown     | 25KB        | Medium     | Overkill    |
| Custom regex       | 0KB         | Low        | ✅ Perfect  |

**Decision**: Use custom regex-based `parseMarkdown` function.
**Rationale**:

- Zero additional bundle size
- Full control over rendering
- Handles only needed syntax
- Easy to test and maintain
  **Alternatives Rejected**:
- External libraries add unnecessary weight for 3 markdown patterns

### Q3: Regex pattern for markdown parsing

**Investigation**: Design regex that captures `**bold**`, `*italic*`, and `` `code` `` without conflicts.

**Challenge**: `*italic*` must not match inside `**bold**`.

**Decision**: Use pattern `/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g`

- Order in alternation: bold first (`**`), then italic (`*`)
- `[^*]+` ensures non-greedy matching
- Split preserves unmatched text

**Testing**: Pattern handles:

- `**bold**` → matches as bold
- `*italic*` → matches as italic (only if not inside bold)
- `` `code` `` → matches as code
- `**unclosed` → no match, preserved as text

## Summary

All research questions resolved. Implementation approach is validated.
