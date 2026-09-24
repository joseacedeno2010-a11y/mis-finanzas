'use strict';
/* Logros y rachas: lee las colecciones de los demás módulos (solo lectura) y desbloquea logros.
   Colección propia: achievements { id, key, unlockedAt } */
const Logros = {
  CATS: ['Hábitos', 'Ritual', 'Enfoque', 'Tareas', 'Metas', 'Diario', 'Finanzas'],
  CAT_ICON: { 'Hábitos':'🔥', Ritual:'🌅', Enfoque:'🎯', Tareas:'☑️', Metas:'🏁', Diario:'📓', Finanzas:'💰' },
  _lastCheck: 0,
  _rendering: false,

  /* ---------- utilidades de fecha ---------- */
  shiftDay(iso, n){ const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); },
  /* 'YYYY-MM-DD' o marca de tiempo ISO → 'YYYY-MM-DD' local; null si no sirve */
  dateOf(v){
    if (!v) return null;
    if (typeof v==='string' && v.length===10 && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v); return isNaN(d) ? null : toISO(d);
  },
  /* lunes de la semana de esa fecha */
  weekStart(iso){ const d = parseISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toISO(d); },
  /* racha actual sobre un Set de fechas: días seguidos hasta hoy (o hasta ayer si hoy aún no hay marca) */
  currentStreak(set){
    let d = todayISO(); if (!set.has(d)) d = this.shiftDay(d, -1);
    let n = 0; while (set.has(d) && n < 5000){ n++; d = this.shiftDay(d, -1); }
    return n;
  },
  bestStreak(set){
    const dates = [...set].sort(); let best = 0, run = 0, prev = null;
    for (const d of dates){ run = prev && this.shiftDay(prev, 1)===d ? run + 1 : 1; if (run > best) best = run; prev = d; }
    return best;
  },
  fmtMin(min, compact){
    min = Math.round(Number(min) || 0);
    if (min < 60) return min + (compact ? ' m' : ' min');
    const h = Math.floor(min / 60), r = min % 60;
    if (compact) return (r ? (min / 60).toFixed(1).replace('.0', '') : h) + ' h';
    return r ? `${h} h ${r} min` : `${h} h`;
  },

  /* ---------- rachas de hábitos ----------
     Un día está "completo" si todos los hábitos activos programados ese día (según h.days y su fecha de creación) tienen marca.
     Los días sin hábitos programados no rompen la racha. Hoy no la rompe mientras esté pendiente. */
  habitStreaks(habits, logs){
    const active = habits.filter(h=>h && !h.archived && h.id);
    if (!active.length) return { current:0, best:0 };
    const today = todayISO();
    const doneSet = new Set(logs.filter(l=>l && l.done!==false && l.habitId && l.date).map(l=>l.habitId + '|' + l.date));
    const created = {}; let first = null;
    for (const h of active){ created[h.id] = this.dateOf(h.createdAt); if (created[h.id] && (!first || created[h.id] < first)) first = created[h.id]; }
    for (const l of logs){ if (l && l.date && (!first || l.date < first)) first = l.date; }
    const floor = this.shiftDay(today, -1000);
    if (!first || first > today) first = today;
    if (first < floor) first = floor;
    const state = iso=>{ // 'none' | 'ok' | 'miss'
      const dow = parseISO(iso).getDay(); let due = 0;
      for (const h of active){
        if (created[h.id] && created[h.id] > iso) continue;
        const days = Array.isArray(h.days) ? h.days.map(Number) : [];
        if (days.length && !days.includes(dow)) continue;
        due++;
        if (!doneSet.has(h.id + '|' + iso)) return 'miss';
      }
      return due ? 'ok' : 'none';
    };
    let current = 0, d = today;
    if (state(today)==='miss') d = this.shiftDay(d, -1);
    for (let i=0; i<1100 && d >= first; i++){ const s = state(d); if (s==='miss') break; if (s==='ok') current++; d = this.shiftDay(d, -1); }
    let best = 0, run = 0;
    for (d = first; d <= today; d = this.shiftDay(d, 1)){ const s = state(d); if (s==='miss') run = 0; else if (s==='ok'){ run++; if (run > best) best = run; } }
    return { current, best: Math.max(best, current) };
  },

  /* ---------- motor de métricas (solo lectura de las colecciones) ---------- */
  metrics(){
    const D = Store.data || {};
    const list = c=>{ const a = Store.list(c); return Array.isArray(a) ? a.filter(Boolean) : []; };
    const today = todayISO(); const ws = this.weekStart(today);

    // hábitos
    const habits = list('habits'), habitLogs = list('habitLogs');
    const hs = this.habitStreaks(habits, habitLogs);
    const habitDone = habitLogs.filter(l=>l.done!==false && l.date);

    // ritual
    const ritualLogs = list('ritualLogs'); const ritDone = ritualLogs.filter(l=>l.completed);
    const ritDays = new Set(ritDone.map(l=>this.dateOf(l.date)).filter(Boolean));

    // enfoque
    const focus = list('focusSessions').filter(s=>s.completed);
    const focusDate = s=>this.dateOf(s.date) || this.dateOf(s.startedAt);
    const focusMin = focus.reduce((s,x)=>s + (Number(x.minutes) || 0), 0);

    // tareas
    const tasks = list('tasks'); const doneTasks = tasks.filter(t=>t.done);
    const taskDate = t=>this.dateOf(t.doneAt) || this.dateOf(t.date);
    const weekCounts = {};
    for (const t of doneTasks){ const dt = taskDate(t); if (!dt) continue; const k = this.weekStart(dt); weekCounts[k] = (weekCounts[k] || 0) + 1; }

    // metas
    const goals = list('goals'); const goalsDone = goals.filter(g=>g.done);
    const isQ = h=>/^q[1-4]$/.test(String(h || ''));
    const now = new Date(); const curQ = Math.floor(now.getMonth() / 3) + 1, curY = now.getFullYear();
    const byQ = {};
    for (const g of goals){
      if (!isQ(g.horizon)) continue;
      const y = Number(g.year) || curY, q = Number(String(g.horizon)[1]);
      if (y > curY || (y===curY && q >= curQ)) continue;   // solo trimestres ya terminados
      const k = y + '-' + q; byQ[k] = byQ[k] || { done:0, total:0 }; byQ[k].total++; if (g.done) byQ[k].done++;
    }
    let perfect = { value:0, target:1 };
    for (const k in byQ){ const x = byQ[k]; if (x.done / x.total > perfect.value / perfect.target) perfect = { value:x.done, target:x.total }; }

    // diario
    const journal = list('journal');
    const filled = v=>typeof v==='string' ? !!v.trim() : Array.isArray(v) ? v.length > 0 : false;
    const hasContent = e=>Number(e.mood) > 0 || ['dayQuestionAnswer', 'highlights', 'gratitude', 'notes'].some(k=>filled(e[k]));
    const jDays = new Set(journal.filter(hasContent).map(e=>this.dateOf(e.id) || this.dateOf(e.date)).filter(Boolean));

    // finanzas (colecciones base de la app)
    const txs = D.transactions || [], loans = D.loans || [], people = D.people || [], budgets = D.budgets || [], accounts = D.accounts || [];
    const hasCalc = typeof Calc!=='undefined';
    const isOpen = l=>{ try { return hasCalc ? Calc.loanIsOpen(l) : true; } catch(e){ return true; } };
    const closedLoans = loans.filter(l=>!isOpen(l));
    const lentClosed = closedLoans.filter(l=>l.direction==='lent').length;
    const borrowed = loans.filter(l=>l.direction==='borrowed');
    const debtFree = borrowed.length && !borrowed.some(isOpen) ? 1 : 0;
    const settledPeople = people.filter(p=>{ const pl = loans.filter(l=>l.personId===p.id); return pl.length && !pl.some(isOpen); }).length;
    let budgetMonths = 0;
    if (hasCalc && budgets.length){
      try {
        let key = shiftMonth(thisMonthKey(), -1);
        for (let i=0; i<36; i++){ if (!Calc.monthTxs(key).length) break; if (Calc.budgetSummary(key).left < 0) break; budgetMonths++; key = shiftMonth(key, -1); }
      } catch(e){ budgetMonths = 0; }
    }

    // últimas 4 semanas (lunes a domingo)
    const weeks = [3, 2, 1, 0].map(i=>this.shiftDay(ws, -7 * i)).map(start=>{
      const end = this.shiftDay(start, 6); const inW = d=>!!d && d >= start && d <= end;
      return { start, end,
        habits: habitDone.filter(l=>inW(l.date)).length,
        rituals: ritDone.filter(l=>inW(this.dateOf(l.date))).length,
        focusMin: focus.filter(s=>inW(focusDate(s))).reduce((s,x)=>s + (Number(x.minutes) || 0), 0),
        tasks: doneTasks.filter(t=>inW(taskDate(t))).length };
    });

    return {
      habits: { count: habits.length, active: habits.filter(h=>!h.archived).length, done: habitDone.length, streak: hs.current, best: hs.best },
      ritual: { completed: ritDone.length, streak: this.currentStreak(ritDays), best: this.bestStreak(ritDays) },
      focus: { minutes: focusMin, sessions: focus.length },
      tasks: { done: doneTasks.length, week: weekCounts[ws] || 0, bestWeek: Math.max(0, ...Object.values(weekCounts)) },
      goals: { done: goalsDone.length, quarter: goalsDone.filter(g=>isQ(g.horizon)).length, year: goalsDone.filter(g=>g.horizon==='year').length, dream: goalsDone.filter(g=>g.horizon==='dream').length, perfect },
      journal: { days: jDays.size, streak: this.currentStreak(jDays), best: this.bestStreak(jDays) },
      fin: { txs: txs.length, accounts: accounts.length, loansClosed: closedLoans.length, lentClosed, debtFree, settledPeople, budgetMonths },
      weeks,
    };
  },

  /* ---------- catálogo ---------- progress(m) devuelve { value, target }; desbloqueado cuando value >= target */
  CATALOG: [
    // Hábitos
    { key:'hab_first',       cat:'Hábitos', emoji:'🌱', title:'Primer hábito',        desc:'Creaste tu primer hábito',                                progress: m=>({ value: m.habits.count, target: 1 }) },
    { key:'hab_three',       cat:'Hábitos', emoji:'🧩', title:'Tres en marcha',       desc:'Tienes 3 hábitos activos a la vez',                       progress: m=>({ value: m.habits.active, target: 3 }) },
    { key:'hab_done_10',     cat:'Hábitos', emoji:'✅', title:'10 cumplidos',         desc:'Marcaste 10 hábitos como hechos',                         progress: m=>({ value: m.habits.done, target: 10 }) },
    { key:'hab_done_100',    cat:'Hábitos', emoji:'💯', title:'100 cumplidos',        desc:'100 hábitos hechos. Ya es costumbre',                     progress: m=>({ value: m.habits.done, target: 100 }) },
    { key:'hab_done_500',    cat:'Hábitos', emoji:'🏔️', title:'500 cumplidos',        desc:'500 veces le dijiste que sí a tu hábito',                 progress: m=>({ value: m.habits.done, target: 500 }) },
    { key:'hab_streak_3',    cat:'Hábitos', emoji:'🔥', title:'3 días de racha',      desc:'3 días seguidos con todos tus hábitos hechos',            progress: m=>({ value: m.habits.best, target: 3 }) },
    { key:'hab_streak_7',    cat:'Hábitos', emoji:'🔥', title:'Semana perfecta',      desc:'7 días seguidos con todos tus hábitos hechos',            progress: m=>({ value: m.habits.best, target: 7 }) },
    { key:'hab_streak_30',   cat:'Hábitos', emoji:'🌋', title:'Mes de fuego',         desc:'30 días seguidos sin fallar un hábito',                   progress: m=>({ value: m.habits.best, target: 30 }) },
    { key:'hab_streak_100',  cat:'Hábitos', emoji:'👑', title:'Cien días',            desc:'100 días seguidos. Eres otra persona',                    progress: m=>({ value: m.habits.best, target: 100 }) },
    // Ritual
    { key:'rit_first',       cat:'Ritual',  emoji:'🌅', title:'Primer ritual',        desc:'Completaste un ritual por primera vez',                   progress: m=>({ value: m.ritual.completed, target: 1 }) },
    { key:'rit_10',          cat:'Ritual',  emoji:'☀️', title:'10 rituales',          desc:'10 rituales completados',                                 progress: m=>({ value: m.ritual.completed, target: 10 }) },
    { key:'rit_30',          cat:'Ritual',  emoji:'🌞', title:'30 rituales',          desc:'30 rituales completados',                                 progress: m=>({ value: m.ritual.completed, target: 30 }) },
    { key:'rit_100',         cat:'Ritual',  emoji:'🌟', title:'100 rituales',         desc:'100 rituales. Tu día ya tiene forma',                     progress: m=>({ value: m.ritual.completed, target: 100 }) },
    { key:'rit_streak_7',    cat:'Ritual',  emoji:'📿', title:'Semana de ritual',     desc:'7 días seguidos completando tu ritual',                   progress: m=>({ value: m.ritual.best, target: 7 }) },
    { key:'rit_streak_30',   cat:'Ritual',  emoji:'🧘', title:'Mes de ritual',        desc:'30 días seguidos completando tu ritual',                  progress: m=>({ value: m.ritual.best, target: 30 }) },
    // Enfoque
    { key:'foc_first',       cat:'Enfoque', emoji:'🎯', title:'Primer enfoque',       desc:'Terminaste tu primera sesión de enfoque',                 progress: m=>({ value: m.focus.sessions, target: 1 }) },
    { key:'foc_1h',          cat:'Enfoque', emoji:'⏱️', title:'1 hora de enfoque',    desc:'Acumulaste una hora de trabajo concentrado',              progress: m=>({ value: m.focus.minutes, target: 60 }), fmt: v=>Logros.fmtMin(v) },
    { key:'foc_10h',         cat:'Enfoque', emoji:'🧠', title:'10 horas de enfoque',  desc:'10 horas de concentración acumuladas',                    progress: m=>({ value: m.focus.minutes, target: 600 }), fmt: v=>Logros.fmtMin(v) },
    { key:'foc_50h',         cat:'Enfoque', emoji:'🔬', title:'50 horas de enfoque',  desc:'50 horas de concentración acumuladas',                    progress: m=>({ value: m.focus.minutes, target: 3000 }), fmt: v=>Logros.fmtMin(v) },
    { key:'foc_25s',         cat:'Enfoque', emoji:'🍅', title:'25 sesiones',          desc:'25 sesiones de enfoque terminadas',                       progress: m=>({ value: m.focus.sessions, target: 25 }) },
    // Tareas
    { key:'task_first',      cat:'Tareas',  emoji:'☑️', title:'Primera tarea',        desc:'Terminaste tu primera tarea',                             progress: m=>({ value: m.tasks.done, target: 1 }) },
    { key:'task_10',         cat:'Tareas',  emoji:'📋', title:'10 tareas',            desc:'10 tareas hechas',                                        progress: m=>({ value: m.tasks.done, target: 10 }) },
    { key:'task_100',        cat:'Tareas',  emoji:'🗂️', title:'100 tareas',           desc:'100 tareas hechas. Una máquina',                          progress: m=>({ value: m.tasks.done, target: 100 }) },
    { key:'task_500',        cat:'Tareas',  emoji:'🏭', title:'500 tareas',           desc:'500 tareas hechas',                                       progress: m=>({ value: m.tasks.done, target: 500 }) },
    { key:'task_week_10',    cat:'Tareas',  emoji:'⚡', title:'Semana productiva',    desc:'10 tareas hechas en una misma semana',                    progress: m=>({ value: m.tasks.bestWeek, target: 10 }) },
    // Metas
    { key:'goal_first',      cat:'Metas',   emoji:'🏁', title:'Primera meta',         desc:'Cumpliste tu primera meta',                               progress: m=>({ value: m.goals.done, target: 1 }) },
    { key:'goal_quarter_3',  cat:'Metas',   emoji:'📆', title:'Tres del trimestre',   desc:'3 metas de trimestre cumplidas',                          progress: m=>({ value: m.goals.quarter, target: 3 }) },
    { key:'goal_year_first', cat:'Metas',   emoji:'🗓️', title:'Meta del año',         desc:'Cumpliste una meta del año',                              progress: m=>({ value: m.goals.year, target: 1 }) },
    { key:'goal_quarter_perfect', cat:'Metas', emoji:'💎', title:'Trimestre perfecto', desc:'Cumpliste todas las metas de un trimestre ya terminado', progress: m=>({ value: m.goals.perfect.value, target: m.goals.perfect.target }) },
    { key:'goal_dream',      cat:'Metas',   emoji:'🌠', title:'Sueño cumplido',       desc:'Marcaste un sueño como cumplido',                         progress: m=>({ value: m.goals.dream, target: 1 }) },
    { key:'goal_10',         cat:'Metas',   emoji:'🎖️', title:'10 metas',             desc:'10 metas cumplidas entre todas',                          progress: m=>({ value: m.goals.done, target: 10 }) },
    // Diario
    { key:'jou_first',       cat:'Diario',  emoji:'📓', title:'Primera reflexión',    desc:'Escribiste en el diario por primera vez',                 progress: m=>({ value: m.journal.days, target: 1 }) },
    { key:'jou_7',           cat:'Diario',  emoji:'✍️', title:'7 días de reflexión',  desc:'7 días seguidos escribiendo en el diario',                progress: m=>({ value: m.journal.best, target: 7 }) },
    { key:'jou_30',          cat:'Diario',  emoji:'📖', title:'30 días de reflexión', desc:'30 días seguidos escribiendo en el diario',               progress: m=>({ value: m.journal.best, target: 30 }) },
    { key:'jou_days_50',     cat:'Diario',  emoji:'📚', title:'50 días con diario',   desc:'50 días con alguna entrada en el diario',                 progress: m=>({ value: m.journal.days, target: 50 }) },
    // Finanzas
    { key:'fin_tx_first',    cat:'Finanzas', emoji:'🧾', title:'Primer movimiento',   desc:'Registraste tu primer movimiento',                        progress: m=>({ value: m.fin.txs, target: 1 }) },
    { key:'fin_tx_100',      cat:'Finanzas', emoji:'💳', title:'100 movimientos',     desc:'100 movimientos registrados',                             progress: m=>({ value: m.fin.txs, target: 100 }) },
    { key:'fin_tx_1000',     cat:'Finanzas', emoji:'🏦', title:'1000 movimientos',    desc:'1000 movimientos. Nada se te escapa',                     progress: m=>({ value: m.fin.txs, target: 1000 }) },
    { key:'fin_accounts_3',  cat:'Finanzas', emoji:'👛', title:'Tres cuentas',        desc:'Tienes 3 cuentas registradas',                            progress: m=>({ value: m.fin.accounts, target: 3 }) },
    { key:'fin_budget_1',    cat:'Finanzas', emoji:'🎯', title:'Mes en presupuesto',  desc:'Cerraste un mes sin pasarte del presupuesto',             progress: m=>({ value: m.fin.budgetMonths, target: 1 }) },
    { key:'fin_budget_3',    cat:'Finanzas', emoji:'🛡️', title:'Tres meses en control', desc:'3 meses seguidos dentro del presupuesto',               progress: m=>({ value: m.fin.budgetMonths, target: 3 }) },
    { key:'fin_budget_6',    cat:'Finanzas', emoji:'🏆', title:'Medio año en control', desc:'6 meses seguidos dentro del presupuesto',                progress: m=>({ value: m.fin.budgetMonths, target: 6 }) },
    { key:'fin_loan_collected', cat:'Finanzas', emoji:'🤝', title:'Préstamo cobrado', desc:'Te devolvieron completo un préstamo',                     progress: m=>({ value: m.fin.lentClosed, target: 1 }) },
    { key:'fin_debt_free',   cat:'Finanzas', emoji:'🕊️', title:'Sin deudas',          desc:'Pagaste todo lo que debías',                              progress: m=>({ value: m.fin.debtFree, target: 1 }) },
    { key:'fin_people_settled_3', cat:'Finanzas', emoji:'🤗', title:'Cuentas claras', desc:'3 personas con las que estás al día',                      progress: m=>({ value: m.fin.settledPeople, target: 3 }) },
  ],

  progressOf(a, m){
    let p; try { p = a.progress(m) || {}; } catch(e){ p = {}; }
    const target = Math.max(1, Number(p.target) || 1); const value = Math.max(0, Number(p.value) || 0);
    return { value, target, pct: Math.min(100, Math.floor(value / target * 100)), done: value >= target };
  },
  progressText(x){ const f = x.a.fmt || (v=>String(v)); return `${f(Math.min(x.value, x.target))} de ${f(x.target)}`; },
  /* clave → { at } de los desbloqueados (tolera duplicados) */
  unlockedMap(){
    const out = {};
    for (const a of Store.list('achievements')){ if (!a || !a.key) continue; const at = a.unlockedAt || ''; if (!out[a.key] || (at && (!out[a.key].at || at < out[a.key].at))) out[a.key] = { at: at || (out[a.key] && out[a.key].at) || null }; }
    return out;
  },
  items(m){ const u = this.unlockedMap(); return this.CATALOG.map((a, i)=>Object.assign({ a, i, u: u[a.key] || null }, this.progressOf(a, m))); },
  nextOf(items){ return items.filter(x=>!x.u).sort((p, q)=>q.pct - p.pct || p.target - q.target || p.i - q.i)[0] || null; },

  /* ---------- comprobación y desbloqueo ---------- */
  check(force){
    const now = Date.now();
    if (!force && now - this._lastCheck < 5000) return null;
    this._lastCheck = now;
    let m; try { m = this.metrics(); } catch(e){ console.error('logros: métricas', e); return null; }
    const have = new Set(Store.list('achievements').filter(a=>a && a.key).map(a=>a.key));
    const fresh = [];
    for (const a of this.CATALOG){
      if (have.has(a.key)) continue;
      if (this.progressOf(a, m).done){ Store.upsert('achievements', { id: uid(), key: a.key, unlockedAt: new Date().toISOString() }); have.add(a.key); fresh.push(a); }
    }
    if (fresh.length){
      UI.toast('🏆 Logro: ' + fresh[0].title);
      if (fresh.length > 1) setTimeout(()=>UI.toast('🏆 Logro: ' + fresh[1].title + (fresh.length > 2 ? ` (+${fresh.length - 2} más)` : '')), 2800);
    }
    return { m, fresh };
  },
  afterRender(hash){
    if (this._rendering || hash==='#/logros') return;   // la vista de logros ya fuerza la comprobación al dibujarse
    const r = this.check(false);
    if (r && r.fresh.length && /^#\/?$/.test(hash)){ this._rendering = true; try { App.render(); } finally { this._rendering = false; } }
  },

  /* ---------- piezas de interfaz ---------- */
  tile(emoji, label, n, hero){
    const unit = n===1 ? 'día' : 'días';
    if (hero) return `<div class="hero-tile ${n ? 'pos' : ''}"><div class="t">${emoji} ${label}</div><div class="v">${n} ${unit}</div></div>`;
    return `<div class="logro-tile ${n ? 'on' : ''}"><div class="t">${emoji} ${label}</div><div class="v">${n}<small>${unit}</small></div></div>`;
  },
  nextBlock(next, small){
    if (!next) return '';
    return `<div class="logro-next"><div class="logro-ic ${small ? '' : 'lg'}">${next.a.emoji}</div><div class="grow">
      <div class="row between"><span class="semibold ellipsis">${esc(next.a.title)}</span><span class="logro-pct">${next.pct}%</span></div>
      ${small ? '' : `<div class="small muted">${esc(next.a.desc)}</div>`}
      <div class="progress" style="margin-top:6px${small ? ';height:5px' : ''}"><div style="width:${next.pct}%"></div></div>
      <div class="xs muted" style="margin-top:4px">${this.progressText(next)}</div></div></div>`;
  },
  row(x){
    const a = x.a;
    if (x.u) return `<div class="item"><div class="logro-ic">${a.emoji}</div><div class="body"><div class="title">${esc(a.title)}</div><div class="sub">${esc(a.desc)}</div></div><span class="badge g">${fmtDate(this.dateOf(x.u.at), 'day')}</span></div>`;
    return `<div class="item logro-locked"><div class="logro-ic off">${a.emoji}</div><div class="body"><div class="row between"><span class="title">${esc(a.title)}</span><span class="xs muted" style="white-space:nowrap">${this.progressText(x)}</span></div><div class="sub">${esc(a.desc)}</div><div class="progress" style="height:4px;margin-top:6px"><div style="width:${x.pct}%"></div></div></div></div>`;
  },
  heroLine(n, total){
    if (!n) return 'Cada hábito, tarea o meta cumplida te acerca al primero.';
    const p = n / total;
    if (p >= 1) return '¡Los tienes todos! 🎉';
    if (p >= .5) return 'Ya pasaste la mitad. Sigue así.';
    if (p >= .25) return 'Vas por buen camino.';
    return 'Buen comienzo, sigue sumando.';
  },
  weeksCard(m){
    const W = m.weeks;
    const rows = [['🔥', 'Hábitos', W.map(w=>w.habits)], ['🌅', 'Rituales', W.map(w=>w.rituals)], ['🎯', 'Enfoque', W.map(w=>w.focusMin), v=>this.fmtMin(v, true)], ['☑️', 'Tareas', W.map(w=>w.tasks)]];
    let html = `<div class="card"><div class="card-head"><h3>Evolución reciente</h3><span class="muted small">últimas 4 semanas</span></div>`;
    if (rows.every(r=>r[2].every(v=>!v))) return html + `<div class="small muted">Cuando marques hábitos, rituales, sesiones de enfoque o tareas verás aquí cómo va cada semana.</div></div>`;
    html += `<div class="logro-weeks"><div></div>${W.map((w, i)=>`<div class="h">${i===W.length - 1 ? 'Esta sem.' : fmtDate(w.start, 'short')}</div>`).join('')}`;
    for (const [emoji, label, vals, fmt] of rows){
      const max = Math.max(1, ...vals);
      html += `<div class="lbl">${emoji} ${label}</div>` + vals.map((v, i)=>`<div class="logro-bar${i===vals.length - 1 ? ' cur' : ''}${v ? '' : ' zero'}"><span class="n">${fmt ? fmt(v) : v}</span><i style="height:${Math.max(2, Math.round(v / max * 34))}px"></i></div>`).join('');
    }
    return html + `</div><div class="xs muted" style="margin-top:8px">Semanas de lunes a domingo.</div></div>`;
  },

  /* ---------- vista #/logros ---------- */
  view(){
    const r = this.check(true); const m = r ? r.m : this.metrics();
    const f = App.state.logros_filter || 'all';
    const items = this.items(m);
    const n = items.filter(x=>x.u).length, total = items.length, pct = total ? Math.round(n / total * 100) : 0;
    const next = this.nextOf(items);
    let html = Views.back('#/menu', 'Logros', `<button class="iconbtn" data-action="logro-info" aria-label="Cómo se cuentan">${UI.icon('info')}</button>`);
    html += `<div class="hero"><div class="label">Logros desbloqueados</div><div class="big">${n} <span style="font-size:20px;opacity:.75">/ ${total}</span></div><div class="sub">${this.heroLine(n, total)}</div>
      <div class="progress hero-progress"><div class="ok" style="width:${pct}%"></div></div>
      <div class="hero-tiles">${this.tile('🔥', 'Hábitos', m.habits.streak, true)}${this.tile('🌅', 'Ritual', m.ritual.streak, true)}${this.tile('📓', 'Reflexión', m.journal.streak, true)}</div>
      <div class="logro-best">Mejores rachas: hábitos <b>${m.habits.best}</b> · ritual <b>${m.ritual.best}</b> · reflexión <b>${m.journal.best}</b></div></div>`;
    if (next) html += `<div class="card"><div class="card-head"><h3>Próximo logro</h3><span class="muted small">${esc(next.a.cat)}</span></div>${this.nextBlock(next, false)}</div>`;
    html += `<div class="seg mb">${[['all', 'Todos'], ['done', 'Desbloqueados'], ['todo', 'Pendientes']].map(([k, l])=>`<button class="${f===k ? 'active' : ''}" data-action="logro-filter" data-f="${k}">${l}</button>`).join('')}</div>`;
    let any = false;
    for (const cat of this.CATS){
      const all = items.filter(x=>x.a.cat===cat); const shown = all.filter(x=>f==='all' || (f==='done' ? x.u : !x.u));
      if (!shown.length) continue; any = true;
      html += `<div class="section-title"><h2>${this.CAT_ICON[cat]} ${cat}</h2><span class="muted small">${all.filter(x=>x.u).length} de ${all.length}</span></div><div class="card tight"><div class="list">${shown.map(x=>this.row(x)).join('')}</div></div>`;
    }
    if (!any) html += `<div class="card">${f==='done' ? UI.empty('🔒', 'Aún no hay logros desbloqueados', 'Cumple hábitos, tareas y metas: cada avance cuenta.') : UI.empty('🎉', '¡Los tienes todos!', 'No queda ningún logro pendiente.')}</div>`;
    html += this.weeksCard(m);
    return html;
  },

  /* ---------- tarjeta de Inicio ---------- */
  homeCard(){
    let m; try { m = this.metrics(); } catch(e){ console.error('logros: tarjeta', e); return ''; }
    const items = this.items(m); const n = items.filter(x=>x.u).length; const next = this.nextOf(items);
    let html = `<div class="card"><div class="card-head"><h3>🏆 Rachas y logros</h3><a class="link" href="#/logros">Ver logros</a></div>`;
    if (!m.habits.streak && !m.ritual.streak && !m.journal.streak && !n) return html + `<div class="small muted">Cumple tus hábitos, completa tu ritual y escribe en el diario para encender las rachas. Cada avance desbloquea un logro.</div></div>`;
    html += `<div class="logro-tiles">${this.tile('🔥', 'Hábitos', m.habits.streak)}${this.tile('🌅', 'Ritual', m.ritual.streak)}${this.tile('📓', 'Reflexión', m.journal.streak)}</div>`;
    if (next) html += `<div class="xs muted" style="margin:10px 0 4px">Próximo logro</div>` + this.nextBlock(next, true);
    html += `<div class="xs muted" style="margin-top:8px">${n} de ${items.length} logros desbloqueados</div>`;
    return html + `</div>`;
  },

  info(){
    UI.sheet({ title:'¿Cómo se cuentan?', html:`<div class="small logro-info">
      <p><b>Racha de hábitos.</b> Días seguidos en los que cumpliste <b>todos</b> los hábitos programados para ese día (según los días de la semana de cada hábito). Los archivados no cuentan y los días sin hábitos programados no rompen la racha. Hoy no la rompe hasta que termine.</p>
      <p><b>Racha de ritual.</b> Días seguidos con al menos un ritual completado.</p>
      <p><b>Racha de reflexión.</b> Días seguidos con una entrada en el diario (ánimo o alguna respuesta).</p>
      <p><b>Meses dentro del presupuesto.</b> Meses completos seguidos, contando desde el mes pasado, en los que el gasto no superó el presupuesto total.</p>
      <p><b>Trimestre perfecto.</b> Un trimestre ya terminado con todas sus metas cumplidas.</p>
      <p>Los logros se revisan solos mientras usas la app y, una vez desbloqueados, se quedan contigo aunque después cambien los datos.</p></div>` });
  },

  CSS: `
.logro-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.logro-tile{background:var(--card-2);border-radius:12px;padding:10px 6px;text-align:center;min-width:0}
.logro-tile .t{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.logro-tile .v{font-size:20px;font-weight:800;margin-top:2px;letter-spacing:-.01em;line-height:1.1}
.logro-tile .v small{font-size:11px;font-weight:600;color:var(--muted);margin-left:3px}
.logro-tile.on .v{color:var(--accent)}
.logro-best{margin-top:10px;font-size:12px;opacity:.85}
.logro-ic{width:42px;height:42px;border-radius:13px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;line-height:1}
.logro-ic.lg{width:54px;height:54px;border-radius:16px;font-size:28px}
.logro-ic.off{background:var(--card-2);filter:grayscale(1);opacity:.55}
.logro-locked .title,.logro-locked .sub{opacity:.7}
.logro-next{display:flex;align-items:center;gap:12px}
.logro-pct{font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap;margin-left:8px}
.logro-weeks{display:grid;grid-template-columns:minmax(78px,auto) repeat(4,1fr);gap:6px 4px;align-items:end}
.logro-weeks .h{color:var(--muted);font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.logro-weeks .lbl{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:4px}
.logro-bar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:54px;gap:3px}
.logro-bar .n{font-size:11px;font-weight:700;white-space:nowrap}
.logro-bar i{display:block;width:70%;max-width:26px;border-radius:5px 5px 2px 2px;background:var(--accent);opacity:.5}
.logro-bar.cur i{opacity:1}
.logro-bar.zero i{background:var(--line);opacity:1}
.logro-bar.zero .n{color:var(--muted);font-weight:500}
.logro-info{line-height:1.55}
.logro-info p{margin:0 0 12px}
`,
};

App.registerModule({
  id: 'logros',
  name: 'Logros',
  icon: 'star',
  collections: ['achievements'],
  routes: [
    [/^#\/logros$/, ()=>Logros.view(), 'menu'],
  ],
  menu: [{ hash: '#/logros', icon: 'star', label: 'Logros' }],
  homeCards: [{ order: 45, render: ()=>Logros.homeCard() }],
  actions: {
    'logro-filter'(d){ App.state.logros_filter = d.f || 'all'; App.render(); },
    'logro-info'(){ Logros.info(); },
  },
  css: Logros.CSS,
  init(){ Logros.check(true); },
  afterRender(hash){ Logros.afterRender(hash); },
});
