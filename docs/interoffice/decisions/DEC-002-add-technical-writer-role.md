# DEC-002: Add Technical Writer Role

**Date**: 2026-01-14
**RFC**: RFC-002
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-14 |
| Architect     | approve | 2026-01-14 |
| Security Lead | approve | 2026-01-14 |
| Toolsmith     | approve | 2026-01-14 |
| DevOps        | approve | 2026-01-14 |
| Product Owner | approve | 2026-01-14 |

## Decision

Add a new **Technical Writer** contributor role to handle API documentation, data model documentation, integration guides, and inline code documentation.

## Rationale

The Q1 2026 organizational audit identified that **2 terminals** requested this role:

1. **Architect**: "Technical Writer role distinct from Author. Author focuses on external communications while technical docs (API contracts, data models, integration guides) need dedicated attention. Currently this falls to Architect which dilutes focus."

2. **Author**: "Agree with Architect's observation... Author focuses on external-facing and process documentation, while Technical Writer would handle API docs, data model documentation, integration guides, and inline code documentation. These require different skill sets."

Currently:

- **Author** handles: Blog posts, release notes, workflow guides, social media, lessons learned
- **Architect** handles: System design + API contracts + data models (overloaded)

## Scope Clarification

| Content Type                  | Owner            |
| ----------------------------- | ---------------- |
| Blog posts, release notes     | Author           |
| Social media, announcements   | Author           |
| Workflow guides, process docs | Author           |
| API documentation             | Technical Writer |
| Data model documentation      | Technical Writer |
| Integration guides            | Technical Writer |
| Code comments, JSDoc          | Technical Writer |

## Dissenting Views

None recorded.

## Impact

**Positive**:

- Dedicated focus on technical documentation quality
- Frees Architect to focus on design decisions
- Clearer separation between external comms (Author) and technical docs
- Better API and integration documentation

**Negative**:

- One more terminal to coordinate
- Requires new skill development
- Potential overlap confusion with Author (mitigated by scope table)

## Implementation

- [ ] Add Technical Writer to CLAUDE.md Terminal Roles table
- [ ] Add Technical Writer Terminal Primer to CLAUDE.md
- [ ] Update Contributors reporting hierarchy (under Architect)
- [ ] Add Technical Writer to documentation workflow
- [x] Create `/prime tech-writer` skill
- [ ] Create `/api-doc` skill
- [ ] Create `/data-model` skill
- [ ] Create `/integration-guide` skill
