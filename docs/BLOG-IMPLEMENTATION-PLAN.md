# Blog Implementation Plan

## Given Docker Constraints

Based on the documented Docker/.next permission issues, we need a different approach for implementing the blog feature.

## Recommended Approach: Local Development First

### Phase 1: Local Implementation (No Docker)

1. **Stop Docker containers completely**

   ```bash
   docker compose down
   ```

2. **Install dependencies locally**

   ```bash
   pnpm install
   pnpm add dexie lz-string
   ```

3. **Implement blog features locally**
   - Create all blog components
   - Test with `pnpm run dev`
   - Ensure everything works locally first

4. **Run tests locally**
   ```bash
   pnpm test
   pnpm run test:e2e
   ```

### Phase 2: Docker Compatibility Check

1. **After local implementation works**

   ```bash
   pnpm run docker:clean
   ```

2. **Test in Docker**
   - If it works: Great!
   - If it fails: Document specific issues

### Phase 3: Production Deployment

1. **Build static export**

   ```bash
   pnpm run build
   ```

2. **Test production build**
   ```bash
   pnpm run start
   ```

## Blog Feature Requirements (PRP-017)

### Core Features

1. **Offline-first architecture**
   - IndexedDB with Dexie.js
   - Service Worker caching
   - Background sync

2. **Storage Management**
   - 5MB for text content
   - 50-200MB for images (separate quota)
   - LZ-String compression for text

3. **UI Components**
   - Blog listing page
   - Post editor (markdown)
   - Reading view
   - Search functionality

### Technical Architecture

```
src/
├── app/
│   └── blog/
│       ├── page.tsx          # Blog listing
│       ├── [slug]/
│       │   └── page.tsx      # Individual post
│       ├── editor/
│       │   └── page.tsx      # Post editor
│       └── layout.tsx        # Blog layout
├── lib/
│   └── blog/
│       ├── database.ts       # IndexedDB setup
│       └── compression.ts    # Text compression
├── services/
│   ├── blog-service.ts       # Blog CRUD operations
│   ├── storage-service.ts    # Storage quota management
│   └── sync-service.ts       # Background sync
└── components/
    └── blog/
        ├── PostCard.tsx
        ├── PostEditor.tsx
        └── SearchBar.tsx
```

## Implementation Steps

### Step 1: Setup Database Schema

```typescript
// lib/blog/database.ts
import Dexie from 'dexie';

class BlogDatabase extends Dexie {
  posts!: Table<BlogPost>;
  assets!: Table<Asset>;

  constructor() {
    super('BlogDatabase');
    this.version(1).stores({
      posts: '++id, slug, createdAt, publishDate',
      assets: '++id, postId, type, size',
    });
  }
}
```

### Step 2: Create Blog Service

```typescript
// services/blog-service.ts
import LZString from 'lz-string';
import { db } from '@/lib/blog/database';

export class BlogService {
  async createPost(post: BlogPost) {
    const compressed = LZString.compress(post.content);
    return db.posts.add({ ...post, content: compressed });
  }

  async getPost(slug: string) {
    const post = await db.posts.where('slug').equals(slug).first();
    if (post) {
      post.content = LZString.decompress(post.content);
    }
    return post;
  }
}
```

### Step 3: Implement Service Worker

```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/blog/')) {
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});
```

### Step 4: Create UI Components

- Use existing DaisyUI components
- Follow atomic design pattern
- Implement proper loading states

## Testing Strategy

### Local Testing

1. Unit tests for services
2. Integration tests for database
3. E2E tests for user flows

### Docker Testing

1. Use `docker:clean` before testing
2. Document any failures
3. Have fallback for Docker issues

## Deployment

### GitHub Pages

1. Static export works best
2. No server-side features
3. All data client-side

### Monitoring

1. Storage quota usage
2. Sync success/failure rates
3. Performance metrics

## Risk Mitigation

### Docker Issues

- **Primary:** Develop locally
- **Test:** In Docker after stable
- **Deploy:** Static build only

### Storage Limits

- Monitor quota usage
- Implement cleanup strategies
- Warn users before limits

### Browser Compatibility

- Test IndexedDB support
- Fallback to localStorage
- Progressive enhancement

## Success Criteria

1. Blog works locally without Docker
2. All tests pass
3. Storage stays within quotas
4. Offline mode functional
5. Docker compatibility (bonus)

## Timeline

- **Day 1:** Local setup, database schema
- **Day 2:** Services and storage management
- **Day 3:** UI components
- **Day 4:** Service Worker, offline mode
- **Day 5:** Testing and documentation
- **Day 6:** Docker compatibility check
- **Day 7:** Deployment preparation
