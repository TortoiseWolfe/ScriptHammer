# Feature Specification: UX Polish - Character Count & Markdown Rendering

**Feature ID**: 027-ux-polish
**Created**: 2025-12-31
**Status**: Specified
**Category**: Polish

## Overview

Two targeted UX improvements for the messaging system: (1) Fix character count display to show "0 / 10000" instead of "/ 10000" when the input is empty, and (2) Add simple markdown rendering to message bubbles so text formatting like **bold**, _italic_, and `code` renders properly instead of showing raw syntax.

---

## User Scenarios & Testing

### User Story 1 - Accurate Character Count Display (Priority: P1)

A user views the message input area and expects to see an accurate character count showing their current usage, including "0" when the field is empty.

**Why this priority**: Visual bug that creates confusion about the interface state. Users may think the counter is broken.

**Independent Test**: Load a chat with empty input field, verify counter shows "0 / 10000 characters".

**Acceptance Scenarios**:

1. **Given** an empty message input, **When** user views the chat interface, **Then** character count displays "0 / 10000 characters"
2. **Given** user types "Hello", **When** viewing the character count, **Then** it displays "5 / 10000 characters"
3. **Given** user clears the input field, **When** viewing the character count, **Then** it displays "0 / 10000 characters"
4. **Given** character count value is undefined or NaN, **When** displaying count, **Then** "0" is shown as fallback

---

### User Story 2 - Markdown Text Formatting (Priority: P1)

A user receives messages containing markdown formatting syntax and expects to see it rendered as actual formatting (bold, italic, code) rather than raw asterisks and backticks.

**Why this priority**: Core readability issue - welcome messages and formatted content look broken without proper rendering.

**Independent Test**: Send a message with `**bold**` text, verify it displays as actual bold text without visible asterisks.

**Acceptance Scenarios**:

1. **Given** message contains `**text**`, **When** displayed in message bubble, **Then** "text" appears in bold without asterisks
2. **Given** message contains `*text*`, **When** displayed in message bubble, **Then** "text" appears italicized without asterisks
3. **Given** message contains `` `text` ``, **When** displayed in message bubble, **Then** "text" appears in monospace font without backticks
4. **Given** message contains multiple formatted sections like `**one** and **two**`, **When** displayed, **Then** each section renders correctly
5. **Given** message contains no markdown syntax, **When** displayed, **Then** content renders unchanged
6. **Given** message contains unmatched syntax like `**broken`, **When** displayed, **Then** raw text is preserved (no breaking)

---

### Edge Cases

**Character Count Edge Cases**:

- charCount is undefined: Display "0" as fallback
- charCount is NaN: Display "0" as fallback
- charCount is negative (shouldn't happen): Display "0" as fallback

**Markdown Parsing Edge Cases**:

- Nested markdown like `**bold *italic***`: Parse outer syntax first, inner may not render
- Unclosed backticks like `` `code ``: Preserve raw text, no breaking
- Multiple asterisks `***text***`: Treat as bold (outermost valid pair)
- Empty markdown `****` or `**`: Render as empty (no visible output)
- Escaped characters: Not supported (render as-is)
- Markdown at word boundaries only: `word**bold**word` should work
- Line breaks in messages: Preserve as-is (convert to `<br>` or newlines)

**Cross-Feature Edge Cases**:

- Messages with both markdown and emoji: Both should render correctly
- Very long messages with many markdown sections: No performance degradation
- RTL languages with markdown: Formatting should still apply correctly

---

## Requirements

### Functional Requirements

**Character Count**:

- **FR-001**: Message input MUST display character count in format `{count} / {limit} characters`
- **FR-002**: Character count MUST default to 0 when input is empty
- **FR-003**: Character count MUST handle undefined/NaN values by displaying 0
- **FR-004**: Character count MUST update in real-time as user types

**Markdown Rendering**:

- **FR-005**: Message bubble MUST parse `**text**` and render as bold (`<strong>`) elements
- **FR-006**: Message bubble MUST parse `*text*` (single asterisks) and render as italic (`<em>`) elements
- **FR-007**: Message bubble MUST parse `` `text` `` (backticks) and render as inline code (`<code>`) elements
- **FR-008**: Message bubble MUST preserve line breaks in messages
- **FR-009**: Message bubble MUST preserve non-markdown text unchanged
- **FR-010**: Message bubble MUST handle multiple markdown sections in one message
- **FR-011**: Message bubble MUST NOT break on malformed markdown (unmatched syntax preserved as-is)
- **FR-012**: Markdown parsing MUST NOT introduce XSS vulnerabilities (no HTML injection)

**Backwards Compatibility**:

- **FR-013**: All existing message functionality MUST continue working unchanged
- **FR-014**: Existing messages without markdown MUST display identically to before

### Non-Functional Requirements

**Performance**:

- **NFR-001**: Markdown parsing MUST NOT add noticeable delay to message rendering (<10ms per message)
- **NFR-002**: Character count updates MUST be instant (no perceptible lag while typing)

**Reliability**:

- **NFR-003**: No console errors MUST occur related to markdown parsing
- **NFR-004**: Full test suite MUST pass with no new failures

**Accessibility**:

- **NFR-005**: Rendered markdown MUST use semantic HTML elements (strong, em, code)
- **NFR-006**: Markdown rendering MUST NOT break screen reader announcements

### Key Entities

**Message Input**:

- Character count display with current/limit format
- Real-time count updates
- Fallback handling for undefined values

**Message Bubble**:

- Text content with optional markdown formatting
- Supported syntax: bold (`**`), italic (`*`), inline code (`` ` ``)
- Graceful handling of malformed syntax

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Character count displays "0 / 10000 characters" on initial page load with empty input
- **SC-002**: Welcome message from admin displays bold text without visible asterisks
- **SC-003**: All three markdown syntaxes (bold, italic, code) render correctly in messages
- **SC-004**: All existing message functionality continues working (no regressions)
- **SC-005**: No console errors related to markdown parsing
- **SC-006**: Full test suite passes with no new failures
- **SC-007**: Malformed markdown displays as raw text without breaking the UI

---

## Dependencies

- **009-User Messaging System**: Components being modified (MessageInput, MessageBubble)
- **012-Welcome Message Architecture**: Welcome messages use markdown formatting

## Out of Scope

- Full markdown parser (links, headers, lists, blockquotes)
- Code block syntax highlighting (multi-line fenced code)
- Emoji rendering from shortcodes (`:smile:`)
- @mentions or #hashtags parsing
- Message editing with live markdown preview
- User-configurable markdown preferences

## Assumptions

- Only simple inline markdown is needed (bold, italic, code)
- Existing MessageBubble and MessageInput components are well-structured for modification
- No server-side markdown parsing is required (client-side only)
- Welcome messages already contain markdown syntax that needs rendering
- Character limit remains at 10000 characters
