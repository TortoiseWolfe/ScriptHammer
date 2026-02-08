# Feature Specification: Unified Blog Content Pipeline

**Feature ID**: 010-unified-blog-content
**Created**: 2025-12-31
**Status**: Specified
**Category**: Core Features

## Overview

A unified blog content system enabling seamless writing and editing both online and offline, with automatic synchronization, conflict resolution, and real-time hot reload during development. Eliminates manual build steps and provides a single source of truth for all blog content.

---

## User Scenarios & Testing

### User Story 1 - Real-Time Development Editing (Priority: P1)

A developer editing blog content in markdown files expects changes to automatically reflect in the development environment without manual regeneration or build steps.

**Why this priority**: Core developer experience - immediate feedback during content creation is essential for productivity. Without this, the entire workflow is blocked.

**Independent Test**: Edit a markdown file, save, and verify the change appears in the browser within 2 seconds without manual intervention.

**Acceptance Scenarios**:

1. **Given** developer is running the development server, **When** they save changes to a markdown blog file, **Then** changes reflect in browser within 2 seconds
2. **Given** developer adds a new blog post file, **When** file is saved, **Then** post appears in blog listing without restart
3. **Given** developer edits frontmatter metadata, **When** file is saved, **Then** metadata changes (title, tags, date) update immediately

---

### User Story 2 - Offline Editing & Sync (Priority: P1)

A content creator editing blog posts offline in the browser expects their changes to automatically synchronize when connectivity is restored, preserving all edits.

**Why this priority**: Critical for mobile and unreliable network scenarios. Users must trust their work won't be lost.

**Independent Test**: Edit a post while offline, go online, verify changes sync with 100% data integrity.

**Acceptance Scenarios**:

1. **Given** user is editing a blog post, **When** network connectivity is lost, **Then** editing continues uninterrupted with local storage
2. **Given** user has made offline edits, **When** connectivity is restored, **Then** changes synchronize automatically without user intervention
3. **Given** offline edits exist, **When** sync completes, **Then** 100% of changes are preserved with no data loss

---

### User Story 3 - Conflict Resolution (Priority: P2)

When concurrent edits to the same blog post occur from different sources, the system must detect conflicts and provide clear resolution options through a three-way merge interface.

**Why this priority**: Essential for multi-device or multi-author scenarios, but less common than single-user editing.

**Independent Test**: Edit same post from two sources simultaneously, trigger sync, verify conflict UI appears with clear diff.

**Acceptance Scenarios**:

1. **Given** same post edited from two sources, **When** synchronization occurs, **Then** system detects the conflict
2. **Given** conflict is detected, **When** user views resolution UI, **Then** three-way merge shows base, local, and remote versions with visual diff
3. **Given** user resolves conflict, **When** they select/merge changes, **Then** resolved version becomes the new canonical version

---

### User Story 4 - Content Migration (Priority: P2)

An existing blog with 50+ posts in markdown format must be migrated to the unified system with all posts preserved, metadata intact, and URLs unchanged.

**Why this priority**: Critical for adoption but one-time operation. Existing content must not be broken.

**Independent Test**: Run migration on test data set, verify all posts accessible at original URLs with correct metadata.

**Acceptance Scenarios**:

1. **Given** existing blog with 50+ markdown posts, **When** migration runs, **Then** all posts are processed without errors
2. **Given** migration completes, **When** checking post URLs, **Then** all original URLs/slugs remain functional
3. **Given** migrated posts, **When** viewing metadata, **Then** title, author, date, tags, categories are preserved

---

### User Story 5 - Rich Content Rendering (Priority: P3)

Blog posts with code blocks and table of contents flag should render with proper syntax highlighting and auto-generated navigation.

**Why this priority**: Enhances readability but posts are functional without these features.

**Independent Test**: Create post with code blocks and `showToc: true`, verify syntax highlighting and TOC render correctly.

**Acceptance Scenarios**:

1. **Given** blog post contains code blocks, **When** rendered, **Then** syntax highlighting applies for all supported languages
2. **Given** blog post has `showToc: true` frontmatter, **When** rendered, **Then** table of contents generates from headings
3. **Given** blog post has `showToc: false` or omitted, **When** rendered, **Then** no table of contents appears

---

### Edge Cases

**Malformed Frontmatter**:

- Post has invalid or missing required frontmatter fields
- System displays validation error with specific field issues
- Post is skipped during build with clear warning in console

**Storage Quota Exceeded**:

- Offline storage reaches browser limits during editing
- System compresses existing content first
- If still insufficient, warns user before any deletion with option to export

**Large Post Handling**:

- Post exceeds 100KB in size
- System processes normally but may display progress indicator
- Performance targets still apply (incremental build <5s)

**Partial Migration Failure**:

- Migration fails partway through processing
- System logs failed posts, continues with remaining
- Generates migration report with success/fail count and specific errors

**Concurrent Offline Edits**:

- Two devices edit same post offline, sync at different times
- Later sync triggers conflict detection
- Three-way merge UI shows both versions against common base

**Network Interruption During Sync**:

- Connection drops mid-synchronization
- Partial sync is rolled back
- Changes remain in offline queue for retry

---

## Requirements

### Functional Requirements

**Content Source Management**:

- **FR-001**: System MUST provide a single source of truth for blog content accessible by both build-time and runtime processes
- **FR-002**: System MUST automatically detect changes to markdown files without manual intervention
- **FR-003**: System MUST support both markdown (.md) and MDX (.mdx) file formats

