'use strict';
/* Avisos (Web Push) y numerito en el ícono. El envío lo hace servidor/avisos.js desde GitHub Actions. */
const Notify = {
  defaults(){ return { enabled:false, tz: this.tz(), morning:'07:00', evening:'21:00', habitsAt:'19:00', tasksAt:'20:00', tasks:true, habits:true, finance:true, focus:true, streaks:true }; },
  tz(){ try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Caracas'; } catch(e){ return 'America/Caracas'; } },
  cfg(){ return Object.assign(this.defaults(), Store.data.settings.notify || {}); },
  save(patch){ Store.data.settings.notify = Object.assign(this.cfg(), patch, { tz: this.tz() }); Store.save(); },
  supported(){ return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window; },
  isIOS(){ return /iPhone|iPad|iPod/.test(navigator.userAgent); },
  standalone(){ return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true; },
  permission(){ return this.supported() ? Notification.permission : 'unsupported'; },
  b64ToBytes(b64){ const pad = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c=>c.charCodeAt(0))); },
  async hash(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 16).map(x=>x.toString(16).padStart(2, '0')).join(''); },
  subsRef(){ return Sync.db.collection('users').doc(Sync.user.uid).collection('pushSubs'); },

  async enable(){
    if (!Sync.enabled() || !Sync.user) throw new Error('Primero inicia sesión en la nube (Menú → Nube).');
    if (!window.VAPID_PUBLIC_KEY) throw new Error('Los avisos no están configurados en esta versión.');
    if (this.isIOS() && !this.standalone()) throw new Error('En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio. Instálala y actívalos desde ahí.');
    if (!this.supported()) throw new Error('Este navegador no permite notificaciones.');
    const perm = await Notification.requestPermission();
    if (perm!=='granted') throw new Error('No diste permiso. Puedes activarlo en los ajustes del sistema.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.b64ToBytes(window.VAPID_PUBLIC_KEY) });
    const j = sub.toJSON(); const id = await this.hash(j.endpoint);
    await this.subsRef().doc(id).set({ id, endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 140), createdAt: new Date().toISOString() });
    try { localStorage.setItem('finanzas.pushId', id); } catch(e){}
    this.save({ enabled: true });
    return true;
  },
  async disable(){
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub){ const id = await this.hash(sub.endpoint); if (Sync.user) await this.subsRef().doc(id).delete().catch(()=>{}); await sub.unsubscribe(); }
    } catch(e){ console.warn(e); }
    this.save({ enabled: false });
  },
  async deviceSubscribed(){
    try { if (!this.supported()) return false; const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch(e){ return false; }
  },
  async test(){
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Prueba de avisos ✅', { body: 'Así se verán tus recordatorios. El robot revisa cada 15 minutos.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'prueba' });
  },
  /* numerito del ícono: tareas de hoy sin hacer + hábitos de hoy sin marcar */
  badge(){
    if (!('setAppBadge' in navigator)) return;
    try {
      const today = todayISO(); const dow = new Date().getDay();
      const tasks = (Store.data.tasks || []).filter(t=>t.date===today && !t.done).length;
      const habits = (Store.data.habits || []).filter(h=>!h.archived && (!h.days || !h.days.length || h.days.includes(dow)) && (!h.createdAt || String(h.createdAt).slice(0, 10) <= today));
      const done = new Set((Store.data.habitLogs || []).filter(l=>l.date===today).map(l=>l.habitId));
      const n = tasks + habits.filter(h=>!done.has(h.id)).length;
      if (n > 0) navigator.setAppBadge(n).catch(()=>{}); else navigator.clearAppBadge().catch(()=>{});
    } catch(e){}
  },
};
