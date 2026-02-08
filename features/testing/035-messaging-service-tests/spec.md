# Feature Specification: Messaging Service Tests

**Feature ID**: 035-messaging-service-tests
**Created**: 2025-12-31
**Status**: Specified
**Category**: Testing

## Overview

Comprehensive unit test coverage for four core messaging services: message service, key service, group key service, and audit logger. These services handle encrypted messaging, cryptographic key management, and security auditing. Tests must validate encryption correctness, key lifecycle management, and audit logging while following security best practices (deterministic test vectors, no sensitive data exposure, proper cleanup).

---

## User Scenarios & Testing

### User Story 1 - Message Service Tests (Priority: P1)

A test developer writes unit tests to verify message encryption, decryption, sending, and retrieval functions work correctly.

**Why this priority**: Core messaging functionality. Incorrect encryption/decryption breaks the entire messaging system.

**Independent Test**: Encrypt message with known key, decrypt with same key, verify content matches original.

**Acceptance Scenarios**:

1. **Given** plaintext message and encryption key, **When** message encrypted, **Then** ciphertext is produced and differs from plaintext
2. **Given** encrypted message and decryption key, **When** message decrypted, **Then** original plaintext is recovered
3. **Given** message to send, **When** send operation completes, **Then** message is stored in database (mocked)
4. **Given** conversation ID, **When** messages retrieved, **Then** all messages for conversation returned in order

---

### User Story 2 - Key Service Tests (Priority: P1)

A test developer writes unit tests to verify encryption key generation, storage, and validation functions work correctly.

**Why this priority**: Key management is security-critical. Flawed key handling compromises all encrypted data.

**Independent Test**: Generate key pair, export public key, verify private key can decrypt data encrypted with public key.

**Acceptance Scenarios**:

1. **Given** new user needs keys, **When** key pair generated, **Then** public and private keys are created and cryptographically valid
2. **Given** generated public key, **When** exported, **Then** format is correct for sharing with other users
3. **Given** private key, **When** stored, **Then** key is retrievable and usable for decryption
4. **Given** key material, **When** validated, **Then** invalid/corrupted keys are rejected

---

### User Story 3 - Group Key Service Tests (Priority: P2)

A test developer writes unit tests to verify group encryption key distribution and rotation.

**Why this priority**: Group messaging requires multi-party key management. Important but less critical than basic messaging.

**Independent Test**: Create group, add member, verify new member can decrypt group messages.

**Acceptance Scenarios**:

1. **Given** new group created, **When** group key generated, **Then** all initial members receive key material
2. **Given** existing group, **When** member added, **Then** new member receives group key and can decrypt messages
3. **Given** member removed from group, **When** key rotated, **Then** removed member cannot decrypt new messages
4. **Given** key rotation occurred, **When** accessing old messages, **Then** old messages remain readable with archived keys

---

### User Story 4 - Audit Logger Tests (Priority: P2)

A test developer writes unit tests to verify security audit logging captures events correctly without exposing sensitive data.

**Why this priority**: Audit logs are essential for security monitoring but not user-facing functionality.

**Independent Test**: Log security event, query audit log, verify event is recorded with timestamp.

**Acceptance Scenarios**:

1. **Given** security event occurs, **When** logged, **Then** timestamp, event type, and actor are recorded
2. **Given** audit log entries exist, **When** filtered by criteria, **Then** matching events are returned
3. **Given** event contains PII (email, name), **When** logged, **Then** PII is redacted or hashed
4. **Given** high-frequency events, **When** queried, **Then** timestamp ordering is accurate

---

### Edge Cases

**Encryption Edge Cases**:

- Empty message content
- Very long messages (>1MB)
- Unicode/emoji content
- Binary data in messages

**Key Management Edge Cases**:

- Key generation failure (insufficient entropy)
- Corrupted key material
- Expired keys if TTL implemented
- Key not found for user

**Group Key Edge Cases**:

- Single-member group
- Group with 100+ members
- Simultaneous member add/remove
- Key rotation during active conversations

**Audit Logger Edge Cases**:

- Rapid successive events (burst logging)
- Very long event descriptions
- Special characters in logged data
- Log storage full/unavailable

**Error Handling**:

- Database unavailable during operation
- Crypto library errors
- Invalid input parameters
- Timeout during key operations

---

## Requirements

### Functional Requirements

**Message Service Tests**:

- **FR-001**: Tests MUST verify message encryption produces valid ciphertext
- **FR-002**: Tests MUST verify message decryption recovers original plaintext
- **FR-003**: Tests MUST verify message sending triggers database storage
- **FR-004**: Tests MUST verify message retrieval returns correct messages
- **FR-005**: Tests MUST verify conversation lookup finds related messages
- **FR-006**: Tests MUST verify error handling for encryption failures

