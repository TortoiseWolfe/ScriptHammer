# UX Flow Order: 007-e2e-testing-framework

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-test-architecture-diagram.svg) + spec.md

## Visual Flow Analysis

This is an **architectural diagram**, not a traditional user interface. The "user" is a developer, and the "flow" represents the test execution pipeline from spec files to outputs.

### Spec User Stories (7 total)

| US     | Title                         | Priority | Wireframe Coverage       |
| ------ | ----------------------------- | -------- | ------------------------ |
| US-001 | Cross-Browser Test Execution  | P0       | ✓ Browser panels         |
| US-002 | Critical User Journey Testing | P0       | ✓ Test spec files        |
| US-003 | Theme Switching Validation    | P1       | Not shown (test content) |
| US-004 | PWA Feature Testing           | P1       | Not shown (test content) |
| US-005 | Accessibility Testing         | P1       | Not shown (test content) |
| US-006 | CI/CD Integration             | P0       | ✓ GitHub Actions panel   |
| US-007 | Test Debugging                | P2       | ✓ Debug artifacts        |

### Recommended User Story Sequence (Pipeline Flow)

| Order | Callout | User Story                      | Screen Location            | Rationale                    |
| ----- | ------- | ------------------------------- | -------------------------- | ---------------------------- |
| 1     | ②       | US-002: User Journey Testing    | Test Files (top-left)      | Developer writes tests first |
| 2     | ③       | US-006: CI/CD Integration       | Playwright Runner (center) | Tests are orchestrated       |
| 3     | ①       | US-001: Cross-Browser Execution | Browser panels (row 3)     | Tests run across browsers    |
| 4     | ④       | US-007: Test Debugging          | Artifacts (bottom)         | Results and debugging last   |

### Visual Flow Map

```
Architecture Diagram (data flow):
┌──────────────┐                    ┌──────────────┐
│ ② Test Specs │ ←─────────────────→│ Dev Server   │
│ e2e/tests/   │                    │ localhost    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │              ┌────────────────────┘
       ▼              ▼
┌─────────────────────────────────────────────────┐
│ ③ PLAYWRIGHT TEST RUNNER                        │ ← Orchestration
│    @playwright/test                             │
│    Parallel | Auto-retries | Multi-browser      │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────┐
│ Chromium  │  │ Firefox   │  │ WebKit    │  │ Mobile │
│ ① Chrome  │  │ Gecko     │  │ Safari    │  │ Pixel5 │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───┬────┘
      │              │              │            │
      └──────────────┼──────────────┘            │
                     ▼                           │
┌─────────────────────────────────────────────────────────┐
│ ④ OUTPUTS                                               │
│  [HTML Reports] [Debug Artifacts] [GitHub Actions CI]   │
│   screenshots     videos, traces    PR status check     │
└─────────────────────────────────────────────────────────┘
```

### Current vs Recommended

| Current Wireframe | Recommended         | Change Needed                      |
| ----------------- | ------------------- | ---------------------------------- |
| ① Browsers        | ② Test Specs        | SPEC-ORDER: Input before execution |
| ② Test Specs      | ③ Playwright Runner | SPEC-ORDER: Renumber               |
| ③ Playwright      | ① Browsers          | SPEC-ORDER: Renumber               |
| ④ Artifacts       | ④ Artifacts         | None                               |

### Issue

Current callout sequence shows execution order (①②③④) rather than the pipeline flow a developer would follow: Write tests → Configure runner → Execute → Review results.

**Recommendation**: Renumber callouts to match developer workflow:

- ① Test Spec Files (input)
- ② Playwright Runner (orchestration)
- ③ Browser Engines (execution)
- ④ Outputs (reports, artifacts, CI status)

This follows left-to-right, top-to-bottom reading of the architecture diagram.
