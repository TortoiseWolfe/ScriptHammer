---
description: Download E2E test artifacts from GitHub Actions and analyze failures
---

# Fetch and Analyze Test Results

Automated workflow: clear old data → find latest failed run → download artifacts → analyze all failure data.

## Step 1: Clear Old Results

```bash
rm -rf test-results/* playwright-report/*
mkdir -p test-results playwright-report
```

## Step 2: Find Latest Failed Run

```bash
gh run list --repo TortoiseWolfe/ScriptHammer --limit 5 --json databaseId,status,conclusion,name,createdAt
```

## Step 3: Download Artifacts

```bash
gh run download <RUN_ID> --repo TortoiseWolfe/ScriptHammer --pattern "playwright-*" --dir test-results/
```

Extract if zipped:

```bash
cd test-results && unzip -o "*.zip" 2>/dev/null && rm -f *.zip && cd ..
```

## Step 4: Analyze All Failure Data

Each failure directory contains:

| File                  | What It Contains                                        | How to Use                                                      |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| **error-context.md**  | DOM snapshot, element refs, alert messages, form values | **READ THIS FIRST** - shows exact error messages and page state |
| **trace.zip**         | Network requests, console logs, action timeline         | Unzip and check for API errors, 401/403, timeouts               |
| **video.webm**        | Video recording of test execution                       | Watch for timing issues, UI glitches                            |
| **test-failed-1.png** | Screenshot at failure moment                            | Visual confirmation of state                                    |

### Priority: Read error-context.md files first

```bash
# List all error context files
find test-results -name "error-context.md" -type f

# Quick scan for common errors
grep -r "alert\|error\|Error\|failed\|401\|403\|timeout" test-results/*/error-context.md | head -30
```

The error-context.md contains the accessibility tree showing:

- **Alert messages** with actual error text (e.g., "Too many failed attempts...")
- **Form field values** at failure time
- **Button states** (disabled, active)
- **Element refs** for debugging selectors

### Extract trace data

```bash
# Unzip traces for deeper analysis
for f in test-results/*/trace.zip; do
  dir=$(dirname "$f")
  unzip -o "$f" -d "$dir/trace" 2>/dev/null
done

# Check for network errors in traces
find test-results -path "*/trace/*" -name "*.json" -exec grep -l "error\|failed\|401\|403" {} \;
```

## Step 5: Quick Stats

```bash
total=$(ls -1d test-results/*/ 2>/dev/null | wc -l)
retries=$(ls -1d test-results/*-retry*/ 2>/dev/null | wc -l)
contexts=$(find test-results -name "error-context.md" | wc -l)
echo "Failures: $total, Retries: $retries, Error contexts: $contexts"
```

### Group by Category

```bash
ls -1 test-results/ | cut -d'-' -f1-2 | sort | uniq -c | sort -rn
```

## Step 6: Categorize Issues

| Category             | Symptoms in error-context.md             | Fix Type                            |
| -------------------- | ---------------------------------------- | ----------------------------------- |
| **Auth/Environment** | "Invalid credentials", 401, missing user | GitHub Secrets                      |
| **Rate Limiting**    | "Too many attempts", "locked"            | Test isolation or Supabase config   |
| **Timing**           | Element not found, retry folders         | Increase waits, fix race conditions |
| **Selector**         | Wrong element ref, "not found"           | Update test selectors               |
| **Real Bug**         | Wrong alert text, unexpected state       | Application code fix                |

## Output Format

```markdown
## Test Failure Analysis

**Run ID**: <id>
**Total Failures**: X (Y after retries)
**Error Contexts**: Z

### Root Causes (from error-context.md analysis)

#### 1. [Category] - X failures

- **Error**: [exact error text from alert/message]
- **Page State**: [what the DOM showed]
- **Tests**: [list affected tests]
- **Fix**: [specific recommendation]

### Action Items

**Immediate fixes**:

- [ ] ...

**Needs investigation** (review traces/videos):

- [ ] ...

**GitHub Secrets**:

- [ ] ...
```

## Key Insight

The `error-context.md` files contain the actual error messages shown to users. Always read these first - they tell you exactly what went wrong without guessing from folder names or screenshots.
