---
description: Run the comprehensive test suite to diagnose code quality issues and failures
---

Execute the comprehensive test suite to diagnose the current state of the codebase:

1. **Run the diagnostic test suite**:

   ```bash
   ./scripts/test-suite.sh
   ```

2. **Test categories analyzed**:
   - **TypeScript Type Checking**: Reports type errors and their locations
   - **ESLint Code Quality**: Identifies linting violations and patterns
   - **Prettier Formatting**: Detects formatting inconsistencies
   - **Unit Tests**: Shows passing/failing test suites and assertions
   - **Test Coverage**: Reports current coverage percentage vs target (60%)
   - **Component Structure**: Validates adherence to 5-file component pattern
   - **Production Build**: Attempts build and reports any compilation errors
   - **Accessibility**: WCAG compliance issues (requires dev server running)

3. **Understanding the diagnostic output**:
   - ✅ **Passed**: Test category completed without issues
   - ❌ **Failed**: Test category has errors (details provided in output)
   - ⏭️ **Skipped**: Test not run (usually due to missing prerequisites)
   - Each failed category includes specific error locations and counts

4. **Diagnostic summary provides**:
   - Total number of tests in each category
   - Count of passed vs failed checks
   - Specific file paths where issues were detected
   - Error messages and line numbers for failures
   - Overall readiness assessment

5. **Alternative diagnostic commands**:

   ```bash
   # Quick diagnostic scan
   docker compose exec crudkit pnpm run test:quick

   # Individual diagnostic runs
   docker compose exec crudkit pnpm run type-check    # TypeScript analysis
   docker compose exec crudkit pnpm run lint           # ESLint analysis
   docker compose exec crudkit pnpm test              # Unit test results
   docker compose exec crudkit pnpm run test:coverage # Coverage analysis
   docker compose exec crudkit pnpm run test:a11y     # Accessibility scan
   ```

**Important**: This command is for diagnostic purposes only. It reports what is broken but does NOT attempt to fix issues or suggest workarounds. Use the detailed failure reports to plan proper solutions.

Note: Full diagnostic scan takes 1-2 minutes. The output provides comprehensive failure analysis for planning purposes.
