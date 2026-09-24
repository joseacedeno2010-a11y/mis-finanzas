'use strict';
/* Módulo: Objetivos y metas
   Sueños sin fecha → metas del año o de un trimestre → hitos pequeños.
   Colección propia: goals (ver docs/MODULOS.md). */
const Metas = {
  QL: { 1:'1er trimestre', 2:'2º trimestre', 3:'3er trimestre', 4:'4º trimestre' },
  QM: { 1:'ene – mar', 2:'abr – jun', 3:'jul – sep', 4:'oct – dic' },
  AREAS: { personal:'Personal', profesional:'Profesional' },
  KINDS: { simple:'Simple', milestones:'Con hitos', money:'De dinero' },

  /* ---------- fechas y trimestres ---------- */
  curYear(){ return new Date().getFullYear(); },
  curQ(){ return Math.floor(new Date().getMonth() / 3) + 1; },
  qEnd(y, q){ return toISO(new Date(y, q * 3, 0)); },
  qState(y, q){ const cy = this.curYear(), cq = this.curQ(); if (y < cy || (y===cy && q < cq)) return 'past'; if (y===cy && q===cq) return 'cur'; return 'future'; },
  daysLeft(y, q){ return Math.max(0, Calc.daysBetween(todayISO(), this.qEnd(y, q))); },

  /* ---------- estado de UI ---------- */
  area(){ const a = App.state.metas_area; return this.AREAS[a] ? a : 'personal'; },
  year(){ return Number(App.state.metas_year) || this.curYear(); },

  /* ---------- datos ---------- */
  all(){ return Store.list('goals'); },
  get(id){ return this.all().find(g=>g.id===id); },
  sort(arr){ return arr.slice().sort((a,b)=>((a.order || 0) - (b.order || 0)) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); },
  inQ(area, y, q){ return this.sort(this.all().filter(g=>g.area===area && g.horizon==='q' + q && Number(g.year)===Number(y))); },
  inYear(area, y){ return this.sort(this.all().filter(g=>g.area===area && g.horizon==='year' && Number(g.year)===Number(y))); },
  dreams(area){ return this.sort(this.all().filter(g=>g.area===area && g.horizon==='dream')); },
  kindOf(g){ if (this.KINDS[g.kind]) return g.kind; if (Number(g.amountTarget) > 0) return 'money'; if ((g.milestones || []).length) return 'milestones'; return 'simple'; },
  isQ(g){ return /^q[1-4]$/.test(String(g.horizon)); },
  qOf(g){ return this.isQ(g) ? Number(g.horizon[1]) : null; },
  /* meta de dinero: si hay cuenta vinculada, lo ahorrado es su saldo en USD */
  money(g){
    const target = round2(Number(g.amountTarget) || 0);
    const acc = g.accountId ? Store.account(g.accountId) : null;
    const saved = round2(Math.max(0, acc ? Calc.toUSD(Calc.accountBalance(acc), acc.currency) : (Number(g.amountSaved) || 0)));
    const pct = target ? Math.min(100, Math.round(saved / target * 100)) : 0;
    return { target, saved, left: round2(Math.max(0, target - saved)), pct, acc };
  },
  progress(g){
    if (g.done) return 100;
    const k = this.kindOf(g);
    if (k==='money') return this.money(g).pct;
    const ms = g.milestones || [];
    if (k==='milestones' && ms.length) return Math.round(ms.filter(m=>m.done).length / ms.length * 100);
    return Math.max(0, Math.min(100, Math.round(Number(g.progress) || 0)));
  },
  horizonLabel(g){
    if (g.horizon==='dream') return 'Sueño';
    if (g.horizon==='year') return `Meta del año ${g.year || ''}`.trim();
    const q = this.qOf(g);
    return `${q ? this.QL[q] : g.horizon} ${g.year || ''}`.trim();
  },
  sub(g){
    if (g.done) return g.doneAt ? `Cumplida · ${fmtDate(g.doneAt, 'short')}` : 'Cumplida';
    const k = this.kindOf(g);
    if (k==='money'){ const m = this.money(g); return `${fmtMoney(m.saved)} de ${fmtMoney(m.target)} · ${m.pct}%${m.acc ? ' · ' + esc(m.acc.name) : ''}`; }
    const ms = g.milestones || [];
    if (ms.length) return `${ms.filter(m=>m.done).length} de ${ms.length} hitos`;
    const p = this.progress(g);
    return p ? `${p}% de avance` : 'Sin avance todavía';
  },
  /* trimestres seguidos con todas sus metas cumplidas (el actual cuenta si ya está al 100%) */
  streak(area){
    const check = (y, q)=>{ const gs = this.inQ(area, y, q); return gs.length ? gs.every(g=>g.done) : null; };
    let y = this.curYear(), q = this.curQ(), n = 0;
    if (check(y, q)===true) n++;
    for (let i=0; i<40; i++){ q--; if (q < 1){ q = 4; y--; } if (check(y, q)!==true) break; n++; }
    return n;
  },
  setDone(g, val){ g.done = !!val; g.doneAt = val ? todayISO() : null; Store.upsert('goals', g); },
  toggle(id){
    const g = this.get(id); if (!g) return;
    const wasDone = !!g.done;
    this.setDone(g, !wasDone);
    App.render();
    if (wasDone) return UI.toast('Meta reabierta');
    let msg = g.horizon==='dream' ? '¡Sueño cumplido! ✨' : '¡Meta cumplida! 🎉';
    if (this.isQ(g)){ const gs = this.inQ(g.area, g.year, this.qOf(g)); if (gs.length && gs.every(x=>x.done)) msg = 'Trimestre completo 🔥 Todas las metas cumplidas'; }
    UI.toast(msg);
  },
  async remove(g){
    if (!(await UI.confirm(`¿Eliminar la meta "${g.title}"?`))) return;
    Store.remove('goals', g.id);
    if (location.hash===`#/metas/${g.id}`) App.go('#/metas'); else App.render();
    UI.toast('Meta eliminada');
  },
  accountOptions(sel){
    return `<option value=""${!sel ? ' selected' : ''}>Sin cuenta · llevo el ahorro a mano</option>` +
      Store.accountsSorted().filter(a=>!a.archived || a.id===sel).map(a=>`<option value="${a.id}"${a.id===sel ? ' selected' : ''}>${esc(a.name)} · ${fmtMoney(Calc.accountBalance(a), a.currency)}</option>`).join('');
  },

  /* ---------- piezas de UI ---------- */
  row(g, opts={}){
    const p = this.progress(g);
    return `<div class="meta-row ${g.done ? 'done' : ''}">
      <button class="meta-chk ${g.done ? 'on' : ''}" data-action="meta-toggle" data-id="${g.id}" aria-label="${g.done ? 'Reabrir' : 'Marcar cumplida'}">${UI.icon('check')}</button>
      <button class="meta-body" data-go="#/metas/${g.id}"><div class="meta-title ellipsis">${esc(g.title)}</div><div class="progress"><div style="width:${p}%"></div></div><div class="meta-sub xs muted ellipsis">${opts.showArea ? `<span class="meta-tag">${this.AREAS[g.area] || 'Personal'}</span> · ` : ''}${this.sub(g)}</div></button>
      <span class="meta-chev">${UI.icon('chevron')}</span></div>`;
  },
  dreamRow(g){
    const sub = g.done ? (g.doneAt ? `Cumplido · ${fmtDate(g.doneAt, 'short')}` : 'Cumplido') : (g.description ? esc(g.description) : 'Sin fecha · toca para ver el detalle');
    return `<div class="meta-row dream ${g.done ? 'done' : ''}">
      <button class="meta-chk ${g.done ? 'on' : ''}" data-action="meta-toggle" data-id="${g.id}" aria-label="${g.done ? 'Reabrir' : 'Cumplido'}">${UI.icon('check')}</button>
      <button class="meta-body" data-go="#/metas/${g.id}"><div class="meta-title">${esc(g.title)}</div><div class="meta-sub xs muted ellipsis">${sub}</div></button>
      ${g.done ? '' : `<button class="btn secondary sm meta-movebtn" data-action="meta-move" data-id="${g.id}" aria-label="Mover a un trimestre">${UI.icon('calendar')} Mover</button>`}</div>`;
  },
  steps(){
    return `<div class="meta-steps"><div class="meta-step"><div class="n">1</div><div class="t">3 sueños</div><div class="s">Ideas grandes, sin fecha</div></div><div class="meta-step"><div class="n">2</div><div class="t">1 meta</div><div class="s">Para este trimestre</div></div><div class="meta-step"><div class="n">3</div><div class="t">Hitos</div><div class="s">Pasos pequeños y claros</div></div></div>`;
  },
  startCard(area){
    return `<div class="card"><div class="semibold" style="font-size:17px">Empieza con una ruta sencilla</div><div class="small muted" style="margin-top:4px">No hace falta planificar todo el año hoy. Con esto alcanza:</div>${this.steps()}
      <div class="btnrow" style="margin:0"><button class="btn sm" data-action="meta-dreams-add" data-area="${area}">✨ Escribir mis sueños</button><button class="btn sm secondary" data-action="meta-new" data-horizon="q${this.curQ()}" data-year="${this.curYear()}" data-area="${area}">Meta del trimestre</button></div></div>`;
  },

  /* ---------- pantalla principal #/metas ---------- */
  panel(){
    const area = this.area(), y = this.year(), cy = this.curYear();
    const dreams = this.dreams(area), activeDreams = dreams.filter(g=>!g.done), doneDreams = dreams.filter(g=>g.done);
    const qs = [1, 2, 3, 4].map(q=>({ q, goals: this.inQ(area, y, q), state: this.qState(y, q) }));
    const yearGoals = this.inYear(area, y);
    const planned = qs.flatMap(x=>x.goals).concat(yearGoals);
    const total = planned.length, done = planned.filter(g=>g.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const anyArea = this.all().some(g=>g.area===area);
    let html = `<div class="topbar"><div class="grow"><div class="muted small">Sueños → metas → hitos</div><h1>Metas</h1></div><button class="iconbtn" data-action="meta-new" data-area="${area}" data-year="${y}" aria-label="Nueva meta">${UI.icon('plus')}</button></div>`;
    html += `<div class="meta-top"><div class="seg">${Object.entries(this.AREAS).map(([k, l])=>`<button class="${k===area ? 'active' : ''}" data-action="meta-area" data-area="${k}">${l}</button>`).join('')}</div>
      <div class="monthnav"><button data-action="meta-year" data-delta="-1" aria-label="Año anterior">${UI.icon('left')}</button><div class="m">${y}</div><button data-action="meta-year" data-delta="1" aria-label="Año siguiente">${UI.icon('chevron')}</button></div></div>`;
    if (!anyArea){
      html += this.startCard(area);
    } else {
      const items = total ? [{ value: done, color:'#fff' }, { value: total - done, color:'rgba(255,255,255,.28)' }].filter(i=>i.value > 0) : [{ value:1, color:'rgba(255,255,255,.22)' }];
      const streak = y===cy ? this.streak(area) : 0;
      html += `<div class="hero meta-hero"><div class="meta-hero-row">${UI.donut(items, 12)}<div class="grow"><div class="label">Resumen ${y} · ${this.AREAS[area]}</div><div class="big">${pct}%</div><div class="sub">${total ? `${done} de ${total} meta${total===1 ? '' : 's'} cumplida${done===1 ? '' : 's'}` : 'Aún no hay metas planificadas este año'}</div>${streak ? `<div class="meta-streak">🔥 ${streak} trimestre${streak===1 ? '' : 's'} seguido${streak===1 ? '' : 's'} al 100%</div>` : ''}</div></div>
        <div class="hero-tiles"><div class="hero-tile"><div class="t">${UI.icon('check')} Cumplidas</div><div class="v">${done}</div></div><div class="hero-tile"><div class="t">${UI.icon('target')} Pendientes</div><div class="v">${total - done}</div></div><div class="hero-tile"><div class="t">✨ Sueños</div><div class="v">${activeDreams.length}</div></div></div></div>`;
    }
    /* Sueños */
    html += `<div class="section-title"><h2>Sueños</h2><span class="muted small">${activeDreams.length ? `${activeDreams.length} por cumplir` : 'ideas grandes, sin fecha'}</span></div>`;
    html += `<div class="card meta-q"><div class="meta-rows">${activeDreams.length ? activeDreams.map(g=>this.dreamRow(g)).join('') : `<div class="meta-none">Aquí van las cosas grandes que quieres lograr algún día. Cuando una te llame, muévela a un trimestre y se convierte en meta.</div>`}</div>
      ${doneDreams.length ? `<button class="meta-linkbtn" data-action="meta-toggle-done-dreams">${App.state.metas_showDoneDreams ? 'Ocultar' : 'Ver'} ${doneDreams.length} cumplido${doneDreams.length===1 ? '' : 's'}</button>${App.state.metas_showDoneDreams ? `<div class="meta-rows">${doneDreams.map(g=>this.dreamRow(g)).join('')}</div>` : ''}` : ''}
      <div class="meta-q-foot"><button class="meta-quick" data-action="meta-dreams-add" data-area="${area}">✨ Un sueño por cumplir…</button></div></div>`;
    /* Trimestres */
    html += `<div class="section-title"><h2>Trimestres de ${y}</h2><span class="muted small">1 o 2 metas por trimestre</span></div>`;
    for (const x of qs){
      const n = x.goals.length, d = x.goals.filter(g=>g.done).length, pending = n - d;
      const end = this.qEnd(y, x.q); const left = x.state==='cur' ? this.daysLeft(y, x.q) : 0;
      const emptyMsg = x.state==='past' ? 'Sin metas en este trimestre.' : x.state==='cur' ? 'Elige una sola cosa que quieras lograr antes de que termine el trimestre.' : 'Todavía nada por aquí. Puedes dejarlo para más adelante.';
      html += `<div class="card meta-q ${x.state}"><div class="meta-q-head"><h3>${this.QL[x.q]}</h3><span class="xs muted">${this.QM[x.q]}</span>${x.state==='cur' ? '<span class="badge g">En curso</span>' : ''}<span class="meta-count ${n && d===n ? 'full' : ''}">${d}/${n}</span></div>
        ${x.state==='cur' ? `<div class="meta-none" style="padding-top:0">${left ? `Quedan ${left} día${left===1 ? '' : 's'} · termina el ${fmtDate(end, 'short')}` : 'Último día del trimestre'}</div>` : ''}
        <div class="meta-rows">${n ? x.goals.map(g=>this.row(g)).join('') : `<div class="meta-none">${emptyMsg}</div>`}</div>
        <div class="meta-q-foot"><button class="btn secondary sm" data-action="meta-new" data-horizon="q${x.q}" data-year="${y}" data-area="${area}">${UI.icon('plus')} Meta</button>${x.state==='past' && pending ? `<button class="link" data-action="meta-move-pending" data-q="${x.q}" data-year="${y}">Mover ${pending} pendiente${pending===1 ? '' : 's'} al actual</button>` : ''}</div></div>`;
    }
    /* Año */
    html += `<div class="section-title"><h2>Metas del año</h2><span class="muted small">${yearGoals.length ? `${yearGoals.filter(g=>g.done).length}/${yearGoals.length}` : 'objetivos de todo ' + y}</span></div>`;
    html += `<div class="card meta-q"><div class="meta-rows">${yearGoals.length ? yearGoals.map(g=>this.row(g)).join('') : `<div class="meta-none">Objetivos grandes de ${y} que no caben en un solo trimestre.</div>`}</div><div class="meta-q-foot"><button class="btn secondary sm" data-action="meta-new" data-horizon="year" data-year="${y}" data-area="${area}">${UI.icon('plus')} Meta del año</button></div></div>`;
    html += `<div class="xs muted center mt">Una ruta sencilla: escribe sueños, elige una meta por trimestre y divídela en hitos pequeños.</div>`;
    return html;
  },

  /* ---------- detalle #/metas/:id ---------- */
  one(id){
    const g = this.get(id);
    if (!g) return Views.back('#/metas', 'Meta') + `<div class="card">${UI.empty('🤷', 'Meta no encontrada')}</div>`;
    const kind = this.kindOf(g), p = this.progress(g), ms = g.milestones || [];
    const cur = this.isQ(g) && this.qState(Number(g.year), this.qOf(g))==='cur';
    let html = Views.back('#/metas', 'Meta', `<button class="iconbtn" data-action="meta-edit" data-id="${g.id}" aria-label="Editar">${UI.icon('edit')}</button>`);
    html += `<div class="card"><div class="meta-detail-title ${g.done ? 'done' : ''}">${esc(g.title)}</div>
      <div class="meta-badges"><span class="badge b">${this.AREAS[g.area] || 'Personal'}</span><span class="badge ${cur ? 'g' : ''}">${this.horizonLabel(g)}${cur ? ' · en curso' : ''}</span><span class="badge">${this.KINDS[kind]}</span>${g.done ? `<span class="badge g">✓ Cumplida${g.doneAt ? ' ' + fmtDate(g.doneAt, 'short') : ''}</span>` : ''}</div>
      ${g.description ? `<div class="small mt" style="white-space:pre-wrap">${esc(g.description)}</div>` : ''}
      <div class="row between mt"><span class="small muted">Progreso</span><span class="semibold">${p}%</span></div>
      <div class="progress" style="height:8px;margin-top:6px"><div class="${g.done ? 'ok' : ''}" style="width:${p}%"></div></div>`;
    if (kind==='simple' && !ms.length && !g.done) html += `<div class="meta-pchips">${[0, 25, 50, 75, 100].map(v=>`<button class="${p===v ? 'active' : ''}" data-action="meta-progress" data-id="${g.id}" data-p="${v}">${v}%</button>`).join('')}</div><div class="xs muted" style="margin-top:6px">Marca a mano cuánto llevas. Al 100% se da por cumplida.</div>`;
    if (kind==='money'){
      const m = this.money(g);
      html += `<div class="meta-money"><div><div class="t">Objetivo</div><div class="v">${fmtMoney(m.target)}</div></div><div><div class="t">Ahorrado</div><div class="v green">${fmtMoney(m.saved)}</div></div><div><div class="t">Falta</div><div class="v ${m.left <= 0 ? 'green' : ''}">${m.left <= 0 ? '¡Listo!' : fmtMoney(m.left)}</div></div></div>`;
      if (m.acc) html += `<button class="meta-linked" data-go="#/cuentas/${m.acc.id}">${UI.accIcon(m.acc, 'sm')}<div class="grow"><div class="small semibold">Vinculada a ${esc(m.acc.name)}</div><div class="xs muted">Lo ahorrado es el saldo de la cuenta, convertido a USD</div></div><span class="meta-chev">${UI.icon('chevron')}</span></button>`;
      else html += `<div class="meta-linked"><div class="grow"><div class="small semibold">Ahorro llevado a mano</div><div class="xs muted">${g.accountId ? 'La cuenta vinculada ya no existe. ' : ''}Actualízalo cuando apartes dinero.</div></div><button class="btn secondary sm" data-action="meta-saved" data-id="${g.id}">Actualizar</button></div>`;
    }
    html += `<div class="btnrow"><button class="btn sm ${g.done ? 'secondary' : ''}" data-action="meta-toggle" data-id="${g.id}">${g.done ? 'Reabrir' : '✓ Marcar cumplida'}</button><button class="btn sm secondary" data-action="meta-move" data-id="${g.id}">${UI.icon('calendar')} Mover</button></div></div>`;
    /* hitos */
    html += `<div class="card"><div class="card-head"><h3>Hitos</h3><span class="muted small">${ms.length ? `${ms.filter(m=>m.done).length} de ${ms.length}` : ''}</span></div>`;
    html += ms.length ? `<div class="meta-mslist">${ms.map((m, i)=>`<div class="meta-ms ${m.done ? 'done' : ''}"><button class="meta-chk ${m.done ? 'on' : ''}" data-action="meta-ms-toggle" data-id="${g.id}" data-ms="${m.id}" aria-label="Hito listo">${UI.icon('check')}</button><div class="txt">${esc(m.text)}</div><button class="mini" data-action="meta-ms-move" data-id="${g.id}" data-ms="${m.id}" data-dir="-1" ${i===0 ? 'disabled' : ''} aria-label="Subir">${UI.icon('up')}</button><button class="mini" data-action="meta-ms-move" data-id="${g.id}" data-ms="${m.id}" data-dir="1" ${i===ms.length - 1 ? 'disabled' : ''} aria-label="Bajar">${UI.icon('down')}</button><button class="mini" data-action="meta-ms-del" data-id="${g.id}" data-ms="${m.id}" aria-label="Quitar">${UI.icon('trash')}</button></div>`).join('')}</div>`
      : `<div class="small muted">Divide la meta en pasos pequeños y concretos. Cuando marques todos, la meta se dará por cumplida.</div>`;
    html += `<button class="meta-quick" data-action="meta-ms-add" data-id="${g.id}">${UI.icon('plus')} Agregar un hito…</button></div>`;
    /* tareas de otros módulos vinculadas a esta meta */
    const tasks = (Store.data.tasks || []).filter(t=>t.goalId===g.id);
    if (tasks.length) html += `<div class="card"><div class="card-head"><h3>Tareas vinculadas</h3><span class="muted small">${tasks.filter(t=>t.done).length} de ${tasks.length}</span></div>${tasks.map(t=>`<div class="meta-ms ${t.done ? 'done' : ''}"><span class="meta-chk ${t.done ? 'on' : ''}">${UI.icon('check')}</span><div class="txt">${esc(t.title)}</div><span class="xs muted">${t.date ? fmtDate(t.date, 'short') : ''}</span></div>`).join('')}</div>`;
    html += `<button class="btn danger" data-action="meta-delete" data-id="${g.id}">${UI.icon('trash')} Eliminar meta</button>`;
    if (g.createdAt) html += `<div class="xs muted center mt">Creada el ${fmtDate(String(g.createdAt).slice(0, 10))}</div>`;
    return html;
  },

  /* ---------- tarjeta del Inicio ---------- */
  homeCard(){
    const cy = this.curYear(), cq = this.curQ(), end = this.qEnd(cy, cq);
    const all = this.all();
    const goals = this.sort(all.filter(g=>g.horizon==='q' + cq && Number(g.year)===cy));
    const total = goals.length, done = goals.filter(g=>g.done).length;
    let html = `<div class="card meta-home"><div class="card-head"><h3>🎯 Tu ruta</h3><a class="link" href="#/metas">Ver metas</a></div>`;
    if (!all.length){
      html += `<div class="small muted">Una ruta sencilla para lograr lo que quieres: escribe <b>3 sueños</b>, elige <b>1 meta por trimestre</b> y divídela en pasos pequeños.</div>${this.steps()}
        <div class="btnrow" style="margin:0"><button class="btn sm" data-action="meta-dreams-add">✨ Escribir mis sueños</button><button class="btn sm secondary" data-action="meta-new" data-horizon="q${cq}" data-year="${cy}">Primera meta</button></div>`;
    } else if (!total){
      const dreams = all.filter(g=>g.horizon==='dream' && !g.done).length;
      html += `<div class="small muted">Todavía no tienes una meta para el ${this.QL[cq]} de ${cy}. Elige una sola cosa que quieras lograr antes del ${fmtDate(end, 'short')}.${dreams ? ` Tienes ${dreams} sueño${dreams===1 ? '' : 's'} esperando: puedes mover uno.` : ''}</div>
        <div class="btnrow" style="margin-top:10px"><button class="btn sm" data-action="meta-new" data-horizon="q${cq}" data-year="${cy}">Definir la meta del trimestre</button>${dreams ? '<button class="btn sm secondary" data-go="#/metas">Ver sueños</button>' : ''}</div>`;
    } else {
      const show = goals.filter(g=>!g.done).concat(goals.filter(g=>g.done)).slice(0, 4);
      const left = this.daysLeft(cy, cq);
      html += `<div class="row between small"><span class="muted">${done} de ${total} cumplida${total===1 ? '' : 's'} este trimestre</span><span class="muted xs">${left ? `${left} día${left===1 ? '' : 's'} restantes` : 'último día'}</span></div>
        <div class="progress" style="margin:6px 0 2px"><div class="${done===total ? 'ok' : ''}" style="width:${Math.round(done / total * 100)}%"></div></div>
        <div class="meta-rows">${show.map(g=>this.row(g, { showArea:true })).join('')}</div>
        ${total > 4 ? `<a class="link small" href="#/metas">y ${total - 4} más</a>` : ''}
        ${done===total ? '<div class="small green semibold mt">Trimestre completo 🔥 ¿Y el siguiente?</div>' : ''}`;
    }
    return html + '</div>';
  },

  /* ---------- formulario crear / editar ---------- */
  form(g=null, def={}){
    const editing = !!g;
    let area = g ? g.area : (this.AREAS[def.area] ? def.area : this.area());
    let kind = g ? this.kindOf(g) : (this.KINDS[def.kind] ? def.kind : 'simple');
    const horizon = g ? g.horizon : (def.horizon || 'q' + this.curQ());
    const year = g ? (Number(g.year) || this.curYear()) : (Number(def.year) || this.year());
    const hOpts = [['dream', 'Sueño (sin fecha)'], ['year', 'Meta del año'], ['q1', '1er trimestre'], ['q2', '2º trimestre'], ['q3', '3er trimestre'], ['q4', '4º trimestre']];
    const hints = { simple:'Marcas el avance a mano (25 %, 50 %…) o la cumples de una vez.', milestones:'Pasos pequeños; el progreso se calcula solo.', money:'Un monto en dólares; puedes vincular una cuenta para seguirlo solo.' };
    const s = UI.sheet({ title: editing ? 'Editar meta' : 'Nueva meta', html: `
      <div class="field"><label>¿Qué quieres lograr?</label><input name="title" value="${esc(g ? g.title : '')}" placeholder="Ej. Correr 10 km sin parar" autofocus></div>
      <div class="field"><label>Área</label><div class="seg" data-area>${Object.entries(this.AREAS).map(([k, l])=>`<button type="button" data-v="${k}" class="${k===area ? 'active' : ''}">${l}</button>`).join('')}</div></div>
      <div class="two"><div class="field"><label>¿Para cuándo?</label><select name="horizon">${hOpts.map(([v, l])=>`<option value="${v}"${v===horizon ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="field" data-yearf><label>Año</label><input name="year" type="number" inputmode="numeric" min="2000" max="2100" value="${year}"></div></div>
      <div class="field"><label>Descripción</label><textarea name="description" placeholder="Opcional: por qué importa y cómo sabrás que la lograste">${esc(g ? g.description || '' : '')}</textarea></div>
      <div class="field"><label>Tipo de meta</label><div class="seg" data-kind>${Object.entries(this.KINDS).map(([k, l])=>`<button type="button" data-v="${k}" class="${k===kind ? 'active' : ''}">${l}</button>`).join('')}</div><div class="hint" data-kindhint></div></div>
      <div data-ms class="hide"><div class="field"><label>Hitos (uno por línea)</label><textarea name="milestones" placeholder="Inscribirme en la carrera&#10;Correr 5 km&#10;Correr 8 km">${esc((g && g.milestones || []).map(m=>m.text).join('\n'))}</textarea></div></div>
      <div data-money class="hide">
        <div class="two"><div class="field"><label>Monto objetivo (USD)</label><input name="target" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${g && g.amountTarget ? esc(g.amountTarget) : ''}"></div><div class="field" data-savedf><label>Ahorrado hasta ahora</label><input name="saved" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${g && g.amountSaved ? esc(g.amountSaved) : ''}"></div></div>
        <div class="field"><label>Cuenta vinculada</label><select name="account">${this.accountOptions(g ? g.accountId : null)}</select><div class="hint">Si la vinculas, lo ahorrado será el saldo de esa cuenta convertido a USD.</div></div>
      </div>
      <button class="btn" data-save>${editing ? 'Guardar cambios' : 'Crear meta'}</button>
      ${editing ? '<button class="btn danger mt" data-del>Eliminar meta</button>' : ''}` });
    const f = s.body;
    const hSel = f.querySelector('[name=horizon]'), accSel = f.querySelector('[name=account]');
    const refresh = ()=>{
      f.querySelector('[data-yearf]').classList.toggle('hide', hSel.value==='dream');
      f.querySelector('[data-ms]').classList.toggle('hide', kind!=='milestones');
      f.querySelector('[data-money]').classList.toggle('hide', kind!=='money');
      f.querySelector('[data-savedf]').classList.toggle('hide', !!accSel.value);
      f.querySelector('[data-kindhint]').textContent = hints[kind];
    };
    const seg = (sel, set)=>{ f.querySelector(sel).onclick = e=>{ const b = e.target.closest('[data-v]'); if (!b) return; set(b.dataset.v); f.querySelectorAll(sel + ' button').forEach(x=>x.classList.toggle('active', x===b)); refresh(); }; };
    seg('[data-area]', v=>{ area = v; }); seg('[data-kind]', v=>{ kind = v; });
    hSel.onchange = refresh; accSel.onchange = refresh; refresh();
    const val = n=>{ const el = f.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
    f.querySelector('[data-save]').onclick = ()=>{
      const title = val('title'); if (!title) return UI.toast('Escribe qué quieres lograr', true);
      const h = hSel.value; const yr = h==='dream' ? null : (parseInt(val('year'), 10) || this.curYear());
      if (yr!==null && (yr < 2000 || yr > 2100)) return UI.toast('Revisa el año', true);
      const obj = Object.assign({}, g || { id: uid(), createdAt: new Date().toISOString(), done:false, doneAt:null, progress:0, milestones:[], order: Date.now() },
        { title, area, horizon: h, year: yr, description: val('description'), kind });
      if (kind==='milestones'){
        const old = (g && g.milestones) || []; const used = new Set();
        obj.milestones = val('milestones').split('\n').map(t=>t.trim()).filter(Boolean).map(t=>{ const m = old.find(o=>o.text===t && !used.has(o.id)); if (m){ used.add(m.id); return m; } return { id: uid(), text: t, done:false }; });
      }
      if (kind==='money'){
        const target = parseAmount(val('target')); if (!(target > 0)) return UI.toast('Escribe el monto objetivo', true);
        obj.amountTarget = round2(target); obj.accountId = accSel.value || null;
        const saved = parseAmount(val('saved'));
        obj.amountSaved = obj.accountId ? (Number(g && g.amountSaved) || 0) : (saved > 0 ? round2(saved) : 0);
      } else { obj.amountTarget = null; obj.accountId = null; }
      Store.upsert('goals', obj); s.close();
      if (!editing){ App.state.metas_area = area; if (yr) App.state.metas_year = yr; }
      if (!editing && !/^#\/metas/.test(location.hash || '')) App.go('#/metas'); else App.render();
      UI.toast(editing ? 'Meta guardada' : (h==='dream' ? 'Sueño guardado ✨' : 'Meta creada'));
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = ()=>{ s.close(); this.remove(g); };
  },

  /* ---------- hojas auxiliares ---------- */
  dreamsSheet(area){
    area = this.AREAS[area] ? area : this.area();
    const s = UI.sheet({ title:'Sueños por cumplir', html: `
      <div class="small muted mb">Escribe uno por línea, sin filtros: son ideas grandes y sin fecha. Más adelante moverás las que quieras a un trimestre.</div>
      <div class="field"><div class="seg" data-area>${Object.entries(this.AREAS).map(([k, l])=>`<button type="button" data-v="${k}" class="${k===area ? 'active' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field"><textarea name="lines" style="min-height:150px" placeholder="Viajar a Japón&#10;Hablar inglés con fluidez&#10;Tener mi propia casa" autofocus></textarea></div>
      <button class="btn" data-save>Guardar sueños</button>` });
    const f = s.body;
    f.querySelector('[data-area]').onclick = e=>{ const b = e.target.closest('[data-v]'); if (!b) return; area = b.dataset.v; f.querySelectorAll('[data-area] button').forEach(x=>x.classList.toggle('active', x===b)); };
    f.querySelector('[data-save]').onclick = ()=>{
      const lines = f.querySelector('[name=lines]').value.split('\n').map(t=>t.trim()).filter(Boolean);
      if (!lines.length) return UI.toast('Escribe al menos un sueño', true);
      const base = Date.now();
      lines.forEach((title, i)=>Store.upsert('goals', { id: uid(), title, area, horizon:'dream', year:null, done:false, doneAt:null, progress:0, milestones:[], kind:'simple', description:'', order: base + i, createdAt: new Date().toISOString() }));
      s.close(); App.state.metas_area = area;
      if (!/^#\/metas/.test(location.hash || '')) App.go('#/metas'); else App.render();
      UI.toast(`${lines.length} sueño${lines.length===1 ? '' : 's'} guardado${lines.length===1 ? '' : 's'} ✨`);
    };
  },
  moveSheet(g){
    const cq = this.curQ();
    let year = Number(g.year) || this.curYear(), horizon = g.horizon==='dream' ? 'q' + cq : g.horizon;
    const s = UI.sheet({ title:'¿Para cuándo?', html: `
      <div class="small muted mb ellipsis">${esc(g.title)}</div>
      <div class="monthnav" data-ynav><button type="button" data-d="-1" aria-label="Año anterior">${UI.icon('left')}</button><div class="m" data-y>${year}</div><button type="button" data-d="1" aria-label="Año siguiente">${UI.icon('chevron')}</button></div>
      <div class="meta-hchips" data-h></div>
      <button class="btn" data-save>Mover</button>` });
    const f = s.body;
    const draw = ()=>{
      f.querySelector('[data-y]').textContent = year;
      f.querySelector('[data-h]').innerHTML = [1, 2, 3, 4].map(q=>{ const st = this.qState(year, q); return `<button type="button" data-v="q${q}" class="${horizon==='q' + q ? 'active' : ''}">${this.QL[q]}<span class="s">${this.QM[q]}${st==='cur' ? ' · en curso' : st==='past' ? ' · pasado' : ''}</span></button>`; }).join('')
        + `<button type="button" data-v="year" class="${horizon==='year' ? 'active' : ''}">Todo ${year}<span class="s">meta del año</span></button><button type="button" data-v="dream" class="${horizon==='dream' ? 'active' : ''}">Sin fecha<span class="s">volver a sueños</span></button>`;
    };
    f.querySelector('[data-ynav]').onclick = e=>{ const b = e.target.closest('[data-d]'); if (!b) return; year += Number(b.dataset.d); draw(); };
    f.querySelector('[data-h]').onclick = e=>{ const b = e.target.closest('[data-v]'); if (!b) return; horizon = b.dataset.v; draw(); };
    draw();
    f.querySelector('[data-save]').onclick = ()=>{
      g.horizon = horizon; g.year = horizon==='dream' ? null : year;
      Store.upsert('goals', g); s.close();
      if (horizon!=='dream') App.state.metas_year = year;
      App.state.metas_area = g.area;
      App.render(); UI.toast(horizon==='dream' ? 'Volvió a tus sueños' : `Movida: ${this.horizonLabel(g).toLowerCase()}`);
    };
  },
  msSheet(g){
    const s = UI.sheet({ title:'Nuevo hito', html: `<div class="field"><label>Un paso pequeño y concreto</label><input name="text" placeholder="Ej. Inscribirme en la carrera" autofocus></div><button class="btn" data-save>Agregar</button>` });
    const f = s.body; const inp = f.querySelector('[name=text]');
    const save = ()=>{
      const text = inp.value.trim(); if (!text) return UI.toast('Escribe el hito', true);
      g.milestones = (g.milestones || []).concat([{ id: uid(), text, done:false }]);
      if (this.kindOf(g)==='simple') g.kind = 'milestones';
      if (g.done){ g.done = false; g.doneAt = null; }
      Store.upsert('goals', g); s.close(); App.render(); UI.toast('Hito agregado');
    };
    f.querySelector('[data-save]').onclick = save;
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); save(); } });
  },
  savedSheet(g){
    const m = this.money(g);
    const s = UI.sheet({ title:'Ahorrado hasta ahora', html: `
      <div class="amount-wrap"><div class="cur">USD · objetivo ${fmtMoney(m.target)}</div><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${m.saved || ''}" autofocus></div>
      <div class="small muted center mb">Escribe el total que llevas apartado para esta meta.</div>
      <button class="btn" data-save>Guardar</button>` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{
      const v = parseAmount(f.querySelector('[name=amount]').value); if (!isFinite(v) || v < 0) return UI.toast('Escribe un monto válido', true);
      g.amountSaved = round2(v); Store.upsert('goals', g); s.close(); App.render();
      UI.toast(g.amountSaved >= m.target && m.target ? '¡Ya reuniste el monto! Márcala cumplida cuando quieras 🎉' : 'Ahorro actualizado');
    };
  },

  /* ---------- acciones (data-action="meta-…") ---------- */
  actions: {
    'meta-area'(d){ App.state.metas_area = Metas.AREAS[d.area] ? d.area : 'personal'; App.render(); },
    'meta-year'(d){ App.state.metas_year = Metas.year() + (Number(d.delta) || 0); App.render(); },
    'meta-toggle-done-dreams'(){ App.state.metas_showDoneDreams = !App.state.metas_showDoneDreams; App.render(); },
    'meta-new'(d){ Metas.form(null, { horizon: d.horizon, year: d.year, area: d.area }); },
    'meta-edit'(d){ const g = Metas.get(d.id); if (g) Metas.form(g); },
    'meta-toggle'(d){ Metas.toggle(d.id); },
    'meta-move'(d){ const g = Metas.get(d.id); if (g) Metas.moveSheet(g); },
    'meta-delete'(d){ const g = Metas.get(d.id); if (g) Metas.remove(g); },
    'meta-dreams-add'(d){ Metas.dreamsSheet(d.area); },
    'meta-saved'(d){ const g = Metas.get(d.id); if (g) Metas.savedSheet(g); },
    'meta-ms-add'(d){ const g = Metas.get(d.id); if (g) Metas.msSheet(g); },
    async 'meta-move-pending'(d){
      const y = Number(d.year), q = Number(d.q), cy = Metas.curYear(), cq = Metas.curQ();
      const pend = Metas.inQ(Metas.area(), y, q).filter(g=>!g.done); if (!pend.length) return;
      const n = pend.length;
      if (!(await UI.confirm(`¿Mover ${n} meta${n===1 ? '' : 's'} pendiente${n===1 ? '' : 's'} al ${Metas.QL[cq]} de ${cy}?`, { ok:'Mover', danger:false }))) return;
      pend.forEach(g=>{ g.horizon = 'q' + cq; g.year = cy; Store.upsert('goals', g); });
      App.state.metas_year = cy; App.render(); UI.toast('Metas movidas al trimestre actual');
    },
    'meta-progress'(d){
      const g = Metas.get(d.id); if (!g) return;
      const p = Math.max(0, Math.min(100, Number(d.p) || 0));
      g.progress = p;
      if (p >= 100){ Metas.setDone(g, true); App.render(); return UI.toast('¡Meta cumplida! 🎉'); }
      if (g.done){ g.done = false; g.doneAt = null; }
      Store.upsert('goals', g); App.render();
    },
    'meta-ms-toggle'(d){
      const g = Metas.get(d.id); const m = g && (g.milestones || []).find(x=>x.id===d.ms); if (!m) return;
      m.done = !m.done;
      if (m.done && g.milestones.every(x=>x.done) && !g.done){ Metas.setDone(g, true); App.render(); return UI.toast('¡Todos los hitos listos! Meta cumplida 🎉'); }
      if (!m.done && g.done){ g.done = false; g.doneAt = null; }
      Store.upsert('goals', g); App.render();
    },
    async 'meta-ms-del'(d){
      const g = Metas.get(d.id); const m = g && (g.milestones || []).find(x=>x.id===d.ms); if (!m) return;
      if (!(await UI.confirm(`¿Quitar el hito "${m.text}"?`, { ok:'Quitar' }))) return;
      g.milestones = g.milestones.filter(x=>x.id!==d.ms); Store.upsert('goals', g); App.render();
    },
    'meta-ms-move'(d){
      const g = Metas.get(d.id); if (!g) return;
      const ms = g.milestones || []; const i = ms.findIndex(x=>x.id===d.ms); const j = i + (Number(d.dir) || 0);
      if (i < 0 || j < 0 || j >= ms.length) return;
      [ms[i], ms[j]] = [ms[j], ms[i]]; g.milestones = ms; Store.upsert('goals', g); App.render();
    },
  },
};

App.registerModule({
  id: 'metas',
  name: 'Metas',
  icon: 'target',
  tab: { hash:'#/metas', label:'Metas', icon:'target', order:20 },
  collections: ['goals'],
  routes: [
    [/^#\/metas$/, ()=>Metas.panel(), 'metas'],
    [/^#\/metas\/([\w-]+)$/, m=>Metas.one(m[1]), 'metas'],
  ],
  menu: [{ hash:'#/metas', icon:'target', label:'Metas' }],
  homeCards: [{ order: 40, render: ()=>Metas.homeCard() }],
  fab: [{ label:'Nueva meta', sub:'Para este trimestre, el año o un sueño sin fecha', icon:'target', cls:'b', run(){ Metas.form(null, {}); } }],
  actions: Metas.actions,
  init(){
    if (!Metas.AREAS[App.state.metas_area]) App.state.metas_area = 'personal';
    if (!App.state.metas_year) App.state.metas_year = Metas.curYear();
  },
  css: `
.meta-top{display:flex;gap:8px;margin-bottom:12px;align-items:stretch}
.meta-top .seg{flex:1;min-width:0}
.meta-top .monthnav{margin:0;flex:none;padding:3px}
.meta-top .monthnav .m{min-width:46px;text-align:center;font-size:15px}
.meta-top .monthnav button{width:34px;height:34px}
.meta-hero .meta-hero-row{display:flex;align-items:center;gap:16px}
.meta-hero .donut{width:92px;height:92px;flex:none}
.meta-hero .big{margin:0;font-size:32px}
.meta-streak{display:inline-block;margin-top:8px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}
.meta-q{padding:0;overflow:hidden}
.meta-q.cur{box-shadow:0 0 0 2px var(--accent),var(--shadow)}
.meta-q-head{display:flex;align-items:center;gap:8px;padding:12px 16px 6px}
.meta-q-head h3{margin:0;font-size:16px;flex:1;min-width:0}
.meta-q.past .meta-q-head h3{text-decoration:line-through;color:var(--muted)}
.meta-count{font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2);border-radius:999px;padding:2px 9px;flex:none}
.meta-count.full{background:var(--green-soft);color:var(--green)}
.meta-rows{display:flex;flex-direction:column}
.meta-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--line)}
.meta-row .meta-body{flex:1;min-width:0;text-align:left;display:block}
.meta-title{font-weight:600;font-size:15px}
.meta-row.done .meta-title{text-decoration:line-through;color:var(--muted)}
.meta-row .progress{margin-top:6px;height:5px}
.meta-row.done .progress > div{background:var(--green)}
.meta-row.dream .meta-body{padding:2px 0}
.meta-sub{margin-top:4px}
.meta-tag{font-weight:700;color:var(--accent)}
.meta-chev{color:var(--muted);flex:none;display:inline-flex}
.meta-chev svg{width:18px;height:18px}
.meta-chk{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:inline-flex;align-items:center;justify-content:center;color:transparent;flex:none;background:var(--card)}
.meta-chk svg{width:14px;height:14px;stroke-width:3}
.meta-chk.on{background:var(--green);border-color:var(--green);color:#fff}
.meta-movebtn{flex:none;padding:7px 10px}
.meta-q-foot{padding:8px 12px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.meta-q-foot .link{text-align:right}
.meta-none{padding:6px 16px 8px;font-size:13px;color:var(--muted);line-height:1.45}
.meta-linkbtn{display:block;width:100%;text-align:left;padding:8px 16px;font-size:13px;font-weight:600;color:var(--accent);border-top:1px solid var(--line)}
.meta-quick{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:11px 14px;border-radius:12px;border:1px dashed var(--line);background:var(--card-2);color:var(--muted);font-size:15px;margin-top:10px}
.meta-quick svg{width:16px;height:16px;flex:none}
.meta-q-foot .meta-quick{margin:2px 4px 0}
.meta-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.meta-step{background:var(--card-2);border-radius:12px;padding:10px 8px;text-align:center}
.meta-step .n{width:24px;height:24px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:6px}
.meta-step .t{font-size:12px;font-weight:700}
.meta-step .s{font-size:11px;color:var(--muted);margin-top:2px;line-height:1.3}
.meta-home .meta-row{padding:10px 0}
.meta-home .meta-rows .meta-row:first-child{border-top:0}
.meta-detail-title{font-size:20px;font-weight:800;letter-spacing:-.01em;line-height:1.25}
.meta-detail-title.done{text-decoration:line-through;color:var(--muted)}
.meta-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.meta-pchips{display:flex;gap:6px;margin-top:10px}
.meta-pchips button{flex:1;padding:8px 0;border-radius:10px;background:var(--card-2);border:1px solid var(--line);font-weight:700;font-size:13px;color:var(--muted)}
.meta-pchips button.active{background:var(--accent);color:var(--accent-ink);border-color:transparent}
.meta-money{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.meta-money > div{background:var(--card-2);border-radius:12px;padding:10px;min-width:0}
.meta-money .t{font-size:11px;color:var(--muted)}
.meta-money .v{font-size:15px;font-weight:800;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta-linked{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px;border-radius:12px;background:var(--card-2);width:100%;text-align:left}
.meta-mslist{display:flex;flex-direction:column}
.meta-ms{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line)}
.meta-ms:first-child{border-top:0}
.meta-ms .txt{flex:1;min-width:0;font-size:15px;line-height:1.3}
.meta-ms.done .txt{text-decoration:line-through;color:var(--muted)}
.meta-ms .mini{width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
.meta-ms .mini svg{width:16px;height:16px}
.meta-ms .mini:disabled{opacity:.25;cursor:default}
.meta-hchips{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.meta-hchips button{padding:12px 12px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-weight:600;text-align:left;font-size:14px;color:var(--text)}
.meta-hchips button.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);color:var(--accent)}
.meta-hchips button .s{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:2px}
`,
});
