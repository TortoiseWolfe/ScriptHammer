# Implementation Terminal Context

**Implementation roles**: Developer, TestEngineer, Auditor, ReleaseManager

## Role Responsibilities

| Role           | Job                                         | Key Skills                                             |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| Developer      | Convert specs + wireframes to code          | `/speckit.implement`, `/speckit.tasks`                 |
| TestEngineer   | Run tests, report coverage                  | `/test`, `/test-components`, `/test-a11y`              |
| Auditor        | Cross-artifact consistency                  | `/speckit.analyze`, `/read-spec`                       |
| ReleaseManager | Versioning, changelog, release coordination | `/release-prep`, `/changelog-update`, `/release-notes` |

## SpecKit Workflow

```
spec.md → plan.md → tasks.md → implementation
    ↑         ↑         ↑           ↓
    └─────────┴─────────┴── audit ──┘
```

## Constitution Compliance

All code must follow 6 principles:

1. **5-file pattern**: index.tsx, Component.tsx, test, stories, a11y
2. **TDD**: Tests before implementation
3. **SpecKit**: Complete workflow, no skipped steps
4. **Docker-first**: No local package installs
5. **Progressive enhancement**: PWA, a11y, mobile-first
6. **Privacy first**: GDPR, consent before tracking

## Technical Constraints

- Static export to GitHub Pages (no API routes)
- Server logic in Supabase Edge Functions
- Secrets in Supabase Vault only

## Auditor Checks

| Check        | What to Compare                       |
| ------------ | ------------------------------------- |
| Spec → Plan  | Does plan implement all requirements? |
| Plan → Tasks | Do tasks cover all plan items?        |
| Tasks → Code | Does implementation match?            |

## Persistence Rule

Write audits to: `docs/interoffice/audits/YYYY-MM-DD-[role]-[topic].md`
