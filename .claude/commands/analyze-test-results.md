---
description: Analyze E2E test failures from GitHub Actions and create a fix plan
---

Analyze the test results extracted from GitHub Actions and create an actionable plan:

1. **Scan test-results folder**:
   - List all failure directories in `test-results/`
   - Group failures by test category (auth, messaging, accessibility, etc.)
   - Count total failures and retries

2. **Analyze each failure**:
   - Read screenshots (PNG files) to understand the visual state
   - Check for error patterns in folder names
   - Identify common root causes (auth issues, missing env vars, timing, etc.)

3. **Categorize issues**:
   - **Environment**: Missing secrets, invalid credentials, Supabase config
   - **Test flakiness**: Timing issues, race conditions, retry patterns
   - **Real bugs**: Actual application issues that need code fixes
   - **Test issues**: Tests that need updating (selectors, assertions)

4. **Create fix plan**:
   - Prioritize by impact (blocking vs. flaky)
   - Group related fixes together
   - Identify quick wins vs. complex fixes
   - Note any GitHub secrets that need updating

5. **Output summary**:

   ```
   ## Test Failure Analysis

   ### Summary
   - Total failures: X
   - Categories affected: [list]

   ### Root Causes
   1. [Category]: [Count] failures - [Brief description]

   ### Recommended Fixes
   1. [Priority] [Fix description]
   ```

**Important**: Read the actual screenshot images to understand what the user sees. Don't just guess from folder names.
