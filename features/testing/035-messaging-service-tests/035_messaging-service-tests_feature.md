# Feature: Messaging Service Tests

**Feature ID**: 035
**Category**: testing
**Source**: ScriptHammer README (SPEC-052)
**Status**: Ready for SpecKit

## Description

Add unit tests for core messaging services: `message-service.ts`, `key-service.ts`, `group-key-service.ts`, `audit-logger.ts`. These services handle encrypted messaging and need comprehensive test coverage for security validation.

## User Scenarios

### US-1: Message Service Tests (P1)

Unit tests verify message sending, receiving, and encryption.

**Acceptance Criteria**:

1. Given message data, when sent, then encrypted correctly
2. Given encrypted message, when received, then decrypted correctly
3. Given message operations, when performed, then database updated

### US-2: Key Service Tests (P1)

Unit tests verify encryption key generation and management.

**Acceptance Criteria**:

1. Given new user, when keys generated, then public/private pair created
2. Given key storage, when persisted, then retrievable
3. Given key operations, when performed, then crypto-safe

### US-3: Group Key Service Tests (P2)

Unit tests verify group encryption key distribution.

**Acceptance Criteria**:

1. Given group created, when keys generated, then all members get access
2. Given member added, when key distributed, then can decrypt messages
3. Given member removed, when key rotated, then old messages remain readable

### US-4: Audit Logger Tests (P2)

Unit tests verify security audit logging.

**Acceptance Criteria**:

1. Given security event, when logged, then timestamp and details recorded
2. Given audit query, when searched, then events filterable
3. Given sensitive data, when logged, then PII not exposed

## Requirements

### Functional

**Message Service**

- FR-001: Test message encryption
- FR-002: Test message decryption
- FR-003: Test message sending
- FR-004: Test message retrieval
- FR-005: Test conversation lookup

**Key Service**

- FR-006: Test key pair generation
- FR-007: Test public key export
- FR-008: Test private key storage
- FR-009: Test key derivation
- FR-010: Test key validation

**Group Key Service**

- FR-011: Test group key generation
- FR-012: Test key distribution to members
- FR-013: Test key rotation on member removal
- FR-014: Test backward compatibility for old messages

**Audit Logger**

- FR-015: Test event logging
- FR-016: Test event filtering
- FR-017: Test PII redaction
- FR-018: Test timestamp accuracy

### Test Files

```
tests/unit/services/messaging/
├── message-service.test.ts
├── key-service.test.ts
├── group-key-service.test.ts
└── audit-logger.test.ts
```

### Security Considerations

- Mock crypto operations for unit tests
- Never log actual encryption keys in tests
- Use deterministic test vectors for crypto validation
- Verify key material is properly cleaned up

### Out of Scope

- Integration tests with Supabase
- Load testing
- Penetration testing

## Success Criteria

- SC-001: 100% code coverage for all 4 messaging services
- SC-002: Crypto operations use deterministic test vectors
- SC-003: No sensitive data exposed in test logs
- SC-004: Tests run in < 10 seconds total
- SC-005: All error paths tested
