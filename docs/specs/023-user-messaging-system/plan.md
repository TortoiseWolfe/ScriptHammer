# Implementation Plan: User Messaging System with E2E Encryption

**Branch**: `023-user-messaging-system` | **Date**: 2025-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/turtle_wolfe/repos/ScriptHammer/specs/023-user-messaging-system/spec.md`

## Summary

Implement a complete user-to-user messaging system with end-to-end encryption, friend request management, and offline-first architecture. The system provides zero-knowledge encryption using ECDH + AES-GCM, real-time message delivery via Supabase Realtime, and offline message queueing with IndexedDB. Users can search for other users, send friend requests, and exchange encrypted messages in real-time once connected.

**Key Technical Decisions** (from clarification session):

- No edit history storage (edits overwrite in place)
- Typing indicators and read receipts always enabled (no privacy toggles)
- Messages deletable within 15-minute window (shows placeholder)
- Encryption keys generated lazily on first message send
- Blocked conversations remain visible as read-only history

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15.5.2 / React 19.1.0
**Primary Dependencies**: Supabase (PostgreSQL + Realtime + Auth), Dexie.js 4.0.10 (IndexedDB), Web Crypto API (built-in)
**Storage**: PostgreSQL (Supabase) for server data + IndexedDB (Dexie) for offline queue/cache
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (accessibility)
**Target Platform**: Web (PWA-enabled, mobile-first responsive)
**Project Type**: Web application (Next.js full-stack with Supabase backend)
**Performance Goals**:

- Message encryption/decryption: <100ms/<50ms
- Real-time delivery latency: <500ms
- Conversation list load: <1 second (with caching)
- Virtual scroll: 60fps for 1000+ messages

**Constraints**:

- Zero-knowledge architecture (server never sees plaintext)
- Mobile-first design (44×44px touch targets)
- WCAG AA accessibility compliance
- Works offline (IndexedDB queue + background sync)
- IndexedDB quota: 5MB for message queue

**Scale/Scope**:

- 100+ connections per user
- 1000+ messages per conversation
- 10+ concurrent active conversations
- 6 database tables, 3 IndexedDB stores
- ~15-20 React components (5-file pattern each)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ **I. Component Structure Compliance**

- All React components will follow 5-file pattern (index.tsx, Component.tsx, .test.tsx, .stories.tsx, .accessibility.test.tsx)
- Use component generator: `docker compose exec scripthammer pnpm run generate:component`
- Components: MessageBubble, MessageThread, MessageInput, ChatWindow, ConversationList, ConversationListItem, UserSearch, ConnectionManager, TypingIndicator, etc.

✅ **II. Test-First Development**

- TDD workflow: Write tests before implementation
- Unit tests for: encryption/decryption, key generation, offline queue, message validation
- Integration tests for: RLS policies, friend requests, message send/receive flows
- E2E tests for: complete messaging flow (connect → send → receive → edit → delete)
- Accessibility tests for: keyboard navigation, screen reader support, ARIA live regions
- Target coverage: 60%+ (crypto functions 100%, UI 40%+)

✅ **III. PRP Methodology**

- Following PRP-023 workflow: /specify → /clarify → **/plan** → /tasks → /implement
- Clear success criteria defined (SC-001 to SC-015)
- 4-phase implementation with deliverables

✅ **IV. Docker-First Development**

- All development in Docker containers: `docker compose up`
- Commands executed via: `docker compose exec scripthammer pnpm run <command>`
- No local npm/pnpm commands

✅ **V. Progressive Enhancement**

- Core functionality: Text messaging with E2E encryption
- Progressive features: Typing indicators, read receipts, virtual scrolling
- Offline support: IndexedDB queue with background sync
- Mobile-first: 44×44px touch targets, responsive layouts

✅ **VI. Privacy & Compliance First**

- Zero-knowledge encryption (server never sees plaintext)
- GDPR compliance: Data export (FR-044), right to erasure (FR-045)
- User consent: Blocking functionality, message deletion
- RLS policies enforce user isolation

**Constitution Compliance**: ✅ **PASS** - All 6 core principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/023-user-messaging-system/
├── spec.md              # Feature specification (complete with clarifications)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0: Codebase analysis ✅
├── data-model.md        # Phase 1: Database schema + RLS policies ✅
├── quickstart.md        # Phase 1: Developer setup guide ✅
├── contracts/           # Phase 1: TypeScript interfaces + API contracts ✅
└── tasks.md             # Phase 2: Task breakdown (230 tasks) ✅
```

