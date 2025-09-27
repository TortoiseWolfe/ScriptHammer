# Quickstart Guide: Blog System with Markdown Content Pipeline

**Feature**: 022-markdown-first-content
**Date**: 2025-01-25
**Prerequisites**: Docker, Node.js 20+, pnpm 10.16.1

## Overview

This guide walks through setting up and testing the blog system with markdown content pipeline, including offline capabilities, social features, and hot reloading.

## Setup Instructions

### 1. Environment Setup

```bash
# Start Docker environment
docker compose up -d

# Install dependencies
docker compose exec scripthammer pnpm install

# Generate blog data from markdown
docker compose exec scripthammer pnpm run generate:blog

# Start development server
docker compose exec scripthammer pnpm run dev
```

### 2. Initial Configuration

Create a sample blog post in `/public/blog/`:

```markdown
---
title: 'Welcome to the New Blog System'
slug: 'welcome-new-blog'
date: '2025-01-25'
author:
  id: 'john-doe'
  name: 'John Doe'
  avatar: '/avatars/john.jpg'
tags: ['announcement', 'features']
categories: ['news']
featuredImage: '/images/blog-hero.jpg'
showToc: true
featured: true
---

# Introduction

This is your first blog post with the new markdown-first content pipeline...
```

### 3. Author Configuration

Create author registry at `/src/data/authors.json`:

```json
{
  "john-doe": {
    "id": "john-doe",
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com",
    "bio": "Full-stack developer and technical writer",
    "avatar": "/avatars/john.jpg",
    "socialLinks": [
      {
        "platform": "twitter",
        "url": "https://twitter.com/johndoe",
        "username": "@johndoe"
      },
      {
        "platform": "github",
        "url": "https://github.com/johndoe"
      }
    ]
  }
}
```

## Test Scenarios

### Scenario 1: Content Creation with Hot Reload

**Goal**: Verify markdown content updates reflect immediately in development

```bash
# 1. Start dev server
docker compose exec scripthammer pnpm run dev

# 2. Create new post
echo '---
title: "Test Hot Reload"
slug: "test-hot-reload"
date: "2025-01-25"
author:
  id: "john-doe"
  name: "John Doe"
---

Initial content.' > public/blog/test-hot-reload.md

# 3. Regenerate blog data
docker compose exec scripthammer pnpm run generate:blog

# 4. Navigate to http://localhost:3000/blog/test-hot-reload
# Should see the new post

# 5. Edit the content
echo '---
title: "Test Hot Reload"
slug: "test-hot-reload"
date: "2025-01-25"
author:
  id: "john-doe"
  name: "John Doe"
---

Updated content with changes!' > public/blog/test-hot-reload.md

# 6. Regenerate and refresh
docker compose exec scripthammer pnpm run generate:blog

# Should see updated content immediately
```

**Expected Result**: Content updates appear within 500ms of saving

### Scenario 2: Offline Editing and Sync

**Goal**: Test offline editing capabilities with IndexedDB

```javascript
// Run in browser console at http://localhost:3000/blog

// 1. Check offline support
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('IndexedDB:', 'indexedDB' in window);

// 2. Go offline (DevTools > Network > Offline)

// 3. Create/edit a post through the UI
// Navigate to /blog/editor

// 4. Verify post saved to IndexedDB
const db = await window.indexedDB.open('BlogDB');
const tx = db.transaction(['posts'], 'readonly');
const posts = await tx.objectStore('posts').getAll();
console.log('Offline posts:', posts);

// 5. Go back online and verify sync
// Should see sync indicator and automatic synchronization
```

**Expected Result**: Posts save offline and sync when connection restored

### Scenario 3: Social Sharing Integration

**Goal**: Verify social sharing buttons and metadata generation

```bash
# 1. Navigate to a blog post
open http://localhost:3000/blog/welcome-new-blog

# 2. Inspect page source for Open Graph tags
curl -s http://localhost:3000/blog/welcome-new-blog | grep -E 'og:|twitter:'

# 3. Test share buttons (should see in UI):
# - Twitter/X share button
# - LinkedIn share button
# - Facebook share button
# - Reddit share button
# - Email share button

# 4. Click a share button and verify:
# - Opens in new window/tab
# - Pre-populated with title and URL
# - Includes featured image if available
```

**Expected Result**: All social platforms show proper previews with metadata

### Scenario 4: Author Profile Display

**Goal**: Verify author information and social links display correctly

```bash
# 1. View a blog post with author info
open http://localhost:3000/blog/welcome-new-blog

# 2. Check author section displays:
# - Avatar image
# - Author name
# - Bio text
# - Social media links

# 3. Click social links and verify:
# - Open in new tabs
# - Navigate to correct profiles
```

**Expected Result**: Complete author profile with working social links

### Scenario 5: Conflict Resolution

**Goal**: Test three-way merge conflict resolution

```javascript
// Simulate conflict scenario in browser console

// 1. Create a post in two tabs
const post = {
  id: 'conflict-test',
  title: 'Original Title',
  content: 'Original content',
};

// 2. In Tab 1: Edit locally (offline)
// Edit to: title: 'Local Edit', content: 'Local changes'

// 3. In Tab 2: Edit and sync (online)
// Edit to: title: 'Remote Edit', content: 'Remote changes'

// 4. Tab 1: Go online to trigger conflict
// Should see conflict resolution UI with:
// - Base version (Original)
// - Local version (Tab 1 changes)
// - Remote version (Tab 2 changes)
// - Merge options

// 5. Choose resolution and verify result
```

