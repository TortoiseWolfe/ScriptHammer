# Feature Specification: Unified Messaging Sidebar

**Feature Branch**: `037-unified-messaging-sidebar`
**Created**: 2025-11-26
**Status**: Draft
**Input**: User description: "unified messaging sidebar"

## Clarifications

### Session 2025-11-26

- Q: When a user navigates to /messages directly, which tab should be selected by default? → A: Chats tab (prioritize ongoing conversations)
- Q: What URL format should be used for tab state? → A: `?tab=chats|connections|find` with optional `&conversation=<uuid>`
- Q: Should invalid tab parameters fall back to default? → A: Yes, invalid ?tab values default to 'chats'
- Q: What HTTP status code for legacy redirects? → A: 308 Permanent Redirect (preserves method)
- Q: Should tab switches add browser history entries? → A: Yes, allow back/forward navigation between tabs
- Q: What sidebar width on desktop? → A: 320px fixed width, min-width 280px for content
- Q: Should data refresh on every tab switch? → A: No, use cached data with background refresh
- Q: Should real-time updates work across tabs? → A: Yes, badge counts update in real-time regardless of active tab

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Message an Accepted Connection (Priority: P1)

As a user with accepted connections, I want to click a "Message" button next to any connection to immediately start a conversation, so I don't have to navigate through multiple pages to find where to message them.

**Why this priority**: This is the core pain point - users currently have no direct path from viewing a connection to messaging them. This single feature eliminates the biggest UX friction.

**Independent Test**: Can be fully tested by accepting a connection, clicking "Message", and verifying a conversation opens. Delivers immediate value by removing navigation friction.

**Acceptance Scenarios**:

1. **Given** I am on the messages page viewing my accepted connections, **When** I click the "Message" button next to a connection, **Then** a conversation with that user opens in the chat window
2. **Given** I have never messaged this connection before, **When** I click "Message", **Then** a new conversation is created and I can send my first message
3. **Given** I have an existing conversation with this connection, **When** I click "Message", **Then** the existing conversation opens (not a duplicate)

---

### User Story 2 - Unified Sidebar Navigation (Priority: P2)

As a user, I want to see my chats, connections, and user search in a single sidebar with tabs, so I can switch between them without navigating to different pages.

**Why this priority**: Reduces cognitive load and page navigation. Once users can message connections (P1), having everything in one place makes the experience seamless.

**Independent Test**: Can be tested by switching between Chats/Connections/Find People tabs and verifying each displays the correct content without page reload.

**Acceptance Scenarios**:

1. **Given** I am on the /messages page, **When** I click the "Chats" tab, **Then** I see my existing conversations list
2. **Given** I am on the /messages page, **When** I click the "Connections" tab, **Then** I see my pending and accepted connections with action buttons
3. **Given** I am on the /messages page, **When** I click the "Find People" tab, **Then** I see a user search interface to find new users
4. **Given** I switch tabs, **When** I return to a previous tab, **Then** my scroll position and any search filters are preserved

---

### User Story 3 - Mobile Drawer Pattern (Priority: P3)

As a mobile user, I want the sidebar to collapse into a drawer that I can open/close, so I can focus on either the conversation list or the active chat without crowding.

**Why this priority**: Mobile responsiveness is important but secondary to core functionality. Desktop users can use the feature without this.

**Independent Test**: Can be tested on mobile viewport by opening drawer, selecting a conversation, verifying drawer closes, and using back button to reopen.

**Acceptance Scenarios**:

1. **Given** I am on mobile viewport (<768px), **When** I open /messages, **Then** I see the sidebar as a full-screen view (no chat window visible)
2. **Given** I am viewing the sidebar on mobile, **When** I tap a conversation, **Then** the sidebar closes and the chat window becomes full-screen
3. **Given** I am viewing a chat on mobile, **When** I tap the back/menu button, **Then** the sidebar drawer opens again
4. **Given** I am on tablet or desktop (>=768px), **When** I open /messages, **Then** both sidebar and chat window are visible side-by-side

---

### User Story 4 - Consolidated Entry Point (Priority: P4)

As a user, I want /messages to be the single entry point for all messaging features, so I don't get confused navigating between /conversations, /messages, and /messages/connections.

**Why this priority**: Navigation cleanup. Lower priority because it's about removing old pages, not adding new functionality.

**Independent Test**: Can be tested by visiting old URLs and verifying they redirect appropriately to /messages with correct tab selected.

**Acceptance Scenarios**:

