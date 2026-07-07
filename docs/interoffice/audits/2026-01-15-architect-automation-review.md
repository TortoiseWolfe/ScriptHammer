# Architect Audit: Automation Review

**Date**: 2026-01-15
**Author**: Architect
**Scope**: Token-burning AI operations that could be deterministic scripts
**Related**: [2026-01-15-toolsmith-script-opportunities.md](./2026-01-15-toolsmith-script-opportunities.md)

## Executive Summary

Reviewed `scripts/*.sh`, `docs/design/wireframes/*.py`, and `~/.claude/commands/*.md` for **architectural anti-patterns** where AI terminals perform deterministic operations that waste tokens. Identified **12 cross-cutting concerns** where centralized scripts would reduce token usage by an estimated 40-60% for multi-terminal workflows.

**Key Finding**: The multi-terminal architecture (26 terminals) amplifies token waste. A 500-token operation repeated by 7 council terminals costs 3,500 tokens. Scripts eliminate this multiplication factor.

---

## Already Scripted (Good Patterns)

| Script                        | Pattern                      | Tokens Saved |
| ----------------------------- | ---------------------------- | ------------ |
| `terminal-router.py`          | Role-specific dispatch logic | ~1,500/call  |
| `queue_manager.py`            | Queue CRUD operations        | ~800/call    |
| `validate-wireframe.py`       | SVG validation rules         | ~2,000/call  |
| `inspect-wireframes.py`       | Cross-SVG consistency        | ~1,200/call  |
| `wireframe-status-manager.py` | Status JSON operations       | ~600/call    |

These demonstrate the correct pattern: **script handles deterministic work, AI handles semantic interpretation**.

---

## Cross-Cutting Concerns

### 1. RFC Vote Aggregation → `rfc-consensus.py`

**Problem**: `tmux-dispatch.sh --vote` sends prompts to 7 council terminals asking each to:

- Read RFC files
- Parse vote tables
- Determine pending votes
- Cast votes

**Token Cost**: ~2,500 tokens × 7 terminals = **17,500 tokens** per vote cycle

**Script Opportunity**:

```bash
python rfc-consensus.py --pending           # List RFCs needing votes
python rfc-consensus.py 006 --tally         # Count votes for RFC-006
python rfc-consensus.py 006 --cast CTO approve  # Record vote
python rfc-consensus.py 006 --check         # Check if consensus reached
```

**Architectural Benefit**:

- Single source of truth for vote state
- Automatic consensus detection
- Atomic vote recording (no race conditions)
- DEC-XXX file auto-generation on consensus

**Estimated Effort**: 3-4 hours

---

### 2. Dependency Graph Resolution → `dependency-graph.py`

**Problem**: Multiple skills (`/speckit.plan`, `/speckit.tasks`, `/speckit.implement`) independently parse `IMPLEMENTATION_ORDER.md` to determine feature dependencies.

**Token Cost**: ~800 tokens per parse × ~20 calls/day = **16,000 tokens/day**

**Script Opportunity**:

```bash
python dependency-graph.py                  # Full graph visualization
python dependency-graph.py 003-auth --deps  # What 003 depends on
python dependency-graph.py 003-auth --blocks # What 003 blocks
python dependency-graph.py --next           # Next implementable feature
python dependency-graph.py --json           # Machine-readable for CI
```

**Data Structure**:

```python
GRAPH = {
    "000-rls": {"deps": [], "blocks": ["003-auth", "005-security"]},
    "003-auth": {"deps": ["000-rls"], "blocks": ["005-security"]},
    # ...
}
```

**Architectural Benefit**:

- Consistent dependency resolution
- Eliminates re-parsing markdown
- Enables topological sort for optimal ordering
- CI can validate dependency declarations

**Estimated Effort**: 2-3 hours

---

### 3. Feature Context Loading → `feature-context.py`

**Problem**: `/wireframe-prep`, `/speckit.plan`, `/wireframe-plan` all independently:

- Find feature folder by number/name
- Read spec.md
- Extract user stories
- Parse acceptance criteria
- Check wireframe status

**Token Cost**: ~1,200 tokens per load × multiple skills = **high duplication**

**Script Opportunity**:

```bash
python feature-context.py 003              # Load feature context as JSON
python feature-context.py 003 --spec       # Just spec.md parsed
python feature-context.py 003 --stories    # Just user stories
python feature-context.py 003 --wireframes # Wireframe status
python feature-context.py 003 --full       # Everything combined
```

**Output Schema**:

```json
{
  "feature_id": "003",
  "feature_name": "003-user-authentication",
  "spec": {
    "overview": "...",
    "functional_requirements": ["FR-001", "FR-002"],
    "user_stories": [{"id": "US-001", "priority": "P0", "criteria": [...]}]
  },
  "wireframes": {
    "count": 3,
    "status": "inspecting",
    "svgs": ["01-login-flow.svg", "02-registration.svg", "03-password-reset.svg"]
  },
  "dependencies": ["000-rls"]
}
```

**Architectural Benefit**:

