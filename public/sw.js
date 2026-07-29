// ScriptHammer Service Worker v1.0.0
// Provides offline support, caching, and background sync
// Note: Cache name includes project name - updated by rebrand script

// Stamped at build time by scripts/stamp-sw-version.mjs, which rewrites this
// literal in `out/sw.js` after `next build` (#317). The value here is the dev
// default and is intentionally left in the tracked source.
//
// It previously read "Updated by scripts/rebrand.sh", which was never true —
// rebrand.sh does not mention sw.js — so this string never changed. Returning
// visitors therefore kept a frozen precache forever, which is what turned a
// trailing-slash cache miss into a permanent offline page rather than a
// one-deploy blip.
//
// MUST keep the `scripthammer-` prefix: the activate handler purges old caches
// by matching that prefix, so a different one would leak storage instead of
// cleaning up.
const CACHE_VERSION = 'scripthammer-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Images are versioned SEPARATELY from the build, and that is the whole point
// (#438).
//
// This used to be `${CACHE_VERSION}-images`. Because CACHE_VERSION is stamped
// with the commit SHA, every deploy renamed it and `activate` deleted the
// previous one — throwing away every cached image on a code change that had
// nothing to do with images. Combined with `skipWaiting()` + `clients.claim()`
// below, an open page had its image cache deleted mid-session and was then
// claimed by the new worker, so its not-yet-requested lazy images all faulted
// into an empty cache at once. Reported from the live blog as broken-image
// icons on exactly the below-the-fold cards, with the already-painted ones
// above them fine.
//
// A fresh browser CANNOT reproduce that — with no previous worker there is no
// takeover and no deletion — which is why a clean-profile check reported 14 of
// 14 images loaded while real visitors saw them break.
//
// Bump this by hand only when the image CACHING BEHAVIOUR changes; a content
// change does not need it, since entries are keyed by request URL. Keeps the
// `scripthammer-` prefix so the activate purge below still owns it rather than
// leaking it.
const IMAGE_CACHE = 'scripthammer-images-v1';

// Assets to cache on install. Paths are relative to this script's location
// (self.registration.scope), so they resolve correctly whether the app is
// served from root or from a basePath like /project-name/.
const STATIC_ASSETS = [
  './',
  './offline.html',
  './manifest.json',
  './favicon.ico',
  './blog/',
  './themes/',
  './status/',
];

// Skip waiting and claim clients immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        // Try to cache static assets, but don't fail install if some are missing
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch(() => {
              // Silently handle cache failures
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName.startsWith('scripthammer-') &&
                cacheName !== STATIC_CACHE &&
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== IMAGE_CACHE
              );
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
/**
 * Find a cached page for a navigation request, tolerating the trailing-slash
 * mismatch between what gets precached and what users actually navigate to.
 *
 * ## The bug this fixes (#317)
 * STATIC_ASSETS precaches directory-style paths WITH a trailing slash
 * (`'./blog/'`), because that is how the static export names them. Users and
 * links navigate to `/blog` WITHOUT one. The server papers over this with a
 * 301, but a cache lookup is exact: `caches.match('/blog')` misses a cache
 * holding `/blog/`.
 *
 * So a single momentary network failure — the fallback path is only reached
 * when `fetch()` rejects — turned into a full "You're Offline" page on every
 * non-home route, while the homepage (`'./'`, which needs no toggling) kept
 * working. That asymmetry is what made it look like a site outage rather than
 * a cache-key bug.
 *
 * Order matters: exact first, so a page cached under the exact URL is never
 * shadowed by a variant.
 *
 * Returns `undefined` when every variant misses, which is the caller's signal
 * to serve offline.html — genuinely uncached routes must still get it.
 */
async function matchNavigation(request) {
  const exact = await caches.match(request);
  if (exact) return exact;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return undefined; // unparseable — fall through to offline.html
  }

  // Toggle the trailing slash: '/blog' <-> '/blog/'. Skipped for the root,
  // where stripping the slash would leave an empty path.
  const path = url.pathname;
  const toggled = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
  if (toggled && toggled !== path) {
    const variant = new URL(url.href);
    variant.pathname = toggled;
    const slashMatch = await caches.match(variant.href);
    if (slashMatch) return slashMatch;
  }

  // Last resort: same path, different query string. A cached page is a better
  // answer than the offline screen when only `?utm_source=…` differs.
  return caches.match(request, { ignoreSearch: true });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extension requests and dev server hot reload
  if (
    url.protocol === 'chrome-extension:' ||
    (url.hostname === 'localhost' && url.pathname.includes('_next'))
  ) {
    return;
  }

  // Handle API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Handle image requests - Cache first
  if (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return (
          fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseToCache = response.clone();
                caches.open(IMAGE_CACHE).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
              return response;
            })
            // This handler was the ONLY one serving content without a failure
            // path — the api and navigate handlers above and below both have
            // one (#438). Without it a rejected fetch rejects the promise given
            // to respondWith, which the browser renders as a network error for
            // that image. Nothing is cached on failure (only 200s are), so
            // there is no self-repair: the image stays broken until a reload.
            //
            // Re-checking the cache is not redundant with the lookup above. A
            // concurrent request for the same image may have populated it in
            // between, which is exactly the case during a worker takeover when
            // a page faults in many lazy images at once.
            .catch(() => caches.match(request))
        );
      })
    );
    return;
  }

  // Handle navigation requests - Network first with offline fallback.
  // See matchNavigation() for why the offline fallback is tolerant (#317).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          // Tolerant lookup (#317). A single caches.match(request) here is what
          // turned a momentary network blip into a full "You're Offline" page
          // on every non-home route.
          const cached = await matchNavigation(request);
          if (cached) {
            return cached;
          }

          // Genuinely not cached — this is what offline.html is FOR, and it
          // must still happen. Only reached once every variant has missed.
          if (request.destination === 'document') {
            return caches
              .match(new URL('./offline.html', self.registration.scope).href)
              .catch(() => {
                return new Response('Offline - Content not available', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/plain',
                  }),
                });
              });
          }
        })
    );
    return;
  }

  // Default strategy - Stale While Revalidate
  event.respondWith(
    caches.match(request).then((response) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
      return response || fetchPromise;
    })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

// Sync offline queue
async function syncOfflineQueue() {
  try {
    // Get all clients
    const clients = await self.clients.matchAll();

    // Send message to all clients to trigger sync
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_OFFLINE_QUEUE',
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    throw error; // Retry sync later
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('scripthammer-'))
            .map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// Push notification support (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification('ScriptHammer Notification', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.registration.scope));
});
