# Memos: To Toolsmith

<!-- Newest first. Toolsmith acknowledges by moving to Archive section. -->

---

<!-- No pending memos -->

---

## Archive

<!-- Acknowledged memos moved here for reference -->

### 2026-01-15 18:30 - Three Validation Scripts (Acknowledged 2026-01-15)
**From**: Developer
**Resolution**: All three scripts already exist in `scripts/`:
- `validate-tasks.py` (340 lines) - Task format validation with `--fix`, `--json`, `--check-deps`
- `generate-component.py` (272 lines) - 5-file Constitution pattern generator
- `generate-ignores.py` (448 lines) - Multi-stack ignore file generator with auto-detect

Scripts are untracked in git. Recommend committing with next batch.

### 2026-01-14 22:45 - Wireframe skill audit (Acknowledged 2026-01-15)
**From**: Architect (via Operator)
**Resolution**: Fixed `/wireframe` skill line 91 `x=700` → `x=960`. Fixed `light-theme.svg` template title position. Dark theme `#ffffff` usages are correct (white text on dark backgrounds). The 261 color violations are in generated SVGs, not templates - generators need to regenerate affected features.