**Key Service Tests**:

- **FR-007**: Tests MUST verify key pair generation creates valid public/private keys
- **FR-008**: Tests MUST verify public key export format is correct
- **FR-009**: Tests MUST verify private key storage and retrieval
- **FR-010**: Tests MUST verify key derivation functions work correctly
- **FR-011**: Tests MUST verify key validation rejects invalid keys
- **FR-012**: Tests MUST verify key material cleanup after use

**Group Key Service Tests**:

- **FR-013**: Tests MUST verify group key generation for new groups
- **FR-014**: Tests MUST verify key distribution to all group members
- **FR-015**: Tests MUST verify key rotation on member removal
- **FR-016**: Tests MUST verify backward compatibility for historical messages
- **FR-017**: Tests MUST verify member addition key distribution

**Audit Logger Tests**:

- **FR-018**: Tests MUST verify event logging with complete metadata
- **FR-019**: Tests MUST verify event filtering and querying
- **FR-020**: Tests MUST verify PII redaction in logged events
- **FR-021**: Tests MUST verify timestamp accuracy and ordering
- **FR-022**: Tests MUST verify log retention behavior if implemented

**Security Test Requirements**:

- **FR-023**: Tests MUST use deterministic test vectors for crypto validation
- **FR-024**: Tests MUST NOT log actual encryption keys
- **FR-025**: Tests MUST verify key material is zeroed after use
- **FR-026**: Tests MUST mock external dependencies (database, crypto libs)

### Non-Functional Requirements

**Coverage**:

- **NFR-001**: All 4 messaging services MUST have 100% line coverage
- **NFR-002**: All public functions MUST have explicit tests
- **NFR-003**: All error paths MUST have test coverage

**Performance**:

- **NFR-004**: Full messaging service test suite MUST complete in under 10 seconds
- **NFR-005**: Individual tests MUST complete in under 500ms each
- **NFR-006**: Tests MUST NOT require actual network/database calls

**Security**:

- **NFR-007**: No sensitive data (keys, PII) MUST appear in test output/logs
- **NFR-008**: Test vectors MUST be well-documented and reviewable
- **NFR-009**: Mocked crypto MUST use realistic but safe test data

**Reliability**:

- **NFR-010**: Tests MUST be deterministic (same result every run)
- **NFR-011**: Tests MUST NOT have interdependencies
- **NFR-012**: Crypto tests MUST use fixed seeds for reproducibility

**Maintainability**:

- **NFR-013**: Test descriptions MUST clearly explain security scenarios
- **NFR-014**: Test fixtures MUST be documented with expected behaviors
- **NFR-015**: Security-sensitive tests MUST have review comments

### Key Entities

**Messaging Services Under Test**:

- message-service.ts: Encryption, decryption, send, retrieve, conversation lookup
- key-service.ts: Key generation, export, storage, derivation, validation
- group-key-service.ts: Group keys, distribution, rotation, backward compatibility
- audit-logger.ts: Event logging, filtering, PII redaction, timestamps

**Test Files**:

- message-service.test.ts
- key-service.test.ts
- group-key-service.test.ts
- audit-logger.test.ts

**Test Fixtures**:

- Deterministic test vectors for crypto operations
- Sample messages with various content types
- Mock user/group data
- Audit event samples

**Security Artifacts**:

- Test key pairs (clearly marked as test-only)
- Sample ciphertext with known plaintext
- Redacted PII examples

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% code coverage achieved for all 4 messaging services
- **SC-002**: All crypto operations use deterministic test vectors
- **SC-003**: Zero sensitive data exposed in test logs or output
- **SC-004**: Full test suite completes in under 10 seconds
- **SC-005**: All error paths have explicit test coverage
- **SC-006**: All tests are deterministic (reproducible results)
- **SC-007**: CI pipeline passes with all messaging tests green
- **SC-008**: Security-focused tests have review documentation

---

## Dependencies

- **009-User Messaging System**: Messaging services being tested
- **007-E2E Testing Framework**: Test runner and utilities

## Out of Scope

- Integration tests with Supabase
- Load/stress testing
- Penetration testing
- Full cryptographic audit (use known libraries)
- Testing third-party crypto libraries (only our wrapper code)
- E2E tests for messaging workflows

## Assumptions

- Messaging services are already implemented and stable
- Test framework (Vitest) is configured in the project
- Code coverage tooling is available
- Crypto library provides deterministic test mode or mockable interface
- Database operations can be mocked effectively
- Test vectors can be safely committed to repository (non-production keys)
