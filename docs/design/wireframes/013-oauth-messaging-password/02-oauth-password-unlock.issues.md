# Issues: 02-oauth-password-unlock.svg

**Feature:** 013-oauth-messaging-password
**SVG:** 02-oauth-password-unlock.svg
**Last Review:** 2026-01-15

---

## Inspector Issues (2026-01-15)

| Check | Expected | Actual | Classification |
|-------|----------|--------|----------------|
| footer_nav_corners | desktop footer has rx="4-8" | desktop footer missing rx attribute | PATTERN_VIOLATION |
| footer_nav_corners | mobile nav has rx="4-8" | mobile nav missing rx attribute | PATTERN_VIOLATION |

## Visual Review (2026-01-15 Auditor)

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| V-01 | Nav active state shows "Features" but should show "Account" for OAuth/auth pages | G-039 | REGENERATE |
| V-02 | Desktop nav: "Features" highlighted instead of "Account" | G-039 | REGENERATE |
| V-03 | Mobile footer: "Features" tab active instead of "Account" | G-039 | REGENERATE |

**Note**: OAuth unlock messages is an auth-related page; per G-039 page-to-nav mapping, "Account" should be the active nav item.

## Inspector Batch 003 Review (2026-01-15)

**Confirmed Issues:**
- Signature: Correct format "013:02 | OAuth Messaging Password | ScriptHammer" - PASS
- Nav Active State: "Features" highlighted but should be "Account" (G-039 violation)
- Both desktop and mobile nav show wrong active item

**Footer Corners:**
- Desktop footer missing rx="4-8" rounded corners
- Mobile nav missing rx="4-8" rounded corners

**Classification:** REGEN required for nav active state fix (G-039)
