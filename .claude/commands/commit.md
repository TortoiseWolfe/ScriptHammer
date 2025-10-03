---
description: Run linter, type-check, and commit changes with a descriptive message
tags: workflow
---

Please follow these steps to commit code changes:

1. **Run Quality Checks**:
   - Execute `docker compose exec scripthammer pnpm run lint`
   - Execute `docker compose exec scripthammer pnpm run type-check`
   - If either check fails, stop and report the errors

2. **Stage and Commit**:
   - Run `git add -A`
   - Check `git status` to see what will be committed
   - Create a commit with a descriptive message following conventional commits format:
     - `fix:` for bug fixes
     - `feat:` for new features
     - `docs:` for documentation changes
     - `style:` for formatting changes
     - `refactor:` for code refactoring
     - `test:` for test changes
     - `chore:` for build/tooling changes
   - Always include the standard footer:

     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude <noreply@anthropic.com>
     ```

3. **Report Results**:
   - Show the commit hash and message
   - Note that changes are ready to push

**Important**: Only commit if all quality checks pass. Do not push to remote unless explicitly requested by the user.
