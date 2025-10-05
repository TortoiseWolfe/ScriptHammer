# Implementation Plan: Payment Integration System

**Branch**: `015-payment-integration` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-payment-integration/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path ✓
2. Fill Technical Context ✓
   → Project Type: web (Next.js static export + Supabase backend)
   → Structure Decision: Hybrid (client-side + external backend)
3. Fill Constitution Check section ✓
4. Evaluate Constitution Check section ✓
   → Privacy & GDPR compliance required (consent modals)
   → Update Progress Tracking: Initial Constitution Check ✓
5. Execute Phase 0 → research.md (in progress)
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check section
8. Plan Phase 2 → Describe task generation approach
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**Primary Requirement**: Enable ScriptHammer template users to accept payments (one-time and recurring) through Stripe, PayPal, Cash App, and Chime on their static GitHub Pages sites.

**Technical Approach**:

- **Client-side**: Next.js static export with React components following 5-file pattern
- **Backend**: Supabase Edge Functions (Deno) for webhook handling, PostgreSQL for payment/subscription tracking
- **Offline-first**: IndexedDB queue for operations when Supabase unavailable, automatic sync on reconnection
- **GDPR-compliant**: Consent modal before loading Stripe/PayPal scripts, fallback to Cash App/Chime links
- **Notifications**: Dual system (email + in-app dashboard) for payment events
- **Scale**: Support 10,000 payments/month, 500 concurrent customers

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS, Deno 1.x (Edge Functions)
**Primary Dependencies**:

- Frontend: Next.js 15.5, React 19, Tailwind CSS 4, DaisyUI, @supabase/supabase-js
- Backend: Supabase Edge Functions, PostgreSQL 15+
- Payments: @stripe/stripe-js, PayPal REST SDK
  **Storage**:
- Client: IndexedDB (offline queue), localStorage (consent preferences)
- Server: PostgreSQL (payment_intents, payment_results, subscriptions, webhook_events)
  **Testing**: Vitest, Playwright, Pa11y, React Testing Library, Supabase Test Helpers
  **Target Platform**: Static export (GitHub Pages), PWA-capable, all modern browsers
  **Project Type**: Hybrid (web static export + external Supabase backend)
  **Performance Goals**: Lighthouse 90+, FCP <2s, TTI <3.5s, CLS <0.1
  **Constraints**:
- Static site (no Node.js server) - requires external backend
- Bundle <150KB first load (payment SDKs lazy-loaded)
- WCAG AA compliant
- Offline-capable (queue operations during outages)
  **Scale/Scope**:
- 10,000 payments/month
- 500 concurrent customers
- 4 payment providers (Stripe, PayPal, Cash App, Chime)
- Webhook retry window: 3 days (Stripe default)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
- [x] Using `pnpm run generate:component` for new components
- [x] No manual component creation

**Components to create**:

- PaymentButton (atomic) - triggers payment flow
- PaymentConsentModal (atomic) - GDPR consent for Stripe/PayPal
- PaymentDashboard (organism) - real-time payment activity view
- PaymentHistory (molecular) - transaction list display
- SubscriptionCard (molecular) - subscription status/management

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
- [x] Minimum 25% unit test coverage
- [x] E2E tests for user workflows
- [x] Accessibility tests with Pa11y

**Test strategy**:

- Contract tests for Supabase Edge Functions (webhook handlers)
- Integration tests for payment flows (Stripe/PayPal/offline queue)
- E2E tests for complete user journeys (checkout → confirmation)
- Accessibility tests for all payment UI components

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
- [x] Clear success criteria defined (44 functional + non-functional requirements)
- [x] Tracking from inception to completion (PRP-STATUS.md)

### IV. Docker-First Development

- [x] Docker Compose setup included (existing ScriptHammer infrastructure)
- [x] CI/CD uses containerized environments
- [x] Environment consistency maintained

**Note**: Supabase CLI will run locally in Docker for Edge Function development

### V. Progressive Enhancement

- [x] Core functionality works without JS (Cash App/Chime links are static)
- [x] PWA capabilities for offline support (IndexedDB queue)
- [x] Accessibility features included (keyboard navigation, screen reader support)
- [x] Mobile-first responsive design (44px touch targets per PRP-017)

### VI. Privacy & Compliance First

- [x] GDPR compliance with consent system (modal before Stripe/PayPal scripts load)
- [x] Analytics only after consent (payment tracking requires consent)
- [x] Third-party services need modals (Stripe/PayPal/Supabase)
- [x] Privacy controls accessible (consent preferences in localStorage)

## Project Structure

### Documentation (this feature)

