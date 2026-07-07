# Data Model: Welcome Message Redesign

**Feature**: 003-feature-004-welcome
**Date**: 2025-11-28

## Entities

### user_encryption_keys (existing table)

Stores public keys for E2E encryption. Admin's public key stored here.

| Field           | Type        | Constraints               | Notes                                         |
| --------------- | ----------- | ------------------------- | --------------------------------------------- |
| id              | UUID        | PK, auto-gen              | Row identifier                                |
| user_id         | UUID        | FK → auth.users, NOT NULL | Admin: `00000000-0000-0000-0000-000000000001` |
| public_key      | JSONB       | NOT NULL                  | ECDH P-256 public key in JWK format           |
| encryption_salt | TEXT        | NULL                      | NULL for admin (no password derivation)       |
| device_id       | TEXT        | NULL                      | NULL for admin                                |
| created_at      | TIMESTAMPTZ | DEFAULT NOW()             |                                               |
| expires_at      | TIMESTAMPTZ | NULL                      | NULL = never expires                          |
| revoked         | BOOLEAN     | DEFAULT FALSE             |                                               |

**Admin Key Row**:

```json
{
  "user_id": "00000000-0000-0000-0000-000000000001",
  "public_key": {
    "kty": "EC",
    "crv": "P-256",
    "x": "<base64url>",
    "y": "<base64url>"
  },
  "encryption_salt": null,
  "revoked": false
}
```

---

### user_profiles (existing table)

Stores user profile data including welcome message flag.

| Field                | Type    | Constraints         | Notes                    |
| -------------------- | ------- | ------------------- | ------------------------ |
| id                   | UUID    | PK, FK → auth.users |                          |
| username             | TEXT    | UNIQUE, NOT NULL    | Admin: `scripthammer`    |
| display_name         | TEXT    |                     | Admin: `ScriptHammer`    |
| welcome_message_sent | BOOLEAN | DEFAULT FALSE       | **Used for idempotency** |
| ...                  | ...     | ...                 | Other fields unchanged   |

---

### conversations (existing table)

Stores conversation metadata. Welcome message creates admin-user conversation.

| Field            | Type        | Constraints     | Notes                             |
| ---------------- | ----------- | --------------- | --------------------------------- |
| id               | UUID        | PK, auto-gen    |                                   |
| participant_1_id | UUID        | FK → auth.users | Smaller UUID (canonical ordering) |
| participant_2_id | UUID        | FK → auth.users | Larger UUID                       |
| created_at       | TIMESTAMPTZ | DEFAULT NOW()   |                                   |
| last_message_at  | TIMESTAMPTZ |                 | Updated when welcome sent         |

**Canonical Ordering Rule**:

```
participant_1_id < participant_2_id (lexicographically)
```

Example with admin (`00000000-...0001`) and user (`a1b2c3d4-...`):

- participant_1_id = `00000000-0000-0000-0000-000000000001` (admin)
- participant_2_id = `a1b2c3d4-...` (user)

---

### messages (existing table)

Stores encrypted messages. Welcome message inserted with admin as sender.

| Field                 | Type        | Constraints        | Notes                  |
| --------------------- | ----------- | ------------------ | ---------------------- |
| id                    | UUID        | PK, auto-gen       |                        |
| conversation_id       | UUID        | FK → conversations |                        |
| sender_id             | UUID        | FK → auth.users    | Admin UUID for welcome |
| encrypted_content     | TEXT        | NOT NULL           | AES-GCM encrypted      |
| initialization_vector | TEXT        | NOT NULL           | IV for decryption      |
| sequence_number       | INTEGER     | NOT NULL           | 1 for first message    |
| created_at            | TIMESTAMPTZ | DEFAULT NOW()      |                        |
| delivered_at          | TIMESTAMPTZ |                    | Set immediately        |
| read_at               | TIMESTAMPTZ | NULL               | NULL until user reads  |
| deleted               | BOOLEAN     | DEFAULT FALSE      |                        |
| edited                | BOOLEAN     | DEFAULT FALSE      |                        |

---

## State Transitions

### welcome_message_sent Flag

```
[User Created] → welcome_message_sent = FALSE
                        ↓
              [Keys Initialized]
                        ↓
              [Welcome Service Called]
                        ↓
          [Check: welcome_message_sent?]
                   /          \
                 TRUE        FALSE
                  ↓            ↓
               [SKIP]    [Send Message]
                              ↓
                   welcome_message_sent = TRUE
```

---

## Queries

### Fetch Admin Public Key

```sql
SELECT public_key
FROM user_encryption_keys
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND revoked = FALSE
ORDER BY created_at DESC
LIMIT 1;
```

### Check Welcome Message Status

```sql
SELECT welcome_message_sent
FROM user_profiles
WHERE id = :user_id;
```

### Create Conversation (with canonical ordering)

```sql
INSERT INTO conversations (participant_1_id, participant_2_id)
VALUES (
  LEAST(:admin_id, :user_id),
  GREATEST(:admin_id, :user_id)
)
ON CONFLICT (participant_1_id, participant_2_id) DO NOTHING
RETURNING id;
```

### Insert Welcome Message

```sql
INSERT INTO messages (
  conversation_id,
  sender_id,
  encrypted_content,
  initialization_vector,
  sequence_number,
  delivered_at
)
VALUES (
  :conversation_id,
  '00000000-0000-0000-0000-000000000001',
  :encrypted_content,
  :iv,
  1,
  NOW()
);
```

### Update Welcome Flag

```sql
UPDATE user_profiles
SET welcome_message_sent = TRUE
WHERE id = :user_id;
```

---

## Validation Rules

| Rule                                     | Enforcement                     |
| ---------------------------------------- | ------------------------------- |
| Admin UUID must be `00000000-...-0001`   | Constant in code                |
| Canonical ordering on conversations      | LEAST/GREATEST in query         |
| welcome_message_sent prevents duplicates | Check before insert             |
| Public key must be valid JWK             | Web Crypto API import validates |
