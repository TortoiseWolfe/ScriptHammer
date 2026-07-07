# Implementation Tasks: Complete Blog System with Markdown Content Pipeline

**Feature**: 022-markdown-first-content
**Branch**: `022-markdown-first-content`
**Date**: 2025-01-25

## Overview

Building a NEW blog system from scratch with markdown-first content architecture, offline capabilities, and social features. Total tasks: 48

## Task List

### Setup & Dependencies (T001-T004) ✅

**[X] T001** - Install blog system dependencies [P]

- File: `package.json`
- Add: dexie, lz-string, markdown-to-jsx, gray-matter, prismjs, chokidar
- Add dev dependencies: @types/prismjs, msw for API mocking
- Run: `docker compose exec scripthammer pnpm install`

**[X] T002** - Configure TypeScript paths for blog system [P] ✅

- File: `tsconfig.json`
- Add path aliases: @blog/_, @blog-components/_, @blog-services/\*
- Ensure strict mode enabled for new code

**[X] T003** - Setup blog directory structure [P] ✅

- Create directories:
  - `/public/blog/` (markdown source files)
  - `/src/lib/blog/` (core libraries)
  - `/src/services/blog/` (business logic)
  - `/src/components/blog/` (UI components)
  - `/src/app/api/blog/` (API routes)
  - `/src/app/blog/` (UI pages)
  - `/src/data/` (author registry)
  - `/src/types/` (TypeScript interfaces)

**[X] T004** - Create blog configuration files [P] ✅

- File: `/src/config/blog.config.ts`
- Define: storage limits, sync intervals, cache TTL
- File: `/src/config/social-platforms.ts`
- Define: platform configs with share URL templates

### Contract Tests (T005-T013) - All Parallel [P] ✅

**[X] T005** - Create contract test for GET /api/blog/posts [P] ✅

- File: `/src/tests/contract/blog-posts-list.test.ts`
- Test: query params, pagination, response schema
- Use MSW to mock responses

**[X] T006** - Create contract test for POST /api/blog/posts [P] ✅

- File: `/src/tests/contract/blog-posts-create.test.ts`
- Test: validation, required fields, success response

**[X] T007** - Create contract test for GET /api/blog/posts/{id} [P] ✅

- File: `/src/tests/contract/blog-posts-get.test.ts`
- Test: slug lookup, 404 handling

**[X] T008** - Create contract test for PUT /api/blog/posts/{id} [P] ✅

- File: `/src/tests/contract/blog-posts-update.test.ts`
- Test: version conflict, validation

**[X] T009** - Create contract test for DELETE /api/blog/posts/{id} [P] ✅

- File: `/src/tests/contract/blog-posts-delete.test.ts`
- Test: successful deletion, 404 handling

**[X] T010** - Create contract test for POST /api/blog/sync [P] ✅

- File: `/src/tests/contract/blog-sync.test.ts`
- Test: sync payload, conflict detection

**[X] T011** - Create contract test for POST /api/blog/conflicts/{id}/resolve [P] ✅

- File: `/src/tests/contract/blog-conflicts.test.ts`
- Test: resolution types, merge validation

**[X] T012** - Create contract test for GET /api/blog/authors [P] ✅

- File: `/src/tests/contract/blog-authors.test.ts`
- Test: author list, profile data

**[X] T013** - Create contract test for GET /api/blog/storage [P] ✅

- File: `/src/tests/contract/blog-storage.test.ts`
- Test: quota calculation, limits

### Data Models & Types (T014-T019) - All Parallel [P]

**T014** - Create BlogPost TypeScript interfaces [P]

- File: `/src/types/blog.ts`
- Define: BlogPost, PostStatus, SyncStatus interfaces
- Include all fields from data-model.md

**T015** - Create Author TypeScript interfaces [P]

- File: `/src/types/author.ts`
- Define: Author, AuthorReference, SocialLink interfaces
- Include social platform enums

**T016** - Create metadata TypeScript interfaces [P]

- File: `/src/types/metadata.ts`
- Define: PostMetadata, TOCItem, CodeBlock interfaces

**T017** - Create sync TypeScript interfaces [P]

