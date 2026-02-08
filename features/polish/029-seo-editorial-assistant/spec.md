# Feature Specification: SEO Editorial Assistant with Export System

**Feature ID**: 029-seo-editorial-assistant
**Created**: 2025-12-31
**Status**: Specified
**Category**: Polish

## Overview

An SEO Editorial Assistant integrated with the blog editor that provides real-time content optimization analysis and suggestions. Content creators can edit existing markdown blog posts with live SEO feedback showing readability scores, keyword optimization, and structural improvements. The system supports exporting bundles of posts as ZIP files for email-based review workflows, enabling content round-trips compatible with GitHub Pages static deployment.

---

## User Scenarios & Testing

### User Story 1 - Edit Existing Blog Post with SEO Analysis (Priority: P1)

A content creator wants to edit an existing blog post while receiving real-time SEO feedback to improve content quality.

**Why this priority**: Core feature value - SEO analysis during editing is the primary use case. Without this, the feature has no purpose.

**Independent Test**: Open existing post in editor, modify content, verify SEO panel updates in real-time with overall score.

**Acceptance Scenarios**:

1. **Given** blog post exists in the system, **When** user clicks "Edit Post", **Then** editor opens with full content loaded including frontmatter
2. **Given** editor is open with content, **When** user types or modifies text, **Then** SEO analysis panel updates within 500ms (debounced)
3. **Given** changes have been made, **When** user clicks "Save", **Then** markdown file is updated with all frontmatter preserved
4. **Given** post has focus keyword defined, **When** viewing SEO panel, **Then** keyword optimization metrics are displayed

---

### User Story 2 - SEO Score and Suggestions (Priority: P1)

A content creator wants to see their SEO score and receive actionable suggestions to improve content ranking potential.

**Why this priority**: Essential companion to editing - the score and suggestions guide content improvements.

**Independent Test**: Edit a post with poor SEO metrics, verify score displays 0-100 with specific improvement suggestions.

**Acceptance Scenarios**:

1. **Given** post is being edited, **When** SEO panel is visible, **Then** overall score (0-100) is prominently displayed
2. **Given** score is below 70, **When** viewing suggestions section, **Then** prioritized list of actionable improvements is shown
3. **Given** user makes recommended changes, **When** content updates, **Then** traffic light indicator transitions (red→yellow→green)
4. **Given** all metrics pass, **When** viewing SEO panel, **Then** green indicator and "Optimized" status are displayed

---

### User Story 3 - Export Posts as ZIP Bundle (Priority: P2)

A content creator wants to export selected posts with their SEO reports for developer review before deployment.

**Why this priority**: Enables email-based workflow for teams without direct git access. Important for non-technical content teams.

**Independent Test**: Select multiple posts, click export, verify ZIP downloads with correct structure and contents.

**Acceptance Scenarios**:

1. **Given** one or more posts are selected, **When** "Export Selected" is clicked, **Then** ZIP file downloads automatically
2. **Given** ZIP is downloaded and opened, **When** viewing contents, **Then** contains posts/, seo-reports/, manifest.json, and summary.md
3. **Given** manifest.json is viewed, **When** parsing contents, **Then** shows export date, post list, changes made, and SEO scores per post
4. **Given** summary.md is viewed, **When** reading contents, **Then** human-readable overview of all exported posts is shown

---

### User Story 4 - Import ZIP Bundle (Priority: P2)

A developer wants to import an exported ZIP bundle to update blog posts in the repository.

**Why this priority**: Completes the round-trip workflow enabling content creator → developer handoff.

**Independent Test**: Run import script with valid ZIP, verify markdown files are placed correctly in /blog directory.

**Acceptance Scenarios**:

1. **Given** valid ZIP bundle, **When** import script is executed, **Then** markdown files are copied to /blog directory
2. **Given** import would overwrite existing files, **When** importing, **Then** diff is shown for review before proceeding
3. **Given** successful import, **When** reviewing git status, **Then** changes are staged and ready for commit
4. **Given** invalid ZIP structure, **When** import attempted, **Then** clear error message explains the issue

