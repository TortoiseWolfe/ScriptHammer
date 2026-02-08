# Toolsmith Audit: Script Opportunities

**Date**: 2026-01-15
**Author**: Toolsmith
**Scope**: `~/.claude/commands/*.md` (65 files) + `.claude/commands/*.md` (11 files)

## Executive Summary

Reviewed 76 skill files for prompt-heavy operations that could be replaced with deterministic Python scripts. Identified **8 high-priority** and **3 medium-priority** candidates. Scripts reduce token usage, improve reliability, and enable CI integration.

## Already Scripted (Reference)

| Skill                | Script                     | Output Modes          |
| -------------------- | -------------------------- | --------------------- |
| `/wireframe-inspect` | `inspect-wireframes.py`    | `--all`, `--report`   |
| Validator            | `validate-wireframe.py`    | `--json`, `--summary` |
| Screenshots          | `screenshot-wireframes.py` | Per-SVG quadrants     |

These demonstrate the pattern: **prompt defines workflow, script does deterministic work**.

---

## High Priority Candidates

### 1. `/status` → `project-status.py`

**Current**: 220-line prompt instructing Claude to:

- Read `.terminal-status.json`
- Count SVG files with `find`
- Parse RFC files for status
- Build ASCII dashboard

**Script Opportunity**:

```bash
python project-status.py --json          # Machine-readable
python project-status.py --dashboard     # ASCII output
python project-status.py --terminals     # Filtered view
```

**Why Script**:

- 100% deterministic (file counts, JSON parsing)
- Used frequently by Operator/Coordinator
- ASCII formatting is tedious for LLM
- Enables `/status --json | jq` pipelines

**Estimated Effort**: 2-3 hours

---

### 2. `/review-queue` → `review-queue.py`

**Current**: 227-line prompt instructing Claude to:

- Parse `.terminal-status.json` for REVIEW items
- Check `.issues.md` file existence/timestamps
- Calculate age (fresh/recent/waiting/stale)
- Display formatted table

**Script Opportunity**:

```bash
python review-queue.py                   # Full queue
python review-queue.py --stale           # >24 hours old
python review-queue.py --json            # CI integration
python review-queue.py 001               # Feature detail
```

**Why Script**:

- Timestamp calculations are deterministic
- File existence checks don't need LLM
- Reviewer terminal runs this constantly

**Estimated Effort**: 2 hours

---

### 3. `/queue-check` → `queue-status.py`

**Current**: 204-line prompt for queue/terminal dashboard

**Script Opportunity**:

```bash
python queue-status.py                   # Full dashboard
python queue-status.py --pending         # Queue only
python queue-status.py --active          # Active terminals
python queue-status.py generator-1       # Filter by terminal
```

**Why Script**:

- Pure JSON parsing and formatting
- No semantic analysis needed
- High-frequency operation

**Estimated Effort**: 1-2 hours

---

### 4. `/refresh-inventories` → `refresh-inventories.py`

**Current**: 118-line prompt with embedded bash loops:

```bash
for f in *.md; do
  desc=$(awk '/^---$/{...}' "$f")
  ...
done
```

**Script Opportunity**:

```bash
python refresh-inventories.py            # All inventories
python refresh-inventories.py --skills   # skill-index.md only
python refresh-inventories.py --check    # Validate without write
```

**Why Script**:

- Complex awk/sed parsing in prompts is fragile
- File scanning is entirely deterministic
- Critical for fork experience

**Estimated Effort**: 3-4 hours

---

### 5. `/secrets-scan` → `secrets-scan.py`

**Current**: 253-line prompt with regex patterns and grep commands

**Script Opportunity**:

```bash
python secrets-scan.py                   # Full scan
python secrets-scan.py --staged          # Pre-commit mode
python secrets-scan.py --json            # CI integration
python secrets-scan.py src/              # Directory scope
```

**Why Script**:

- Regex matching is deterministic
- False positive filtering can be rule-based
- Enables git hook integration
- Security-critical tool should be auditable

**Estimated Effort**: 3-4 hours

---

### 6. `/wireframe-status` → `wireframe-status.py`

**Current**: Prompt-based status updates to `wireframe-status.json`

**Script Opportunity**:

```bash
python wireframe-status.py               # Interactive menu
python wireframe-status.py 001 approved  # Direct update
python wireframe-status.py --report      # Status summary
```

**Why Script**:

- JSON updates are deterministic
- Status transitions follow state machine
- Reduces risk of malformed JSON

**Estimated Effort**: 2 hours

---

### 7. RFC Status Checker → `rfc-status.py`

**Current**: Part of `/status` and `/rfc-vote` prompts

**Script Opportunity**:

