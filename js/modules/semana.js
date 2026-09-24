'use strict';
/* Planificador semanal y tareas: semana por días, premio del día, pendientes atrasados y bandeja "Sin fecha" */
const Semana = {
  DAY_LETTERS: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],           // lunes … domingo
  DAY_NAMES: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  HOME_MAX: 6,

  /* ---------- fechas ---------- */
  addDays(iso, n){ const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); },
  startOfWeek(iso){ const d = parseISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toISO(d); },
  weekDays(monday){ return Array.from({ length: 7 }, (_, i)=>this.addDays(monday, i)); },
  nextMonday(){ return this.addDays(this.startOfWeek(todayISO()), 7); },
  weekLabel(monday){
    const a = parseISO(monday), b = parseISO(this.addDays(monday, 6));
    const yr = b.getFullYear()!==new Date().getFullYear() ? ' ' + b.getFullYear() : '';
    if (a.getMonth()===b.getMonth()) return `Semana del ${a.getDate()} al ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}${yr}`;
    return `Semana del ${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} al ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}${yr}`;
  },
  dayTitle(iso){
    const d = parseISO(iso); const t = todayISO();
    const name = this.DAY_NAMES[d.getDay()]; const base = `${name[0].toUpperCase() + name.slice(1)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    if (iso===t) return `Hoy · ${base}`;
    if (iso===this.addDays(t, 1)) return `Mañana · ${base}`;
    if (iso===this.addDays(t, -1)) return `Ayer · ${base}`;
    return base;
  },

  /* ---------- estado de la vista ---------- */
  week(){ const S = App.state; if (!S.sem_week) S.sem_week = this.startOfWeek(todayISO()); return S.sem_week; },
  day(){
    const S = App.state; const w = this.week();
    if (!S.sem_day || this.startOfWeek(S.sem_day)!==w){ const t = todayISO(); S.sem_day = this.startOfWeek(t)===w ? t : w; }
    return S.sem_day;
  },

  /* ---------- datos ---------- */
  all(){ return Store.list('tasks'); },
  get(id){ return this.all().find(t=>t.id===id); },
  sort(arr){ return arr.sort((a,b)=>((a.order ?? 0) - (b.order ?? 0)) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); },
  on(date){ return this.sort(this.all().filter(t=>t.date===date)); },
  inbox(){ return this.sort(this.all().filter(t=>!t.date)); },
  overdue(){ const t = todayISO(); return this.all().filter(x=>x.date && x.date < t && !x.done).sort((a,b)=>a.date.localeCompare(b.date) || ((a.order ?? 0) - (b.order ?? 0))); },
  nextOrder(date){ const key = date || null; return this.all().filter(t=>(t.date || null)===key).reduce((m,t)=>Math.max(m, t.order ?? 0), -1) + 1; },
  reward(date){ return Store.list('dayRewards').find(r=>r.id===date); },
  goals(){ return (Store.data.goals || []).filter(g=>g && g.title && !g.done); },
  goal(id){ return id ? (Store.data.goals || []).find(g=>g.id===id) : null; },
  stats(list){
    const total = list.length, done = list.filter(t=>t.done).length;
    const mins = arr=>arr.reduce((s,t)=>s + (Number(t.minutes) || 0), 0);
    return { total, done, left: total - done, pct: total ? Math.round(done / total * 100) : 0, minPlan: mins(list), minDone: mins(list.filter(t=>t.done)) };
  },
  /* "Llamar al banco 15 min" → { title:'Llamar al banco', minutes:15 } */
  parseQuick(str){
    let title = String(str || '').trim(); let minutes = null;
    const m = title.match(/^(.*?)[\s,·(-]+(\d{1,3})\s*(?:min|mins|minutos|m)\.?\)?\s*$/i);
    if (m && m[1].trim()){ title = m[1].trim().replace(/[\s,·(-]+$/, ''); minutes = Number(m[2]) || null; }
    return { title, minutes };
  },

  /* ---------- cambios ---------- */
  add({ title, date=null, minutes=null, goalId=null }){
    const t = { id: uid(), title, date: date || null, done: false, doneAt: null, minutes: minutes || null, goalId: goalId || null, order: this.nextOrder(date), createdAt: new Date().toISOString() };
    Store.upsert('tasks', t); return t;
  },
  toggle(id){ const t = this.get(id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; Store.upsert('tasks', t); },
  move(id, date){
    const t = this.get(id); if (!t) return false; const key = date || null;
    if ((t.date || null)===key) return false;
    t.date = key; t.order = this.nextOrder(key); Store.upsert('tasks', t); return true;
  },
  remove(id){ Store.remove('tasks', id); },
  /* sube (-1) o baja (+1) una tarea dentro de su día (o de la bandeja sin fecha) */
  shift(id, dir){
    const t = this.get(id); if (!t) return false;
    const sib = t.date ? this.on(t.date) : this.inbox();
    const i = sib.indexOf(t), j = i + dir;
    if (i < 0 || j < 0 || j >= sib.length) return false;
    sib.forEach((x, k)=>{ x.order = k; });
    sib[i].order = j; sib[j].order = i;
    Store.save(); return true;
  },
  setReward(date, text){
    text = String(text || '').trim();
    const r = this.reward(date);
    if (!text){ if (r) Store.remove('dayRewards', date); return; }
    Store.upsert('dayRewards', { id: date, text, claimed: r && r.text===text ? !!r.claimed : false });
  },
  claim(date){ const r = this.reward(date); if (!r) return; r.claimed = true; Store.upsert('dayRewards', r); },

  /* ---------- piezas de interfaz ---------- */
  /* tools: 'day' (mover + más) | 'overdue' (a hoy + más) | 'inbox' (programar + más) | 'home' (solo casilla y título) */
  row(t, { tools='day', showDate=false }={}){
    const sub = [];
    if (showDate && t.date) sub.push(`<span class="${t.date < todayISO() && !t.done ? 'red' : ''}">${fmtDate(t.date, 'day')}</span>`);
    if (t.minutes) sub.push(`<span class="badge">${Number(t.minutes)} min</span>`);
    const g = this.goal(t.goalId); if (g) sub.push(`🎯 ${esc(g.title)}`);
    let right = '';
    if (tools==='day') right = `<button class="sem-tool" data-action="sem-move" data-id="${t.id}" aria-label="Mover a otro día">${UI.icon('calendar')}</button>`;
    else if (tools==='overdue') right = `<button class="btn secondary sm sem-mini" data-action="sem-move-today" data-id="${t.id}">A hoy</button>`;
    else if (tools==='inbox') right = `<button class="btn secondary sm sem-mini" data-action="sem-move" data-id="${t.id}">Programar</button>`;
    if (tools!=='home') right += `<button class="sem-tool" data-action="sem-more" data-id="${t.id}" aria-label="Más opciones">${UI.icon('more')}</button>`;
    return `<div class="item sem-task ${t.done ? 'done' : ''}">
      <button class="sem-check ${t.done ? 'on' : ''}" data-action="sem-toggle" data-id="${t.id}" aria-label="${t.done ? 'Marcar como pendiente' : 'Marcar como hecha'}">${UI.icon('check')}</button>
      <button class="body sem-body" data-action="sem-edit" data-id="${t.id}"><div class="title">${esc(t.title)}</div>${sub.length ? `<div class="sub">${sub.join(' · ')}</div>` : ''}</button>${right}</div>`;
  },
  strip(days, sel){
    const today = todayISO();
    return `<div class="sem-strip">${days.map((d, i)=>{
      const list = this.on(d); const done = list.filter(t=>t.done).length; const all = list.length > 0 && done===list.length;
      const cls = ['sem-day', d===sel ? 'active' : '', d===today ? 'today' : '', d < today ? 'past' : '', all ? 'done' : '', d < today && list.length && !all ? 'pending' : ''].filter(Boolean).join(' ');
      const c = list.length ? (all ? UI.icon('check') : `${done}/${list.length}`) : '·';
      return `<button class="${cls}" data-action="sem-day" data-date="${d}" aria-label="${this.dayTitle(d)}"><span class="l">${this.DAY_LETTERS[i]}</span><span class="n">${parseISO(d).getDate()}</span><span class="c">${c}</span></button>`;
    }).join('')}</div>`;
  },
  rewardCard(date){
    const r = this.reward(date); const list = this.on(date); const allDone = list.length > 0 && list.every(t=>t.done);
    if (!r) return `<button class="card sem-reward empty" data-action="sem-reward" data-date="${date}"><span class="sem-gift">🎁</span><div class="grow"><div class="semibold">¿Con qué te vas a premiar?</div><div class="small muted">Elige algo para cuando termines todo lo de este día</div></div><span class="chev">${UI.icon('chevron')}</span></button>`;
    if (r.claimed) return `<button class="card sem-reward claimed" data-action="sem-reward" data-date="${date}"><span class="sem-gift">🏆</span><div class="grow"><div class="semibold">Premio reclamado</div><div class="small muted">${esc(r.text)}</div></div><span class="chev">${UI.icon('chevron')}</span></button>`;
    if (allDone) return `<div class="card sem-reward won"><div class="row"><span class="sem-gift">🏆</span><div class="grow"><div class="bold" style="font-size:17px">¡Te lo ganaste! 🏆</div><div class="small">${esc(r.text)}</div></div></div>
      <div class="btnrow"><button class="btn sm" data-action="sem-claim" data-date="${date}">${UI.icon('check')} Reclamado</button><button class="btn sm secondary" data-action="sem-reward" data-date="${date}">Editar</button></div></div>`;
    const left = list.filter(t=>!t.done).length;
    const sub = list.length ? (left===1 ? 'Te falta 1 tarea para ganarlo' : `Te faltan ${left} tareas para ganarlo`) : 'Agrega tareas a este día para ganarlo';
    return `<button class="card sem-reward" data-action="sem-reward" data-date="${date}"><span class="sem-gift">🎁</span><div class="grow"><div class="semibold">Tu premio: ${esc(r.text)}</div><div class="small muted">${sub}</div></div><span class="chev">${UI.icon('chevron')}</span></button>`;
  },
  overdueBlock(){
    const list = this.overdue(); if (!list.length) return '';
    const open = !App.state.sem_overdueHide;
    let html = `<div class="day-head"><button class="sem-head" data-action="sem-overdue"><span>⏰ Pendientes de días anteriores</span><span class="badge r">${list.length}</span><span class="chev ${open ? 'open' : ''}">${UI.icon('chevron')}</span></button></div>`;
    if (open) html += `<div class="card tight sem-overdue"><div class="list">${list.map(t=>this.row(t, { tools:'overdue', showDate:true })).join('')}</div>
      <div class="sem-foot"><span class="xs muted">No se mueven solas: decide tú.</span><button class="btn sm" data-action="sem-move-all-today">Mover todas a hoy</button></div></div>`;
    return html;
  },
  inboxBlock(){
    const list = this.inbox(); const open = !!App.state.sem_inbox;
    let html = `<div class="day-head"><button class="sem-head" data-action="sem-inbox"><span>📥 Sin fecha</span>${list.length ? `<span class="badge">${list.length}</span>` : ''}<span class="chev ${open ? 'open' : ''}">${UI.icon('chevron')}</span></button><button class="link" data-action="sem-add" data-date="">+ Agregar</button></div>`;
    if (!open) return html;
    html += `<div class="card tight">${list.length ? `<div class="list">${list.map(t=>this.row(t, { tools:'inbox' })).join('')}</div>` : UI.empty('📥', 'Bandeja vacía', 'Anota aquí lo que quieres hacer pero aún no sabes cuándo')}</div>`;
    return html;
  },

  /* ---------- vista principal #/semana ---------- */
  view(){
    const week = this.week(), day = this.day(), today = todayISO();
    const days = this.weekDays(week); const isCurrent = week===this.startOfWeek(today);
    const weekTasks = this.all().filter(t=>t.date && t.date >= days[0] && t.date <= days[6]);
    const st = this.stats(weekTasks);
    let html = Views.back('#/menu', 'Mi semana', `<button class="iconbtn" data-action="sem-new" data-date="${day}" aria-label="Nueva tarea">${UI.icon('plus')}</button>`);
    html += `<div class="monthnav sem-nav"><button data-action="sem-week" data-delta="-1" aria-label="Semana anterior">${UI.icon('left')}</button><div class="m">${this.weekLabel(week)}${!isCurrent || day!==today ? `<button class="sem-todaybtn" data-action="sem-today">Hoy</button>` : ''}</div><button data-action="sem-week" data-delta="1" aria-label="Semana siguiente">${UI.icon('chevron')}</button></div>`;
    if (st.total){
      html += `<div class="hero"><div class="label">${isCurrent ? 'Esta semana' : 'Resumen de la semana'}</div><div class="big">${st.done} de ${st.total}</div><div class="sub">tareas hechas${st.done===st.total ? ' · ¡Semana completa! 🎉' : ` · faltan ${st.left}`}</div>
        <div class="progress hero-progress"><div class="ok" style="width:${st.pct}%"></div></div>
        <div class="hero-tiles"><div class="hero-tile"><div class="t">Avance</div><div class="v">${st.pct}%</div></div><div class="hero-tile"><div class="t">Pendientes</div><div class="v">${st.left}</div></div><div class="hero-tile ${st.minPlan && st.minDone >= st.minPlan ? 'pos' : ''}"><div class="t">Minutos</div><div class="v">${st.minPlan ? `${st.minDone} / ${st.minPlan}` : '—'}</div></div></div></div>`;
    } else {
      html += `<div class="hero"><div class="label">${isCurrent ? 'Esta semana' : 'Semana sin planificar'}</div><div class="big">Sin tareas</div><div class="sub">Toca un día y agrega lo que quieres lograr. Poco y claro funciona mejor.</div></div>`;
    }
    html += this.overdueBlock();
    html += this.strip(days, day);
    const list = this.on(day); const ds = this.stats(list);
    html += `<div class="day-head"><span>${this.dayTitle(day)}</span><span>${list.length ? `${ds.done}/${ds.total}${ds.minPlan ? ` · ${ds.minPlan} min` : ''}` : ''}</span></div>`;
    html += `<div class="card tight">${list.length ? `<div class="list">${list.map(t=>this.row(t)).join('')}</div>` : UI.empty('🗓️', 'Nada planificado', 'Agrega una o varias tareas para este día')}
      <button class="sem-addrow" data-action="sem-add" data-date="${day}">${UI.icon('plus')} Nueva tarea</button></div>`;
    html += this.rewardCard(day);
    html += this.inboxBlock();
    return html;
  },

  /* ---------- tarjeta de Inicio ---------- */
  homeCard(){
    const today = todayISO(); const list = this.on(today); const st = this.stats(list); const r = this.reward(today); const od = this.overdue().length;
    let html = `<div class="card"><div class="card-head"><h3>✅ Hoy</h3><a class="link" href="#/semana">Ver semana</a></div>`;
    if (!list.length){
      html += `<div class="small muted">Nada planificado para hoy.${od ? ` Tienes ${od} pendiente${od===1 ? '' : 's'} de días anteriores.` : ' ¿Qué quieres lograr?'}</div>
        <div class="btnrow" style="margin-top:10px"><button class="btn sm" data-action="sem-add" data-date="${today}">${UI.icon('plus')} Agregar tarea</button>${od ? `<a class="btn sm secondary" href="#/semana">Ver pendientes</a>` : ''}</div></div>`;
      return html;
    }
    const allDone = st.done===st.total;
    html += `<div class="row between small"><span class="semibold">${st.done} de ${st.total}${allDone ? ' · ¡Día completo! 🎉' : ''}</span>${st.minPlan ? `<span class="muted">${st.minDone} / ${st.minPlan} min</span>` : ''}</div><div class="progress"><div style="width:${st.pct}%"></div></div>`;
    html += `<div class="list sem-home">${list.slice(0, this.HOME_MAX).map(t=>this.row(t, { tools:'home' })).join('')}</div>`;
    if (list.length > this.HOME_MAX) html += `<a class="link small" href="#/semana">y ${list.length - this.HOME_MAX} más</a>`;
    if (r) html += `<div class="sem-homereward ${allDone && !r.claimed ? 'won' : ''}"><span>${r.claimed ? '🏆' : '🎁'}</span><div class="grow small">${r.claimed ? 'Premio reclamado: ' : allDone ? '¡Te lo ganaste! ' : 'Tu premio: '}<b>${esc(r.text)}</b></div>${allDone && !r.claimed ? `<button class="btn sm" data-action="sem-claim" data-date="${today}">Reclamado</button>` : ''}</div>`;
    if (od) html += `<a class="xs amber" href="#/semana" style="display:block;margin-top:8px">⏰ ${od} pendiente${od===1 ? '' : 's'} de días anteriores</a>`;
    html += `<div class="btnrow"><button class="btn sm secondary" data-action="sem-add" data-date="${today}">${UI.icon('plus')} Tarea</button></div></div>`;
    return html;
  },

  /* ---------- hojas ---------- */
  /* agregar varias seguidas: la hoja queda abierta */
  quickAdd(date){
    date = date || null; let n = 0;
    const label = date ? fmtDate(date, 'day') : 'Sin fecha';
    const s = UI.sheet({ title: `Nueva tarea · ${label}`, html: `
      <div class="field"><label>¿Qué quieres hacer?</label><input name="title" placeholder="Ej. Llamar al banco 15 min" autofocus autocomplete="off" enterkeyhint="done"></div>
      <div class="row"><button class="btn" data-add>${UI.icon('plus')} Agregar</button><button class="btn secondary sem-doneBtn" data-done>Listo</button></div>
      <div class="xs muted mt" data-count>Tip: termina con «20 min» para estimar el tiempo. Puedes agregar varias seguidas.</div>` });
    const inp = s.body.querySelector('[name=title]'); const count = s.body.querySelector('[data-count]');
    const add = ()=>{
      const q = this.parseQuick(inp.value); if (!q.title) return UI.toast('Escribe la tarea', true);
      this.add({ title: q.title, minutes: q.minutes, date }); n++;
      inp.value = ''; inp.focus();
      count.textContent = `${n} agregada${n===1 ? '' : 's'} a ${label.toLowerCase()}. Sigue escribiendo o toca Listo.`;
      App.render();
    };
    s.body.querySelector('[data-add]').onclick = add;
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); add(); } });
    s.body.querySelector('[data-done]').onclick = ()=>s.close();
  },
  /* formulario completo: nueva (fecha editable) o editar */
  form(t=null, { date }={}){
    const goals = this.goals(); const today = todayISO();
    const cur = t ? (t.date || '') : (date===undefined ? today : (date || ''));
    const chips = [['Hoy', today], ['Mañana', this.addDays(today, 1)], ['Próximo lunes', this.nextMonday()], ['Sin fecha', '']];
    const s = UI.sheet({ title: t ? 'Editar tarea' : 'Nueva tarea', html: `
      <div class="field"><label>Tarea</label><input name="title" value="${esc(t ? t.title : '')}" placeholder="Ej. Preparar la presentación" autofocus autocomplete="off"></div>
      <div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${cur}"></div><div class="field"><label>Minutos (opcional)</label><input type="number" name="minutes" inputmode="numeric" min="1" max="999" step="5" value="${t && t.minutes ? Number(t.minutes) : ''}" placeholder="25"></div></div>
      <div class="chips mb">${chips.map(([l, d])=>`<button type="button" class="chip ${cur===d ? 'active' : ''}" data-d="${d}">${l}</button>`).join('')}</div>
      ${goals.length ? `<div class="field"><label>Meta relacionada (opcional)</label><select name="goal"><option value="">Ninguna</option>${goals.map(g=>`<option value="${g.id}"${t && t.goalId===g.id ? ' selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>` : ''}
      <button class="btn" data-save>Guardar</button>
      ${t ? '<button class="btn danger mt" data-del>Eliminar tarea</button>' : ''}` });
    const f = s.body; const dateInp = f.querySelector('[name=date]');
    const paint = ()=>f.querySelectorAll('[data-d]').forEach(b=>b.classList.toggle('active', b.dataset.d===dateInp.value));
    f.querySelectorAll('[data-d]').forEach(b=>{ b.onclick = ()=>{ dateInp.value = b.dataset.d; paint(); }; });
    dateInp.addEventListener('input', paint);
    const save = ()=>{
      const title = f.querySelector('[name=title]').value.trim(); if (!title) return UI.toast('Escribe la tarea', true);
      const dv = dateInp.value; const d = /^\d{4}-\d{2}-\d{2}$/.test(dv) ? dv : null;
      const mv = parseInt(f.querySelector('[name=minutes]').value, 10); const minutes = mv > 0 ? mv : null;
      const gsel = f.querySelector('[name=goal]'); const goalId = gsel && gsel.value ? gsel.value : null;
      if (t){
        if ((t.date || null)!==d) t.order = this.nextOrder(d);
        Object.assign(t, { title, date: d, minutes, goalId }); Store.upsert('tasks', t);
      } else this.add({ title, date: d, minutes, goalId });
      s.close(); App.render(); UI.toast(t ? 'Tarea guardada' : (d ? `Tarea para ${fmtDate(d, 'day').toLowerCase()}` : 'Tarea guardada sin fecha'));
    };
    f.querySelector('[data-save]').onclick = save;
    f.querySelector('[name=title]').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); save(); } });
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm(`¿Eliminar "${t.title}"?`)){ this.remove(t.id); s.close(); App.render(); UI.toast('Tarea eliminada'); } };
  },
  moveSheet(id){
    const t = this.get(id); if (!t) return; const today = todayISO();
    const opts = [['Hoy', today], ['Mañana', this.addDays(today, 1)], ['Próximo lunes', this.nextMonday()], ['Sin fecha', '']];
    const s = UI.sheet({ title: t.date ? 'Mover tarea' : 'Programar tarea', html: `
      <div class="small muted mb ellipsis">${esc(t.title)}${t.date ? ` · ahora ${fmtDate(t.date, 'day').toLowerCase()}` : ''}</div>
      <div class="sem-quick">${opts.map(([l, d])=>`<button class="btn secondary" data-d="${d}"><span>${l}</span>${d ? `<span class="xs muted">${fmtDate(d, 'short')}</span>` : '<span class="xs muted">bandeja</span>'}</button>`).join('')}</div>
      <div class="field mt"><label>O elige una fecha</label><input type="date" name="date" value="${t.date || ''}"></div>
      <button class="btn" data-save>Mover</button>` });
    const go = d=>{
      d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null;
      const changed = this.move(id, d); s.close(); App.render();
      UI.toast(!changed ? 'Ya estaba ahí' : d ? `Movida a ${fmtDate(d, 'day').toLowerCase()}` : 'Enviada a Sin fecha');
    };
    s.body.querySelectorAll('[data-d]').forEach(b=>{ b.onclick = ()=>go(b.dataset.d); });
    s.body.querySelector('[data-save]').onclick = ()=>go(s.body.querySelector('[name=date]').value);
  },
  rewardSheet(date){
    const r = this.reward(date);
    const s = UI.sheet({ title: `Tu premio · ${fmtDate(date, 'day')}`, html: `
      <div class="small muted mb">Algo pequeño que te vas a dar cuando termines todas las tareas del día.</div>
      <div class="field"><label>¿Con qué te vas a premiar?</label><input name="text" value="${esc(r ? r.text : '')}" placeholder="Ej. Un capítulo de mi serie 🍿" autofocus autocomplete="off"></div>
      <button class="btn" data-save>Guardar</button>
      ${r ? '<button class="btn danger mt" data-del>Quitar premio</button>' : ''}` });
    const inp = s.body.querySelector('[name=text]');
    const save = ()=>{ const v = inp.value.trim(); if (!v) return UI.toast('Escribe tu premio', true); this.setReward(date, v); s.close(); App.render(); UI.toast('Premio guardado 🎁'); };
    s.body.querySelector('[data-save]').onclick = save;
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); save(); } });
    const del = s.body.querySelector('[data-del]');
    if (del) del.onclick = ()=>{ this.setReward(date, ''); s.close(); App.render(); UI.toast('Premio quitado'); };
  },
  async more(id){
    const t = this.get(id); if (!t) return;
    const v = await UI.options(t.title.length > 40 ? t.title.slice(0, 40) + '…' : t.title, [
      { value:'up', icon:'up', label:'Subir' },
      { value:'down', icon:'down', label:'Bajar' },
      { value:'move', icon:'calendar', cls:'b', label: t.date ? 'Mover a otro día' : 'Programar' },
      { value:'edit', icon:'edit', label:'Editar' },
      { value:'del', icon:'trash', cls:'r', label:'Eliminar' },
    ]);
    if (!v) return;
    if (v==='up' || v==='down'){ if (this.shift(id, v==='up' ? -1 : 1)) App.render(); else UI.toast(v==='up' ? 'Ya es la primera' : 'Ya es la última'); }
    else if (v==='move') this.moveSheet(id);
    else if (v==='edit') this.form(t);
    else if (v==='del'){ if (await UI.confirm(`¿Eliminar "${t.title}"?`)){ this.remove(id); App.render(); UI.toast('Tarea eliminada'); } }
  },
};

App.registerModule({
  id: 'semana',
  name: 'Semana',
  icon: 'calendar',
  collections: ['tasks', 'dayRewards'],
  routes: [
    [/^#\/semana$/, ()=>Semana.view(), 'menu'],
  ],
  menu: [{ hash: '#/semana', icon: 'calendar', label: 'Semana' }],
  homeCards: [{ order: 15, render: ()=>Semana.homeCard() }],
  fab: [{ label: 'Nueva tarea', sub: 'Para hoy o el día que elijas', icon: 'check', cls: 'b', run(){ Semana.form(null, { date: todayISO() }); } }],
  actions: {
    'sem-week'(d){ App.state.sem_week = Semana.addDays(Semana.week(), 7 * (Number(d.delta) || 0)); App.state.sem_day = null; App.render(); },
    'sem-today'(){ const t = todayISO(); App.state.sem_week = Semana.startOfWeek(t); App.state.sem_day = t; App.render(); },
    'sem-day'(d){ App.state.sem_day = d.date; App.render(); },
    'sem-toggle'(d){ Semana.toggle(d.id); App.render(); },
    'sem-add'(d){ Semana.quickAdd(d.date || null); },
    'sem-new'(d){ Semana.form(null, { date: d.date===undefined ? todayISO() : (d.date || null) }); },
    'sem-edit'(d){ const t = Semana.get(d.id); if (t) Semana.form(t); },
    'sem-move'(d){ Semana.moveSheet(d.id); },
    'sem-move-today'(d){ Semana.move(d.id, todayISO()); App.render(); UI.toast('Movida a hoy'); },
    'sem-move-all-today'(){
      const list = Semana.overdue(); if (!list.length) return;
      const t = todayISO(); list.forEach(x=>Semana.move(x.id, t));
      App.state.sem_week = Semana.startOfWeek(t); App.state.sem_day = t; App.render();
      UI.toast(list.length===1 ? '1 tarea movida a hoy' : `${list.length} tareas movidas a hoy`);
    },
    'sem-more'(d){ Semana.more(d.id); },
    'sem-up'(d){ if (Semana.shift(d.id, -1)) App.render(); },
    'sem-down'(d){ if (Semana.shift(d.id, 1)) App.render(); },
    async 'sem-delete'(d){ const t = Semana.get(d.id); if (!t) return; if (await UI.confirm(`¿Eliminar "${t.title}"?`)){ Semana.remove(d.id); App.render(); UI.toast('Tarea eliminada'); } },
    'sem-reward'(d){ Semana.rewardSheet(d.date); },
    'sem-claim'(d){ Semana.claim(d.date); App.render(); UI.toast('¡Disfrútalo! 🎉'); },
    'sem-inbox'(){ App.state.sem_inbox = !App.state.sem_inbox; App.render(); },
    'sem-overdue'(){ App.state.sem_overdueHide = !App.state.sem_overdueHide; App.render(); },
  },
  css: `
.sem-nav .m{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font-size:15px}
.sem-todaybtn{font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-soft);padding:2px 10px;border-radius:999px}
.sem-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:6px 0 0}
.sem-day{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px 7px;border-radius:14px;background:var(--card);box-shadow:var(--shadow);color:var(--text);border:2px solid transparent;min-width:0}
.sem-day .l{font-size:11px;font-weight:700;color:var(--muted)}
.sem-day .n{font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.sem-day .c{font-size:10px;font-weight:700;color:var(--muted);min-height:14px;display:flex;align-items:center;justify-content:center}
.sem-day .c svg{width:12px;height:12px;stroke-width:3}
.sem-day.today .l,.sem-day.today .n{color:var(--accent)}
.sem-day.active{border-color:var(--accent);background:var(--accent-soft)}
.sem-day.done .c{color:var(--green)}
.sem-day.pending .c{color:var(--red)}
.sem-day.past:not(.active):not(.today){opacity:.7}
.sem-task{padding:10px 10px 10px 12px;gap:10px}
.sem-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);background:var(--card);display:flex;align-items:center;justify-content:center;color:transparent;flex:none;transition:.15s}
.sem-check svg{width:14px;height:14px;stroke-width:3}
.sem-check.on{background:var(--green);border-color:var(--green);color:#fff}
.sem-body{text-align:left;padding:0;min-width:0;flex:1}
.sem-task.done .title{text-decoration:line-through;color:var(--muted);font-weight:500}
.sem-task .sub{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px}
.sem-task .badge{padding:1px 7px;font-size:11px}
.sem-tool{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
.sem-tool svg{width:18px;height:18px}
.sem-tool:active{background:var(--card-2)}
.sem-mini{padding:6px 10px;font-size:12px;border-radius:10px;white-space:nowrap}
.sem-addrow{display:flex;align-items:center;gap:8px;width:100%;padding:12px 16px 6px;color:var(--accent);font-weight:600;font-size:14px;border-top:1px solid var(--line)}
.sem-addrow svg{width:18px;height:18px}
.sem-head{display:flex;align-items:center;gap:8px;color:var(--muted);font-weight:600;font-size:13px;text-align:left}
.sem-head .chev{display:inline-flex;color:var(--muted)}
.sem-head .chev svg{width:16px;height:16px}
.sem-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px 6px;border-top:1px solid var(--line)}
.sem-overdue .list .item .sub .red{font-weight:600}
.sem-reward{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid var(--line)}
.sem-reward.empty{border-style:dashed;box-shadow:none;background:var(--card-2)}
.sem-reward.won{display:block;border-color:var(--amber);background:var(--amber-soft)}
.sem-reward.claimed{opacity:.85}
.sem-reward .sem-gift{font-size:26px;flex:none;line-height:1}
.sem-reward .chev{color:var(--muted);display:inline-flex}
.sem-reward .chev svg{width:18px;height:18px}
.sem-quick{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sem-quick .btn{width:100%;flex-direction:column;gap:1px;padding:10px 8px;line-height:1.2}
.sem-doneBtn{width:auto;flex:0 0 auto;padding-left:16px;padding-right:16px}
.sem-home .item{padding:8px 0}
.sem-home .sem-check{width:24px;height:24px}
.sem-homereward{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--card-2);border:1px dashed var(--line)}
.sem-homereward span:first-child{font-size:20px;line-height:1}
.sem-homereward.won{background:var(--amber-soft);border:1px solid var(--amber)}
@media (min-width:640px){
  .sem-day{padding:10px 4px 9px}
  .sem-day .n{font-size:19px}
  .sem-day .c{font-size:11px}
}`,
});
