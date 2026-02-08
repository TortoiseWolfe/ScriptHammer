# RFC-009: External Client Onboarding Process

**Status**: draft
**Author**: Operator
**Created**: 2026-01-16
**Target Decision**: 2026-01-17

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date |
| ------------- | ------- | ---- |
| CTO           | pending | -    |
| ProductOwner  | pending | -    |
| Architect     | pending | -    |
| UXDesigner    | pending | -    |
| Toolsmith     | pending | -    |
| Security Lead | pending | -    |
| DevOps        | pending | -    |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

Establish a formal process for how the ScriptHammer assembly line takes on external client projects while maintaining internal work. This includes:

1. A new **Client Liaison** role type for managing client-specific sessions
2. Separate tmux sessions per client (e.g., `stw` for SpokeToWork)
3. Clear boundaries between internal and external work
4. Standard onboarding checklist for new clients

## Motivation

SpokeToWork is our first external client with:

- 3 active repos (MVP specs, production app, business development)
- 5 feature specs ready for implementation
- 17 wireframes needing review
- 11 pitch deck slides (5 missing)
- Key deadline: 3686 Pitch Competition - Aug 15, 2026

We need a process that:

- Keeps internal ScriptHammer work separate from client deliverables
- Allows parallel work on multiple projects
- Maintains ScriptHammer quality standards for client output
- Scales to future clients

## Proposal

### 1. Client Liaison Role

A **Client Liaison** is a specialized Operator that manages a single client project.

| Attribute   | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Tier        | Operator (runs outside tmux)                                 |
| Reports To  | Main Operator / CTO                                          |
| Authority   | Manages client session, dispatches work, escalates decisions |
| Restriction | Cannot modify ScriptHammer terminals, cannot push            |

**Naming Convention**: `{ClientCode}-Liaison` (e.g., `StW-Liaison`)

First implementation: `StW-Liaison` for SpokeToWork (role file: `.claude/roles/stw-liaison.md`)

### 2. Session Isolation

Each client gets a separate tmux session:

```
tmux sessions:
├── scripthammer    # 26 terminals (Main Operator)
└── stw             # 9 terminals (StW-Liaison)
    ├── UIDesigner
    ├── UXDesigner
    ├── Planner
    ├── Generator1/2/3
    ├── Validator
    ├── Inspector
    └── Coordinator
```

**Benefits**:

- Clean context separation
- Client work doesn't pollute internal queue
- Easy to monitor per-client progress
- Clients can have different terminal configurations

**Implementation**: `scripts/client-session.sh --client <code> --all`

### 3. File Isolation

| Type         | Internal                                       | Per-Client                                  |
| ------------ | ---------------------------------------------- | ------------------------------------------- |
| Queue        | `docs/design/wireframes/.terminal-status.json` | `{client-repo}/.terminal-status.json`       |
| Memos        | `docs/interoffice/memos/*.md`                  | `docs/interoffice/memos/{client-code}-*.md` |
| Role context | `.claude/roles/*.md`                           | `.claude/roles/{client-code}-liaison.md`    |

### 4. Client Data Protection

Client personal data (founder name, contact info) stored in `.env`, referenced by env vars:

```bash
# .env.example
STW_FOUNDER_NAME=
STW_FOUNDER_LOCATION=
STW_FOUNDER_PHONE=
STW_FOUNDER_EMAIL=
```

Role files reference `$STW_FOUNDER_NAME` instead of hardcoding.

### 5. Onboarding Checklist

Standard process for new clients:

1. [ ] **Assessment** - Evaluate client repos (specs, wireframes, code)
2. [ ] **Environment** - Add client vars to `.env.example`, populate `.env`
3. [ ] **Role File** - Create `.claude/roles/{code}-liaison.md`
4. [ ] **Council Approval** - Draft memo, get Council sign-off
5. [ ] **Session Launch** - Create tmux session via `client-session.sh`
6. [ ] **Prime Terminals** - Load context into all client terminals
7. [ ] **Begin Work** - Start parallel workstreams

### 6. Visibility Rules

| Entity         | Cross-Project Visibility           |
| -------------- | ---------------------------------- |
| Council        | All projects (for decision-making) |
| Main Operator  | All sessions                       |
| Client Liaison | Only their client session          |
| Contributors   | Only their assigned project        |

### 7. First Client: SpokeToWork

| Item        | Value                           |
| ----------- | ------------------------------- |
| Code        | `StW`                           |
| Session     | `stw`                           |
| Liaison     | StW-Liaison                     |
| Workstreams | Pitch deck SVGs, App wireframes |
| Deadline    | 3686 Pitch - Aug 15, 2026       |

### 8. Order of Operations

```
1. Launch stw tmux session
   └── ./scripts/client-session.sh --client stw --all

2. Present RFC-009 to Council (in scripthammer session)
   └── Council terminals can now review client context

3. Council votes on onboarding process

4. Begin parallel workstreams
   └── Stream A: Pitch deck SVGs
   └── Stream B: App wireframes
```

**Rationale**: Council needs the `stw` session running to review client context and make informed decisions. Launch first, then present for approval.

## Alternatives Considered

### Alternative A: Single Session with Namespacing

Keep all work in `scripthammer` session with client prefixes on window names.

**Rejected because**:

- Clutters the 26-terminal session
- Context bleed between projects
- Harder to monitor per-client

### Alternative B: Full Fork per Client

Fork ScriptHammer for each client project.

**Rejected because**:

- Duplicates methodology files
- Loses shared learnings
- Maintenance burden

### Alternative C: No Formal Process

Handle client projects ad-hoc.

**Rejected because**:

- Inconsistent quality
- Hard to onboard new team members
- No institutional knowledge

## Impact Assessment

| Area          | Impact                | Mitigation                                |
| ------------- | --------------------- | ----------------------------------------- |
| Codebase      | New role file, script | Contained to `.claude/roles/`, `scripts/` |
| Workflow      | Parallel sessions     | Clear Liaison ownership                   |
| Documentation | Update CLAUDE.md      | Done in this implementation               |
| Security      | Client data exposure  | Env vars, `.gitignore`                    |

## Discussion Thread

### Operator 2026-01-16 - Initial Proposal

SpokeToWork is ready for the assembly line. We need a clean way to onboard them without disrupting ScriptHammer internal work.

**Questions for Council**:

1. **CTO**: Is the Client Liaison role authority level correct? Should they have RFC creation rights for client-specific decisions?

2. **Architect**: Any concerns about the session isolation approach? Should client sessions use a subset of ScriptHammer terminals or completely independent configurations?

3. **Security**: Are the client data protection measures sufficient? Should we add encryption for client contact info?

4. **Toolsmith**: The `client-session.sh` script is ready. Any improvements needed before production use?

5. **DevOps**: Should client sessions have their own CI/CD triggers, or share ScriptHammer's?

6. **ProductOwner**: How do we handle client requirements that conflict with ScriptHammer standards?

7. **UXDesigner**: Client wireframes should meet our quality bar. How do we enforce this without blocking client deadlines?

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: -
**Outcome**: -
**Decision ID**: -
