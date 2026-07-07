# RFC-006: Add Four New Roles to Multi-Terminal Workflow

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

Expand the ScriptHammer multi-terminal workflow from 22 to 26 terminals by adding four new specialized roles:

1. **UX Designer** (Council) - 7th voting member for user experience governance
2. **UI Designer** (Contributor) - Visual design execution
3. **Business Analyst** (Contributor) - Requirements translation
4. **Release Manager** (Contributor) - Release process ownership

## Motivation

Gap analysis of standard software development team roles identified missing coverage:

| Gap             | Industry Standard | Current Coverage                                    |
| --------------- | ----------------- | --------------------------------------------------- |
| User Experience | Dedicated UX role | Product Owner partially covers                      |
| Visual Design   | UI Designer       | WireframeGenerators do layout, not visual design    |
| Requirements    | Business Analyst  | Product Owner handles high-level only               |
| Release Process | Release Manager   | DevOps handles deployment, not release coordination |

Sources:

- [Alcor: 11 Key Roles in Software Development Team](https://alcor.com/10-key-roles-in-a-software-development-team-who-is-responsible-for-what/)
- [Brainhub: 7 Crucial Roles in Software Development Team](https://brainhub.eu/library/crucial-roles-in-software-development-team)

## Proposal

### New Role Definitions

#### 1. UX Designer (Council Tier)

| Attribute     | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Tier          | Council (RFC voting privileges)                             |
| Domain        | User research, interaction design, design system governance |
| Reports To    | N/A (Council peer)                                          |
| Receives From | UI Designer, WireframeQA                                    |

**Responsibilities**:

- User research synthesis and persona development
- Interaction design patterns and guidelines
- Design system principles and component governance
- Usability review of wireframes and implementations
- Cross-feature UX consistency

**Rationale for Council membership**: UX decisions have architectural-level impact. Similar to how Product Owner represents user requirements, UX Designer represents user experience patterns and deserves voting authority.

#### 2. UI Designer (Contributor Tier)

| Attribute  | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Tier       | Contributor                                                     |
| Domain     | Visual design execution, component styling, asset specification |
| Reports To | Architect                                                       |
| Works With | WireframeGenerators, UX Designer                                |

**Responsibilities**:

- Visual design execution (colors, typography, spacing)
- Component visual styling
- Visual consistency across wireframes
- Icon and asset specification
- Theme variant designs (dark mode, etc.)

#### 3. Business Analyst (Contributor Tier)

| Attribute  | Value                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| Tier       | Contributor                                                              |
| Domain     | Requirements translation, acceptance criteria, stakeholder communication |
| Reports To | Product Owner                                                            |

**Responsibilities**:

- Requirements decomposition from high-level to actionable
- User story refinement and acceptance criteria detail
- Stakeholder communication documentation
- Business rules documentation
- Edge case identification

#### 4. Release Manager (Contributor Tier)

| Attribute  | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| Tier       | Contributor                                                  |
| Domain     | Release process, versioning, changelog, release coordination |
| Reports To | DevOps                                                       |

**Responsibilities**:

- Semantic versioning decisions
- Changelog generation and maintenance
- Release notes coordination with Author
- Release branch management
- Go/no-go release criteria verification

### Workflow Integration

**UI Designer in Wireframe Pipeline**:

```
UX Designer → UI Designer (visual specs) → WireframeGenerators → WireframeQA
                                                    ↑
                          UI Designer reviews ──────┘
```

**Business Analyst in Requirements Flow**:

```
Product Owner → Business Analyst → Architect → Planner → Implementation
(high-level)    (detailed AC)     (technical)
```

**Release Manager in Deployment Flow**:

```
Developer → TestEngineer → QALead → Release Manager → DevOps → Author
                                    (version, changelog)      (notes)
```

### File Changes Required

| File                              | Change                                    |
| --------------------------------- | ----------------------------------------- |
| `.claude/roles/council.md`        | Add UX Designer                           |
| `.claude/roles/design.md`         | CREATE - UI Designer context              |
| `.claude/roles/support.md`        | Add Business Analyst                      |
| `.claude/roles/implementation.md` | Add Release Manager                       |
| `docs/interoffice/CLAUDE.md`      | Update tier tables, routing, RFC template |
| `CLAUDE.md`                       | Update terminal count and role table      |
| `scripts/tmux-session.sh`         | Add 4 primers, update role groups         |
| `scripts/tmux-dispatch.sh`        | Update window mappings                    |

## Alternatives Considered

### Alternative A: Add UX Designer as Contributor, not Council

**Rejected because**: UX decisions affect architecture. Design system governance requires authority. Without voting power, UX concerns could be overruled on architectural decisions that impact user experience.

### Alternative B: Combine UI Designer into existing WireframeGenerator role

**Rejected because**: WireframeGenerators focus on layout and structure. Visual design (colors, typography, polish) is a distinct skill set. Separation allows specialization.

### Alternative C: Skip Business Analyst, expand Product Owner

**Rejected because**: Product Owner is already council-level strategic role. Detailed requirements work is contributor-level task that should feed into Product Owner decisions, not replace them.

## Impact Assessment

| Area           | Impact                             |
| -------------- | ---------------------------------- |
| Terminal count | 22 → 26 (+4)                       |
| Council size   | 6 → 7 (+1)                         |
| RFC consensus  | 7 votes required (still unanimous) |
| tmux windows   | 22 → 26                            |
| Role files     | 1 new file, 4 modified             |

## Implementation

1. Update role context files in `.claude/roles/`
2. Update interoffice system documentation
3. Update tmux session and dispatch scripts
4. New roles activate on next factory launch

## Discussion Thread

### 2026-01-15 15:00 - CTO

Created RFC based on gap analysis and industry research. The key additions are:

- UX Designer brings user experience expertise to council decisions
- UI Designer handles visual execution that WireframeGenerators don't cover
- Business Analyst bridges Product Owner ↔ technical requirements
- Release Manager owns the release process that currently has no clear owner

**Vote: approve**

---

### 2026-01-15 15:10 - Architect

Strong support for all four roles. The separation of concerns aligns with our architecture:

1. **UX Designer as Council**: Critical. Design system decisions are architectural decisions. Having UX at the table prevents costly redesigns later.

2. **UI Designer under Architect**: Good fit. Visual consistency is a form of architectural constraint. The UI Designer → WireframeGenerator workflow makes sense.

3. **Business Analyst**: Addresses a real gap. I've seen requirements get lost between Product Owner's high-level vision and implementation details.

4. **Release Manager**: The release process needs an owner. Currently it's unclear who decides when we're "ready to ship."

One note: The 7-member council may slow consensus, but the diversity of perspectives is worth it.

**Vote: approve**

---

### 2026-01-15 15:18 - Security Lead

No security concerns with the organizational structure. Some observations:

1. **UX Designer scope**: Should include security UX patterns - clear error messages, secure defaults, privacy controls. Good that this gets council-level attention.

2. **Business Analyst**: Should document security requirements alongside functional requirements. Edge cases often have security implications.

3. **Release Manager**: Should verify security checklist items before release approval. This is a good checkpoint.

The expanded council means more eyes on security-related RFCs, which is positive.

**Vote: approve**

---

### 2026-01-15 15:25 - Toolsmith

From an automation perspective, each new role needs skill support:

| Role             | Proposed Skills                          | Toolsmith Effort |
| ---------------- | ---------------------------------------- | ---------------- |
| UX Designer      | /ux-review, /design-system, /persona     | Medium           |
| UI Designer      | /style-guide, /color-review, /asset-spec | Medium           |
| Business Analyst | /requirements, /acceptance-criteria      | Low              |
| Release Manager  | /release-prep, /changelog-update         | Medium           |

I can build these skills incrementally. The release skills are particularly useful - `/changelog-update` has been on my backlog.

**Vote: approve**

---

### 2026-01-15 15:32 - DevOps

Release Manager reporting to DevOps makes sense. Clear separation:

| Role            | Responsibility                                   |
| --------------- | ------------------------------------------------ |
| Release Manager | WHAT ships (changelog, version, release notes)   |
| DevOps          | HOW it ships (CI/CD, deployment, infrastructure) |

The `tmux-session.sh` and `tmux-dispatch.sh` changes are straightforward. Window mappings 23-26 for the new terminals, update the COUNCIL array to include UXDesigner.

One consideration: We're at 26 terminals now. If we keep growing, we may need to revisit the tmux architecture. But for now, it scales fine.

**Vote: approve**

---

### 2026-01-15 15:40 - Product Owner

Business Analyst reporting to Product Owner is exactly what I need. Currently I'm handling:

- Strategic product direction
- User requirements definition
- Acceptance criteria detail
- Stakeholder communication

The last two take significant time and are contributor-level work. Having a Business Analyst handle detailed requirements decomposition lets me focus on strategic decisions.

UX Designer on council is also valuable - user experience deserves voting authority alongside user requirements.

**Vote: approve**

---

## Dissent Log

(None recorded)

## Decision Record

**Decided**: 2026-01-15
**Outcome**: approved
**Decision ID**: DEC-006

| Field          | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Decision       | APPROVED - Add 4 new roles (UX Designer, UI Designer, Business Analyst, Release Manager) |
| Rationale      | Unanimous council approval (6-0); addresses identified role gaps                         |
| Effective Date | 2026-01-15 (activates on next factory launch)                                            |