```bash
python rfc-status.py                     # All RFCs
python rfc-status.py --voting            # Pending votes
python rfc-status.py 005                 # Single RFC detail
python rfc-status.py --json              # CI integration
```

**Why Script**:

- File parsing (Status:, Vote table) is deterministic
- Vote counting is arithmetic
- Frequently queried by Council terminals

**Estimated Effort**: 2 hours

---

### 8. Acceptance Criteria Parser → `parse-acceptance-criteria.py`

**Current**: Part of `/refresh-inventories` prompt

**Script Opportunity**:

```bash
python parse-acceptance-criteria.py      # All features
python parse-acceptance-criteria.py 003  # Single feature
python parse-acceptance-criteria.py --coverage  # P0/P1/P2 counts
```

**Why Script**:

- Given/When/Then parsing is regex-based
- Priority extraction is pattern matching
- Feeds into QA Lead workflows

**Estimated Effort**: 2-3 hours

---

## Medium Priority Candidates

### 9. `/analyze` (speckit.analyze)

**Current**: 105-line prompt for cross-artifact consistency analysis

**Partial Script Opportunity**:

- Structure parsing (requirements, tasks inventory)
- Coverage calculation (tasks per requirement)
- Terminology extraction

**Keep as Prompt**:

- Semantic ambiguity detection
- Constitution alignment checking
- Remediation recommendations

**Hybrid Approach**:

```bash
python analyze-structure.py --json > structure.json
# Claude reads structure.json and does semantic analysis
```

---

### 10. `/session-stats`

**Current**: 166-line prompt estimating token usage

**Limitation**: Requires conversation context (message counts, tool calls)

**Partial Script**:

- Cost calculation given token counts
- Export formatting

**Cannot Script**: Token counting needs conversation access

---

### 11. Issue Escalation Checker

**Current**: Part of validate-wireframe.py `--check-escalation`

**Enhancement Opportunity**:

```bash
python check-escalation.py               # Find patterns across features
python check-escalation.py --auto-escalate  # Move to GENERAL_ISSUES.md
```

---

## Not Recommended for Scripting

| Skill                         | Reason                                        |
| ----------------------------- | --------------------------------------------- |
| `/clarify`                    | Requires understanding ambiguity semantically |
| `/specify`                    | Creative spec writing from natural language   |
| `/plan`                       | Architecture decisions need reasoning         |
| `/wireframe`                  | SVG generation is creative                    |
| `/code-review`                | Security analysis needs context               |
| `/council`                    | Discussion facilitation is interactive        |
| `/memo`, `/rfc`, `/broadcast` | Template-based but interactive                |

---

## Implementation Priority

| Priority | Script                         | Impact                    | Effort |
| -------- | ------------------------------ | ------------------------- | ------ |
| 1        | `project-status.py`            | High (used by Operator)   | 2-3h   |
| 2        | `review-queue.py`              | High (Reviewer workflow)  | 2h     |
| 3        | `secrets-scan.py`              | High (Security-critical)  | 3-4h   |
| 4        | `refresh-inventories.py`       | High (Fork experience)    | 3-4h   |
| 5        | `queue-status.py`              | Medium (Dashboard)        | 1-2h   |
| 6        | `rfc-status.py`                | Medium (Council workflow) | 2h     |
| 7        | `wireframe-status.py`          | Medium (Pipeline)         | 2h     |
| 8        | `parse-acceptance-criteria.py` | Low (Occasional use)      | 2-3h   |

**Total Estimated Effort**: 18-24 hours

---

## Recommended Next Steps

1. **Immediate**: Create `project-status.py` - most visible impact
2. **This Sprint**: Add `secrets-scan.py` - security priority
3. **Next Sprint**: `refresh-inventories.py` - fork experience
4. **Ongoing**: Convert remaining as capacity allows

---

## Pattern for New Scripts

```python
#!/usr/bin/env python3
"""
[Tool Name] - [One-line description]

Usage:
    python tool.py [args]         # Standard output
    python tool.py --json         # Machine-readable
    python tool.py --summary      # One-line for CI
"""

import argparse
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='...')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--summary', action='store_true')
    args = parser.parse_args()

    # ... deterministic logic ...

    if args.json:
        print(json.dumps(result, indent=2))
    elif args.summary:
        print(f"Tool: {status} | {metric1} | {metric2}")
    else:
        # ASCII dashboard
        pass

if __name__ == '__main__':
    main()
```

---

## Conclusion

8 high-priority scripts would eliminate ~1,500 lines of prompt instructions and reduce token usage significantly for high-frequency operations. The validate-wireframe.py enhancement (RFC-004) demonstrates the pattern works well.

Recommend prioritizing `project-status.py` and `secrets-scan.py` for immediate implementation.
