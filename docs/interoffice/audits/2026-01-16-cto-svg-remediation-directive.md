# CTO Directive: SVG Remediation Strategy

**Date**: 2026-01-16  
**From**: CTO Terminal  
**Re**: Batch QC Results - Zero Clean Wireframes

## Situation

QC review of 45 wireframes found 0 compliant SVGs:

- **G-044**: 45/45 missing `rx=8` on footer/nav (100%)
- **G-047**: 40/45 missing Key Concepts row (89%)
- **SIGNATURE**: 11/22 misaligned in batch004

This is a template/generator defect, not individual file errors.

## Directive

### Phase 1: Standards Lock (Architect + UIDesigner)

- Review and finalize SVG structure standards
- Produce canonical template with correct footer `rx=8` and Key Concepts row
- Document in `docs/design/wireframes/GENERAL_ISSUES.md` or dedicated standards file

### Phase 2: Detection Automation (Toolsmith + Inspector)

- Update `inspect-wireframes.py` for G-044, G-047, SIGNATURE checks
- Integrate into validation pipeline
- Target: Catch 100% of these issues automatically

### Phase 3: Batch Remediation (Developer)

- Create single script applying canonical fixes
- Only execute after Phase 2 detection is operational
- Validate results with automated checks

## Rationale

- Patching before fixing generators creates rework
- 4-6k tokens/PNG for visual QC is unsustainable
- Automated detection enables continuous compliance

## Timeline

Phases are sequential. Do not begin Phase 3 until Phase 2 delivers working detection.

---

_Persisted per project rule: terminal output is ephemeral._
