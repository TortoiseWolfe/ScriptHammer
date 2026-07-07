# Checklist: Script Robustness (rebrand.sh)

**Purpose**: Validate the quality, completeness, and clarity of rebrand script requirements
**Created**: 2025-12-10
**Feature**: Template Fork Experience (011-feature-038-template)
**Focus**: Rebrand Script Requirements Quality
**Depth**: Formal (Release Gate)
**Audience**: Author, Reviewer, QA/Release

---

## Requirement Completeness

- [ ] CHK001 - Are all three required arguments (PROJECT_NAME, OWNER, DESCRIPTION) explicitly documented with types and examples? [Completeness, Spec §FR-001]
- [ ] CHK002 - Are optional flags (--force, --dry-run) defined with their behaviors? [Gap, Contract]
- [ ] CHK003 - Is the complete list of file extensions to process explicitly enumerated? [Completeness, Contract §File Patterns]
- [ ] CHK004 - Is the complete list of directories to exclude explicitly enumerated? [Completeness, Contract §File Patterns]
- [ ] CHK005 - Are all case variations to replace documented (ScriptHammer, scripthammer, SCRIPTHAMMER)? [Completeness, Spec §FR-002]
- [ ] CHK006 - Is the docker-compose service name update requirement specified? [Completeness, Spec §FR-004]
- [ ] CHK007 - Is the CNAME deletion behavior documented including custom domain exception? [Completeness, Spec §FR-005]
- [ ] CHK008 - Are all package.json fields to update explicitly listed (name, description, repository)? [Completeness, Spec §FR-006]
- [ ] CHK009 - Is git remote URL update format specified (SSH vs HTTPS)? [Gap, Spec §FR-007d]
- [ ] CHK010 - Are requirements for updating imports after file renames documented? [Gap]

## Requirement Clarity

- [ ] CHK011 - Is "auto-sanitize" defined with specific transformation rules? [Clarity, Clarifications §1]
- [ ] CHK012 - Is the sanitization for each character type explicit (spaces→hyphens, underscores→?, special chars→removed)? [Clarity, Contract §Name Sanitization]
- [ ] CHK013 - Is "verbose output" quantified - what exactly is printed per file? [Clarity, Spec §FR-007c]
- [ ] CHK014 - Is "idempotent" defined with expected behavior on re-run? [Clarity, Spec §FR-007]
- [ ] CHK015 - Is "previously rebranded" detection criteria explicit (grep count = 0)? [Clarity, Spec §FR-007b]
- [ ] CHK016 - Is the confirmation prompt text/format specified? [Clarity, Contract §Re-rebrand Detection]
- [ ] CHK017 - Is case-sensitivity handling explicit (preserve display, derive lowercase technical)? [Clarity, Edge Cases]
- [ ] CHK018 - Are exit codes defined for all scenarios (success, invalid args, declined, git error)? [Clarity, Contract §Exit Codes]

## Requirement Consistency

- [ ] CHK019 - Do sanitization rules align between spec clarifications and contract? [Consistency]
- [ ] CHK020 - Does the verbose output format in contract match spec requirement? [Consistency, Spec §FR-007c vs Contract §Output Format]
- [ ] CHK021 - Are file pattern inclusions consistent between spec and contract? [Consistency]
- [ ] CHK022 - Is the "custom domain" exception in FR-005 consistent with CNAME handling elsewhere? [Consistency]
- [ ] CHK023 - Do the exit codes align with all documented error scenarios? [Consistency, Contract]

## Acceptance Criteria Quality

- [ ] CHK024 - Can "all occurrences replaced" be objectively measured? [Measurability, Spec §US1-AS1]
- [ ] CHK025 - Is "200+ files" a verifiable metric or just an estimate? [Measurability, Spec §SC-005]
- [ ] CHK026 - Can "zero TypeScript errors" be objectively verified? [Measurability, Spec §SC-006]
- [ ] CHK027 - Is "under 5 minutes" a hard requirement or target? [Measurability, Spec §SC-001]
- [ ] CHK028 - Are success criteria testable without human judgment? [Measurability, Spec §Success Criteria]

## Scenario Coverage - Primary Flows

- [ ] CHK029 - Are requirements defined for fresh fork scenario (first-time run)? [Coverage, Spec §US1]
- [ ] CHK030 - Are requirements defined for re-rebrand scenario (second run, different name)? [Coverage, Edge Cases]
- [ ] CHK031 - Are requirements defined for --dry-run execution flow? [Coverage, Contract]
- [ ] CHK032 - Are requirements defined for --force flag behavior? [Coverage, Contract]
- [ ] CHK033 - Are requirements defined for interactive confirmation flow? [Coverage, Spec §FR-007b]

## Scenario Coverage - Alternate Flows

- [ ] CHK034 - Are requirements defined for running from non-root directory? [Coverage, Gap]
- [ ] CHK035 - Are requirements defined for running outside Docker container? [Coverage, Gap]
- [ ] CHK036 - Are requirements defined for partial completion (interrupted mid-execution)? [Coverage, Gap]
- [ ] CHK037 - Are requirements defined for running with uncommitted git changes? [Coverage, Edge Cases]
- [ ] CHK038 - Are requirements defined for running without git installed? [Coverage, Contract §Exit Codes]

## Edge Case Coverage

