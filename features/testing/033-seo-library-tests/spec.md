# Feature Specification: SEO Library Tests

**Feature ID**: 033-seo-library-tests
**Created**: 2025-12-31
**Status**: Specified
**Category**: Testing

## Overview

Comprehensive unit test coverage for four SEO analysis modules: readability, keywords, content, and technical. These modules power the SEO Editorial Assistant feature and require thorough testing to ensure accurate calculations for Flesch readability scores, keyword density, content structure analysis, and technical SEO validation. Tests will cover all functions, edge cases, and error conditions.

---

## User Scenarios & Testing

### User Story 1 - Readability Module Tests (Priority: P1)

A test developer writes unit tests to verify that readability calculations return accurate scores for various text inputs.

**Why this priority**: Readability scores are prominently displayed to users. Inaccurate calculations directly impact user trust and content decisions.

**Independent Test**: Pass sample text with known characteristics, verify Flesch score matches expected value within tolerance.

**Acceptance Scenarios**:

1. **Given** text content with known syllable/word/sentence counts, **When** Flesch Reading Ease calculated, **Then** result matches expected score (±1 point tolerance)
2. **Given** content with sentences, **When** average sentence length calculated, **Then** count accurately reflects sentence boundaries
3. **Given** text with passive voice constructions, **When** passive voice percentage calculated, **Then** percentage correctly identifies passive sentences
4. **Given** paragraph text, **When** paragraph length analyzed, **Then** sentence counts per paragraph are accurate

---

### User Story 2 - Keywords Module Tests (Priority: P1)

A test developer writes unit tests to verify keyword analysis functions return accurate density and presence metrics.

**Why this priority**: Keyword optimization guidance is core SEO functionality. Incorrect calculations lead users to over/under-optimize content.

**Independent Test**: Pass content with known keyword frequency, verify density percentage matches expected value.

**Acceptance Scenarios**:

1. **Given** content with focus keyword appearing N times, **When** keyword density calculated, **Then** percentage equals (N × word_length / total_words × 100)
2. **Given** title containing focus keyword, **When** presence checked, **Then** function returns true
3. **Given** title NOT containing focus keyword, **When** presence checked, **Then** function returns false
4. **Given** content with keywords, **When** distribution analyzed, **Then** first/middle/last third positions are reported

---

### User Story 3 - Content Module Tests (Priority: P2)

A test developer writes unit tests to verify content structure analysis functions work correctly.

**Why this priority**: Content analysis supports readability features but is less user-visible than scores.

**Independent Test**: Pass HTML content with known structure, verify heading extraction and word counts are accurate.

**Acceptance Scenarios**:

1. **Given** text content, **When** word count calculated, **Then** count matches expected total (excluding HTML)
2. **Given** HTML with headings, **When** structure analyzed, **Then** all H1-H6 headings identified with levels
3. **Given** content with links, **When** links counted, **Then** internal and external link counts are accurate
4. **Given** content with images, **When** images analyzed, **Then** alt text presence/absence is reported

---

### User Story 4 - Technical Module Tests (Priority: P2)

A test developer writes unit tests to verify technical SEO validation functions identify issues correctly.

**Why this priority**: Technical checks prevent common SEO mistakes but are secondary to content quality metrics.

**Independent Test**: Pass titles and meta descriptions of various lengths, verify correct pass/fail status.

**Acceptance Scenarios**:

1. **Given** title of 55 characters, **When** length validated, **Then** status is "optimal"
2. **Given** title of 70 characters, **When** length validated, **Then** status is "too long"
3. **Given** meta description of 155 characters, **When** length validated, **Then** status is "optimal"
4. **Given** heading hierarchy with skipped levels (H1→H3), **When** validated, **Then** issue is identified

---

### Edge Cases

**Empty Input**:

- Empty string passed to any function
- Returns appropriate default (0, empty array, "N/A")
- Does not throw exception

**Very Long Content**:

- Content with 50,000+ words
- Functions complete without timeout
- Memory usage remains reasonable

**No Headings**:

- HTML content with no heading elements
- Returns empty heading array
- Does not affect other analysis

**No Links**:

- Content with no anchor elements
- Returns zero for both internal/external
- Ratio calculation handles divide-by-zero

**Unicode Characters**:

- Content with emoji, accented characters, CJK
- Word counting handles correctly
- No character encoding errors

**HTML Entities**:

- Content with &amp; &lt; &quot; etc.
- Entities decoded before analysis
- Word count reflects actual text

**Nested Markup**:

- Complex nested HTML structures
- Content extraction ignores tags
- Heading hierarchy correctly parsed

**Malformed HTML**:

- Unclosed tags, invalid nesting
- Graceful handling without crash
- Best-effort analysis of content

---

## Requirements

### Functional Requirements

**Readability Tests**:

- **FR-001**: Tests MUST verify Flesch Reading Ease calculation with known text samples
- **FR-002**: Tests MUST verify average sentence length calculation accuracy
- **FR-003**: Tests MUST verify passive voice detection and percentage calculation
- **FR-004**: Tests MUST verify paragraph length analysis

**Keyword Tests**:

- **FR-005**: Tests MUST verify keyword density calculation accuracy
- **FR-006**: Tests MUST verify focus keyword presence detection in titles
- **FR-007**: Tests MUST verify keyword distribution analysis across content sections
- **FR-008**: Tests MUST verify keyword stemming if implemented (e.g., "running" matches "run")

**Content Tests**:

- **FR-009**: Tests MUST verify word count calculation (excluding HTML tags)
- **FR-010**: Tests MUST verify heading structure extraction (H1-H6 levels)
- **FR-011**: Tests MUST verify internal vs external link counting
- **FR-012**: Tests MUST verify image alt text presence detection

**Technical Tests**:

- **FR-013**: Tests MUST verify title length validation (optimal: 50-60 chars)
- **FR-014**: Tests MUST verify meta description length validation (optimal: 150-160 chars)
- **FR-015**: Tests MUST verify heading hierarchy validation (no skipped levels)
- **FR-016**: Tests MUST verify canonical URL presence check if implemented

**Edge Case Tests**:

- **FR-017**: Tests MUST verify empty string handling for all functions
- **FR-018**: Tests MUST verify Unicode/special character handling
- **FR-019**: Tests MUST verify HTML entity decoding
- **FR-020**: Tests MUST verify malformed HTML handling

**Test Organization**:

- **FR-021**: Tests MUST be organized by module in separate test files
- **FR-022**: Tests MUST have clear, descriptive names
- **FR-023**: Tests MUST use arrange-act-assert pattern
- **FR-024**: Tests MUST include both positive and negative cases

### Non-Functional Requirements

**Coverage**:

- **NFR-001**: All 4 SEO modules MUST have 100% line coverage
- **NFR-002**: All public functions MUST have explicit tests
- **NFR-003**: All branches MUST have test coverage

**Performance**:

- **NFR-004**: Full SEO test suite MUST complete in under 5 seconds
- **NFR-005**: Individual tests MUST complete in under 100ms each
- **NFR-006**: Tests MUST NOT require external network calls

**Reliability**:

- **NFR-007**: Tests MUST be deterministic (same result every run)
- **NFR-008**: Tests MUST NOT have interdependencies
- **NFR-009**: Tests MUST NOT rely on execution order

**Maintainability**:

- **NFR-010**: Test descriptions MUST clearly explain what is being tested
- **NFR-011**: Test fixtures MUST be documented with expected values
- **NFR-012**: Assertion messages MUST explain failures clearly

### Key Entities

**SEO Modules Under Test**:

- readability.ts: Flesch score, sentence length, passive voice, paragraphs
- keywords.ts: Density, presence, distribution, stemming
- content.ts: Word count, headings, links, images
- technical.ts: Title length, meta length, heading hierarchy, canonical

**Test Files**:

- readability.test.ts
- keywords.test.ts
- content.test.ts
- technical.test.ts

**Test Fixtures**:

- Sample text with known characteristics
- HTML snippets with known structure
- Edge case inputs (empty, long, unicode, malformed)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% code coverage achieved for all 4 SEO modules
- **SC-002**: All identified edge cases have explicit test coverage
- **SC-003**: Full SEO test suite completes in under 5 seconds
- **SC-004**: Zero flaky tests (100% deterministic results)
- **SC-005**: All test descriptions clearly explain purpose
- **SC-006**: All tests follow arrange-act-assert pattern
- **SC-007**: CI pipeline passes with all SEO tests green
- **SC-008**: Coverage report shows no untested branches

---

## Dependencies

- **029-SEO Editorial Assistant**: SEO modules being tested
- **007-E2E Testing Framework**: Test runner and utilities

## Out of Scope

- Integration tests with the SEO editor component
- Performance benchmarking or optimization
- Visual regression testing
- E2E tests for SEO workflows (covered by other features)
- Testing third-party libraries (only testing our wrapper code)

## Assumptions

- SEO modules are already implemented and stable
- Test framework (Vitest) is configured in the project
- Code coverage tooling is available
- Test fixtures can use hardcoded sample content
- Module functions are pure (no side effects) making them easy to test
- No database or network access required for unit tests
