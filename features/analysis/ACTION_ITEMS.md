# Action Items for SpecKit Readiness

**Generated**: 2025-12-30
**Updated**: 2025-12-30
**Total Issues**: 23 (All Fixed)

---

## P0: Critical (Must Fix Before SpecKit)

| #     | Feature | Issue                                                        | Status    |
| ----- | ------- | ------------------------------------------------------------ | --------- |
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

| #     | Feature     | Issue                                                  | Status    |
| ----- | ----------- | ------------------------------------------------------ | --------- |
| ~~2~~ | ~~014~~     | ~~Conflicts with 012 on welcome message architecture~~ | **FIXED** |
| ~~3~~ | ~~012/014~~ | ~~Overlapping scope: both address welcome messages~~   | **FIXED** |

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

| #     | Feature     | Issue                                           | Status    |
| ----- | ----------- | ----------------------------------------------- | --------- |
| ~~4~~ | ~~041~~     | ~~PayPal API calls need Edge Function~~         | **FIXED** |
| ~~5~~ | ~~013/016~~ | ~~Overlap on OAuth password flow~~              | **FIXED** |
| ~~6~~ | ~~024~~     | ~~Stripe/PayPal endpoints need Edge Functions~~ | **FIXED** |
| ~~7~~ | ~~045~~     | ~~Disqus requires third-party consent~~         | **FIXED** |
| ~~8~~ | ~~043~~     | ~~Wrong category (payments vs messaging)~~      | **FIXED** |

**P2-4 Resolution** (2025-12-30):

- Added complete Edge Function spec to 041_paypal-subscriptions_feature.md
- Includes `supabase/functions/paypal-subscriptions/index.ts` with GET/POST handlers
- Uses PAYPAL_CLIENT_ID and PAYPAL_SECRET from Vault
- Added 5-minute cache TTL for subscription data

**P2-5 Resolution** (2025-12-30):

- Added "Extended by: 016" to 013_oauth-messaging-password_feature.md
- Added "Depends on: 013" to 016_messaging-critical-fixes_feature.md
- Clear separation: 013 = core ReAuthModal, 016 = extended UX improvements

**P2-6 Resolution** (2025-12-30):

- Added Edge Function specs to 024_payment-integration_feature.md
- Includes Stripe webhook handler: `supabase/functions/stripe-webhooks/index.ts`
- Includes PayPal webhook handler: `supabase/functions/paypal-webhooks/index.ts`
- Added database migrations with RLS for payments and webhook_events tables

**P2-7 Resolution** (2025-12-30):

- Added "Depends on: 019-analytics-consent" to 045_disqus-theme_feature.md
- Added Third-Party Consent Requirement section
- Added NFR-006: Disqus embed MUST NOT load until user grants consent

**P2-8 Resolution** (2025-12-30):

- Changed 043_group-service_feature.md category from "payments" to "core-features"
- Added "Depends on: 009-user-messaging-system"
- Corrected source reference to SPEC-061

**No remaining P2 issues.**

---

## P3: Low (Fix During /implement)

| #      | Feature     | Issue                                                    | Status        |
| ------ | ----------- | -------------------------------------------------------- | ------------- |
| ~~9~~  | ~~006~~     | ~~Component template doesn't show .stories.tsx example~~ | **FIXED**     |
| ~~10~~ | ~~010~~     | ~~MDX component pattern needs clarification~~            | **FIXED**     |
| ~~11~~ | ~~017~~     | ~~4 new palettes undefined~~                             | **FIXED**     |
| ~~12~~ | ~~018~~     | ~~Default accessible font undefined~~                    | **FIXED**     |
| ~~13~~ | ~~021~~     | ~~Fallback location undefined~~                          | **FIXED**     |
| ~~14~~ | ~~023~~     | ~~Email provider undefined~~                             | **FIXED**     |
| ~~15~~ | ~~025~~     | ~~ShareThisConfig API key handling~~                     | **FIXED**     |
| ~~16~~ | ~~030~~     | ~~Calendar auth flow undefined~~                         | **FIXED**     |
| ~~17~~ | ~~034~~     | ~~Snapshot tests can be brittle~~                        | **FIXED**     |
| ~~18~~ | ~~038-040~~ | ~~Missing 5-file component pattern~~                     | **FIXED**     |
| ~~19~~ | ~~041~~     | ~~Cache strategy "appropriately" is vague~~              | **FIXED**     |
| ~~20~~ | ~~044~~     | ~~Third-party consent for monitoring~~                   | **FIXED**     |
| ~~21~~ | ~~037~~     | ~~"Game components" undefined~~                          | **FIXED**     |
| ~~22~~ | ~~029/034~~ | ~~100% coverage may be aggressive~~                      | **FIXED**     |
| ~~23~~ | ~~All~~     | ~~Some features missing accessibility test patterns~~    | **ADDRESSED** |

**P3-9 Resolution** (2025-12-30):

- Added complete 5-file pattern example to 006_template-fork-experience_feature.md
- Includes full .stories.tsx Storybook template with Meta, argTypes, and story variants

**P3-10 Resolution** (2025-12-30):

- Added MDX Component Integration Pattern section to 010_unified-blog-content_feature.md
- Includes mdxComponents mapping with Alert, CodeBlock, Callout, YouTubeEmbed
- Shows component aliasing: `pre: CodeBlock`, `blockquote: Callout`

**P3-11 Resolution** (2025-12-30):

- Added 4 complete colorblind-optimized palettes to 017_colorblind-mode_feature.md:
  - Protanopia/Deuteranopia Safe (blue/orange based)
  - Tritanopia Safe (red/cyan based)
  - Achromatopsia Safe (grayscale with patterns)
  - High Contrast Mode (black/white/yellow)
- Each palette includes CSS custom properties

