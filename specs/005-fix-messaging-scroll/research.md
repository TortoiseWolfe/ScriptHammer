# Research: Fix Messaging Scroll

## CSS Grid vs Flexbox for Fixed Header/Footer Layouts

**Decision**: Use CSS Grid with `grid-rows-[auto_1fr_auto]`

**Rationale**:

- CSS Grid's `1fr` unit explicitly allocates remaining space, unlike flexbox's `flex-1` which relies on parent height calculation
- The `auto_1fr_auto` pattern is the canonical solution for "header + scrollable content + footer" layouts
- Grid works reliably with `h-full` on parent containers, while nested flexbox with `h-full` has browser inconsistencies
- Tailwind CSS 4 has full support for arbitrary grid values via `grid-rows-[...]` syntax

**Alternatives Considered**:

- Flexbox with explicit heights (`calc(100vh - Xpx)`) - rejected due to fragility when parent heights change
- Flexbox with `min-h-0` on all containers - already tried, doesn't work reliably across browsers
- JavaScript-based height calculation - rejected due to complexity and performance concerns

## Jump Button Positioning

**Decision**: Use `absolute` positioning within the scroll container instead of `fixed`

**Rationale**:

- `fixed` positions relative to viewport, causing the button to overlap unrelated UI elements
- `absolute` positions relative to the nearest `relative` parent (MessageThread already has `relative`)
- `absolute` keeps the button within the scroll container's visual bounds
- No z-index conflicts with other page elements

**Alternatives Considered**:

- Keep `fixed` but adjust z-index - rejected because button would still overlap input on small screens
- Remove jump button entirely - rejected because it's a useful UX feature

## Height Chain Propagation

**Decision**: Ensure `h-full` (height: 100%) propagates through all container levels

**Rationale**:

- Percentage heights require explicit height on parent elements
- The chain from `fixed inset-0 top-16` → `drawer` → `drawer-content` → `main` → `ChatWindow` must all have explicit heights
- Using `h-full` on all levels ensures the Grid layout receives a concrete height

**Key Files**:

1. `src/app/messages/page.tsx` - Verify main element has `h-full`
2. `src/components/organisms/ChatWindow/ChatWindow.tsx` - Change to Grid layout
3. `src/components/molecular/MessageThread/MessageThread.tsx` - Fix button positioning
