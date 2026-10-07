/* Habit Mentality — service worker (offline-first app shell).
   لتحديث التطبيق للمستخدمين: غيّر رقم VERSION ثم ارفع الملفات. */
const VERSION = 'v3';
const CACHE = 'pdos-' + VERSION;
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-64.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('pdos-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function shell(e) {
  const c = await caches.open(CACHE);
  const net = fetch(e.request).then(r => { if (r && r.ok) c.put('./index.html', r.clone()); return r; });
  e.waitUntil(net.catch(() => {}));
  const cached = (await c.match('./index.html')) || (await c.match('./'));
  if (!cached) return net.catch(() => Response.error());
  // app opens instantly from cache when the network is slow (3s), otherwise uses the fresh copy
  return Promise.race([net.catch(() => cached), new Promise(r => setTimeout(() => r(cached), 3000))]);
}

async function swr(e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(e.request);
  const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === 'navigate') return e.respondWith(shell(e));
    return e.respondWith(swr(e));
  }
  // Google Fonts only; every API call (Gemini/Groq/OpenRouter/OpenAI/Anthropic) passes straight through
  if (FONT_HOSTS.includes(u.hostname)) return e.respondWith(swr(e));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
