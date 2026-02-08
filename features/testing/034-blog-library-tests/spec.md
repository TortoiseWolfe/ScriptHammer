# Feature Specification: Blog Library Tests

**Feature ID**: 034-blog-library-tests
**Created**: 2025-12-31
**Status**: Specified
**Category**: Testing

## Overview

Comprehensive unit test coverage for three blog content processing modules: SEO analyzer, table of contents generator, and markdown processor. These modules power the blog system's content analysis and rendering pipeline. Tests focus on structural assertions over snapshot testing to reduce brittleness and improve maintainability.

---

## User Scenarios & Testing

### User Story 1 - SEO Analyzer Tests (Priority: P1)

A test developer writes unit tests to verify blog-specific SEO analysis produces accurate scores and actionable suggestions.

**Why this priority**: SEO scores directly influence content quality decisions. Inaccurate analysis leads to poor content optimization.

**Independent Test**: Pass blog post content with known SEO characteristics, verify score and suggestions match expectations.

**Acceptance Scenarios**:

1. **Given** blog post content, **When** SEO score calculated, **Then** score reflects content quality (0-100)
2. **Given** post with frontmatter, **When** fields validated, **Then** missing required fields identified
3. **Given** post with SEO issues, **When** analyzed, **Then** specific improvement suggestions generated
4. **Given** post with categories and tags, **When** analyzed, **Then** proper usage and count validated

---

### User Story 2 - TOC Generator Tests (Priority: P1)

A test developer writes unit tests to verify table of contents generation extracts headings and creates proper navigation structure.

**Why this priority**: TOC is prominently displayed and aids navigation. Incorrect hierarchy or broken links frustrate readers.

**Independent Test**: Pass markdown with known heading structure, verify TOC output matches expected hierarchy.

**Acceptance Scenarios**:

1. **Given** markdown with H1-H6 headings, **When** TOC generated, **Then** all headings extracted in order
2. **Given** nested heading levels (H2 under H1, H3 under H2), **When** TOC generated, **Then** hierarchy correctly represented
3. **Given** duplicate heading text, **When** IDs generated, **Then** all IDs are unique (e.g., "intro", "intro-1", "intro-2")
4. **Given** headings with special characters, **When** anchor links created, **Then** IDs are URL-safe

---

### User Story 3 - Markdown Processor Tests (Priority: P2)

A test developer writes unit tests to verify markdown-to-HTML conversion handles all content types correctly.

**Why this priority**: Core rendering functionality but less user-visible than TOC or SEO scores.

**Independent Test**: Pass markdown with various elements, verify HTML output contains expected structures.

**Acceptance Scenarios**:

1. **Given** markdown with standard syntax, **When** processed, **Then** HTML output contains correct semantic elements
2. **Given** code blocks with language specified, **When** rendered, **Then** syntax highlighting classes applied
3. **Given** markdown with YAML frontmatter, **When** parsed, **Then** metadata extracted as structured object
4. **Given** content with internal/external links, **When** processed, **Then** links transformed appropriately

---

### Edge Cases

**Posts With No Headings**:

- Markdown has no H1-H6 elements
- TOC generator returns empty array
- SEO analyzer notes missing structure

**Deeply Nested Headings**:

- Content has H1→H2→H3→H4→H5→H6 structure
- All levels correctly captured in TOC
- Hierarchy maintained at all depths

**Frontmatter Edge Cases**:

- Missing required fields (title, date)
- Invalid date formats
- Extra unknown fields (preserved)
- Empty frontmatter block

**Special Characters in Headings**:

- Headings with emoji, quotes, ampersands
- ID generation sanitizes to URL-safe slugs
- Display text preserved with original characters

**Code Blocks**:

- Various language identifiers (js, python, tsx, bash)
- No language specified (generic styling)
- Empty code blocks
- Very long code blocks

**Images**:

- Missing alt text (flagged)
- External image URLs
- Relative image paths
- Images with captions

**Malformed Markdown**:

