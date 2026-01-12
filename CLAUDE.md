# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Current Progress (2026-01-01)

### Completed
- [x] Analyzed all 46 feature specifications
- [x] Fixed 23 issues (P0, P1, P2, P3) directly in feature files
- [x] Created `features/IMPLEMENTATION_ORDER.md` - **REQUIRED READING**
- [x] Created `features/analysis/ANALYSIS_REPORT.md`
- [x] Created `features/analysis/ACTION_ITEMS.md` (all fixed)
- [x] Generated spec.md for all 46 features
- [x] Generated wireframes for 44 features (~120 SVGs) - 000, 001 DELETED pending regeneration

### Session Checkpoint (2026-01-11 - Wireframe v4)

**MAJOR CHANGE: Wireframe Standard v4 - Numbered Callouts**

v3 approach (FR/SC badges on UI elements) caused 157 validation errors per file.
v4 uses industry-standard numbered callouts for clean, readable wireframes.

| Include | Exclude |
|---------|---------|
| Desktop + Mobile UI mockups | FR/SC badges ON elements |
| Numbered callouts (①②③) on elements | Violet annotation containers |
| Annotation panel below mockups | User Stories section |
| FR/SC codes in [brackets] at end | 30-word legend definitions |

**Philosophy:** Wireframes preview the app. Callouts explain, not clutter.

**Key Files:**
- `~/.claude/commands/wireframe.md` - v4 skill (226 lines, down from 406)
- `~/.claude/commands/wireframe-v3-archived.md` - old approach (archived)
- `docs/design/wireframes/validate-wireframe.py` - automated validation
- `docs/design/wireframes/GENERAL_ISSUES.md` - issue catalog

**Workflow:**
1. Run `/wireframe NNN` - generates with numbered callouts
2. Run `python validate-wireframe.py [file.svg]` - must PASS
3. Fix any errors, re-validate until clean

**All Existing SVGs Need REGENERATION** (deleted 002, starting fresh)

---

### Phase 2 - Wireframe Generation (v4)

**Workflow:**
1. `/wireframe NNN` - generates SVG with numbered callouts
2. `python validate-wireframe.py [file.svg]` - automated validation
3. Fix errors, re-validate until PASS
4. Visual review in viewer at localhost:3000

