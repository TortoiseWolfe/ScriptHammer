# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| `docs/design/wireframes/validate-wireframe.py` | Automated SVG validation (v5.0) |
| `docs/design/wireframes/GENERAL_ISSUES.md` | Recurring mistakes (escalated only) |
| `docs/design/wireframes/NNN-*/*.issues.md` | Feature-specific issues (auto-logged) |

### What NOT to Include in Plans

- SVG generation (`/wireframe` commands)
- Manual wireframe review steps
- Anything the user triggers themselves

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
