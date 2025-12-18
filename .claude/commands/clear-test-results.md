---
description: Clear test result folders to prepare for new GitHub Actions feedback
---

Clear all test output folders to prepare for analyzing new test results:

1. **Delete test artifacts**:

   ```bash
   rm -rf test-results/* playwright-report/* coverage/*
   mkdir -p test-results
   ```

2. **Confirm cleanup**:
   - Report number of items deleted
   - Confirm `test-results/` folder is ready for new extractions

**Use case**: After extracting GitHub Actions test results, run this command to prepare for the next batch of feedback.
