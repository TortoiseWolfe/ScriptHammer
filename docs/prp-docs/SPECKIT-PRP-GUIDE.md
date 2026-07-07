# Quick Reference: PRP/SpecKit Workflow

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**For**: ScriptHammer developers implementing features

---

## 📋 Command Cheat Sheet

```bash
# 1. Write PRP document
vim docs/prp-docs/<feature-name>-prp.md

# 2. Convert to feature branch
./scripts/prp-to-feature.sh <feature-name> <number>

# 3. Run SpecKit workflow
/specify <feature description>
/clarify  # Optional: resolve ambiguities
/plan <optional technical context>
/tasks <optional context>
/implement  # Or execute manually
/analyze  # Optional: consistency check

# 4. Commit and PR
git add . && git commit && git push
```

---

## 🔄 Workflow Diagram

```
[1. Write PRP] → docs/prp-docs/<name>-prp.md
    ↓
[2. Create Branch] → ./scripts/prp-to-feature.sh
    ↓
[3. /specify] → docs/specs/<branch>/spec.md
    ↓
[4. /clarify] → (optional) updated spec.md
    ↓
[5. /plan] → plan.md + research.md + data-model.md + quickstart.md
    ↓
[6. /tasks] → tasks.md (numbered, ordered)
    ↓
[7. /implement] → Execute tasks (code + tests)
    ↓
[8. /analyze] → (optional) Consistency report
    ↓
[9. Commit & PR] → Merge to main
```

---

## 📁 Artifact Map

| Command             | Generates           | Location                            | Purpose                        |
| ------------------- | ------------------- | ----------------------------------- | ------------------------------ |
| Manual              | PRP document        | `docs/prp-docs/<name>-prp.md`       | Product requirements           |
| `prp-to-feature.sh` | Initial spec        | `docs/specs/<branch>/spec.md`       | PRP copied to specs            |
| `/specify`          | Specification       | `docs/specs/<branch>/spec.md`       | SpecKit-formatted requirements |
| `/clarify`          | Clarifications      | `docs/specs/<branch>/spec.md`       | Resolved ambiguities           |
| `/plan`             | Implementation plan | `docs/specs/<branch>/plan.md`       | Architecture & approach        |
| `/plan`             | Research            | `docs/specs/<branch>/research.md`   | Technical decisions            |
| `/plan`             | Data model          | `docs/specs/<branch>/data-model.md` | Entities & schemas             |
| `/plan`             | Quickstart          | `docs/specs/<branch>/quickstart.md` | Integration scenarios          |
| `/plan`             | Contracts           | `docs/specs/<branch>/contracts/`    | API specs (if applicable)      |
| `/tasks`            | Task list           | `docs/specs/<branch>/tasks.md`      | Implementation tasks           |
| `/implement`        | Code & tests        | `src/`, tests/                      | Feature implementation         |
| `/analyze`          | Report              | Console output                      | Consistency validation         |

---

## 🎯 When to Use Full Workflow

### ✅ Use PRP/SpecKit Workflow For:

- New features (medium to high complexity)
- External service integrations (APIs, third-party services)
- Significant refactoring or architectural changes
- Features requiring multiple components
- Features taking >1 day to implement
- Features with unclear or evolving requirements
- Privacy-sensitive features (GDPR compliance needed)

### ❌ Skip Workflow For:

- Bug fixes (unless requiring architectural changes)
- Typo corrections and documentation tweaks
- Dependency version bumps (routine maintenance)
- Simple styling changes (CSS/Tailwind adjustments)
- Emergency hotfixes
- Features taking <2 hours

**Rule of Thumb**: If you're unsure whether to use the workflow, use it. Better documented than undocumented.

---

## 📝 PRP Structure (7 Sections)

```markdown
# Product Requirements Prompt (PRP)

**Feature Name**: [Name]
**Priority**: P0/P1/P2/P3
**Status**: 📥 Inbox
**Created**: [Date]

## 1. Product Requirements

- What We're Building (1-2 sentences)
- Why We're Building It (business value, 3-5 bullets)
- Success Criteria (measurable, checkboxes)
- Out of Scope (explicit exclusions)

## 2. Context & Codebase Intelligence

- Existing Patterns to Follow (code examples)
- Dependencies & Libraries (with versions)
- File Structure (where code will go)

## 3. Technical Specifications

- Implementation approach (with code snippets)
- Architecture diagrams (if complex)
- Configuration examples (actual configs)

## 4. Implementation Runbook

- Step-by-step execution (numbered)
- Bash commands (copy-pasteable)
- Expected outputs (what to expect)

## 5. Validation Loops

- Pre-implementation checks
- During implementation checks
- Post-implementation verification

## 6. Risk Mitigation

- List potential risks
- Mitigation strategy for each

## 7. References

- Internal docs (links to codebase)
- External resources (documentation URLs)
- Related PRPs (cross-references)
```

