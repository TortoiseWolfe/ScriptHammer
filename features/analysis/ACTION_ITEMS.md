# Action Items for SpecKit Readiness

**Generated**: 2025-12-30
**Total Issues**: 23

---

## P0: Critical (Must Fix Before SpecKit)

| # | Feature | Issue | Status |
|---|---------|-------|--------|
| ~~1~~ | ~~001~~ | ~~`/api/accessibility/scores` route violates static export~~ | **FIXED** |

**P0-1 Resolution** (2025-12-30):
- Replaced `fetch('/api/accessibility/scores')` with Supabase client query
- Added Edge Function: `supabase/functions/accessibility-scores/index.ts`
- Added migration with RLS: `supabase/migrations/001_accessibility_scores.sql`
- Added CI script: `scripts/accessibility/post-results.js`
- Dashboard now uses real-time Supabase subscription

**No remaining P0 issues.**

---

## P1: High (Fix During /specify)

| # | Feature | Issue | Status |
|---|---------|-------|--------|
| ~~2~~ | ~~014~~ | ~~Conflicts with 012 on welcome message architecture~~ | **FIXED** |
| ~~3~~ | ~~012/014~~ | ~~Overlapping scope: both address welcome messages~~ | **FIXED** |

**P1-2/3 Resolution** (2025-12-30):
- Renamed 014 to "Email Verification Gate & Admin Setup"
- Added "Extends: 012-welcome-message-architecture" to 014
- Removed password-based key derivation from 014
- Clear separation of concerns:
  - **012**: Welcome message encryption (client-side ECDH)
  - **014**: MessagingGate component + Admin seed script
- 012 now depends on 014 for admin public key creation

**No remaining P1 issues.**

---

## P2: Medium (Fix During /plan)

| # | Feature | Issue | Action Required |
|---|---------|-------|-----------------|
| 4 | 041 | PayPal API calls need Edge Function | Add `supabase/functions/paypal-proxy/` spec |
| 5 | 013/016 | Overlap on OAuth password flow | Clarify scope during /clarify |
| 6 | 024 | Stripe/PayPal endpoints need Edge Functions | Add Edge Function specification |
| 7 | 045 | Disqus requires third-party consent | Add dependency on 019 consent framework |
| 8 | 043 | Wrong category (payments vs messaging) | Consider moving to core-features |

**Fix Details for P2-4**:
```typescript
// Add to 041 spec:
// supabase/functions/paypal-subscriptions/index.ts
// - GET subscriptions
// - POST cancel
// - POST suspend/activate
// Uses PAYPAL_CLIENT_ID and PAYPAL_SECRET from Vault
```

---

## P3: Low (Fix During /implement)

| # | Feature | Issue | Action Required |
|---|---------|-------|-----------------|
| 9 | 006 | Component template doesn't show .stories.tsx example | Add Storybook story template |
| 10 | 010 | MDX component pattern needs clarification | Define MDX component integration |
| 11 | 017 | 4 new palettes undefined | Define colorblind palette colors during /clarify |
| 12 | 018 | Default accessible font undefined | Specify default font during /clarify |
| 13 | 021 | Fallback location undefined | Specify default coordinates |
| 14 | 023 | Email provider undefined | Reference 022 or 023 in dependent features |
| 15 | 025 | ShareThisConfig API key handling | Specify env var or Edge Function |
| 16 | 030 | Calendar auth flow undefined | Add OAuth flow details during /plan |
| 17 | 034 | Snapshot tests can be brittle | Consider structural assertions |
| 18 | 038-040 | Missing 5-file component pattern | Add during /plan |
| 19 | 041 | Cache strategy "appropriately" is vague | Define TTL during /clarify |
| 20 | 044 | Third-party consent for monitoring | Reference 019 during /specify |
| 21 | 037 | "Game components" undefined | List target components during /clarify |
| 22 | 029 | 100% coverage may be aggressive | Consider 90%+ realistic target |
| 23 | All | Some features missing accessibility test patterns | Reference 007 E2E patterns |

---

## Implementation Recommendations

### Before Starting Wave 1

1. **Fix P0-1**: Convert 001's API route to Edge Function
2. **Resolve P1-2/3**: Reconcile 012 vs 014 welcome message approach
3. **Add P2-4**: Specify Edge Functions for payment APIs

### During /specify Phase

- Add Edge Function specs to 024, 041
- Clarify overlapping features (013/016)
- Define missing defaults (017, 018, 021)

### During /plan Phase

- Add 5-file component structure to all UI features
- Define MDX integration pattern for 010
- Specify OAuth flows for calendar, payments

### During /implement Phase

- Reference 007 for all E2E testing
- Use 031 test user patterns consistently
- Apply 019 consent framework to all third-party

---

## Dependency Blockers

### Blocking Chain 1: Auth → All
```
004-RLS → 003-Auth → Everything authenticated
```
**Action**: Implement 004 and 003 first

### Blocking Chain 2: Consent → Tracking
```
019-Analytics (consent) → 044-Error, 045-Disqus, all third-party
```
**Action**: Implement 019 before any third-party integration

### Blocking Chain 3: Payment → All Payment UIs
```
024-Payment-Int → 038-041 (all payment UIs)
042-RLS → Payment security
```
**Action**: Implement 024 + 042 before any payment UI

### Blocking Chain 4: Testing → All Tests
```
007-E2E → 031-Test-Users → 032-037 (all test features)
```
**Action**: Implement 007 before detailed test specs

---

## Quick Reference: Features Needing Fixes

| Priority | Features | Count |
|----------|----------|-------|
| ~~P0~~ | ~~001~~ | ~~1~~ **FIXED** |
| P1 | 012, 014 | 2 |
| P2 | 013, 016, 024, 041, 043, 045 | 6 |
| P3 | 006, 010, 017, 018, 021, 023, 025, 029, 030, 034, 037, 038-040, 044 | 14 |

---

## Verification Checklist

Before running `/speckit.specify` on any feature:

- [ ] No `/api/` routes in requirements
- [ ] Edge Functions specified for secrets
- [ ] Dependencies documented
- [ ] 5-file component pattern referenced
- [ ] Test requirements defined
- [ ] Consent requirements addressed (if third-party)
- [ ] Conflict with other features resolved
