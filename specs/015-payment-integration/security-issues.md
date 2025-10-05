# Payment Integration Security Issues

**Feature**: 015-payment-integration
**Status**: Demo/Testing Phase (Fake Cards Only)
**Last Updated**: 2025-10-04

---

## Summary

Payment integration has **CRITICAL** security issues that prevent production use. However, for demo/testing with fake Stripe cards, RLS policies provide adequate protection.

---

## 🔴 CRITICAL - Production Blockers

### #1: Authorization Bypass in `getPaymentHistory()`

**File**: `src/lib/payments/payment-service.ts:136-172`

**Issue**: Accepts `userId` parameter from client, allowing users to view others' payment history.

```typescript
// VULNERABLE
export async function getPaymentHistory(userId: string, limit = 20);
```

**Attack**: `getPaymentHistory('victim-uuid')` → view victim's payments

**Status**: 🚧 **BLOCKED BY PRP-016** - User Authentication required

**Fix**: Get userId from `supabase.auth.getUser()`, remove parameter

**See**: `docs/prp-docs/user-authentication-prp.md`

---

### #2: Missing Ownership Verification

**Files**:

- `getPaymentStatus()` (line 101-111)
- `cancelPaymentIntent()` (line 117-131)
- `getPaymentIntent()` (line 207-217)

**Issue**: No verification that user owns the payment before operations

**Status**: 🚧 **BLOCKED BY PRP-016** - User Authentication required

**Fix**: Add `auth.uid()` ownership checks

**See**: `docs/prp-docs/user-authentication-prp.md`

---

## 🟡 HIGH Priority

### #3: Email Injection

**File**: `src/lib/payments/payment-service.ts:38`

**Issue**: No sanitization (trim/lowercase) before validation

**Status**: ✅ **FIXED** (2025-10-04)

**Fix Applied**:

```typescript
const sanitizedEmail = customerEmail.trim().toLowerCase();
```

---

### #4: Metadata Abuse

**File**: `src/lib/payments/payment-service.ts:49, 73`

**Issue**: No size/nesting limits on metadata

**Status**: ✅ **FIXED** (2025-10-04)

**Fix Applied**:

- 1KB size limit
- Max 2-level nesting depth

---

## 🟢 MEDIUM Priority

### #5: Type Casting Without Validation

**File**: `src/lib/payments/payment-service.ts:163-169`

**Issue**: Using `as` assertions without runtime checks

**Status**: ✅ **ACCEPTABLE** - Database constraints enforce validity

---

### #6: Weak Email Regex

**File**: `src/lib/payments/payment-service.ts:38`

**Issue**: Regex allows `a@b.c` style emails

**Status**: ✅ **ACCEPTABLE** - Good enough for demo

---

## Risk Assessment

| Environment    | Risk Level | Acceptable? | Reason                              |
| -------------- | ---------- | ----------- | ----------------------------------- |
| **Demo/Test**  | LOW        | ✅ Yes      | RLS policies protect, no real money |
| **Production** | CRITICAL   | ❌ No       | Authorization bypass critical       |

---

## Production Checklist

Before accepting real payments:

- [ ] Fix #1: `getPaymentHistory()` authorization
- [ ] Fix #2: Add ownership verification to all operations
- [ ] Implement real authentication (replace hardcoded UUID)
- [x] Fix #3: Email sanitization
- [x] Fix #4: Metadata validation
- [ ] Webhook signature verification
- [ ] Rate limiting on payment endpoints
- [ ] Fraud monitoring
- [ ] Audit logging
- [ ] PCI compliance review
- [ ] Security penetration testing

---

## Notes

- Demo uses fake Stripe card: `4242 4242 4242 4242`
- Hardcoded user ID: `00000000-0000-0000-0000-000000000000` (NOT secure)
- Primary defense: Supabase RLS policies
- Client-side security: Minimal (defense-in-depth missing)