**P3-12 Resolution** (2025-12-30):

- Specified Inter as default font in 018_font-switcher_feature.md
- Added rationale: excellent x-height, large character set, variable weights, open source
- Includes fallback stack: Inter, system-ui, -apple-system, sans-serif

**P3-13 Resolution** (2025-12-30):

- Added DEFAULT_LOCATION constant to 021_geolocation-map_feature.md
- Default: New York City (lat: 40.7128, lng: -74.0060, zoom: 10)
- Includes fallback behavior documentation

**P3-14 Resolution** (2025-12-30):

- Added "Related: 022-web3forms-integration" to 023_emailjs-integration_feature.md
- Web3Forms is primary provider; EmailJS is alternative

**P3-15 Resolution** (2025-12-30):

- Added API Key Handling section to 025_blog-social-features_feature.md
- Native platform share URLs don't require API keys
- ShareThis free tier works without key; paid features via Edge Function

**P3-16 Resolution** (2025-12-30):

- Added complete OAuth flow to 030_calendar-integration_feature.md
- Includes Edge Function: `supabase/functions/calcom-oauth/index.ts`
- Handles authorization redirect, token exchange, and token storage

**P3-17 Resolution** (2025-12-30):

- Updated 034_blog-library-tests_feature.md with snapshot test strategy
- Changed 100% coverage to 90%+ target
- Added structural assertion examples as preferred alternative to snapshots

**P3-18 Resolution** (2025-12-30):

- Added 5-file component pattern to all three payment UI features:
  - 038_payment-dashboard_feature.md
  - 039_payment-offline-queue_feature.md
  - 040_payment-retry-ui_feature.md
- Each includes .stories.tsx and .accessibility.test.tsx files

**P3-19 Resolution** (2025-12-30):

- Defined 5-minute cache TTL in 041_paypal-subscriptions_feature.md
- Added database constraint: `cache_ttl CHECK (cached_at > NOW() - INTERVAL '5 minutes')`
- Added refresh logic to invalidate stale cache

**P3-20 Resolution** (2025-12-30):

- Added "Depends on: 019-analytics-consent" to 044_error-handler-integrations_feature.md
- Added Third-Party Consent Requirement section
- Added NFR-009/010: Monitoring SDKs MUST NOT initialize until consent granted

**P3-21 Resolution** (2025-12-30):

- Added Target Game Components table to 037_game-a11y-tests_feature.md
- Lists 7 components: DiceRoller, CardDeck, CharacterSheet, InitiativeTracker, MapGrid, ChatPanel, RollLog
- Each component has location and key a11y concerns documented

**P3-22 Resolution** (2025-12-30):

- Coverage target issue was in 034, not 029
- Changed from 100% to 90%+ coverage in 034_blog-library-tests_feature.md
- Added note about diminishing returns for edge case coverage

**P3-23 Status**:

- E2E testing patterns are defined in 007_e2e-testing_feature.md
- Individual test features reference 007 as needed
- Accessibility test file pattern (.accessibility.test.tsx) documented in constitution

**No remaining P3 issues.**

---

## Implementation Recommendations

### All Features Ready for SpecKit

All 46 features have been reviewed and all identified issues have been fixed directly in the feature files. The features are now ready for the SpecKit workflow.

### Recommended Wave Order

Based on dependency analysis, implement in this order:

**Wave 1: Foundation** (Features 001-006)

- No dependencies, establishes base patterns

**Wave 2: Auth & Security** (Features 003, 004, 005)

- Required by all authenticated features

**Wave 3: Core Features** (Features 007-012, 043)

- Depends on auth foundation

**Wave 4: Auth OAuth** (Features 013-016)

- Extends auth with OAuth improvements

**Wave 5: Consent Framework** (Feature 019)

- Required before any third-party integrations

**Wave 6: Enhancements** (Features 017, 018, 020, 021)

- PWA and accessibility enhancements

**Wave 7: Integrations** (Features 022-026, 044, 045)

- Third-party integrations (require consent framework)

**Wave 8: Testing** (Features 031-037)

- Test coverage for implemented features

**Wave 9: Payments** (Features 024, 038-042)

- Payment integration and UI

**Wave 10: Polish** (Features 027-030)

- Final UX refinements

---

## Dependency Blockers

### Blocking Chain 1: Auth -> All

```
000-RLS -> 003-Auth -> Everything authenticated
```

**Status**: Dependencies documented in features

### Blocking Chain 2: Consent -> Tracking

```
019-Analytics (consent) -> 044-Error, 045-Disqus, all third-party
```

**Status**: Dependencies added to 044 and 045

### Blocking Chain 3: Payment -> All Payment UIs

```
024-Payment-Int -> 038-041 (all payment UIs)
042-RLS -> Payment security
```

**Status**: Dependencies documented in features

### Blocking Chain 4: Testing -> All Tests

```
007-E2E -> 031-Test-Users -> 032-037 (all test features)
```

**Status**: Dependencies documented in features

---

## Quick Reference: All Issues Fixed

| Priority | Original Count | Fixed | Status        |
| -------- | -------------- | ----- | ------------- |
| P0       | 1              | 1     | **ALL FIXED** |
| P1       | 2              | 2     | **ALL FIXED** |
| P2       | 5              | 5     | **ALL FIXED** |
| P3       | 15             | 15    | **ALL FIXED** |

**Total: 23/23 issues resolved**

---

## Verification Checklist

Before running `/speckit.specify` on any feature:

- [x] No `/api/` routes in requirements
- [x] Edge Functions specified for secrets
- [x] Dependencies documented
- [x] 5-file component pattern referenced
- [x] Test requirements defined
- [x] Consent requirements addressed (if third-party)
- [x] Conflict with other features resolved

**All features are now ready for the SpecKit workflow.**
