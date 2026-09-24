'use strict';
/* Rueda de la vida: una foto por mes de cómo va cada área (1 a 10), radar y evolución */
const Rueda = {
  DEFAULTS: [
    ['wa-salud', 'Salud y deporte', 'Energía, descanso, alimentación y ejercicio'],
    ['wa-ocio', 'Ocio y amistad', 'Tiempo libre, diversión y amigos'],
    ['wa-educacion', 'Educativa y cultural', 'Aprender, leer, crecer y disfrutar la cultura'],
    ['wa-familia', 'Familia y pareja', 'Relaciones cercanas y vida afectiva'],
    ['wa-dinero', 'Dinero y finanzas', 'Ingresos, ahorro, deudas y tranquilidad económica'],
    ['wa-trabajo', 'Trabajo y propósito', 'Carrera, proyectos y sentido de lo que haces'],
    ['wa-espiritu', 'Espiritualidad y paz', 'Calma interior, valores y conexión contigo'],
    ['wa-hogar', 'Entorno y hogar', 'Tu casa, tu espacio y el lugar donde vives'],
  ],
  _timers: {},

  init(){
    if (!Store.list('wheelAreas').length && !Store.list('wheelScores').length){
      const arr = Store.list('wheelAreas');
      this.DEFAULTS.forEach(([id, name, description], i)=>arr.push({ id, name, description, order: i }));
      Store.save();
    }
    // los deslizadores se manejan por delegación (la vista se reconstruye en cada render)
    document.addEventListener('input', e=>{ if (e.target.matches('.rueda-range')) this.onRange(e.target, false); });
    document.addEventListener('change', e=>{ if (e.target.matches('.rueda-range')) this.onRange(e.target, true); });
  },

  /* ---------- datos ---------- */
  areas(){ return [...Store.list('wheelAreas')].sort((a,b)=>(a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name))); },
  score(key){ return Store.list('wheelScores').find(s=>s.id===key) || null; },
  scoresOf(key){ const s = this.score(key); return s && s.scores ? s.scores : {}; },
  month(){ return App.state.rueda_month || thisMonthKey(); },
  clamp(v){ v = Math.round(Number(v)); return isFinite(v) ? Math.min(10, Math.max(1, v)) : 5; },
  fmt(n){ return n==null ? '—' : fmtNum(n, 1, 'es-ES'); },
  stats(scores, areas){
    const rated = areas.filter(a=>scores[a.id] >= 1);
    if (!rated.length) return { n: 0, avg: null, low: null, high: null, lowV: null, highV: null };
    let sum = 0, low = rated[0], high = rated[0];
    for (const a of rated){ const v = scores[a.id]; sum += v; if (v < scores[low.id]) low = a; if (v > scores[high.id]) high = a; }
    return { n: rated.length, avg: Math.round(sum / rated.length * 10) / 10, low, high, lowV: scores[low.id], highV: scores[high.id] };
  },
  setScore(key, areaId, v){
    const cur = this.score(key);
    const scores = Object.assign({}, cur ? cur.scores : {}); scores[areaId] = v;
    Store.upsert('wheelScores', { id: key, scores, note: cur ? (cur.note || '') : '' });
  },
  wrap(text, max){
    const lines = []; let line = '';
    for (const w of String(text || '').split(/\s+/)){
      if (!w) continue;
      if (line && (line + ' ' + w).length > max){ lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  },

  /* ---------- gráficos SVG ---------- */
  radarSVG(areas, scores, prev){
    const N = areas.length; if (!N) return '';
    const W = 380, H = 330, cx = 190, cy = 165, R = 96;
    const ang = i=>-Math.PI / 2 + i * 2 * Math.PI / N;
    const pt = (i, r)=>[cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    const ring = r=>areas.map((a, i)=>pt(i, r).map(n=>n.toFixed(1)).join(',')).join(' ');
    const poly = sc=>areas.map((a, i)=>{ const v = sc[a.id] >= 1 ? sc[a.id] : 0; return pt(i, R * v / 10).map(n=>n.toFixed(1)).join(','); }).join(' ');
    let s = '';
    for (const lvl of [2, 4, 6, 8, 10]) s += `<polygon points="${ring(R * lvl / 10)}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    areas.forEach((a, i)=>{ const [x, y] = pt(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`; });
    if (prev && areas.some(a=>prev[a.id] >= 1)) s += `<polygon points="${poly(prev)}" fill="var(--muted)" fill-opacity=".12" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
    if (areas.some(a=>scores[a.id] >= 1)){
      s += `<polygon points="${poly(scores)}" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
      areas.forEach((a, i)=>{ if (!(scores[a.id] >= 1)) return; const [x, y] = pt(i, R * scores[a.id] / 10); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>`; });
    }
    areas.forEach((a, i)=>{
      const [x, y] = pt(i, R + 14); const c = Math.cos(ang(i)), sn = Math.sin(ang(i));
      const anchor = c > 0.15 ? 'start' : c < -0.15 ? 'end' : 'middle';
      const lines = this.wrap(a.name, 12); const lh = 11;
      const y0 = sn < -0.3 ? y - 2 - (lines.length - 1) * lh : sn > 0.3 ? y + 10 : y + 4 - (lines.length - 1) * lh / 2;
      const v = scores[a.id] >= 1 ? scores[a.id] : null;
      s += `<text x="${x.toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="${anchor}" font-size="10.5" font-weight="600" fill="${v!=null ? 'var(--text)' : 'var(--muted)'}">${lines.map((l, k)=>`<tspan x="${x.toFixed(1)}" dy="${k ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    });
    return `<svg class="chart rueda-radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rueda de la vida">${s}</svg>`;
  },
  historySVG(rows){
    const W = 600, H = 170, padL = 28, padR = 16, padT = 18, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const x = i=>padL + (rows.length > 1 ? i * iw / (rows.length - 1) : iw / 2);
    const y = v=>padT + (10 - v) / 9 * ih;
    let s = '';
    for (const lvl of [1, 4, 7, 10]) s += `<line x1="${padL}" x2="${W - padR}" y1="${y(lvl).toFixed(1)}" y2="${y(lvl).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 6}" y="${(y(lvl) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${lvl}</text>`;
    const pts = rows.map((r, i)=>r.avg!=null ? [x(i), y(r.avg)] : null);
    const path = pts.filter(Boolean).map((p, i)=>`${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    if (path) s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const lastIdx = rows.reduce((m, r, i)=>r.avg!=null ? i : m, -1);
    rows.forEach((r, i)=>{
      s += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${fmtMonthShort(r.key).split(' ')[0]}</text>`;
      if (r.avg==null) return;
      const [px, py] = pts[i]; const last = i===lastIdx;
      s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${last ? 4.5 : 3}" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>`;
      if (last) s += `<text x="${px.toFixed(1)}" y="${(py - 9).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${this.fmt(r.avg)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${s}</svg>`;
  },

  /* ---------- trozos de la vista que se actualizan en vivo ---------- */
  heroInner(key, st, pst, nAreas){
    let sub;
    if (!st.n) sub = 'Puntúa cada área del 1 al 10';
    else {
      sub = `${st.n} de ${nAreas} área${nAreas===1 ? '' : 's'} puntuada${st.n===1 ? '' : 's'}`;
      if (pst.avg!=null){ const d = Math.round((st.avg - pst.avg) * 10) / 10; sub += d > 0 ? ` · ▲ ${this.fmt(d)} más que el mes anterior` : d < 0 ? ` · ▼ ${this.fmt(-d)} menos que el mes anterior` : ' · igual que el mes anterior'; }
    }
    let h = `<div class="label">Promedio de ${fmtMonth(key).toLowerCase()}</div><div class="big">${st.avg==null ? '—' : this.fmt(st.avg)}<span class="rueda-of">/10</span></div><div class="sub">${sub}</div>`;
    if (st.n) h += `<div class="hero-tiles"><div class="hero-tile pos"><div class="t">${UI.icon('up')} Más alta</div><div class="v">${esc(st.high.name)} · ${st.highV}</div></div><div class="hero-tile neg"><div class="t">${UI.icon('down')} Más baja</div><div class="v">${esc(st.low.name)} · ${st.lowV}</div></div><div class="hero-tile"><div class="t">${UI.icon('calendar')} Mes anterior</div><div class="v">${pst.avg==null ? '—' : this.fmt(pst.avg)}</div></div></div>`;
    return h;
  },
  focoHTML(st){
    if (!st.low) return '';
    const msg = st.lowV <= 3 ? 'Es tu área más baja. Un pequeño paso aquí suele mover toda la rueda.' : st.lowV <= 6 ? 'Es tu área más floja este mes. ¿Qué gesto sencillo la subiría un punto?' : 'Todo va bien; esta es la que tiene más margen para crecer.';
    return `<div class="card rueda-foco"><div class="row"><div class="rueda-foco-ic">🎯</div><div class="grow"><div class="xs muted semibold rueda-caps">Tu foco sugerido este mes</div><div class="bold" style="font-size:17px">${esc(st.low.name)} <span class="muted">· ${st.lowV}/10</span></div>${st.low.description ? `<div class="small muted">${esc(st.low.description)}</div>` : ''}</div></div><div class="small mt">${msg}</div></div>`;
  },
  refreshLive(key, override){
    const areas = this.areas(); const scores = Object.assign({}, this.scoresOf(key), override || {});
    const prevKey = shiftMonth(key, -1); const prev = this.scoresOf(prevKey);
    const st = this.stats(scores, areas), pst = this.stats(prev, areas);
    const set = (id, html)=>{ const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('rueda-hero', this.heroInner(key, st, pst, areas.length));
    set('rueda-radar', this.radarSVG(areas, scores, prev));
    set('rueda-foco', this.focoHTML(st));
    for (const a of areas){
      const el = document.querySelector(`[data-score-for="${a.id}"]`); if (!el) continue;
      const v = scores[a.id]; el.textContent = v >= 1 ? v : '—'; el.classList.toggle('unset', !(v >= 1));
    }
    const copy = document.getElementById('rueda-copy'); if (copy && st.n) copy.remove();
  },
  onRange(inp, commit){
    const key = this.month(), areaId = inp.dataset.area, v = this.clamp(inp.value);
    clearTimeout(this._timers[areaId]);
    const save = ()=>{ delete this._timers[areaId]; if (this.scoresOf(key)[areaId]!==v) this.setScore(key, areaId, v); };
    if (commit) save(); else this._timers[areaId] = setTimeout(save, 400);
    this.refreshLive(key, { [areaId]: v });
  },

  /* ---------- vista principal ---------- */
  view(){
    const key = this.month(), areas = this.areas(); const isCur = key >= thisMonthKey();
    const scores = this.scoresOf(key), prevKey = shiftMonth(key, -1), prev = this.scoresOf(prevKey);
    const st = this.stats(scores, areas), pst = this.stats(prev, areas);
    const rec = this.score(key); const note = rec && rec.note ? rec.note : '';
    let html = Views.back('#/menu', 'Rueda de la vida', `<button class="iconbtn" data-action="rueda-edit-areas" aria-label="Editar áreas">${UI.icon('edit')}</button>`);
    html += `<div class="monthnav"><button data-action="rueda-month" data-delta="-1" aria-label="Mes anterior">${UI.icon('left')}</button><div class="m">${fmtMonth(key)}</div><button data-action="rueda-month" data-delta="1" aria-label="Mes siguiente" ${isCur ? 'disabled style="opacity:.3"' : ''}>${UI.icon('chevron')}</button></div>`;
    if (!areas.length){
      html += `<div class="card">${UI.empty('🎡', 'No hay áreas definidas', 'Crea las áreas de tu vida que quieres puntuar cada mes: salud, dinero, familia…')}<button class="btn" data-action="rueda-edit-areas">Definir áreas</button></div>`;
      return html;
    }
    html += `<div class="hero" id="rueda-hero">${this.heroInner(key, st, pst, areas.length)}</div>`;
    if (!st.n && pst.n) html += `<button class="btn secondary" id="rueda-copy" style="margin-bottom:12px" data-action="rueda-copy-prev">${UI.icon('refresh')} Empezar desde ${fmtMonth(prevKey).toLowerCase()}</button>`;
    html += `<div class="card"><div class="card-head"><h3>Tu rueda</h3><div class="legend" style="margin:0"><span><i style="background:var(--accent)"></i>Este mes</span>${pst.n ? `<span><i style="background:var(--muted)"></i>${fmtMonthShort(prevKey)}</span>` : ''}</div></div><div id="rueda-radar">${this.radarSVG(areas, scores, prev)}</div></div>`;
    html += `<div id="rueda-foco">${this.focoHTML(st)}</div>`;
    html += `<div class="section-title"><h2>Puntúa cada área</h2><span class="muted xs">1 = muy mal · 10 = excelente</span></div><div class="card tight"><div class="list">`;
    html += areas.map(a=>{
      const v = scores[a.id]; const has = v >= 1;
      return `<div class="item rueda-area"><div class="body"><div class="row between"><div class="grow"><div class="title">${esc(a.name)}</div>${a.description ? `<div class="sub">${esc(a.description)}</div>` : ''}</div><div class="rueda-num ${has ? '' : 'unset'}" data-score-for="${a.id}">${has ? v : '—'}</div></div>
        <div class="rueda-ctl"><button class="rueda-step" data-action="rueda-step" data-area="${a.id}" data-delta="-1" aria-label="Bajar">−</button><input type="range" class="rueda-range" min="1" max="10" step="1" value="${has ? v : 5}" data-area="${a.id}" aria-label="${esc(a.name)}"><button class="rueda-step" data-action="rueda-step" data-area="${a.id}" data-delta="1" aria-label="Subir">+</button></div></div></div>`;
    }).join('');
    html += `</div></div>`;
    html += `<div class="card"><div class="card-head"><h3>Nota del mes</h3><button class="link" data-action="rueda-note">${note ? 'Editar' : 'Escribir'}</button></div>${note ? `<div class="small rueda-note">${esc(note)}</div>` : `<div class="small muted">¿Qué pasó este mes? ¿Qué quieres recordar cuando vuelvas a mirar esta rueda?</div>`}</div>`;
    html += this.historyHTML(areas, key);
    return html;
  },
  historyHTML(areas, selected){
    const all = Store.list('wheelScores').map(s=>({ key: s.id, st: this.stats(s.scores || {}, areas) })).filter(x=>x.st.n && /^\d{4}-\d{2}$/.test(x.key));
    if (!all.length) return '';
    const end = thisMonthKey(); const rows = [];
    for (let i = 11; i >= 0; i--){ const k = shiftMonth(end, -i); const f = all.find(x=>x.key===k); rows.push({ key: k, avg: f ? f.st.avg : null }); }
    let html = `<div class="card"><div class="card-head"><h3>Evolución</h3><span class="muted small">promedio · últimos 12 meses</span></div>${this.historySVG(rows)}</div>`;
    const list = all.sort((a,b)=>b.key.localeCompare(a.key));
    html += `<div class="card tight"><div class="list">${list.map(x=>`<button class="item clickable" data-action="rueda-month-set" data-key="${x.key}"><div class="ic ${x.key===selected ? 'b' : ''}">${x.key===selected ? '📍' : '📅'}</div><div class="body"><div class="title">${fmtMonth(x.key)}</div><div class="sub ellipsis">Foco: ${esc(x.st.low.name)} (${x.st.lowV}) · mejor: ${esc(x.st.high.name)} (${x.st.highV})</div></div><div class="amt">${this.fmt(x.st.avg)}<div class="sub muted">/10</div></div></button>`).join('')}</div></div>`;
    return html;
  },

  /* ---------- hojas ---------- */
  editAreas(){
    const list = this.areas().map(a=>Object.assign({}, a)); const removed = [];
    const s = UI.sheet({ title:'Áreas de tu rueda', html:`<div class="small muted mb">Cambia nombres y descripciones, reordena con las flechas o agrega áreas nuevas. Al borrar una, sus puntuaciones anteriores se conservan.</div><div data-rows></div><button class="btn secondary mt" data-add>${UI.icon('plus')} Agregar área</button><button class="btn mt" data-save>Guardar</button>` });
    const rows = s.body.querySelector('[data-rows]');
    const draw = ()=>{
      rows.innerHTML = list.length ? list.map((a, i)=>`<div class="rueda-edit-row" data-i="${i}"><div class="grow"><input data-f="name" placeholder="Nombre del área" value="${esc(a.name)}"><input data-f="description" placeholder="Descripción breve (opcional)" value="${esc(a.description || '')}"></div><div class="rueda-edit-btns"><button data-mv="-1" aria-label="Subir" ${i===0 ? 'disabled' : ''}>${UI.icon('up')}</button><button data-mv="1" aria-label="Bajar" ${i===list.length - 1 ? 'disabled' : ''}>${UI.icon('down')}</button><button class="del" data-del aria-label="Borrar">${UI.icon('trash')}</button></div></div>`).join('')
        : `<div class="small muted center" style="padding:14px 0">Sin áreas. Agrega la primera.</div>`;
    };
    draw();
    s.body.addEventListener('input', e=>{ const row = e.target.closest('[data-i]'); const f = e.target.dataset.f; if (!row || !f) return; list[+row.dataset.i][f] = e.target.value; });
    s.body.addEventListener('click', async e=>{
      const row = e.target.closest('[data-i]'); const i = row ? +row.dataset.i : -1;
      const mv = e.target.closest('[data-mv]');
      if (mv && row){ const j = i + Number(mv.dataset.mv); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; draw(); return; }
      if (row && e.target.closest('[data-del]')){
        const a = list[i];
        if (!(await UI.confirm(`¿Borrar "${a.name || 'esta área'}"? Sus puntuaciones anteriores se conservan.`, { ok:'Borrar' }))) return;
        list.splice(i, 1); if (Store.list('wheelAreas').some(x=>x.id===a.id)) removed.push(a.id); draw(); return;
      }
      if (e.target.closest('[data-add]')){ list.push({ id: uid(), name:'', description:'', order: list.length }); draw(); const inp = rows.querySelector('[data-i]:last-child input'); if (inp) inp.focus(); return; }
      if (e.target.closest('[data-save]')){
        const clean = list.map(a=>({ id: a.id, name: String(a.name || '').trim(), description: String(a.description || '').trim() }));
        if (!clean.length) return UI.toast('Agrega al menos un área', true);
        if (clean.some(a=>!a.name)) return UI.toast('Cada área necesita un nombre', true);
        removed.forEach(id=>Store.remove('wheelAreas', id));
        clean.forEach((a, k)=>Store.upsert('wheelAreas', { id: a.id, name: a.name, description: a.description, order: k }));
        s.close(); App.render(); UI.toast('Áreas guardadas');
      }
    });
  },
  editNote(key){
    const cur = this.score(key);
    const s = UI.sheet({ title:`Nota de ${fmtMonth(key).toLowerCase()}`, html:`<div class="field"><label>¿Qué pasó este mes? ¿Qué quieres recordar?</label><textarea name="note" style="min-height:130px" autofocus>${esc(cur && cur.note ? cur.note : '')}</textarea></div><button class="btn" data-save>Guardar</button>` });
    s.body.querySelector('[data-save]').onclick = ()=>{
      const note = s.body.querySelector('[name=note]').value.trim();
      Store.upsert('wheelScores', { id: key, scores: Object.assign({}, cur ? cur.scores : {}), note });
      s.close(); App.render();
    };
  },

  /* ---------- tarjeta del Inicio ---------- */
  homeCard(){
    const key = thisMonthKey(), areas = this.areas(); if (!areas.length) return '';
    const st = this.stats(this.scoresOf(key), areas);
    if (!st.n) return `<div class="card"><div class="card-head"><h3>🎡 Rueda de la vida</h3><a class="link" href="#/rueda">Abrir</a></div><div class="small muted">¿Cómo va tu rueda este mes? Puntúa cada área del 1 al 10 y descubre dónde enfocarte.</div><button class="btn sm mt" data-go="#/rueda">Puntuar ${fmtMonth(key).toLowerCase()}</button></div>`;
    return `<div class="card"><div class="row between"><div class="rueda-home-line grow"><span>🎡</span><div class="ellipsis"><b>${this.fmt(st.avg)}</b><span class="muted">/10</span> este mes${st.n < areas.length ? ` <span class="muted">(${st.n}/${areas.length})</span>` : ''} · foco: <b>${esc(st.low.name)}</b> (${st.lowV})</div></div><a class="link" href="#/rueda">Ver</a></div></div>`;
  },
};

App.registerModule({
  id: 'rueda',
  name: 'Rueda de la vida',
  icon: 'target',
  collections: ['wheelAreas', 'wheelScores'],
  routes: [
    [/^#\/rueda$/, ()=>Rueda.view(), 'menu'],
  ],
  menu: [{ hash: '#/rueda', icon: 'target', label: 'Rueda' }],
  homeCards: [{ order: 50, render: ()=>Rueda.homeCard() }],
  actions: {
    'rueda-month'(d){
      const next = shiftMonth(Rueda.month(), Number(d.delta));
      if (next > thisMonthKey()) return;
      App.state.rueda_month = next; App.render();
    },
    'rueda-month-set'(d){ if (!d.key) return; App.state.rueda_month = d.key; App.render(); window.scrollTo(0, 0); },
    'rueda-step'(d){
      const key = Rueda.month(); const sc = Rueda.scoresOf(key);
      const cur = sc[d.area] >= 1 ? sc[d.area] : 5;
      const v = Rueda.clamp(cur + Number(d.delta));
      if (sc[d.area]===v) return;
      clearTimeout(Rueda._timers[d.area]); delete Rueda._timers[d.area];
      Rueda.setScore(key, d.area, v);
      const inp = document.querySelector(`.rueda-range[data-area="${d.area}"]`); if (inp) inp.value = v;
      Rueda.refreshLive(key);
    },
    'rueda-copy-prev'(){
      const key = Rueda.month(); const prev = Rueda.scoresOf(shiftMonth(key, -1)); const cur = Rueda.score(key);
      const scores = Object.assign({}, cur ? cur.scores : {});
      Rueda.areas().forEach(a=>{ if (!(scores[a.id] >= 1) && prev[a.id] >= 1) scores[a.id] = prev[a.id]; });
      Store.upsert('wheelScores', { id: key, scores, note: cur ? (cur.note || '') : '' });
      App.render(); UI.toast('Puntuaciones copiadas; ajústalas a este mes');
    },
    'rueda-edit-areas'(){ Rueda.editAreas(); },
    'rueda-note'(){ Rueda.editNote(Rueda.month()); },
  },
  css: `
.rueda-of{font-size:16px;font-weight:600;opacity:.8;margin-left:2px}
.rueda-radar{max-width:420px;margin:0 auto}
.rueda-caps{text-transform:uppercase;letter-spacing:.04em}
.rueda-foco{border:1px solid var(--accent);background:linear-gradient(135deg,var(--accent-soft),var(--card) 70%)}
.rueda-foco-ic{width:44px;height:44px;border-radius:13px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:var(--shadow);flex:none}
.rueda-area{align-items:stretch}
.rueda-num{font-size:26px;font-weight:800;min-width:40px;text-align:right;letter-spacing:-.02em;color:var(--accent);line-height:1}
.rueda-num.unset{color:var(--muted);font-weight:600}
.rueda-ctl{display:flex;align-items:center;gap:10px;margin-top:8px}
.rueda-step{width:34px;height:34px;border-radius:10px;background:var(--card-2);border:1px solid var(--line);font-size:18px;font-weight:700;color:var(--text);flex:none;display:flex;align-items:center;justify-content:center}
.rueda-step:active{background:var(--line)}
.rueda-range{flex:1;min-width:0;accent-color:var(--accent);height:28px;margin:0;cursor:pointer}
.rueda-note{white-space:pre-wrap;line-height:1.5}
.rueda-home-line{display:flex;align-items:center;gap:8px;font-size:14px}
.rueda-edit-row{display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.rueda-edit-row .grow input{width:100%;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:14px;outline:none;margin-bottom:6px}
.rueda-edit-row .grow input:last-child{margin-bottom:0}
.rueda-edit-row .grow input:focus{border-color:var(--accent)}
.rueda-edit-btns{display:flex;flex-direction:column;gap:4px;flex:none}
.rueda-edit-btns button{width:34px;height:28px;border-radius:8px;background:var(--card-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--text)}
.rueda-edit-btns button:disabled{opacity:.3}
.rueda-edit-btns button svg{width:14px;height:14px}
.rueda-edit-btns button.del{color:var(--red)}
`,
  init(){ Rueda.init(); },
});