---

### User Story 5 - Terminal-Friendly SEO Output (Priority: P3)

A developer wants to copy SEO analysis results in a terminal-friendly format for CI/CD integration or automation workflows.

**Why this priority**: Enables advanced automation use cases. Nice-to-have for technical users.

**Independent Test**: Click "Show Terminal Output", verify structured text is displayed and copyable.

**Acceptance Scenarios**:

1. **Given** SEO analysis is complete, **When** "Show Terminal Output" is clicked, **Then** copyable structured text is displayed
2. **Given** terminal output is copied and pasted, **When** viewed in terminal, **Then** formatting is preserved and readable
3. **Given** automation script parses output, **When** extracting metrics, **Then** all scores and suggestions are accessible

---

### Edge Cases

**Empty or Malformed Frontmatter**:

- Post has no frontmatter or invalid YAML
- System adds default frontmatter structure on save
- User is warned about missing required fields

**Very Long Content**:

- Post exceeds 10,000 words
- SEO analysis may take longer but completes
- User sees loading indicator during analysis

**No Focus Keyword**:

- Post has no focus keyword defined
- System prompts user to add focus keyword
- Keyword-specific metrics show "N/A" until defined

**Export with No Posts Selected**:

- User clicks export with no selection
- System shows message "Select at least one post to export"
- Export button remains disabled until selection made

**Import Conflict Resolution**:

- ZIP contains posts that differ from current versions
- System shows side-by-side diff for each conflict
- User chooses to keep existing, use imported, or merge manually

**Offline Mode**:

- User loses network during editing
- Local changes are preserved in browser storage
- Sync message shown when connection restored

**Invalid ZIP Structure**:

- Imported ZIP missing required directories or manifest
- System validates structure before attempting import
- Clear error message identifies what's missing

---

## Requirements

### Functional Requirements

**Editor Functionality**:

- **FR-001**: System MUST load existing markdown files from the blog directory structure
- **FR-002**: System MUST parse YAML frontmatter and display editable fields
- **FR-003**: System MUST preserve all frontmatter fields on save (no data loss)
- **FR-004**: System MUST support slug-based post navigation (e.g., /blog/editor?slug=post-slug)
- **FR-005**: System MUST work offline after initial page load (PWA capability)
- **FR-006**: System MUST provide autosave functionality to prevent data loss

**SEO Analysis Metrics**:

- **FR-007**: System MUST calculate Flesch readability score (target range: 60-70)
- **FR-008**: System MUST analyze average sentence length (target: 15-20 words)
- **FR-009**: System MUST analyze paragraph length (target: 3-5 sentences)
- **FR-010**: System MUST calculate passive voice percentage (target: <10%)
- **FR-011**: System MUST validate title length (optimal: 50-60 characters)
- **FR-012**: System MUST validate meta description length (optimal: 150-160 characters)
- **FR-013**: System MUST validate heading hierarchy (H1 → H2 → H3, no skipped levels)
- **FR-014**: System MUST check word count minimum (minimum: 300 words)
- **FR-015**: System MUST analyze keyword density (target: 2-3%)
- **FR-016**: System MUST check focus keyword presence in title

**SEO Display**:

- **FR-017**: System MUST display overall SEO score (0-100) prominently
- **FR-018**: System MUST display traffic light indicator (red/yellow/green) based on score
- **FR-019**: System MUST display prioritized list of improvement suggestions
- **FR-020**: System MUST update SEO metrics in real-time (debounced) during editing

**Export System**:

- **FR-021**: System MUST generate ZIP bundle containing posts and SEO reports
- **FR-022**: System MUST create manifest.json with bundle metadata (date, posts, changes, scores)
- **FR-023**: System MUST include human-readable summary.md in export
- **FR-024**: System MUST support selective post export (user chooses which posts)
- **FR-025**: System MUST include SEO reports in both JSON and TXT formats

