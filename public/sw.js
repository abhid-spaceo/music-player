/**
 * Service Worker.
 *
 * WHAT IT CACHES: the app shell and my own metadata. Nothing else.
 *
 * WHAT IT DELIBERATELY NEVER TOUCHES:
 *  - Any cross-origin request. That means youtube.com, youtube-nocookie.com and
 *    i.ytimg.com pass straight through, untouched and uncached. Caching YouTube
 *    media would break the API policies AND break seeking: a fetch handler that
 *    replays audio from a cache returns 200 where the browser asked for a 206
 *    range, and Safari fails hard on that. The safest handler is the one that
 *    does not exist.
 *  - Anything that is not a GET.
 *  - The auth endpoints, so a stale session is never served from a cache.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const DATA = `data-${VERSION}`;

/** Navigations we can serve offline. */
const SHELL_ROUTES = ['/library', '/search', '/playlists', '/queue', '/sign-in'];

/** Read-only endpoints whose last good response is worth keeping. */
const CACHEABLE_API = ['/api/tracks', '/api/playlists', '/api/favourites'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      cache.addAll([...SHELL_ROUTES, '/manifest.webmanifest', '/icon-192.png']).catch(() => {
        // A missing route must not abort the install.
      }),
    ),
  );
  // No skipWaiting: a new worker takes over on the NEXT load, never mid-session.
  // Activating under a playing page is how an update kills the audio.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // The page asks for the update only when it knows nothing is playing.
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cross-origin: not ours. YouTube's player, its media and its thumbnails all
  // land here and must pass through untouched.
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;
  // Never cache anything that decides who you are.
  if (url.pathname.startsWith('/api/auth') || url.pathname === '/api/session') return;

  // Immutable build output: cache-first is safe because the filenames are hashed.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Metadata: network-first so it is fresh, cache as the offline fallback.
  if (CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(DATA).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? offlineJson())),
    );
    return;
  }

  // Navigations: network-first, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((hit) => hit ?? caches.match('/library')).then(
          (hit) => hit ?? new Response('Offline', { status: 503 }),
        ),
      ),
    );
  }
});

function offlineJson() {
  return new Response(
    JSON.stringify({ ok: false, error: 'Offline, and nothing cached for this request yet.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}