---

## 🚦 Common Patterns

### Pattern 1: New Component

```bash
# Write PRP emphasizing 5-file structure
vim docs/prp-docs/my-component-prp.md

# Create branch and run workflow
./scripts/prp-to-feature.sh my-component 023
/specify New atomic button component with size/color variants
/plan Use component generator, follow 5-file pattern, DaisyUI theme support
/tasks

# Execute (use generator)
docker compose exec scripthammer pnpm run generate:component MyButton
# ... implement following tasks.md
```

### Pattern 2: External Service Integration

```bash
# Write PRP with privacy/consent focus
vim docs/prp-docs/analytics-service-prp.md

# Create branch with GDPR context
./scripts/prp-to-feature.sh analytics-service 024
/specify Analytics integration with GDPR compliance and consent
/plan Consent modal required before loading, respect user choice
/tasks

# Implement consent flow FIRST, then integration
```

### Pattern 3: Documentation Feature

```bash
# Write PRP focused on docs (like this one!)
vim docs/prp-docs/feature-docs-prp.md

# Run workflow
./scripts/prp-to-feature.sh feature-docs 025
/specify Documentation for [feature] with real codebase examples
/plan Markdown files in docs/, use existing PRPs as examples
/tasks

# Write documentation following style guide
```

---

## ⚠️ Common Pitfalls

| Pitfall                              | Solution                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| **Writing HOW in PRP**               | PRPs describe WHAT/WHY, not HOW. Save implementation details for `/plan`          |
| **Skipping `/specify`**              | Always convert PRP format → SpecKit format. Don't use PRP as spec.md directly     |
| **Wrong command order**              | Follow sequence: `/specify` → `/plan` → `/tasks` → `/implement`. Don't skip steps |
| **Manual component creation**        | Always use `pnpm run generate:component`. CI/CD will fail otherwise               |
| **Tasks without tests**              | TDD is mandatory. Write tests first, then implement (RED-GREEN-REFACTOR)          |
| **Ignoring `[NEEDS CLARIFICATION]`** | Resolve all ambiguities with `/clarify` before planning                           |
| **Missing `[P]` markers**            | Mark parallel tasks so they can run concurrently. Speeds up implementation        |
| **Forgetting to update tasks.md**    | Mark tasks `[x]` as you complete them. Tracks progress                            |

---

## 🎓 Real Examples

### Example 1: PRP-010 (EmailJS Integration)

**What**: Backup email service with automatic failover from Web3Forms

**Workflow**:

1. PRP written with provider pattern and retry logic
2. `/specify` → 8 functional requirements generated
3. `/plan` → Provider abstraction, exponential backoff, rate limiting
4. `/tasks` → 15 tasks (setup → tests → implementation → polish)
5. `/implement` → 100% test coverage achieved

**Files Created**:

- `src/services/email/providers/emailjs.ts`
- `src/services/email/email-service.ts`
- Comprehensive test suite

**Outcome**: Production-ready email service in 1 day with 100% coverage

### Example 2: PRP-013 (Calendar Integration)

**What**: Embedded scheduling with Calendly and Cal.com support

**Workflow**:

1. PRP identified GDPR implications early (consent needed)
2. `/specify` → User scenarios included consent flow
3. `/clarify` → Which providers? (Answer: both Calendly and Cal.com)
4. `/plan` → Dynamic imports, consent modal pattern
5. `/tasks` → 12 tasks (consent UI → provider integration → tests)

**Files Created**:

- `src/components/calendar/CalendarEmbed/`
- `src/components/privacy/CalendarConsentModal/`
- Integration tests

**Outcome**: GDPR-compliant calendar integration with <150KB bundle impact

### Example 3: PRP-001 (This Guide!)

**What**: Document PRP/SpecKit methodology integration

**Workflow**:

1. PRP written with 7 sections (prp-methodology-prp.md)
2. `/specify` → 13 FR, 5 NFR generated
3. `/clarify` → No ambiguities (comprehensive PRP)
4. `/plan` → Documentation strategy with real examples
5. `/tasks` → 14 documentation tasks
6. `/implement` → This guide you're reading!

