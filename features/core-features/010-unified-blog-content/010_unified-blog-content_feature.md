# Feature Specification: Unified Blog Content Pipeline

**Feature Number**: 010
**Category**: core-features
**Priority**: P2
**Status**: Draft
**Source**: Migrated from ScriptHammer_v_001 docs/specs/021

---

## Clarifications

### Session 2025-09-25

- Q: Should table of contents generation be always on, optional per post, based on word count, or never automatic? → A: Optional per post via frontmatter flag
- Q: How should conflicts be resolved - last-write-wins, manual merge UI, version branching, or lock-based? → A: Manual three-way merge with UI showing differences
- Q: When storage quota is exceeded, should system prevent saves, auto-compress, auto-delete, or hybrid approach? → A: Hybrid: Compress first, then warn before deletion

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a content creator, I need a unified blog system that allows me to write and edit blog posts both online and offline, with automatic synchronization when connectivity is restored, without requiring manual build steps or data regeneration.

### Acceptance Scenarios

1. **Given** a developer editing blog content in markdown files, **When** they save changes, **Then** the changes should automatically reflect in the development environment without manual regeneration
2. **Given** a user editing a blog post offline in the browser, **When** internet connectivity is restored, **Then** the offline changes should synchronize with the main content source without conflicts
3. **Given** concurrent edits to the same blog post from different sources, **When** synchronization occurs, **Then** the system should detect conflicts and provide resolution options
4. **Given** an existing blog with 50+ posts in markdown format, **When** the migration runs, **Then** all posts should be preserved with their metadata intact
5. **Given** a blog post with code blocks and special formatting with showToc flag enabled, **When** rendered in the browser, **Then** syntax highlighting and table of contents should be automatically generated

### Edge Cases

- What happens when storage quota is exceeded during offline editing? System will compress content first, then warn user before any deletions
- How does system handle malformed frontmatter in markdown files?
- What happens when two users edit the same post offline and sync at different times? Three-way merge UI will appear
- How does the system handle very large blog posts (>100KB)?
- What happens if migration fails partway through processing posts?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a single source of truth for blog content accessible by both build-time and runtime processes
- **FR-002**: System MUST automatically detect and process changes to markdown files without manual intervention
- **FR-003**: System MUST maintain full offline editing capabilities with local storage
- **FR-004**: System MUST synchronize offline edits with the main content source when connectivity is available
- **FR-005**: System MUST validate all blog post metadata against defined schemas
- **FR-006**: System MUST generate syntax highlighting for code blocks in blog posts
- **FR-007**: System MUST automatically generate table of contents for blog posts when the showToc frontmatter flag is set to true
- **FR-008**: System MUST support incremental builds to process only changed content
- **FR-009**: System MUST provide conflict detection when the same content is modified from multiple sources
- **FR-010**: System MUST offer manual three-way merge conflict resolution with a UI showing differences between versions
- **FR-011**: System MUST migrate all existing blog posts without data loss
- **FR-012**: System MUST maintain backward compatibility with existing blog URLs and slugs
- **FR-013**: System MUST cache processed content for performance optimization
- **FR-014**: System MUST provide hot reload capability in development environment
- **FR-015**: System MUST handle storage quota limitations by first attempting compression, then warning users before any content deletion

### Key Entities

- **Blog Post**: Represents a single article with content, metadata (title, author, date, tags, categories), and processing state
- **Post Metadata**: Structured information about a post including publication status, timestamps, categorization, and display preferences (showToc)
- **Sync Queue**: Collection of pending changes waiting for synchronization between offline and online states
- **Content Version**: Represents a specific version of a post to support conflict resolution with base, local, and remote versions for three-way merge
- **Processing Cache**: Temporary storage of processed content (HTML, TOC, etc.) for performance
- **Storage Quota**: Tracks usage and manages compression/cleanup when limits are approached

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Blog content changes reflect in development environment within 2 seconds of file save
- **SC-002**: Offline edits synchronize correctly with 100% data integrity when connectivity is restored
- **SC-003**: Conflict detection correctly identifies 100% of conflicting edits from multiple sources
- **SC-004**: All 50+ existing blog posts migrate successfully without data loss or broken URLs
- **SC-005**: Syntax highlighting renders correctly for all supported programming languages
- **SC-006**: Table of contents generates accurately for posts with showToc enabled
- **SC-007**: Incremental builds complete in <5 seconds for single-post changes
- **SC-008**: Three-way merge UI successfully resolves conflicts with clear visual diff

## Technical Approach

### Content Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Content Sources                              │
├─────────────────────────────────────────────────────────────────┤
│  Markdown Files          │  IndexedDB (Offline)                 │
│  (Build-time)            │  (Runtime)                           │
└─────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Unified Processing Pipeline                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Zod Schema Validation                                       │
│  2. Remark/Rehype Processing                                    │
│  3. Syntax Highlighting (Shiki)                                 │
│  4. TOC Generation (conditional)                                │
│  5. HTML Output                                                 │
└─────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Output Destinations                           │
├─────────────────────────────────────────────────────────────────┤
│  Static Build         │  IndexedDB Cache     │  Supabase Sync   │
│  (GitHub Pages)       │  (Offline)           │  (Persistence)    │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Strategy

1. **File Watch**: Development server watches markdown files for changes
2. **Hot Reload**: Changes trigger incremental rebuild and browser refresh
3. **Offline Queue**: IndexedDB stores pending changes when offline
4. **Conflict Detection**: Compare local/remote versions on sync
5. **Three-Way Merge**: Show diff UI for manual resolution

### Frontmatter Schema (Zod)

```typescript
const PostFrontmatter = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  author: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  showToc: z.boolean().default(false),
  draft: z.boolean().default(false),
  excerpt: z.string().optional(),
});
```

## MDX Component Integration

Blog posts can embed React components using MDX. Components must be pre-registered in the MDX provider:

```typescript
// src/lib/mdx/components.ts
import { Alert } from '@/components/Alert';
import { CodeBlock } from '@/components/CodeBlock';
import { Callout } from '@/components/Callout';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';

export const mdxComponents = {
  Alert,
  CodeBlock,
  Callout,
  YouTubeEmbed,
  // Custom element overrides
  pre: CodeBlock,
  blockquote: Callout,
};
```

**Usage in MDX**:

```mdx
---
title: Example Post
showToc: true
---

<Alert type="info">
  This is an important note using a React component inside MDX.
</Alert>

Regular markdown content continues here...
```

**MDX Processing Pipeline**:

1. Frontmatter extracted and validated against Zod schema
2. MDX content compiled with `@mdx-js/mdx`
3. React components resolved from `mdxComponents` map
4. Code blocks processed by Shiki for syntax highlighting
5. TOC generated if `showToc: true` in frontmatter

## Migration Strategy

1. **Inventory**: Scan all existing markdown files in blog directory
2. **Validate**: Check each post against Zod schema, flag issues
3. **Transform**: Process through unified pipeline
4. **Verify**: Compare output slugs against existing URLs
5. **Deploy**: Update build configuration to use new pipeline
6. **Cleanup**: Remove deprecated dual-system components
