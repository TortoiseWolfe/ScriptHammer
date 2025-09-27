# Tasks: Component Structure Standardization

**Input**: Design documents from `/specs/002-component-structure/`
**Prerequisites**: plan.md (complete), research.md (complete), data-model.md (complete), contracts/ (complete)

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Scripts**: `scripts/` at repository root
- **Components**: `src/components/`
- **Templates**: `plop-templates/`
- **Tests**: `scripts/__tests__/`

## Phase 3.1: Setup

- [ ] T001 Create scripts directory structure and install dependencies with pnpm (plop@^4.0.0, glob@^10.0.0)
- [ ] T002 Set up test infrastructure with Node.js test runner configuration in scripts/test-config.js
- [ ] T003 [P] Configure ESLint and Prettier rules for scripts directory in scripts/.eslintrc.js

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T004 [P] Write unit tests for audit-components module in scripts/**tests**/audit-components.test.js
- [ ] T005 [P] Write unit tests for migrate-components module in scripts/**tests**/migrate-components.test.js
- [ ] T006 [P] Write unit tests for validate-structure module in scripts/**tests**/validate-structure.test.js
- [ ] T007 [P] Write integration test for full audit workflow in scripts/**tests**/integration/audit-workflow.test.js
- [ ] T008 [P] Write integration test for migration workflow in scripts/**tests**/integration/migrate-workflow.test.js
- [ ] T009 [P] Write test for Plop component generator in scripts/**tests**/plop-generator.test.js
- [ ] T010 Create test fixtures with sample component structures in scripts/**tests**/fixtures/
- [ ] T011 Write contract tests for CLI API validation in scripts/**tests**/contract/cli-api.test.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] T012 Implement audit-components.js with component detection, validation, and JSON/console reporting
- [ ] T013 Implement migrate-components.js with file generation for index, test, and story files
- [ ] T014 Implement validate-structure.js for CI validation with proper exit codes
- [ ] T015 [P] Create Plop templates (index.tsx.hbs, Component.tsx.hbs, Component.test.tsx.hbs, Component.stories.tsx.hbs) in plop-templates/component/
- [ ] T016 Configure plopfile.js with component generator prompts and actions
- [ ] T017 Implement JSON and Markdown report formatters in scripts/lib/formatters.js
- [ ] T018 Add error handling and recovery mechanisms with backup support in scripts/lib/error-handler.js

## Phase 3.4: Integration

- [ ] T019 Update package.json with pnpm scripts (audit:components, migrate:components, validate:structure, generate:component)
- [ ] T020 Create GitHub Actions workflow for CI validation in .github/workflows/component-structure.yml
- [ ] T021 Generate VSCode snippets for 4-file pattern in .vscode/component.code-snippets

## Phase 3.5: Polish

- [ ] T022 Execute quickstart.md validation steps and verify 100% compliance
- [ ] T023 Update CLAUDE.md and project documentation with component structure guidelines

## Dependencies

- Setup (T001-T003) must complete first
- Tests (T004-T011) MUST complete before implementation (T012-T018)
- T010 (fixtures) blocks T007-T008 (integration tests)
- T012 blocks T013 (migration needs audit)
- T015-T016 (Plop) can run parallel to T012-T014
- Implementation (T012-T018) before integration (T019-T021)
- All tasks before polish (T022-T023)

## Parallel Execution Examples

### Test Phase Parallel Launch:

```bash
# Launch T004-T009 together (all independent test files):
pnpm test scripts/__tests__/audit-components.test.js &
pnpm test scripts/__tests__/migrate-components.test.js &
pnpm test scripts/__tests__/validate-structure.test.js &
pnpm test scripts/__tests__/integration/audit-workflow.test.js &
pnpm test scripts/__tests__/integration/migrate-workflow.test.js &
pnpm test scripts/__tests__/plop-generator.test.js &
```

### Implementation Phase Parallel:

```bash
# T015 can run parallel to core scripts:
# Terminal 1: Work on scripts
node scripts/audit-components.js

# Terminal 2: Create templates
mkdir -p plop-templates/component
```

## Task Validation Checklist

✅ All contracts have corresponding tests (T011)
✅ All entities from data-model have implementation (T012-T014)
✅ All tests come before implementation (T004-T011 before T012-T018)
✅ Parallel tasks truly independent (verified)
✅ Each task specifies exact file path
✅ No [P] task modifies same file as another [P] task

## Success Metrics

- **Test Coverage**: 100% of script functions tested
- **Compliance Rate**: 100% of components follow 4-file pattern
- **CI Integration**: Validation runs on every PR
- **Documentation**: Complete usage guide in quickstart.md

## Notes

- Commit after each task with descriptive message
- Run tests continuously during implementation
- Use `--dry-run` flag for safe testing of migration
- Keep audit reports for rollback if needed

## Estimated Timeline

- Phase 3.1 (Setup): 30 minutes
- Phase 3.2 (Tests): 2 hours
- Phase 3.3 (Implementation): 3 hours
- Phase 3.4 (Integration): 1 hour
- Phase 3.5 (Polish): 30 minutes
- **Total**: ~7 hours

## Risk Mitigation

1. **Breaking imports**: Test on subset first, use barrel exports
2. **Merge conflicts**: Coordinate with team, run during low activity
3. **CI failures**: Add grace period before enforcing
4. **Large codebases**: Implement batching in migration script