- Single parse per feature per session
- Consistent data model across skills
- Enables feature context caching
- Reduces spec.md read operations

**Estimated Effort**: 4-5 hours

---

### 4. Terminal Dispatch Pre-computation → `dispatch-precompute.py`

**Problem**: `tmux-dispatch.sh --tasks` sends 500+ character prompts to terminals asking them to:

- Read audit files
- Extract action items
- Determine role assignments
- Build task instructions

**Token Cost**: ~2,000 tokens per terminal × 20+ terminals = **40,000+ tokens** per dispatch

**Script Opportunity**:

```bash
python dispatch-precompute.py --audit 2026-01-15  # Parse audit for tasks
python dispatch-precompute.py --for toolsmith     # Tasks for specific role
python dispatch-precompute.py --ready             # Terminals ready for work
python dispatch-precompute.py --blocked           # Terminals waiting on deps
```

**Architectural Benefit**:

- Dispatch prompt reduced to "Execute task X" (50 tokens vs 500)
- Task assignment is deterministic from audit
- Eliminates AI parsing of audit files
- Enables task tracking across sessions

**Estimated Effort**: 3-4 hours

---

### 5. Constitution Compliance Check → `constitution-check.py`

**Problem**: `/speckit.analyze` and auditor workflows read `constitution.md` and manually check principle compliance.

**Token Cost**: ~800 tokens per constitution load + ~500 tokens per check

**Script Opportunity**:

```bash
python constitution-check.py spec.md        # Check spec against constitution
python constitution-check.py plan.md        # Check plan
python constitution-check.py --principle I  # Check specific principle
python constitution-check.py --json         # Machine-readable output
```

**Checkable Principles**:
| Principle | Script Check |
|-----------|--------------|
| I. Component Structure | Regex for 5-file pattern |
| II. Test-First | Check test file exists before implementation |
| IV. Docker-First | Check for local install commands |
| VI. Privacy | Check for tracking code without consent |

**Architectural Benefit**:

- Consistent compliance interpretation
- Pre-commit hook integration
- CI/CD enforcement
- Auditor workflow acceleration

**Estimated Effort**: 3-4 hours

---

### 6. SVG Structural Fixes → `svg-autofix.py`

**Problem**: Inspector/Validator find issues like "title x=700, expected x=960" that have deterministic fixes. Currently AI regenerates entire SVG.

**Token Cost**: ~5,000 tokens per SVG regeneration

**Script Opportunity**:

```bash
python svg-autofix.py 003-auth/01-login.svg  # Auto-fix structural issues
python svg-autofix.py --all --dry-run        # Preview all fixes
python svg-autofix.py --all --apply          # Apply all fixes
python svg-autofix.py --check                # Report fixable vs regen-needed
```

**Auto-fixable Issues**:
| Issue | Fix |
|-------|-----|
| Title position wrong | Adjust x/y attributes |
| Signature not bold | Add `font-weight="bold"` |
| Wrong panel color | Replace `#ffffff` with `#e8d4b8` |
| Missing header include | Insert `<use>` element |
| Touch target too small | Scale element |

**Architectural Benefit**:

- 80% of inspector issues are structural
- Eliminates regeneration token cost
- Consistent fix application
- Faster pipeline throughput

**Estimated Effort**: 5-6 hours (high value)

---

### 7. Spec Inventory Builder → `build-inventory.py`

**Problem**: `/refresh-inventories` uses AI to parse all 46 feature specs and build inventory tables.

**Token Cost**: ~15,000 tokens for full inventory refresh

**Script Opportunity**:

```bash
python build-inventory.py                    # Rebuild all inventories
python build-inventory.py --features         # feature-index.md only
python build-inventory.py --skills           # skill-index.md only
python build-inventory.py --diff             # Show changes only
```

**Architectural Benefit**:

- Deterministic inventory generation
- CI can validate inventory freshness
- Fork experience improved (instant refresh)
- Eliminates AI parsing of markdown

**Estimated Effort**: 4-5 hours

---

### 8. Audit Template Generator → `audit-template.py`

**Problem**: Each terminal writes audit files with slightly different formats. AI spends tokens figuring out structure.

**Script Opportunity**:

```bash
python audit-template.py toolsmith skills    # Generate template
python audit-template.py architect deps      # Architecture audit template
python audit-template.py --list              # Available templates
```

**Architectural Benefit**:

- Consistent audit format
- Reduces AI formatting overhead
- Enables audit aggregation scripts
- Searchable audit corpus

**Estimated Effort**: 1-2 hours

---

## Data Flow Anti-Patterns

### Pattern A: JSON Read-Modify-Write

**Problem**: Multiple skills read `.terminal-status.json`, make changes, write back. Race conditions possible.

**Current Flow**:

```
Terminal 1: Read JSON → Modify → Write
Terminal 2:      Read JSON → Modify → Write (overwrites T1 changes)
```

**Solution**: `queue_manager.py` already handles this - ensure ALL queue operations use it.

**Action**: Audit skills for direct JSON writes; migrate to `queue_manager.py` calls.

---

