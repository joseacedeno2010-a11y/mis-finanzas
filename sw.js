/* Service worker: la app funciona sin conexión; las tasas siempre van a la red */
const CACHE = 'finanzas-v2.2.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/config.js', './js/sync.js', './js/notify.js', './js/format.js', './js/store.js', './js/rates.js', './js/calc.js', './js/ui.js', './js/forms.js', './js/views.js', './js/app.js', './js/modules/dia.js', './js/modules/habitos.js', './js/modules/semana.js', './js/modules/metas.js', './js/modules/rueda.js', './js/modules/notas.js', './js/modules/logros.js', './js/modules/plan.js', './js/modules/deudas.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* Avisos push */
self.addEventListener('push', e=>{
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){ d = { title: 'Aviso', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Aviso', {
    body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: d.tag || undefined, renotify: false,
    data: { url: d.url || '#/' },
  }));
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const target = new URL('./index.html' + ((e.notification.data && e.notification.data.url) || '#/'), self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list=>{
    for (const c of list){ if (c.url.startsWith(self.registration.scope)){ if ('navigate' in c) c.navigate(target); return c.focus(); } }
    return clients.openWindow(target);
  }));
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (e.request.method!=='GET') return;
  if (url.hostname==='www.gstatic.com' && url.pathname.startsWith('/firebasejs/')){
    e.respondWith(caches.match(e.request).then(r=>r || fetch(e.request).then(res=>{ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res; })));
    return;
  }
  if (url.origin!==location.origin) return;
  // red primero, revalidando siempre con el servidor (evita quedarse con archivos viejos del caché HTTP)
  e.respondWith(
    fetch(e.request, { cache:'no-cache' }).then(r=>{ if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); } return r; })
      .catch(()=>caches.match(e.request).then(r=>r || caches.match('./index.html')))
  );
});
