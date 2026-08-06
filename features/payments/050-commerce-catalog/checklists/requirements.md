# Specification Quality Checklist: Commerce Catalog & Storefront

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Validation iteration 1 — 2026-08-06

**Two items were fixed rather than waived.**

1. _No implementation details_ initially **failed**. The "Why this exists"
   section named row-level security, webhooks and an offline queue while
   describing what already ships. Rewritten in terms of the capability rather
   than the mechanism ("keeping each customer's records private to them" rather
   than "row-level security"). Now passes.

2. _Success criteria are technology-agnostic_ passes deliberately, not by
   accident. The source PRD is dense with provider names, table names and line
   numbers; none of it was carried into the functional requirements or success
   criteria. The spec says "payment provider" and "scheduler" throughout. The
   specifics live in the PRD, which the plan phase will read.

### Validation iteration 2 — 2026-08-06

Both `[NEEDS CLARIFICATION]` markers are **resolved**; the section is now
`## Clarifications` and records the reasoning, not just the answer.

- **consent and attribution** → booking facts only, no attribution, no consent
  snapshot. Note the reasoning is the interesting part: attribution here was
  probably _permissible_ under legitimate interest, since the product's four
  consent gates all govern third-party browser code rather than server-side
  records. It was dropped on value grounds, not legal ones. Recorded so nobody
  later "fixes" it by assuming it was a compliance blocker. → FR-024a, FR-024b,
  SC-012.
- **zero-fee tipping** → offer both fee-free direct methods alongside card, with
  the no-receipt consequence stated at the point of choice. → FR-029, FR-030,
  SC-013, and two new acceptance scenarios on User Story 7.

**All checklist items now pass. The spec is ready for the wireframe gate.**

### Two things carried forward to the plan phase

These are not spec-level, but they must not be lost between here and `plan.md`:

- The source PRD's design rationale for the post-purchase booking action was
  **factually wrong** about the code and has been corrected in place. The spec
  reflects the corrected design (an outbound link). Do not re-derive it from an
  older copy of the PRD.
- The feature is **050**, not 016, and lives under `features/payments/`. The
  automatic numbering in `create-new-feature.sh` picks 049, which belongs to
  Model City.
