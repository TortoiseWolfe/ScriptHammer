# Feature Specification: UX Polish - Character Count & Markdown Rendering

**Feature Branch**: `008-feature-008-ux`
**Created**: 2025-11-29
**Status**: Draft
**Input**: User description: "Feature 008: UX Polish - Two fixes: (1) Character count shows '/ 10000' instead of '0 / 10000' - add fallback display, (2) Welcome message shows raw markdown **bold** - add simple markdown rendering to MessageBubble component to parse **bold** and display as actual bold text"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Character Count Display (Priority: P1)

User views the message input area and sees an accurate character count showing "0 / 10000 characters" when empty, not "/ 10000 characters".

**Why this priority**: Core UX feedback - users need to know how many characters they've typed and have remaining. Missing count creates confusion.

**Independent Test**: Open any conversation, verify character count shows "0 / 10000 characters" on initial load and increments as user types.

**Acceptance Scenarios**:

1. **Given** an empty message input, **When** user views the chat, **Then** character count displays "0 / 10000 characters"
2. **Given** user types "Hello", **When** viewing character count, **Then** it displays "5 / 10000 characters"
3. **Given** user clears the input, **When** viewing character count, **Then** it displays "0 / 10000 characters"

---

### User Story 2 - Markdown Rendering (Priority: P1)

User receives a message containing markdown syntax and sees it rendered properly:

- `**bold text**` renders as **bold text**
- `*italic text*` renders as _italic text_
- `` `code` `` renders as inline code
- Line breaks are preserved

**Why this priority**: The admin welcome message uses markdown for emphasis. Raw asterisks look unprofessional and confusing.

**Independent Test**: View the admin welcome message or any message with markdown, verify text renders correctly without raw syntax.

**Acceptance Scenarios**:

1. **Given** a message containing `**bold**`, **When** displayed in MessageBubble, **Then** "bold" appears in bold without asterisks
2. **Given** a message containing `*italic*`, **When** displayed in MessageBubble, **Then** "italic" appears italicized without asterisks
3. **Given** a message containing `` `code` ``, **When** displayed in MessageBubble, **Then** "code" appears in monospace style without backticks
4. **Given** a message containing `**multiple** **bold** words`, **When** displayed, **Then** each bold word renders correctly
5. **Given** a message with no markdown, **When** displayed, **Then** content renders unchanged
6. **Given** a message with unmatched `**asterisks`, **When** displayed, **Then** raw text is preserved (no breaking)

---

### Edge Cases

- What happens when `charCount` is undefined or NaN? Display "0" as fallback.
- What happens with nested markdown like `**bold *italic***`? Parse outer syntax first, inner may not render.
- What happens with escaped asterisks like `\**not bold\**`? For simplicity, don't handle escaping - treat as markdown.
- What happens with very long bold/italic sections? Render normally, no length restrictions.
- What happens with unclosed backticks like `` `code ``? Preserve raw text (no breaking).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: MessageInput MUST display character count as `{count} / {limit} characters` where count defaults to 0 (showing "0" when empty, not blank or undefined)
- **FR-003**: MessageBubble MUST parse `**text**` markdown and render as bold `<strong>` elements
- **FR-004**: MessageBubble MUST parse `*text*` markdown and render as italic `<em>` elements
- **FR-005**: MessageBubble MUST parse `` `text` `` markdown and render as inline code `<code>` elements
- **FR-006**: MessageBubble MUST preserve line breaks in messages
- **FR-007**: MessageBubble MUST preserve non-markdown text unchanged
- **FR-008**: MessageBubble MUST handle multiple markdown sections in one message
- **FR-009**: MessageBubble MUST NOT break on malformed markdown (unmatched syntax)

### Technical Implementation

**Files to modify:**

| File                                                    | Change                              |
| ------------------------------------------------------- | ----------------------------------- | --- | --------------------------------- |
| `src/components/atomic/MessageInput/MessageInput.tsx`   | Add `                               |     | 0` fallback for charCount display |
| `src/components/atomic/MessageBubble/MessageBubble.tsx` | Add markdown parsing for `**bold**` |

**Markdown Parsing Approach:**

Simple regex replacement - no external library needed:

```tsx
// Parse basic markdown: **bold**, *italic*, `code`
const parseMarkdown = (text: string): React.ReactNode => {
  // Order matters: process bold (**) before italic (*) to avoid conflicts
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

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Character count displays "0 / 10000 characters" on initial page load with empty input
- **SC-002**: Welcome message from admin displays bold text without visible asterisks
- **SC-003**: All existing message functionality continues working: send/receive messages, edit/delete, typing indicator, scroll behavior
- **SC-004**: No console errors related to markdown parsing
- **SC-005**: Full test suite passes (`pnpm test`) with no new failures