**Expected Result**: Clear UI for resolving conflicts with all three versions visible

### Scenario 6: Storage Quota Management

**Goal**: Test storage limits and compression

```javascript
// Test storage management in browser console

// 1. Check current usage
const quota = await navigator.storage.estimate();
console.log('Storage used:', quota.usage, 'of', quota.quota);

// 2. Create large content to test compression
const largePost = {
  id: 'large-post',
  content: 'x'.repeat(1000000), // 1MB of content
};

// 3. Save and verify compression
// Should compress before storing

// 4. Check storage API endpoint
fetch('/api/blog/storage')
  .then((r) => r.json())
  .then(console.log);

// Should show:
// - Text used/limit
// - Images used/limit
// - Compression enabled
```

**Expected Result**: Content compresses automatically when approaching limits

### Scenario 7: Table of Contents Generation

**Goal**: Verify automatic TOC generation for posts with showToc flag

```markdown
# Create post with TOC enabled

---

title: "Post with TOC"
showToc: true

---

# Section 1

## Subsection 1.1

### Detail 1.1.1

# Section 2

## Subsection 2.1

## Subsection 2.2

# Section 3
```

Navigate to the post and verify:

- TOC appears on the side/top
- Links jump to sections
- Active section highlights
- Nested structure preserved

**Expected Result**: Functional table of contents with smooth scrolling

### Scenario 8: Performance Validation

**Goal**: Verify performance metrics meet requirements

```bash
# 1. Run Lighthouse audit
docker compose exec scripthammer pnpm run lighthouse

# 2. Check metrics:
# - Performance: 90+
# - Accessibility: 95+
# - FCP: <2s
# - TTI: <3.5s
# - CLS: <0.1

# 3. Test hot reload speed
time docker compose exec scripthammer pnpm run generate:blog
# Should complete in <500ms

# 4. Test page load with 50+ posts
# Should remain responsive
```

**Expected Result**: All performance metrics within specified limits

## Validation Checklist

### Functional Requirements

- [ ] FR-001: Single source of truth for blog content ✓
- [ ] FR-002: Automatic detection of markdown changes ✓
- [ ] FR-003: Full offline editing capabilities ✓
- [ ] FR-004: Sync offline edits when online ✓
- [ ] FR-005: Validate metadata, use defaults for invalid ✓
- [ ] FR-006: Syntax highlighting for code blocks ✓
- [ ] FR-007: Auto-generate TOC when showToc=true ✓
- [ ] FR-008: Incremental builds for changed content ✓
- [ ] FR-009: Conflict detection for concurrent edits ✓
- [ ] FR-010: Three-way merge UI for conflicts ✓
- [ ] FR-016: Social sharing buttons for major platforms ✓
- [ ] FR-017: Open Graph meta tags for previews ✓
- [ ] FR-018: Author profile sections with social links ✓

### Non-Functional Requirements

- [ ] Hot reload updates within 500ms ✓
- [ ] Social buttons load within 2 seconds ✓
- [ ] Offline sync within 10 seconds of connectivity ✓
- [ ] 99% uptime for content availability ✓
- [ ] Zero data loss during migration/sync ✓
- [ ] WCAG 2.1 AA accessibility compliance ✓

## Troubleshooting

### Common Issues

1. **Hot reload not working**
   - Ensure file watcher is running
   - Check WebSocket connection in DevTools
   - Verify markdown files in correct directory

2. **Offline sync failing**
   - Check Service Worker registration
   - Verify IndexedDB permissions
   - Clear cache and re-register SW

3. **Social sharing not showing previews**
   - Verify meta tags in page source
   - Check Open Graph debugger tools
   - Ensure featured image URLs are absolute

4. **Conflicts not resolving**
   - Check version numbers in database
   - Verify checksum calculation
   - Clear sync queue and retry

## API Testing

### Test API Endpoints

```bash
# List all posts
curl http://localhost:3000/api/blog/posts

# Get single post
curl http://localhost:3000/api/blog/posts/welcome-new-blog

# Create new post
curl -X POST http://localhost:3000/api/blog/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Post",
    "content": "# Test Content",
    "authorId": "john-doe"
  }'

# Sync offline changes
curl -X POST http://localhost:3000/api/blog/sync \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [],
    "lastSyncTime": "2025-01-25T00:00:00Z"
  }'

# Check storage quota
curl http://localhost:3000/api/blog/storage

# Track share event
curl -X POST http://localhost:3000/api/blog/share \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "welcome-new-blog",
    "platform": "twitter"
  }'
```

## Success Criteria

The blog system is considered successfully implemented when:

1. ✅ All markdown files process without errors
2. ✅ Hot reload works in <500ms
3. ✅ Offline editing saves to IndexedDB
4. ✅ Sync completes without data loss
5. ✅ Social sharing shows proper previews
6. ✅ Author profiles display correctly
7. ✅ Conflicts resolve with user control
8. ✅ Storage limits enforced with compression
9. ✅ Performance metrics meet requirements
10. ✅ All tests pass in CI/CD pipeline

## Next Steps

After validation:

1. Deploy to staging environment
2. Run E2E tests with Playwright
3. Performance testing with load
4. Security audit for XSS/injection
5. Accessibility audit with Pa11y
6. User acceptance testing
7. Production deployment