- File: `/src/types/sync.ts`
- Define: SyncQueueEntry, ContentVersion, ConflictInfo

**T018** - Create storage TypeScript interfaces [P]

- File: `/src/types/storage.ts`
- Define: StorageQuota, ProcessingCache interfaces

**T019** - Create social TypeScript interfaces [P]

- File: `/src/types/social.ts`
- Define: ShareEvent, SocialPlatformConfig interfaces

### Core Libraries (T020-T025)

**T020** - Implement Dexie.js database schema

- File: `/src/lib/blog/database.ts`
- Setup: IndexedDB with Dexie, define tables and indexes
- Include migration logic

**T021** - Implement markdown processor

- File: `/src/lib/blog/markdown-processor.ts`
- Parse: frontmatter with gray-matter
- Render: markdown to JSX with markdown-to-jsx
- Depends on: T020

**T022** - Implement content compression

- File: `/src/lib/blog/compression.ts`
- Compress/decompress with LZ-String
- Handle quota management

**T023** - Implement syntax highlighting

- File: `/src/lib/blog/syntax-highlighter.ts`
- Setup Prism.js with dynamic language loading
- Generate highlighted HTML

**T024** - Implement TOC generator

- File: `/src/lib/blog/toc-generator.ts`
- Extract headings from markdown
- Build nested TOC structure

**T025** - Implement conflict resolver

- File: `/src/lib/blog/conflict-resolver.ts`
- Three-way merge logic
- Diff generation for UI
- Depends on: T020

### Services Layer (T026-T030)

**T026** - Create blog post service

- File: `/src/services/blog/post-service.ts`
- CRUD operations with IndexedDB
- Caching logic
- Depends on: T020, T021

**T027** - Create offline sync service

- File: `/src/services/blog/sync-service.ts`
- Queue management
- Background sync coordination
- Depends on: T020, T025

**T028** - Create storage management service

- File: `/src/services/blog/storage-service.ts`
- Quota tracking
- Cleanup strategies
- Depends on: T020, T022

**T029** - Create author service

- File: `/src/services/blog/author-service.ts`
- Author registry management
- Social link validation

**T030** - Create social sharing service

- File: `/src/services/blog/social-service.ts`
- Share event tracking
- Meta tag generation

### API Routes (T031-T038)

**T031** - Implement GET /api/blog/posts

- File: `/src/app/api/blog/posts/route.ts`
- List posts with filtering and pagination
- Depends on: T026

**T032** - Implement POST /api/blog/posts

- File: `/src/app/api/blog/posts/route.ts`
- Create new post
- Depends on: T026

**T033** - Implement GET/PUT/DELETE /api/blog/posts/[id]

- File: `/src/app/api/blog/posts/[id]/route.ts`
- Single post operations
- Depends on: T026

**T034** - Implement POST /api/blog/sync

- File: `/src/app/api/blog/sync/route.ts`
- Handle offline sync
- Depends on: T027

**T035** - Implement POST /api/blog/conflicts/[id]/resolve

- File: `/src/app/api/blog/conflicts/[id]/resolve/route.ts`
- Resolve conflicts
- Depends on: T027

**T036** - Implement GET /api/blog/authors

- File: `/src/app/api/blog/authors/route.ts`
- List authors
- Depends on: T029

**T037** - Implement GET /api/blog/storage

- File: `/src/app/api/blog/storage/route.ts`
- Storage quota info
- Depends on: T028

**T038** - Implement POST /api/blog/share

- File: `/src/app/api/blog/share/route.ts`
- Track share events
- Depends on: T030

### UI Components (T039-T043)

**T039** - Generate BlogPostCard component

- Run: `docker compose exec scripthammer pnpm run generate:component BlogPostCard`
- Implement: post preview with metadata
- Location: `/src/components/blog/`

**T040** - Generate BlogPostViewer component

- Run: `docker compose exec scripthammer pnpm run generate:component BlogPostViewer`
- Implement: full post display with TOC
- Depends on: T024

**T041** - Generate AuthorProfile component

- Run: `docker compose exec scripthammer pnpm run generate:component AuthorProfile`
- Implement: author bio and social links

