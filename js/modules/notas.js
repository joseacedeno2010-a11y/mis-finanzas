'use strict';
/* Anotaciones: notas rápidas con etiquetas, fijadas y guardado automático mientras escribes */
const Notas = {
  _ed: null,     // edición en curso: { id, draft:{title, body, tags, pinned}, timer, dirty, focus, isNew }
  _st: null,     // temporizador del aviso "Guardado"

  init(){
    // delegación en document: la vista se reconstruye en cada render
    document.addEventListener('input', e=>{
      const t = e.target;
      if (t.matches('[data-nota-search]')){ App.state.notas_q = t.value; const l = document.getElementById('nota-list'); if (l) l.innerHTML = this.listHTML(); return; }
      if (t.closest('.nota-editor')) this.onEdit(t);
    });
    document.addEventListener('selectionchange', ()=>{ const ed = this._ed; const a = document.activeElement; if (ed && a && a.closest && a.closest('.nota-editor') && a.name) ed.focus = { name: a.name, start: a.selectionStart, end: a.selectionEnd }; });
    const flush = ()=>this.flush();
    document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState==='hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  },

  /* ---------- datos ---------- */
  list(){ return Store.list('notes'); },
  get(id){ return this.list().find(n=>n.id===id) || null; },
  parseTags(str){ return [...new Set(String(str || '').split(/[,\n]/).map(t=>t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))]; },
  sorted(notes){ return [...notes].sort((a,b)=>(!!b.pinned - !!a.pinned) || String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))); },
  preview(body, n=90){ const s = String(body || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; },
  titleOf(n){ return String(n.title || '').trim() || this.preview(n.body, 40) || 'Sin título'; },
  day(ts){ const d = new Date(ts || ''); return isNaN(d) ? '' : toISO(d); },
  tagCounts(){ const m = {}; this.list().forEach(n=>(n.tags || []).forEach(t=>{ m[t] = (m[t] || 0) + 1; })); return Object.entries(m).sort((a,b)=>b[1] - a[1] || a[0].localeCompare(b[0])); },
  create(){ App.go('#/notas/' + uid()); },

  /* ---------- lista ---------- */
  view(){
    const S = App.state; const tags = this.tagCounts();
    const tag = S.notas_tag && tags.some(([t])=>t===S.notas_tag) ? S.notas_tag : '';
    let html = Views.back('#/menu', 'Anotaciones', `<button class="iconbtn" data-action="nota-new" aria-label="Nueva nota">${UI.icon('plus')}</button>`);
    if (!this.list().length) return html + `<div class="card">${UI.empty('📝', 'Aún no tienes anotaciones', 'Guarda ideas, listas, frases o lo que no quieras olvidar. Se guardan solas mientras escribes.')}<button class="btn" data-action="nota-new">${UI.icon('plus')} Escribir la primera</button></div>`;
    html += `<div class="search">${UI.icon('search')}<input data-nota-search placeholder="Buscar por título, texto o etiqueta" value="${esc(S.notas_q || '')}"></div>`;
    if (tags.length) html += `<div class="chips mb"><button class="chip ${!tag ? 'active' : ''}" data-action="nota-tag" data-tag="">Todas</button>${tags.map(([t, c])=>`<button class="chip ${tag===t ? 'active' : ''}" data-action="nota-tag" data-tag="${esc(t)}">#${esc(t)} · ${c}</button>`).join('')}</div>`;
    html += `<div id="nota-list">${this.listHTML()}</div>`;
    return html;
  },
  listHTML(){
    const S = App.state; const q = String(S.notas_q || '').trim().toLowerCase(); const tag = S.notas_tag || '';
    let notes = this.list();
    if (tag) notes = notes.filter(n=>(n.tags || []).includes(tag));
    if (q) notes = notes.filter(n=>`${n.title || ''} ${n.body || ''} ${(n.tags || []).map(t=>'#' + t).join(' ')}`.toLowerCase().includes(q));
    notes = this.sorted(notes);
    if (!notes.length) return `<div class="card">${UI.empty('🔍', 'Sin resultados', q ? 'Prueba con otra palabra' : 'No hay notas con esa etiqueta')}</div>`;
    const pinned = notes.filter(n=>n.pinned), rest = notes.filter(n=>!n.pinned);
    let html = '';
    if (pinned.length) html += `<div class="day-head"><span>Fijadas</span><span>${pinned.length}</span></div><div class="card tight"><div class="list">${pinned.map(n=>this.row(n)).join('')}</div></div>`;
    if (rest.length) html += `${pinned.length ? `<div class="day-head"><span>Recientes</span><span>${rest.length}</span></div>` : ''}<div class="card tight"><div class="list">${rest.map(n=>this.row(n)).join('')}</div></div>`;
    return html;
  },
  row(n){
    const hasTitle = !!String(n.title || '').trim();
    const sub = hasTitle ? this.preview(n.body) : '';
    const tags = n.tags || [];
    return `<button class="item clickable" data-go="#/notas/${n.id}"><div class="ic ${n.pinned ? 'a' : ''}">${n.pinned ? '📌' : '📝'}</div><div class="body"><div class="title ellipsis">${esc(this.titleOf(n))}</div>${sub ? `<div class="sub ellipsis">${esc(sub)}</div>` : ''}${tags.length ? `<div class="nota-tags">${tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>` : ''}</div><div class="nota-date xs muted">${fmtDate(this.day(n.updatedAt || n.createdAt), 'day')}</div></button>`;
  },

  /* ---------- editor ---------- */
  editor(id){
    if (this._ed && this._ed.id!==id){ this.flush(); this._ed = null; }
    const stored = this.get(id);
    const ed = this._ed && this._ed.id===id ? this._ed : null;
    const d = ed ? ed.draft : { title: stored ? String(stored.title || '') : '', body: stored ? String(stored.body || '') : '', tags: stored ? (stored.tags || []).join(', ') : '', pinned: !!(stored && stored.pinned) };
    if (!ed) this._ed = { id, draft: d, timer: null, dirty: false, focus: null, isNew: !stored };
    const meta = stored ? `Última edición: ${fmtDateTime(stored.updatedAt || stored.createdAt)}` : 'Nota nueva · se guarda sola mientras escribes';
    return `<div class="topbar"><button class="iconbtn" data-action="nota-back" aria-label="Volver">${UI.icon('back')}</button><h1 id="nota-h1">${stored ? 'Nota' : 'Nueva nota'}</h1><span class="nota-status" id="nota-status"></span><button class="iconbtn nota-pinbtn ${d.pinned ? 'on' : ''}" data-action="nota-pin" aria-label="Fijar">${UI.icon('star')}</button><button class="iconbtn" data-action="nota-delete" aria-label="Borrar">${UI.icon('trash')}</button></div>
      <div class="card nota-editor">
        <input class="nota-title" name="title" placeholder="Título" value="${esc(d.title)}" autocomplete="off">
        <textarea class="nota-body" name="body" placeholder="Escribe aquí…">${esc(d.body)}</textarea>
        <div class="nota-tagrow">${UI.icon('tag')}<input class="nota-tagsin" name="tags" placeholder="Etiquetas separadas por coma" value="${esc(d.tags)}" autocomplete="off"></div>
        <div class="xs muted nota-meta" id="nota-meta">${meta}</div>
      </div>`;
  },
  autosize(ta){ ta.style.height = 'auto'; ta.style.height = Math.max(160, ta.scrollHeight + 2) + 'px'; },
  onEdit(t){
    const ed = this._ed; if (!ed) return;
    const name = t.name; if (!name || !(name in ed.draft) || name==='pinned') return;
    ed.draft[name] = t.value; ed.dirty = true;
    ed.focus = { name, start: t.selectionStart, end: t.selectionEnd };
    if (name==='body') this.autosize(t);
    clearTimeout(ed.timer); ed.timer = setTimeout(()=>this.save(true), 600);
    const st = document.getElementById('nota-status'); if (st) st.classList.remove('show');
  },
  save(showStatus){
    const ed = this._ed; if (!ed || !ed.dirty) return false;
    clearTimeout(ed.timer); ed.timer = null;
    const d = ed.draft; const stored = this.get(ed.id);
    const title = d.title.trim(), body = d.body, tags = this.parseTags(d.tags);
    if (!stored && !title && !body.trim() && !tags.length){ ed.dirty = false; return false; }
    const now = new Date().toISOString();
    Store.upsert('notes', { id: ed.id, title, body, tags, pinned: !!d.pinned, createdAt: stored && stored.createdAt ? stored.createdAt : now, updatedAt: now });
    ed.dirty = false; ed.isNew = false;
    if (showStatus){
      const st = document.getElementById('nota-status');
      if (st){ st.textContent = 'Guardado'; st.classList.add('show'); clearTimeout(this._st); this._st = setTimeout(()=>st.classList.remove('show'), 1800); }
      const meta = document.getElementById('nota-meta'); if (meta) meta.textContent = `Última edición: ${fmtDateTime(now)}`;
      const h1 = document.getElementById('nota-h1'); if (h1) h1.textContent = 'Nota';
    }
    return true;
  },
  flush(){ return this._ed ? this.save(false) : false; },

  afterRender(hash){
    const m = hash.match(/^#\/notas\/([\w-]+)$/);
    if (!m){
      if (this._ed){ const saved = this.flush(); this._ed = null; if (saved && /^#\/?(notas)?$/.test(hash)) setTimeout(()=>App.render(), 0); }
      return;
    }
    const ta = document.querySelector('.nota-editor .nota-body'); if (ta) this.autosize(ta);
    const ed = this._ed; if (!ed) return;
    if (ed.focus){
      const el = document.querySelector(`.nota-editor [name="${ed.focus.name}"]`);
      if (el && document.activeElement!==el){ try { el.focus(); el.setSelectionRange(ed.focus.start, ed.focus.end); } catch(e){} }
    } else if (ed.isNew){ const el = document.querySelector('.nota-editor .nota-title'); if (el) el.focus(); }
  },

  /* ---------- tarjeta del Inicio ---------- */
  homeCard(){
    const notes = this.sorted(this.list()).slice(0, 2);
    let html = `<div class="card"><div class="card-head"><h3>📝 Anotaciones</h3><a class="link" href="#/notas">Ver todas</a></div>`;
    if (!notes.length) html += `<div class="small muted">Guarda ideas, listas o lo que no quieras olvidar.</div>`;
    else html += `<div class="nota-home">${notes.map(n=>{ const hasTitle = !!String(n.title || '').trim(); const sub = hasTitle ? this.preview(n.body, 70) : ''; return `<button class="nota-home-row" data-go="#/notas/${n.id}"><span class="nota-home-ic">${n.pinned ? '📌' : '📝'}</span><div class="grow"><div class="semibold ellipsis">${esc(this.titleOf(n))}</div>${sub ? `<div class="xs muted ellipsis">${esc(sub)}</div>` : ''}</div>${UI.icon('chevron')}</button>`; }).join('')}</div>`;
    html += `<button class="btn secondary sm mt" data-action="nota-new">${UI.icon('plus')} Nota</button></div>`;
    return html;
  },
};

App.registerModule({
  id: 'notas',
  name: 'Anotaciones',
  icon: 'edit',
  collections: ['notes'],
  routes: [
    [/^#\/notas$/, ()=>Notas.view(), 'menu'],
    [/^#\/notas\/([\w-]+)$/, m=>Notas.editor(m[1]), 'menu'],
  ],
  menu: [{ hash: '#/notas', icon: 'edit', label: 'Anotaciones' }],
  homeCards: [{ order: 55, render: ()=>Notas.homeCard() }],
  fab: [{ label: 'Nueva nota', sub: 'Una idea, una lista o algo que no quieres olvidar', icon: 'edit', cls: 'b', run(){ Notas.create(); } }],
  actions: {
    'nota-new'(){ Notas.create(); },
    'nota-tag'(d){ App.state.notas_tag = d.tag || ''; App.render(); },
    'nota-back'(){ Notas.flush(); Notas._ed = null; App.go('#/notas'); },
    'nota-pin'(d, el){
      const ed = Notas._ed; if (!ed) return;
      ed.draft.pinned = !ed.draft.pinned; ed.dirty = true;
      Notas.save(true);
      if (el) el.classList.toggle('on', ed.draft.pinned);
      UI.toast(ed.draft.pinned ? 'Nota fijada arriba' : 'Nota sin fijar');
    },
    async 'nota-delete'(){
      const ed = Notas._ed; if (!ed) return;
      if (!Notas.get(ed.id)){ clearTimeout(ed.timer); ed.dirty = false; Notas._ed = null; App.go('#/notas'); return; }
      if (!(await UI.confirm('¿Borrar esta nota? No se puede deshacer.', { ok:'Borrar' }))) return;
      clearTimeout(ed.timer); ed.dirty = false; Notas._ed = null;
      Store.remove('notes', ed.id);
      App.go('#/notas'); UI.toast('Nota borrada');
    },
  },
  css: `
.nota-editor{padding:14px 16px}
.nota-title{width:100%;border:0;background:transparent;outline:none;font-size:22px;font-weight:700;letter-spacing:-.02em;padding:4px 0 10px;border-bottom:1px solid var(--line)}
.nota-title::placeholder,.nota-body::placeholder,.nota-tagsin::placeholder{color:var(--muted);opacity:.7}
.nota-body{width:100%;border:0;background:transparent;outline:none;resize:none;overflow:hidden;min-height:160px;padding:12px 0;font-size:16px;line-height:1.5;display:block}
.nota-tagrow{display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:10px}
.nota-tagrow svg{width:16px;height:16px;color:var(--muted);flex:none}
.nota-tagsin{flex:1;min-width:0;border:0;background:transparent;outline:none;font-size:14px;padding:4px 0}
.nota-meta{margin-top:8px}
.nota-status{font-size:12px;font-weight:600;color:var(--green);opacity:0;transition:opacity .25s;white-space:nowrap;flex:none}
.nota-status.show{opacity:1}
.nota-pinbtn.on{color:var(--amber)} .nota-pinbtn.on svg{fill:var(--amber)}
.nota-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.nota-tags span{font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-soft);padding:1px 7px;border-radius:999px}
.nota-date{flex:none;white-space:nowrap;align-self:flex-start;padding-top:2px}
.nota-home-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 0;border-bottom:1px solid var(--line)}
.nota-home-row:last-child{border-bottom:0}
.nota-home-row > svg{width:16px;height:16px;color:var(--muted);flex:none}
.nota-home-ic{font-size:18px;flex:none}
`,
  init(){ Notas.init(); },
  afterRender(hash){ Notas.afterRender(hash); },
});
