# Research: Fix Messaging Layout

**Feature**: 007-fix-messaging-layout
**Date**: 2025-11-29

## Problem Statement

Message scroll doesn't work and input box is clipped at bottom of viewport. Users cannot see all messages or type new ones.

## Root Cause Analysis

### Current Layout Chain (6+ nested layers)

```
page.tsx:370  fixed top-16 right-0 bottom-4 left-0
  └── drawer h-full
      └── drawer-content flex h-full flex-col
          └── main min-h-0 flex-1 overflow-hidden
              └── div flex h-full flex-col overflow-hidden  ← PROBLEM
                  └── ChatWindow min-h-0 flex-1
                      └── div flex h-full flex-col overflow-hidden
                          ├── header shrink-0
                          ├── div min-h-0 flex-1 (MessageThread)
                          └── div shrink-0 (input)
```

### Why It Fails

1. **`h-full` doesn't propagate** through 6+ nested flex containers
2. **Extra wrapper div** at page.tsx:416 adds unnecessary nesting
3. **Flexbox with nested h-full** is unreliable for this pattern
4. **No explicit height allocation** - browser can't calculate scroll area

## Solution: CSS Grid

CSS Grid `grid-rows-[auto_1fr_auto]` explicitly allocates space:

| Row | Size | Content                                 |
| --- | ---- | --------------------------------------- |
| 1   | auto | Header (natural height)                 |
| 2   | 1fr  | Message list (fills remaining, scrolls) |
| 3   | auto | Input (natural height)                  |

### Why Grid Works

- **Explicit row sizes** - browser knows exactly how to allocate space
- **1fr = remaining space** - no ambiguity about scroll container height
- **No nested h-full chain** - grid calculates heights directly

## Validation

### Test Case

1. `docker compose exec scripthammer pnpm run db:reset` - creates 30 test messages
2. Login as test@example.com
3. Open conversation with admin
4. Verify: scroll bar appears, can scroll to all messages, input visible

### Browser Testing Matrix

| Browser | Viewport         | Status  |
| ------- | ---------------- | ------- |
| Chrome  | 375px (mobile)   | To test |
| Chrome  | 1440px (desktop) | To test |
| Firefox | 768px (tablet)   | To test |
| Safari  | 375px (iOS sim)  | To test |

## References

- [CSS Grid auto vs 1fr](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows)
- [Flexbox height issues](https://stackoverflow.com/questions/33636796/chrome-safari-not-filling-100-height-of-flex-parent)
