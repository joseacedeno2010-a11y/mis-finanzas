'use strict';
/* Venta del negocio: proyecto prioritario con sus pasos, lo que incluye, interesados y el balance
   (precio de venta − deudas que cubre = lo que te queda libre; deudas no cubiertas = lo que sigue pendiente). */
const Negocio = {
  DEFAULT_STEPS: ['Listar todo lo que incluye el negocio: equipos, inventario, clientes, redes, contratos', 'Definir precio de venta y precio mínimo aceptable', 'Preparar fotos, cifras y descripción atractiva', 'Publicar en 3 lugares: Marketplace, grupos y contactos directos', 'Responder interesados y agendar visitas', 'Negociar y acordar condiciones por escrito', 'Firmar el traspaso y recibir el pago', 'Aplicar el dinero a las deudas que cubre la venta'],
  data(){
    const n = Store.data.settings.negocio;
    if (!n) return null;
    n.steps = n.steps || []; n.includes = n.includes || []; n.contacts = n.contacts || [];
    return n;
  },
  save(patch){ Store.data.settings.negocio = Object.assign({}, this.data() || {}, patch); Store.save(); },
  start(){
    const n = { active: true, createdAt: new Date().toISOString(), salePrice: 0, minPrice: 0, soldPrice: 0, soldAt: null, steps: this.DEFAULT_STEPS.map(t=>({ id: uid(), text: t, done: false, doneAt: null })), includes: [], contacts: [], ad: '' };
    Store.data.settings.negocio = n; Store.save();
    const t = todayISO(); const add = (iso, k)=>{ const x = parseISO(iso); x.setDate(x.getDate() + k); return toISO(x); };
    [['Escribir la lista completa de lo que incluye el negocio', t, 45], ['Definir precio de venta y precio mínimo', add(t, 1), 30], ['Tomar fotos y redactar la descripción de venta', add(t, 2), 60], ['Publicar el negocio en venta en 3 lugares', add(t, 3), 30], ['Avisar a 5 contactos que podría interesarles', add(t, 3), 20]]
      .forEach(([title, date, minutes], i)=>Store.upsert('tasks', { id: uid(), title, date, done: false, doneAt: null, minutes, goalId: 'negocio', order: -10 + i, createdAt: new Date().toISOString() }));
    App.render(); UI.toast('Proyecto creado: 8 pasos y 5 tareas para esta semana 💼');
  },
  /* balance: deudas de la sección Deudas marcadas "con la venta" vs precio */
  balance(){
    const n = this.data() || {}; const price = n.soldPrice || n.salePrice || 0;
    const debts = typeof Deudas!=='undefined' ? Deudas.list().filter(d=>Deudas.isOpen(d)) : [];
    const covered = debts.filter(d=>d.payWithSale); const uncovered = debts.filter(d=>!d.payWithSale);
    const usd = arr=>round2(arr.reduce((s, d)=>s + Deudas.usd(d), 0));
    const coveredUSD = usd(covered), uncoveredUSD = usd(uncovered);
    return { price, covered, uncovered, coveredUSD, uncoveredUSD, free: round2(price - coveredUSD), totalUSD: round2(coveredUSD + uncoveredUSD) };
  },
  progress(){ const n = this.data(); if (!n) return { done: 0, total: 0, pct: 0, next: null }; const done = n.steps.filter(s=>s.done).length; return { done, total: n.steps.length, pct: n.steps.length ? Math.round(done / n.steps.length * 100) : 0, next: n.steps.find(s=>!s.done) || null }; },

  balanceHTML(compact){
    const b = this.balance();
    if (!b.price && !b.totalUSD) return `<div class="small muted">Define el precio estimado y marca en Deudas cuáles se pagan con la venta para ver el balance.</div>`;
    const row = (l, v, cls='')=>`<div class="row between small" style="padding:4px 0"><span class="muted">${l}</span><span class="semibold ${cls}">${v}</span></div>`;
    return `<div class="neg-balance">
      ${row('Venta estimada', b.price ? fmtMoney(b.price) : '<button class="link" data-action="neg-price">Definir</button>')}
      ${row('Deudas que se pagan con la venta', '− ' + fmtMoney(b.coveredUSD))}
      <div class="row between" style="padding:6px 0;border-top:1px solid var(--line);margin-top:4px"><span class="semibold">${b.free >= 0 ? 'Te queda libre' : 'Falta para cubrirlas'}</span><span class="bold ${b.free >= 0 ? 'green' : 'red'}" style="font-size:17px">${fmtMoney(Math.abs(b.free))}</span></div>
      ${row('Deudas que siguen pendientes (aparte)', fmtMoney(b.uncoveredUSD), b.uncoveredUSD ? 'red' : 'green')}
      ${!compact ? row('Total de deudas hoy', fmtMoney(b.totalUSD)) : ''}
    </div>`;
  },

  homeCard(){
    const n = this.data();
    if (!n) return `<div class="card neg-card"><div class="row"><div class="ic acc-ic" style="background:var(--accent-soft)">💼</div><div class="grow"><div class="semibold">Prioridad: vender el negocio</div><div class="small muted">Un proyecto con 8 pasos, lo que incluye, interesados y el balance de qué deudas cubre la venta.</div></div></div><div class="btnrow"><button class="btn sm" data-action="neg-start">Empezar el proyecto</button><button class="btn sm secondary" data-go="#/negocio">Ver</button></div></div>`;
    if (n.soldAt) return `<div class="card neg-card"><div class="row between"><div class="row"><div class="ic acc-ic" style="background:var(--green-soft)">🎉</div><div><div class="semibold">Negocio vendido</div><div class="xs muted">${fmtDate(n.soldAt)} · ${fmtMoney(n.soldPrice)}</div></div></div><a class="link" href="#/negocio">Ver</a></div>${this.balanceHTML(true)}</div>`;
    const p = this.progress(); const nextIdx = p.next ? n.steps.indexOf(p.next) : -1;
    const today = todayISO();
    const tasks = Store.list('tasks').filter(t=>t.goalId==='negocio' && !t.done).sort((a, b)=>(a.date || '9999').localeCompare(b.date || '9999')).slice(0, 3);
    return `<div class="card neg-card"><div class="row between"><div class="row"><div class="ic acc-ic" style="background:var(--accent-soft)">💼</div><div><div class="semibold">Vender el negocio</div><div class="xs muted">Prioridad · ${p.done} de ${p.total} pasos</div></div></div><span class="neg-pct">${p.pct}%</span></div>
      <div class="progress" style="margin-top:10px"><div class="ok" style="width:${p.pct}%"></div></div>
      ${p.next ? `<button class="neg-next" data-action="neg-step" data-id="${p.next.id}"><span class="neg-check">${UI.icon('check')}</span><div class="grow" style="text-align:left"><div class="xs muted">Siguiente paso ${nextIdx + 1} de ${p.total}</div><div class="semibold small">${esc(p.next.text)}</div></div></button>` : `<div class="small green semibold mt">Todos los pasos listos. Marca la venta cuando recibas el pago.</div>`}
      ${tasks.length ? `<div class="neg-tasks">${tasks.map(t=>`<button class="row" style="width:100%;padding:6px 0;text-align:left" data-action="neg-task-done" data-id="${t.id}"><span class="neg-box"></span><span class="grow small">${esc(t.title)}</span><span class="xs ${t.date && t.date < today ? 'red' : 'muted'}">${t.date ? fmtDate(t.date, 'day') : ''}</span></button>`).join('')}</div>` : ''}
      <div class="mt">${this.balanceHTML(true)}</div>
      <div class="btnrow"><button class="btn sm" data-go="#/negocio">Abrir proyecto</button><button class="btn sm secondary" data-go="#/deudas">Deudas</button></div></div>`;
  },

  view(){
    const n = this.data();
    let html = Views.back('#/', 'Vender el negocio');
    if (!n) return html + `<div class="card">${UI.empty('💼', 'Tu proyecto prioritario', 'Vender el negocio para amortizar deudas y liberar peso. Te dejo los 8 pasos, un espacio para anotar lo que incluye, los interesados y el balance con tus deudas.')}<button class="btn" data-action="neg-start">Empezar el proyecto</button></div>`;
    const p = this.progress(); const b = this.balance();
    html += `<div class="hero"><div class="label">${n.soldAt ? 'Vendido el ' + fmtDate(n.soldAt) : 'Avance del proyecto'}</div><div class="big">${n.soldAt ? fmtMoney(n.soldPrice) : p.pct + '%'}</div><div class="sub">${n.soldAt ? 'Ahora aplica el dinero a las deudas marcadas.' : `${p.done} de ${p.total} pasos · ${p.next ? 'siguiente: ' + esc(p.next.text) : 'todo listo'}`}</div>
      <div class="hero-tiles"><button class="hero-tile" data-action="neg-price"><div class="t">💵 Precio</div><div class="v">${n.salePrice ? fmtMoney(n.salePrice) : 'Definir'}</div></button><button class="hero-tile" data-action="neg-price"><div class="t">Mínimo</div><div class="v">${n.minPrice ? fmtMoney(n.minPrice) : '—'}</div></button><div class="hero-tile ${b.free >= 0 ? 'pos' : 'neg'}"><div class="t">${b.free >= 0 ? 'Libre' : 'Falta'}</div><div class="v">${fmtMoney(Math.abs(b.free))}</div></div></div></div>`;
    html += `<div class="card"><div class="card-head"><h3>Balance de la venta</h3><a class="link" href="#/deudas">Marcar deudas</a></div>${this.balanceHTML(false)}
      ${b.covered.length ? `<div class="mt small"><div class="muted xs" style="margin-bottom:4px">Se pagan con la venta</div>${b.covered.map(d=>`<div class="row between" style="padding:3px 0"><span>${esc(d.creditor)}</span><span class="semibold">${fmtMoney(Deudas.outstanding(d), d.currency)}</span></div>`).join('')}</div>` : ''}
      ${b.uncovered.length ? `<div class="mt small"><div class="muted xs" style="margin-bottom:4px">Siguen pendientes, a pagar aparte</div>${b.uncovered.map(d=>`<div class="row between" style="padding:3px 0"><span>${esc(d.creditor)}</span><span class="semibold red">${fmtMoney(Deudas.outstanding(d), d.currency)}</span></div>`).join('')}</div>` : ''}</div>`;
    html += `<div class="section-title"><h2>Pasos</h2><button class="link" data-action="neg-step-add">+ Paso</button></div><div class="card tight"><div class="list">${n.steps.map((s, i)=>`<div class="item"><button class="neg-check ${s.done ? 'on' : ''}" data-action="neg-step" data-id="${s.id}" aria-label="Marcar">${UI.icon('check')}</button><div class="body"><div class="title ${s.done ? 'neg-done' : ''}">${i + 1}. ${esc(s.text)}</div>${s.done && s.doneAt ? `<div class="sub">Hecho ${fmtDate(s.doneAt.slice(0, 10))}</div>` : ''}</div><button class="iconbtn ghost" data-action="neg-step-edit" data-id="${s.id}" aria-label="Editar">${UI.icon('edit')}</button></div>`).join('')}</div></div>`;
    const tasks = Store.list('tasks').filter(t=>t.goalId==='negocio').sort((a, b)=>(a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999'));
    html += `<div class="section-title"><h2>Tareas del proyecto</h2><button class="link" data-action="neg-task-new">+ Tarea</button></div>${tasks.length ? `<div class="card tight"><div class="list">${tasks.map(t=>`<div class="item"><button class="neg-check ${t.done ? 'on' : ''}" data-action="neg-task-done" data-id="${t.id}">${UI.icon('check')}</button><div class="body"><div class="title ${t.done ? 'neg-done' : ''}">${esc(t.title)}</div><div class="sub">${t.date ? fmtDate(t.date, 'day') : 'Sin fecha'}${t.minutes ? ' · ' + t.minutes + ' min' : ''}</div></div></div>`).join('')}</div></div>` : `<div class="card small muted">Sin tareas. Agrega las acciones concretas de esta semana.</div>`}`;
    html += `<div class="section-title"><h2>Qué incluye el negocio</h2><button class="link" data-action="neg-include-add">+ Agregar</button></div>${n.includes.length ? `<div class="card tight"><div class="list">${n.includes.map(x=>`<div class="item"><div class="ic">📦</div><div class="body"><div class="title">${esc(x.text)}</div>${x.value ? `<div class="sub">Valor aprox. ${fmtMoney(x.value)}</div>` : ''}</div><button class="iconbtn ghost" data-action="neg-include-del" data-id="${x.id}" aria-label="Quitar">${UI.icon('trash')}</button></div>`).join('')}</div>${n.includes.some(x=>x.value) ? `<div class="row between small" style="padding:8px 16px;border-top:1px solid var(--line)"><span class="muted">Suma de valores</span><span class="semibold">${fmtMoney(n.includes.reduce((s, x)=>s + (x.value || 0), 0))}</span></div>` : ''}</div>` : `<div class="card small muted">Anota equipos, inventario, clientes, redes, contratos, local. Esto es la base del anuncio y del precio.</div>`}`;
    html += `<div class="section-title"><h2>Anuncio</h2><button class="link" data-action="neg-ad">${n.ad ? 'Editar' : 'Redactar'}</button></div><div class="card">${n.ad ? `<div class="small" style="white-space:pre-wrap">${esc(n.ad)}</div><div class="btnrow"><button class="btn secondary sm" data-action="neg-ad-copy">Copiar anuncio</button></div>` : `<div class="small muted">Título, qué incluye, cifras que puedas mostrar, precio y forma de contacto. Cuando lo redactes podrás copiarlo con un toque para publicarlo.</div>`}</div>`;
    html += `<div class="section-title"><h2>Interesados</h2><button class="link" data-action="neg-contact-add">+ Interesado</button></div>${n.contacts.length ? `<div class="card tight"><div class="list">${n.contacts.map(c=>`<button class="item clickable" data-action="neg-contact-edit" data-id="${c.id}">${UI.avatar(c.name)}<div class="body"><div class="title">${esc(c.name)}</div><div class="sub">${esc(c.note || '')}</div></div><span class="badge ${c.status==='oferta' ? 'g' : c.status==='visita' ? 'b' : c.status==='descartado' ? 'r' : ''}">${{ contacto:'Contacto', visita:'Visita', oferta:'Oferta', descartado:'Descartado' }[c.status] || 'Contacto'}${c.offer ? ' · ' + fmtMoney(c.offer) : ''}</span></button>`).join('')}</div></div>` : `<div class="card small muted">Cada persona que pregunte, con su estado: contacto, visita, oferta.</div>`}`;
    html += n.soldAt ? `<button class="btn secondary" data-action="neg-unsold">Deshacer venta</button>` : `<button class="btn" data-action="neg-sold">${UI.icon('check')} Marcar como vendido</button>`;
    return html;
  },

  /* ---------- hojas ---------- */
  priceForm(){
    const n = this.data();
    const s = UI.sheet({ title:'Precio de venta', html:`<div class="field"><label>Precio estimado (USD)</label><input name="price" inputmode="decimal" value="${n.salePrice || ''}" placeholder="Ej. 3000" autofocus></div><div class="field"><label>Precio mínimo que aceptarías (USD)</label><input name="min" inputmode="decimal" value="${n.minPrice || ''}" placeholder="Opcional"></div><button class="btn" data-save>Guardar</button>` });
    s.body.querySelector('[data-save]').onclick = ()=>{ const p = parseAmount(Forms.val(s.body, 'price')); if (!isFinite(p) || p <= 0) return UI.toast('Escribe el precio', true); const m = parseAmount(Forms.val(s.body, 'min')); this.save({ salePrice: round2(p), minPrice: isFinite(m) && m > 0 ? round2(m) : 0 }); s.close(); App.render(); };
  },
  stepForm(step=null){
    const n = this.data();
    const s = UI.sheet({ title: step ? 'Editar paso' : 'Nuevo paso', html:`<div class="field"><label>Paso</label><input name="text" value="${esc(step ? step.text : '')}" placeholder="Qué hay que hacer" autofocus></div><button class="btn" data-save>Guardar</button>${step ? '<div class="btnrow"><button class="btn secondary sm" data-up>Subir</button><button class="btn secondary sm" data-down>Bajar</button><button class="btn danger sm" data-del>Quitar</button></div>' : ''}` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{ const text = Forms.val(f, 'text'); if (!text) return UI.toast('Escribe el paso', true); if (step) step.text = text; else n.steps.push({ id: uid(), text, done: false, doneAt: null }); this.save({ steps: n.steps }); s.close(); App.render(); };
    if (step){
      const move = dir=>{ const i = n.steps.indexOf(step); const j = i + dir; if (j < 0 || j >= n.steps.length) return; n.steps.splice(i, 1); n.steps.splice(j, 0, step); this.save({ steps: n.steps }); s.close(); App.render(); };
      f.querySelector('[data-up]').onclick = ()=>move(-1); f.querySelector('[data-down]').onclick = ()=>move(1);
      f.querySelector('[data-del]').onclick = async ()=>{ if (await UI.confirm('¿Quitar este paso?', { ok:'Quitar' })){ this.save({ steps: n.steps.filter(x=>x!==step) }); s.close(); App.render(); } };
    }
  },
  includeForm(){
    const n = this.data();
    const s = UI.sheet({ title:'¿Qué incluye?', html:`<div class="field"><label>Elemento</label><input name="text" placeholder="Ej. 2 laptops, base de 300 clientes, cuenta de Instagram con 5k" autofocus></div><div class="field"><label>Valor aproximado (USD)</label><input name="value" inputmode="decimal" placeholder="Opcional"></div><button class="btn" data-save>Agregar</button><div class="xs muted center mt">La hoja queda abierta para seguir agregando.</div>` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{ const text = Forms.val(f, 'text'); if (!text) return UI.toast('Escribe qué incluye', true); const v = parseAmount(Forms.val(f, 'value')); n.includes.push({ id: uid(), text, value: isFinite(v) && v > 0 ? round2(v) : 0 }); this.save({ includes: n.includes }); f.querySelector('[name=text]').value = ''; f.querySelector('[name=value]').value = ''; f.querySelector('[name=text]').focus(); UI.toast(`${n.includes.length} elemento${n.includes.length===1 ? '' : 's'}`); App.render(); };
  },
  adForm(){
    const n = this.data(); const inc = n.includes.map(x=>'• ' + x.text).join('\n');
    const draft = n.ad || `SE VENDE NEGOCIO EN MARCHA\n\nIncluye:\n${inc || '• (lista lo que incluye)'}\n\nPrecio: ${n.salePrice ? fmtMoney(n.salePrice) : '(definir)'}\nMotivo de venta: enfoque en nuevos proyectos.\nContacto: (tu número o correo)`;
    const s = UI.sheet({ title:'Anuncio de venta', html:`<div class="field"><textarea name="ad" style="min-height:220px">${esc(draft)}</textarea></div><button class="btn" data-save>Guardar</button>` });
    s.body.querySelector('[data-save]').onclick = ()=>{ this.save({ ad: s.body.querySelector('[name=ad]').value.trim() }); s.close(); App.render(); UI.toast('Anuncio guardado'); };
  },
  contactForm(c=null){
    const n = this.data();
    const s = UI.sheet({ title: c ? 'Interesado' : 'Nuevo interesado', html:`<div class="field"><label>Nombre</label><input name="name" value="${esc(c ? c.name : '')}" autofocus></div><div class="field"><label>Estado</label><select name="status">${[['contacto', 'Contacto'], ['visita', 'Visita agendada'], ['oferta', 'Hizo oferta'], ['descartado', 'Descartado']].map(([k, l])=>`<option value="${k}"${c && c.status===k ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="field"><label>Oferta (USD)</label><input name="offer" inputmode="decimal" value="${c && c.offer ? c.offer : ''}" placeholder="Si hizo oferta"></div><div class="field"><label>Nota</label><input name="note" value="${esc(c ? c.note || '' : '')}" placeholder="Teléfono, de dónde vino, próximo paso"></div><button class="btn" data-save>Guardar</button>${c ? '<button class="btn danger mt" data-del>Eliminar</button>' : ''}` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{ const name = Forms.val(f, 'name'); if (!name) return UI.toast('Escribe el nombre', true); const o = parseAmount(Forms.val(f, 'offer')); const obj = { id: c ? c.id : uid(), name, status: Forms.val(f, 'status'), offer: isFinite(o) && o > 0 ? round2(o) : 0, note: Forms.val(f, 'note') }; const i = n.contacts.findIndex(x=>x.id===obj.id); if (i >= 0) n.contacts[i] = obj; else n.contacts.push(obj); this.save({ contacts: n.contacts }); s.close(); App.render(); };
    const del = f.querySelector('[data-del]'); if (del) del.onclick = ()=>{ this.save({ contacts: n.contacts.filter(x=>x.id!==c.id) }); s.close(); App.render(); };
  },
  soldForm(){
    const n = this.data(); const b = this.balance();
    const s = UI.sheet({ title:'¡Vendido! 🎉', html:`<div class="field"><label>Precio final recibido (USD)</label><input name="price" inputmode="decimal" value="${n.salePrice || ''}" autofocus></div><div class="field"><label>Fecha</label><input type="date" name="date" value="${todayISO()}"></div>${b.covered.length ? `<div class="field inline"><label>Marcar como saldadas las ${b.covered.length} deudas cubiertas (${fmtMoney(b.coveredUSD)})</label><button class="switch on" data-sw type="button"></button></div>` : ''}<button class="btn" data-save>Confirmar venta</button>` });
    const f = s.body; let settle = true; const sw = f.querySelector('[data-sw]'); if (sw) sw.onclick = ()=>{ settle = !settle; sw.classList.toggle('on', settle); };
    f.querySelector('[data-save]').onclick = ()=>{
      const p = parseAmount(Forms.val(f, 'price')); if (!isFinite(p) || p <= 0) return UI.toast('Escribe el precio recibido', true);
      const date = Forms.val(f, 'date') || todayISO();
      this.save({ soldPrice: round2(p), soldAt: date });
      n.steps.forEach(st=>{ if (!st.done){ st.done = true; st.doneAt = new Date().toISOString(); } }); this.save({ steps: n.steps });
      if (settle && b.covered.length){ b.covered.forEach(d=>{ d.payments = d.payments || []; const out = Deudas.outstanding(d); if (out > 0) d.payments.push({ id: uid(), amount: out, date, note: 'Pagada con la venta del negocio' }); d.status = 'paid'; Store.upsert('debts', d); }); }
      s.close(); App.go('#/negocio'); App.render(); UI.toast('¡Felicitaciones! Negocio vendido 🎉');
    };
  },
};
App.registerModule({
  id: 'negocio', name: 'Vender el negocio', icon: '💼',
  routes: [[/^#\/negocio$/, ()=>Negocio.view(), 'home']],
  menu: [{ hash: '#/negocio', icon: 'dollar', label: 'Negocio' }],
  homeCards: [{ order: 4, render: ()=>Negocio.homeCard() }],
  actions: {
    'neg-start'(){ Negocio.start(); },
    'neg-price'(){ if (!Negocio.data()) Negocio.start(); Negocio.priceForm(); },
    'neg-step'(d){ const n = Negocio.data(); const s = n && n.steps.find(x=>x.id===d.id); if (!s) return; s.done = !s.done; s.doneAt = s.done ? new Date().toISOString() : null; Negocio.save({ steps: n.steps }); App.render(); if (s.done){ const p = Negocio.progress(); UI.toast(p.next ? `Paso listo. Siguiente: ${p.next.text.slice(0, 40)}…` : 'Todos los pasos completados 🎉'); } },
    'neg-step-add'(){ Negocio.stepForm(); },
    'neg-step-edit'(d){ const n = Negocio.data(); const s = n && n.steps.find(x=>x.id===d.id); if (s) Negocio.stepForm(s); },
    'neg-task-done'(d){ const t = Store.list('tasks').find(x=>x.id===d.id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; Store.upsert('tasks', t); App.render(); },
    'neg-task-new'(){ const s = UI.sheet({ title:'Tarea del proyecto', html:`<div class="field"><label>Tarea</label><input name="title" autofocus></div><div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${todayISO()}"></div><div class="field"><label>Minutos</label><input name="minutes" inputmode="numeric" placeholder="Opcional"></div></div><button class="btn" data-save>Agregar</button>` }); s.body.querySelector('[data-save]').onclick = ()=>{ const title = Forms.val(s.body, 'title'); if (!title) return UI.toast('Escribe la tarea', true); Store.upsert('tasks', { id: uid(), title, date: Forms.val(s.body, 'date') || null, done: false, doneAt: null, minutes: parseInt(Forms.val(s.body, 'minutes'), 10) || null, goalId: 'negocio', order: Date.now(), createdAt: new Date().toISOString() }); s.close(); App.render(); }; },
    'neg-include-add'(){ Negocio.includeForm(); },
    'neg-include-del'(d){ const n = Negocio.data(); Negocio.save({ includes: n.includes.filter(x=>x.id!==d.id) }); App.render(); },
    'neg-ad'(){ Negocio.adForm(); },
    async 'neg-ad-copy'(){ try { await navigator.clipboard.writeText(Negocio.data().ad); UI.toast('Anuncio copiado. Pégalo donde vayas a publicar.'); } catch(e){ UI.toast('No se pudo copiar', true); } },
    'neg-contact-add'(){ Negocio.contactForm(); },
    'neg-contact-edit'(d){ const n = Negocio.data(); const c = n.contacts.find(x=>x.id===d.id); if (c) Negocio.contactForm(c); },
    'neg-sold'(){ Negocio.soldForm(); },
    async 'neg-unsold'(){ if (await UI.confirm('¿Deshacer la venta? Las deudas marcadas como pagadas no se revierten solas.', { ok:'Deshacer' })){ Negocio.save({ soldAt: null, soldPrice: 0 }); App.render(); } },
  },
  css: `.neg-card{border:1px solid var(--accent)}
.neg-pct{font-weight:800;font-size:18px;color:var(--accent)}
.neg-next{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--accent-soft);text-align:left}
.neg-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--accent);display:inline-flex;align-items:center;justify-content:center;color:transparent;flex:none;background:var(--card)}
.neg-check svg{width:15px;height:15px}
.neg-check.on{background:var(--accent);color:var(--accent-ink)}
.neg-next .neg-check{color:var(--accent);opacity:.7}
.neg-done{text-decoration:line-through;color:var(--muted)}
.neg-tasks{margin-top:8px;border-top:1px solid var(--line);padding-top:4px}
.neg-box{width:18px;height:18px;border-radius:6px;border:2px solid var(--line);flex:none;margin-right:8px}
.neg-balance{margin-top:6px}`,
});
