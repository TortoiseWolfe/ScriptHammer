# Feature: Unified Messaging Sidebar

**Feature ID**: 026
**Category**: integrations
**Source**: ScriptHammer_v_001/docs/specs/037-unified-messaging-sidebar
**Status**: Ready for SpecKit

## Description

A unified messaging sidebar that consolidates chats, connections, and user search into a single tabbed interface. Allows users to message connections directly with a single click, replacing the previous multi-page navigation flow. Includes mobile drawer pattern and real-time badge updates.

## User Scenarios

### US-1: Message an Accepted Connection (P1)

A user with accepted connections clicks "Message" next to any connection to immediately start a conversation.

**Acceptance Criteria**:

1. Given accepted connections list, when "Message" clicked, then conversation opens
2. Given no prior conversation, when messaging initiated, then new conversation is created
3. Given existing conversation, when "Message" clicked, then existing conversation opens (no duplicate)

### US-2: Unified Tab Navigation (P2)

A user sees chats, connections, and user search in a single sidebar with tabs.

**Acceptance Criteria**:

1. Given /messages page, when "Chats" tab clicked, then existing conversations list shows
2. Given /messages page, when "Connections" tab clicked, then pending/accepted connections show
3. Given /messages page, when "Find People" tab clicked, then user search interface shows
4. Given tab switch, when returning to previous tab, then scroll position is preserved

### US-3: Mobile Drawer Pattern (P3)

On mobile, the sidebar collapses into a drawer that can be opened/closed.

**Acceptance Criteria**:

1. Given mobile viewport (<768px), when /messages opens, then sidebar is full-screen view
2. Given sidebar on mobile, when conversation tapped, then sidebar closes and chat is full-screen
3. Given chat on mobile, when back button tapped, then sidebar drawer reopens
4. Given desktop viewport (>=768px), when /messages opens, then sidebar and chat are side-by-side

### US-4: Consolidated Entry Point (P4)

/messages is the single entry point for all messaging features with legacy route redirects.

**Acceptance Criteria**:

1. Given /messages/connections visited, when page loads, then redirect to /messages?tab=connections
2. Given /conversations visited, when page loads, then redirect to /messages?tab=chats
3. Given invalid ?tab param, when page loads, then default to "chats" tab silently

## Requirements

### Functional

**Core Navigation**

- FR-001: Tabbed sidebar with Chats, Connections, Find People sections
- FR-002: "Message" button on each accepted connection in Connections tab
- FR-003: Create or retrieve existing conversation when "Message" clicked
- FR-004: Enforce canonical ordering for conversations (smaller UUID = participant_1)
- FR-005: Verify connection status is "accepted" before allowing conversation creation

**Mobile Responsiveness**

- FR-006: Collapse sidebar into drawer on mobile (<768px)
- FR-007: Maintain 44px minimum touch targets on all interactive elements

**Navigation & Routing**

- FR-008: Redirect legacy routes (/conversations, /messages/connections) to /messages
- FR-009: Preserve tab state and scroll position when switching tabs
- FR-010: URL state via ?tab=chats|connections|find with optional &conversation=<uuid>

**Badges & Real-time**

- FR-011: Show unread message count on Chats tab badge
- FR-012: Show pending connection count on Connections tab badge
- FR-013: Default to "Chats" tab when navigating to /messages directly
- FR-014: Real-time badge updates via Supabase subscriptions

### Accessibility

- AR-001: Tab container uses role="tablist" with proper ARIA attributes
- AR-002: Keyboard navigation for tabs (Arrow keys, Enter/Space, Home/End)
- AR-003: Focus management when drawer opens/closes
- AR-004: Badge counts announced to screen readers with aria-live

### Loading States

- LR-001: Show skeleton loader if content not available within 100ms
- LR-002: Show loading indicator on Message button during conversation creation
- LR-003: Tab switching does not block UI during content load
- LR-004: Offline status indicator when network unavailable

### Visual Layout

- VR-001: Desktop sidebar 320px wide, minimum content width 280px
- VR-002: Mobile drawer full viewport width
- VR-003: Consistent tab styling with DaisyUI tabs-bordered

### Data & Caching

- DC-001: Cache tab content to avoid refetch on every tab switch
- DC-002: Background refresh of cached data when tab inactive > 30 seconds

### Key Entities

- **UnifiedSidebar**: Container component managing tab state
- **SidebarTab**: Type union 'chats' | 'connections' | 'find'
- **Conversation**: Chat thread with canonical participant ordering
- **UserConnection**: Friend request with status (pending/accepted/blocked/declined)

### Error Types

| Error Type          | Condition            | User Message                                   |
| ------------------- | -------------------- | ---------------------------------------------- |
| AuthenticationError | Not signed in        | "Please sign in to send messages."             |
| ValidationError     | Invalid UUID         | "Invalid user identifier."                     |
| ConnectionError     | Not connected        | "You must be connected to message this user."  |
| NetworkError        | Database unreachable | "Network error. Please check your connection." |

### Out of Scope

- Group chat creation from sidebar
- Connection blocking from sidebar
- Message search within sidebar
- Notification settings in sidebar

## Success Criteria

- SC-001: Users can start conversation with accepted connection in 2 clicks or less
- SC-002: All messaging features accessible from single /messages page
- SC-003: Tab switching completes in under 200ms (no page reload)
- SC-004: Mobile users can access full functionality with drawer pattern
- SC-005: Zero duplicate conversations created under concurrent access
- SC-006: All components pass WCAG AA accessibility audit
- SC-007: All components follow 5-file pattern