**Files Created**:

- This file (`SPECKIT-PRP-GUIDE.md`)
- Updates to `PRP-WORKFLOW.md`
- Updates to `CLAUDE.md`

**Outcome**: Demonstrates workflow by using it (dogfooding)

---

## 📊 Task Markers

### Understanding Task Notation

```markdown
## Phase: Documentation Writing

### T004: [P] Write quick reference guide

### T005: [P] Update workflow documentation

### T006: [P] Add real examples

### T007: Update CLAUDE.md (depends on T004)
```

**Key**:

- `T###` = Task number for tracking
- `[P]` = Parallel - can run concurrently with other `[P]` tasks
- No `[P]` = Sequential - must run in order (dependencies or shared files)
- `depends on T###` = Explicit dependency noted

**Parallel Tasks**: Different files, no dependencies → can work simultaneously
**Sequential Tasks**: Same file or dependencies → must complete in order

---

## 🔬 Validation Test

**Can you implement PRP-012 (Visual Regression)?**

Try this walkthrough:

```bash
# 1. Read comprehensive guide
cat docs/prp-docs/prp-methodology-prp.md  # Full methodology
cat docs/prp-docs/SPECKIT-PRP-GUIDE.md    # This quick reference

# 2. Write PRP
vim docs/prp-docs/visual-regression-testing-prp.md
# (Use visual-regression-testing-prp.md as reference)

# 3. Run workflow
./scripts/prp-to-feature.sh visual-regression 012
/specify Visual regression testing with Chromatic for Storybook
/plan Focus on Storybook integration, test 4 themes initially
/tasks
# Review tasks.md and execute

# 4. Success criteria
✓ Did you complete PRP-012 without external help?
✓ Did documentation answer your questions?
✓ Were examples clear and actionable?
✓ Could you follow the workflow end-to-end?
```

If **yes** to all → Documentation successful!

---

## 🔗 Related Documentation

- **Full Guide**: [PRP Methodology](./prp-methodology-prp.md) (comprehensive)
- **Workflow**: [PRP-WORKFLOW.md](./PRP-WORKFLOW.md) (process details)
- **Status**: [PRP-STATUS.md](./PRP-STATUS.md) (tracking dashboard)
- **Constitution**: `/.specify/memory/constitution.md` (principles)
- **Templates**: `/.specify/templates/` (SpecKit templates)
- **Commands**: `/.claude/commands/` (slash command definitions)
- **Project Guide**: `/CLAUDE.md` (development instructions)

---

## 🆘 Troubleshooting

### Issue: `/specify` says spec already exists

**Solution**: You're on a feature branch with existing spec.md. Either:

- Delete `docs/specs/<branch>/spec.md` and run `/specify` again
- Switch to a different branch
- Use the existing spec.md if it's current

### Issue: SpecKit scripts not found

**Solution**: Scripts in `.specify/scripts/bash/` may not exist in all repos. SpecKit commands work without them (they manually resolve paths). This is normal.

### Issue: PRP too vague, can't generate concrete spec

**Solution**:

1. Run `/clarify` to identify gaps
2. Answer clarification questions
3. Iterate on PRP with more detail
4. Run `/specify` again

### Issue: Generated tasks have circular dependencies

**Solution**:

1. Review `tasks.md` dependency graph
2. Manually reorder tasks if needed
3. Report issue for template improvement

### Issue: Don't know if feature needs full workflow

**Solution**: Use decision tree above. **When in doubt, use the workflow**. Documentation overhead is better than lack of documentation.

### Issue: Forgot to mark tasks complete

**Solution**: Edit `docs/specs/<branch>/tasks.md` and change `[ ]` to `[x]` for completed tasks. Helps track progress.

---

## 💡 Pro Tips

1. **Start Small**: First PRP? Pick something simple to learn the workflow
2. **Use Examples**: Copy structure from similar completed PRPs
3. **Be Specific**: Clear success criteria → clear implementation
4. **Test Early**: `/analyze` before `/implement` catches issues early
5. **Commit Often**: Commit after each phase (specify, plan, tasks)
6. **Real Examples**: Reference actual PRPs, not hypotheticals
7. **Ask Questions**: Use `/clarify` liberally - better to ask than guess

---

**Quick Reference Complete** - Keep this handy while implementing PRPs!

_Generated via PRP-001 SpecKit workflow demonstrating the methodology_
