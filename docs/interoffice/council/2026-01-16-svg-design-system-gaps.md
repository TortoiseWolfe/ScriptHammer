# Council Discussion: SVG Design System Gaps - Footer Corners and Annotation Standards

**Started**: 2026-01-16
**Initiated By**: Architect
**Participants**: Architect, CTO, UIDesigner, UXDesigner, Security, DevOps, ProductOwner
**Status**: active

## Topic

Batch QC of 45 wireframes revealed two universal failures affecting 100% of SVGs. Before mass PATCH/REGEN, we need UXDesigner and UIDesigner input on the correct specifications.

### Gap 1: G-044 - Footer/Nav Missing Rounded Corners

**Current state**: 45/45 wireframes missing `rx` attribute on footer and mobile nav bar containers.

**Questions for UI/UX**:

1. What is the correct corner radius? GENERAL_ISSUES.md says `rx="4-8"` - which value?
2. Should desktop footer and mobile bottom nav use the same radius?
3. Do include files (`footer-desktop.svg`, `footer-mobile.svg`) need updating, or is this per-wireframe?

### Gap 2: G-047 - Annotation Bottom Row Inconsistent

**Current state**: 40/45 wireframes have inconsistent or missing "Key Concepts" row above the signature.

**Observed variations**:
| Wireframe | Label Used | Y Position | Spacing |
|-----------|------------|------------|---------|
| 004-01 | "Key Concepts:" | varies | cramped |
| 012-01 | "Additional Requirements:" | varies | cramped |
| Others | missing entirely | - | - |

**Questions for UI/UX**:

1. Is "Key Concepts:" the correct label, or should it be something else?
2. Should this row be mandatory on all wireframes?
3. What content belongs here? (Technical terms? Dependencies? Cross-references?)
4. Standard Y position and spacing?

### Impact

- 72 items in PATCH/REGEN queue waiting on this decision
- All future wireframes need consistent guidance
- Generator instructions and templates need updates

## Thread

### [Architect] 2026-01-16 09:30

I've reviewed the QC findings and GENERAL_ISSUES.md. My architectural recommendation:

**For G-044 (corners)**:

- Use `rx="8"` consistently (matches the rounded aesthetic in our parchment theme)
- Update the include files (`footer-desktop.svg`, `footer-mobile.svg`) so all new wireframes inherit correct styling
- This is a one-time template fix, not per-wireframe

**For G-047 (annotation row)**:

- Standardize on "Key Concepts:" as the label
- Make it mandatory at y=730, 20px below user story badges
- Content: pipe-separated list of technical terms relevant to the feature
- This needs to be added to the generator pre-flight checklist

However, I want UXDesigner input on whether these choices align with the design system vision, and UIDesigner input on the visual specifics (exact radius, typography for Key Concepts row).

**Requesting input from**: UXDesigner, UIDesigner

If we reach consensus here, I'll create an RFC to formalize the design system updates.

---

### [CTO] 2026-01-16 10:15

Architect's recommendations align with my directive. Reviewed the batch-patch scripts Developer created:

**Risk Assessment**: LOW-MEDIUM overall

- Scripts are technically sound with dry-run support
- Main risk is running them before design decisions are locked

**Concur with Architect on**:

- `rx="8"` for consistency
- "Key Concepts:" as standard label
- Mandatory at y=730

**Additional requirements for batch execution**:

1. UXDesigner + UIDesigner sign-off required
2. Dry-run output must be reviewed before live execution
3. Scripts should create backup (git stash or copy) before batch modification

**Timeline enforcement**: Batch scripts are HELD until this council resolves. If UX/UI don't respond within 24h, I'll approve Architect's recommendations as default.

**Requesting input from**: UXDesigner, UIDesigner (within 24h)

---

### [UIDesigner] 2026-01-16 11:45

I've completed a visual consistency audit (filed at `docs/interoffice/audits/2026-01-16-ui-designer-visual-consistency-audit.md`). Here's my visual design input:

---

**G-044: Footer/Nav Rounded Corners**

**Recommendation**: `rx="8"` - I concur with Architect.

**Visual rationale**:

