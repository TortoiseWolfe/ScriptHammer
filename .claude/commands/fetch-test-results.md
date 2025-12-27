---
description: Download E2E test artifacts from GitHub Actions and analyze failures
---

Execute these steps AUTOMATICALLY without asking the user for input. This is a fully automated workflow.

## Step 1: Clear Old Results

Docker is required because test-results files are root-owned:

```bash
docker compose exec scripthammer rm -rf test-results/* playwright-report/*
docker compose exec scripthammer mkdir -p test-results playwright-report
```

## Step 2: Find Latest E2E Run (Success OR Failure)

**IMPORTANT**: GitHub marks runs as "success" even when individual tests FAIL (the workflow completes). Always check the LATEST E2E run regardless of conclusion.

```bash
docker compose exec scripthammer gh run list --repo TortoiseWolfe/ScriptHammer --limit 20 --json databaseId,conclusion,createdAt,name,event
```

Look for:

1. Runs with `conclusion: "failure"` - definitely have failure artifacts
2. The LATEST `name: "E2E Tests"` run - may have artifacts even if `conclusion: "success"`

## Step 3: Download Artifacts

Download from the latest E2E run (or failed run):

```bash
docker compose exec scripthammer gh run download <RUN_ID> --repo TortoiseWolfe/ScriptHammer --pattern "playwright-*" --dir test-results/
```

**NOTE**: `gh run download` automatically extracts the artifact. Files appear at:
`test-results/playwright-results-chromium/<test-folders>/`

NO unzip step is needed - gh extracts automatically.

Verify download worked:

```bash
docker compose exec scripthammer ls -la test-results/
docker compose exec scripthammer ls test-results/playwright-results-chromium/ | head -20
```

If "no artifacts" message appears but you KNOW tests failed, try the next most recent E2E run.

## Step 4: Get Stats

```bash
docker compose exec scripthammer bash -c "ls -1d test-results/playwright-results-chromium/*/ 2>/dev/null | wc -l"
docker compose exec scripthammer bash -c "ls -1d test-results/playwright-results-chromium/*-retry*/ 2>/dev/null | wc -l"
docker compose exec scripthammer bash -c "find test-results/playwright-results-chromium -name 'error-context.md' | wc -l"
docker compose exec scripthammer bash -c "find test-results/playwright-results-chromium -name 'test-failed-*.png' | wc -l"
```

Group failures by test category:

```bash
docker compose exec scripthammer bash -c "ls -1 test-results/playwright-results-chromium/ | sed 's/-chromium.*//' | sed 's/-retry[0-9]*//' | sort | uniq -c | sort -rn | head -20"
```

## Step 5: DEEP ANALYSIS - Read error-context.md Files

For EACH failure category with 3+ failures:

1. Find error-context.md files for that category:

   ```bash
   docker compose exec scripthammer find test-results/playwright-results-chromium -path "*<category>*" -name "error-context.md" | head -3
   ```

2. **READ each file using the Read tool** - do NOT grep. Use the full path returned.

3. In each error-context.md, look for:
   - `alert [ref=...]` elements - these contain the actual error message
   - `heading` elements showing what page/state the user sees
   - `link "Sign In"` / `link "Sign Up"` - indicates user NOT authenticated
   - Form field values (textbox contents)
   - Button states: `[disabled]`, `[active]`
   - Text like "No conversations", "Invalid credentials", "No users found", "Conversation not found"
   - `generic [ref=e2]: Internal Server Error` - indicates server crash

4. Identify the ROOT CAUSE using the pattern reference below.

## Step 5.5: Analyze Screenshots (When No error-context.md)

For tests WITHOUT error-context.md files, read the PNG screenshots:

```bash
docker compose exec scripthammer find test-results/playwright-results-chromium -name "test-failed-*.png" | head -10
```

**READ each PNG using the Read tool** - Claude can analyze images directly.

Look for in screenshots:

- Cyan/blue error banners (alert boxes)
- "Conversation not found" messages
- "Sign In" / "Sign Up" buttons in navbar (indicates not authenticated)
- Empty states ("No messages yet", "No conversations", "Select a conversation")
- Form validation errors (red text near inputs)
- Loading spinners stuck on screen
- Modal dialogs blocking interaction

## Common Error Patterns Reference

| Visual Pattern                         | Root Cause                                  | Fix                                                                        |
| -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `link "Sign In"` in navbar             | Auth not persisted                          | Use `performSignIn()` helper, add `waitForAuthenticatedState()`            |
| "Conversation not found" banner        | Missing `conversations` record              | Add conversation creation to `beforeAll` with canonical UUID ordering      |
| Buttons `[disabled]` on payment        | Missing GDPR consent                        | Add `page.getByRole('button', { name: /Accept/i }).click()` before payment |
| "No users found" in search             | `display_name` is null                      | Use `getDisplayNameByEmail()` helper which sets it                         |
| Empty conversation list                | Connection exists but no conversation       | Create BOTH `user_connections` AND `conversations` in beforeAll            |
| "Internal Server Error"                | App crash - real bug                        | Highest priority - check server logs                                       |
| Tab counts show "(0)" but UI different | Real-time subscription or count query issue | Refresh page or add explicit wait                                          |
| Form shows but submit fails            | Missing env vars or Supabase issue          | Check SUPABASE_SERVICE_ROLE_KEY is set                                     |

## Step 6: Report Findings

For each issue, provide:

```
### [Category] - X failures

**Exact Error**: "[quote the alert text or heading from error-context.md/screenshot]"

**Page State**: [what heading/UI shows - e.g., "Select a conversation", "Sign In page", "Internal Server Error"]

**Root Cause**: [why this happened - specific, not generic]

**Affected Tests**:
- test-name-1
- test-name-2

**Fix Required**: [specific action - file to change, what to add/modify]
```

## Step 7: Prioritize Fixes

Group by fix type:

1. **Server Crashes** - Internal Server Error = app bug, highest priority
2. **Authentication Issues** - Tests not logged in, fix `performSignIn()` usage
3. **Missing Test Data** - beforeAll not creating connections/conversations
4. **RLS/Database Issues** - Policies blocking data visibility
5. **Environment** - Missing GitHub Secrets or Supabase config
6. **Timing/Selectors** - waitFor, wrong refs
7. **Real Bugs** - Application code defects

## IMPORTANT RULES

1. **ALL commands via Docker**: `docker compose exec scripthammer <cmd>`
2. **Check BOTH failed AND success runs** - success runs may have test failure artifacts
3. **READ the error-context.md files** - use the Read tool, don't just grep
4. **READ the PNG screenshots** - Claude can analyze images, use the Read tool
5. **Quote actual errors** - copy the exact text from alert/heading elements
6. **Provide specific fixes** - not "investigate timing issues"
7. **No manual steps** - execute everything automatically
8. **Artifacts are pre-extracted** - no unzip needed after gh run download
