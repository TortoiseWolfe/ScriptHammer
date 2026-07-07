# Quickstart: UX Polish Implementation

**Feature**: 008-feature-008-ux
**Time Estimate**: 30 minutes

## Prerequisites

- Docker environment running: `docker compose up`
- On feature branch: `008-feature-008-ux`

## Implementation Steps

### Step 1: Fix Character Count (5 minutes)

**File**: `src/components/atomic/MessageInput/MessageInput.tsx`

Find line 192:

```tsx
{charCount} / {charLimit} characters
```

Change to:

```tsx
{charCount || 0} / {charLimit} characters
```

### Step 2: Add Markdown Parser (10 minutes)

**File**: `src/components/atomic/MessageBubble/MessageBubble.tsx`

Add this function before the component definition (around line 20):

```tsx
/**
 * Parse basic markdown: **bold**, *italic*, `code`
 * Feature: 008-feature-008-ux
 */
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

### Step 3: Use Parser in Render (5 minutes)

**File**: `src/components/atomic/MessageBubble/MessageBubble.tsx`

Find the message content rendering (around line 281):

```tsx
<p className="break-words whitespace-pre-wrap">{message.content}</p>
```

Change to:

```tsx
<p className="break-words whitespace-pre-wrap">
  {parseMarkdown(message.content)}
</p>
```

### Step 4: Add Tests (10 minutes)

**File**: `src/components/atomic/MessageBubble/MessageBubble.test.tsx`

Add test cases for markdown parsing:

```tsx
describe('parseMarkdown', () => {
  it('renders bold text', () => {
    // Test **bold** renders as <strong>
  });

  it('renders italic text', () => {
    // Test *italic* renders as <em>
  });

  it('renders code', () => {
    // Test `code` renders as <code>
  });

  it('handles mixed markdown', () => {
    // Test **bold** and *italic* and `code` together
  });

  it('preserves unmatched asterisks', () => {
    // Test **unclosed doesn't break
  });
});
```

## Verification

1. Open any conversation in the app
2. Verify character count shows "0 / 10000 characters" when empty
3. View the admin welcome message - bold text should render without asterisks
4. Send a test message with `**bold**`, `*italic*`, and `` `code` ``
5. Verify all markdown renders correctly

## Troubleshooting

**Character count still shows blank?**

- Check that the edit is on the correct line (192)
- Restart the dev server

**Markdown not rendering?**

- Verify parseMarkdown function is exported/imported correctly
- Check browser console for React errors
- Ensure the function is called with message.content
