'use strict';
/* Deudas antiguas: registro independiente de Finanzas (no toca cuentas, préstamos ni patrimonio).
   Incluye el proyecto "Vender el negocio" (meta con hitos + tareas) y qué deudas se pagarían con la venta. */
const Deudas = {
  cfg(){ return Object.assign({ salePrice: 0, sort: 'snowball' }, Store.data.settings.deudas || {}); },
  saveCfg(patch){ Store.data.settings.deudas = Object.assign(this.cfg(), patch); Store.save(); },
  list(){ return Store.list('debts'); },
  paid(d){ return round2((d.payments || []).reduce((s, p)=>s + (Number(p.amount) || 0), 0)); },
  outstanding(d){ return round2(Math.max(0, (Number(d.amount) || 0) - this.paid(d))); },
  usd(d){ return Calc.toUSD(this.outstanding(d), d.currency || 'USD'); },
  isOpen(d){ return d.status!=='paid' && this.outstanding(d) > 0.004; },
  monthsSince(iso){ if (!iso) return null; return Calc.monthsElapsed(iso, todayISO()); },
  sinceText(iso){ const m = this.monthsSince(iso); if (m==null) return 'sin fecha'; if (m < 1) return 'este mes'; if (m < 12) return `hace ${m} mes${m===1 ? '' : 'es'}`; const y = Math.floor(m / 12), r = m % 12; return `hace ${y} año${y===1 ? '' : 's'}${r ? ` y ${r} mes${r===1 ? '' : 'es'}` : ''}`; },
  saleGoal(){ return Store.list('goals').find(g=>g.tag==='venta-negocio'); },
  summary(){
    const open = this.list().filter(d=>this.isOpen(d));
    const totalUSD = round2(open.reduce((s, d)=>s + this.usd(d), 0));
    const withSale = open.filter(d=>d.payWithSale);
    const saleUSD = round2(withSale.reduce((s, d)=>s + this.usd(d), 0));
    return { open, totalUSD, withSale, saleUSD, paidCount: this.list().filter(d=>!this.isOpen(d)).length };
  },
  sorted(list){
    const c = this.cfg();
    const arr = list.slice();
    if (c.sort==='amount') arr.sort((a, b)=>this.usd(b) - this.usd(a));
    else if (c.sort==='oldest') arr.sort((a, b)=>(a.since || '9999').localeCompare(b.since || '9999'));
    else if (c.sort==='priority') arr.sort((a, b)=>(b.priority || 0) - (a.priority || 0) || this.usd(a) - this.usd(b));
    else arr.sort((a, b)=>this.usd(a) - this.usd(b)); // bola de nieve: la más pequeña primero
    return arr;
  },

  /* ---------- vistas ---------- */
  view(){
    const S = this.summary(); const c = this.cfg(); const all = this.list();
    const f = App.state.deu_filter || 'open';
    let rows = f==='open' ? S.open : f==='sale' ? S.withSale : f==='paid' ? all.filter(d=>!this.isOpen(d)) : all;
    rows = this.sorted(rows);
    const sortLabels = { snowball:'Bola de nieve', amount:'Monto', oldest:'Antigüedad', priority:'Prioridad' };
    let html = Views.back('#/menu', 'Deudas', `<button class="iconbtn" data-action="deu-new" aria-label="Nueva deuda">${UI.icon('plus')}</button>`);
    if (!all.length){
      html += `<div class="card">${UI.empty('🧾', 'Sin deudas registradas', 'Anota aquí las deudas antiguas que quieres saldar. No se mezclan con tus cuentas ni con el balance.')}<button class="btn" data-action="deu-new">${UI.icon('plus')} Registrar una deuda</button></div>`;
      html += this.saleCard(S);
      return html;
    }
    const covered = c.salePrice > 0 ? Math.min(100, Math.round(S.saleUSD / c.salePrice * 100)) : 0;
    html += `<div class="hero"><div class="label">Total pendiente</div><div class="big">${fmtMoney(S.totalUSD)}</div><div class="sub">${S.open.length} deuda${S.open.length===1 ? '' : 's'} abierta${S.open.length===1 ? '' : 's'}${S.paidCount ? ` · ${S.paidCount} saldada${S.paidCount===1 ? '' : 's'} 🎉` : ''}</div>
      <div class="hero-tiles"><button class="hero-tile" data-action="deu-filter" data-f="sale"><div class="t">🏷️ Con la venta</div><div class="v">${fmtMoney(S.saleUSD)}</div></button><button class="hero-tile" data-action="deu-sale-price"><div class="t">💼 Venta estimada</div><div class="v">${c.salePrice ? fmtMoney(c.salePrice) : 'Definir'}</div></button><div class="hero-tile ${c.salePrice && S.saleUSD <= c.salePrice ? 'pos' : 'neg'}"><div class="t">Cubre</div><div class="v">${c.salePrice ? (S.saleUSD <= c.salePrice ? 'Todo ✓' : covered + '%') : '—'}</div></div></div></div>`;
    html += `<div class="seg mb">${[['open', 'Abiertas'], ['sale', 'Con la venta'], ['paid', 'Saldadas'], ['all', 'Todas']].map(([k, l])=>`<button class="${f===k ? 'active' : ''}" data-action="deu-filter" data-f="${k}">${l}</button>`).join('')}</div>`;
    html += `<div class="row between" style="margin:0 4px 8px"><span class="small muted">${rows.length} deuda${rows.length===1 ? '' : 's'}</span><button class="btn secondary sm" data-action="deu-sort">${UI.icon('sort')} ${sortLabels[c.sort] || 'Bola de nieve'}</button></div>`;
    if (c.sort==='snowball' && f==='open' && rows.length > 1) html += `<div class="xs muted" style="margin:0 4px 8px">Bola de nieve: paga el mínimo en todas y todo lo extra a la primera de la lista. Al saldarla, pasa a la siguiente.</div>`;
    html += rows.length ? rows.map((d, i)=>this.card(d, f==='open' && c.sort==='snowball' ? i : -1)).join('') : `<div class="card">${UI.empty('✅', f==='paid' ? 'Todavía no has saldado ninguna' : 'Nada por aquí')}</div>`;
    html += this.saleCard(S);
    return html;
  },
  card(d, rank){
    const out = this.outstanding(d), paid = this.paid(d), pct = d.amount ? Math.min(100, Math.round(paid / d.amount * 100)) : 0;
    const open = this.isOpen(d);
    const badges = [];
    if (!open) badges.push('<span class="badge g">Saldada</span>');
    else if (d.status==='negotiating') badges.push('<span class="badge a">Negociando</span>');
    if (d.payWithSale && open) badges.push('<span class="badge b">Con la venta</span>');
    if (d.priority >= 2) badges.push('<span class="badge r">Urgente</span>');
    return `<div class="card flat deu-card ${open ? '' : 'deu-paid'}"><div class="row between"><div class="row grow" style="min-width:0">${rank >= 0 ? `<div class="deu-rank">${rank + 1}</div>` : UI.avatar(d.creditor)}<div class="grow" style="min-width:0"><div class="semibold ellipsis">${esc(d.creditor)}</div><div class="small muted">${d.since ? 'Desde ' + fmtDate(d.since) + ' · ' + this.sinceText(d.since) : 'Sin fecha'}${d.note ? ' · ' + esc(d.note) : ''}</div><div style="margin-top:4px">${badges.join(' ')}</div></div></div><div class="right"><div class="bold ${open ? 'red' : 'muted'}" style="font-size:17px">${fmtMoney(out, d.currency)}</div>${d.currency!=='USD' ? `<div class="xs muted">≈ ${fmtMoney(this.usd(d))}</div>` : ''}${paid ? `<div class="xs muted">abonado ${fmtMoney(paid, d.currency)}</div>` : ''}</div></div>
      ${paid || !open ? `<div class="progress"><div class="${open ? 'ok' : 'ok'}" style="width:${open ? pct : 100}%"></div></div>` : ''}
      ${(d.payments || []).length ? `<div class="mt">${d.payments.slice().sort((a, b)=>b.date.localeCompare(a.date)).slice(0, 3).map(p=>`<button class="payrow" data-action="deu-edit-pay" data-id="${d.id}" data-pid="${p.id}"><span class="muted">${fmtDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</span><span class="semibold">-${fmtMoney(p.amount, d.currency)}</span></button>`).join('')}</div>` : ''}
      <div class="btnrow">${open ? `<button class="btn sm" data-action="deu-pay" data-id="${d.id}">Abonar</button>` : ''}<button class="btn secondary sm" data-action="deu-edit" data-id="${d.id}">Editar</button>${open ? `<button class="btn secondary sm" data-action="deu-toggle-sale" data-id="${d.id}">${d.payWithSale ? 'Quitar de la venta' : 'Pagar con la venta'}</button>` : ''}</div></div>`;
  },
  saleCard(S){
    const g = this.saleGoal();
    if (!g) return `<div class="section-title"><h2>Vender el negocio</h2></div><div class="card" style="border:1px solid var(--accent)"><div class="row"><div class="ic acc-ic" style="background:var(--accent-soft)">💼</div><div class="grow"><div class="semibold">Proyecto prioritario: vender el negocio</div><div class="small muted">Crea el proyecto con sus 8 pasos (inventario, precio, publicación, negociación, traspaso) y las tareas de esta semana.</div></div></div><button class="btn mt" data-action="deu-sale-project">Crear el proyecto</button></div>`;
    const ms = g.milestones || []; const done = ms.filter(m=>m.done).length; const pct = ms.length ? Math.round(done / ms.length * 100) : 0;
    const next = ms.find(m=>!m.done);
    const c = this.cfg();
    return `<div class="section-title"><h2>Vender el negocio</h2><span class="badge ${g.done ? 'g' : 'a'}">${g.done ? 'Vendido 🎉' : 'Prioridad'}</span></div><div class="card"><div class="row between"><div class="semibold">${done} de ${ms.length} pasos</div><span class="small muted">${pct}%</span></div><div class="progress"><div class="${pct >= 100 ? 'ok' : 'ok'}" style="width:${pct}%"></div></div>
      ${next ? `<div class="mt small"><span class="muted">Siguiente paso:</span> <b>${esc(next.text)}</b></div>` : ''}
      <div class="row between mt small"><span class="muted">Precio estimado</span><button class="link" data-action="deu-sale-price">${c.salePrice ? fmtMoney(c.salePrice) : 'Definir'}</button></div>
      <div class="row between small" style="margin-top:4px"><span class="muted">Deudas marcadas para pagar con la venta</span><span class="semibold">${fmtMoney(S.saleUSD)}</span></div>
      ${c.salePrice ? `<div class="row between small" style="margin-top:4px"><span class="muted">${S.saleUSD <= c.salePrice ? 'Te quedaría libre' : 'Faltaría cubrir'}</span><span class="semibold ${S.saleUSD <= c.salePrice ? 'green' : 'red'}">${fmtMoney(Math.abs(c.salePrice - S.saleUSD))}</span></div>` : ''}
      <div class="btnrow"><button class="btn sm" data-go="#/metas/${g.id}">Ver pasos</button><button class="btn secondary sm" data-go="#/semana">Tareas</button></div></div>`;
  },
  homeCard(){
    const S = this.summary(); const g = this.saleGoal();
    if (!S.open.length && !g) return '';
    const ms = g ? (g.milestones || []) : []; const done = ms.filter(m=>m.done).length; const next = ms.find(m=>!m.done);
    return `<div class="card"><div class="card-head"><h3>🧾 Deudas</h3><a class="link" href="#/deudas">Ver</a></div>
      <div class="row between"><span class="muted small">Pendiente total</span><span class="bold red">${fmtMoney(S.totalUSD)}</span></div>
      ${S.open.length ? `<div class="row between small" style="margin-top:4px"><span class="muted">Siguiente a saldar (bola de nieve)</span><span class="semibold">${esc(this.sorted(S.open)[0].creditor)} · ${fmtMoney(this.outstanding(this.sorted(S.open)[0]), this.sorted(S.open)[0].currency)}</span></div>` : ''}
      ${g && !g.done ? `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><div class="row between small"><span class="semibold">💼 Vender el negocio</span><span class="muted">${done}/${ms.length} pasos</span></div><div class="progress"><div class="ok" style="width:${ms.length ? Math.round(done / ms.length * 100) : 0}%"></div></div>${next ? `<div class="xs muted" style="margin-top:4px">Siguiente: ${esc(next.text)}</div>` : ''}</div>` : ''}</div>`;
  },

  /* ---------- formularios ---------- */
  form(d=null){
    const s = UI.sheet({ title: d ? 'Editar deuda' : 'Nueva deuda', html:`
      <div class="field"><label>A quién le debes</label><input name="creditor" value="${esc(d ? d.creditor : '')}" placeholder="Ej. Banco, Carlos, tarjeta" autofocus></div>
      ${Forms.amountHTML(d ? d.amount : null, 'Monto original')}
      <div class="two"><div class="field"><label>Moneda</label><select name="currency">${Forms.currencyOptions(d ? d.currency : 'USD')}</select></div><div class="field"><label>Desde cuándo</label><input type="date" name="since" value="${d && d.since ? d.since : ''}"></div></div>
      <div class="two"><div class="field"><label>Estado</label><select name="status"><option value="open"${!d || d.status==='open' ? ' selected' : ''}>Pendiente</option><option value="negotiating"${d && d.status==='negotiating' ? ' selected' : ''}>Negociando</option><option value="paid"${d && d.status==='paid' ? ' selected' : ''}>Saldada</option></select></div><div class="field"><label>Prioridad</label><select name="priority"><option value="0"${!d || !d.priority ? ' selected' : ''}>Normal</option><option value="1"${d && d.priority===1 ? ' selected' : ''}>Alta</option><option value="2"${d && d.priority===2 ? ' selected' : ''}>Urgente</option></select></div></div>
      <div class="field inline" style="margin-bottom:14px"><label>Se paga con la venta del negocio</label><button class="switch ${d && d.payWithSale ? 'on' : ''}" data-sw type="button"></button></div>
      <div class="field"><label>Nota</label><input name="note" value="${esc(d ? d.note || '' : '')}" placeholder="Opcional: acuerdo, intereses, contacto"></div>
      <button class="btn" data-save>Guardar</button>${d ? '<button class="btn danger mt" data-del>Eliminar deuda</button>' : ''}` });
    const f = s.body; let payWithSale = !!(d && d.payWithSale);
    f.querySelector('[data-sw]').onclick = e=>{ payWithSale = !payWithSale; e.currentTarget.classList.toggle('on', payWithSale); };
    f.querySelector('[data-save]').onclick = ()=>{
      const creditor = Forms.val(f, 'creditor'); if (!creditor) return UI.toast('Escribe a quién le debes', true);
      const amount = Forms.amount(f); if (!amount) return UI.toast('Escribe el monto', true);
      Store.upsert('debts', { id: d ? d.id : uid(), creditor, amount, currency: Forms.val(f, 'currency'), since: Forms.val(f, 'since') || null, status: Forms.val(f, 'status'), priority: Number(Forms.val(f, 'priority')) || 0, payWithSale, note: Forms.val(f, 'note'), payments: d ? d.payments || [] : [], createdAt: d ? d.createdAt : new Date().toISOString() });
      s.close(); if (location.hash!=='#/deudas') App.go('#/deudas'); App.render(); UI.toast('Deuda guardada');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm(`¿Eliminar la deuda con ${d.creditor}?`)){ Store.remove('debts', d.id); s.close(); App.render(); UI.toast('Eliminada'); } };
    if (!d) Forms.focusAmount(f);
  },
  payForm(d, p=null){
    const pending = round2(this.outstanding(d) + (p ? p.amount : 0));
    const s = UI.sheet({ title: p ? 'Editar abono' : `Abonar a ${d.creditor}`, html:`
      <div class="small muted mb">Pendiente: <b>${fmtMoney(pending, d.currency)}</b>. Este abono no toca tus cuentas; es solo el registro de la deuda.</div>
      ${Forms.amountHTML(p ? p.amount : null, CURRENCIES[d.currency].name)}
      <div class="center mb"><button class="btn secondary sm" data-all>Saldar todo (${fmtMoney(pending, d.currency)})</button></div>
      <div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${p ? p.date : todayISO()}"></div><div class="field"><label>Nota</label><input name="note" value="${esc(p ? p.note || '' : '')}" placeholder="Opcional"></div></div>
      <button class="btn" data-save>Guardar</button>${p ? '<button class="btn danger mt" data-del>Eliminar abono</button>' : ''}` });
    const f = s.body;
    f.querySelector('[data-all]').onclick = ()=>{ f.querySelector('[name=amount]').value = String(pending); };
    f.querySelector('[data-save]').onclick = ()=>{
      const amount = Forms.amount(f); if (!amount) return UI.toast('Escribe el monto', true);
      if (amount > pending + 0.005) return UI.toast('El abono supera lo pendiente', true);
      d.payments = d.payments || [];
      const obj = { id: p ? p.id : uid(), amount, date: Forms.val(f, 'date') || todayISO(), note: Forms.val(f, 'note') };
      const i = d.payments.findIndex(x=>x.id===obj.id); if (i >= 0) d.payments[i] = obj; else d.payments.push(obj);
      if (this.outstanding(d) <= 0.004) d.status = 'paid'; else if (d.status==='paid') d.status = 'open';
      Store.upsert('debts', d); s.close(); App.render(); UI.toast(d.status==='paid' ? '¡Deuda saldada! 🎉' : 'Abono registrado');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm('¿Eliminar este abono?')){ d.payments = d.payments.filter(x=>x.id!==p.id); if (d.status==='paid' && this.outstanding(d) > 0) d.status = 'open'; Store.upsert('debts', d); s.close(); App.render(); } };
    if (!p) Forms.focusAmount(f);
  },
  salePriceForm(){
    const c = this.cfg();
    const s = UI.sheet({ title:'Precio estimado de venta', html:`<div class="small muted mb">Lo que esperas recibir por el negocio, en dólares. Sirve para ver qué deudas quedarían cubiertas.</div>${Forms.amountHTML(c.salePrice || null, 'USD')}<button class="btn" data-save>Guardar</button>` });
    s.body.querySelector('[data-save]').onclick = ()=>{ const v = Forms.amount(s.body); if (!v) return UI.toast('Escribe un monto', true); this.saveCfg({ salePrice: v }); s.close(); App.render(); };
    Forms.focusAmount(s.body);
  },
  createSaleProject(){
    if (this.saleGoal()) return UI.toast('El proyecto ya existe', true);
    const d = new Date(); const year = d.getFullYear(); const q = 'q' + (Math.floor(d.getMonth() / 3) + 1);
    const goal = { id: uid(), tag:'venta-negocio', title:'Vender el negocio', area:'profesional', horizon: q, year, kind:'milestones', description:'Vender el negocio para amortizar deudas y liberar peso. Cada paso completado acerca el cierre.', progress: 0, done: false, doneAt: null, order: Date.now() - 1e9, createdAt: new Date().toISOString(),
      milestones: ['Listar todo lo que incluye el negocio: equipos, inventario, clientes, redes, contratos', 'Definir precio de venta y precio mínimo aceptable', 'Preparar fotos, cifras y descripción atractiva', 'Publicar en 3 lugares: Marketplace, grupos y contactos directos', 'Responder interesados y agendar visitas', 'Negociar y acordar condiciones por escrito', 'Firmar el traspaso y recibir el pago', 'Aplicar el dinero a las deudas marcadas'].map(t=>({ id: uid(), text: t, done: false })) };
    Store.upsert('goals', goal);
    const t = todayISO(); const add = (iso, n)=>{ const x = parseISO(iso); x.setDate(x.getDate() + n); return toISO(x); };
    [['Escribir la lista completa de lo que incluye el negocio', t, 45], ['Definir precio de venta y precio mínimo', add(t, 1), 30], ['Tomar fotos y redactar la descripción de venta', add(t, 2), 60], ['Publicar el negocio en venta en 3 lugares', add(t, 3), 30], ['Avisar a 5 contactos que podría interesarles', add(t, 3), 20]]
      .forEach(([title, date, minutes], i)=>Store.upsert('tasks', { id: uid(), title, date, done: false, doneAt: null, minutes, goalId: goal.id, order: -10 + i, createdAt: new Date().toISOString() }));
    App.render(); UI.toast('Proyecto creado con 8 pasos y 5 tareas 💼');
  },
};
App.registerModule({
  id: 'deudas', name: 'Deudas', icon: '🧾',
  collections: ['debts'],
  routes: [[/^#\/deudas$/, ()=>Deudas.view(), 'menu']],
  menu: [{ hash: '#/deudas', icon: 'file', label: 'Deudas' }],
  homeCards: [{ order: 42, render: ()=>Deudas.homeCard() }],
  fab: [{ label: 'Nueva deuda', sub: 'Deuda antigua, aparte de tus cuentas', icon: 'file', cls: 'r', run(){ Deudas.form(); } }],
  actions: {
    'deu-new'(){ Deudas.form(); },
    'deu-edit'(d){ const x = Store.list('debts').find(y=>y.id===d.id); if (x) Deudas.form(x); },
    'deu-pay'(d){ const x = Store.list('debts').find(y=>y.id===d.id); if (x) Deudas.payForm(x); },
    'deu-edit-pay'(d){ const x = Store.list('debts').find(y=>y.id===d.id); const p = x && (x.payments || []).find(y=>y.id===d.pid); if (p) Deudas.payForm(x, p); },
    'deu-filter'(d){ App.state.deu_filter = d.f; if (location.hash!=='#/deudas') App.go('#/deudas'); else App.render(); },
    'deu-sort'(){ const o = ['snowball', 'amount', 'oldest', 'priority']; const c = Deudas.cfg(); Deudas.saveCfg({ sort: o[(o.indexOf(c.sort) + 1) % o.length] }); App.render(); },
    'deu-toggle-sale'(d){ const x = Store.list('debts').find(y=>y.id===d.id); if (x){ x.payWithSale = !x.payWithSale; Store.upsert('debts', x); App.render(); } },
    'deu-sale-price'(){ Deudas.salePriceForm(); },
    'deu-sale-project'(){ Deudas.createSaleProject(); },
  },
  css: `.deu-rank{width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}
.deu-paid{opacity:.7}`,
});
