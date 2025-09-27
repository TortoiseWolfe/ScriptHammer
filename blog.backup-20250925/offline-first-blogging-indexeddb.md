---
title: "Offline-First Blogging: Because The Internet Isn't Always There"
slug: 'offline-first-blogging-indexeddb'
excerpt: 'Building a blog that works without internet - and syncs when it comes back.'
author: 'TortoiseWolfe'
publishDate: 2025-10-09
status: 'published'
featured: false
categories:
  - PWA
  - Features
  - Architecture
tags:
  - offline
  - indexeddb
  - pwa
  - sync
  - blog
readTime: 14
ogImage: '/blog-images/2025-10-09-offline-first-blogging-indexeddb.png'
---

# Offline-First Blogging: Because The Internet Isn't Always There

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec crudkit pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Coffee Shop Incident That Changed Everything

It was a Tuesday morning, one of those rare perfect days where everything aligned. I'd found the corner table at my favorite coffee shop—the one with the good outlet placement and the view of the street. Nollie was at home, probably destroying one of her toys. I had four hours blocked on my calendar, a fresh americano, and seventeen blog post ideas that had been fermenting in my brain for weeks.

I opened my desktop at home remotely (because I'm one of those people who refuses to write on anything but their main setup), pulled up VS Code, and started typing. The words were flowing. That rare state where your fingers can barely keep up with your thoughts. I was deep in a post about component architecture when the connection dropped.

No problem, I thought. Coffee shop WiFi is always flaky. I'd reconnect in a second.

The WiFi login page appeared. "Purchase required for access."

I looked at my table. Three empty coffee cups. A half-eaten croissant. The barista caught my eye and pointed at the sign: "WiFi access: One purchase per two hours."

"I've bought three coffees," I said.

"That was yesterday's purchases," she replied with the kind of smile that said this wasn't negotiable.

I could have bought another coffee. I was already vibrating from caffeine. Instead, I sat there, staring at my remote desktop connection error, watching forty-five minutes of writing disappear into the digital void. All those perfect sentences, those clever metaphors, that introduction I'd finally nailed after six attempts—gone.

That's when I had the realization that would consume the next three weeks of my life: **Why does writing need the internet at all?**

## The Airplane Epiphany

Two weeks after the coffee shop incident, I was on a flight to a developer conference. Six hours of uninterrupted time. No Slack. No emails. No "quick questions" that turn into hour-long debugging sessions. Just me and my thoughts.

I pulled out my phone to write some notes. The browser-based CMS I'd been using cheerfully informed me: "Connection required." My note-taking app: "Sync failed, retry when online." Even my supposedly "offline" markdown editor needed to phone home before letting me write.

The person next to me was writing away in Google Docs, which at least pretended to work offline. But I'd been burned by that before—"Offline" Google Docs has an interesting definition of "offline" that seems to mean "online, but we'll pretend otherwise and maybe sync your changes later if you're lucky."

I spent the flight writing in the notes app that came with my phone. Plain text. No formatting. No organization. Just a wall of text that I'd have to parse and restructure later. By the time we landed, I had 3,000 words of stream-of-consciousness that took me another two hours to clean up and format.

There had to be a better way.

## Discovering IndexedDB: The Database Living in Your Browser

When I got back home, Nollie gave me the cold shoulder for about five minutes before demanding belly rubs. As I sat there on the floor, covered in dog fur, I started researching offline storage options.

LocalStorage? 5MB limit and synchronous API that blocks the main thread. That's a no.

WebSQL? Deprecated and was never standardized. Next.

Cache API? Great for assets, not for structured data. Pass.

Then I found IndexedDB. The browser's built-in NoSQL database. Asynchronous. Can store gigabytes of data. Supports transactions. Works in web workers. It was like finding out your car had a hidden turbo button the whole time.

But IndexedDB's API looks like it was designed by someone who hates developers. Callbacks wrapped in callbacks wrapped in event handlers. It's like they took everything wrong with early 2000s JavaScript and said, "Let's preserve this for posterity."

```javascript
// Raw IndexedDB - Not for the faint of heart
const request = indexedDB.open('MyDatabase', 1);
request.onerror = function (event) {
  console.error('Why do you hate me, IndexedDB?');
};
request.onsuccess = function (event) {
  const db = event.target.result;
  const transaction = db.transaction(['posts'], 'readwrite');
  const objectStore = transaction.objectStore('posts');
  const request = objectStore.add(postData);
  request.onsuccess = function (event) {
    // We're in callback hell and there's no escape
  };
};
```

That's when I discovered Dexie.js. It's like someone looked at IndexedDB's API, said "absolutely not," and built something developers would actually want to use.

## Building the Offline-First Blog System

The first step was designing the data structure. After years of building traditional server-first applications, thinking offline-first required rewiring my brain. Every piece of data needed three timestamps: created, modified, and synced. Every record needed a sync status. Every operation needed to work without a server.

Check out our [Blog Editor](/blog/editor) to see this in action. Try turning off your WiFi and keep writing—everything just works.

Here's what the foundation looked like:

```typescript
// db.ts - Our offline database schema
import Dexie, { Table } from 'dexie';

class BlogDatabase extends Dexie {
  posts!: Table<BlogPost>;
  drafts!: Table<Draft>;
  syncQueue!: Table<SyncItem>;
  images!: Table<ImageData>;

  constructor() {
    super('ScriptHammerBlog');

    this.version(1).stores({
      posts: '++id, slug, status, publishDate, [status+publishDate]',
      drafts: '++id, postId, lastModified',
      syncQueue: '++id, action, timestamp, retries',
      images: '++id, postId, hash, size',
    });
  }
}

interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'scheduled';
  publishDate: Date;
  createdAt: Date;
  modifiedAt: Date;
  syncedAt?: Date;
  localOnly?: boolean;
}
```

The beauty of this approach is that the blog works exactly the same whether you're online or offline. The user doesn't need to know or care about connection status. They just write.

## The Sync Engine: Making Peace Between Offline and Online

Building offline-first is easy. Building the sync engine that reconciles offline changes with server state? That's where developers go to cry.

The first version of my sync engine was naive. "Just upload everything when you reconnect!" I thought. Then I discovered edge cases. So many edge cases.

What happens when you edit a post offline while someone else edits it online? What if you delete a post offline but it gets updated online? What if you're offline for a week and come back to find fifty conflicts?

I spent three days with a whiteboard, Nollie judging me from her bed, mapping out every possible conflict scenario. The solution was a three-way merge system inspired by git:

```typescript
// sync-engine.ts
class SyncEngine {
  async resolveConflict(local: BlogPost, remote: BlogPost, base?: BlogPost) {
    // If no base version, someone else created it while we were offline
    if (!base) {
      return this.handleNewRemotePost(local, remote);
    }

    // Calculate what changed
    const localChanges = this.diffPosts(base, local);
    const remoteChanges = this.diffPosts(base, remote);

    // No conflicts if changes don't overlap
    if (!this.hasConflict(localChanges, remoteChanges)) {
      return this.mergeChanges(base, localChanges, remoteChanges);
    }

    // Conflict resolution strategies
    const strategy = await this.getResolutionStrategy();
    switch (strategy) {
      case 'local-wins':
        return local;
      case 'remote-wins':
        return remote;
      case 'merge':
        return this.interactiveMerge(local, remote, base);
      case 'duplicate':
        return this.createConflictCopy(local, remote);
    }
  }
}
```

The sync queue became the heart of the system. Every change gets queued, timestamped, and prioritized. Failed syncs get exponential backoff. The queue persists across sessions, so even if you close your browser mid-sync, it picks up where it left off.

See the [Sync Status Dashboard](/blog/sync-status) to watch the sync queue in real-time. It's oddly mesmerizing.

## Text Compression: Because 5MB Goes Fast

IndexedDB can store gigabytes, but there's a catch: browser quota management. Different browsers, different limits, different behaviors when you hit those limits. Safari is particularly aggressive, giving you maybe 50MB before it starts asking users for permission.

A blog post with images can easily hit 10MB. Ten posts and Safari's already side-eyeing you. That's when I discovered LZ-String, a compression library designed specifically for UTF-16 strings (JavaScript's native string format).

```typescript
// compression.ts
import LZString from 'lz-string';

class CompressionService {
  compress(content: string): string {
    // Compress long content, store metadata
    if (content.length > 1000) {
      const compressed = LZString.compressToUTF16(content);
      const ratio = compressed.length / content.length;

      // Only use compression if it actually helps
      if (ratio < 0.8) {
        return JSON.stringify({
          compressed: true,
          data: compressed,
          original: content.length,
          ratio: ratio.toFixed(2),
        });
      }
    }
    return content;
  }

  decompress(stored: string): string {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.compressed) {
        return LZString.decompressFromUTF16(parsed.data);
      }
    } catch {
      // Not compressed, return as-is
    }
    return stored;
  }
}
```

The compression ratio for typical blog content is impressive. A 10,000-character post compresses to about 2,000 characters. That's 5x more content in the same space. Markdown, with its repetitive structure, compresses even better.

## The Image Problem: Binary Data in a Text World

Text was solved, but images were another beast entirely. IndexedDB can store binary data, but not efficiently. A 2MB image stored as a blob in IndexedDB might take up 4MB of quota. Base64 encoding for compatibility? Now it's 6MB.

The solution was a hybrid approach:

```typescript
// image-service.ts
class OfflineImageService {
  private readonly MAX_INLINE_SIZE = 50 * 1024; // 50KB
  private readonly MAX_CACHED_SIZE = 500 * 1024; // 500KB

  async storeImage(file: File): Promise<StoredImage> {
    const arrayBuffer = await file.arrayBuffer();
    const size = arrayBuffer.byteLength;

    if (size <= this.MAX_INLINE_SIZE) {
      // Small images: store inline with post
      return {
        type: 'inline',
        data: this.toBase64(arrayBuffer),
        size,
      };
    } else if (size <= this.MAX_CACHED_SIZE) {
      // Medium images: store in separate table
      const hash = await this.calculateHash(arrayBuffer);
      await db.images.put({
        hash,
        data: arrayBuffer,
        mimetype: file.type,
        size,
      });
      return {
        type: 'cached',
        hash,
        size,
      };
    } else {
      // Large images: store reference only
      return {
        type: 'reference',
        url: await this.uploadToCloud(file),
        size,
      };
    }
  }
}
```

Small icons and thumbnails get inlined. Medium images get cached separately and referenced by hash (deduplication!). Large images get uploaded immediately if online, or queued for upload when connection returns.

## The Service Worker: Your Offline Guardian Angel

The service worker is what makes the magic happen. It intercepts every network request and decides whether to serve from cache, fetch from network, or queue for later.

```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Blog API requests
  if (url.pathname.startsWith('/api/blog')) {
    event.respondWith(handleBlogAPI(event.request));
    return;
  }

  // Static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => response || fetch(event.request))
    );
    return;
  }
});

async function handleBlogAPI(request) {
  const url = new URL(request.url);
  const method = request.method;

  // Try network first for GET requests
  if (method === 'GET') {
    try {
      const response = await fetch(request);
      // Update cache with fresh data
      updateCache(request, response.clone());
      return response;
    } catch (error) {
      // Offline? Serve from IndexedDB
      return serveFromIndexedDB(url.pathname);
    }
  }

  // Queue mutations for sync
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const body = await request.json();
    await queueMutation({
      method,
      url: url.pathname,
      body,
      timestamp: Date.now(),
    });

    // Optimistic response
    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        willSyncWhenOnline: true,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

Check out our [Service Worker Status](/status#service-worker) to see what's cached and queued right now.

## Background Sync: The Comeback Kid

Background Sync API is the unsung hero of offline-first. Even if the user closes your site, navigates away, or shuts their computer, Background Sync will wake up your service worker when the connection returns and finish what you started.

```javascript
// Background sync registration
async function queueForSync(data) {
  await saveToSyncQueue(data);

  if ('sync' in self.registration) {
    await self.registration.sync.register('blog-sync');
  } else {
    // Fallback for browsers without Background Sync
    setTimeout(() => attemptSync(), 5000);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'blog-sync') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const queue = await getSyncQueue();

  for (const item of queue) {
    try {
      await syncItem(item);
      await markSynced(item.id);
    } catch (error) {
      await incrementRetry(item.id);

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, item.retries), 300000);
      setTimeout(() => retrySyncItem(item.id), delay);
    }
  }
}
```

The beauty of Background Sync is that it's completely transparent to the user. They write their post, hit save, close their browser, and go about their day. Hours later, when they're back online—maybe they don't even have the site open—their post quietly syncs to the server.

## Conflict Resolution: When Two Edits Collide

The scariest part of offline-first is conflicts. Two people edit the same post. Someone deletes while someone else edits. The server has changes the client doesn't know about.

I implemented a vector clock system inspired by distributed databases:

```typescript
interface VectorClock {
  [clientId: string]: number;
}

