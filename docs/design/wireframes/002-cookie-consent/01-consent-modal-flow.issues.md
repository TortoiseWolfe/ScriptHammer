# Issues: 01-consent-modal-flow.svg

**Feature:** 002-cookie-consent
**SVG:** 01-consent-modal-flow.svg
**Last Review:** 2026-01-12
**Validator:** v4.0

---

## Summary

| Status | Count |
|--------|-------|
| Resolved | 4 |
| Open | 14 |

---

## Open Issues (2026-01-12 Review)

### Structure Issues

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| S-01 | Missing canvas background gradient (#c7ddf5 → #b8d4f0) | G-022 | REGENERATE |
| S-02 | Missing centered title block at y=28 | G-024 | REGENERATE |
| S-03 | Missing signature block at y=1060, 18px bold | G-025 | REGENERATE |
| S-04 | No numbered callout circles (①②③④) on mockup UI | G-026 | REGENERATE |
| S-05 | Not using `<use href="includes/..."/>` for header/footer | HDR-001 | REGENERATE |

### Modal Issues

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| M-01 | Light-colored overlay instead of dark (#000 opacity) | MODAL-001 | REGENERATE |
| M-02 | Footer `<use>` before modal overlay (hidden by paint order) | G-021 | REGENERATE |

### Collision Issues

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| C-01 | "Always On" text colliding with toggle switch | - | PATCH |
| C-02 | FR-003 badge blocking "Privacy Policy" text | - | PATCH |
| C-03 | Duo-tone wavy divider (should be single color) | - | PATCH |

### Annotation Issues

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| A-01 | 0 callout circles in annotation panel (need 4+) | ANN-002 | REGENERATE |
| A-02 | REQUIREMENTS KEY wastes space - move to callout explanations | - | REGENERATE |
| A-03 | Cramped annotation text, no visual gaps between groups | G-020 | PATCH |

### Font Issues

| ID | Issue | Code | Classification |
|----|-------|------|----------------|
| F-01 | Multiple text elements below 14px minimum | FONT-001 | REGENERATE |

---

## Resolved Issues (2026-01-11)

### Issue 1: Template Injection
**Status:** Resolved → REOPENED (S-05)
Templates were injected but latest regeneration removed them.

### Issue 2: Mobile Frame Color
**Status:** Resolved
Mobile frame uses light parchment color, passes MOB-001.

### Issue 3: Clickable Badges
**Status:** Resolved
All badge pills are clickable links to spec sections.

### Issue 4: Font Sizes
**Status:** Resolved → REOPENED (F-01)
Include templates updated to 14px, but SVG has hand-drawn elements with small fonts.

---

## Previous Open Issue (Now Superseded)

### Issue 5: Incomplete FR/SC Coverage
**Status:** Superseded by full regeneration needed

The wireframe needs complete regeneration using v5 skill rules, which will address FR/SC coverage through proper User Story-anchored annotation groups.

---

## Escalation Watch

Issues to monitor for recurrence in other features:

| Issue Pattern | Occurrences | Escalate? |
|---------------|-------------|-----------|
| Missing background gradient | 1 (002:01) | Watch |
| Missing title/signature | 1 (002:01) | Watch |
| No callouts on mockups | 1 (002:01) | Watch |
| Footer paint order with modals | 1 (002:01) | Watch |
| Badge blocking text | 1 (002:01) | Watch |
| Text collision with toggles | 1 (002:01) | Watch |

---

## Resolution History

| Date | Action | Result |
|------|--------|--------|
| 2026-01-11 | Initial review (v2.1 validator) | 5 issues, 4 resolved |
| 2026-01-12 | Post-regeneration review (v4.0 validator) | 25 errors, 14 open issues |
| 2026-01-12 | Updated include templates to 14px fonts | Pending regeneration |
| 2026-01-12 | Fixed validator false positives | Validator v4.0 ready |

---

## Notes

- Generator attempted to bypass validator with "false positives" excuse - unacceptable
- Wireframe used old style (badges on UI) instead of v4/v5 numbered callouts
- Full regeneration required using `/wireframe-prep 002` then `/wireframe 002`
