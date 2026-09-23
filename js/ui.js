'use strict';
/* Iconos, hojas modales, avisos */
const ICONS = {
  home:'<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  scale:'<path d="M12 3v18M7 21h10M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/><path d="M5 7l-3 8a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 8a3.5 3.5 0 0 0 6 0l-3-8z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  down:'<path d="M12 5v14M19 12l-7 7-7-7"/>',
  swap:'<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
  wallet:'<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H6a2 2 0 0 0-2 2v2"/><circle cx="16" cy="14" r="1.5"/>',
  tag:'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  chevron:'<path d="M9 18l6-6-6-6"/>',
  left:'<path d="M15 18l-6-6 6-6"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  dollar:'<path d="M12 2v20M17 6.5H9.5a2.75 2.75 0 0 0 0 5.5h5a2.75 2.75 0 0 1 0 5.5H6"/>',
  handout:'<path d="M12 2v20M17 6.5H9.5a2.75 2.75 0 0 0 0 5.5h5a2.75 2.75 0 0 1 0 5.5H6"/><path d="M19 12l3 3-3 3" transform="translate(-1 -3) scale(.9)"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  trend:'<path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  coins:'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  more:'<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>',
  star:'<path d="M12 2.5l2.94 6.1 6.7.9-4.9 4.7 1.2 6.7L12 17.7l-5.94 3.2 1.2-6.7-4.9-4.7 6.7-.9z"/>',
  sort:'<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
};
const ACCOUNT_COLORS = ['#0f766e','#2563eb','#7c3aed','#db2777','#ea580c','#f0b90b','#16a34a','#0891b2','#111827','#dc2626'];
function siteDomain(s){ return String(s||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[\/?#]/)[0]; }
/* Logos de cuentas por dominio: prueba Google, luego DuckDuckGo, luego el favicon del sitio.
   Google devuelve un globo genérico de 16 px y DuckDuckGo uno de 48 px cuando no hay logo; se descartan. */
const AccIcons = {
  cache: (()=>{ try { return JSON.parse(localStorage.getItem('finanzas.icons') || '{}'); } catch(e){ return {}; } })(),
  save(){ try { localStorage.setItem('finanzas.icons', JSON.stringify(this.cache)); } catch(e){} },
  candidates(d){ return [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`, `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`, `https://${d}/favicon.ico`]; },
  accept(step, w){ return step===0 ? w > 16 : step===1 ? (w > 0 && w!==48) : w > 0; },
  img(d){
    if (d in this.cache) return this.cache[d] ? `<img src="${this.cache[d]}" alt="" referrerpolicy="no-referrer">` : '';
    return `<img src="${this.candidates(d)[0]}" alt="" referrerpolicy="no-referrer" data-domain="${esc(d)}" data-step="0" onload="AccIcons.onload(this)" onerror="AccIcons.next(this)">`;
  },
  onload(img){ const step = +img.dataset.step; if (this.accept(step, img.naturalWidth)){ this.cache[img.dataset.domain] = img.src; this.save(); } else this.next(img); },
  next(img){
    const d = img.dataset.domain; const step = +img.dataset.step + 1; const c = this.candidates(d);
    if (step >= c.length){ this.cache[d] = null; this.save(); img.remove(); return; }
    img.dataset.step = step; img.src = c[step];
  },
  forget(d){ delete this.cache[d]; this.save(); },
};
const UI = {
  icon(name, cls=''){ return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`; },
  avatar(name){ return `<div class="avatar" style="background:${colorFor(name)}">${esc(initials(name))}</div>`; },
  /* ícono de cuenta: logo del sitio web, emoji o billetera, sobre fondo de color */
  accIcon(acc, size=''){
    const color = acc.color || colorFor(acc.name || '');
    const inner = acc.icon ? esc(acc.icon) : this.icon('wallet');
    const domain = siteDomain(acc.site);
    if (domain) return `<div class="ic acc-ic ${size}" style="background:${color}1f;color:${color}">${AccIcons.img(domain)}<span>${inner}</span></div>`;
    return `<div class="ic acc-ic ${size}" style="background:${color}1f;color:${color}">${inner}</div>`;
  },
  donut(items, stroke=13){
    const R = 42, C = 2 * Math.PI * R; let off = 0;
    const total = items.reduce((s,i)=>s + i.value, 0);
    if (!total) return `<svg viewBox="0 0 100 100" class="donut"><circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/></svg>`;
    const gap = items.length > 1 ? 1.6 : 0;
    const arcs = items.map(i=>{ const len = i.value / total * C; const d = Math.max(0, len - gap); const s = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${i.color}" stroke-width="${stroke}" stroke-dasharray="${d.toFixed(2)} ${(C - d).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return s; }).join('');
    return `<svg viewBox="0 0 100 100" class="donut">${arcs}</svg>`;
  },
  toast(msg, err=false){
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show'+(err?' err':'');
    clearTimeout(this._tt); this._tt = setTimeout(()=>{ t.className=''; }, 2600);
  },
  empty(icon, text, sub=''){ return `<div class="empty"><div class="big">${icon}</div><div class="semibold">${esc(text)}</div>${sub?`<div class="small">${esc(sub)}</div>`:''}</div>`; },

  /* Hoja modal desde abajo. Devuelve {el, body, close} */
  sheet({ title, html, onClose }){
    const root = document.getElementById('modal-root');
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-head">${title!==null?`<h3>${esc(title)}</h3>`:'<div class="grow"></div>'}<button class="iconbtn ghost" data-close aria-label="Cerrar">${this.icon('x')}</button></div>
      <div class="sheet-body">${html}</div></div>`;
    const close = ()=>{ if(!ov.parentNode) return; ov.remove(); document.body.style.overflow = root.children.length? 'hidden':''; if (onClose) onClose(); };
    ov.addEventListener('click', e=>{ if (e.target===ov || e.target.closest('[data-close]')) close(); });
    root.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const first = ov.querySelector('[autofocus]'); if (first) setTimeout(()=>first.focus(), 80);
    return { el: ov, body: ov.querySelector('.sheet-body'), close };
  },
  closeAll(){ document.getElementById('modal-root').innerHTML=''; document.body.style.overflow=''; },
  confirm(text, { ok='Eliminar', danger=true }={}){
    return new Promise(res=>{
      const s = this.sheet({ title:null, html:`<div class="center" style="padding:6px 0 4px"><div style="font-size:17px;font-weight:600;margin-bottom:16px">${esc(text)}</div>
        <div class="btnrow"><button class="btn secondary" data-no>Cancelar</button><button class="btn ${danger?'danger':''}" data-yes>${esc(ok)}</button></div></div>`, onClose:()=>res(false) });
      s.body.querySelector('[data-yes]').onclick = ()=>{ s.el.remove(); document.body.style.overflow=''; res(true); };
      s.body.querySelector('[data-no]').onclick = ()=>s.close();
    });
  },
  /* opciones de un menú tipo lista */
  options(title, items){
    return new Promise(res=>{
      const s = this.sheet({ title, html: items.map((it,i)=>`<button class="opt" data-i="${i}"><div class="ic ${it.cls||''}">${this.icon(it.icon)}</div><div><div class="t">${esc(it.label)}</div>${it.sub?`<div class="s">${esc(it.sub)}</div>`:''}</div></button>`).join(''), onClose:()=>res(null) });
      s.body.addEventListener('click', e=>{ const b=e.target.closest('[data-i]'); if(!b) return; const it=items[+b.dataset.i]; s.el.remove(); document.body.style.overflow=''; res(it.value ?? it); });
    });
  },
};