class ConflictResolver {
  async resolveConflict(
    localPost: BlogPost,
    remotePost: BlogPost,
    localClock: VectorClock,
    remoteClock: VectorClock
  ) {
    // Determine causal relationship
    const comparison = this.compareClocks(localClock, remoteClock);

    if (comparison === 'concurrent') {
      // True conflict - changes happened in parallel
      return this.handleConcurrentEdits(localPost, remotePost);
    } else if (comparison === 'local-newer') {
      // Local has all remote changes plus more
      return localPost;
    } else {
      // Remote has all local changes plus more
      return remotePost;
    }
  }

  handleConcurrentEdits(local: BlogPost, remote: BlogPost) {
    // Three-way merge
    const merged = {
      ...remote, // Start with remote as base
      // Prefer local title if changed
      title: local.modifiedAt > remote.modifiedAt ? local.title : remote.title,
      // Merge content by sections
      content: this.mergeContent(local.content, remote.content),
      // Keep both sets of tags
      tags: [...new Set([...local.tags, ...remote.tags])],
      // Latest modification wins for status
      status:
        local.modifiedAt > remote.modifiedAt ? local.status : remote.status,
    };

    // Save conflict history
    this.saveConflictHistory({
      postId: local.id,
      local,
      remote,
      merged,
      timestamp: Date.now(),
    });

    return merged;
  }
}
```

Visit our [Conflict Resolution Test Page](/blog/test-conflicts) to simulate conflicts and see how they're resolved. It's surprisingly satisfying to watch.

## The Draft System: Never Lose a Thought

Every keystroke gets saved. Not to the server—that would be insane—but to IndexedDB. Drafts are compressed, timestamped, and versioned. If your browser crashes, power goes out, or Nollie steps on your keyboard (it's happened), your work is safe.

```typescript
class AutoSaveService {
  private saveDebounced: DebouncedFunc<(content: string) => Promise<void>>;

