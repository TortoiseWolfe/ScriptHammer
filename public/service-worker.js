// Blog System Service Worker
// Handles offline caching and background sync

const CACHE_NAME = 'blog-v1';
const API_CACHE = 'blog-api-v1';
const IMAGE_CACHE = 'blog-images-v1';

// Assets to cache on install
const STATIC_ASSETS = ['/', '/blog', '/offline.html'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(
        STATIC_ASSETS.filter(
          (asset) => !asset.includes('offline.html') // Skip if offline page doesn't exist
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (name) =>
              name !== CACHE_NAME && name !== API_CACHE && name !== IMAGE_CACHE
          )
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/blog')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle image requests
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default strategy: Cache first, fall back to network
  event.respondWith(
    caches.match(request).then((response) => {
      return (
        response ||
        fetch(request).then((fetchResponse) => {
          // Don't cache non-successful responses
          if (
            !fetchResponse ||
            fetchResponse.status !== 200 ||
            fetchResponse.type === 'opaque'
          ) {
            return fetchResponse;
          }

          // Clone the response before caching
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return fetchResponse;
        })
      );
    })
  );
});

// Handle API requests - Network first, fall back to cache
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // If offline, try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline response for GET requests
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          error: 'offline',
          message: 'You are currently offline',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    // Queue POST/PUT/DELETE requests for sync
    if (request.method !== 'GET') {
      await queueRequest(request);
      return new Response(
        JSON.stringify({
          queued: true,
          message: 'Request queued for sync',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 202,
        }
      );
    }
  }
}

// Handle image requests - Cache first
async function handleImageRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cache images
    if (networkResponse.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return placeholder image or 404
    return new Response('', { status: 404 });
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page if available
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

    // Fallback response
    return new Response(
      '<h1>Offline</h1><p>Please check your internet connection.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Queue requests for background sync
async function queueRequest(request) {
  const syncQueue = [];

  // Get existing queue from IndexedDB (simplified)
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : null,
      timestamp: Date.now(),
    };

    syncQueue.push(requestData);

    // Register for background sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('blog-sync');
    }
  } catch (error) {
    console.error('Failed to queue request:', error);
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'blog-sync') {
    event.waitUntil(syncQueuedRequests());
  }
});

// Process queued requests
async function syncQueuedRequests() {
  console.log('Service Worker: Processing sync queue');

  // In a real implementation, this would:
  // 1. Read queued requests from IndexedDB
  // 2. Replay them to the server
  // 3. Handle responses
  // 4. Clear successful requests from queue

  return Promise.resolve();
}

// Message handler for skip waiting
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'blog-content-sync') {
      event.waitUntil(syncBlogContent());
    }
  });
}

// Sync blog content periodically
async function syncBlogContent() {
  try {
    // Fetch latest posts
    const response = await fetch(
      '/api/blog/posts?status=published&page=1&pageSize=10'
    );

    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/blog/posts', response);
      console.log('Service Worker: Blog content synced');
    }
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}
