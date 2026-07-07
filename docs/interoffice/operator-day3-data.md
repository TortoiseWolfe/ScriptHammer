# Day 3 Operator Primer (2026-01-16+)

**Copy this block to prime a fresh Operator session:**

## Session Continuation from 2026-01-15

Read full context below, then run startup sequence.

### Day 2 Accomplishments (2026-01-15)

- 28 commits made (unpushed - only Operator can push)
- G-040, G-041, G-042, G-043, G-044 added to GENERAL_ISSUES.md
- SIGNATURE-003, SIGNATURE-004 checks added to validator
- Auditor discovered "hidden include hack" root cause
- WireframeQA identified 18 centered signatures, 27 correct
- 022-web3forms queued for REGEN (136 errors)

### CRITICAL: Morning Priority Items

1. **SIGNATURE PATCH (18 SVGs)** - HIGH PRIORITY
   - Fix: x="960" text-anchor="middle" → x="40" left-aligned
   - Features: 003, 007, 008, 010, 011, 014, 016, 021
   - Dispatch to Generator terminals

2. **G-044 PATCH (6 SVGs)** - HIGH PRIORITY
   - Fix: Add rx="8" to footer/nav <rect> elements
   - Features: 002, 003, 010, 013, 019
   - Dispatch to Generator terminals

3. **TOOLSMITH: Include Visibility Checks** - MEDIUM
   - Prevent "hidden include hack" (generators hiding includes to pass HDR-001)
   - Add checks for: opacity, transform position, correct Y values
   - See: docs/interoffice/audits/2026-01-15-auditor-g044-gap-analysis.md

4. **022-web3forms REGEN** - IN QUEUE
   - Already queued in .terminal-status.json
   - 2 SVGs: 01-contact-form-ui (52 errors), 02-submission-states (84 errors)

5. **Inspector needs reprime** - Context at 17%
   - Run: /clear then /prime inspector

### SVGs Needing SIGNATURE PATCH (18 total)

| Feature                      | SVGs |
| ---------------------------- | ---- |
| 003-user-authentication      | 3    |
| 007-e2e-testing-framework    | 1    |
| 008-on-the-account           | 1    |
| 010-unified-blog-content     | 2    |
| 011-group-chats              | 2    |
| 014-admin-welcome-email-gate | 2    |
| 016-messaging-critical-fixes | 3    |
| 021-geolocation-map          | 2    |

### Fix Patterns

**Signature (SIGNATURE-003):**

```xml
<!-- WRONG -->
<text x="960" y="1060" text-anchor="middle" ...>
<!-- CORRECT -->
<text x="40" y="1060" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature Name | ScriptHammer</text>
```

**Rounded Corners (G-044):**

```xml
<!-- WRONG -->
<rect y="670" width="1280" height="50" fill="#dcc8a8"/>
<!-- CORRECT -->
<rect y="670" width="1280" height="50" fill="#dcc8a8" rx="8"/>
```

### Key Files

- docs/design/wireframes/.terminal-status.json (queue)
- docs/interoffice/audits/2026-01-15-auditor-g044-gap-analysis.md (root cause)
- docs/design/wireframes/GENERAL_ISSUES.md (G-044 added)
- docs/design/wireframes/validate-wireframe.py (new checks)

### Startup Sequence

1. `tmux attach -t scripthammer`
2. Reprime Inspector: `/clear` then `/prime inspector`
3. Check terminals: `for win in PreviewHost WireframeQA Validator Inspector Auditor; do tmux capture-pane -t scripthammer:$win -p | grep "% free"; done`
4. Dispatch PATCH tasks to Generator terminals
5. Push 28 commits when ready