1. **Given** I visit /messages/connections, **When** the page loads, **Then** I am redirected to /messages with the "Connections" tab active
2. **Given** I visit /conversations, **When** the page loads, **Then** I am redirected to /messages with the "Chats" tab active
3. **Given** I click "Connections" in GlobalNav, **When** the navigation completes, **Then** I arrive at /messages with "Connections" tab active (not a separate page)

---

### Edge Cases

#### Empty States

- What happens when a user has no conversations (Chats tab)? → Show empty state: "No conversations yet. Connect with people to start chatting!" with button linking to Find People tab
- What happens when a user has no connections (Connections tab)? → Show empty state: "No connections yet. Find people to connect with!" with button linking to Find People tab
- What happens when user search returns no results (Find People tab)? → Show empty state: "No users found matching '[query]'. Try a different search term."

#### Error States

- What happens when clicking "Message" on a connection that was just blocked? → Show toast error: "Unable to message this user. Connection no longer active." and refresh connection list
- What happens when getOrCreateConversation fails due to auth error? → Show toast error: "Please sign in to send messages." and redirect to /sign-in
- What happens when getOrCreateConversation fails due to connection not accepted? → Show toast error: "You must be connected to message this user."
- What happens when getOrCreateConversation fails due to network error? → Show toast error: "Network error. Please check your connection and try again." with retry button
- What happens when tab content fails to load? → Show inline error: "Failed to load [tab name]. Tap to retry." with retry button

#### Race Conditions & Concurrency

- What happens when two users try to create conversation simultaneously? → Handle race condition with upsert using UNIQUE constraint on (participant_1_id, participant_2_id), catch error code 23505, retry fetch to get existing conversation
- What happens when connection status changes while viewing Connections tab? → Real-time subscription updates connection list automatically

#### Network & Offline

- What happens when user loses network while switching tabs? → Show cached data with offline indicator banner: "You're offline. Showing cached data."
- What happens on very slow connections? → Show loading skeletons (not spinners) within 100ms, don't block tab switching UI
- What happens when user goes offline mid-conversation creation? → Queue action for retry, show toast: "Message will be sent when you're back online."

#### Navigation Edge Cases

- What happens with ?tab=invalid URL parameter? → Silently default to 'chats' tab
- What happens with ?conversation=invalid-uuid? → Ignore invalid conversation param, show tab content normally
- What happens when deep-linking to ?tab=connections&conversation=xyz? → Show Connections tab (tab param takes precedence), ignore conversation param

## Requirements _(mandatory)_

### Functional Requirements

#### Core Navigation (FR-001 to FR-003)

- **FR-001**: System MUST display a tabbed sidebar with three sections: "Chats", "Connections", "Find People"
  - Tab labels: "Chats", "Connections", "Find People" (no icons, text only)
  - Tab styling: DaisyUI `tabs tabs-bordered` with `tab-active` for selected state
- **FR-002**: System MUST show a "Message" button on each accepted connection in the Connections tab
  - Button placement: Right side of connection item, inline with user info
  - Button styling: `btn btn-primary btn-sm min-h-11 min-w-11` (44px touch target)
  - Button text: "Message" (visible) or chat icon with aria-label on narrow viewports
- **FR-003**: System MUST create or retrieve an existing conversation when "Message" is clicked (getOrCreateConversation)
  - Input: otherUserId (string, must be valid UUID format)
  - Output: conversationId (string, UUID of existing or newly created conversation)
  - Validation: Validate UUID format before database query
  - Auth check: Verify authenticated user before any database operation

#### Conversation Creation (FR-004 to FR-005)

- **FR-004**: System MUST enforce canonical ordering for conversations (smaller UUID = participant_1)
  - Example: If userA='123e4567-...' and userB='987fcdeb-...', then participant_1='123e4567-...' (lexicographically smaller)
  - Purpose: Prevents duplicate conversations between same two users
- **FR-005**: System MUST verify connection status is "accepted" before allowing conversation creation
  - Check timing: Server-side validation in getOrCreateConversation before INSERT
  - Error: Throw ConnectionError("Users are not connected") if status !== 'accepted'

#### Mobile Responsiveness (FR-006 to FR-007)

- **FR-006**: System MUST collapse sidebar into a drawer on mobile viewports (<768px)
  - Drawer component: DaisyUI `drawer md:drawer-open`
  - Drawer toggle: Hamburger menu button in top-left, 44px touch target
  - Auto-close: Drawer closes when conversation is selected on mobile
- **FR-007**: System MUST maintain 44px minimum touch targets on all interactive elements
  - Applies to: Tabs, Message buttons, drawer toggle, conversation items, connection items
  - Minimum spacing: 8px between adjacent touch targets to prevent mis-taps

