# Memos: To Coordinator

<!-- Newest first. Coordinator acknowledges by moving to Archive section. -->

<!-- No pending memos -->

---

## Archive

<!-- Acknowledged memos moved here for reference -->

---

## 2026-01-15 11:45 - From: Test Engineer

**Priority**: urgent
**Re**: Pattern Violations Require Generator Fixes
**Status**: ✅ RESOLVED (already fixed prior to memo)

Cross-SVG inspection found 4 pattern violations in 2 wireframe files that need regeneration:

### File 1: `008-on-the-account/01-avatar-upload-flow.svg`

| Issue              | Expected | Actual |
| ------------------ | -------- | ------ |
| annotation_panel_y | y=800    | y=870  |

### File 2: `007-e2e-testing-framework/02-cicd-pipeline-flow.svg`

| Issue           | Expected | Actual |
| --------------- | -------- | ------ |
| mobile_mockup_x | x=1360   | x=1920 |

**Coordinator Response** (2026-01-15 11:50): No action needed - fixes already applied by Generator-1 and Generator-2. Re-inspection confirmed 0 violations.
