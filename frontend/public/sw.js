// Trois caches : la coque de l'application, les fichiers hachés de Vite (jamais modifiés) et les médias (photos).
// Incrémenter VERSION force le nettoyage des anciens caches au prochain déploiement.
const VERSION = 'v2';
const SHELL_CACHE = `ma-shell-${VERSION}`;
const ASSET_CACHE = `ma-assets-${VERSION}`;
const MEDIA_CACHE = `ma-media-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE];
const APP_SHELL = ['/', '/manifest.json', '/images/logo.jpeg', '/icons/icon-192.png', '/icons/icon-512.png'];
const MEDIA_MAX_ENTRIES = 120; // le stockage d'un téléphone d'entrée de gamme est limité

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

// Cache d'abord : fichiers dont le nom change quand le contenu change (assets hachés, photos).
async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    if (maxEntries) trim(cacheName, maxEntries);
  }
  return response;
}

// Réseau d'abord : pages et fichiers à nom fixe, pour ne jamais servir une ancienne version du site si on est en ligne.
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || (request.mode === 'navigate' ? await cache.match('/') : null);
    if (cached) return cached;
    throw error;
  }
}

// L'API n'est jamais interceptée : toujours le réseau.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  } else if (url.pathname.startsWith('/media/') || url.pathname.includes('/media/')) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, MEDIA_MAX_ENTRIES));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Mon Armoire';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || '/'));
});