#### Navigation & Routing (FR-008 to FR-009)

- **FR-008**: System MUST redirect legacy routes (/conversations, /messages/connections) to /messages with appropriate tab
  - /conversations → /messages?tab=chats (HTTP 308 Permanent Redirect)
  - /messages/connections → /messages?tab=connections (HTTP 308 Permanent Redirect)
- **FR-009**: System MUST preserve tab state and scroll position when switching between tabs
  - URL state: Use `?tab=chats|connections|find` as single source of truth
  - Scroll preservation: Store scroll position per-tab in useRef, restore on tab return
  - Browser history: Tab switches push to history (supports back/forward navigation)
  - Selected conversation: Preserve via `?conversation=<uuid>` URL param

#### Badge Display (FR-010 to FR-012)

- **FR-010**: System MUST show unread message counts on the "Chats" tab badge
  - Badge position: Top-right corner of tab, overlapping tab edge
  - Badge styling: DaisyUI `badge badge-primary badge-sm`
  - Display format: Show exact number for 1-99, show "99+" for counts >= 100
  - Real-time: Update via Supabase realtime subscription
- **FR-011**: System MUST show pending connection request counts on the "Connections" tab badge
  - Same styling as FR-010
  - Count: Only incoming pending requests (not sent requests)
- **FR-012**: System MUST default to "Chats" tab when user navigates to /messages directly (not via redirect)
  - Invalid tab param: ?tab=invalid defaults to 'chats' silently

### Accessibility Requirements

#### ARIA & Semantic Structure (AR-001 to AR-004)

- **AR-001**: Tab container MUST use `role="tablist"` with proper ARIA attributes
  - Container: `role="tablist"`, `aria-label="Messaging sections"`
  - Each tab: `role="tab"`, `aria-selected="true|false"`, `aria-controls="panel-id"`
  - Tab panels: `role="tabpanel"`, `aria-labelledby="tab-id"`, `id="panel-id"`
- **AR-002**: System MUST support keyboard navigation for tabs
  - Arrow Left/Right: Move focus between tabs
  - Enter/Space: Activate focused tab
  - Home: Move focus to first tab
  - End: Move focus to last tab
- **AR-003**: Focus MUST be managed correctly when drawer opens/closes
  - Drawer open: Focus moves to first focusable element in drawer (first tab)
  - Drawer close: Focus returns to element that triggered close (conversation item or toggle)
- **AR-004**: Badge counts MUST be announced to screen readers
  - Implementation: `aria-label="Chats, 5 unread messages"` on tab
  - Live updates: Use `aria-live="polite"` region for count changes

#### Visual Accessibility (AR-005 to AR-006)

- **AR-005**: Selected conversation MUST have visible focus indicator
  - Styling: `ring-2 ring-primary` or equivalent visible outline
  - Color contrast: Minimum 3:1 against background (WCAG AA)
- **AR-006**: Error and success messages MUST be perceivable
  - Toast notifications: `role="alert"`, `aria-live="assertive"`
  - Inline errors: Associated with form field via `aria-describedby`

### Loading State Requirements

#### Skeleton Loaders (LR-001 to LR-003)

- **LR-001**: System MUST show loading skeleton if content not available within 100ms of tab switch
  - Timing: If cached data available, render immediately (no skeleton). If data requires fetch, wait 100ms then show skeleton to avoid flash for fast responses.
  - Skeleton style: DaisyUI skeleton classes matching content layout
  - Duration: Display until data loads or error occurs
- **LR-002**: System MUST show loading indicator on Message button during conversation creation
  - Indicator: Replace button text with spinner, disable button
  - Duration: Until conversation created or error occurs
- **LR-003**: System MUST NOT block tab switching UI during content load
  - Tab activation: Immediate visual feedback on tab click
  - Content area: Show skeleton while loading, don't prevent tab interaction

#### Progress Indicators (LR-004)

- **LR-004**: System MUST indicate offline status when network unavailable
  - Indicator: Banner at top of sidebar: "You're offline. Showing cached data."
  - Styling: `alert alert-warning` with offline icon
  - Dismissal: Auto-dismiss when connection restored

### Visual Layout Requirements

#### Sidebar Dimensions (VR-001 to VR-002)

- **VR-001**: Desktop sidebar MUST be 320px wide with minimum content width of 280px
  - Fixed width: `w-80` (320px) on md: and larger viewports
  - Scrollable: Vertical scroll within sidebar, not affecting chat window