- [ ] CHK039 - Is behavior defined for empty PROJECT_NAME argument? [Edge Case, Gap]
- [ ] CHK040 - Is behavior defined for PROJECT_NAME that sanitizes to empty string? [Edge Case, Gap]
- [ ] CHK041 - Is behavior defined for OWNER containing special characters? [Edge Case, Gap]
- [ ] CHK042 - Is behavior defined for very long project names (filesystem limits)? [Edge Case, Gap]
- [ ] CHK043 - Is behavior defined for project name collision with existing files? [Edge Case, Gap]
- [ ] CHK044 - Is behavior defined for read-only files in the repository? [Edge Case, Gap]
- [ ] CHK045 - Is behavior defined for symlinks in the repository? [Edge Case, Gap]
- [ ] CHK046 - Is behavior defined for binary files that might contain "ScriptHammer"? [Edge Case, Gap]
- [ ] CHK047 - Is behavior defined for files with mixed line endings (CRLF/LF)? [Edge Case, Gap]
- [ ] CHK048 - Is behavior defined for Unicode in project names? [Edge Case, Gap]

## Error Handling Requirements

- [ ] CHK049 - Are error messages defined for invalid argument count? [Exception Flow, Contract §Exit Codes]
- [ ] CHK050 - Are error messages defined for git not installed? [Exception Flow, Contract §Exit Codes]
- [ ] CHK051 - Are error messages defined for not a git repository? [Exception Flow, Contract §Exit Codes]
- [ ] CHK052 - Is rollback behavior defined if script fails mid-execution? [Recovery Flow, Gap]
- [ ] CHK053 - Are requirements for preserving original state on --dry-run specified? [Exception Flow, Gap]
- [ ] CHK054 - Is behavior defined when sed/find commands fail on specific files? [Exception Flow, Gap]
- [ ] CHK055 - Is behavior defined when git remote update fails? [Exception Flow, Gap]
- [ ] CHK056 - Is behavior defined when file rename fails (permissions, locks)? [Exception Flow, Gap]

## Cross-Platform Requirements

- [ ] CHK057 - Are requirements defined for macOS compatibility (BSD sed vs GNU sed)? [Coverage, Gap]
- [ ] CHK058 - Are requirements defined for Linux compatibility? [Coverage, Gap]
- [ ] CHK059 - Are requirements defined for Windows/WSL compatibility? [Coverage, Gap]
- [ ] CHK060 - Is POSIX shell compliance specified or bash-specific features documented? [Clarity, Gap]
- [ ] CHK061 - Are requirements for Docker container execution specified? [Coverage, Gap]

## Dependencies & Assumptions

- [ ] CHK062 - Is the assumption that git is installed explicitly documented? [Assumption]
- [ ] CHK063 - Is the assumption that sed, find, grep are available documented? [Assumption, Gap]
- [ ] CHK064 - Is the assumption about working directory (repo root) documented? [Assumption, Gap]
- [ ] CHK065 - Is the dependency on specific shell (bash vs sh) documented? [Dependency, Gap]
- [ ] CHK066 - Are filesystem permission requirements documented? [Dependency, Gap]

## Security Considerations

- [ ] CHK067 - Are requirements defined for handling sensitive data in replaced content? [Security, Gap]
- [ ] CHK068 - Is input validation for shell injection prevention specified? [Security, Gap]
- [ ] CHK069 - Are requirements for script execution permissions documented? [Security, Gap]
- [ ] CHK070 - Is safe handling of DESCRIPTION argument (quoted strings, special chars) specified? [Security, Contract]

## Documentation Requirements

- [ ] CHK071 - Is usage documentation (--help output) specified? [Documentation, Gap]
- [ ] CHK072 - Are example invocations documented in README? [Documentation, Spec §FR-022]
- [ ] CHK073 - Is troubleshooting guidance for common errors specified? [Documentation, Gap]
- [ ] CHK074 - Is the expected output format documented for parsing by other tools? [Documentation, Contract §Output Format]

## Traceability

- [ ] CHK075 - Do all functional requirements have corresponding acceptance criteria? [Traceability]
- [ ] CHK076 - Do all edge cases have defined behaviors? [Traceability, Edge Cases]
- [ ] CHK077 - Are all clarification decisions reflected in functional requirements? [Traceability, Clarifications vs FR]
- [ ] CHK078 - Do success criteria map to testable acceptance scenarios? [Traceability, SC vs AS]

---

## Summary

| Category            | Items | Key Gaps Identified                 |
| ------------------- | ----- | ----------------------------------- |
| Completeness        | 10    | Import updates, git remote format   |
| Clarity             | 8     | Sanitization details, output format |
| Consistency         | 5     | Cross-document alignment            |
| Acceptance Criteria | 5     | Measurability of "200+ files"       |
| Primary Flows       | 5     | Core scenarios covered              |
| Alternate Flows     | 5     | Non-root, interrupted execution     |
| Edge Cases          | 10    | Empty names, unicode, symlinks      |
| Error Handling      | 8     | Rollback, partial failure           |
| Cross-Platform      | 5     | BSD vs GNU sed                      |
| Dependencies        | 5     | Shell, filesystem requirements      |
| Security            | 4     | Shell injection, permissions        |
| Documentation       | 4     | --help, troubleshooting             |
| Traceability        | 4     | Req↔Test mapping                   |

**Total Items**: 78
**Critical Gaps**: Rollback/recovery behavior, cross-platform sed compatibility, shell injection prevention
