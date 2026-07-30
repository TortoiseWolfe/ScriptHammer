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

  // Never intercept Next's OWN router traffic.
  //
  // This is what made clicking "Blog" land the user on
  // `https://scripthammer.com/blog/index.txt` — the raw RSC flight payload —
  // instead of the blog.
  //
  // Under `output: 'export'` the App Router fetches a per-route `index.txt`
  // flight payload to do a client-side navigation. That request was falling
  // through to the stale-while-revalidate handler at the bottom of this file,
  // which has no failure path: one rejected `fetch` rejects `respondWith`, the
  // router's fetch dies, and Next recovers by HARD-NAVIGATING to the URL it was
  // fetching. The address bar ends up on the payload.
  //
  // The `_next` skip below was previously scoped to `hostname === 'localhost'`,
  // so production was the only place the worker sat in the router's path — the
  // one environment where it could break navigation for real users.
  //
  // Router traffic gains nothing from being cached here: a stale flight payload
  // does not match the shipped HTML, and the navigation handler already caches
  // the page itself for offline use.
  if (
    url.protocol === 'chrome-extension:' ||
    url.pathname.includes('/_next/') ||
    // RSC flight payloads. No origin qualifier: `self.location` does not exist
    // in a plain worker scope, and reading `.origin` off it threw on EVERY
    // request — which would have disabled the whole worker in production. The
    // unit tests caught it. Bypassing a cross-origin `.txt` is harmless anyway,
    // since bypass just means "let the browser handle this normally".
    url.pathname.endsWith('.txt')
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
          // RETRY BEFORE FALLING BACK TO CACHE (#467).
          //
          // Cached HTML and the live assets can belong to DIFFERENT BUILDS.
          // GitHub Pages serves only the current build, so the previous
          // deploy's hashed CSS is deleted — measured, a stale hash 404s. If a
          // navigation fails for a moment during a deploy and we answer it with
          // HTML from the older build, every `<link rel=stylesheet>` in that
          // HTML 404s and the visitor gets the site with NO CSS: no nav, white
          // background, the logo painting at its natural size. That is what a
          // real user reported, and the DOM was perfectly correct.
          //
          // So when the network is reachable, try once more — with `cache:
          // 'reload'` to bypass the HTTP cache — before reaching for anything
          // stored. A deploy swap and a momentary blip both recover here, and
          // neither can serve HTML older than the assets on the server.
          //
          // `navigator.onLine` is a weak signal (it reports true for a captive
          // portal), which is exactly why it only gates an EXTRA ATTEMPT and
          // never suppresses the cache path below. #317's symptom must not come
          // back: a genuinely offline visitor still gets their cached page.
          // Optional chaining, and `!== false` rather than a truthiness test:
          // skip the extra attempt only when we KNOW the client is offline. A
          // scope without `navigator` must still retry, not throw — reading
          // `self.navigator.onLine` unguarded threw inside this catch and
          // rejected the whole response, which broke all five #317 tests. The
          // sibling sw-router-bypass spec records the same mistake with
          // `self.location.origin`: a real worker has these, so the failure
          // would only ever have shown up somewhere it was too late to see.
          if (self.navigator?.onLine !== false) {
            try {
              const retried = await fetch(request, { cache: 'reload' });
              if (retried && retried.status === 200) {
                const clone = retried.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(request, clone);
                });
                return retried;
              }
            } catch {
              // Still failing — fall through to the cache, as before.
            }
          }

          // Tolerant lookup (#317). A single caches.match(request) here is what
          // turned a momentary network blip into a full "You're Offline" page
          // on every non-home route.
          const cached = await matchNavigation(request);
          if (cached) {
            return cached;
          }

          // Genuinely not cached — this is what offline.html is FOR, and it
          // must still happen. Only reached once every variant has missed.
          // `caches.match()` RESOLVES to undefined on a miss — it does not
          // reject — so the `.catch` this used to rely on could never fire. If
          // offline.html was not cached, respondWith got `undefined` and the
          // navigation failed as an opaque network error, with the 503 below
          // unreachable dead code.
          //
          // The `destination === 'document'` guard is also gone: anything else
          // fell off the end of this function and returned undefined, which is
          // the same opaque failure by a different route.
          const offline = await caches.match(
            new URL('./offline.html', self.registration.scope).href
          );
          if (offline) return offline;

          return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        })
    );
    return;
  }

  // Default strategy - Stale While Revalidate
  //
  // This handler serves every remaining asset. It had NO failure path, so a
  // single rejected `fetch` rejected `respondWith` and the browser reported
  // `net::ERR_FAILED` on that asset — the same defect fixed for images in #438,
  // left behind here because that change was scoped to one handler.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Re-check the cache: a sibling request may have populated it while
          // this one was in flight. `caches.match` RESOLVES to undefined on a
          // miss rather than rejecting, so the `||` below is the real guard.
          const late = await caches.match(request);
          if (late) return late;
          // Nothing cached and the network is gone. Fail as an explicit, honest
          // response rather than by rejecting — a rejected respondWith is an
          // opaque ERR_FAILED that looks like a bug in the page.
          return new Response('Offline - asset not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
      // Cache-first when we have it, network otherwise.
      return cached || fetchPromise;
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
