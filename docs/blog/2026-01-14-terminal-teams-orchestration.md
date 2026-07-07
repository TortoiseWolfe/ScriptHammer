# 14 Terminals, One Codebase: Orchestrating Claude Code Teams

**TL;DR**: We split one Claude Code session into 14 specialized terminals—3 parallel Generators, a dedicated Validator, queue-based coordination. Result: 3x throughput on wireframe generation, automated quality gates, and clear handoffs between phases.

---

## The Bottleneck

One terminal doing everything is a recipe for context thrashing.

In our initial workflow, a single Claude Code session would:

1. Read the feature spec
2. Plan which SVGs to create
3. Generate the first SVG
4. Validate it
5. Fix issues
6. Generate the next SVG
7. ...repeat for all features

The problem: by SVG #3, Claude is juggling spec context, validation rules, previous fixes, and current generation. Context gets polluted. Quality drops. And it's all serial—no parallelism.

The insight: **Different phases of work don't need the same context.** A Generator doesn't need to know about queue management. A Validator doesn't need creative SVG prompts. A Planner doesn't need validation error codes.

---

## The Terminal Roster

We defined 14 specialized roles, each with focused responsibility:

```
                 ┌─────────────┐     ┌─────────────┐
                 │   Primary   │◀───▶│  Assistant  │
                 │   Manager   │     │   Manager   │
                 │ docs/queue  │     │skills/tools │
                 └──────┬──────┘     └─────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ Planner │
                   │ assigns │
                   └────┬────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Generator-1 │  │ Generator-2 │  │ Generator-3 │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ Viewer  │ (hot-reload preview)
                   └────┬────┘
                        │
                        ▼
                   ┌─────────┐
                   │Reviewer │ (screenshots + classification)
                   └────┬────┘
                        │
                        ▼
                   ┌─────────┐
                   │Validator│ (automated checks)
                   └────┬────┘
                        │
                        ▼
                   ┌─────────┐
                   │Inspector│ (cross-SVG consistency)
                   └─────────┘

Supporting roles (parallel):
┌────────┐  ┌────────┐  ┌───────────┐  ┌─────────┐
│ Author │  │ Tester │  │Implementer│  │ Auditor │
└────────┘  └────────┘  └───────────┘  └─────────┘
```

### Role Breakdown

| Terminal              | Responsibility                                     | Focus Files                          |
| --------------------- | -------------------------------------------------- | ------------------------------------ |
| **Primary Manager**   | Coordinate workflow, update docs, queue management | `CLAUDE.md`, `.terminal-status.json` |
| **Assistant Manager** | Maintain skill files, refactor tools               | `~/.claude/commands/*.md`            |
| **Planner**           | Analyze specs, create SVG assignments              | `features/*/spec.md`                 |
| **Generator 1/2/3**   | Create SVGs, fix validation errors                 | `NNN-feature/*.svg`                  |
| **Viewer**            | Run hot-reload viewer                              | `index.html`                         |
| **Reviewer**          | Screenshot analysis, issue classification          | `*.issues.md`                        |
| **Validator**         | Maintain validation script                         | `validate-wireframe.py`              |
| **Inspector**         | Cross-SVG consistency                              | `inspect-wireframes.py`              |
| **Author**            | Documentation, blog posts                          | `docs/*.md`                          |
| **Tester**            | Test execution                                     | `*.test.ts`                          |
| **Implementer**       | Convert specs to code                              | `src/**/*.tsx`                       |
| **Auditor**           | Cross-artifact consistency                         | `spec.md`, `plan.md`, `tasks.md`     |

---

## Coordination Mechanisms

### 1. Shared State File

`.terminal-status.json` is the coordination hub:

```json
{
  "lastUpdated": "2026-01-13T22:05:00Z",
  "terminals": {
    "manager": { "status": "idle", "feature": null, "task": null },
    "generator-1": {
      "status": "generating",
      "feature": "003-auth",
      "task": "registration.svg"
    },
    "generator-2": { "status": "idle", "feature": null, "task": null },
    "reviewer": {
      "status": "reviewing",
      "feature": "002-consent",
      "task": null
    }
  },
  "queue": [
    {
      "feature": "001-wcag-aa-compliance",
      "svg": null,
      "action": "REVIEW",
      "reason": "Generator-1 completed 3 SVGs - ready for review",
      "assignedTo": "reviewer"
    }
  ],
  "completedToday": [
    "Generator-1: Completed 005-security-hardening (3 SVGs)",
    "Planner: Completed wireframe plan for 002-cookie-consent (3 SVGs)"
  ]
}
```

Any terminal can read this file. Only the Manager modifies it (single source of truth).

### 2. Queue System

Work flows through the queue with explicit assignments:

```json
{
  "feature": "002-cookie-consent",
  "svg": "01-consent-modal.svg",
  "action": "REGEN",
  "reason": "G-001 violations on 3 rects",
  "assignedTo": "generator-2"
}
```

**Actions**:

- `PLAN` - Needs Planner to create SVG assignments
- `GENERATE` - Ready for Generator
- `REVIEW` - Ready for Reviewer
- `REGEN` - Failed validation, back to Generator
- `APPROVED` - Passed all checks

