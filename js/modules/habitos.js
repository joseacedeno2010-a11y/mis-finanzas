'use strict';
/* Módulo Hábitos: seguimiento diario con rachas, metas mensuales y panel del mes.
   Colecciones propias: habits, habitLogs (ver docs/MODULOS.md). */
const Habitos = {
  SUGGESTIONS: [
    { icon:'😴', name:'Dormir 8h' }, { icon:'🧘', name:'Meditar' }, { icon:'🏋️', name:'Ejercicio' },
    { icon:'📚', name:'Leer' }, { icon:'💧', name:'Beber agua' }, { icon:'✍️', name:'Escribir' },
  ],
  EMOJIS: ['✅', '😴', '🧘', '🏋️', '📚', '💧', '✍️', '🚶', '🥗', '🚭', '💊', '🧹', '💰', '🎸', '🧠', '🌅', '🙏', '📵'],
  DAYS: [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']],   // orden de la semana: lunes a domingo
  DAY_LETTER: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],                                  // por getDay()
  MOTIVATION: ['¡Todo listo por hoy! 🎉', 'Día completo. Así se construyen las rachas 🔥', '¡Lo hiciste! Mañana otra vez 💪', 'Constancia pura. Bien hecho ✨', 'Un día más a tu favor 🙌'],
  MILESTONES: [3, 7, 14, 21, 30, 50, 100, 200, 365],
  _scrollLeft: null,

  /* ---------- datos ---------- */
  all(){ return Store.list('habits'); },
  sorted(list){ return list.sort((a,b)=>(a.order || 0) - (b.order || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); },
  active(){ return this.sorted(this.all().filter(h=>!h.archived)); },
  archived(){ return this.sorted(this.all().filter(h=>h.archived)); },
  get(id){ return this.all().find(h=>h.id===id); },
  logs(){ return Store.list('habitLogs'); },
  key(id, date){ return id + '|' + date; },
  doneSet(){ const s = new Set(); for (const l of this.logs()) if (l.done!==false) s.add(this.key(l.habitId, l.date)); return s; },
  activeOn(h, iso){ const days = h.days || []; return !days.length || days.includes(parseISO(iso).getDay()); },
  since(h){ return String(h.createdAt || '').slice(0, 10); },
  color(h){ return /^#[0-9a-f]{3,8}$/i.test(h.color || '') ? h.color : colorFor(h.name || ''); },
  toggle(id, date){
    if (!date || date > todayISO() || !this.get(id)) return false;
    const existing = this.logs().find(l=>l.habitId===id && l.date===date);
    if (existing) Store.remove('habitLogs', existing.id);
    else Store.upsert('habitLogs', { id: uid(), habitId: id, date, done: true });
    return !existing;
  },
  removeHabit(id){ Store.data.habitLogs = this.logs().filter(l=>l.habitId!==id); Store.remove('habits', id); },
  move(id, dir){
    const list = this.active(); const i = list.findIndex(h=>h.id===id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const [item] = list.splice(i, 1); list.splice(j, 0, item);
    list.forEach((h, k)=>{ h.order = k + 1; });
    Store.save();
  },

  /* ---------- fechas ---------- */
  addDays(iso, n){ const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); },
  daysInMonth(key){ const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); },
  monthDates(key){ const n = this.daysInMonth(key); const out = []; for (let i = 1; i <= n; i++) out.push(`${key}-${pad2(i)}`); return out; },
  weekIndex(iso){ const d = parseISO(iso); const fdow = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7; return Math.floor((d.getDate() - 1 + fdow) / 7); },
  mondayOf(iso){ const d = parseISO(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return toISO(d); },

  /* ---------- estadísticas ---------- */
  firstLogDate(h){ let min = null; for (const l of this.logs()) if (l.habitId===h.id && (!min || l.date < min)) min = l.date; return min; },
  /* racha actual: hacia atrás desde hoy (o desde ayer si hoy aún no se cumplió), solo días activos del hábito */
  streak(h, set, today = todayISO()){
    const first = this.firstLogDate(h); if (!first) return 0;
    let d = today, n = 0;
    if (this.activeOn(h, d) && !set.has(this.key(h.id, d))) d = this.addDays(d, -1);
    while (d >= first){
      if (this.activeOn(h, d)){ if (set.has(this.key(h.id, d))) n++; else break; }
      d = this.addDays(d, -1);
    }
    return n;
  },
  bestStreak(h, set, today = todayISO()){
    const first = this.firstLogDate(h); if (!first) return 0;
    let d = first, run = 0, best = 0;
    while (d <= today){
      if (this.activeOn(h, d)){ if (set.has(this.key(h.id, d))){ run++; if (run > best) best = run; } else if (d < today) run = 0; }
      d = this.addDays(d, 1);
    }
    return best;
  },
  /* racha global: días seguidos en que TODOS los hábitos activos de ese día estaban cumplidos */
  globalStreak(habits, set, today = todayISO()){
    if (!habits.length) return 0;
    let first = null; for (const h of habits){ const f = this.firstLogDate(h); if (f && (!first || f < first)) first = f; }
    if (!first) return 0;
    const state = d=>{ const act = habits.filter(h=>this.activeOn(h, d) && this.since(h) <= d); if (!act.length) return null; return act.every(h=>set.has(this.key(h.id, d))); };
    let d = today, n = 0;
    if (state(d)===false) d = this.addDays(d, -1);
    while (d >= first){ const st = state(d); if (st===false) break; if (st) n++; d = this.addDays(d, -1); }
    return n;
  },
  monthStats(key, habits, set){
    const today = todayISO(); const dates = this.monthDates(key);
    const perDay = dates.map(d=>({ date: d, done: 0, expected: 0 }));
    let completed = 0, expectedToDate = 0, expectedMonth = 0;
    dates.forEach((d, i)=>{
      for (const h of habits){
        if (set.has(this.key(h.id, d))){ completed++; perDay[i].done++; }
        if (this.activeOn(h, d) && this.since(h) <= d){ expectedMonth++; perDay[i].expected++; if (d <= today) expectedToDate++; }
      }
    });
    const pct = expectedToDate ? Math.min(100, Math.round(completed / expectedToDate * 100)) : 0;
    return { dates, perDay, completed, expectedToDate, expectedMonth, pct, remaining: Math.max(0, expectedMonth - completed), today };
  },
  habitMonth(h, key, set){ let n = 0; for (const d of this.monthDates(key)) if (set.has(this.key(h.id, d))) n++; return n; },
  last30(h, set){
    const today = todayISO(); let exp = 0, done = 0;
    for (let i = 0; i < 30; i++){ const d = this.addDays(today, -i); if (this.activeOn(h, d)){ exp++; if (set.has(this.key(h.id, d))) done++; } }
    return { exp, done, pct: exp ? Math.round(done / exp * 100) : 0 };
  },
  total(h){ return this.logs().filter(l=>l.habitId===h.id).length; },
  suggestGoal(days){ return this.monthDates(thisMonthKey()).filter(d=>!days.length || days.includes(parseISO(d).getDay())).length; },
  motivation(){ return this.MOTIVATION[new Date().getDate() % this.MOTIVATION.length]; },
  afterToggle(id, date, on){
    if (!on || date!==todayISO()) return;
    const set = this.doneSet(); const h = this.get(id); if (!h) return;
    const todays = this.active().filter(x=>this.activeOn(x, date));
    if (todays.length && todays.every(x=>set.has(this.key(x.id, date)))) return UI.toast(this.motivation());
    const s = this.streak(h, set); if (this.MILESTONES.includes(s)) UI.toast(`🔥 ${s} días seguidos con ${h.name}`);
  },

  /* ---------- vistas ---------- */
  monthNav(key){
    const atCurrent = key >= thisMonthKey();
    return `<div class="monthnav"><button data-action="hab-month" data-delta="-1" aria-label="Mes anterior">${UI.icon('left')}</button><button class="m hab-m" data-action="hab-month-today">${fmtMonth(key)}</button><button data-action="hab-month" data-delta="1" aria-label="Mes siguiente" ${atCurrent ? 'disabled' : ''}>${UI.icon('chevron')}</button></div>`;
  },
  viewPanel(){
    const S = App.state; if (!S.hab_month || S.hab_month > thisMonthKey()) S.hab_month = thisMonthKey();
    const key = S.hab_month; const set = this.doneSet(); const habits = this.active(); const arch = this.archived();
    let html = `<div class="topbar"><h1>Hábitos</h1><button class="iconbtn" data-action="hab-new" aria-label="Nuevo hábito">${UI.icon('plus')}</button></div>`;
    if (!habits.length){
      html += `<div class="card">${UI.empty('🌱', arch.length ? 'No tienes hábitos activos' : 'Empieza con un hábito', arch.length ? 'Restaura uno archivado o crea uno nuevo.' : 'Elige algo pequeño que quieras repetir. Marca cada día que lo cumplas y verás crecer tu racha.')}<button class="btn" data-action="hab-new">${UI.icon('plus')} ${arch.length ? 'Nuevo hábito' : 'Crear mi primer hábito'}</button></div>`;
      return html + this.archivedList(arch, set);
    }
    const st = this.monthStats(key, habits, set);
    const isCur = key===thisMonthKey(); const dim = st.dates.length; const dayN = isCur ? new Date().getDate() : dim;
    const gs = this.globalStreak(habits, set);
    html += this.monthNav(key);
    html += `<div class="hero"><div class="label">Cumplimiento de ${fmtMonth(key).toLowerCase()}</div><div class="big">${st.pct}%</div>
      <div class="sub">${isCur ? `Día ${dayN} de ${dim}` : `${dim} días`} · <b>${st.completed}</b> de ${st.expectedToDate} marcas${isCur ? ' hasta hoy' : ''}</div>
      <div class="progress hero-progress"><div class="ok" style="width:${st.pct}%"></div></div>
      <div class="hero-tiles"><div class="hero-tile"><div class="t">${UI.icon('check')} Completados</div><div class="v">${st.completed}</div></div><div class="hero-tile"><div class="t">${UI.icon('calendar')} Restantes</div><div class="v">${st.remaining}</div></div><div class="hero-tile ${gs ? 'pos' : ''}"><div class="t">🔥 Racha</div><div class="v">${gs} día${gs===1 ? '' : 's'}</div></div></div></div>`;
    html += `<div class="card"><div class="card-head"><h3>Progreso del mes</h3><span class="muted small">hábitos cumplidos por día</span></div>${this.chart(st, habits.length)}</div>`;
    const edit = !!S.hab_edit;
    html += `<div class="section-title"><h2>Hábitos diarios</h2><button class="link" data-action="hab-organize">${edit ? 'Listo' : 'Organizar'}</button></div>`;
    html += `<div class="card tight hab-card"><div class="hab-scroll">${this.grid(habits, st, set, edit)}</div>${edit ? '<div class="xs muted" style="padding:8px 16px 4px">Usa las flechas para cambiar el orden y 📦 para archivar sin perder el historial.</div>' : '<div class="xs muted" style="padding:8px 16px 4px">Toca una casilla para marcar el día. Las casillas punteadas son días en que ese hábito no toca.</div>'}</div>`;
    return html + this.archivedList(arch, set);
  },
  grid(habits, st, set, edit){
    const today = st.today; const key = st.dates[0].slice(0, 7);
    const head = st.dates.map(d=>{ const dt = parseISO(d); return `<th class="${d===today ? 'today' : ''}${this.weekIndex(d) % 2 ? ' wk' : ''}"><span class="d">${dt.getDate()}</span>${this.DAY_LETTER[dt.getDay()]}</th>`; }).join('');
    const rows = habits.map((h, i)=>{
      const n = this.habitMonth(h, key, set); const goal = Number(h.goalPerMonth) || 0; const s = this.streak(h, set); const b = this.bestStreak(h, set); const color = this.color(h);
      const pct = goal ? Math.min(100, Math.round(n / goal * 100)) : 0;
      const cells = st.dates.map(d=>{
        const on = set.has(this.key(h.id, d)); const off = !this.activeOn(h, d);
        return `<td class="${this.weekIndex(d) % 2 ? 'wk' : ''}"><button class="hab-cell${on ? ' on' : ''}${off ? ' off' : ''}${d===today ? ' today' : ''}" data-action="hab-toggle" data-id="${h.id}" data-date="${d}" ${d > today ? 'disabled' : ''} aria-label="${esc(h.name)} · ${fmtDate(d, 'short')}">${UI.icon('check')}</button></td>`;
      }).join('');
      const tools = edit
        ? `<div class="hab-tools"><button data-action="hab-move" data-id="${h.id}" data-dir="-1" ${i===0 ? 'disabled' : ''} aria-label="Subir">${UI.icon('up')}</button><button data-action="hab-move" data-id="${h.id}" data-dir="1" ${i===habits.length - 1 ? 'disabled' : ''} aria-label="Bajar">${UI.icon('down')}</button><button data-action="hab-archive" data-id="${h.id}" aria-label="Archivar" title="Archivar">📦</button></div>`
        : `<div class="hab-meta">${goal ? `${n}/${goal}` : `${n} veces`} · 🔥 ${s}${b > s ? ` · 🏆 ${b}` : ''}</div><div class="progress hab-prog"><div style="width:${pct}%;background:${color}"></div></div>`;
      return `<tr style="--hc:${color}"><td class="hab-name"><button class="hab-nm" data-go="#/habitos/${h.id}"><span class="hab-emoji">${esc(h.icon || '✅')}</span><span class="ellipsis">${esc(h.name)}</span></button>${tools}</td>${cells}</tr>`;
    }).join('');
    return `<table class="hab-table"><thead><tr><th class="hab-name"></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  },
  chart(st, nHabits){
    const W = 600, H = 170, padL = 8, padR = 8, padT = 24, padB = 22;
    const n = st.dates.length; const bw = (W - padL - padR) / n; const innerH = H - padT - padB; const y0 = padT + innerH;
    const max = Math.max(1, nHabits, ...st.perDay.map(p=>p.done));
    const todayDay = st.dates.indexOf(st.today) + 1;
    const yAll = y0 - nHabits / max * innerH;
    let out = `<line x1="${padL}" x2="${W - padR}" y1="${yAll.toFixed(1)}" y2="${yAll.toFixed(1)}" stroke="var(--line)" stroke-dasharray="4 4"/><text x="${W - padR}" y="${(yAll - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">todos (${nHabits})</text>`;
    st.perDay.forEach((p, i)=>{
      const x = padL + i * bw; const day = i + 1; const isToday = p.date===st.today; const future = p.date > st.today;
      if (!future){
        const h = p.done / max * innerH; const full = p.expected > 0 && p.done >= p.expected;
        out += `<rect x="${(x + bw * 0.2).toFixed(1)}" y="${(y0 - Math.max(h, 1.5)).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="3" fill="var(--accent)" opacity="${full ? 1 : 0.45}"/>`;
        if (isToday && p.done) out += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y0 - h - 5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${p.done}</text>`;
      }
      const showNum = isToday || ((day===1 || day % 5===0) && (!todayDay || Math.abs(day - todayDay) > 1));
      if (showNum) out += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" font-weight="${isToday ? 700 : 400}" fill="${isToday ? 'var(--accent)' : 'var(--muted)'}">${day}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="${padL}" x2="${W - padR}" y1="${y0}" y2="${y0}" stroke="var(--line)"/>${out}</svg>`;
  },
  archivedList(arch, set){
    if (!arch.length) return '';
    const open = !!App.state.hab_showArchived;
    let html = `<div class="card tight"><button class="item clickable" data-action="hab-toggle-archived"><div class="ic">📦</div><div class="body"><div class="title">Archivados</div><div class="sub">${arch.length} hábito${arch.length===1 ? '' : 's'} · toca para ${open ? 'ocultar' : 'ver'}</div></div><span class="chev ${open ? 'open' : ''}">${UI.icon('chevron')}</span></button>`;
    if (open) html += `<div class="sublist">${arch.map(h=>`<div class="item"><button class="ic" data-go="#/habitos/${h.id}" style="background:${this.color(h)}22">${esc(h.icon || '✅')}</button><button class="body" data-go="#/habitos/${h.id}" style="text-align:left"><div class="title ellipsis">${esc(h.name)}</div><div class="sub">${this.total(h)} marcas en total · mejor racha ${this.bestStreak(h, set)}</div></button><button class="btn secondary sm" data-action="hab-archive" data-id="${h.id}">Restaurar</button></div>`).join('')}</div>`;
    return html + '</div>';
  },
  viewOne(id){
    const h = this.get(id);
    if (!h) return Views.back('#/habitos', 'Hábito') + `<div class="card">${UI.empty('🤷', 'Hábito no encontrado')}</div>`;
    const S = App.state; if (!S.hab_month || S.hab_month > thisMonthKey()) S.hab_month = thisMonthKey(); const key = S.hab_month;
    const set = this.doneSet(); const color = this.color(h);
    const s = this.streak(h, set), b = this.bestStreak(h, set), tot = this.total(h), l30 = this.last30(h, set);
    const days = (h.days || []).length ? this.DAYS.filter(([d])=>h.days.includes(d)).map(([, l])=>l).join(' ') : 'Todos los días';
    const n = this.habitMonth(h, key, set); const goal = Number(h.goalPerMonth) || 0; const met = goal && n >= goal;
    let html = Views.back('#/habitos', h.name, `<button class="iconbtn" data-action="hab-edit" data-id="${id}" aria-label="Editar">${UI.icon('edit')}</button>`);
    html += `<div class="hero" style="background:linear-gradient(160deg,${color} 0%,color-mix(in srgb,${color} 55%,#0b1220) 100%);box-shadow:0 8px 24px color-mix(in srgb,${color} 30%,transparent)">
      <div class="row" style="margin-bottom:8px"><div class="hab-big-emoji">${esc(h.icon || '✅')}</div><div class="grow"><div class="label" style="font-size:16px;font-weight:700;opacity:1">${esc(h.name)}${h.archived ? ' <span class="badge" style="background:rgba(255,255,255,.2);color:#fff">archivado</span>' : ''}</div><div class="sub">${days} · meta ${goal ? goal + ' al mes' : 'libre'}</div></div></div>
      <div class="big">${l30.pct}%</div><div class="sub">últimos 30 días · ${l30.done} de ${l30.exp} veces</div>
      <div class="hero-tiles"><div class="hero-tile"><div class="t">🔥 Racha</div><div class="v">${s} día${s===1 ? '' : 's'}</div></div><div class="hero-tile"><div class="t">🏆 Mejor</div><div class="v">${b} día${b===1 ? '' : 's'}</div></div><div class="hero-tile"><div class="t">${UI.icon('check')} Total</div><div class="v">${tot}</div></div></div></div>`;
    html += this.monthNav(key);
    html += `<div class="card"><div class="card-head"><h3>${fmtMonth(key)}</h3><span class="small ${met ? 'green bold' : 'muted'}">${goal ? `${n} de ${goal}` : `${n} veces`}${met ? ' · meta cumplida 🎉' : ''}</span></div>${goal ? `<div class="progress" style="margin:0 0 14px"><div style="width:${Math.min(100, n / goal * 100)}%;background:${color}"></div></div>` : ''}${this.calendar(h, key, set)}</div>`;
    html += `<div class="card"><div class="card-head"><h3>Últimas 12 semanas</h3><span class="muted small">una columna por semana</span></div>${this.heat(h, set)}</div>`;
    html += `<div class="btnrow"><button class="btn secondary" data-action="hab-edit" data-id="${id}">${UI.icon('edit')} Editar</button><button class="btn secondary" data-action="hab-archive" data-id="${id}">${h.archived ? '♻️ Restaurar' : '📦 Archivar'}</button></div>`;
    return html;
  },
  calendar(h, key, set){
    const dates = this.monthDates(key); const today = todayISO(); const lead = (parseISO(dates[0]).getDay() + 6) % 7;
    let cells = this.DAYS.map(([, l])=>`<div class="h">${l}</div>`).join('');
    for (let i = 0; i < lead; i++) cells += '<div></div>';
    for (const d of dates){ const on = set.has(this.key(h.id, d)); const off = !this.activeOn(h, d); cells += `<button class="hab-cell${on ? ' on' : ''}${off ? ' off' : ''}${d===today ? ' today' : ''}" data-action="hab-toggle" data-id="${h.id}" data-date="${d}" ${d > today ? 'disabled' : ''} aria-label="${fmtDate(d, 'short')}">${parseISO(d).getDate()}</button>`; }
    return `<div class="hab-cal" style="--hc:${this.color(h)}">${cells}</div>`;
  },
  heat(h, set){
    const today = todayISO(); const start = this.mondayOf(this.addDays(today, -77));
    let cells = '';
    for (let i = 0; i < 84; i++){ const d = this.addDays(start, i); const cls = d > today ? 'future' : set.has(this.key(h.id, d)) ? 'on' : this.activeOn(h, d) ? '' : 'off'; cells += `<i class="${cls}" title="${fmtDate(d)}"></i>`; }
    return `<div class="hab-heat" style="--hc:${this.color(h)}">${cells}</div>`;
  },

  /* ---------- tarjeta de Inicio ---------- */
  homeCard(){
    const today = todayISO(); const habits = this.active();
    const head = `<div class="card-head"><h3>✅ Hábitos de hoy</h3><a class="link" href="#/habitos">Ver panel</a></div>`;
    if (!habits.length) return `<div class="card">${head}${UI.empty('🌱', 'Aún no tienes hábitos', 'Crea el primero y márcalo cada día que lo cumplas.')}<button class="btn" data-action="hab-new">${UI.icon('plus')} Crear hábito</button></div>`;
    const set = this.doneSet(); const todays = habits.filter(h=>this.activeOn(h, today));
    if (!todays.length) return `<div class="card">${head}<div class="small muted">Hoy no toca ningún hábito. Descansa 😌</div></div>`;
    const done = todays.filter(h=>set.has(this.key(h.id, today))).length; const pct = Math.round(done / todays.length * 100); const all = done===todays.length;
    let html = `<div class="card">${head}<div class="row between"><span class="semibold">${done} de ${todays.length} <span class="muted small">· ${pct}%</span></span><span class="small ${all ? 'green semibold' : 'muted'}">${all ? 'Día completo' : `${todays.length - done} por hacer`}</span></div><div class="progress"><div style="width:${pct}%${all ? ';background:var(--green)' : ''}"></div></div>`;
    html += `<div class="list hab-today">${todays.map(h=>{ const on = set.has(this.key(h.id, today)); const s = this.streak(h, set); return `<button class="item${on ? ' hab-done' : ''}" style="--hc:${this.color(h)}" data-action="hab-toggle" data-id="${h.id}" data-date="${today}"><span class="hab-check${on ? ' on' : ''}">${UI.icon('check')}</span><span class="hab-emoji">${esc(h.icon || '✅')}</span><div class="body"><div class="title ellipsis">${esc(h.name)}</div></div>${s ? `<span class="badge ${on ? 'g' : ''}">🔥 ${s}</span>` : ''}</button>`; }).join('')}</div>`;
    if (all) html += `<div class="hab-cheer">${this.motivation()}</div>`;
    return html + '</div>';
  },

  /* ---------- formulario ---------- */
  form(h = null){
    const editing = !!h; const first = !this.all().length;
    let color = (h && this.color(h)) || ACCOUNT_COLORS[this.all().length % ACCOUNT_COLORS.length];
    let days = h ? [...(h.days || [])] : [];
    const suggest = ()=>this.suggestGoal(days);
    let touched = editing && Number(h.goalPerMonth)!==suggest();
    const s = UI.sheet({ title: editing ? 'Editar hábito' : 'Nuevo hábito', html: `
      ${first ? `<div class="small muted" style="margin-bottom:6px">Ideas para empezar</div><div class="chips mb">${this.SUGGESTIONS.map((x, i)=>`<button type="button" class="chip" data-sug="${i}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>` : ''}
      <div class="icon-preview"><div class="hab-prev" data-prev>${esc(h ? h.icon || '✅' : '✅')}</div><div class="grow"><div class="semibold" data-nameprev>${esc(h ? h.name : 'Nuevo hábito')}</div><div class="small muted">Así se verá en tu panel</div></div></div>
      <div class="hab-two"><div class="field"><label>Emoji</label><input name="icon" value="${esc(h ? h.icon || '' : '')}" placeholder="✅" maxlength="4" autocomplete="off"></div><div class="field"><label>Nombre</label><input name="name" value="${esc(h ? h.name : '')}" placeholder="Ej. Leer 20 minutos" ${first ? '' : 'autofocus'}></div></div>
      <div class="chips mb" data-emojis>${this.EMOJIS.map(e=>`<button type="button" class="chip hab-echip" data-emoji="${e}">${e}</button>`).join('')}</div>
      <div class="field"><label>Color</label><div class="palette" data-palette>${ACCOUNT_COLORS.map(c=>`<button type="button" data-color="${c}" class="${c===color ? 'sel' : ''}" style="background:${c}" aria-label="Color"></button>`).join('')}</div></div>
      <div class="field"><label>Días de la semana</label><div class="hab-days" data-days>${this.DAYS.map(([d, l])=>`<button type="button" class="hab-day${days.includes(d) ? ' on' : ''}" data-d="${d}">${l}</button>`).join('')}</div><div class="hint" data-dayshint></div></div>
      <div class="field"><label>Meta mensual (veces al mes)</label><input name="goal" inputmode="numeric" autocomplete="off" value="${h ? Number(h.goalPerMonth) || 0 : suggest()}"><div class="hint" data-goalhint></div></div>
      <button class="btn" data-save>${editing ? 'Guardar cambios' : 'Crear hábito'}</button>
      ${editing ? '<button class="btn danger mt" data-del>Eliminar hábito</button>' : ''}` });
    const f = s.body;
    const iconEl = f.querySelector('[name=icon]'), nameEl = f.querySelector('[name=name]'), goalEl = f.querySelector('[name=goal]');
    const prev = ()=>{
      const p = f.querySelector('[data-prev]'); p.textContent = iconEl.value.trim() || '✅'; p.style.background = color + '22'; p.style.color = color;
      f.querySelector('[data-nameprev]').textContent = nameEl.value.trim() || 'Nuevo hábito';
      f.querySelectorAll('[data-emoji]').forEach(b=>b.classList.toggle('active', b.dataset.emoji===iconEl.value.trim()));
    };
    const hints = ()=>{
      f.querySelector('[data-dayshint]').textContent = days.length ? `${days.length} día${days.length===1 ? '' : 's'} a la semana` : 'Sin selección = todos los días';
      f.querySelector('[data-goalhint]').textContent = `Sugerido: ${suggest()} (días activos de este mes)`;
      if (!touched) goalEl.value = suggest();
    };
    iconEl.addEventListener('input', prev); nameEl.addEventListener('input', prev);
    goalEl.addEventListener('input', ()=>{ touched = true; });
    f.querySelector('[data-emojis]').onclick = e=>{ const b = e.target.closest('[data-emoji]'); if (!b) return; iconEl.value = b.dataset.emoji; prev(); };
    f.querySelector('[data-palette]').onclick = e=>{ const b = e.target.closest('[data-color]'); if (!b) return; color = b.dataset.color; f.querySelectorAll('[data-palette] button').forEach(x=>x.classList.toggle('sel', x===b)); prev(); };
    f.querySelector('[data-days]').onclick = e=>{ const b = e.target.closest('[data-d]'); if (!b) return; const d = Number(b.dataset.d); days = days.includes(d) ? days.filter(x=>x!==d) : days.concat(d); b.classList.toggle('on', days.includes(d)); hints(); };
    f.addEventListener('click', e=>{ const b = e.target.closest('[data-sug]'); if (!b) return; const x = this.SUGGESTIONS[+b.dataset.sug]; iconEl.value = x.icon; nameEl.value = x.name; f.querySelectorAll('[data-sug]').forEach(c=>c.classList.toggle('active', c===b)); prev(); });
    prev(); hints();
    f.querySelector('[data-save]').onclick = ()=>{
      const name = nameEl.value.trim(); if (!name) return UI.toast('Escribe un nombre', true);
      const goal = parseInt(goalEl.value, 10); if (!(goal >= 0)) return UI.toast('La meta debe ser un número', true);
      const order = editing ? (h.order || 0) : this.all().reduce((m, x)=>Math.max(m, x.order || 0), 0) + 1;
      const saved = Store.upsert('habits', { id: editing ? h.id : uid(), name, icon: iconEl.value.trim() || '✅', color, goalPerMonth: goal, days: [...days].sort((a, b)=>a - b), order, archived: editing ? !!h.archived : false, createdAt: editing ? (h.createdAt || new Date().toISOString()) : new Date().toISOString() });
      s.close(); App.render(); UI.toast(editing ? 'Hábito guardado' : `Hábito creado ${saved.icon} ¡A por ello!`);
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{
      if (!(await UI.confirm(`¿Eliminar "${h.name}" y todo su historial?`))) return;
      this.removeHabit(h.id); s.close();
      if (location.hash.startsWith('#/habitos/')) App.go('#/habitos'); App.render(); UI.toast('Hábito eliminado');
    };
  },
};

App.registerModule({
  id: 'habitos',
  name: 'Hábitos',
  icon: 'check',
  tab: { hash:'#/habitos', label:'Hábitos', icon:'check', order:10 },
  collections: ['habits', 'habitLogs'],
  routes: [
    [/^#\/habitos$/, ()=>Habitos.viewPanel(), 'habitos'],
    [/^#\/habitos\/([\w-]+)$/, m=>Habitos.viewOne(m[1]), 'habitos'],
  ],
  menu: [{ hash:'#/habitos', icon:'check', label:'Hábitos' }],
  homeCards: [{ order: 20, render: ()=>Habitos.homeCard() }],
  fab: [{ label:'Nuevo hábito', sub:'Algo que quieres repetir cada día', icon:'check', cls:'g', run(){ Habitos.form(); } }],
  actions: {
    'hab-toggle'(d, el){ const sc = el.closest('.hab-scroll'); if (sc) Habitos._scrollLeft = sc.scrollLeft; const on = Habitos.toggle(d.id, d.date); App.render(); Habitos.afterToggle(d.id, d.date, on); },
    'hab-new'(){ Habitos.form(); },
    'hab-edit'(d){ const h = Habitos.get(d.id); if (h) Habitos.form(h); },
    'hab-month'(d){ const next = shiftMonth(App.state.hab_month || thisMonthKey(), Number(d.delta)); if (next > thisMonthKey()) return; App.state.hab_month = next; Habitos._scrollLeft = null; App.render(); },
    'hab-month-today'(){ App.state.hab_month = thisMonthKey(); Habitos._scrollLeft = null; App.render(); },
    'hab-organize'(){ App.state.hab_edit = !App.state.hab_edit; App.render(); },
    'hab-toggle-archived'(){ App.state.hab_showArchived = !App.state.hab_showArchived; App.render(); },
    'hab-move'(d, el){ const sc = el.closest('.hab-scroll'); if (sc) Habitos._scrollLeft = sc.scrollLeft; Habitos.move(d.id, Number(d.dir)); App.render(); },
    'hab-archive'(d){ const h = Habitos.get(d.id); if (!h) return; const was = !!h.archived; Store.upsert('habits', { id: h.id, archived: !was }); if (!was) App.state.hab_showArchived = true; App.render(); UI.toast(was ? 'Hábito restaurado' : 'Hábito archivado'); },
  },
  init(){ App.state.hab_month = thisMonthKey(); },
  afterRender(hash){
    if (hash!=='#/habitos') return;
    const sc = document.querySelector('.hab-scroll'); if (!sc) return;
    if (Habitos._scrollLeft!=null){ sc.scrollLeft = Habitos._scrollLeft; Habitos._scrollLeft = null; return; }
    const t = sc.querySelector('th.today'); if (t) sc.scrollLeft = Math.max(0, t.offsetLeft - sc.clientWidth * 0.6);
  },
  css: `
/* cuadrícula del mes */
.hab-card{overflow:hidden}
.hab-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;position:relative}
.hab-table{border-collapse:separate;border-spacing:0}
.hab-table th,.hab-table td{padding:0 1px;text-align:center;vertical-align:middle;min-width:33px}
.hab-table thead th{font-size:10px;font-weight:600;color:var(--muted);line-height:1.15;padding:4px 1px 5px;border-bottom:1px solid var(--line);position:relative}
.hab-table thead th .d{display:block;font-size:12px;font-weight:700;color:var(--text)}
.hab-table thead th.today .d{color:var(--accent)}
.hab-table thead th.today::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--accent)}
.hab-table .wk{background:color-mix(in srgb,var(--text) 4%,transparent)}
.hab-table tbody td{border-bottom:1px solid var(--line)}
.hab-table tbody tr:last-child td{border-bottom:0}
.hab-table .hab-name{position:sticky;left:0;z-index:2;background:var(--card);text-align:left;min-width:142px;max-width:164px;padding:6px 8px 6px 14px;box-shadow:8px 0 10px -8px rgba(0,0,0,.25)}
.hab-nm{display:flex;align-items:center;gap:6px;width:100%;text-align:left;font-weight:600;font-size:14px;color:var(--text);min-width:0}
.hab-nm .ellipsis{min-width:0;flex:1}
.hab-emoji{font-size:18px;flex:none;width:24px;text-align:center;line-height:1}
.hab-meta{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap}
.hab-prog{height:3px;margin-top:4px}
.hab-tools{display:flex;gap:4px;margin-top:4px}
.hab-tools button{width:32px;height:26px;border-radius:7px;background:var(--card-2);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:var(--text)}
.hab-tools button:disabled{opacity:.3}
.hab-tools svg{width:13px;height:13px}
.hab-cell{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--line);margin:3px auto;display:flex;align-items:center;justify-content:center;color:#fff;background:transparent;transition:transform .1s,background .15s;font-size:12px;font-weight:600}
.hab-cell svg{width:14px;height:14px;opacity:0}
.hab-cell.on{background:var(--hc,var(--accent));border-color:var(--hc,var(--accent))}
.hab-cell.on svg{opacity:1}
.hab-cell.off{opacity:.35;border-style:dashed}
.hab-cell.on.off{opacity:.65;border-style:solid}
.hab-cell:disabled{opacity:.18;cursor:default}
.hab-cell.today{outline:2px solid var(--accent);outline-offset:1px}
.hab-cell:not(:disabled):active{transform:scale(.88)}
.monthnav .hab-m{width:auto;padding:0 12px;font-weight:700}
.monthnav button:disabled{opacity:.3}
/* tarjeta de inicio */
.hab-today .item{padding:10px 0;gap:10px}
.hab-today .item:last-child{border-bottom:0}
.hab-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:inline-flex;align-items:center;justify-content:center;color:#fff;flex:none;transition:background .15s}
.hab-check svg{width:14px;height:14px;opacity:0}
.hab-check.on{background:var(--hc,var(--accent));border-color:var(--hc,var(--accent))}
.hab-check.on svg{opacity:1}
.hab-done .title{text-decoration:line-through;color:var(--muted)}
.hab-cheer{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--green-soft);color:var(--green);font-weight:600;font-size:14px;text-align:center}
/* detalle */
.hab-big-emoji{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:26px;flex:none}
.hab-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;justify-items:center}
.hab-cal .h{font-size:11px;color:var(--muted);font-weight:600;text-align:center}
.hab-cal .hab-cell{width:100%;max-width:40px;aspect-ratio:1;height:auto;margin:0;color:var(--text);font-size:13px}
.hab-cal .hab-cell.on{color:#fff}
.hab-cal .hab-cell.off:not(.on){color:var(--muted)}
.hab-heat{display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(7,1fr);grid-auto-flow:column;gap:4px}
.hab-heat i{display:block;aspect-ratio:1;border-radius:4px;background:var(--line)}
.hab-heat i.on{background:var(--hc,var(--accent))}
.hab-heat i.off{opacity:.35}
.hab-heat i.future{opacity:0}
/* formulario */
.hab-prev{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}
.hab-two{display:grid;grid-template-columns:88px 1fr;gap:10px}
.hab-echip{padding:5px 9px;font-size:17px}
.hab-days{display:flex;gap:6px;justify-content:space-between}
.hab-day{width:40px;height:40px;border-radius:50%;background:var(--card-2);border:1px solid var(--line);font-weight:700;font-size:13px;color:var(--muted);flex:none}
.hab-day.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
`,
});
