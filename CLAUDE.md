# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Terminal Primers

Copy a block to prime a new terminal. Each primer auto-loads focused context via `/prep`.

### CTO
```
You are the CTO terminal.
/prep cto

Skills: Strategic oversight, technology decisions, cross-cutting concerns
Council: /rfc, /rfc-vote, /council, /broadcast
```

### Architect
```
You are the Architect terminal.
/prep architect

Skills: /speckit.plan, architectural reviews, dependency management
Council: /rfc, /rfc-vote, /council, /broadcast
```

### Coordinator
```
You are the Coordinator terminal.
/prep coordinator

Skills: /wireframe-status, /commit, /ship
```

### Security Lead
```
You are the Security Lead terminal.
/prep security

Skills: Security audits, OWASP compliance, vulnerability scanning
Council: /rfc, /rfc-vote, /council, /broadcast
```

### Toolsmith
```
You are the Toolsmith terminal.
/prep toolsmith

Skills: Edit skill files in ~/.claude/commands/ and .claude/commands/
Council: /rfc, /rfc-vote, /council, /broadcast
```

### DevOps
```
You are the DevOps terminal.
/prep devops

Skills: Docker configs, GitHub Actions, deployment pipelines
Council: /rfc, /rfc-vote, /council, /broadcast
```

### Product Owner
```
You are the Product Owner terminal.
/prep product-owner

Skills: User story validation, acceptance criteria, UX consistency
Council: /rfc, /rfc-vote, /council, /broadcast
```

### Planner
```
You are the Planner terminal.
/prep planner

Skills: /wireframe-plan [feature]
```

### Wireframe Generator 1
```
You are the Wireframe Generator-1 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]
```

### Wireframe Generator 2
```
You are the Wireframe Generator-2 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]
```

### Wireframe Generator 3
```
You are the Wireframe Generator-3 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]
```

### Preview Host
```
You are the Preview Host terminal.
/prep preview-host

Skills: /hot-reload-viewer
```

### Wireframe QA
```
You are the Wireframe QA terminal.
/prep wireframe-qa

Skills: /wireframe-screenshots, /wireframe-review
```

### Validator
```
You are the Validator terminal.
/prep validator

Skills: python3 docs/design/wireframes/validate-wireframe.py --check-escalation
```

### Inspector
```
You are the Inspector terminal.
/prep inspector

Skills: /wireframe-inspect, python3 docs/design/wireframes/inspect-wireframes.py
```

### Author
```
You are the Author terminal.
/prep author

Skills: /session-summary, /changelog
```

### Test Engineer
```
You are the Test Engineer terminal.
/prep test-engineer

Skills: /test, /test-components, /test-a11y, /test-hooks
```

### Developer
```
You are the Developer terminal.
/prep developer

Skills: /speckit.implement, /speckit.tasks
```

### Auditor
```
You are the Auditor terminal.
/prep auditor

Skills: /speckit.analyze, /read-spec
```

### QA Lead
```
You are the QA Lead terminal.
/prep qa-lead

Skills: Process compliance, acceptance criteria verification, UAT coordination
Reports to: Architect
```

### Technical Writer
```
You are the Technical Writer terminal.
/prep tech-writer

Skills: User documentation, API docs, tutorials, developer guides
Reports to: CTO
```

### Operator (External - runs OUTSIDE tmux)
```
You are the Operator terminal - the meta-orchestrator.

You run OUTSIDE the tmux session, managing 21 worker terminals INSIDE it.
You are the user's proxy, keeping the system productive.

## Lifecycle Commands

# 1. Launch workers (creates tmux session)
./scripts/tmux-session.sh --all
# Session runs detached after init, or Ctrl+b d to detach

# 2. Check status
./scripts/tmux-dispatch.sh --status

# 3. Dispatch work
./scripts/tmux-dispatch.sh --vote    # RFC votes to council
./scripts/tmux-dispatch.sh --tasks   # Audit items to owners
./scripts/tmux-dispatch.sh --queue   # Process wireframe queue

# 4. Monitor specific terminal
tmux capture-pane -t scripthammer:4 -p | tail -30  # Toolsmith

# 5. Check completion
grep -c '✅' docs/interoffice/audits/*.md

# 6. Attach to observe (Ctrl+b d to detach)
tmux attach -t scripthammer

# 7. Kill session when done
tmux kill-session -t scripthammer

## Responsibilities

1. Launch the tmux session with appropriate workers
2. Dispatch work using the dispatcher scripts
3. Monitor progress across all terminals
4. Re-dispatch to stuck/idle terminals
5. Escalate blockers to the user
6. Keep the system productive - no idle terminals
```

