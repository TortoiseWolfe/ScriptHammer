/*
 * Frozen, syntax-only excerpt from 509c8fcc:public/sw.js, the parent of #450.
 *
 * These are all four historical event.respondWith expressions. Unrelated
 * statements were reduced so this can stay a small fixture; the promise-chain
 * shapes are deliberately preserved. CI checkouts are shallow, so the guard
 * must not rely on git show at test time.
 */
function historicalFetchHandler(event, request) {
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
      .catch(() => {
        return caches.match(request);
      })
  );

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request));
    })
  );

  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(async () => {
        const cached = await matchNavigation(request);
        if (cached) {
          return cached;
        }

        if (request.destination === 'document') {
          return caches
            .match(new URL('./offline.html', self.registration.scope).href)
            .catch(() => {
              return new Response('Offline - Content not available', {
                status: 503,
              });
            });
        }
      })
  );

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
}
