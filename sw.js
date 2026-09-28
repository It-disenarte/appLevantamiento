const CACHE = 'levantamientos-v23';
const SHELL = ['./', './index.html', './reg.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png'];
// Recursos externos que la app carga al arrancar; se guardan desde la instalación
// para que abra sin internet aunque la primera visita no pasara por el service worker.
const EXTERNOS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    await Promise.all(EXTERNOS.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function conLimite(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('lento')), ms);
    promesa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Páginas: red primero (máx. 4 s con mala señal), guarda la versión nueva, si no hay red usa la guardada.
  if (req.mode === 'navigate') {
    const red = fetch(req).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put('./index.html', copia)); }
      return resp;
    });
    e.respondWith(conLimite(red, 4000).catch(() =>
      caches.match('./index.html').then(r => r || caches.match('./')).then(r => r || red)));
    return;
  }

  // Todo lo demás: caché primero y se actualiza en segundo plano.
  e.respondWith(caches.match(req, { ignoreSearch: url.origin === self.location.origin }).then(guardada => {
    const red = fetch(req).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return resp;
    });
    if (guardada) { red.catch(() => {}); return guardada; }
    return red.catch(() => new Response('', { status: 504 }));
  }));
});
