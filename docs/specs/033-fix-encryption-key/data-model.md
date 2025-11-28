# Data Model: Encryption Keys

## user_encryption_keys Table

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,           -- JWK format ECDH P-256 public key
  encryption_salt TEXT,                 -- Base64 Argon2 salt (NULL = legacy)
  device_id TEXT,                       -- NULL for cross-device keys
  expires_at TIMESTAMPTZ,               -- NULL for persistent keys
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_encryption_keys_user ON user_encryption_keys(user_id, revoked);
```

## Key States

| State   | encryption_salt   | revoked | Meaning                      |
| ------- | ----------------- | ------- | ---------------------------- |
| Valid   | Non-NULL (Base64) | false   | Password-derived key, usable |
| Legacy  | NULL              | false   | Random key, needs migration  |
| Revoked | Any               | true    | No longer usable             |

## Key Relationships

```
auth.users (1) ---> (*) user_encryption_keys
    |
    +-- user_id references auth.users.id
    +-- ON DELETE CASCADE (keys deleted with user)
```

## Constraints

- `encryption_salt` SHOULD be non-NULL for all new keys (enforced in application layer)
- `public_key` is JSONB containing JWK with kty, crv, x, y fields
- `device_id` NULL means key works across all devices
- Only one non-revoked key per (user_id, device_id) pair should exist
