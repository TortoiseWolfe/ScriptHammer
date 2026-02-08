# The 4,700-Line Solution: Offloading Token-Heavy Tasks to Python

**TL;DR**: When validating 46 features with 40+ checks per SVG, context windows fill fast. We moved 4,737 lines of deterministic work to 9 Python scripts, reserving Claude for judgment calls. Result: validation dropped from minutes of context to under 1 second, saving ~31,600 tokens per day.

---

## The Token Problem

If you've built anything substantial with Claude Code or similar AI assistants, you've hit the wall: context windows are finite. Every message, every file read, every tool output consumes tokens. Run out, and the model starts forgetting earlier context or you're forced into a new session.

We hit this wall hard while wireframing 46 features for ScriptHammer. Each SVG wireframe needed validation against 40+ design rules:

- Canvas dimensions (1920×1080)
- Color codes (#e8d4b8 for panels, #22c55e for toggle ON, etc.)
- Typography (16px bold for annotations, 14px for narrative)
- Touch target sizes (44px minimum)
- Header/footer include references
- Modal overlay structure
- Badge containment
- And 30+ more checks

Validating one SVG manually meant Claude reading the file, checking each rule, and reporting issues. That's ~5,000 tokens per validation. With multiple SVGs per feature and iterative fixes, we were burning through context at an unsustainable rate.

The realization: **Claude was doing work that doesn't need AI.** Checking if a color is `#e8d4b8` or `#ffffff` is deterministic. There's no judgment involved. It's binary: pass or fail.

---

## What We Offloaded

We built nine Python scripts, totaling 4,737 lines:

| Script                        | LOC    | Token-Heavy Task Eliminated        |
| ----------------------------- | ------ | ---------------------------------- |
| `validate-wireframe.py`       | ~2,000 | 40+ design rule checks per SVG     |
| `inspect-wireframes.py`       | 603    | Cross-SVG pattern comparison       |
| `screenshot-wireframes.py`    | 407    | Manual viewer navigation           |
| `terminal-router.py`          | 370    | 14-way terminal role dispatch      |
| `wireframe-plan-generator.py` | 340    | Spec parsing + SVG assignments     |
| `queue_manager.py`            | 313    | JSON filtering (replaced shell jq) |
| `wireframe-status-manager.py` | 270    | Status JSON operations             |
| `wireframe-prep-loader.py`    | 230    | Context file discovery             |
| `implementation_order.py`     | 204    | Feature status lookups             |

### The Validator: 40+ Checks in 1 Second

Here's what a single check looks like in `validate-wireframe.py`:

```python
def _check_colors(self):
    """Check for forbidden colors on PANELS (rect elements only)."""
    for color in FORBIDDEN_PANEL_COLORS:
        # Only match <rect> elements with forbidden fill
        pattern = rf'<rect[^>]*fill=["\']?{re.escape(color)}'
        matches = list(re.finditer(pattern, self.svg_content, re.IGNORECASE))
        for match in matches:
            line_num = self._get_line_number(match.start())
            self.issues.append(Issue(
                severity="ERROR",
                code="G-001",
                message=f"Forbidden panel color '{color}' (use #e8d4b8)",
                line=line_num
            ))
```

This check—plus 39 others—runs in under 1 second. The same validation done by Claude would consume thousands of tokens and require Claude to read the SVG, remember the color rules, scan for violations, and format output.

The validator outputs structured data:

```
FAIL: 002-cookie-consent/01-consent-modal-flow.svg
  Line 142: [G-001] Forbidden panel color '#ffffff' (use #e8d4b8)
  Line 287: [G-020] Annotation panel missing rounded corners
```

Claude reads this output and decides what to do—but the _detection_ happened in Python.

### Auto-Logging: Issues Go Straight to Markdown

The validator doesn't just print errors. It appends them to feature-specific `.issues.md` files:

```markdown
## 2026-01-13 Automated Validation

| Code  | Line | Issue                                    |
| ----- | ---- | ---------------------------------------- |
| G-001 | 142  | Forbidden panel color '#ffffff'          |
| G-020 | 287  | Annotation panel missing rounded corners |
```

Now the Reviewer terminal has a persistent record. No copy-pasting from Claude's output.

### Escalation Intelligence

Some issues appear across multiple features. Rather than log them to `GENERAL_ISSUES.md` immediately, the validator tracks frequency:

```bash
python validate-wireframe.py --check-escalation
# Output: G-020 seen in 3 features - escalation candidate
```

Only patterns that appear in 2+ features get escalated. This prevents noise while ensuring recurring issues get documented.

### The Inspector: Cross-SVG Consistency

The Validator checks individual files. But what about consistency _across_ files?

If one SVG has its title at y=28 and another has it at y=35, both might pass individual validation. But they're inconsistent. That's where `inspect-wireframes.py` (603 LOC) comes in.

The Inspector runs _after_ Validator passes and checks patterns across all SVGs:

```python
EXPECTED = {
    'title': {'x': 960, 'y': 28, 'anchor': 'middle'},
    'signature': {'y': 1060, 'bold': True},
    'desktop_mockup': {'x': 40, 'y': 60, 'width': 1280, 'height': 720},
    'mobile_mockup': {'x': 1360, 'y': 60, 'width': 360, 'height': 720},
    'annotation_panel': {'x': 40, 'y': 800, 'width': 1840, 'height': 220},
}

POSITION_TOLERANCE = 5  # pixels
```

It extracts structural elements from each SVG, compares them to expected patterns, and flags **oddballs**—SVGs that deviate from the 50%+ majority pattern. This catches drift that single-file validation misses.

```bash
python inspect-wireframes.py --all
# Output:
# 002-cookie-consent/01-consent-modal.svg: title y=35 (expected 28, tolerance 5)
# Classification: PATTERN_VIOLATION
```

The Validator catches broken rules. The Inspector catches broken consistency.

---

## The Decision Framework

Not everything should be Python. Here's how we decide:

**Offload to Python when the task is:**

- **Deterministic** - Same input always produces same output
- **Repetitive** - Runs many times with slight variations
- **Binary** - Pass/fail, no nuance required
- **Pattern-matching** - Regex, string comparison, structural checks

**Keep in Claude when the task requires:**

- **Judgment** - "Is this layout intuitive?"
- **Context** - "Does this match the feature spec?"
- **Creativity** - "Generate a new SVG for this screen"
- **Ambiguity resolution** - "Should this be PATCH or REGEN?"

The validator catches that a color is wrong. Claude decides whether to fix it with a small edit (PATCH) or regenerate the entire SVG (REGEN). That judgment call requires understanding the issue's severity and the SVG's overall state.

```
        ┌─────────────────┐
        │   Is it         │
        │   deterministic?│
        └────────┬────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
      YES                  NO
       │                   │
       ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ Python       │   │ Claude       │
│ Validation   │   │ Judgment     │
│ Detection    │   │ Creativity   │
│ Reporting    │   │ Context      │
└──────────────┘   └──────────────┘
```

---

## The Implementation Pattern

Our scripts follow a consistent pattern:

1. **Input**: File paths or feature codes via CLI
2. **Processing**: Pure Python logic, no AI calls
3. **Output**: Structured data (JSON, exit codes, markdown)
4. **Handoff**: Claude reads output and makes decisions

Example workflow for screenshot capture:

```bash
# Python captures screenshots (no tokens)
python screenshot-wireframes.py 002-cookie-consent

# Generates:
# png/002-cookie-consent/01-consent-modal-flow/
#   ├── overview.png
#   ├── quadrant-tl.png, tr.png, bl.png, br.png
#   ├── quadrant-center.png
#   └── manifest.json (includes validator results)
```

Claude (Reviewer terminal) then reads the images and manifest:

```
"Review the screenshots in png/002-cookie-consent/.
The manifest shows G-001 violations on lines 142, 287."
```

The expensive part (capturing screenshots, running validation) is Python. The judgment part (classifying issues, deciding fixes) is Claude.

---

## Results

### Validation Speed

- **Before**: ~2-3 minutes of context per SVG (reading, checking, reporting)
- **After**: <1 second Python execution + ~500 tokens to read results

### Context Savings

- 40+ checks that would each require Claude to remember rules and scan content
- Eliminated entirely from AI context
- Claude only sees the summary output

### Quality Improvement

- Deterministic checks never miss violations
- Auto-logging creates audit trail
- Escalation system catches patterns

### Screenshot Automation

- 6 images per SVG (overview + 5 quadrants) captured automatically
- Standardized viewport and zoom levels
- Validator results embedded in manifest

### Skill File Simplification

Python scripts also simplified our Claude Code skill files:

| Skill                  | Before    | After     | Reduction |
| ---------------------- | --------- | --------- | --------- |
| `/next.md`             | 335 lines | 99 lines  | **70%**   |
| `/wireframe-status.md` | 145 lines | 95 lines  | **34%**   |
| `/wireframe-plan.md`   | 128 lines | 104 lines | **19%**   |

Smaller skill files mean faster context loading and less prompt overhead.

### Token Savings: ~31,600/day

| Operation           | Per-Call Savings | Daily Calls | Daily Savings |
| ------------------- | ---------------- | ----------- | ------------- |
| `/next`             | ~2,000 tokens    | 8           | 16,000        |
| `/wireframe-prep`   | ~650 tokens      | 12          | 7,800         |
| `/wireframe-plan`   | ~1,000 tokens    | 5           | 5,000         |
| `/wireframe-status` | ~350 tokens      | 8           | 2,800         |

That's ~31,600 tokens saved per day—context that can now go toward creative work instead of mechanical lookups.

---

## What's Next

We're actively looking for more offload opportunities:

1. **Cross-artifact consistency** - Could Python check spec-to-plan-to-tasks alignment?
2. **Test scaffolding** - Generate boilerplate test files from component signatures
3. **Dependency analysis** - Parse imports and flag circular dependencies

The principle remains: **AI for judgment, Python for automation.**

---

_This is Part 1 of a three-part series on scaling AI-assisted development. Part 2 covers our multi-terminal coordination system. Part 3 tells the story of how we got here._