### Pattern B: Repeated Context Loading

**Problem**: Same feature context loaded multiple times per session.

**Current Flow**:

```
/wireframe-prep → loads spec.md (~1,200 tokens)
/wireframe      → loads spec.md again (~1,200 tokens)
/wireframe-review → loads spec.md again (~1,200 tokens)
```

**Solution**: `feature-context.py` with session caching.

**Proposed Flow**:

```
python feature-context.py 003 > /tmp/003-context.json
# All subsequent skills read from cached JSON
```

---

### Pattern C: Multi-Terminal Broadcast Duplication

**Problem**: `tmux-dispatch.sh` sends identical prompts to multiple terminals.

**Current Flow**:

```
CTO:       "Read audit X, find your tasks" → AI parses audit
Architect: "Read audit X, find your tasks" → AI parses audit (same)
Security:  "Read audit X, find your tasks" → AI parses audit (same)
```

**Solution**: Pre-compute task assignments:

```bash
python dispatch-precompute.py --audit 2026-01-15 > /tmp/task-assignments.json
# Dispatch sends: "Your task: [specific task from JSON]"
```

---

## Implementation Priority

| Priority | Script                   | Token Savings    | Effort | Impact                |
| -------- | ------------------------ | ---------------- | ------ | --------------------- |
| 1        | `svg-autofix.py`         | ~40,000/day      | 5-6h   | Pipeline throughput   |
| 2        | `rfc-consensus.py`       | ~17,500/cycle    | 3-4h   | Council efficiency    |
| 3        | `feature-context.py`     | ~10,000/day      | 4-5h   | Cross-skill sharing   |
| 4        | `dependency-graph.py`    | ~16,000/day      | 2-3h   | Planning accuracy     |
| 5        | `dispatch-precompute.py` | ~40,000/dispatch | 3-4h   | Dispatch efficiency   |
| 6        | `constitution-check.py`  | ~5,000/day       | 3-4h   | Compliance automation |
| 7        | `build-inventory.py`     | ~15,000/refresh  | 4-5h   | Fork experience       |
| 8        | `audit-template.py`      | ~2,000/day       | 1-2h   | Consistency           |

**Total Estimated Effort**: 26-33 hours
**Estimated Daily Token Savings**: 80,000-120,000 tokens

---

## Recommended Architecture

### Script Layer Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                     AI Skills (Semantic)                     │
│  /clarify, /specify, /plan, /wireframe, /code-review, etc.   │
├──────────────────────────────────────────────────────────────┤
│                   Context Scripts (Parsing)                  │
│  feature-context.py, dependency-graph.py, build-inventory.py │
├──────────────────────────────────────────────────────────────┤
│                   Operation Scripts (CRUD)                   │
│  queue_manager.py, rfc-consensus.py, wireframe-status.py     │
├──────────────────────────────────────────────────────────────┤
│                  Validation Scripts (Checks)                 │
│  validate-wireframe.py, inspect-wireframes.py, svg-autofix.py│
├──────────────────────────────────────────────────────────────┤
│                    Dispatch Scripts (Orchestration)          │
│  terminal-router.py, dispatch-precompute.py, tmux-dispatch.sh│
└──────────────────────────────────────────────────────────────┘
```

### Data Flow Principle

**Rule**: Data flows DOWN through script layers, semantic interpretation flows UP.

```
Scripts: Parse raw data → Structured JSON
    ↓
AI: Receives JSON → Makes semantic decisions → Returns instructions
    ↓
Scripts: Execute instructions deterministically
```

---

## Comparison with Toolsmith Audit

| Toolsmith Focus               | Architect Focus               |
| ----------------------------- | ----------------------------- |
| Individual skill optimization | Cross-cutting concerns        |
| Prompt-to-script conversion   | Data flow patterns            |
| Single-terminal savings       | Multi-terminal multiplication |
| Deterministic operations      | Architectural layering        |

**Overlap**: Both identify `project-status.py`, `secrets-scan.py`, `refresh-inventories.py`

**Unique to Architect**: `svg-autofix.py`, `rfc-consensus.py`, `feature-context.py`, `dependency-graph.py`

---

## Conclusion

The 26-terminal architecture creates a **token multiplication problem**. A single inefficiency repeated across terminals compounds dramatically. The proposed script layer hierarchy addresses this by:

1. **Centralizing parsing** - Parse once, share JSON
2. **Eliminating broadcast duplication** - Pre-compute assignments
3. **Automating structural fixes** - Scripts fix what scripts can fix
4. **Enforcing data flow discipline** - Scripts down, semantics up

Recommend prioritizing `svg-autofix.py` (highest daily impact) and `rfc-consensus.py` (council efficiency).

---

## Related Documents

- [RFC-006: Constitution Planning Phase Amendments](../rfcs/RFC-006-constitution-planning-phase-amendments.md)
- [2026-01-15-toolsmith-script-opportunities.md](./2026-01-15-toolsmith-script-opportunities.md)
- [2026-01-15-constitution-gaps.md](./2026-01-15-constitution-gaps.md)
