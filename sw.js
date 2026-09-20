// HisabGo service worker — caches the app shell and CDN libraries so repeat
// visits load almost instantly, and the app still opens (from cache) if the
// network is briefly unavailable.
const CACHE_NAME = 'hisabgo-cache-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSupabase = url.hostname.endsWith('supabase.co');
  // Never cache Supabase API calls — expense data must always be fresh.
  if(isSupabase) return;

  const isSameOrigin = url.origin === self.location.origin;
  const isStaticLib = url.hostname.includes('jsdelivr.net') ||
                       url.hostname.includes('fonts.googleapis.com') ||
                       url.hostname.includes('fonts.gstatic.com');

  if(isSameOrigin){
    // App shell: try the network first so updates show up, fall back to cache.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req))
    );
  } else if(isStaticLib){
    // Fonts / Supabase JS library: cache-first, these rarely change.
    event.respondWith(
      caches.match(req).then((cached) => {
        if(cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
          return res;
        });
      })
    );
  }
});
