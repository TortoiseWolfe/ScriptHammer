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

## Step 2: Find Latest Run with Artifacts

```bash
docker compose exec scripthammer gh run list --repo TortoiseWolfe/ScriptHammer --limit 10 --workflow=e2e.yml --json databaseId,conclusion,createdAt
```

Find the most recent run with conclusion "failure" that has artifacts. If all runs are "cancelled" or "success", check if test-results/ already has data to analyze.

## Step 3: Download Artifacts

```bash
docker compose exec scripthammer gh run download <RUN_ID> --repo TortoiseWolfe/ScriptHammer --pattern "playwright-*" --dir test-results/
```

If zipped, extract:

```bash
docker compose exec scripthammer bash -c "cd test-results && unzip -o '*.zip' 2>/dev/null; rm -f *.zip"
```

## Step 4: Get Stats

```bash
docker compose exec scripthammer bash -c "ls -1d test-results/*/ 2>/dev/null | wc -l"
docker compose exec scripthammer bash -c "ls -1d test-results/*-retry*/ 2>/dev/null | wc -l"
docker compose exec scripthammer bash -c "find test-results -name 'error-context.md' | wc -l"
docker compose exec scripthammer bash -c "ls -1 test-results/ | cut -d'-' -f1-2 | sort | uniq -c | sort -rn"
```

## Step 5: DEEP ANALYSIS (Critical - Do Not Skip)

For EACH failure category with 3+ failures:

1. Find error-context.md files for that category:

   ```bash
   find test-results -path "*<category>*" -name "error-context.md" | head -3
   ```

2. **READ each file using the Read tool** - do NOT grep

3. In each error-context.md, look for:
   - `alert [ref=...]` elements - these contain the actual error message
   - `heading` elements showing what page/state the user sees
   - Form field values (textbox contents)
   - Button states: `[disabled]`, `[active]`
   - Text like "No conversations", "Invalid credentials", "No users found"

4. Identify the ROOT CAUSE:
   - Is it missing data? (RLS policy, beforeAll setup)
   - Is it wrong selector? (element not found)
   - Is it timing? (element not ready)
   - Is it environment? (missing secrets, wrong config)
   - Is it a real bug? (wrong behavior)

## Step 6: Report Findings

For each issue, provide:

```
### [Category] - X failures

**Exact Error**: "[quote the alert text from error-context.md]"

**Page State**: [what heading/UI shows - e.g., "Select a conversation", "Sign In page"]

**Root Cause**: [why this happened - specific, not generic]

**Affected Tests**:
- test-name-1
- test-name-2

**Fix Required**: [specific action - file to change, what to add/modify]
```

## Step 7: Prioritize Fixes

Group by fix type:

1. **RLS/Database Issues** - Policies blocking data visibility
2. **Test Setup** - beforeAll/beforeEach not creating required data
3. **Environment** - Missing GitHub Secrets or Supabase config
4. **Timing/Selectors** - waitFor, wrong refs
5. **Real Bugs** - Application code defects

## IMPORTANT RULES

1. **ALL commands via Docker**: `docker compose exec scripthammer <cmd>`
2. **These results are from the last push** - never claim they're "old" or "previous"
3. **READ the error-context.md files** - don't just grep patterns
4. **Quote actual errors** - copy the exact text from alert elements
5. **Provide specific fixes** - not "investigate timing issues"
6. **No manual steps** - execute everything automatically
