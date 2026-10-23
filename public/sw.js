/* Service worker mínimo para que la app sea instalable (PWA) en Android.
 * Estrategia: network-first para navegación y assets propios, con fallback a
 * caché. Las peticiones a la API (otro origen) NO se cachean.
 */
const CACHE = 'deal-desk-v1'
const APP_SHELL = ['/manifest.webmanifest', '/icon-256.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Solo manejamos GET del mismo origen (la API es otro origen: se ignora).
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  )
})
