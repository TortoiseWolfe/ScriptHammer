# Blog Hot-Reload Fix Specification

## Problem Statement

The offline-first blog system is aggressively caching content in IndexedDB, preventing developers from seeing their markdown edits in real-time. This is completely unacceptable for content creation workflow.

## Current Issues

1. **IndexedDB Priority**: The blog editor prioritizes cached IndexedDB data over fresh markdown files
2. **No Hot-Reload**: Changes to markdown files require manual cache clearing
3. **Developer Hostile**: Forces developers to clear browser cache just to see their edits
4. **SEO Analyzer Stale**: SEO scores don't update when content changes

## Requirements

### Must Have

- [ ] Hot-reload markdown changes immediately in development mode
- [ ] Bypass IndexedDB cache when in development
- [ ] Show a "Dev Mode" indicator when hot-reload is active
- [ ] Clear cache button in the blog editor UI

### Should Have

- [ ] File watcher that triggers automatic refresh
- [ ] Disable offline-first in development by default
- [ ] Option to toggle between cached/fresh data

### Nice to Have

- [ ] Visual diff showing what changed
- [ ] Automatic SEO re-analysis on content change

## Technical Implementation

### 1. Development Mode Detection

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
```

### 2. Blog Service Modification

```typescript
// In blog service
async function getPost(slug: string) {
  if (isDevelopment) {
    // ALWAYS read from markdown file in dev
    return await readMarkdownFile(slug);
  }
  // Only use IndexedDB in production
  return await getFromIndexedDB(slug);
}
```

### 3. Add Cache Control UI

```typescript
// Add to blog editor
<button onClick={() => {
  indexedDB.deleteDatabase('blogDB');
  window.location.reload();
}}>
  Clear Cache & Reload
</button>
```

### 4. File Watcher Integration

```typescript
// Watch markdown files
if (isDevelopment) {
  fs.watch('/public/blog/*.md', () => {
    // Trigger reload
    websocket.send('reload');
  });
}
```

## Constitution Amendment

### Core Principle Addition:

**Developer Experience First (Development Mode)**

- In development, developer workflow takes absolute priority over performance
- Hot-reload must work for all content changes
- Caching is secondary to iteration speed
- If offline-first interferes with development, disable it

### Hierarchy Update:

1. Developer Experience (in development)
2. User Experience (in production)
3. Performance Optimization
4. Offline Functionality

## Implementation Priority

1. **IMMEDIATE**: Add development mode bypass for IndexedDB
2. **HIGH**: Add "Clear Cache" button to blog editor
3. **MEDIUM**: Implement file watcher for auto-reload
4. **LOW**: Add toggle for cache modes

## Success Criteria

- [ ] Markdown changes visible within 2 seconds of saving
- [ ] No manual cache clearing required
- [ ] SEO analyzer reflects current content
- [ ] Development workflow is frictionless

## Notes

The current implementation prioritizes offline-first to the detriment of the development experience. This is backwards. Developers need to iterate quickly on content. The offline-first feature should ONLY be active in production builds.

**Remember**: We're building tools for developers, not making their lives harder.