**T042** - Generate SocialShareButtons component

- Run: `docker compose exec scripthammer pnpm run generate:component SocialShareButtons`
- Implement: platform-specific share buttons

**T043** - Generate ConflictResolver component

- Run: `docker compose exec scripthammer pnpm run generate:component ConflictResolver`
- Implement: three-way merge UI
- Depends on: T025

### UI Pages (T044-T046)

**T044** - Create blog listing page

- File: `/src/app/blog/page.tsx`
- Display: post grid with filtering
- Depends on: T039

**T045** - Create blog post page

- File: `/src/app/blog/[slug]/page.tsx`
- Display: full post with author and sharing
- Depends on: T040, T041, T042

**T046** - Create blog editor page

- File: `/src/app/blog/editor/page.tsx`
- Offline-capable markdown editor
- Depends on: T026, T043

### Integration & Polish (T047-T048)

**T047** - Implement Service Worker for offline support

- File: `/public/service-worker.js`
- Cache strategies for blog content
- Background sync registration
- Depends on: T027

**T048** - Create blog content generation script

- File: `/scripts/generate-blog-data.js`
- Process markdown files to JSON
- Add to package.json scripts
- Depends on: T021

## Execution Strategy

### Parallel Execution Groups

**Group 1: Initial Setup** (Can run all in parallel)

```bash
# Execute T001-T004 simultaneously
Task agent T001 "Install blog dependencies"
Task agent T002 "Configure TypeScript paths"
Task agent T003 "Setup directory structure"
Task agent T004 "Create config files"
```

**Group 2: Contract Tests** (All parallel - different files)

```bash
# Execute T005-T013 simultaneously
Task agent T005 "Contract test for list posts"
Task agent T006 "Contract test for create post"
Task agent T007 "Contract test for get post"
# ... continue for all contract tests
```

**Group 3: Type Definitions** (All parallel - different files)

```bash
# Execute T014-T019 simultaneously
Task agent T014 "BlogPost interfaces"
Task agent T015 "Author interfaces"
Task agent T016 "Metadata interfaces"
# ... continue for all type files
```

**Group 4: Sequential Core** (Must be done in order)

```bash
# T020 first (database setup)
Task agent T020 "Dexie database schema"

# Then T021-T024 can be parallel
Task agent T021 "Markdown processor"
Task agent T022 "Content compression"
Task agent T023 "Syntax highlighting"
Task agent T024 "TOC generator"

# T025 depends on T020
Task agent T025 "Conflict resolver"
```

### Dependencies Summary

- **Independent** (can start immediately): T001-T019
- **Depends on T020** (database): T021, T025, T026, T027, T028
- **Depends on services**: T031-T038 (API routes need services)
- **Depends on libraries**: T039-T046 (UI needs processors)
- **Final integration**: T047-T048 (needs all infrastructure)

## Success Criteria

1. All contract tests pass (T005-T013)
2. Blog posts render from markdown files
3. Offline editing works with IndexedDB
4. Social sharing shows proper previews
5. Conflict resolution UI functions
6. Hot reload works in <500ms
7. All TypeScript compiles without errors
8. Component structure validation passes
9. Test coverage >25%
10. Lighthouse scores meet targets

## Testing Commands

```bash
# Run contract tests
docker compose exec scripthammer pnpm test src/tests/contract/blog-*.test.ts

# Run integration tests
docker compose exec scripthammer pnpm test src/tests/integration/blog-*.test.ts

# Generate blog data
docker compose exec scripthammer pnpm run generate:blog

# Check TypeScript
docker compose exec scripthammer pnpm run type-check

# Run full test suite
docker compose exec scripthammer pnpm run test:suite
```

## Notes

- This is a completely NEW blog system (no existing infrastructure)
- All components must use the 5-file pattern generator
- Follow TDD: write tests before implementation
- Use Docker for all development commands
- Service Worker requires HTTPS in production
- IndexedDB has browser-specific limits

## Next Steps After Tasks

1. Deploy to staging environment
2. Run Playwright E2E tests
3. Performance profiling
4. Security audit
5. User acceptance testing
6. Production deployment