  constructor() {
    this.saveDebounced = debounce(this.saveDraft, 1000);
  }

  async handleChange(content: string, postId?: string) {
    // Immediate save to memory
    this.memoryBuffer = content;

    // Debounced save to IndexedDB
    await this.saveDebounced(content, postId);

    // Show save indicator
    this.updateUI('saving');
  }

  async saveDraft(content: string, postId?: string) {
    const draft = {
      postId: postId || `draft-${Date.now()}`,
      content: LZString.compressToUTF16(content),
      wordCount: content.split(/\s+/).length,
      lastModified: Date.now(),
      checksum: await this.calculateChecksum(content),
    };

    await db.drafts.put(draft);

    // Keep last 10 versions
    await this.pruneOldDrafts(draft.postId);

    this.updateUI('saved');
  }

  async recoverDrafts(): Promise<Draft[]> {
    const drafts = await db.drafts
      .where('lastModified')
      .above(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      .toArray();

    return drafts.map((d) => ({
      ...d,
      content: LZString.decompressFromUTF16(d.content),
    }));
  }
}
```

Try it yourself: Open our [Blog Editor](/blog/editor), start typing, then close the tab immediately. Come back and your draft is waiting.

## The Performance Impact: Faster Than You'd Think

You'd think all this offline machinery would slow things down. The opposite happened. Pages load instantly because they're served from cache. Saves are instantaneous because they hit IndexedDB. The UI never blocks waiting for network requests.

Here are the actual numbers from our performance monitoring:

**Before Offline-First:**

- Initial load: 2.3s
- Navigate to editor: 1.8s
- Save post: 800ms - 3s (depending on server)
- Open existing post: 1.2s

**After Offline-First:**

- Initial load: 2.3s (first visit), 450ms (return visit)
- Navigate to editor: 80ms
- Save post: 15ms (local), background sync to server
- Open existing post: 25ms

The difference is dramatic. The blog feels like a native app, not a website.

## The Quota Management Dance

Browsers give you storage, but they can take it away. Safari is particularly aggressive, Chrome more generous. The trick is to be a good citizen:

```typescript
class QuotaManager {
  async checkQuota(): Promise<QuotaInfo> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100,
      };
    }
    return { usage: 0, quota: 0, percentage: 0 };
  }

  async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const result = await navigator.storage.persist();
        if (result) {
          this.notifyUser('Storage persistence granted');
        }
      }
    }
  }

  async cleanupOldData() {
    const quota = await this.checkQuota();

    if (quota.percentage > 80) {
      // Remove old drafts
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      await db.drafts.where('lastModified').below(cutoff).delete();

      // Remove cached images not referenced by posts
      await this.cleanupOrphanedImages();

      // Clear old sync history
      await db.syncQueue.where('timestamp').below(cutoff).delete();
    }
  }
}
```

Check your current quota usage at [Blog Storage Status](/blog/storage). We even have a nice visualization showing what's taking up space.

## The Unexpected Benefits

Building offline-first forced better architecture decisions. Clean separation between UI and data. Proper state management. Resilient error handling. The code became more maintainable because it had to handle every edge case.

But the real benefit? Freedom. I can write anywhere. On flights. In coffee shops with purchase-hungry WiFi. In parks. On trains. During internet outages. The blog doesn't care. It just works.

Last week, our internet went out for six hours (fiber cut, apparently). I wrote three blog posts. When the connection came back, they synced automatically. I didn't even notice the outage until Nollie wanted to watch her favorite dog videos on YouTube and I had to explain that the internet was broken.

## The Lessons Learned

**1. Offline-first is a mindset, not a feature.** You can't bolt it on later. The entire architecture needs to embrace it from the start.

**2. Conflicts are inevitable.** Design for them. Make them visible. Give users control over resolution.

**3. Storage is not infinite.** Quota management isn't optional. Be aggressive about cleanup.

**4. Sync feedback is crucial.** Users need to know what's happening. Queued, syncing, synced, failed—make it clear.

**5. Test on real devices.** Safari on iOS behaves differently than Safari on macOS. Chrome on Android has different quotas than desktop Chrome.

## Try It Yourself

Want to see ScriptHammer's offline blog in action?

1. Open the [Blog Editor](/blog/editor)
2. Start writing a post
3. Turn off your WiFi (or enable airplane mode)
4. Keep writing—notice everything still works
5. Close the browser completely
6. Turn your WiFi back on
7. Open the blog editor again
8. Watch your post sync automatically

Or check out these live demos:

- [Sync Queue Visualizer](/blog/sync-queue) - Watch the sync engine in real-time
- [Storage Manager](/blog/storage) - See what's stored offline
- [Conflict Simulator](/blog/test-conflicts) - Create and resolve conflicts
- [Draft Recovery](/blog/drafts) - See all your auto-saved drafts

The entire blog system is open source. Check out the implementation:

- `/src/lib/blog/database.ts` - IndexedDB schema
- `/src/services/blog/sync-engine.ts` - Sync and conflict resolution
- `/src/services/blog/offline-service.ts` - Offline queue management
- `/public/service-worker.js` - Service worker implementation

## The Future is Offline

We assume internet connectivity is universal. It's not. It's spotty, expensive, and sometimes non-existent. Building offline-first isn't just about handling edge cases—it's about building better software.

Your users shouldn't need to care about their connection status. The software should just work, syncing when it can, queueing when it can't, and never losing data.

The next time you're building a feature, ask yourself: "What happens when the internet isn't there?" Then build for that scenario first. The online version will take care of itself.

Now if you'll excuse me, I need to go write another blog post. The coffee shop's WiFi is down again, but that's fine. My blog doesn't need it.

P.S. - Nollie has learned that when I'm writing offline, I can't get distracted by YouTube videos of other dogs. She approves of offline-first development. More attention for her.
