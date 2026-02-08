# Feature: EmailJS Integration

**Feature ID**: 023
**Category**: integrations
**Source**: ScriptHammer/docs/specs/010-emailjs-integration
**Status**: Ready for SpecKit
**Related**: 022-web3forms-integration (Primary provider)

## Description

A backup email service integration using EmailJS that provides redundancy for Web3Forms.

**Provider Relationship**: Feature 022 (Web3Forms) is the primary email provider. This feature (023) provides EmailJS as a backup. Both implement the same `EmailProvider` interface for seamless failover. Implements a failover pattern where if the primary provider (Web3Forms) fails, EmailJS automatically takes over, ensuring zero message loss. No server-side email configuration needed.

## User Scenarios

### US-1: Automatic Failover (P1)

When Web3Forms fails, EmailJS automatically handles the submission without user awareness.

**Acceptance Criteria**:

1. Given Web3Forms unavailable, when form submitted, then EmailJS handles it automatically
2. Given failover occurs, when user submits, then they see success (provider invisible)
3. Given both providers working, when form submitted, then primary (Web3Forms) is used

### US-2: Retry with Exponential Backoff (P1)

Failed submissions are retried with increasing delays before failing over.

**Acceptance Criteria**:

1. Given provider fails once, when retry triggered, then delay is 1 second
2. Given provider fails twice, when retry triggered, then delay is 2 seconds
3. Given max retries exceeded, when next attempt, then failover to backup provider

### US-3: Provider Health Monitoring (P2)

System tracks provider failures and adjusts routing accordingly.

**Acceptance Criteria**:

1. Given provider fails 3 times, when next submission, then provider is deprioritized
2. Given provider recovers, when submission succeeds, then failure count resets
3. Given status requested, when viewing, then health of all providers shown

### US-4: Consistent Templates (P2)

Email content is identical regardless of which provider delivers it.

**Acceptance Criteria**:

1. Given Web3Forms delivery, when email received, then format matches template
2. Given EmailJS delivery, when email received, then format matches Web3Forms
3. Given any provider, when email sent, then all fields (name, email, subject, message) included

## Requirements

### Functional

- FR-001: EmailJS configured as backup provider (priority 2)
- FR-002: Automatic failover when Web3Forms fails
- FR-003: Retry logic with exponential backoff (1s, 2s, 4s)
- FR-004: Success/failure tracking for both providers
- FR-005: User unaware of provider switching
- FR-006: Email templates match between providers
- FR-007: Rate limiting respected for both services
- FR-008: Error logging for debugging (no PII)

### Non-Functional

- NFR-001: Failover occurs within 5 seconds of primary failure
- NFR-002: Provider switching transparent to user
- NFR-003: Both providers can be health-checked independently
- NFR-004: Provider status exposed via hook for debugging

### Key Components

- **EmailService**: Orchestration layer with failover logic
- **EmailJSProvider**: EmailJS implementation of EmailProvider interface
- **Web3FormsProvider**: Web3Forms implementation of EmailProvider interface
- **useEmailService**: React hook for unified email sending

### Architecture

```
src/utils/email/
├── providers/
│   ├── web3forms.ts      # Primary provider (priority 1)
│   └── emailjs.ts        # Backup provider (priority 2)
├── email-service.ts      # Orchestration layer
└── types.ts              # Shared types
```

### Dependencies

```bash
pnpm add @emailjs/browser
```

### Configuration

```env
# Web3Forms (Primary)
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_web3forms_key

# EmailJS (Backup)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

### Out of Scope

- Custom SMTP server integration
- Email tracking/analytics
- Bulk email sending
- Email scheduling
- Rich HTML templates

## Success Criteria

- SC-001: EmailJS configured as backup provider
- SC-002: Automatic failover when Web3Forms fails
- SC-003: Retry logic with exponential backoff working
- SC-004: Success/failure tracking for both providers
- SC-005: User unaware of provider switching
- SC-006: Email templates match between providers