- **VR-002**: Mobile drawer MUST be full viewport width
  - Width: `w-full` or `100vw`
  - Height: Full viewport height minus any fixed headers

#### Tab Styling (VR-003)

- **VR-003**: Tabs MUST have consistent visual treatment
  - Inactive: `tab` base class
  - Active: `tab tab-active` with underline indicator
  - Hover: Subtle background change on hover (handled by DaisyUI)
  - Badge: Positioned top-right, does not affect tab click area

### Real-time Requirements

#### Live Updates (RT-001 to RT-002)

- **RT-001**: Unread message counts MUST update in real-time regardless of active tab
  - Subscription: Supabase realtime on messages table filtered by participant
  - Update trigger: New message where recipient is current user and conversation not active
- **RT-002**: Connection request counts MUST update in real-time
  - Subscription: Supabase realtime on user_connections table
  - Update trigger: New pending connection where addressee is current user

### Data & Caching Requirements

#### Cache Strategy (DC-001 to DC-002)

- **DC-001**: System MUST cache tab content to avoid refetch on every tab switch
  - Cache duration: Until explicit refresh or real-time update received
  - Cache invalidation: On new message, new connection, or manual refresh
  - Implementation: Use React state/context; existing hooks (useConversations, useConnections) already cache
- **DC-002**: System MUST support background refresh of cached data
  - Trigger: When tab becomes active after being inactive > 30 seconds
  - Inactive definition: Tab was not the active tab (user switched away and back)
  - Measurement: Track `lastActiveTimestamp` per tab in useRef, compare on tab activation
  - UX: Show cached data immediately, update silently when fresh data arrives

### Key Entities

- **UnifiedSidebar**: Container component managing tab state and rendering appropriate content for each tab
- **SidebarTab**: Type union of tab identifiers: `'chats' | 'connections' | 'find'`
- **Conversation**: Existing entity - chat thread between two users with canonical participant ordering
- **UserConnection**: Existing entity - friend request with status (pending/accepted/blocked/declined)

### Error Types

The following error types may be thrown by `getOrCreateConversation()`:

| Error Type            | Condition                                      | User Message                                                 |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `AuthenticationError` | User not signed in                             | "Please sign in to send messages."                           |
| `ValidationError`     | Invalid UUID format for otherUserId            | "Invalid user identifier."                                   |
| `ConnectionError`     | Users not connected or connection not accepted | "You must be connected to message this user."                |
| `ConflictError`       | Race condition during creation (code 23505)    | N/A - silently retry fetch                                   |
| `NetworkError`        | Database unreachable or timeout                | "Network error. Please check your connection and try again." |
| `UnknownError`        | Unexpected database error                      | "Something went wrong. Please try again."                    |

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can start a conversation with an accepted connection in 2 clicks or less
  - Click 1: "Message" button on connection
  - Click 2: Send first message (optional - conversation opens ready to type)
  - Measurement: Manual verification via acceptance test
  - Previous state: 4+ clicks (navigate to messages → find user → start chat → send)

- **SC-002**: All messaging features accessible from single /messages page
  - Verification: Chats, Connections, Find People all accessible via tabs
  - Measurement: No navigation away from /messages required for any messaging action
  - Previous state: 3 separate pages (/messages, /conversations, /messages/connections)

- **SC-003**: Tab switching completes in under 200ms (no page reload)
  - Measurement: Use Performance API - `performance.now()` before/after tab click handler
  - Threshold: 200ms from click event to content visible (or skeleton visible if loading)
  - Test method: Automated test using `measureUserAgentSpecificMemory` or manual DevTools

- **SC-004**: Mobile users can access full functionality with drawer pattern
  - Verification: All features work on viewport < 768px
  - Measurement: Touch target audit using browser DevTools (all targets ≥ 44px)
  - Test method: Pa11y with mobile viewport + manual testing

- **SC-005**: Zero duplicate conversations created under concurrent access
  - Verification: UNIQUE constraint on (participant_1_id, participant_2_id)
  - Measurement: Unit test simulating race condition returns same conversation ID
  - Test method: Jest test with mocked concurrent requests

- **SC-006**: All new components pass accessibility audit (WCAG AA)
  - Threshold: Zero Pa11y errors at WCAG2AA level
  - Threshold: Zero axe-core violations (serious or critical)
  - Test method: `UnifiedSidebar.accessibility.test.tsx` automated tests

- **SC-007**: All components follow 5-file pattern
  - Verification: Each new component has: index.tsx, Component.tsx, Component.test.tsx, Component.stories.tsx, Component.accessibility.test.tsx
  - Test method: CI pipeline component structure validation
