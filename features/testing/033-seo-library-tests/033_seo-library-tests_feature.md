# Feature: SEO Library Tests

**Feature ID**: 033
**Category**: testing
**Source**: ScriptHammer_v_001 README (SPEC-050)
**Status**: Ready for SpecKit

## Description

Add unit tests for 4 untested SEO modules: `src/lib/seo/readability.ts`, `keywords.ts`, `content.ts`, `technical.ts`. These modules provide SEO analysis functionality and need comprehensive test coverage.

## User Scenarios

### US-1: Readability Module Tests (P1)

Unit tests verify readability calculations are accurate.

**Acceptance Criteria**:

1. Given text content, when Flesch score calculated, then result matches expected value
2. Given sentences, when average length calculated, then count is accurate
3. Given passive voice text, when detected, then percentage is correct

### US-2: Keywords Module Tests (P1)

Unit tests verify keyword analysis functions correctly.

**Acceptance Criteria**:

1. Given content with keywords, when density calculated, then percentage is accurate
2. Given title with focus keyword, when checked, then presence detected
3. Given content, when keyword distribution analyzed, then positions reported

### US-3: Content Module Tests (P2)

Unit tests verify content analysis features.

**Acceptance Criteria**:

1. Given text, when word count calculated, then count is accurate
2. Given HTML content, when structure analyzed, then headings identified
3. Given links, when counted, then internal/external ratio correct

### US-4: Technical Module Tests (P2)

Unit tests verify technical SEO checks.

**Acceptance Criteria**:

1. Given title, when length checked, then within/outside limits detected
2. Given meta description, when length checked, then status correct
3. Given heading hierarchy, when validated, then issues identified

## Requirements

### Functional

- FR-001: Test Flesch Reading Ease calculation accuracy
- FR-002: Test average sentence length calculation
- FR-003: Test passive voice detection
- FR-004: Test keyword density calculation
- FR-005: Test focus keyword presence in title
- FR-006: Test keyword distribution analysis
- FR-007: Test word count calculation
- FR-008: Test heading structure analysis
- FR-009: Test link ratio calculation
- FR-010: Test title length validation
- FR-011: Test meta description length validation
- FR-012: Test heading hierarchy validation

### Test Files

```
tests/unit/lib/seo/
├── readability.test.ts
├── keywords.test.ts
├── content.test.ts
└── technical.test.ts
```

### Edge Cases

- Empty strings
- Very long content
- Content with no headings
- Content with no links
- Unicode characters
- HTML entities
- Nested markup

### Out of Scope

- Integration tests with editor
- Performance benchmarking
- Visual regression tests

## Success Criteria

- SC-001: 100% code coverage for all 4 SEO modules
- SC-002: All edge cases tested
- SC-003: Tests run in < 5 seconds total
- SC-004: No flaky tests
- SC-005: Clear test descriptions for maintainability