---

## Repository Purpose

ScriptHammer is a **planning template** for AI-assisted development. It contains 46 feature specifications and an interactive SVG wireframe viewer. No application code exists yet - this is spec-first planning.

## Current Focus

**Improving Wireframe Tooling** - Refining the `/wireframe` skill and Python validators.

### Wireframe Workflow

1. `/wireframe-prep NNN` - Primes context, reads spec, checks escalation candidates
2. `/wireframe NNN` - User runs manually (never include in plans)
3. Validator runs automatically, logs issues to `feature/*.issues.md`
4. Issues escalate to `GENERAL_ISSUES.md` when seen in 2+ features

### Issue Escalation Policy

- **Feature-specific first**: Issues go to `docs/design/wireframes/NNN-feature/*.issues.md`
- **Escalate after 2+ occurrences**: Run `--check-escalation` to find candidates
- **GENERAL_ISSUES.md**: Only recurring patterns across multiple features

```bash
# Check for escalation candidates
python docs/design/wireframes/validate-wireframe.py --check-escalation
```

### Key Files Being Improved

| File | Purpose |
|------|---------|
| `~/.claude/commands/wireframe.md` | Wireframe generation skill (v5) |
| `~/.claude/commands/wireframe-prep.md` | Context priming + escalation check |
| `~/.claude/commands/wireframe-screenshots.md` | Screenshot skill for Reviewer workflow |
| `docs/design/wireframes/validate-wireframe.py` | Automated SVG validation (v5.2) |
| `docs/design/wireframes/screenshot-wireframes.py` | Screenshot tool (6 images per SVG) |
| `docs/design/wireframes/GENERAL_ISSUES.md` | Recurring mistakes (escalated only) |
| `docs/design/wireframes/NNN-*/*.issues.md` | Feature-specific issues (auto-logged) |

### What NOT to Include in Plans

- SVG generation (`/wireframe` commands)
- Manual wireframe review steps
- Anything the user triggers themselves

## Multi-Terminal Workflow

This project uses multiple Claude Code terminals working as a team. Each terminal has a specialized role:

### Terminal Roles

| Terminal | Responsibility | Focus Files |
|----------|----------------|-------------|
| **CTO** | Strategic oversight, technology decisions, cross-cutting concerns | All specs, high-level project direction |
| **Architect** | System design, component patterns, dependency decisions | `constitution.md`, `IMPLEMENTATION_ORDER.md` |
| **Coordinator** | Coordinate workflow, update docs, queue management | `CLAUDE.md`, `.terminal-status.json` |
| **Security Lead** | Security review, OWASP compliance, vulnerability scanning | Security features, auth flows |
| **Toolsmith** | Maintain skill files, refactor tools, optimize validator | `~/.claude/commands/*.md`, `validate-wireframe.py` |
| **DevOps** | CI/CD, Docker configs, deployment pipelines, GitHub Actions | `docker-compose.yml`, `.github/workflows/` |
| **Product Owner** | User story validation, acceptance criteria, UX consistency | Feature specs, user requirements |
| **Planner** | Analyze spec, create SVG assignments, hand off to Wireframe Generators | `features/*/spec.md` |
| **Wireframe Generator 1/2/3** | Create SVGs using `/wireframe` skill, fix validation errors (3 parallel) | `NNN-feature/*.svg` |
| **Preview Host** | Run `/hot-reload-viewer`, enable screenshot capture | `index.html`, viewer assets |
| **Wireframe QA** | Analyze screenshots, document issues in `*.issues.md` files per SVG | `NNN-feature/*.issues.md` |
| **Validator** | Add `_check_*()` methods, manage `GENERAL_ISSUES.md` escalation | `validate-wireframe.py`, `GENERAL_ISSUES.md` |
| **Inspector** | Cross-SVG consistency checks, pattern enforcement | `inspect-wireframes.py`, `*.issues.md` |
| **Author** | Blog posts, social media, release notes, workflow documentation | `docs/*.md` |
| **Test Engineer** | Run Vitest, Playwright, Pa11y, report coverage gaps | `*.test.ts`, `*.spec.ts` |
| **Developer** | Convert specs + wireframes into actual code | `src/**/*.tsx` |
| **Auditor** | Verify consistency across artifacts, flag drift | `spec.md`, `plan.md`, `tasks.md` |
| **QA Lead** | Process compliance, acceptance criteria, UAT coordination | Test coverage, acceptance criteria |
| **Technical Writer** | User documentation, API docs, tutorials, developer guides | `docs/*.md`, API references |
| **Operator** | Meta-orchestrator: dispatch work, monitor progress, keep system productive | `scripts/tmux-dispatch.sh`, all windows |