**Import System**:

- **FR-026**: System MUST validate ZIP bundle structure before import
- **FR-027**: System MUST preserve markdown file structure during import
- **FR-028**: System MUST provide command-line import script for developer use
- **FR-029**: System MUST show diff for conflicting files before overwrite
- **FR-030**: System MUST NOT modify files outside the designated blog directory

**Terminal Output**:

- **FR-031**: System MUST provide copyable terminal-friendly SEO output
- **FR-032**: Terminal output MUST use structured format parseable by scripts

### Non-Functional Requirements

**Performance**:

- **NFR-001**: SEO score updates MUST be debounced (300-500ms delay) during typing
- **NFR-002**: Export MUST generate within 3 seconds for up to 10 posts
- **NFR-003**: Import validation MUST complete within 1 second for standard bundles
- **NFR-004**: Editor MUST load and be interactive within 2 seconds

**Data Integrity**:

- **NFR-005**: Zero data loss during export/import round-trip
- **NFR-006**: Frontmatter fields MUST be preserved exactly as authored
- **NFR-007**: Markdown formatting MUST be preserved exactly during save

**Accessibility**:

- **NFR-008**: All editor components MUST achieve WCAG 2.1 AA compliance
- **NFR-009**: SEO score indicators MUST have text alternatives for screen readers
- **NFR-010**: Traffic light colors MUST have additional non-color indicators

**Reliability**:

- **NFR-011**: Autosave MUST preserve work every 30 seconds during active editing
- **NFR-012**: System MUST recover gracefully from browser crashes (restore from autosave)

### Key Entities

**Blog Post**:

- Attributes: slug, title, content (markdown), frontmatter (YAML), word count, last modified
- Relationships: Has one SEO Analysis, may be in Export Bundle

**SEO Analysis**:

- Attributes: overall score (0-100), readability score, sentence length avg, paragraph analysis, passive voice %, title length, meta description length, heading hierarchy status, keyword density, focus keyword presence
- Relationships: Belongs to one Blog Post

**Export Bundle**:

- Attributes: export date, post count, manifest, summary
- Structure: posts/, seo-reports/, manifest.json, summary.md
- Relationships: Contains many Blog Posts, contains many SEO Reports

**SEO Report**:

- Attributes: post slug, score, metrics breakdown, suggestions list
- Formats: JSON (machine-readable), TXT (human-readable)

**Import Validation**:

- Attributes: is valid, errors list, conflicts list
- Used for: Pre-import verification

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can edit existing blog posts with real-time SEO analysis displayed
- **SC-002**: SEO score updates within 500ms of typing (debounced, not on every keystroke)
- **SC-003**: Export generates valid ZIP bundle with posts/, seo-reports/, manifest.json, and summary.md
- **SC-004**: Import preserves markdown structure and frontmatter with zero data loss
- **SC-005**: Terminal output is parseable by standard text processing tools (grep, awk, jq)
- **SC-006**: Round-trip test (export → import) results in byte-identical markdown files
- **SC-007**: All editor components pass WCAG 2.1 AA accessibility audit
- **SC-008**: 10-post export completes in under 3 seconds

---

## Dependencies

- **010-Unified Blog Content**: Blog post structure and content source
- **001-WCAG AA Compliance**: Accessibility standards for editor UI
- **020-PWA Background Sync**: Offline capability for editor

## Out of Scope

- Direct git commits from within the editor interface
- Database storage of blog posts (static files only)
- Automated email sending of export bundles
- Real-time collaborative editing (multiple users)
- Version control or history within the editor
- AI-powered content suggestions
- Multi-language SEO analysis

## Assumptions

- Blog posts are stored as markdown files with YAML frontmatter
- Users have basic understanding of SEO concepts (readability, keywords)
- Developers are comfortable with command-line tools for import
- ZIP file format is universally accessible across platforms
- Browser local storage is available for autosave functionality
- Static export model (GitHub Pages) is the deployment target
