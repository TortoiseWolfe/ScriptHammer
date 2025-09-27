# Quickstart: Unified Blog Content Pipeline

## Prerequisites

- Docker environment running
- Node.js 20+ and pnpm 10.16.1
- 50+ existing blog posts in `/blog` directory

## Installation

```bash
# Install new dependencies
docker compose exec scripthammer pnpm add chokidar remark remark-html rehype-highlight crypto-js
docker compose exec scripthammer pnpm add -D @types/crypto-js

# Run migration
docker compose exec scripthammer pnpm run migrate:blog
```

## Quick Verification

### 1. Test Auto-reload (Development)

```bash
# Start dev server
docker compose exec scripthammer pnpm run dev

# In another terminal, edit a blog post
echo "Test edit" >> blog/test-post.md

# Verify: Page should auto-refresh within 1 second
```

### 2. Test Offline Editing

```bash
# Open browser to http://localhost:3000/blog/editor
# Create new post
# Turn off network (DevTools > Network > Offline)
# Continue editing
# Turn network back on
# Verify: Changes sync automatically
```

### 3. Test Conflict Resolution

```bash
# Edit same post in two places:
# 1. Edit blog/test-post.md directly
# 2. Edit same post in browser at /blog/editor?slug=test-post
# 3. Save both
# Verify: Conflict dialog appears with merge options
```

### 4. Test Migration

```bash
# Backup existing posts first
cp -r blog blog.backup

# Run migration
docker compose exec scripthammer pnpm run migrate:blog

# Verify all posts migrated
docker compose exec scripthammer pnpm run test:migration
```

### 5. Test Performance

```bash
# Run performance benchmarks
docker compose exec scripthammer pnpm run test:perf

# Expected results:
# - File change to UI: <1 second
# - Markdown processing: <50ms per post
# - Sync operation: <200ms per post
```

## Acceptance Tests

### Scenario 1: Auto-generation Eliminated

**Given**: Developer editing markdown files
**When**: Save changes to any `.md` file in `/blog`
**Then**: Changes appear immediately in dev server without running `pnpm run generate:blog`

```bash
# Test command
docker compose exec scripthammer pnpm test src/tests/integration/auto-generation.test.ts
```

### Scenario 2: Offline Sync

**Given**: User editing offline in browser
**When**: Internet connectivity restored
**Then**: All offline changes sync without conflicts

```bash
# Test command
docker compose exec scripthammer pnpm test src/tests/integration/offline-sync.test.ts
```

### Scenario 3: Conflict Detection

**Given**: Same post edited in multiple locations
**When**: Sync occurs
**Then**: Conflict UI shows with three-way merge options

```bash
# Test command
docker compose exec scripthammer pnpm test src/tests/integration/conflict-detection.test.ts
```

### Scenario 4: Migration Integrity

**Given**: 50+ existing blog posts
**When**: Migration runs
**Then**: All posts preserved with metadata intact

```bash
# Test command
docker compose exec scripthammer pnpm test src/tests/integration/migration.test.ts
```

### Scenario 5: Enhanced Processing

**Given**: Blog post with code blocks
**When**: Post renders
**Then**: Syntax highlighting and optional TOC displayed

```bash
# Test command
docker compose exec scripthammer pnpm test src/tests/integration/enhanced-processing.test.ts
```

## API Testing

### Test Sync Endpoint

```bash
curl -X POST http://localhost:3000/api/blog/sync \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [{
      "operation": "update",
      "postId": "test-post",
      "content": "# Updated Content",
      "version": 2
    }]
  }'
```

### Test Validation

```bash
curl -X POST http://localhost:3000/api/blog/validate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Post",
    "author": "Test Author",
    "showToc": true
  }'
```

### Test Processing

````bash
curl -X POST http://localhost:3000/api/blog/process \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Test\n\nHello world\n\n```js\nconst test = true;\n```",
    "options": {
      "generateToc": true,
      "syntaxHighlight": true
    }
  }'
````

## Monitoring

### Storage Status

```bash
# Check IndexedDB usage
curl http://localhost:3000/api/blog/storage

# Expected output:
# {
#   "used": 2500000,
#   "quota": 5000000,
#   "percentage": 50,
#   "warnings": []
# }
```

### Sync Queue

```bash
# Check pending syncs
curl http://localhost:3000/api/blog/sync/queue

# Expected: Empty array if all synced
```

### Cache Status

```bash
# Check processing cache
curl http://localhost:3000/api/blog/cache/status

# Expected: Cache hit ratio >80%
```

## Troubleshooting

### File Watcher Not Working

```bash
# Restart file watcher
docker compose exec scripthammer pnpm run dev:restart

# Check logs
docker compose logs scripthammer | grep chokidar
```

### Sync Failures

```bash
# Check sync queue
curl http://localhost:3000/api/blog/sync/queue

# Force retry
curl -X POST http://localhost:3000/api/blog/sync/retry
```

### Storage Quota Exceeded

```bash
# Clean old posts
curl -X POST http://localhost:3000/api/blog/storage/cleanup

# Check what would be deleted
curl http://localhost:3000/api/blog/storage/cleanup?dry-run=true
```

## Success Criteria

- [ ] All 50+ posts migrated successfully
- [ ] No manual `generate:blog` needed
- [ ] Offline edits sync within 1 second of reconnection
- [ ] Conflicts detected and resolvable
- [ ] Performance targets met:
  - [ ] File change to UI <1s
  - [ ] Processing <50ms/post
  - [ ] Sync <200ms/post
- [ ] All integration tests passing
- [ ] Storage stays under 5MB limit
- [ ] Cache hit ratio >80%

## Next Steps

After verification:

1. Remove old `generate-blog-data.js` script
2. Update CI/CD to remove build step
3. Document new workflow in README
4. Train team on conflict resolution UI
