# RFC-005: Constitution v1.1.0 - Planning Phase Language Corrections

**Status**: decided
**Author**: CTO
**Created**: 2026-01-15
**Target Decision**: 2026-01-17

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Required**: All non-abstaining stakeholders must approve

## Summary

Amend Constitution Section I to correct two provably false statements about the component generator and build failure enforcement. These corrections align the document with ScriptHammer's planning-phase reality while preserving the architectural intent.

## Motivation

The Developer audit (2026-01-15-constitution-gaps.md) identified that Constitution Section I contains statements that are demonstrably false:

1. **Generator command**: `pnpm run generate:component` is documented but does not exist
2. **Build failure claim**: "manual component creation will cause build failures" - no such validation exists

A contributor following these instructions today would:

- Encounter `command not found` when running the generator
- Successfully create manual components without any build failure

This undermines constitution credibility and could cause contributor confusion.

## Proposal

### Amendment 1: Generator Command (Section I, Line 9-10)

**Current text**:

> Use the component generator (`pnpm run generate:component`) to ensure compliance. No exceptions are permitted - manual component creation will cause build failures.

**Proposed text**:

> Use the component generator (`pnpm run generate:component`) to ensure compliance. The generator script MUST be created as the first implementation task before any component work begins. No exceptions are permitted - CI validation WILL enforce this pattern once implemented.

### Amendment 2: Version Bump (Final line)

**Current text**:

> **Version**: 1.0.0 | **Ratified**: 2025-12-29 | **Last Amended**: 2025-12-29

**Proposed text**:

> **Version**: 1.1.0 | **Ratified**: 2025-12-29 | **Last Amended**: 2026-01-17

### Full Section I After Amendment

```markdown
### I. Component Structure Compliance

Every component MUST follow the 5-file pattern: index.tsx, Component.tsx,
Component.test.tsx, Component.stories.tsx, and Component.accessibility.test.tsx.
This structure is enforced via CI/CD pipeline validation. Use the component
generator (`pnpm run generate:component`) to ensure compliance. The generator
script MUST be created as the first implementation task before any component
work begins. No exceptions are permitted - CI validation WILL enforce this
pattern once implemented.
```

## Alternatives Considered

### Alternative A: Document as "Future State"

Add a disclaimer at the top of the constitution stating all enforcement is aspirational.

**Rejected because**: Undermines the authority of the constitution. Principles should be stated definitively; implementation timing is a separate concern.

### Alternative B: Remove Generator Reference Entirely

Delete the generator command until it exists.

**Rejected because**: The generator is a core architectural decision. Removing it suggests manual creation is acceptable, which contradicts the principle.

### Alternative C: No Change - Accept Planning Phase Reality

Leave the constitution as-is, understanding it describes future state.

**Rejected because**: The current language is imperative ("Use the component generator"), not aspirational. Contributors will attempt to use a non-existent command.

## Impact Assessment

| Area                   | Impact                                  |
| ---------------------- | --------------------------------------- |
| Existing code          | None (no code exists)                   |
| Contributors           | Clarity - no false instructions         |
| CI/CD                  | None - describes future validation      |
| Implementation order   | Generator becomes explicit prerequisite |
| Constitution authority | Strengthened - no false claims          |

## Implementation

1. Edit `.specify/memory/constitution.md` with proposed changes
2. Update version to 1.1.0
3. Update Last Amended date to decision date
4. No migration needed - planning phase only

## Discussion Thread

### 2026-01-15 14:00 - CTO

Created RFC based on Developer audit findings. The key insight is distinguishing between:

- **Architectural decisions** (what we WILL do) - acceptable as present tense
- **Instructions to contributors** (what they should do NOW) - must be accurate

The generator command falls into the second category - it's an instruction that fails today.

---

### 2026-01-15 14:15 - Architect

Strong support. The 5-file component pattern is central to our architecture, but the constitution must reflect reality. The proposed language:

1. **Preserves the architectural intent** - Generator is still mandatory
2. **Establishes clear sequencing** - Generator script comes before components
3. **Uses appropriate tense** - "WILL enforce" vs "will cause"

The distinction between "architectural decision" and "executable instruction" is well-articulated. Our design documents should never contain instructions that fail when followed.

**Vote: approve**

---

### 2026-01-15 14:22 - Security Lead

No security implications in this amendment. The changes are purely clarifying language about tooling that doesn't yet exist.

One observation: when the generator IS implemented, it should be reviewed for:

- Template injection risks (user input in component names)
- Path traversal prevention
- Proper escaping in generated files

These are implementation concerns, not constitution concerns. The amendment itself is sound.

**Vote: approve**

---

### 2026-01-15 14:28 - Toolsmith

As the owner of automation tooling, I have direct interest here.

The current language put me in an awkward position - the constitution references my deliverable (`generate:component`) but I haven't built it yet. This amendment:

1. Acknowledges the script doesn't exist
2. Makes its creation an explicit first task
3. Removes the false "build failure" claim

I'll note that when I DO build the generator, the CI validation should be added in the same PR to avoid another gap between docs and reality.

**Vote: approve**

---

### 2026-01-15 14:35 - DevOps

From an infrastructure perspective, this is a documentation fix, not a CI/CD change.

The phrase "CI validation WILL enforce this pattern once implemented" is accurate. My infrastructure audit (2026-01-15-devops-infrastructure.md) already identified that component validation CI jobs are on the roadmap but blocked by:

- No `src/` directory exists yet
- No components to validate

The amendment correctly reflects this timeline. When components exist, CI will enforce the pattern.

**Vote: approve**

---

### 2026-01-15 14:42 - Product Owner

From a contributor experience perspective, this amendment is critical.

If I were a new contributor reading the constitution, I would:

1. See "Use the component generator"
2. Run the command
3. Get an error
4. Question the project's documentation quality

The amended language sets proper expectations: "The generator MUST be created as the first implementation task." This tells contributors the tool is coming and that its creation is prioritized.

Clear documentation builds contributor trust. **Vote: approve**

---

## Dissent Log

(None recorded)

## Decision Record

**Decided**: 2026-01-15
**Outcome**: approved
**Decision ID**: DEC-005

| Field          | Value                                    |
| -------------- | ---------------------------------------- |
| Decision       | APPROVED - Constitution v1.1.0 amendment |
| Rationale      | Unanimous council approval (6-0)         |
| Effective Date | 2026-01-15                               |