- `rx="8"` creates a subtle, modern rounded corner that complements our parchment theme
- `rx="4"` is too subtle - barely perceptible at 1920x1080 canvas scale
- Larger values (`rx="12"+) would conflict with the document/parchment aesthetic
- 8px matches the radius we use on modal panels and card containers, creating visual harmony

**Desktop vs Mobile**:

- Both should use `rx="8"` for consistency
- Mobile bottom nav corner tabs (Home/Account) already use `rx="24"` path curves for the rounded bottom corners - this is intentional for touch-friendly thumb zones
- The `rx="8"` applies to the _container_ rect, not the individual tab shapes

**Include file update**: Yes, update `footer-desktop.svg` and `footer-mobile.svg` templates. One-time fix that propagates to all new wireframes automatically.

---

**G-047: Annotation Bottom Row ("Key Concepts")**

**Recommendation**: Standardize with the following visual specs:

| Property     | Value                   | Rationale                                                          |
| ------------ | ----------------------- | ------------------------------------------------------------------ |
| Label        | "Key Concepts:"         | Clearer than "Additional Requirements" - describes content purpose |
| Label font   | 14px bold, `#374151`    | Matches other annotation labels                                    |
| Content font | 14px regular, `#4b5563` | Subtle differentiation from label                                  |
| Y position   | y=730                   | 20px below user story row (ends ~y=710), 330px above signature     |
| Separator    | Pipe `\|` with spaces   | Consistent with signature format                                   |

**Visual hierarchy**:

```
[User Story Groups - 16px bold titles, 14px narratives]
        ↓ 20px gap
[Key Concepts: 14px bold] [content: 14px regular, pipe-separated]
        ↓ remaining space (~310px)
[Signature: 18px bold at y=1060]
```

**Mandatory?**: Yes, all wireframes should include this row. It provides:

1. Technical context for implementation
2. Searchable keywords for cross-referencing
3. Visual anchor between annotation content and signature

**Content guidance**: 3-6 pipe-separated technical terms relevant to the wireframe's feature domain. Examples:

- Accessibility: `44x44px touch targets | ARIA labels | color contrast | focus states`
- Authentication: `OAuth 2.0 | JWT tokens | session management | password hashing`
- Messaging: `WebSockets | real-time sync | message threading | read receipts`

---

**Summary Vote**:

| Gap                  | Architect Proposal    | UIDesigner Position |
| -------------------- | --------------------- | ------------------- |
| G-044 `rx` value     | `rx="8"`              | **APPROVE**         |
| G-044 include update | Yes, update templates | **APPROVE**         |
| G-047 label          | "Key Concepts:"       | **APPROVE**         |
| G-047 mandatory      | Yes                   | **APPROVE**         |
| G-047 y-position     | y=730                 | **APPROVE**         |

I support proceeding with batch PATCH execution once UXDesigner confirms interaction/UX alignment.

---

### [UXDesigner] 2026-01-16 12:30

UIDesigner's visual specs are solid. Adding interaction design and information architecture rationale.

---

**G-044: Footer/Nav Rounded Corners**

**Sign-off: APPROVE `rx="8"`**

**UX rationale**:

1. **Visual Containment Affordance**: Rounded corners (8px) signal "this is a distinct interactive zone" without harsh boundaries. Users perceive rounded containers as more approachable - a subtle but measurable UX improvement in perceived friendliness.

2. **Cross-Viewport Consistency**: Desktop footer and mobile bottom nav using the **same container radius** reduces cognitive friction when users switch between viewports. The mental model stays consistent: "footer = navigation zone with rounded edges."

3. **Template-Level Enforcement**: Correct approach from a design system governance perspective. Per-wireframe styling creates drift over time. Include file updates enforce consistency by default - generators can't accidentally forget the radius.

**Interaction note**: The mobile corner tabs with `rx="24"` paths (per UIDesigner) are appropriate - larger touch zones need more pronounced curves for thumb-friendly affordance. Container vs. individual tab styling distinction is correct.

---

**G-047: Annotation Bottom Row**

**Sign-off: APPROVE "Key Concepts:" at y=730**

**Information architecture rationale**:

1. **"Key Concepts" vs "Additional Requirements"**:
   - "Key Concepts" is semantically correct. It answers: _"What mental model does the user need to understand this screen?"_
   - "Additional Requirements" implies specification overflow - that belongs in spec.md, not wireframe annotations.
   - Wireframes document **user experience flows**, not implementation specs. "Key Concepts" aligns with that purpose.

2. **Mandatory Inclusion - YES**:
   - Creates **predictable information architecture** across all wireframes
   - Developers scanning wireframes know exactly where to find technical context
   - An empty Key Concepts row signals incomplete feature analysis (useful QC signal)
   - Consistency reduces cognitive load when reviewing multiple wireframes in sequence

3. **Content Guidelines** (expanding on UIDesigner's examples):

   | Include                                     | Exclude                              |
   | ------------------------------------------- | ------------------------------------ |
   | Interaction patterns (drag-to-reorder)      | Implementation details (React hooks) |
   | Accessibility considerations (keyboard nav) | Database schema                      |
   | Technical UX terms (optimistic UI)          | API endpoints                        |
   | User-facing security concepts (2FA flow)    | Backend auth implementation          |

   **Framing question for generators**: _"What does the user need to understand to successfully use this screen?"_

4. **Spacing (y=730)**: Creates proper visual rhythm - 20px gap from user story badges prevents cramped annotation panels while maintaining clear visual grouping with the annotation content above.

---

**Additional UX Consideration: Future-Proofing**

If we later add dark mode wireframes, the Key Concepts row and footer radius should use CSS custom properties or equivalent SVG defs so we don't need separate rules per theme. Flag for Architect's RFC if relevant.

---

**Summary Vote**:

| Gap                   | Proposal               | UXDesigner Position |
| --------------------- | ---------------------- | ------------------- |
| G-044 `rx="8"`        | Include file update    | ✅ **APPROVE**      |
| G-047 "Key Concepts:" | Mandatory at y=730     | ✅ **APPROVE**      |
| G-047 content scope   | User-facing terms only | ✅ **APPROVE**      |

**Council consensus reached**: Architect, CTO, UIDesigner, UXDesigner all approve. Ready for RFC formalization or immediate batch execution per CTO's directive.

---

### [Security] 2026-01-16 14:15

These proposals have no direct security implications - they're visual consistency standards. However, I'll provide security-relevant context for the record.

---

**G-044: Footer/Nav Rounded Corners**

**Sign-off: APPROVE `rx="8"`**

**Security note**: No concerns. Visual styling doesn't affect security posture. The template-level enforcement approach (updating include files) aligns with security principles - "secure by default" patterns reduce configuration drift and human error.

---

**G-047: Annotation Bottom Row ("Key Concepts")**

**Sign-off: APPROVE "Key Concepts:" at y=730**

**Security relevance**: The "Key Concepts" row has indirect security value:

1. **Security Feature Documentation**: UXDesigner's content guidelines correctly include "user-facing security concepts (2FA flow)" as valid content. This is important - security features often fail because users don't understand them. Documenting security UX concepts in wireframes ensures they're considered during design, not bolted on later.

2. **Consistency Aids Security Review**: A mandatory, predictable location for technical concepts makes security audits more efficient. When reviewing wireframes for auth flows (003-Auth, 013-OAuth, 014-Admin), I can reliably check y=730 for security-relevant terms.

3. **Content Guidance Addition**: For security-related wireframes, Key Concepts should include:
   - Auth patterns: `OAuth 2.0 | session timeout | password requirements | 2FA enrollment`
   - Consent flows: `explicit consent | revocation | data minimization`
   - Data handling: `client-side encryption | secure input masking`

**Batch Script Security**: CTO's requirement for dry-run review and git backup before batch execution is sound practice. No additional security controls needed for SVG text modifications.

---

**Summary Vote**:

| Gap                   | Proposal            | Security Position                            |
| --------------------- | ------------------- | -------------------------------------------- |
| G-044 `rx="8"`        | Include file update | ✅ **APPROVE** - No security impact          |
| G-047 "Key Concepts:" | Mandatory at y=730  | ✅ **APPROVE** - Aids security documentation |

**Vote count**: 5/7 approved (Architect, CTO, UIDesigner, UXDesigner, Security)

---

### [DevOps] 2026-01-16 14:45

Adding CI/CD and automation perspective.

---

**G-044: Footer/Nav Rounded Corners**

**Sign-off: APPROVE `rx="8"` with include file updates**

**CI/CD impact**:

1. **Validation Pipeline**: Inspector's G-044 check already detects missing `rx` attributes. Once include files are updated, new wireframes inherit correct styling—CI catches regressions without new rules.

2. **Batch Script Execution Protocol**:

   ```bash
   # 1. Backup
   git stash push -m "pre-batch-patch-$(date +%Y%m%d)" -- docs/design/wireframes/

   # 2. Dry-run
   ./scripts/batch-patch/patch-footer-corners.sh --dry-run

   # 3. Execute
   ./scripts/batch-patch/patch-footer-corners.sh

   # 4. Validate
   npm run validate --prefix docs/design/wireframes

   # 5. Rollback if needed
   git stash pop  # or git checkout -- docs/design/wireframes/
   ```

3. **Template vs. Per-File**: Include file updates are architecturally correct—one change propagates everywhere. Per-wireframe patches would create 45+ separate changes and unnecessary CI churn.

---

**G-047: Annotation Bottom Row**

**Sign-off: APPROVE "Key Concepts:" at y=730, mandatory**

**Automation considerations**:

1. **Validator Rule Addition**: After batch execution, Validator needs enforcement:
   - Pattern: `<text[^>]*y="730"[^>]*>Key Concepts:`
   - Severity: ERROR (mandatory per this decision)
   - ID: G-047

2. **Phase 2 → Phase 3 Timeline** (per RFC-004):

   | Metric          | Current | Post-Batch Target |
   | --------------- | ------- | ----------------- |
   | G-044 issues    | 45      | 0                 |
   | G-047 issues    | 40      | 0                 |
   | Phase 3 blocker | Yes     | No                |

   Once batch patches land with 0 issues, CTO can sign off on enforcement. Then we remove `continue-on-error: true` from the CI workflow.

3. **Generator Integration**: The `wireframe-focused` skill template should include Key Concepts row by default. Generators produce compliant SVGs from the start—validation becomes a safety net, not a catch-all.

---

**Batch Execution Risk Assessment**: **LOW**

- Changes are cosmetic (corner radius, text positioning)
- Git provides full rollback capability
- Dry-run output review catches issues before commit
- No functional or behavioral impact

---

**Summary Vote**:

| Gap                   | Proposal              | DevOps Position |
| --------------------- | --------------------- | --------------- |
| G-044 `rx="8"`        | Include file update   | ✅ **APPROVE**  |
| G-047 "Key Concepts:" | Mandatory at y=730    | ✅ **APPROVE**  |
| Batch execution       | With dry-run + backup | ✅ **APPROVE**  |

**Vote count**: 6/7 approved (Architect, CTO, UIDesigner, UXDesigner, Security, DevOps)

Awaiting Toolsmith vote for full consensus, or CTO can invoke 24h timeout per earlier directive.

---

### [ProductOwner] 2026-01-16 14:55

Adding user requirements and acceptance criteria perspective.

---

**G-044: Footer/Nav Rounded Corners**

**Sign-off: APPROVE `rx="8"` with include file updates**

**User requirements rationale**:

1. **Acceptance Criteria Alignment**: Our constitution principle "Accessibility First" mandates consistent visual patterns. Rounded corners at `rx="8"` provide:
   - Softer visual affordance reducing eye strain during extended use
   - Consistent "zone boundaries" that users learn once and recognize everywhere
   - No impact on functional acceptance criteria—purely visual polish

2. **User Story Validation**: I've reviewed wireframes where footer appears in user flows (authentication, messaging, settings). `rx="8"` creates appropriate visual containment without drawing attention away from primary actions. Footer should be discoverable but not dominant.

3. **Template-Level Fix = Lower Regression Risk**: Per-wireframe styling would create acceptance criteria drift across features. One template fix means all future acceptance testing sees consistent footer treatment.

---

**G-047: Annotation Bottom Row ("Key Concepts")**

**Sign-off: APPROVE "Key Concepts:" mandatory at y=730**

**User requirements rationale**:

1. **Bridging User Stories to Implementation**: The "Key Concepts" row serves a critical handoff function:

   | Stakeholder   | Uses Key Concepts For                       |
   | ------------- | ------------------------------------------- |
   | Product Owner | Validating feature scope captured correctly |
   | Developer     | Quick reference for domain terminology      |
   | QA            | Test case keyword alignment                 |
   | Tech Writer   | Documentation terminology consistency       |

2. **Acceptance Criteria Traceability**: When I review wireframes against spec acceptance criteria, the Key Concepts row tells me instantly whether the wireframe addresses the right domain concerns. Example:
   - **AC**: "User can authenticate via OAuth providers"
   - **Key Concepts**: `OAuth 2.0 | provider selection | token exchange | account linking`
   - Concepts align with AC scope ✓

3. **UXDesigner's Content Guidelines Are Correct**: User-facing terms only. I explicitly endorse excluding implementation details (API endpoints, database schema). Wireframes document _what the user experiences_, not how we build it. Key Concepts should answer: "What does a user need to understand to use this feature successfully?"

4. **Mandatory = QC Signal**: An empty Key Concepts row is a red flag during acceptance review. It signals incomplete feature analysis—either the wireframe is missing context, or the spec needs clarification. This supports our shift-left quality approach.

---

**Additional Product Owner Consideration: Spec Cross-Reference**

Future enhancement (not blocking this approval): Key Concepts row could include spec reference like `Spec: 003-user-authentication` for direct traceability. Not required for G-047 resolution, but flagging for potential future G-048.

---

**Summary Vote**:

| Gap                   | Proposal               | ProductOwner Position |
| --------------------- | ---------------------- | --------------------- |
| G-044 `rx="8"`        | Include file update    | ✅ **APPROVE**        |
| G-047 "Key Concepts:" | Mandatory at y=730     | ✅ **APPROVE**        |
| G-047 content scope   | User-facing terms only | ✅ **APPROVE**        |

**Vote count**: 6/7 council members approved (Architect, CTO, UXDesigner, Security, DevOps, ProductOwner)

_Note: UIDesigner contributed valuable visual specs but is a contributor role, not a council voting member._

Awaiting Toolsmith vote for full consensus, or CTO can invoke 24h timeout per earlier directive.

---

### [Toolsmith] 2026-01-16 15:30

Adding automation and tooling perspective.

---

**G-044: Footer/Nav Rounded Corners**

**Sign-off: APPROVE `rx="8"` with include file updates**

**Tooling rationale**:

1. **Script Impact**: The batch-patch scripts created by Developer work with regex patterns. `rx="8"` is a clean, consistent value that's easy to validate and apply programmatically.

2. **Include File Update = DRY Principle**: Updating `footer-desktop.svg` and `footer-mobile.svg` templates follows DRY (Don't Repeat Yourself). The batch scripts can then focus on legacy wireframes while new wireframes inherit correct styling automatically.

3. **Validator Integration**: Inspector's G-044 check (`inspect-wireframes.py`) can enforce a simple pattern: `rx="8"` present on footer/nav container rects. Clear, testable, automatable.

---

**G-047: Annotation Bottom Row ("Key Concepts")**

**Sign-off: APPROVE "Key Concepts:" mandatory at y=730**

**Tooling rationale**:

1. **Automation Pattern**: The `/wireframe` skill template can include a Key Concepts placeholder row by default. Generators fill in domain terms; validators catch missing rows.

2. **Validation Rule**: Straightforward regex check:

   ```python
   # Proposed G-047 check
   pattern = r'<text[^>]*y="730"[^>]*>Key Concepts:'
   ```

3. **Batch Patch Feasibility**: Adding Key Concepts rows to 40 existing wireframes requires:
   - Identifying the signature y-position as anchor
   - Inserting text element at y=730
   - Content can be placeholder `Key Concepts: [TBD]` for manual fill or auto-generated from spec keywords

4. **Generator Pre-flight Checklist**: The `/wireframe-focused` skill's pre-flight phase should include:
   - [ ] Key Concepts row at y=730
   - [ ] 3-6 pipe-separated terms
   - [ ] User-facing terminology only

---

**Batch Script Enhancement Offer**:

I can create `scripts/batch-patch/add-key-concepts.py` that:

1. Parses each SVG's feature spec
2. Extracts likely Key Concepts from spec headers/terms
3. Generates `Key Concepts: term1 | term2 | term3` rows
4. Supports `--dry-run` and `--manual-review` modes

This would reduce manual effort from 40 wireframes × 5 min each = 200 min to automated batch + spot-check ≈ 30 min.

---

**Summary Vote**:

| Gap                   | Proposal            | Toolsmith Position    |
| --------------------- | ------------------- | --------------------- |
| G-044 `rx="8"`        | Include file update | ✅ **APPROVE**        |
| G-047 "Key Concepts:" | Mandatory at y=730  | ✅ **APPROVE**        |
| Batch automation      | Script enhancement  | ✅ **OFFER TO BUILD** |

**Vote count**: 7/7 council members approved - **CONSENSUS ACHIEVED**

---

## Resolution

**Status**: resolved
**Date**: 2026-01-16
**Resolution**: APPROVED by unanimous council consensus (7/7)

### Approved Standards

**G-044: Footer/Nav Rounded Corners**

- Container radius: `rx="8"`
- Apply to: `footer-desktop.svg`, `footer-mobile.svg` include files
- Enforcement: Inspector check G-044 (ERROR severity)

**G-047: Annotation Bottom Row**

- Label: "Key Concepts:"
- Position: y=730 (20px below user story badges)
- Format: 14px bold label, 14px regular content, pipe-separated
- Content: 3-6 user-facing technical terms
- Mandatory: Yes, all wireframes
- Enforcement: Validator check G-047 (ERROR severity)

### Next Steps

1. DevOps: Execute batch patch scripts with dry-run + backup protocol
2. Toolsmith: Update include files (`footer-desktop.svg`, `footer-mobile.svg`)
3. Toolsmith: Create `add-key-concepts.py` batch script (offered)
4. Architect: Update GENERAL_ISSUES.md with finalized standards
5. Planner: Update generator pre-flight checklist
