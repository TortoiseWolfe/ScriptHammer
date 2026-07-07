# GitHub Workflows Status

Generated: 2026-05-06 17:45 UTC | Source: `.github/workflows/`

## Active Workflows (7)

| Workflow                       | File                      | Triggers                             | Jobs                                         |
| ------------------------------ | ------------------------- | ------------------------------------ | -------------------------------------------- |
| Accessibility Testing          | `accessibility.yml`       | push, pull_request                   | push, pull_request, accessibility            |
| CI                             | `ci.yml`                  | push, pull_request                   | push, pull_request, test                     |
| Component Structure Validation | `component-structure.yml` | push, pull_request                   | push, pull_request, validate                 |
| Deploy to GitHub Pages         | `deploy.yml`              | push, manual                         | push, workflow_dispatch, build-and-deploy +1 |
| E2E Tests                      | `e2e.yml`                 | push, pull_request, schedule, manual | push, pull_request, schedule +9              |
| Monitor and Update Status      | `monitor.yml`             | push, schedule, manual               | schedule, push, lighthouse +3                |
| Supabase Keep-Alive            | `supabase-keepalive.yml`  | schedule, manual                     | schedule, prime-supabase                     |
