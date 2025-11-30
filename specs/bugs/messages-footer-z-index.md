# Bug: Footer Overlaps Conversation List Buttons on Messages Page

**Discovered**: 2025-11-30 during E2E testing
**Severity**: Low (UX annoyance, not blocking)
**Page**: `/messages`

## Description

The page footer overlaps the conversation list buttons in the sidebar, preventing normal click interactions. Playwright's click action times out because the footer intercepts pointer events.

## Steps to Reproduce

1. Navigate to https://scripthammer.com/messages
2. Log in with valid credentials
3. Unlock encryption keys
4. Try to click on a conversation in the sidebar
5. Click fails due to footer overlap

## Error from Playwright

```
TimeoutError: locator.click: Timeout 5000ms exceeded.
- <p class="text-base-content/60 text-sm leading-relaxed">...</p>
  from <footer class="bg-base-200/50 border-base-300 mt-auto border-t py-4...">
  subtree intercepts pointer events
```

## Workaround

JavaScript force-click works:

```javascript
element.click(); // via browser_evaluate
```

## Root Cause (Suspected)

The footer has a higher z-index or fixed positioning that overlaps the sidebar conversation list area on certain viewport sizes.

## Suggested Fix

1. Check sidebar z-index vs footer z-index
2. Ensure conversation list has proper stacking context
3. Or use `pointer-events: none` on footer when sidebar is open

## Files to Investigate

- `src/app/messages/page.tsx`
- `src/components/organisms/ConversationList/`
- Global footer component
- Layout CSS/Tailwind classes

## Priority

Low - users can still interact but automated testing is affected.
