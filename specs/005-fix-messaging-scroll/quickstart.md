# Quickstart: Fix Messaging Scroll

## Overview

This fix addresses a critical UX bug where users cannot see the message input or scroll to the bottom of messages on all viewports.

## Files to Modify

| File                                                       | Change                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `src/components/organisms/ChatWindow/ChatWindow.tsx`       | Replace `flex flex-col` with `grid grid-rows-[auto_1fr_auto]` |
| `src/components/molecular/MessageThread/MessageThread.tsx` | Change jump button from `fixed` to `absolute`                 |
| `src/app/messages/page.tsx`                                | Ensure `h-full` on main element                               |

## Quick Test

1. Start the dev server: `docker compose exec scripthammer pnpm run dev`
2. Navigate to `/messages` with a conversation selected
3. Verify:
   - Message input is visible at bottom on mobile (375px)
   - Message input is visible at bottom on desktop (1280px)
   - Scrolling works in the message thread
   - Jump-to-bottom button appears when scrolled up and doesn't overlap input

## CSS Grid Pattern

The fix uses the `auto_1fr_auto` grid pattern:

```tsx
// ChatWindow.tsx
<div className="grid h-full grid-rows-[auto_1fr_auto]">
  <div>Header (auto height)</div>
  <MessageThread className="min-h-0 overflow-hidden" />{' '}
  {/* 1fr = remaining space */}
  <div>MessageInput (auto height)</div>
</div>
```

## Viewport Testing

Test on these viewport sizes:

- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1280x800 (Laptop)

All must show the message input visible at the bottom without scrolling the page.
