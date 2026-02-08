# Feature: Blog Library Tests

**Feature ID**: 034
**Category**: testing
**Source**: ScriptHammer README (SPEC-051)
**Status**: Ready for SpecKit

## Description

Add unit tests for 3 untested blog modules: `src/lib/blog/seo-analyzer.ts`, `toc-generator.ts`, `markdown-processor.ts`. These modules handle blog content processing and need comprehensive test coverage.

## User Scenarios

### US-1: SEO Analyzer Tests (P1)

Unit tests verify blog-specific SEO analysis functions correctly.

**Acceptance Criteria**:

1. Given blog post, when analyzed, then SEO score calculated
2. Given frontmatter, when checked, then required fields validated
3. Given content, when issues found, then suggestions generated

### US-2: TOC Generator Tests (P1)

Unit tests verify table of contents generation from markdown.

**Acceptance Criteria**:

1. Given markdown with headings, when TOC generated, then structure correct
2. Given nested headings, when processed, then hierarchy preserved
3. Given duplicate headings, when IDs created, then all unique

### US-3: Markdown Processor Tests (P2)

Unit tests verify markdown processing for blog display.

**Acceptance Criteria**:

1. Given markdown content, when processed, then HTML output correct
2. Given code blocks, when rendered, then syntax highlighting applied
3. Given frontmatter, when parsed, then metadata extracted correctly

## Requirements

### Functional

**SEO Analyzer**

- FR-001: Test blog post SEO scoring
- FR-002: Test frontmatter validation
- FR-003: Test suggestion generation
- FR-004: Test category/tag analysis

**TOC Generator**

- FR-005: Test heading extraction
- FR-006: Test hierarchy preservation
- FR-007: Test unique ID generation
- FR-008: Test anchor link creation

**Markdown Processor**

- FR-009: Test markdown to HTML conversion
- FR-010: Test code block highlighting
- FR-011: Test frontmatter extraction
- FR-012: Test link transformation
- FR-013: Test image handling

### Test Files

```
tests/unit/lib/blog/
├── seo-analyzer.test.ts
├── toc-generator.test.ts
└── markdown-processor.test.ts
```

### Edge Cases

- Posts with no headings
- Deeply nested heading levels
- Frontmatter edge cases (missing fields, invalid dates)
- Special characters in headings
- Code blocks with various languages
- Images with missing alt text

### Out of Scope

- Visual rendering tests
- Performance benchmarking
- Browser compatibility tests

## Success Criteria

- SC-001: 90%+ code coverage for all 3 blog modules (100% unrealistic for edge cases)
- SC-002: All documented edge cases tested
- SC-003: Tests run in < 5 seconds total
- SC-004: No flaky tests
- SC-005: Structural assertions for HTML output (prefer over snapshots)

### Snapshot Test Strategy

**Prefer structural assertions over snapshots** to reduce test brittleness:

```typescript
// ❌ Brittle: Full HTML snapshot
expect(output).toMatchSnapshot();

// ✅ Better: Structural assertions
expect(output).toContain('<h1>');
expect(output).toMatch(/<pre class="language-\w+">/);
expect(wrapper.querySelectorAll('h2')).toHaveLength(3);

// ✅ For complex HTML: Targeted snapshot of semantic structure
expect(getHeadingStructure(output)).toMatchInlineSnapshot(`
  [
    { level: 1, text: "Title" },
    { level: 2, text: "Section 1" },
    { level: 2, text: "Section 2" },
  ]
`);
```

**When to use snapshots**:

- TOC structure (unlikely to change formatting)
- Code block language detection results
- Frontmatter parsing output

**When to use structural assertions**:

- HTML output (whitespace/formatting changes frequently)
- Error messages (wording may evolve)
- Complex nested structures
