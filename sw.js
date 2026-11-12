// Network first, cache as the offline fallback — so updates show up without a version bump.
// (The page also checks for new versions itself; see "Updates" in app.js.)
const CACHE = 'revmix-v1';
// The recorded instruments (the same list as in app.js).
const SOUNDS = {
  choir: [52, 56, 60, 64, 68, 72, 76, 80],
  strings: [48, 54, 58, 64, 70, 76, 82, 88],
  marimba: [48, 52, 56, 60, 64, 68, 72, 76, 80, 84],
  piano: [60, 64, 69, 72, 76, 81, 85, 90, 94, 98],
  harp: [60, 66, 72, 78, 84],
  celeste: [72, 80, 88, 96],
  timp: [36, 42, 48],
  hit: ['shaker', 'conga', 'congamute', 'cymbal', 'timproll'],
};
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...Object.entries(SOUNDS).flatMap(([inst, notes]) => notes.map((n) => 'sounds/' + inst + '/' + n + '.m4a'))];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' }) // always ask the server, so a new version is never hidden by the phone's own cache
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
