# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Terminal Primers

Copy a block to prime a new terminal. Each terminal tracks its own feature independently.

### Manager
```
You are the Manager terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.manager, queue: .queue | length}'

Skills: /prep, /wireframe-status, /commit, /ship
```

### Generator
```
You are the Generator terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.generator, queue: .queue}'

Skills: /wireframe-prep [feature], /wireframe [feature]
```

### Viewer
```
You are the Viewer terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.viewer}'

Skills: /hot-reload-viewer
```

### Reviewer
```
You are the Reviewer terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.reviewer, queue: .queue}'

Skills: /wireframe-screenshots, /wireframe-review
```

### Validator
```
You are the Validator terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.validator}'

Skills: python3 docs/design/wireframes/validate-wireframe.py --check-escalation
```

### Author
```
You are the Author terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.author}'

Skills: /session-summary, /changelog
Focus: Blog posts, social media, release notes, workflow documentation
```

### Tester
```
You are the Tester terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.tester}'

Skills: /test, /test-components, /test-a11y, /test-hooks
Focus: Run Vitest, Playwright, Pa11y. Report coverage gaps.
```

### Implementer
```
You are the Implementer terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.implementer, queue: .queue}'

Skills: /speckit.implement, /speckit.tasks
Focus: Convert specs + wireframes into actual code
```

### Auditor
```
You are the Auditor terminal.
cat docs/design/wireframes/.terminal-status.json | jq '{me: .terminals.auditor}'

Skills: /speckit.analyze, /read-spec
Focus: Verify consistency across artifacts. Flag drift.
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
| **Manager** | Coordinate workflow, update docs, create skills, handle side tasks | `CLAUDE.md`, skill files |
| **Validator** | Maintain `validate-wireframe.py`, add checks, manage `GENERAL_ISSUES.md` escalation | `validate-wireframe.py`, `GENERAL_ISSUES.md` |
| **Reviewer** | Analyze screenshots, document issues in `*.issues.md` files per SVG | `NNN-feature/*.issues.md` |
| **Generator** | Create SVGs using `/wireframe` skill, fix validation errors | `NNN-feature/*.svg` |
| **Viewer** | Run `/hot-reload-viewer`, enable screenshot capture | `index.html`, viewer assets |

### Workflow Sequence

```
                    ┌─────────────┐
                    │   Manager   │
                    │ coordinates │
                    │  docs/skills│
                    └──────┬──────┘
                           │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Generator  │────▶│   Viewer    │────▶│  Reviewer   │────▶│  Validator  │
│ /wireframe  │     │ /hot-reload │     │ screenshots │     │ escalation  │
│  creates    │     │  displays   │     │  documents  │     │  codifies   │
│    SVG      │     │    SVG      │     │   issues    │     │   checks    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                                                            │
      └────────────────────────────────────────────────────────────┘
                         (feedback loop)
```

### This Terminal's Role

**If you are the Manager terminal:**
- Focus: Coordination and documentation
- Update `CLAUDE.md` when workflow or tools change
- Create/update skills in `~/.claude/commands/`
- Handle side tasks without distracting other terminals
- Prime new terminals: "You are the [Role] terminal"
- Maintain `.terminal-status.json` queue and clear stale entries

**Status File:** `docs/design/wireframes/.terminal-status.json`
```bash
# View all terminal status
cat docs/design/wireframes/.terminal-status.json | jq .terminals

# View queue
cat docs/design/wireframes/.terminal-status.json | jq .queue
```

**If you are the Validator terminal:**
- Focus: `docs/design/wireframes/validate-wireframe.py`
- Add new `_check_*()` methods for recurring issues
- Maintain `GENERAL_ISSUES.md` with G-XXX entries
- Run `--check-escalation` to find patterns across features
- Update `/wireframe` skill rules when adding new checks
- Update `.terminal-status.json` with your current task

**If you are the Reviewer terminal:**
- Focus: `docs/design/wireframes/NNN-*/*.issues.md`
- Use `/wireframe-screenshots` to generate standardized screenshots
- Analyze quadrant images (overview + 5 corners per SVG)
- Document issues with classification (PATCH vs REGENERATE)
- Suggest which issues should escalate to GENERAL_ISSUES.md

**Reviewer Tools:**
```bash
# Screenshot commands
/wireframe-screenshots --all              # All features
/wireframe-screenshots --feature 002      # Single feature
/wireframe-screenshots --svg 002:01       # Single SVG

# Docker direct
docker compose run --rm review 002        # Screenshots + validation
```

**Screenshot output:** `docs/design/wireframes/png/[feature]/[svg-name]/`
- `overview.png` - Full canvas
- `quadrant-center.png` - Center region
- `quadrant-tl.png`, `quadrant-tr.png`, `quadrant-bl.png`, `quadrant-br.png` - Corners
- `manifest.json` - Paths + validator results

Update `.terminal-status.json` with your current task.

**If you are the Generator terminal:**
- Focus: Creating/fixing SVG wireframes
- Read `*.issues.md` before regenerating
- Run validator after generation, fix until PASS
- Never bypass validator errors
- Update `.terminal-status.json` with your current task

**If you are the Viewer terminal:**
- Focus: Running `/hot-reload-viewer`
- Keep viewer running for screenshot workflow
- Report any viewer bugs or rendering issues
- Update `.terminal-status.json` when starting/stopping viewer

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

1. Canvas: `viewBox="0 0 1920 1080" width="1920" height="1920"`
2. Desktop mockup: x=40, y=60, 1000×700
3. Mobile mockup: x=1120, y=60, 320×640
4. Minimum 4 callouts recommended (no max limit)
5. Light theme: panels `#e8d4b8`, NO `#ffffff`
6. Toggle colors: OFF=`#6b7280`, ON=`#22c55e`
7. Touch targets: 44px minimum