### Workflow Sequence

Operator (external) dispatches work. CTO provides strategic oversight. Coordinator manages operational flow.

```
┌─────────────────────────────────────────────────────────────┐
│  OPERATOR (External - outside tmux)                         │
│  Launches session, dispatches work, monitors progress       │
└─────────────────────────────────────────────────────────────┘
                              │
                    manages via tmux send-keys
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  TMUX SESSION "scripthammer" (19 windows)                   │
│                                                             │
│                       ┌─────────────┐                       │
│                       │     CTO     │  ◄── Strategic        │
│                       │  strategy   │      oversight        │
│                       └──────┬──────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐           ┌─────────────┐
   │  Architect  │            │ Coordinator │           │Security Lead│
   │   design    │            │ orchestrate │           │   review    │
   └─────────────┘            └──────┬──────┘           └─────────────┘
                                     │
                              ┌──────┴──────┐
                              │             │
                              ▼             ▼
                       ┌─────────────┐ ┌─────────────┐
                       │  Toolsmith  │ │   DevOps    │
                       │ skills/tools│ │   CI/CD     │
                       └─────────────┘ └─────────────┘

--- Wireframe Production Pipeline (under Coordinator) ---

┌─────────┐
│ Planner │
│ assigns │
└────┬────┘
     │           ┌─────────────┐
     │      ┌───▶│WFGenerator-1│───┐
     │      │    └─────────────┘   │
     ├──────┼───▶│WFGenerator-2│───┼───▶PreviewHost──▶WireframeQA──▶ Validator ───▶ Inspector
     │      │    └─────────────┘   │                                                  │
     │      └───▶│WFGenerator-3│───┘                                                  │
     │           └─────────────┘                                                      │
     └────────────────────────────────────────────────────────────────────────────────┘
                                 (feedback loop)

--- Supporting Roles ---

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Author    │     │TestEngineer │     │  Developer  │     │ConsistAudit │
│   writes    │     │   tests     │     │    codes    │     │   audits    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐
│   QA Lead   │     │ Tech Writer │
│   quality   │     │    docs     │
└─────────────┘     └─────────────┘
```

### This Terminal's Role

**Status File:** `docs/design/wireframes/.terminal-status.json`
```bash
cat docs/design/wireframes/.terminal-status.json | jq .terminals  # View all
cat docs/design/wireframes/.terminal-status.json | jq .queue      # View queue
```

**PERSISTENCE RULE (ALL TERMINALS):**
Terminal output is ephemeral - lost when context clears. When you produce analysis, recommendations, or findings:
- **WRITE to file**: `docs/interoffice/audits/YYYY-MM-DD-[terminal]-[topic].md`
- **Or use**: `/log [summary]` for quick persistence
- **Never just print** - valuable work disappears

**NOTIFICATION RULE (ALL TERMINALS):**
When your findings have action items for another terminal:
1. Write audit to file (persistence)
2. Notify via `/log [summary] --notify [target]` (adds memo to their inbox)
3. Target sees memo on next `/prep`

For **urgent** items, ask Operator to dispatch via tmux for immediate notification.