- Unclosed code fences
- Mixed heading styles (# and underline)
- Broken link syntax

---

## Requirements

### Functional Requirements

**SEO Analyzer Tests**:

- **FR-001**: Tests MUST verify blog post SEO score calculation
- **FR-002**: Tests MUST verify frontmatter field validation (required: title, date, description)
- **FR-003**: Tests MUST verify SEO suggestion generation for common issues
- **FR-004**: Tests MUST verify category and tag analysis
- **FR-005**: Tests MUST verify image alt text checking

**TOC Generator Tests**:

- **FR-006**: Tests MUST verify heading extraction from markdown
- **FR-007**: Tests MUST verify heading hierarchy preservation (nesting)
- **FR-008**: Tests MUST verify unique ID generation for duplicate headings
- **FR-009**: Tests MUST verify anchor link creation with URL-safe IDs
- **FR-010**: Tests MUST verify heading level filtering if implemented (e.g., H2-H3 only)

**Markdown Processor Tests**:

- **FR-011**: Tests MUST verify markdown to HTML conversion accuracy
- **FR-012**: Tests MUST verify code block syntax highlighting class application
- **FR-013**: Tests MUST verify frontmatter extraction and parsing
- **FR-014**: Tests MUST verify link transformation (internal vs external)
- **FR-015**: Tests MUST verify image handling and path resolution
- **FR-016**: Tests MUST verify list rendering (ordered and unordered)

**Edge Case Tests**:

- **FR-017**: Tests MUST verify empty/no-heading content handling
- **FR-018**: Tests MUST verify deeply nested heading structures
- **FR-019**: Tests MUST verify frontmatter validation edge cases
- **FR-020**: Tests MUST verify special character handling in headings
- **FR-021**: Tests MUST verify malformed markdown handling

**Test Strategy**:

- **FR-022**: Tests MUST use structural assertions over full HTML snapshots
- **FR-023**: Tests MUST use targeted inline snapshots only for stable structures (TOC, frontmatter)
- **FR-024**: Tests MUST have clear, descriptive names explaining what is tested

### Non-Functional Requirements

**Coverage**:

- **NFR-001**: All 3 blog modules MUST have 90%+ line coverage
- **NFR-002**: All public functions MUST have explicit tests
- **NFR-003**: All branches MUST have test coverage where practical

**Performance**:

- **NFR-004**: Full blog library test suite MUST complete in under 5 seconds
- **NFR-005**: Individual tests MUST complete in under 100ms each
- **NFR-006**: Tests MUST NOT require file system access beyond fixtures

**Reliability**:

- **NFR-007**: Tests MUST be deterministic (same result every run)
- **NFR-008**: Tests MUST NOT have interdependencies
- **NFR-009**: Structural assertions MUST be resilient to whitespace changes

**Maintainability**:

- **NFR-010**: Test descriptions MUST clearly explain what is being tested
- **NFR-011**: Inline snapshots MUST include context comments
- **NFR-012**: Test fixtures MUST be documented with expected behaviors

### Key Entities

**Blog Modules Under Test**:

- seo-analyzer.ts: Post scoring, frontmatter validation, suggestions, category/tag analysis
- toc-generator.ts: Heading extraction, hierarchy, unique IDs, anchor links
- markdown-processor.ts: HTML conversion, syntax highlighting, frontmatter, links, images

**Test Files**:

- seo-analyzer.test.ts
- toc-generator.test.ts
- markdown-processor.test.ts

**Test Fixtures**:

- Sample blog posts with known characteristics
- Markdown with various element types
- Edge case content (empty, deeply nested, malformed)

**Test Assertion Types**:

- Structural assertions: Check element presence, count, attributes
- Inline snapshots: For stable output structures only
- Value assertions: For scores, counts, boolean flags

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 90%+ code coverage achieved for all 3 blog modules
- **SC-002**: All documented edge cases have explicit test coverage
- **SC-003**: Full blog library test suite completes in under 5 seconds
- **SC-004**: Zero flaky tests (100% deterministic results)
- **SC-005**: Structural assertions used instead of HTML snapshots
- **SC-006**: All test descriptions clearly explain purpose
- **SC-007**: CI pipeline passes with all blog tests green
- **SC-008**: No test failures from whitespace/formatting changes

---

## Dependencies

- **010-Unified Blog Content**: Blog modules being tested
- **007-E2E Testing Framework**: Test runner and utilities

## Out of Scope

- Visual rendering tests in browser
- Performance benchmarking
- Browser compatibility testing
- E2E tests for blog workflows
- Testing markdown parsing library itself (only our wrapper code)
- Dark mode / theme-specific rendering tests

## Assumptions

- Blog modules are already implemented and stable
- Test framework (Vitest) is configured in the project
- Code coverage tooling is available
- Test fixtures can use hardcoded sample content
- Markdown processor uses a well-tested library (we test our wrapper)
- Syntax highlighting library provides predictable class names
