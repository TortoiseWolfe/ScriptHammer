# Day 14: When We Stopped Fighting Token Limits

**TL;DR**: 15 days of AI-assisted development. Days 1-13: brute force single-terminal workflow. Day 14: paradigm shift to Python offloading + terminal teams after hitting the wall. Here's how constraints drove innovation.

---

## Day 1-3: The Specification Sprint

We started ScriptHammer with ambitious goals: 46 features, full specs, wireframes, then implementation. The SpecKit workflow felt efficient:

```
/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks
```

In three days, we had 46 feature specifications organized into 9 categories. Each spec included user stories, acceptance criteria, and technical constraints. The foundation felt solid.

We were optimistic. This AI-assisted development thing was going great.

---

## Day 4-13: The Wireframe Grind

Then came wireframe generation.

Each feature needed 2-4 SVG wireframes showing desktop and mobile layouts. That's ~150 SVGs total. We'd generate one, review it, fix issues, move to the next.

The workflow:

1. Read feature spec
2. Generate SVG with `/wireframe`
3. Open viewer to check
4. Note issues manually
5. Fix and regenerate
6. Repeat

By day 7, warning signs appeared:

- Context resets happening mid-feature
- Claude forgetting which SVGs were done
- Validation taking longer than generation
- Same mistakes appearing across features

We were fighting the tool instead of using it.

---

## Day 14 Morning: The Breaking Point

Day 14 started with validation purgatory.

One SVG had 12 color violations. I found myself asking Claude to:

1. Read the SVG
2. Check for `#ffffff` (forbidden)
3. Check for `#d1d5db` (wrong toggle grey)
4. Check for correct parchment color
5. Check toggle dimensions
6. Check touch target sizes
7. ...and 34 more rules

Each check consumed tokens. By the time Claude reported all issues, half the context window was spent on validation alone.

The realization hit: **Claude was doing work that doesn't need AI.**

Checking if `fill="#ffffff"` appears in an SVG is not an AI task. It's a regex. It's `grep`. It's a Python script that runs in milliseconds.

Why was I using a reasoning engine to do pattern matching?

---

## Day 14 Afternoon: The Python Pivot

By 2pm, I had the first validator script running:

```python
def _check_colors(self):
    """Check for forbidden colors on PANELS."""
    for color in FORBIDDEN_PANEL_COLORS:
        pattern = rf'<rect[^>]*fill=["\']?{re.escape(color)}'
        matches = list(re.finditer(pattern, self.svg_content, re.IGNORECASE))
        for match in matches:
            self.issues.append(Issue(
                code="G-001",
                message=f"Forbidden panel color '{color}'",
                line=self._get_line_number(match.start())
            ))
```

Run time: 47 milliseconds for 40+ checks.

The validation that was eating 5 minutes of context now took less than a second. Claude's job changed: instead of _detecting_ issues, it would _decide_ what to do about them.

By 4pm: `validate-wireframe.py` hit v4.0 with auto-logging to `.issues.md` files.

By 6pm: v5.0 added escalation detection for patterns appearing across multiple features.

By 8pm: `screenshot-wireframes.py` v1.0 automated the viewer capture workflow.

By 11pm: v1.1 added 50px quadrant overlap (later increased to 100px).

**Timeline: v1.0 → v1.1 in 3 hours.** When you're not fighting context limits, iteration is fast.

---

## Day 14 Evening: The Terminal Split

With validation offloaded, a new bottleneck emerged: task diversity.

A single terminal was:

- Reading specs (context: feature requirements)
- Generating SVGs (context: design rules)
- Running validation (context: error codes)
- Managing queue (context: feature status)
- Writing documentation (context: project history)

Each task polluted the context for others. A Generator doesn't need documentation context. A Validator doesn't need creative prompts.

The insight: **What if each task had its own terminal?**

By 9pm, `.terminal-status.json` existed:

```json
{
  "terminals": {
    "manager": { "status": "coordinating" },
    "generator": { "status": "generating", "feature": "003-auth" },
    "viewer": { "status": "running" },
    "reviewer": { "status": "idle" },
    "validator": { "status": "idle" }
  },
  "queue": []
}
```

Five roles. Each with focused responsibility.

By midnight, we had 14 roles including 3 parallel Generators. The wireframe pipeline was parallel and automated.

---

## Day 15: The New Normal

Day 15 looked nothing like Day 13.

**Before (Day 13)**:

- Single terminal
- Manual validation in chat
- Serial SVG generation
- Context thrashing
- ~2 features per day

**After (Day 15)**:

- 14 specialized terminals
- Python-automated validation (Validator + Inspector)
- 3 parallel Generators
- Inspector as final quality gate (cross-SVG consistency)
- Focused contexts
- ~6 features per day

The pipeline now has two Python quality gates: Validator checks each file against design rules, then Inspector checks all files for pattern consistency. If Inspector finds one SVG with its title at y=35 while others have y=28, it flags the oddball before it becomes a precedent.

The completed log from Day 15:

```
Generator-1: Completed 005-security-hardening (3 SVGs)
Generator-2: Completed 003-user-authentication (3 SVGs)
Generator-3: Completed 007-e2e-testing-framework (2 SVGs)
Generator-1: Completed 001-wcag-aa-compliance (3 SVGs)
Generator-3: Completed 002-cookie-consent (3 SVGs)
Planner: Completed 6 wireframe plans
```

14 SVGs generated, planned, validated, and logged in a single day. With one terminal, that would have been a week.

---

## The Meta-Lesson

Token limits forced good architecture.

If context windows were infinite, I might still be using a single terminal doing manual validation. The constraint made me separate concerns:

- **Deterministic work → Python** (validation, inspection, screenshots, queue management)
- **Judgment work → Claude** (classification, creative decisions, coordination)
- **Parallel work → Multiple terminals** (3 Generators, support roles)

The "limitation" was actually a feature. It demanded the kind of separation we teach in software engineering but often skip when prototyping.

---

## What I'd Do Differently

**Start with the split earlier.** We should have offloaded to Python after the first week, not the second. The warning signs were there:

- Repeated issues across features → Pattern detection should be automated
- Context resets → Too much in one terminal
- Serial bottlenecks → Parallelism was possible

**Design for handoffs from the start.** The queue system works because we added it intentionally. Ad-hoc coordination would have failed.

**Trust Python for repetitive work.** Every token spent on deterministic validation is a token not spent on creative generation.

---

## What's Next

We're 15 days in. 46 features specced. ~30 wireframes generated. Validation automated. Terminal team coordinated.

And the offloading continues. The Assistant Manager just added 4 more Python scripts (1,210 lines):

- `terminal-router.py` - 14-way dispatch for `/next` command
- `wireframe-status-manager.py` - Status JSON operations
- `wireframe-prep-loader.py` - Context file discovery
- `wireframe-plan-generator.py` - Spec parsing + SVG assignments

**Total Python automation: 4,737 lines.** Saving ~31,600 tokens per day.

The wireframe phase will complete this week. Then:

- Implementer terminals start coding
- Tester terminals run suites
- Auditor terminals verify consistency

The pattern scales. Specialized contexts + shared state + explicit handoffs.

Day 14 was the turning point. We stopped fighting token limits and started working with them.

---

_This is Part 3 of a three-part series on scaling AI-assisted development. Part 1 covers the Python offloading strategy. Part 2 explains the multi-terminal coordination system._