**If you are the CTO terminal:**
- Focus: Strategic oversight and technology decisions
- Make high-level project direction decisions
- Technology stack choices and cross-cutting concerns
- Risk assessment and mitigation
- Cross-feature coordination and prioritization
- **WRITE findings to**: `docs/interoffice/audits/YYYY-MM-DD-cto-[topic].md`

**If you are the Architect terminal:**
- Focus: System design and component patterns
- Enforce 5-file component pattern
- Review technical approaches before implementation
- Manage feature dependencies in `IMPLEMENTATION_ORDER.md`
- Design data models and API contracts
- **WRITE audits to**: `docs/interoffice/audits/YYYY-MM-DD-architect-[topic].md`

**If you are the Coordinator terminal:**
- Focus: Coordination and documentation
- Update `CLAUDE.md` when workflow or tools change
- Prime new terminals: "You are the [Role] terminal"
- Maintain `.terminal-status.json` queue and clear stale entries
- Make escalation decisions for `GENERAL_ISSUES.md`

**If you are the Security Lead terminal:**
- Focus: Security review and compliance
- Security-focused code review
- OWASP Top 10 compliance checks
- Dependency vulnerability scanning
- Auth flow and secrets management review
- **WRITE audits to**: `docs/interoffice/audits/YYYY-MM-DD-security-[topic].md`

**If you are the Toolsmith terminal:**
- Focus: Skill files and tool maintenance
- Create/update skills in `~/.claude/commands/`
- Test and debug skill behavior
- Refactor large skill files (wireframe-review.md etc.)
- Optimize `validate-wireframe.py` (shared with Validator)
- Keep skills aligned with CLAUDE.md standards

**If you are the DevOps terminal:**
- Focus: CI/CD and deployment pipelines
- Maintain Docker configurations
- Set up GitHub Actions workflows
- Configure deployment to GitHub Pages
- Build optimization and caching

**If you are the Product Owner terminal:**
- Focus: User-facing requirements and experience
- Validate user stories align with feature specs
- Review acceptance criteria for completeness
- Ensure UX consistency across features
- Prioritize features from user perspective
- Bridge gap between technical architecture and user needs

**If you are the Planner terminal:**
- Focus: Analyzing specs and planning SVG assignments
- Read feature spec, identify screens needed
- Create SVG assignment list for Wireframe Generators
- Consider consolidation (multiple screens → single SVG)

**If you are a Wireframe Generator terminal (WireframeGenerator-1, WireframeGenerator-2, or WireframeGenerator-3):**
- Focus: Creating/fixing SVG wireframes assigned to YOUR generator number
- Read `*.issues.md` before regenerating
- Run validator after generation, fix until PASS
- Never bypass validator errors
- Check `.terminal-status.json` queue for items assigned to your generator number

**If you are the Preview Host terminal:**
- Focus: Running `/hot-reload-viewer`
- Keep viewer running for screenshot workflow
- Report any viewer bugs or rendering issues

**If you are the Wireframe QA terminal:**
- Focus: `docs/design/wireframes/NNN-*/*.issues.md`
- Use `/wireframe-screenshots` to generate standardized screenshots
- Analyze quadrant images (overview + 5 corners per SVG)
- Document issues with classification (PATCH vs REGENERATE)
- Suggest which issues should escalate to GENERAL_ISSUES.md

**If you are the Validator terminal:**
- Focus: `docs/design/wireframes/validate-wireframe.py`
- Add new `_check_*()` methods for recurring issues
- Maintain `GENERAL_ISSUES.md` with G-XXX entries
- Run `--check-escalation` to find patterns across features
- Update `/wireframe` skill rules when adding new checks

**If you are the Inspector terminal:**
- Focus: Cross-SVG consistency across all features
- Run `inspect-wireframes.py` to compare structural patterns
- Check headers, footers, navigation, signatures, titles for consistency
- Flag oddballs that deviate from majority patterns
- Log issues to per-SVG `*.issues.md` files with PATTERN_VIOLATION classification

**If you are the Author terminal:**
- Focus: Documentation and communication
- Write blog posts, release notes, workflow guides
- Create social media content
- Document lessons learned