**Offline Capabilities**:

- **FR-004**: System MUST maintain full offline editing capabilities using browser local storage
- **FR-005**: System MUST queue offline changes for synchronization when connectivity returns
- **FR-006**: System MUST synchronize offline edits with main content source automatically on reconnection

**Content Validation**:

- **FR-007**: System MUST validate all blog post frontmatter against defined schema
- **FR-008**: System MUST reject posts with invalid frontmatter during build with clear error messages
- **FR-009**: Schema MUST enforce required fields: title, slug, author, date

**Content Processing**:

- **FR-010**: System MUST generate syntax highlighting for code blocks in all supported languages
- **FR-011**: System MUST generate table of contents when `showToc: true` frontmatter flag is set
- **FR-012**: System MUST NOT generate table of contents when flag is false or omitted
- **FR-013**: System MUST support MDX components embedded in blog content

**Build Performance**:

- **FR-014**: System MUST support incremental builds processing only changed content
- **FR-015**: System MUST cache processed content for performance optimization
- **FR-016**: System MUST provide hot reload capability in development environment

**Conflict Resolution**:

- **FR-017**: System MUST detect conflicts when same content is modified from multiple sources
- **FR-018**: System MUST provide three-way merge UI showing base, local, and remote versions
- **FR-019**: Conflict resolution UI MUST display visual diff highlighting differences
- **FR-020**: System MUST allow user to accept either version or manually merge

**Migration**:

- **FR-021**: System MUST migrate all existing blog posts without data loss
- **FR-022**: System MUST preserve existing URLs and slugs during migration
- **FR-023**: System MUST generate migration report with success/fail counts

**Storage Management**:

- **FR-024**: System MUST handle storage quota by first attempting compression
- **FR-025**: System MUST warn user before any content deletion due to quota
- **FR-026**: System MUST provide option to export content before deletion

### Non-Functional Requirements

**Performance**:

- **NFR-001**: Content changes MUST reflect in development environment within 2 seconds of file save
- **NFR-002**: Incremental builds MUST complete in under 5 seconds for single-post changes
- **NFR-003**: Full build MUST complete in under 30 seconds for 100 posts

**Reliability**:

- **NFR-004**: Offline edits MUST synchronize with 100% data integrity
- **NFR-005**: Conflict detection MUST identify 100% of conflicting edits
- **NFR-006**: System MUST not lose user content under any failure scenario

**Compatibility**:

- **NFR-007**: System MUST maintain backward compatibility with existing blog URLs
- **NFR-008**: System MUST support all major browsers with IndexedDB support

**Accessibility**:

- **NFR-009**: Conflict resolution UI MUST be keyboard navigable
- **NFR-010**: All editor interfaces MUST meet WCAG 2.1 AA compliance

### Key Entities

**Blog Post**:

- Single article with content and metadata
- Attributes: content (markdown/MDX), title, slug, author, date, tags, categories, showToc, draft, excerpt
- Relationships: Belongs to categories, has many tags

**Post Metadata (Frontmatter)**:

- Structured information validated against schema
- Required: title, slug, author, date
- Optional: tags, categories, showToc (default false), draft (default false), excerpt

**Sync Queue**:

- Collection of pending offline changes
- Attributes: post ID, change type (create/update/delete), timestamp, content diff
- State: pending, syncing, synced, conflict

**Content Version**:

- Specific version of a post for conflict resolution
- Types: base (common ancestor), local (user's version), remote (server version)
- Used for three-way merge comparison

**Processing Cache**:

- Temporary storage of processed HTML, TOC, syntax-highlighted code
- Keyed by content hash for invalidation

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Blog content changes reflect in development environment within 2 seconds of file save
- **SC-002**: Offline edits synchronize with 100% data integrity when connectivity is restored
- **SC-003**: Conflict detection correctly identifies 100% of conflicting edits
- **SC-004**: All existing blog posts migrate successfully without data loss or broken URLs
- **SC-005**: Syntax highlighting renders correctly for all supported programming languages
- **SC-006**: Table of contents generates accurately for posts with showToc enabled
- **SC-007**: Incremental builds complete in under 5 seconds for single-post changes
- **SC-008**: Three-way merge UI successfully displays visual diff for conflict resolution
- **SC-009**: Full build completes in under 30 seconds for 100 posts

---

## Dependencies

- **007-E2E Testing Framework**: Required for testing sync and conflict scenarios
- **020-PWA Background Sync**: Leverages service worker infrastructure for offline capabilities

## Out of Scope

- Real-time collaborative editing (Google Docs style)
- Version history beyond conflict resolution
- Scheduled post publishing
- Content approval workflows
- AI-assisted writing or suggestions
- Image optimization pipeline (handled separately)

## Assumptions

- Modern browsers with IndexedDB support are required
- Supabase provides persistence layer for synchronized content
- Content creators have basic markdown knowledge
- Migration is a one-time operation per deployment
- Posts larger than 100KB are rare edge cases

## Clarifications

### Session 2025-09-25

- Q: Should table of contents be automatic or optional? → A: Optional per post via `showToc` frontmatter flag
- Q: How should conflicts be resolved? → A: Manual three-way merge with UI showing differences
- Q: When storage quota exceeded? → A: Hybrid approach - compress first, then warn before deletion
