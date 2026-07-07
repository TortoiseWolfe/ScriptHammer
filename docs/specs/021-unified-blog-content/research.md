# Research Findings: Unified Blog Content Pipeline

## Content Processing Architecture

### Decision: Enhanced Markdown Pipeline (not Content Collections)

**Rationale**:

- Content Collections is not yet stable for Next.js 15.5
- Current gray-matter + markdown-to-jsx setup can be enhanced incrementally
- Unified pipeline achievable with remark/rehype plugins
- Better compatibility with existing 50+ posts

**Alternatives considered**:

- Content Collections: Too early stage, limited Next.js 15 support
- MDX: Overhead not needed for current blog requirements
- Contentlayer: Deprecated, no longer maintained

## Bi-directional Sync Architecture

### Decision: Event-driven sync with version tracking

**Rationale**:

- File system changes trigger IndexedDB updates via file watcher
- IndexedDB changes queue for file system sync
- Version numbers prevent overwrite conflicts
- Maintains single source of truth principle

**Alternatives considered**:

- CRDT (Conflict-free Replicated Data Types): Overcomplicated for blog posts
- Last-write-wins: Too simplistic, data loss risk
- Lock-based: Poor offline experience

## Conflict Resolution Strategy

### Decision: Three-way merge with manual resolution UI

**Rationale**:

- Detects conflicts via version divergence
- Shows diff view for manual resolution
- Preserves both versions until resolved
- Aligns with Git-like mental model

**Clarification resolved**: FR-010 will use manual merge with UI

## Table of Contents Generation

### Decision: Opt-in per post via frontmatter flag

**Rationale**:

- Not all posts benefit from TOC
- Author control over presentation
- Backwards compatible with existing posts

**Clarification resolved**: FR-007 TOC generation is optional, controlled by `showToc: true` in frontmatter

## Storage Quota Management

### Decision: Compression with old content cleanup

**Rationale**:

- LZ-String compression already in use
- Clean up posts not accessed in 90 days
- Warn user before deletion
- Maintain most recent 20 posts minimum

**Clarification resolved**: FR-015 will compress first, then cleanup old content with user warning

## Incremental Build Strategy

### Decision: File hash tracking with dependency graph

**Rationale**:

- Track MD5 hashes of markdown files
- Only regenerate changed files
- Update dependency graph for related content
- Cache processed HTML in `.next/cache/blog`

**Alternatives considered**:

- Timestamp-based: Less reliable, timezone issues
- Full rebuild: Too slow for 50+ posts

## File Watching Integration

### Decision: Chokidar with debounced updates

**Rationale**:

- Chokidar is proven, stable file watcher
- 500ms debounce prevents thrashing
- Integrates with Next.js dev server
- Works in Docker environment

**Alternatives considered**:

- Native fs.watch: Platform inconsistencies
- Nodemon: Too heavy for focused use case
- Custom polling: Performance overhead

## Technical Decisions Summary

1. **Markdown Processing**: Enhance current pipeline with unified remark/rehype
2. **Sync Method**: Event-driven with version tracking
3. **Conflicts**: Three-way merge with manual resolution
4. **TOC**: Opt-in via frontmatter
5. **Storage**: Compression + intelligent cleanup
6. **Builds**: Hash-based incremental generation
7. **File Watching**: Chokidar with debouncing

## Implementation Priority

1. **Phase 1**: File watcher + auto-generation
2. **Phase 2**: Enhanced markdown pipeline
3. **Phase 3**: Bi-directional sync
4. **Phase 4**: Conflict resolution UI
5. **Phase 5**: Migration of existing posts

## Risk Mitigation

- **Migration Risk**: Backup all posts before migration
- **Performance Risk**: Implement progressive loading
- **Sync Risk**: Queue-based with retry logic
- **Storage Risk**: Monitor quota, alert at 80%

## Performance Targets

- File change to UI update: <1 second
- Markdown processing: <50ms per post
- Sync operation: <200ms per post
- Conflict detection: <100ms
- Migration: <30 seconds for 50 posts