**If you are the Test Engineer terminal:**
- Focus: Test execution and coverage
- Run Vitest, Playwright, Pa11y test suites
- Report coverage gaps and failing tests
- Suggest test improvements

**If you are the Developer terminal:**
- Focus: Converting specs + wireframes into code
- Use `/speckit.implement` to execute tasks
- Follow 5-file component pattern
- Ensure tests pass before marking complete

**If you are the Auditor terminal:**
- Focus: Cross-artifact consistency
- Use `/speckit.analyze` to check drift
- Flag inconsistencies between spec, plan, tasks
- Verify implementation matches wireframes
- **WRITE audits to**: `docs/interoffice/audits/YYYY-MM-DD-auditor-[topic].md`

**If you are the QA Lead terminal:**
- Focus: Process compliance and acceptance criteria
- Verify acceptance criteria before marking tasks complete
- Coordinate user acceptance testing
- Review test coverage gaps with Test Engineer terminal
- Reports to: Architect

**If you are the Technical Writer terminal:**
- Focus: User documentation and API references
- Create end-user documentation (distinct from Author's blog posts)
- Write API reference documentation
- Develop tutorials and getting-started guides
- Reports to: CTO

**If you are the Operator terminal (EXTERNAL - outside tmux):**
- You run in a separate terminal, managing the tmux session
- Launch workers: `./scripts/tmux-session.sh --all`
- Check status: `./scripts/tmux-dispatch.sh --status`
- Dispatch work: `./scripts/tmux-dispatch.sh --vote|--tasks|--queue`
- Monitor: `tmux capture-pane -t scripthammer:N -p | tail -30`
- Attach to observe: `tmux attach -t scripthammer` (Ctrl+b d to detach)
- Keep terminals productive - dispatch new work when idle
- Escalate blockers to the user

## Interoffice Communication System

Terminals communicate through a structured mixture-of-experts system with tiered access and consensus-based decision making.

### Terminal Tiers

**Council (RFC authors, voters):**
| Terminal | Domain |
|----------|--------|
| CTO | Strategy, priorities, risk |
| Architect | System design, patterns, tech stack |
| Security Lead | Auth, OWASP, compliance |
| Toolsmith | Skills, commands, automation |
| DevOps | CI/CD, Docker, deployment |
| Product Owner | User requirements, acceptance criteria, UX |

**Contributors (memo upward only):**
| Terminal | Reports To |
|----------|------------|
| Coordinator | CTO |
| Planner, WireframeQA, Inspector, Developer, QA Lead | Architect |
| WireframeGenerator 1/2/3, PreviewHost | Coordinator |
| Validator | Toolsmith |
| TestEngineer | DevOps |
| Author, Auditor, Technical Writer | CTO |

### Communication Channels

| Channel | Purpose | Access |
|---------|---------|--------|
| `/memo [to] [subject]` | Send message to manager | All terminals |
| `/rfc [title]` | Create formal proposal | Council only |
| `/rfc-vote [num] [vote]` | Cast vote on RFC | Council only |
| `/council [topic]` | Start informal discussion | Council only |
| `/broadcast [title]` | Announce to all terminals | Council only |

### Folder Structure

```
docs/interoffice/
├── memos/          # Contributor → Manager messages
├── rfcs/           # Formal proposals (Council debates)
├── decisions/      # Finalized decisions (DEC-XXX)
├── council/        # Informal discussion threads
└── broadcast/      # Announcements to all terminals
```

### RFC Workflow

```
draft → proposed → review → voting → decided
                              ↓
                          rejected
```

- **Consensus required**: All non-abstaining council members must approve
- **Dissent logged**: Reject votes are recorded even if overruled
- **Decision records**: Approved RFCs become DEC-XXX in `decisions/`

### Integration

- `/prep [terminal]` checks memos and broadcasts on startup
- `/next` shows pending RFCs requiring votes
- Topic routing maps questions to domain experts

See `docs/interoffice/CLAUDE.md` for full documentation.

## Commands

### Wireframe Viewer

```bash
cd docs/design/wireframes && npm run dev   # Start at localhost:3000
# OR via Docker:
docker compose up wireframe-viewer
```

### SpecKit Workflow

```bash
# Specification (complete for 46 features)
/speckit.specify        # Generate spec.md
/speckit.clarify        # Refine requirements
/wireframe              # Generate wireframes

# Implementation (blocked until wireframes done)
/speckit.plan           # Generate plan.md
/speckit.checklist      # Generate checklist.md
/speckit.tasks          # Generate tasks.md
/speckit.analyze        # Cross-artifact consistency
/speckit.implement      # Execute implementation
```

### Utility Commands

```bash
/hot-reload-viewer      # Start wireframe viewer
/wireframe-prep         # Load context before wireframe work
/commit                 # Lint + commit with message
/ship                   # Commit, merge to main, cleanup
```

## Project Structure

```
ScriptHammer/
├── features/                    # 46 feature specs (9 categories)
│   ├── foundation/             # 000-006: RLS, Auth, a11y, security
│   ├── core-features/          # 007-012: Messaging, blog, accounts
│   ├── auth-oauth/             # 013-016: OAuth improvements
│   ├── enhancements/           # 017-021: PWA, analytics, maps
│   ├── integrations/           # 022-026: Forms, payments
│   ├── polish/                 # 027-030: UX refinements
│   ├── testing/                # 031-037: Unit & E2E tests
│   ├── payments/               # 038-043: Payment features
│   └── code-quality/           # 044-045: Error handling
├── docs/design/wireframes/     # SVG wireframes + viewer
│   ├── includes/               # Reusable header/footer templates
│   ├── validate-wireframe.py   # Automated SVG validation
│   └── GENERAL_ISSUES.md       # Recurring mistakes catalog
└── .specify/                   # SpecKit configuration
    ├── memory/constitution.md  # Project principles
    └── templates/              # SpecKit templates
```

## Key Files

| File | Purpose |
|------|---------|
| `features/IMPLEMENTATION_ORDER.md` | 46-feature sequence with dependencies |
| `.specify/memory/constitution.md` | 6 core principles (Docker-first, TDD, etc.) |
| `.specify/memory/spec-inventory.md` | Feature mapping table |
| `docs/design/wireframes/GENERAL_ISSUES.md` | Recurring wireframe mistakes |

## Constitution Principles

1. **Component Structure** - 5-file pattern for all components
2. **Test-First** - TDD, 25%+ coverage minimum
3. **SpecKit Workflow** - Complete sequence, no skipped steps
4. **Docker-First** - No local package installs
5. **Progressive Enhancement** - PWA, a11y, mobile-first
6. **Privacy First** - GDPR, consent before tracking

## Technical Constraints

- **Static Export** - Deploys to GitHub Pages, no server-side API routes
- **Supabase** - All server logic via Edge Functions, RLS required
- **Secrets** - Supabase Vault only, never in client code

## Wireframe Viewer Shortcuts

| Key | Action |
|-----|--------|
| `←/→` | Previous/Next wireframe |
| `↑/↓` or `+/-` | Zoom in/out |
| `0` | Fit to view |
| `F` | Toggle focus mode |
| `L` | Toggle legend drawer |

## Implementation Order

Features must be implemented in dependency order, not numeric order. See `features/IMPLEMENTATION_ORDER.md` for the complete sequence. Key tiers:

1. **Foundation**: 000 (RLS), 003 (Auth), 007 (E2E), 006 (Template)
2. **Consent**: 005 (Security), 019 (Analytics Consent)
3. **Core Messaging**: 009 → 011 → 012 → 013 → 016
4. **Payments**: 024 → 042 → 038 → 039 → 040 → 041

## SVG Wireframe Rules

1. Canvas: `viewBox="0 0 1920 1080" width="1920" height="1080"`
2. Desktop mockup: x=40, y=60, 1280×720
3. Mobile mockup: x=1360, y=60, 360×720
4. Minimum 4 callouts recommended (no max limit)
5. Light theme: panels `#e8d4b8`, NO `#ffffff`
6. Toggle colors: OFF=`#6b7280`, ON=`#22c55e`
7. Touch targets: 44px minimum
8. Annotation titles: 16px bold, narrative: 14px regular
