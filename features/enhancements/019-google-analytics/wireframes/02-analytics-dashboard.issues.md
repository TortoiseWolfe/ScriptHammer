# Issues: 02-analytics-dashboard.svg

**Feature:** 019-google-analytics
**SVG:** 02-analytics-dashboard.svg
**Last Review:** 2026-01-15

---

## Inspector Issues (2026-01-16)

| Check                      | Expected                                                  | Actual                                          | Classification    |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------- | ----------------- |
| mobile_active_icon_missing | mobile active state includes white icon path              | active state has text only, no icon             | PATTERN_VIOLATION |
| mobile_active_corner_shape | corner tabs (Home/Account) use <path> with rounded corner | corner tab uses <rect> (missing rounded corner) | PATTERN_VIOLATION |

## Visual Review (2026-01-15 Auditor)

| ID   | Issue                                                                                        | Code  | Classification |
| ---- | -------------------------------------------------------------------------------------------- | ----- | -------------- |
| V-01 | Desktop nav shows "Settings" tab - non-standard nav item                                     | G-039 | REGENERATE     |
| V-02 | Mobile footer shows "Settings" active - should use standard nav (Home/Features/Docs/Account) | G-039 | REGENERATE     |
| V-03 | Analytics/Settings pages should show "Account" as active nav item                            | G-039 | REGENERATE     |

**Note**: Standard nav is Home/Features/Docs/Account. "Settings" is not a standard nav item. For settings-related pages, "Account" should be active since settings falls under account management.