### 3. Terminal Primers

Each terminal starts with a "primer" copied from `CLAUDE.md`:

```markdown
You are the Generator-1 terminal.
/prep generator

Skills: /wireframe-prep [feature], /wireframe [feature]
```

The `/prep` command loads role-specific context:

- Generators get wireframe rules
- Reviewers get issue classification guidelines
- Validators get the escalation policy

This keeps each terminal's context lean and focused.

---

## The Feedback Loop

Not everything passes on the first try. Issues route back:

```
Generator creates SVG
       │
       ▼
Validator runs checks
       │
       ├──── PASS ────► Reviewer
       │                    │
       │                    ├── PASS ──► Inspector
       │                    │               │
       │                    │               ├── PASS ──► Approved
       │                    │               │
       │                    │               └── FAIL ──► issues/*.md
       │                    │                              │
       │                    └── FAIL ──► issues/*.md       │
       │                                   │               │
       └──── FAIL ────► issues/*.md        │               │
                           │               │               │
                           └───────────────┴───────────────┘
                                          │
                                          ▼
                               Queue item: action=REGEN
                               assignedTo=generator-N
```

**Issue Classification**:

- **PATCH**: Cosmetic fixes (wrong color, typo). Generator can fix inline.
- **REGEN**: Structural issues (layout problems, overlapping). Full regeneration.
- **PATTERN_VIOLATION**: Cross-SVG consistency issues. Inspector flags these.

The Reviewer makes PATCH/REGEN calls. Python detects issues; Claude judges severity.

### Validator vs Inspector: Different Scopes

Two Python scripts, two different jobs:

| Script        | Scope       | Checks              | Example                            |
| ------------- | ----------- | ------------------- | ---------------------------------- |
| **Validator** | Single file | Design rules        | "Wrong color on line 142"          |
| **Inspector** | All files   | Pattern consistency | "Title at y=35, but 80% have y=28" |

The Validator runs first. If it passes, the Inspector runs. An SVG can pass Validator (correct colors, valid structure) but fail Inspector (title position differs from other SVGs).

Inspector uses a 5-pixel tolerance for position checks. It detects **oddballs**—files that deviate from the 50%+ majority pattern. This prevents one early SVG from setting a bad precedent that others copy.

---

## Parallelism Wins

With 3 Generators, we can process features concurrently:

```
Time ──────────────────────────────────────────────►

Generator-1: [003-auth]────────[005-security]────────[001-wcag]────
Generator-2: [006-template]────[002-consent]─────────────────────────
Generator-3: [007-testing]─────────────────────────────────────────

Planner:     [003]─[007]─[006]─[005]─[002]─[001]───────────────────
```

The Planner stays ahead, creating assignments. Generators pull from the queue. No single terminal is a bottleneck.

### Throughput Comparison

| Approach              | Features/Hour | Context Pollution         |
| --------------------- | ------------- | ------------------------- |
| Single terminal       | ~1-2          | High (all contexts mixed) |
| 3 parallel Generators | ~4-6          | Low (focused contexts)    |

---

## Lessons Learned

### 1. Specialization Reduces Context-Switching

A Generator that only generates doesn't waste context on validation rules. A Validator that only validates doesn't need creative prompts. Each role stays in its lane.

### 2. Shared State Files Enable Coordination

JSON files are the lingua franca. Every terminal can read state. Only designated terminals write. No race conditions because humans coordinate the writes.

### 3. Primers Maintain Role Consistency

Starting fresh in a new terminal? Paste the primer. The `/prep` command loads context. Role behavior is consistent across sessions.

### 4. Explicit Handoffs Prevent Dropped Work

Queue items have explicit `assignedTo` fields. Nothing falls through the cracks. The completion log provides audit trail.

### 5. Feedback Loops Need Classification

Not all issues are equal. PATCH vs REGEN classification prevents over-engineering fixes. Regenerating a cosmetic issue wastes time. Patching a structural issue creates technical debt.

### 6. Assistant Manager Keeps Skills Lean

The Assistant Manager terminal focuses on skill file maintenance. When a skill file grows large, it offloads the heavy logic to Python:

| Skill                  | Before    | After     | How                                         |
| ---------------------- | --------- | --------- | ------------------------------------------- |
| `/next.md`             | 335 lines | 99 lines  | `terminal-router.py` handles dispatch       |
| `/wireframe-status.md` | 145 lines | 95 lines  | `wireframe-status-manager.py` does JSON ops |
| `/wireframe-plan.md`   | 128 lines | 104 lines | `wireframe-plan-generator.py` parses specs  |

This saves ~31,600 tokens per day across common operations. The pattern: **skill files orchestrate, Python scripts execute**.

---

## What's Next

The terminal system is working well for wireframes. We're planning to apply it to:

1. **Implementation Phase** - Implementer terminals pulling from task queues
2. **Testing Phase** - Tester terminals running suites, logging failures
3. **Audit Phase** - Auditor terminals checking cross-artifact consistency

The pattern generalizes: **specialized contexts + shared state + explicit handoffs**.

---

_This is Part 2 of a three-part series on scaling AI-assisted development. Part 1 covers Python offloading for token efficiency. Part 3 tells the story of how we got here._
