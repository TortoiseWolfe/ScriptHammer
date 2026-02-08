# CLAUDE.md - Interoffice Communication System

This folder enables structured communication between terminal roles using a mixture-of-experts model with tiered access and consensus-based decision making.

## Terminal Tiers

### Council (RFC Authors, Voters)

Council members can create RFCs, vote on decisions, and initiate council discussions.

| Terminal     | Domain Authority                                            |
| ------------ | ----------------------------------------------------------- |
| CTO          | Strategy, priorities, risk, cross-cutting concerns          |
| ProductOwner | User requirements, acceptance criteria                      |
| Architect    | System design, patterns, dependencies, tech stack           |
| UXDesigner   | User research, interaction design, design system governance |
| Toolsmith    | Skills, commands, automation                                |
| Security     | Auth, OWASP, secrets, compliance                            |
| DevOps       | CI/CD, Docker, deployment, infrastructure                   |

### Contributors (Memo Upward Only)

Contributors send memos to their manager. Cannot create RFCs directly.

| Terminal                 | Reports To   |
| ------------------------ | ------------ |
| BusinessAnalyst          | ProductOwner |
| UIDesigner               | Architect    |
| Planner                  | Architect    |
| WireframeGenerator 1/2/3 | Planner      |
| PreviewHost              | Planner      |
| WireframeQA              | Architect    |
| Validator                | Toolsmith    |
| Inspector                | Architect    |
| Developer                | Architect    |
| TestEngineer             | QALead       |
| QALead                   | Architect    |
| Auditor                  | CTO          |
| Author                   | CTO          |
| TechWriter               | CTO          |
| DockerCaptain            | DevOps       |
| ReleaseManager           | DevOps       |
| Coordinator              | CTO          |

## Folder Structure

```
docs/interoffice/
├── CLAUDE.md           # This file
├── rfcs/               # Request for Comments (Council only)
├── decisions/          # Finalized decisions (read-only reference)
├── memos/              # Contributor → Manager messages
├── council/            # Council discussion threads
└── broadcast/          # Announcements (Council → All)
```

## Topic Routing (MoE Gating)

Route topics to the appropriate expert:

| Topic Pattern                                    | Route To                             |
| ------------------------------------------------ | ------------------------------------ |
| Architecture, patterns, dependencies             | Architect                            |
| Security, auth, OWASP, secrets                   | Security Lead                        |
| Skills, commands, tooling                        | Toolsmith                            |
| CI/CD, Docker, deployment                        | DevOps                               |
| Strategic, prioritization, risk                  | CTO                                  |
| User requirements, acceptance criteria           | Product Owner                        |
| User research, interaction design, design system | UX Designer                          |
| Visual design, colors, typography                | UI Designer (via Architect)          |
| Requirements detail, stakeholder comms           | Business Analyst (via Product Owner) |
| Releases, versioning, changelog                  | Release Manager (via DevOps)         |

## RFC State Machine

```
draft ──────► proposed ──────► review ──────► voting ──────► decided
   │              │               │              │              │
   │              │               │              │              ▼
   │              │               │              │          DEC-XXX
   │              │               │              │
   │              │               │              └───► rejected
   │              │               │
   │              │               └───► proposed (if major changes)
   │              │
   │              └───► draft (author withdraws)
   │
   └───► (work in progress)
```

**State Transitions**:

- `draft → proposed`: Author submits for council review
- `proposed → review`: At least 2 council members have read
- `review → voting`: Discussion complete, ready for votes
- `voting → decided`: Consensus reached (all approve)
- `voting → rejected`: Any stakeholder votes reject

## Skills Reference

| Skill                       | Access  | Purpose                     |
| --------------------------- | ------- | --------------------------- |
| `/memo [to] [subject]`      | All     | Send message to manager     |
| `/rfc [title]`              | Council | Create RFC in draft state   |
| `/rfc-propose [number]`     | Council | Move RFC to proposed        |
| `/rfc-vote [number] [vote]` | Council | Cast approve/reject/abstain |
| `/council [topic]`          | Council | Start discussion thread     |
| `/broadcast [title]`        | Council | Announce to all terminals   |

## RFC Format

```markdown
# RFC-XXX: Title

**Status**: draft | proposed | review | voting | decided | rejected
**Author**: [Council Member]
**Created**: YYYY-MM-DD
**Target Decision**: YYYY-MM-DD

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date |
| ------------- | ------- | ---- |
| CTO           | pending | -    |
| Architect     | pending | -    |
| Security Lead | pending | -    |
| Toolsmith     | pending | -    |
| DevOps        | pending | -    |
| Product Owner | pending | -    |
| UX Designer   | pending | -    |

**Required**: All non-abstaining stakeholders must approve

## Summary

## Motivation

## Proposal

## Alternatives Considered

## Impact Assessment

## Discussion Thread

## Dissent Log

## Decision Record
```

## Memo Format

```markdown
## YYYY-MM-DD HH:MM - From: [Terminal]

**Priority**: normal | urgent | fyi
**Re**: Subject

Message body.

**Action Requested**: (if any)
```

## Decision Record Format

```markdown
# DEC-XXX: Title

**Date**: YYYY-MM-DD
**RFC**: RFC-XXX
**Status**: active | superseded-by-DEC-YYY

## Stakeholder Votes

## Decision

## Rationale

## Dissenting Views

## Impact

## Implementation
```

## Consensus Rules

1. All 7 council members are stakeholders on every RFC
2. A stakeholder may vote: `approve`, `reject`, or `abstain`
3. **Consensus** = all non-abstaining votes are `approve`
4. A single `reject` blocks the RFC
5. Rejected RFCs may be revised and resubmitted
6. Dissent is logged even if later overruled

## Escalation Path

1. Contributor encounters issue
2. Contributor sends memo to manager via `/memo`
3. Manager reviews and decides:
   - Handle directly
   - Discuss in `/council`
   - Escalate to `/rfc` for formal decision
4. Council debates and votes
5. Decision recorded in `decisions/DEC-XXX.md`
6. `/broadcast` announces outcome

## Integration with Existing Systems

- **`/prime [terminal]`**: Checks memos and broadcasts on startup
- **`/next`**: Shows pending RFCs requiring votes
- **`.terminal-status.json`**: Task queue (unchanged)
- **`GENERAL_ISSUES.md`**: Wireframe issues (unchanged)
