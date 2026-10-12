const CACHE_PREFIX = 'pitchforks-iii-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const ROUTE_PATH = '/pitch-defender/pitchforks-3'
const PRECACHE = [ROUTE_PATH]

const isSafeAsset = (url) => {
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/api/')) return false
  if (url.pathname === ROUTE_PATH || url.pathname === `${ROUTE_PATH}/`) return true
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pitchforks/')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'PRECACHE_ROUTE') {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(ROUTE_PATH)))
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || !isSafeAsset(url)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached

    try {
      const response = await fetch(request)
      if (response.ok && isSafeAsset(url)) await cache.put(request, response.clone())
      return response
    } catch {
      return new Response('Pitchforks is offline and this asset is not cached.', {
        status: 504,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Pitchforks-Cache-Miss': '1' },
      })
    }
  })())
})
