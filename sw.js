/* Service worker: la app funciona sin conexión; las tasas siempre van a la red */
const CACHE = 'finanzas-v1.3.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/format.js', './js/store.js', './js/rates.js', './js/calc.js', './js/ui.js', './js/forms.js', './js/views.js', './js/app.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin!==location.origin || e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request).then(r=>{ const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return r; })
      .catch(()=>caches.match(e.request).then(r=>r || caches.match('./index.html')))
  );
});