```
specs/015-payment-integration/
├── spec.md              # Feature requirements (complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── stripe-webhook.json       # OpenAPI spec
│   ├── paypal-webhook.json       # OpenAPI spec
│   ├── payment-api.json          # Supabase client API
│   └── dashboard-api.json        # Dashboard queries
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Frontend (Next.js static export)
src/
├── components/
│   ├── atomic/
│   │   ├── PaymentButton/              # Initiates payment
│   │   └── PaymentConsentModal/        # GDPR consent
│   ├── molecular/
│   │   ├── PaymentHistory/             # Transaction list
│   │   └── SubscriptionCard/           # Subscription status
│   └── organisms/
│       └── PaymentDashboard/           # Full dashboard
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Supabase client init
│   │   └── types.ts                    # Database types
│   ├── payments/
│   │   ├── stripe.ts                   # Stripe client wrapper
│   │   ├── paypal.ts                   # PayPal client wrapper
│   │   └── offline-queue.ts            # IndexedDB queue
│   └── email/
│       └── notification-service.ts      # Email notifications
├── types/
│   └── payment.ts                       # Payment type definitions
└── config/
    └── payment.ts                       # Payment provider config

# Backend (Supabase Edge Functions)
supabase/
├── functions/
│   ├── stripe-webhook/
│   │   └── index.ts                    # Stripe webhook handler
│   ├── paypal-webhook/
│   │   └── index.ts                    # PayPal webhook handler
│   └── send-payment-email/
│       └── index.ts                    # Email notification sender
└── migrations/
    ├── 001_payment_schema.sql          # Database schema
    ├── 002_rls_policies.sql            # Row Level Security
    └── 003_indexes.sql                 # Performance indexes

# Tests
tests/
├── contract/
│   ├── stripe-webhook.test.ts          # Webhook contract tests
│   └── paypal-webhook.test.ts
├── integration/
│   ├── payment-flow.test.ts            # E2E payment flows
│   ├── offline-queue.test.ts           # Offline sync tests
│   └── subscription-flow.test.ts       # Subscription lifecycle
└── unit/
    ├── payment-button.test.ts          # Component tests
    └── notification-service.test.ts    # Service tests
```

**Structure Decision**: Hybrid architecture

- Frontend: Existing Next.js structure (static export)
- Backend: New `supabase/` directory for Edge Functions and migrations
- Tests: Existing `tests/` structure with new payment-specific tests

## Phase 0: Outline & Research

**Research Tasks** (to be executed and consolidated in research.md):

1. **Supabase Edge Functions Research**
   - Decision: Which Edge Functions runtime features are available?
   - Rationale: Need to know Deno capabilities for webhook signature verification
   - Tasks:
     - Research Deno crypto APIs for webhook signature validation
     - Investigate Edge Function timeout limits (max 2 minutes)
     - Review Supabase Edge Functions logging/monitoring

2. **Stripe Integration Best Practices**
   - Decision: Payment Links vs. Checkout Sessions vs. Payment Intents?
   - Rationale: Need right approach for static sites
   - Tasks:
     - Compare Stripe integration methods for static sites
     - Research webhook event types needed (payment_intent.succeeded, subscription events)
     - Review idempotency key patterns for webhook processing

3. **PayPal Integration for Static Sites**
   - Decision: PayPal Buttons vs. Smart Payment Buttons vs. REST API?
   - Rationale: Need consent-aware integration
   - Tasks:
     - Research PayPal SDK lazy loading patterns
     - Investigate PayPal webhook events (PAYMENT.CAPTURE.COMPLETED, BILLING.SUBSCRIPTION.\*)
     - Review PayPal signature verification in Deno

4. **IndexedDB Offline Queue Architecture**
   - Decision: Dexie.js vs. idb vs. native IndexedDB?
   - Rationale: Need robust offline queue for Supabase outages
   - Tasks:
     - Compare IndexedDB libraries (bundle size, TypeScript support)
     - Research background sync patterns for PWA
     - Review conflict resolution strategies (webhook vs. client state)

5. **Email Notification Service**
   - Decision: Supabase Edge Function + Resend/SendGrid vs. direct SMTP?
   - Rationale: Need reliable email delivery for payment notifications
   - Tasks:
     - Research Resend API (free tier: 3,000 emails/month)
     - Investigate Edge Function email sending patterns
     - Review email template best practices (transactional emails)

6. **Payment Provider Consent UX**
   - Decision: Modal-first vs. banner-first for GDPR consent?
   - Rationale: Must comply with GDPR before loading Stripe/PayPal scripts
   - Tasks:
     - Research GDPR consent best practices for payment scripts
     - Review localStorage vs. cookie for consent storage
     - Investigate "retry consent modal next visit" implementation

7. **Database Schema Design**
   - Decision: Normalized vs. denormalized for payment history queries?
   - Rationale: Need fast dashboard queries without JOINs
   - Tasks:
     - Research PostgreSQL indexing strategies for payment tables
     - Review Row Level Security (RLS) patterns for multi-tenant
     - Investigate partitioning strategies for large payment tables (10k+/month)

