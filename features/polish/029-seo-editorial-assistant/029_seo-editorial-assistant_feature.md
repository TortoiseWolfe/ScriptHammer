# Feature: SEO Editorial Assistant with Export System

**Feature ID**: 029
**Category**: polish
**Source**: ScriptHammer/docs/specs/020-seo-editorial-assistant
**Status**: Ready for SpecKit

## Description

An SEO Editorial Assistant that integrates with the blog editor to provide real-time SEO analysis and content optimization suggestions. Supports editing existing markdown blog posts, analyzing SEO performance, and exporting bundles of posts as ZIP files for email-based workflows. Enables content round-trips for GitHub Pages deployment model.

## User Scenarios

### US-1: Edit Existing Blog Post (P1)

A user edits an existing blog post with real-time SEO analysis feedback.

**Acceptance Criteria**:

1. Given blog post exists, when "Edit Post" clicked, then editor opens with content loaded
2. Given editor open, when user types, then SEO panel updates in real-time
3. Given changes made, when saved, then markdown file is updated with frontmatter preserved

### US-2: SEO Analysis (P1)

User receives real-time SEO scoring and suggestions during editing.

**Acceptance Criteria**:

1. Given post being edited, when SEO panel visible, then overall score (0-100) shown
2. Given low score, when viewing suggestions, then actionable improvements listed
3. Given score changes, when user edits, then traffic light indicator updates (red/yellow/green)

### US-3: Export Posts as ZIP Bundle (P2)

User exports selected posts with SEO reports for developer review.

**Acceptance Criteria**:

1. Given posts selected, when "Export Selected" clicked, then ZIP file downloads
2. Given ZIP downloaded, when opened, then contains posts/, seo-reports/, and manifest.json
3. Given manifest, when viewed, then shows changes and SEO scores per post

### US-4: Import ZIP Bundle (P2)

Developer imports ZIP bundle to update blog posts.

**Acceptance Criteria**:

1. Given ZIP bundle, when import script run, then markdown files copied to /blog
2. Given conflicting files, when importing, then git shows diff for review
3. Given successful import, when committed, then changes deploy to GitHub Pages

### US-5: Terminal Output (P3)

User can copy terminal-friendly SEO report for automation workflows.

**Acceptance Criteria**:

1. Given SEO analysis complete, when "Show Terminal Output" clicked, then copyable text shown
2. Given terminal output, when pasted, then structured format is parse-able
3. Given automation script, when parsing output, then all metrics extractable

## Requirements

### Functional

**Editor**

- FR-001: Load and edit existing markdown files from `/blog` directory
- FR-002: Parse and preserve frontmatter on save
- FR-003: Support slug-based routing (`/blog/editor?slug=post-slug`)
- FR-004: Work offline after initial load

**SEO Analysis**

- FR-005: Real-time Flesch readability score (target: 60-70)
- FR-006: Average sentence length analysis (target: 15-20 words)
- FR-007: Paragraph length analysis (target: 3-5 sentences)
- FR-008: Passive voice percentage (target: <10%)
- FR-009: Title length check (50-60 characters)
- FR-010: Meta description check (150-160 characters)
- FR-011: Heading hierarchy validation (H1 → H2 → H3)
- FR-012: Word count minimum (300 words)
- FR-013: Keyword density analysis (2-3%)
- FR-014: Focus keyword presence in title

**Export System**

- FR-015: Generate ZIP bundle with posts and SEO reports
- FR-016: Create manifest.json with bundle metadata
- FR-017: Include human-readable summary.md
- FR-018: Support selective post export

**Import System**

- FR-019: Validate bundle structure before import
- FR-020: Preserve markdown file structure
- FR-021: Provide import script for CLI usage

### Non-Functional

- NFR-001: SEO score updates debounced during editing
- NFR-002: Export generates within 3 seconds for 10 posts
- NFR-003: No data loss during round-trip (export/import)
- NFR-004: Accessible (WCAG AA compliant)

### Export Bundle Format

```
blog-export-YYYY-MM-DD.zip
├── manifest.json
├── posts/
│   └── *.md
├── seo-reports/
│   ├── *-seo.json
│   └── *-seo.txt
└── summary.md
```

### Out of Scope

- Direct git commits from editor
- Database storage of blog posts
- Automated email sending
- Real-time collaboration
- Version control within editor

## Success Criteria

- SC-001: Can edit existing blog posts with SEO analysis
- SC-002: SEO score updates in real-time (debounced)
- SC-003: Export creates valid ZIP with all components
- SC-004: Import preserves markdown structure perfectly
- SC-005: Terminal output is parse-able by scripts
- SC-006: No data loss during round-trip
