'use strict';
/* Enrutador, eventos y arranque */
const APP_VERSION = '1.5.1';
const App = {
  state: { viewCur:'USD', month: thisMonthKey(), q:'', fAcc:'', pq:'', catKind:'expense', accCur:'all', accSort:'fav' },
  routes: [
    [/^#\/?$/, ()=>Views.home(), 'home'],
    [/^#\/movimientos$/, ()=>Views.movements(), 'mov'],
    [/^#\/personas$/, ()=>Views.people(), 'people'],
    [/^#\/personas\/([\w-]+)$/, m=>Views.person(m[1]), 'people'],
    [/^#\/balance$/, ()=>Views.balance(), 'balance'],
    [/^#\/menu$/, ()=>Views.menu(), 'menu'],
    [/^#\/cuentas$/, ()=>Views.accounts(), 'menu'],
    [/^#\/cuentas\/([\w-]+)$/, m=>Views.account(m[1]), 'menu'],
    [/^#\/categorias$/, ()=>Views.categories(), 'menu'],
    [/^#\/tasas$/, ()=>Views.rates(), 'menu'],
    [/^#\/presupuesto$/, ()=>Views.budget(), 'menu'],
  ],
  tabs: [['#/', 'home', 'Inicio', 'home'], ['#/movimientos', 'list', 'Movimientos', 'mov'], ['#/personas', 'users', 'Personas', 'people'], ['#/balance', 'scale', 'Balance', 'balance'], ['#/menu', 'grid', 'Menú', 'menu']],
  _lastHash: null,

  go(hash){ if (location.hash===hash) this.render(); else location.hash = hash; },
  render(){
    const hash = location.hash || '#/';
    let html = '', tab = 'home';
    for (const [re, fn, t] of this.routes){ const m = hash.match(re); if (m){ try { html = fn(m); } catch(e){ console.error(e); html = `<div class="card"><div class="red bold">Error al mostrar esta pantalla</div><div class="small muted">${esc(e.message)}</div></div>`; } tab = t; break; } }
    if (!html){ location.hash = '#/'; return; }
    const y = window.scrollY;
    document.getElementById('app').innerHTML = html;
    document.querySelectorAll('#tabbar a').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
    if (this._lastHash===hash) window.scrollTo(0, y); else window.scrollTo(0, 0);
    this._lastHash = hash;
  },

  init(){
    Store.load();
    document.getElementById('tabbar').innerHTML = this.tabs.map(([h, i, l, t])=>`<a href="${h}" data-tab="${t}">${UI.icon(i)}<span>${l}</span></a>`).join('');
    document.getElementById('fab').innerHTML = UI.icon('plus');
    window.addEventListener('hashchange', ()=>this.render());
    document.addEventListener('click', e=>this.onClick(e));
    document.addEventListener('input', e=>{
      if (e.target.matches('[data-search]')){ this.state.q = e.target.value; const l = document.getElementById('list'); if (l) l.innerHTML = Views.movementsList(); }
      if (e.target.matches('[data-search-people]')){ this.state.pq = e.target.value; const l = document.getElementById('list'); if (l) l.innerHTML = Views.peopleList(); }
    });
    document.addEventListener('change', e=>{
      if (e.target.matches('[data-filter-acc]')){ this.state.fAcc = e.target.value; const l = document.getElementById('list'); if (l) l.innerHTML = Views.movementsList(); }
    });
    document.addEventListener('keydown', e=>{ if (e.key==='Escape'){ const ov = document.querySelector('#modal-root .overlay:last-child'); if (ov){ ov.remove(); if (!document.querySelector('#modal-root .overlay')) document.body.style.overflow=''; } } });
    this.render();
    Sync.init();
    this.autoRates();
    if ('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost', '127.0.0.1'].includes(location.hostname))){
      navigator.serviceWorker.register('sw.js').then(reg=>{
        this._swReg = reg;
        reg.update().catch(()=>{});
        // cuando hay una versión nueva instalada, recargar para usarla
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if (refreshing) return; refreshing = true; if (navigator.serviceWorker.controller) location.reload(); });
        reg.addEventListener('updatefound', ()=>{ const nw = reg.installing; if (!nw) return; nw.addEventListener('statechange', ()=>{ if (nw.state==='installed' && navigator.serviceWorker.controller) UI.toast('Actualizando la app…'); }); });
        // revisar actualizaciones al volver a la app
        document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState==='visible') reg.update().catch(()=>{}); });
      }).catch(()=>{});
    }
  },
  async autoRates(){
    if (!Store.data.settings.autoRates || !navigator.onLine || !Rates.isStale(30)) return;
    const r = await Rates.refresh();
    if (r){ this.render(); if (r.failed.length) UI.toast('No se pudo actualizar: ' + r.failed.join(', '), true); }
  },
  async refreshRates(force=false){
    if (!navigator.onLine) return UI.toast('Sin conexión a internet', true);
    document.querySelectorAll('[data-action="refresh-rates"]').forEach(b=>b.classList.add('spin'));
    const r = await Rates.refresh({ force });
    this.render();
    if (!r) return;
    if (r.failed.length && r.ok.length) UI.toast(`Actualizado. Falló: ${r.failed.join(', ')}`, true);
    else if (r.failed.length) UI.toast('No se pudieron obtener las tasas', true);
    else UI.toast('Tasas actualizadas');
  },

  onClick(e){
    const el = e.target.closest('[data-action],[data-go]');
    if (!el) return;
    if (el.dataset.go){ e.preventDefault(); this.go(el.dataset.go); return; }
    const fn = this.actions[el.dataset.action];
    if (fn) fn.call(this, el.dataset, el);
  },
  download(name, text, type='application/json'){
    const b = new Blob([text], { type }); const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(u), 3000);
  },
  csv(){
    const rows = [['Fecha', 'Tipo', 'Detalle', 'Monto', 'Moneda', 'Cuenta', 'Cuenta destino', 'Monto destino', 'Persona', 'Nota', 'Equivalente USD']];
    const label = { income:'Ingreso', expense:'Egreso', transfer:'Transferencia', loan_out:'Presté', loan_in:'Me prestaron', loan_collect:'Abono recibido', loan_repay:'Pago de deuda' };
    for (const t of [...Store.data.transactions].sort((a,b)=>a.date.localeCompare(b.date))){
      const v = Views.txView(t); const acc = Store.account(t.accountId); const to = Store.account(t.toAccountId); const p = Store.person(t.personId);
      const sign = (t.kind==='income' || t.kind==='loan_in' || t.kind==='loan_collect') ? 1 : -1;
      rows.push([t.date, label[t.kind] || t.kind, v.title, sign * t.amount, t.currency, acc ? acc.name : '', to ? to.name : '', t.toAmount ?? '', p ? p.name : '', t.note || '', round2(sign * Calc.txUSD(t))]);
    }
    return '﻿' + rows.map(r=>r.map(x=>{ const s = String(x ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  },

  actions: {
    async fab(){
      const v = await UI.options('¿Qué quieres registrar?', [
        { value:'expense', icon:'down', cls:'r', label:'Egreso', sub:'Un gasto desde una cuenta' },
        { value:'income', icon:'up', cls:'g', label:'Ingreso', sub:'Dinero que entra a una cuenta' },
        { value:'transfer', icon:'swap', cls:'b', label:'Transferencia', sub:'Mover entre cuentas, incluso en otra moneda' },
        { value:'lent', icon:'dollar', cls:'r', label:'Le presté a alguien', sub:'Se suma a lo que esa persona te debe' },
        { value:'borrowed', icon:'dollar', cls:'g', label:'Me prestaron', sub:'Se suma a lo que le debes a esa persona' },
        { value:'pay', icon:'check', cls:'a', label:'Abono o pago de préstamo', sub:'Registrar un pago parcial o total' },
      ]);
      if (!v) return;
      if (v==='expense' || v==='income') Forms.transaction(null, v);
      else if (v==='transfer') Forms.transfer();
      else if (v==='lent' || v==='borrowed') Forms.loan({ direction: v });
      else if (v==='pay') this.actions['pay-any'].call(this);
    },
    'new-tx'(d){ Forms.transaction(null, d.kind || 'expense', d.acc || null); },
    'new-transfer'(d){ Forms.transfer(null, d.acc || null); },
    'new-loan'(d){ Forms.loan({ direction: d.direction || 'lent', personId: d.person || null }); },
    'edit-loan'(d){ const l = Store.loan(d.id); if (l) Forms.loan({ loan: l }); },
    'pay'(d){ const l = Store.loan(d.id); if (l) Forms.payment({ loan: l }); },
    'edit-payment'(d){ const l = Store.loan(d.loan); const p = l && l.payments.find(x=>x.id===d.pid); if (p) Forms.payment({ loan: l, payment: p }); },
    async 'pay-person'(d){
      const open = Calc.personLoans(d.id).filter(l=>Calc.loanIsOpen(l));
      if (!open.length) return UI.toast('No hay préstamos pendientes', true);
      if (open.length===1) return Forms.payment({ loan: open[0] });
      const l = await UI.options('¿A cuál préstamo?', open.map(l=>({ value:l, icon:'dollar', cls: l.direction==='lent' ? 'g' : 'r', label:`${l.direction==='lent' ? 'Te debe' : 'Le debes'} ${fmtMoney(Calc.loanOutstanding(l), l.currency)}`, sub:`${fmtDate(l.date)}${l.note ? ' · ' + l.note : ''}` })));
      if (l) Forms.payment({ loan: l });
    },
    async 'pay-any'(){
      const open = Store.data.loans.filter(l=>Calc.loanIsOpen(l)).sort((a,b)=>b.date.localeCompare(a.date));
      if (!open.length) return UI.toast('No hay préstamos pendientes', true);
      const l = await UI.options('¿A cuál préstamo?', open.map(l=>{ const p = Store.person(l.personId); return { value:l, icon:'dollar', cls: l.direction==='lent' ? 'g' : 'r', label:`${p ? p.name : '?'} · ${l.direction==='lent' ? 'te debe' : 'le debes'} ${fmtMoney(Calc.loanOutstanding(l), l.currency)}`, sub:`${fmtDate(l.date)}${l.note ? ' · ' + l.note : ''}` }; }));
      if (l) Forms.payment({ loan: l });
    },
    'tx'(d){
      const t = Store.tx(d.id); if (!t) return;
      if (t.loanId){
        const l = Store.loan(t.loanId); if (!l) return UI.toast('Préstamo no encontrado', true);
        if (t.paymentId){ const p = l.payments.find(x=>x.id===t.paymentId); return p ? Forms.payment({ loan: l, payment: p }) : Forms.loan({ loan: l }); }
        return Forms.loan({ loan: l });
      }
      if (t.kind==='transfer') return Forms.transfer(t);
      Forms.transaction(t);
    },
    'new-person'(){ Forms.person(null, p=>this.go('#/personas/' + p.id)); },
    'edit-person'(d){ const p = Store.person(d.id); if (p) Forms.person(p); },
    'new-account'(){ Forms.account(); },
    'acc-filter'(d){ this.state.accCur = d.cur; this.render(); },
    'acc-sort'(){ const order = ['fav', 'balance', 'name']; this.state.accSort = order[(order.indexOf(this.state.accSort) + 1) % order.length]; this.render(); },
    'fav-account'(d){ const a = Store.account(d.id); if (!a) return; a.favorite = !a.favorite; Store.save(); this.render(); },
    'edit-account'(d){ const a = Store.account(d.id); if (a) Forms.account(a); },
    'new-category'(d){ Forms.category(null, d.kind || 'expense'); },
    'edit-category'(d){ const c = Store.category(d.id); if (c) Forms.category(c); },
    'cat-kind'(d){ this.state.catKind = d.kind; this.render(); },
    'toggle'(d){ this.state[d.key] = !this.state[d.key]; this.render(); },
    'people-filter'(d){ this.state.peopleFilter = d.f; this.render(); },
    'people-sort'(){ const o = ['balance', 'name', 'due']; this.state.peopleSort = o[(o.indexOf(this.state.peopleSort || 'balance') + 1) % o.length]; this.render(); },
    'bmonth'(d){ this.state.bMonth = shiftMonth(this.state.bMonth || thisMonthKey(), Number(d.delta)); this.render(); },
    'new-budget'(d){ Forms.budget({ catId: d.cat || null }); },
    'edit-budget'(d){ Forms.budget({ id: d.id }); },
    'sync-login'(){ Forms.syncLogin(); },
    async 'check-update'(){
      if (!navigator.onLine) return UI.toast('Sin conexión a internet', true);
      UI.toast('Buscando actualización…');
      try {
        if (this._swReg){ await this._swReg.update(); if (this._swReg.installing || this._swReg.waiting) return; }
        const r = await fetch('js/app.js?v=' + Date.now(), { cache:'no-store' }); const txt = await r.text();
        const m = txt.match(/APP_VERSION = '([^']+)'/);
        if (m && m[1]!==APP_VERSION){ UI.toast(`Hay una versión nueva (${m[1]}). Recargando…`); setTimeout(()=>location.reload(), 800); }
        else UI.toast(`Ya tienes la última versión (${APP_VERSION})`);
      } catch(e){ UI.toast('No se pudo comprobar', true); }
    },
    async 'sync-logout'(){
      if (!(await UI.confirm('¿Cerrar sesión? Los datos quedan guardados en la nube y en este dispositivo.', { ok:'Cerrar sesión', danger:false }))) return;
      await Sync.signOut(); UI.toast('Sesión cerrada');
    },
    'viewcur'(d){ this.state.viewCur = d.cur; this.render(); },
    'month'(d){ this.state.month = shiftMonth(this.state.month, Number(d.delta)); this.render(); },
    'refresh-rates'(d){ this.refreshRates(!!d.force); },
    'edit-rate'(d){ Forms.rate(d.cur); },
    'toggle-auto'(){ Store.data.settings.autoRates = !Store.data.settings.autoRates; Store.save(); this.render(); },
    'export-json'(){ this.download(`finanzas-respaldo-${todayISO()}.json`, Store.exportJSON()); UI.toast('Respaldo generado'); },
    async 'copy-json'(){
      const text = JSON.stringify(Store.data);
      try { await navigator.clipboard.writeText(text); UI.toast('Respaldo copiado. Pégalo en el otro dispositivo con "Pegar respaldo".'); }
      catch(e){
        const s = UI.sheet({ title:'Copiar respaldo', html:`<div class="small muted mb">Mantén presionado el texto, elige "Seleccionar todo" y luego "Copiar".</div><div class="field"><textarea readonly style="min-height:160px;font-size:12px">${esc(text)}</textarea></div>` });
        const ta = s.body.querySelector('textarea'); ta.focus(); ta.select();
      }
    },
    'paste-json'(){
      const s = UI.sheet({ title:'Pegar respaldo', html:`<div class="small muted mb">Pega aquí el respaldo copiado. Reemplazará todos los datos de este dispositivo.</div><div class="field"><textarea name="json" placeholder='{"version":1, ...}' style="min-height:140px;font-size:12px"></textarea></div><button class="btn" data-restore>Restaurar datos</button>` });
      s.body.querySelector('[data-restore]').onclick = async ()=>{
        const text = s.body.querySelector('[name=json]').value.trim(); if (!text) return UI.toast('Pega el respaldo primero', true);
        const n = Store.data.transactions.length + Store.data.accounts.length + Store.data.people.length;
        if (n && !(await UI.confirm('Esto reemplazará los datos actuales de este dispositivo. ¿Continuar?', { ok:'Restaurar', danger:false }))) return;
        try { Store.importJSON(text); s.close(); this.go('#/'); this.render(); UI.toast('Datos restaurados ✅'); }
        catch(e){ UI.toast('El texto no es un respaldo válido', true); }
      };
    },
    'export-csv'(){ this.download(`movimientos-${todayISO()}.csv`, this.csv(), 'text/csv;charset=utf-8'); UI.toast('CSV generado'); },
    'import-json'(){
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async ()=>{
        const file = inp.files[0]; if (!file) return;
        if (!(await UI.confirm('Esto reemplazará todos los datos actuales por los del archivo. ¿Continuar?', { ok:'Importar', danger:false }))) return;
        try { Store.importJSON(await file.text()); this.render(); UI.toast('Datos importados'); }
        catch(e){ UI.toast('No se pudo importar: ' + e.message, true); }
      };
      inp.click();
    },
    async 'reset'(){
      if (!(await UI.confirm(Sync.user ? '¿Borrar TODOS los datos, también en la nube? No se puede deshacer.' : '¿Borrar TODOS los datos de este dispositivo? No se puede deshacer.'))) return;
      Store.reset(); this.go('#/'); this.render(); UI.toast('Datos borrados');
    },
  },
};
document.addEventListener('DOMContentLoaded', ()=>App.init());