**Validator Checks:**
- Color compliance (no #ffffff, correct toggle colors)
- SVG root attributes (width/height required for viewer)
- Badge collision detection
- Container boundary violations

**No manual issues files needed** - validator catches problems programmatically.

### SVG Wireframes - Hands Off

**NEVER edit, write, or plan changes to SVG files directly.**

SVGs are generated/regenerated ONLY by the `/wireframe` skill.

Your job:
- Document issues in `.issues.md` files
- Let the user run `/wireframe` when ready

### Later: Phase 3 - Plan & Implement

After wireframe review is complete for ALL features, run on each feature:

```bash
/speckit.plan       # Generate plan.md
/speckit.checklist  # Generate checklist.md
/speckit.tasks      # Generate tasks.md
/speckit.analyze    # Cross-artifact consistency check
/speckit.implement  # Execute implementation
```

### Key Files

| File | Purpose |
|------|---------|
| `features/IMPLEMENTATION_ORDER.md` | **46-feature sequence with dependencies** |
| `features/analysis/ANALYSIS_REPORT.md` | Category breakdowns, scores |
| `features/analysis/ACTION_ITEMS.md` | All 23 issues (fixed) |

### First Feature to Process

**000-rls-implementation**
- Location: `features/foundation/000-rls-implementation/000_rls-implementation_feature.md`
- Why first: All data access depends on RLS policies

---

## Progress Tracking System

Track progress across two files when running SpecKit workflow in other terminals.

### Tracking Files

| File | Purpose |
|------|---------|
| `README.md` | Implementation Commands (225 fenced code blocks) + Wireframe Commands |
| `features/analysis/SPECIFY_PROGRESS.md` | Detailed tracker with wireframe table + implementation table |

### Implementation Phase Styling (README.md)

| Phase | Command | Starting Style | Completed Style |
|-------|---------|----------------|-----------------|
| 1. Plan | `/speckit.plan` | 🔵 **Bold** | 🟡 *Italic* |
| 2. Checklist | `/speckit.checklist` | 🔵 **Bold** | 🟠 `Code` |
| 3. Tasks | `/speckit.tasks` | 🔵 **Bold** | 🟣 Plain |
| 4. Analyze | `/speckit.analyze` | 🔵 **Bold** | ✅ ~~Strike~~ |
| 5. Implement | `/speckit.implement` | 🔵 **Bold** | ✅ ~~Strike~~ |

Progress line: `**Progress:** 🔵 **46** / 🟡 *0* / 🟠 \`0\` / 🟣 0 / ✅ ~~0~~`

### On-Demand Progress Check

Run these commands only when you want to see what changed:

```bash
# Check for new plan.md files (phase 1 complete)
find features -name "plan.md" -newer README.md

# Check for new checklist/tasks files
find features -name "checklist.md" -newer README.md
find features -name "tasks.md" -newer README.md

# Check for new wireframes
find docs/design/wireframes -name "*.svg" -newer README.md
```

### When Updating After Changes

1. **README.md**: Change command styling + update progress counter
2. **SPECIFY_PROGRESS.md**: Update Implementation Progress table (⬜→✅)

Both files should stay in sync for implementation phases.

### Current State (2026-01-09)

| Metric | Value |
|--------|-------|
| spec.md complete | 46/46 |
| Wireframes generated | 46/46 features (~125 SVGs) |
| 000-rls-implementation | 2 SVGs (draft, need review) |
| 001-wcag-aa-compliance | 3 SVGs (draft, label proximity fixed) |
| 002-045 | ~120 SVGs (not reviewed) |
| Wireframes reviewed | 0/46 |
| Implementation phase | Blocked until wireframe review complete |

---

## Repository Purpose

This is a **planning template** for projects using the SpecKit workflow. It contains:
- Feature specifications
- SVG wireframes with interactive viewer
- Project constitution template

## Constitution

This project follows the **ScriptHammer Constitution v1.0.0**. All development must comply with the 6 core principles:

1. **Component Structure Compliance** - 5-file pattern required for all components
2. **Test-First Development** - TDD mandatory, 25%+ coverage minimum
3. **PRP Methodology** - SpecKit workflow for all features
4. **Docker-First Development** - No local package installs, all commands via Docker
5. **Progressive Enhancement** - PWA, accessibility, performance as first-class
6. **Privacy & Compliance First** - GDPR, consent required before any tracking

See `.specify/memory/constitution.md` for full details including:
- Technical Standards (Next.js 15+, Supabase, static export constraints)
- Supabase Patterns (monolithic migrations, RLS, Edge Functions)
- Quality Gates (build, test, performance, accessibility)
- Governance (amendment procedures, compliance verification)

## Feature Inventory

This project has **46 feature specifications** organized into 9 categories.
See `.specify/memory/spec-inventory.md` for the complete mapping table.

### Category Structure
```
features/
├── foundation/       (000-006) RLS, Auth, a11y, security, template
├── core-features/    (007-012) Messaging, blog, accounts
├── auth-oauth/       (013-016) OAuth UX improvements
├── enhancements/     (017-021) PWA, analytics, maps
├── integrations/     (022-026) Forms, payments, sidebar
├── polish/           (027-030) UX refinements
├── testing/          (031-037) Unit & E2E tests
├── payments/         (038-043) Payment features
└── code-quality/     (044-045) Error handling, themes
```

### File Naming Convention

**Feature files** (input): `[number]_[name]_feature.md`
**Spec files** (SpecKit output): `spec.md`

```
features/foundation/001-wcag-aa-compliance/
├── 001_wcag-aa-compliance_feature.md   # migrated/authored content
└── spec.md                              # generated by /speckit.specify
```

Feature files contain requirements migrated from v_001 or authored for new features.
SpecKit generates `spec.md` from feature descriptions during `/speckit.specify`.

### Migration Source
Features migrated from `ScriptHammer_v_001`:
- `/docs/specs/` - 24 feature specs
- `/specs/` - 8 feature branch specs
- README.md backlog - 13 planned features (SPEC-049-064)

### Using Features
```bash
# View feature inventory
cat .specify/memory/spec-inventory.md

# Migrate a feature (example: 001-wcag-aa-compliance)
# 1. Read from v_001: docs/specs/004-wcag-aa-compliance/spec.md
# 2. Adapt for new project
# 3. Write to: features/foundation/001-wcag-aa-compliance/001_wcag-aa-compliance_feature.md
```

## Commands

### Wireframe Viewer Development

```bash
cd docs/design/wireframes && docker compose up   # Start dev server at localhost:3000
```

For browser testing, use MCP Docker Playwright tools (see "Browser Testing with MCP Toolkit" below).

### SpecKit Workflow

```bash
# Phase 1: Specification (COMPLETE)
/speckit.constitution   # Define project vision
/speckit.specify        # Create feature specs
/speckit.clarify        # Refine requirements
/wireframe              # Generate SVG wireframes (1920x1080)

# Phase 2: Wireframe Review (CURRENT)
/wireframe-review       # Review SVGs with 🟢/🔴 classification (4 phases + half-view inspection)
/wireframe              # Smart: patches 🟢, regenerates 🔴, skips ✅

# Phase 3: Implementation (BLOCKED until review complete)
/speckit.plan           # Design implementation
/speckit.checklist      # Generate implementation checklist
/speckit.tasks          # Generate task list
/speckit.taskstoissues  # Convert tasks to GitHub issues
/speckit.analyze        # Review spec quality
/speckit.implement      # Execute implementation plan
```

### Wireframe Viewer Commands

```bash
/hot-reload-viewer      # Start wireframe viewer at localhost:3000
```

**Note**: PNG generation is now integrated into `/wireframe-review`. Screenshots are captured during review and saved to `docs/design/wireframes/png/[feature]/` for reuse in tutorials and marketing.

## Browser Testing with MCP Toolkit

Use the MCP Docker Playwright tools for browser testing (not local Playwright):
- `mcp__MCP_DOCKER__browser_navigate` - Navigate to URL (use `host.docker.internal` for localhost)
- `mcp__MCP_DOCKER__browser_snapshot` - Get page accessibility tree
- `mcp__MCP_DOCKER__browser_take_screenshot` - Capture screenshots
- `mcp__MCP_DOCKER__browser_click` - Click elements
- `mcp__MCP_DOCKER__browser_press_key` - Simulate keyboard input

Example: To test the wireframe viewer running on localhost:3000:
```
mcp__MCP_DOCKER__browser_navigate url="http://host.docker.internal:3000"
```

## Wireframe Viewer Keyboard Shortcuts

### Navigation Hierarchy

| Level | Shortcut | Action |
|-------|----------|--------|
| Category | `⇧F1-F9` | Jump to category (Foundation, Core, Auth, etc.) |
| Feature | `^1-7` | Jump to feature N within current category |
| Spec | `1-9` | Jump to spec N within current feature |

### Other Shortcuts

| Shortcut | Action |
|----------|--------|
| `L` | Toggle legend drawer |
| `F` | Toggle focus mode (hide UI) |
| `Escape` | Exit focus mode or close legend |
| `←/→` | Previous/Next wireframe |
| `↑/↓` | Zoom in/out |
| `+/-` | Zoom in/out |
| `0` | Fit to view (dynamic) |

## Generating Wireframes (v4 - Numbered Callouts)

**Philosophy:** Wireframes preview the app. Callouts explain, not clutter.

### What Wireframes Show

| Include | Exclude |
|---------|---------|
| Desktop + Mobile UI mockups | FR/SC badges ON elements |
| Numbered callouts (①②③) | Violet annotation containers |
| Annotation panel below | User Stories section |
| FR/SC codes in [brackets] | 30-word legend definitions |

### 10 Rules

| # | Rule |
|---|------|
| 1 | Canvas: `viewBox="0 0 1920 1080" width="1920" height="1080"` |
| 2 | Desktop mockup: x=40, y=60, 1000×700 |
| 3 | Mobile mockup: x=1120, y=60, 320×640 |
| 4 | Callouts: red circles (①②③) on non-obvious elements only |
| 5 | Max 6-8 callouts per page |
| 6 | Annotation panel: y=780, spans full width |
| 7 | FR/SC codes in [brackets] at end of each annotation |
| 8 | Light theme: panels #e8d4b8, NO #ffffff |
| 9 | Toggle colors: OFF=#6b7280, ON=#22c55e |
| 10 | Touch targets: 44px minimum |

### Pre-Flight (Required Before SVG Generation)

```
SCREENS TO SHOW:
- Desktop: [description]
- Mobile: [description]

CALLOUTS (max 8):
① [element] - [what it does] [FR/SC codes]
② [element] - [what it does] [FR/SC codes]
③ ...

BLOCKING CHECKS:
[ ] Max 8 callouts
[ ] No FR/SC badges on UI elements
[ ] Annotation panel fits (60px per callout)
```

**User must confirm pre-flight before SVG generation.**

### Validation

After generating, run:
```bash
python docs/design/wireframes/validate-wireframe.py [file.svg]
```
Must PASS before done.

## Implementation Options

When ready to build:

**Option A**: Fork [ScriptHammer.com](https://scripthammer.com) - Next.js 15, React 19, Supabase, Tailwind

**Option B**: Stay in ScriptHammer - use `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`
