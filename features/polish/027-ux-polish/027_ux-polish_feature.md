# Feature: UX Polish - Character Count & Markdown Rendering

**Feature ID**: 027
**Category**: polish
**Source**: ScriptHammer_v_001/specs/008-feature-008-ux
**Status**: Ready for SpecKit

## Description

Two UX fixes for the messaging system: (1) Character count displays "/ 10000" instead of "0 / 10000" when empty - add fallback display, (2) Welcome message shows raw markdown `**bold**` - add simple markdown rendering to MessageBubble component to parse and render as actual formatting.

## User Scenarios

### US-1: Character Count Display (P1)

User views the message input area and sees an accurate character count showing "0 / 10000 characters" when empty.

**Acceptance Criteria**:

1. Given an empty message input, when user views chat, then character count displays "0 / 10000 characters"
2. Given user types "Hello", when viewing count, then it displays "5 / 10000 characters"
3. Given user clears input, when viewing count, then it displays "0 / 10000 characters"

### US-2: Markdown Rendering (P1)

User receives messages containing markdown syntax and sees it rendered properly.

**Acceptance Criteria**:

1. Given message with `**bold**`, when displayed, then "bold" appears in bold without asterisks
2. Given message with `*italic*`, when displayed, then "italic" appears italicized without asterisks
3. Given message with `` `code` ``, when displayed, then "code" appears in monospace without backticks
4. Given message with `**multiple** **bold** words`, when displayed, then each renders correctly
5. Given message with no markdown, when displayed, then content renders unchanged
6. Given message with unmatched `**asterisks`, when displayed, then raw text is preserved

## Requirements

### Functional

- FR-001: MessageInput MUST display character count as `{count} / {limit} characters` with count defaulting to 0
- FR-002: MessageBubble MUST parse `**text**` and render as bold `<strong>` elements
- FR-003: MessageBubble MUST parse `*text*` and render as italic `<em>` elements
- FR-004: MessageBubble MUST parse `` `text` `` and render as inline code `<code>` elements
- FR-005: MessageBubble MUST preserve line breaks in messages
- FR-006: MessageBubble MUST preserve non-markdown text unchanged
- FR-007: MessageBubble MUST handle multiple markdown sections in one message
- FR-008: MessageBubble MUST NOT break on malformed markdown (unmatched syntax)

### Key Files

| File                                                    | Change                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- | --- | --------------------------------- |
| `src/components/atomic/MessageInput/MessageInput.tsx`   | Add `                                                         |     | 0` fallback for charCount display |
| `src/components/atomic/MessageBubble/MessageBubble.tsx` | Add markdown parsing for `**bold**`, `*italic*`, `` `code` `` |

### Edge Cases

- charCount is undefined or NaN: Display "0" as fallback
- Nested markdown like `**bold *italic***`: Parse outer syntax first
- Unclosed backticks like `` `code ``: Preserve raw text (no breaking)

### Out of Scope

- Full markdown parser (links, headers, lists)
- Code block syntax highlighting
- Emoji rendering from shortcodes
- @mentions or #hashtags

## Success Criteria

- SC-001: Character count displays "0 / 10000 characters" on initial page load
- SC-002: Welcome message from admin displays bold text without visible asterisks
- SC-003: All existing message functionality continues working
- SC-004: No console errors related to markdown parsing
- SC-005: Full test suite passes with no new failures
