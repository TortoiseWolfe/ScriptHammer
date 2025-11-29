# Contract: Messages Page Scroll Fix

**Module**: `src/app/messages/page.tsx`
**Feature**: 004-feature-oauth-ux

## Issue Analysis

The `drawer-content` div at line 290 is missing `h-full` class, which may cause the flex container to not calculate height correctly for child scroll containers.

## Current Code (Line 290)

```tsx
<div className="drawer-content flex flex-col">
```

## Fixed Code

```tsx
<div className="drawer-content flex h-full flex-col">
```

## CSS Inheritance Chain

```
div.fixed.inset-0.top-16          → Full viewport minus navbar (calc(100vh - 64px))
  └── div.drawer.h-full           → h-full = 100% of parent
        └── div.drawer-content    → MISSING h-full = height undefined
              └── main.flex-1     → flex-1 only works if parent has defined height
                    └── ChatWindow.h-full
                          └── MessageThread.flex-1
                                └── div.h-full.overflow-y-auto  → Scroll container
```

## Expected Behavior After Fix

1. `drawer-content` gets explicit `h-full` → height = 100% of drawer
2. `main.flex-1` can expand to fill available space
3. `ChatWindow.h-full` fills main container
4. `MessageThread.flex-1` fills ChatWindow
5. Inner scroll container has defined height → scrolling works

## Testing

### Desktop

- Open conversation with long welcome message
- Should be able to scroll to see entire message

### Mobile

- Open sidebar drawer
- Select conversation
- Should scroll within ChatWindow area

### Viewport Sizes

- Test 320px width (mobile)
- Test 768px width (tablet breakpoint)
- Test 1024px+ width (desktop)

## Regression Risk

- Low: Adding `h-full` is additive
- Drawer component already has `h-full`
- No removal of existing styles
