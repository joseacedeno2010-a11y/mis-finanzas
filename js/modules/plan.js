'use strict';
/* Plan de arranque: crea con un toque la estructura inicial (rituales, hábitos y metas del trimestre)
   a partir de los objetivos del usuario. Todo queda editable en cada módulo. */
const Plan = {
  loaded(){ return !!(Store.data.settings.plan && Store.data.settings.plan.loaded); },
  dismissed(){ return !!(Store.data.settings.plan && Store.data.settings.plan.dismissed); },
  quarter(){ const d = new Date(); return { year: d.getFullYear(), q: 'q' + (Math.floor(d.getMonth() / 3) + 1) }; },

  blocks(){
    const { year, q } = this.quarter();
    const loanDebts = Store.data.loans.filter(l=>l.direction==='borrowed' && Calc.loanIsOpen(l)).map(l=>({ name: (Store.person(l.personId) || {}).name || 'persona', amount: Calc.loanOutstanding(l), currency: l.currency }));
    const oldDebts = (typeof Deudas!=='undefined' ? Deudas.list().filter(d=>Deudas.isOpen(d)) : []).map(d=>({ name: d.creditor, amount: Deudas.outstanding(d), currency: d.currency || 'USD' }));
    const debts = oldDebts.concat(loanDebts).sort((a, b)=>Calc.toUSD(a.amount, a.currency) - Calc.toUSD(b.amount, b.currency));
    const debtTotal = debts.reduce((s, d)=>s + Calc.toUSD(d.amount, d.currency), 0);
    const debtMilestones = debts.length
      ? debts.map(d=>({ id: uid(), text: `Pagar a ${d.name} · ${fmtMoney(d.amount, d.currency)}`, done: false }))
      : [{ id: uid(), text: 'Anotar todas mis deudas en la sección Deudas', done: false }, { id: uid(), text: 'Pagar la deuda más pequeña primero', done: false }];
    return [
      { key:'ritual', title:'🌅 Ritual de la mañana', desc:'Agua, 10 min de oración o meditación, 20 min de ejercicio, 10 min de lectura y las 3 prioridades del día.',
        run(){ Store.upsert('rituals', { id: uid(), name:'Ritual de la mañana', icon:'🌅', time:'06:30', order: 0, steps: [['Vaso de agua 💧'], ['Oración o meditación · 10 min 🙏'], ['Ejercicio · 20 min 🏋️'], ['Lectura · 10 min 📚'], ['Escribir las 3 prioridades de hoy ✍️']].map(s=>({ id: uid(), text: s[0] })) }); } },
      { key:'noche', title:'🌙 Cierre del día', desc:'Revisar tareas, dejar listas las de mañana y anotar por qué doy gracias.',
        run(){ Store.upsert('rituals', { id: uid(), name:'Cierre del día', icon:'🌙', time:'21:30', order: 1, steps: [['Revisar qué hice hoy ✅'], ['Dejar las 3 tareas de mañana 📋'], ['Reflexión y gratitud 🙏'], ['Celular fuera del cuarto 📵']].map(s=>({ id: uid(), text: s[0] })) }); } },
      { key:'habitos', title:'✅ 7 hábitos base', desc:'Oración/meditación, ejercicio, lectura, diario de trading, registrar gastos, dormir 7 h y sin celular la primera hora.',
        run(){
          const created = new Date().toISOString();
          [['Oración o meditación','🙏','#7c3aed',[]],['Ejercicio','🏋️','#ea580c',[1,2,3,4,5,6]],['Leer 10 min','📚','#2563eb',[]],['Diario de trading','📈','#0f766e',[1,2,3,4,5]],['Registrar gastos del día','💵','#16a34a',[]],['Dormir 7 h o más','😴','#0891b2',[]],['Primera hora sin celular','📵','#334155',[]]]
            .forEach(([name, icon, color, days], i)=>{ const active = days.length ? days.length : 7; const dim = new Date(year, new Date().getMonth() + 1, 0).getDate(); Store.upsert('habits', { id: uid(), name, icon, color, days, goalPerMonth: Math.round(dim * active / 7), order: i, archived: false, createdAt: created }); });
        } },
      { key:'ingresos', title:'💰 Meta: facturar $5.000 al mes', desc:'Trading con reglas escritas y bitácora, y sistemas como esta app para otros. Hitos de $1k, $3k y $5k.',
        run(){ Store.upsert('goals', { id: uid(), title:'Facturar $5.000 al mes', area:'profesional', horizon: q, year, kind:'milestones', description:'Dos fuentes: trading con sistema y venta de sistemas/apps. Medir cada mes en Finanzas → Ingresos.', progress: 0, done: false, doneAt: null, order: Date.now(), createdAt: new Date().toISOString(),
          milestones: ['Escribir mis reglas de trading (entrada, salida, riesgo por operación)', 'Bitácora: 30 operaciones registradas y revisadas', 'Definir la oferta de sistemas: qué vendo, a quién y a qué precio', 'Primer cliente o primer mes de trading en positivo', 'Mes con $1.000 facturados', 'Mes con $3.000 facturados', 'Mes con $5.000 facturados'].map(t=>({ id: uid(), text: t, done: false })) }); } },
      { key:'deudas', title:`🧾 Meta: quedar sin deudas${debtTotal ? ' · ' + fmtMoney(debtTotal) : ''}`, desc: debts.length ? `Un hito por cada deuda que tienes registrada (${debts.length}). Empieza por la más pequeña para ganar impulso.` : 'Primero anota tus deudas en Personas; luego, un hito por cada una.',
        run(){ Store.upsert('goals', { id: uid(), title:'Quedar sin deudas', area:'personal', horizon: 'year', year, kind:'milestones', description:'Método bola de nieve: pago mínimo en todas y todo lo extra a la más pequeña. Al saldar una, su cuota pasa a la siguiente.', progress: 0, done: false, doneAt: null, order: Date.now() + 1, createdAt: new Date().toISOString(), milestones: debtMilestones }); } },
      { key:'cuerpo', title:'💪 Meta: 12 semanas de ejercicio', desc:'4 sesiones por semana durante 12 semanas, con control de peso o medidas cada 4 semanas.',
        run(){ Store.upsert('goals', { id: uid(), title:'12 semanas de ejercicio constante', area:'personal', horizon: q, year, kind:'milestones', progress: 0, done: false, doneAt: null, order: Date.now() + 2, createdAt: new Date().toISOString(), milestones: ['Semana 1 a 4 completas (16 sesiones)', 'Medidas o peso a las 4 semanas', 'Semana 5 a 8 completas', 'Semana 9 a 12 completas', 'Foto y medidas finales'].map(t=>({ id: uid(), text: t, done: false })) }); } },
      { key:'espiritu', title:'🙏 Meta: 30 días de práctica espiritual', desc:'Oración o meditación diaria durante 30 días seguidos, con una lectura semanal.',
        run(){ Store.upsert('goals', { id: uid(), title:'30 días seguidos de oración o meditación', area:'personal', horizon: q, year, kind:'milestones', progress: 0, done: false, doneAt: null, order: Date.now() + 3, createdAt: new Date().toISOString(), milestones: ['7 días seguidos', '14 días seguidos', '21 días seguidos', '30 días seguidos', 'Elegir la próxima práctica o lectura'].map(t=>({ id: uid(), text: t, done: false })) }); } },
      { key:'mente', title:'📚 Meta: 3 libros este trimestre', desc:'Uno de trading, uno de negocios o sistemas, uno de crecimiento personal o espiritual.',
        run(){ Store.upsert('goals', { id: uid(), title:'Leer 3 libros este trimestre', area:'personal', horizon: q, year, kind:'milestones', progress: 0, done: false, doneAt: null, order: Date.now() + 4, createdAt: new Date().toISOString(), milestones: ['Libro 1: trading o inversión', 'Libro 2: negocios o sistemas', 'Libro 3: crecimiento personal o espiritual'].map(t=>({ id: uid(), text: t, done: false })) }); } },
      { key:'semana', title:'📋 Tareas de esta semana', desc:'Las primeras acciones concretas: reglas de trading, lista de deudas, oferta de sistemas y revisión semanal del domingo.',
        run(){
          const t = todayISO(); const add = (iso, n)=>{ const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
          const dow = new Date().getDay(); const sunday = add(t, (7 - dow) % 7 || 7);
          [['Escribir mis reglas de trading en una nota', t, 45], ['Anotar todas mis deudas en Personas con montos y fechas', t, 20], ['Definir qué sistema puedo vender y a quién (nota)', add(t, 1), 30], ['Revisar y ajustar mi presupuesto del mes', add(t, 2), 20], ['Revisión semanal: metas, hábitos y finanzas', sunday, 30]]
            .forEach(([title, date, minutes], i)=>Store.upsert('tasks', { id: uid(), title, date, done: false, doneAt: null, minutes, goalId: null, order: i, createdAt: new Date().toISOString() }));
        } },
    ];
  },

  open(){
    const blocks = this.blocks();
    const s = UI.sheet({ title:'Tu plan de arranque', html:`
      <div class="small muted mb">Elige qué cargar. Todo queda editable después en Ritual, Hábitos, Metas y Semana.</div>
      <div class="card tight"><div class="list">${blocks.map(b=>`<label class="item" style="gap:10px;cursor:pointer"><input type="checkbox" name="blk" value="${b.key}" checked style="width:20px;height:20px;accent-color:var(--accent)"><div class="body"><div class="title">${b.title}</div><div class="sub">${esc(b.desc)}</div></div></label>`).join('')}</div></div>
      <button class="btn mt" data-load>Cargar mi plan</button>
      <div class="xs muted center mt">Una vez cargado, esta tarjeta desaparece del inicio.</div>` });
    s.body.querySelector('[data-load]').onclick = ()=>{
      const keys = [...s.body.querySelectorAll('[name=blk]:checked')].map(i=>i.value);
      if (!keys.length) return UI.toast('Elige al menos un bloque', true);
      blocks.filter(b=>keys.includes(b.key)).forEach(b=>{ try { b.run(); } catch(e){ console.error(e); } });
      Store.data.settings.plan = Object.assign({}, Store.data.settings.plan, { loaded: true, loadedAt: new Date().toISOString() });
      Store.save(); s.close(); App.go('#/'); App.render(); UI.toast('Plan cargado. Empieza por el ritual de mañana 🌅');
    };
  },
  homeCard(){
    if (this.loaded() || this.dismissed()) return '';
    return `<div class="card" style="border:1px solid var(--accent)"><div class="row"><div class="ic acc-ic" style="background:var(--accent-soft)">🧭</div><div class="grow"><div class="semibold">Tu plan de arranque</div><div class="small muted">Rutina de mañana y noche, 7 hábitos, metas del trimestre (ingresos, deudas, cuerpo, espíritu, mente) y las tareas de esta semana. Listo en un toque.</div></div></div><div class="btnrow"><button class="btn sm" data-action="plan-open">Ver y cargar</button><button class="btn sm secondary" data-action="plan-dismiss">Ahora no</button></div></div>`;
  },
};
App.registerModule({
  id: 'plan', name: 'Plan de arranque', icon: '🧭',
  homeCards: [{ order: 3, render: ()=>Plan.homeCard() }],
  menu: [{ hash: '#/plan', icon: 'target', label: 'Plan' }],
  routes: [[/^#\/plan$/, ()=>`${Views.back('#/menu', 'Plan de arranque')}<div class="card"><div class="semibold">Estructura sugerida</div><div class="small muted" style="margin:6px 0 12px">Rituales de mañana y noche, 7 hábitos base, metas del trimestre y las primeras tareas. Puedes cargarla las veces que quieras; lo que ya exista se duplica, así que revisa antes.</div><button class="btn" data-action="plan-open">Ver y cargar el plan</button></div>`, 'menu']],
  actions: {
    'plan-open'(){ Plan.open(); },
    'plan-dismiss'(){ Store.data.settings.plan = Object.assign({}, Store.data.settings.plan, { dismissed: true }); Store.save(); App.render(); },
  },
});