**Output**: research.md with all decisions, rationales, and alternatives considered

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

### 1. Data Model (data-model.md)

**Entities** (from spec.md Key Entities section):

1. **payment_intents** (PostgreSQL table)
   - id: UUID (PK)
   - amount: INTEGER (cents)
   - currency: TEXT (USD/EUR/GBP/CAD/AUD)
   - type: TEXT (one_time/recurring)
   - description: TEXT
   - customer_email: TEXT
   - created_at: TIMESTAMP
   - status: TEXT (pending/succeeded/failed)
   - Relationships: 1-to-1 with payment_results

2. **payment_results** (PostgreSQL table)
   - id: UUID (PK)
   - intent_id: UUID (FK → payment_intents.id)
   - provider: TEXT (stripe/paypal)
   - transaction_id: TEXT (from provider)
   - status: TEXT (pending/succeeded/failed)
   - charged_amount: INTEGER (actual amount charged)
   - webhook_verified: BOOLEAN
   - verified_at: TIMESTAMP
   - created_at: TIMESTAMP
   - Relationships: 1-to-many with webhook_events

3. **webhook_events** (PostgreSQL table)
   - id: UUID (PK)
   - provider: TEXT (stripe/paypal)
   - event_id: TEXT (provider's unique event ID - for idempotency)
   - event_type: TEXT (payment_intent.succeeded, etc.)
   - event_data: JSONB
   - signature: TEXT
   - verified: BOOLEAN
   - processed: BOOLEAN
   - processing_attempts: INTEGER
   - processing_error: TEXT
   - created_at: TIMESTAMP
   - Relationships: Links to payment_results or subscriptions via event_data

4. **subscriptions** (PostgreSQL table)
   - id: UUID (PK)
   - provider_subscription_id: TEXT (from Stripe/PayPal)
   - customer_email: TEXT
   - plan_amount: INTEGER
   - plan_interval: TEXT (month/year)
   - status: TEXT (active/past_due/grace_period/canceled)
   - next_billing_date: DATE
   - failed_payment_count: INTEGER
   - retry_schedule: JSONB
   - grace_period_expires: DATE
   - created_at: TIMESTAMP
   - canceled_at: TIMESTAMP
   - Relationships: 1-to-many with payment_results (each billing cycle)

5. **payment_provider_config** (PostgreSQL table)
   - id: UUID (PK)
   - provider: TEXT (stripe/paypal/cashapp/chime)
   - enabled: BOOLEAN
   - configured: BOOLEAN
   - priority: INTEGER (for failover)
   - supports_recurring: BOOLEAN
   - supports_webhooks: BOOLEAN
   - config_data: JSONB (encrypted credentials)
   - created_at: TIMESTAMP

**State Transitions**:

- Payment Result: pending → succeeded | failed
- Subscription: active ↔ past_due ↔ grace_period → canceled

### 2. API Contracts (contracts/)

**Contracts to generate**:

1. **stripe-webhook.json** (OpenAPI 3.0)
   - POST /functions/v1/stripe-webhook
   - Request: Stripe webhook event format
   - Headers: stripe-signature
   - Response: 200 OK (processed), 400 (invalid signature), 500 (processing error)

2. **paypal-webhook.json** (OpenAPI 3.0)
   - POST /functions/v1/paypal-webhook
   - Request: PayPal webhook event format
   - Headers: paypal-transmission-id, paypal-transmission-sig
   - Response: 200 OK, 400, 500

3. **payment-api.json** (Supabase client API)
   - createPaymentIntent(amount, currency, type, email)
   - getPaymentStatus(intentId)
   - listPaymentHistory(filters)
   - queryTransaction(transactionId)

4. **dashboard-api.json** (Dashboard queries)
   - getRealtimePayments(limit)
   - getSubscriptionStatus(email)
   - getPaymentStats(dateRange)

### 3. Contract Tests (tests/contract/)

**Tests to create** (must fail initially):

1. `stripe-webhook.test.ts`
   - Assert request schema matches Stripe webhook format
   - Assert signature verification logic
   - Assert idempotency (duplicate event_id)

2. `paypal-webhook.test.ts`
   - Assert request schema matches PayPal webhook format
   - Assert signature verification logic
   - Assert idempotency

3. `payment-api.test.ts`
   - Assert Supabase client API responses match contracts
   - Assert error handling for invalid inputs

4. `dashboard-api.test.ts`
   - Assert dashboard queries return correct data shapes
   - Assert real-time subscription updates

### 4. Integration Test Scenarios (quickstart.md)

**User stories → test scenarios**:

1. **One-time payment flow**
   - Given: Template user configured Stripe
   - When: Customer clicks "Donate $10"
   - Then: Consent modal appears → customer accepts → Stripe checkout opens → payment succeeds → webhook confirms → dashboard updates

2. **Subscription creation flow**
   - Given: Template user offers $5/month subscription
   - When: Customer subscribes
   - Then: Consent modal → customer accepts → subscription created → first charge succeeds → webhook confirms → email sent

3. **Failed subscription retry flow**
   - Given: Active subscription with failed payment
   - When: Retry schedule triggers (days 1, 3, 7)
   - Then: System retries payment → enters grace period if all fail → cancels after grace period → email notifications sent

4. **GDPR consent decline flow**
   - Given: Customer visits payment page
   - When: Consent modal shown → customer declines
   - Then: Cash App/Chime links displayed → localStorage records decline → next visit shows modal again

5. **Offline queue flow**
   - Given: Supabase backend unavailable
   - When: Customer initiates payment
   - Then: Operation queued in IndexedDB → UI shows "offline mode" → backend reconnects → queue syncs automatically

6. **Payment history dashboard**
   - Given: Template user has multiple payments
   - When: Template user opens dashboard
   - Then: Real-time list of transactions → filter by status/date/provider → query by transaction ID

### 5. Update CLAUDE.md

**Incremental update** (preserve existing content, add new sections):

- Add Supabase Edge Functions section
- Add payment provider integration patterns
- Add offline queue architecture notes
- Update recent changes (keep last 3)
- Stay under 150 lines total

**Output**: data-model.md, /contracts/\*, failing contract tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

1. Load `.specify/templates/tasks-template.md` as base
2. Generate tasks from Phase 1 design docs:
   - Each contract → contract test task [P]
   - Each entity → migration creation task [P]
   - Each Edge Function → implementation task
   - Each component → component generation + test task [P]
   - Each user story → integration test task
3. TDD order: Write failing tests first, then implementation
4. Dependency order:
   - Phase 1: Database migrations (schema, RLS, indexes)
   - Phase 2: Edge Functions (webhook handlers)
   - Phase 3: Client library (Supabase client, payment wrappers)
   - Phase 4: Components (PaymentButton → ConsentModal → Dashboard)
   - Phase 5: Integration tests (E2E user flows)
   - Phase 6: Documentation and deployment

**Ordering Strategy**:

- [P] for parallel execution (independent files)
- Sequential for dependencies (migrations before Edge Functions)
- Test-first: Contract tests → implementation → integration tests

**Estimated Output**: 40-50 numbered, ordered tasks in tasks.md

**Task categories**:

- Setup (5 tasks): Supabase project, environment variables, Stripe/PayPal accounts
- Database (8 tasks): Migrations, RLS policies, indexes, seed data
- Edge Functions (12 tasks): Webhook handlers, signature verification, email sender
- Client Library (10 tasks): Supabase client, payment wrappers, offline queue
- Components (15 tasks): 5 components × 3 tasks each (generate, implement, test)
- Integration (8 tasks): E2E payment flows, offline sync, subscription lifecycle
- Documentation (3 tasks): Update CLAUDE.md, deployment guide, user guide

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

**Validation criteria**:

- All 44 functional/non-functional requirements met
- 19 contract tests passing
- 6 E2E integration tests passing
- 5 components with 100% accessibility test coverage
- Lighthouse scores: Performance 90+, Accessibility 95+
- Bundle size <150KB first load (lazy-load payment SDKs)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                                    | Why Needed                                                        | Simpler Alternative Rejected Because                                                               |
| -------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| External backend (Supabase)                  | Static sites cannot run server-side code for webhook verification | Pure client-side approach cannot verify webhook signatures securely (fraudulent webhooks possible) |
| Dual notification system (email + dashboard) | User requirement (clarification Q1)                               | Email-only would miss real-time updates; dashboard-only would miss offline users                   |
| Offline queue (IndexedDB)                    | NFR-003: Continue accepting payments during Supabase outages      | Blocking on outage would lose customers; simple retry insufficient for extended outages            |

**Justification**: All complexities are driven by fundamental constraints (static hosting) or explicit user requirements (dual notifications, offline resilience).

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) - 2025-10-03
- [x] Phase 1: Design complete (/plan command) - 2025-10-03
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All research questions resolved (7/7)
- [x] Complexity deviations documented

**Artifacts Generated**:

- [x] research.md (Phase 0) - 7 research questions with decisions
- [x] data-model.md (Phase 1) - 5 entity schemas with indexes and RLS
- [x] contracts/ (Phase 1) - 4 OpenAPI specs (Stripe, PayPal, client API, dashboard)
- [x] quickstart.md (Phase 1) - 6 integration test scenarios

**Ready for**: `/tasks` command to generate implementation task breakdown

---

_Based on Constitution v1.0.1 - See `.specify/memory/constitution.md`_