### Source Code (repository root)

```
src/
├── app/
│   ├── messages/           # NEW: Messaging pages
│   │   ├── page.tsx       # Conversation list
│   │   ├── [id]/          # Individual conversation
│   │   └── connections/   # Friend requests/connections
│   └── api/messages/      # NEW: API routes for messaging
│       ├── send/
│       ├── sync/
│       └── connections/
│
├── components/
│   ├── messaging/          # NEW: Messaging components (organisms/molecular)
│   │   ├── ChatWindow/
│   │   ├── MessageThread/
│   │   ├── ConversationList/
│   │   └── ConnectionManager/
│   ├── atomic/            # NEW: Atomic messaging components
│   │   ├── MessageBubble/
│   │   ├── MessageInput/
│   │   ├── TypingIndicator/
│   │   └── ReadReceipt/
│   └── molecular/         # NEW: Molecular messaging components
│       ├── ConversationListItem/
│       ├── UserSearch/
│       └── ChatHeader/
│
├── lib/
│   ├── messaging/          # NEW: Core messaging libraries
│   │   ├── encryption.ts  # ECDH + AES-GCM crypto
│   │   ├── database.ts    # Dexie IndexedDB setup
│   │   ├── sync.ts        # Offline queue sync logic
│   │   └── realtime.ts    # Supabase Realtime subscriptions
│   └── supabase/          # EXISTING: Supabase client (reuse)
│       ├── client.ts
│       └── server.ts
│
├── services/messaging/     # NEW: Business logic services
│   ├── connection-service.ts    # Friend request management
│   ├── message-service.ts       # Send/receive/edit/delete
│   ├── offline-queue.ts         # IndexedDB queue management
│   └── key-service.ts           # Encryption key management
│
├── hooks/
│   ├── useConversationRealtime.ts  # NEW: Subscribe to messages
│   ├── useTypingIndicator.ts      # NEW: Typing status
│   └── useOfflineQueue.ts         # NEW: Queue management
│
└── types/
    └── messaging.ts        # NEW: TypeScript interfaces

supabase/migrations/
└── 20251008_user_messaging_system.sql  # NEW: 6 tables + RLS + indexes

tests/
├── integration/messaging/   # NEW: Supabase integration tests
│   ├── connections.test.ts
│   ├── encryption.test.ts
│   └── offline-queue.test.ts
└── unit/messaging/         # NEW: Unit tests for crypto/services
    ├── encryption.test.ts
    ├── key-generation.test.ts
    └── message-validation.test.ts

e2e/messaging/              # NEW: End-to-end Playwright tests
├── friend-requests.spec.ts
├── encrypted-messaging.spec.ts
├── real-time-delivery.spec.ts
└── offline-sync.spec.ts
```

**Structure Decision**: Web application structure (Option 2) selected. ScriptHammer uses Next.js App Router with:

- Frontend: `src/app/` (pages) + `src/components/` (UI)
- Backend: Supabase (PostgreSQL + Realtime + Auth)
- Database migrations: `supabase/migrations/`
- Tests: Separate directories for unit, integration, E2E

## Complexity Tracking

_No constitutional violations - this section is empty._

All requirements align with ScriptHammer constitution v1.0.1. No complexity exceptions needed.

## Progress Tracking

- [x] Phase 0 Gate: Constitution Check ✅ PASS
- [x] Phase 0: Research (codebase analysis) ✅ COMPLETE
- [x] Phase 1: Design (data model, contracts, quickstart) ✅ COMPLETE
- [x] Phase 2: Task Breakdown (tasks.md generation) ✅ COMPLETE
- [x] Verification: All artifacts generated ✅ COMPLETE
- [x] `/tasks` Command: Refined task breakdown ✅ COMPLETE (230 tasks organized by user story)

**Status**: `/plan` and `/tasks` commands execution COMPLETE ✅

---

**Next Steps**: Execute `/implement` command to begin implementation (or proceed with manual implementation following tasks.md)
