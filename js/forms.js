'use strict';
/* Formularios en hojas modales */
const Forms = {
  accountOptions(selectedId, { allowNone=false, noneLabel='Sin cuenta (no afecta saldos)' }={}){
    let html = allowNone ? `<option value=""${!selectedId?' selected':''}>${esc(noneLabel)}</option>` : '';
    for (const a of Store.accountsSorted()){
      if (a.archived && a.id!==selectedId) continue;
      html += `<option value="${a.id}" data-cur="${a.currency}"${a.id===selectedId?' selected':''}>${esc(a.name)} · ${fmtMoney(Calc.accountBalance(a), a.currency)}</option>`;
    }
    return html;
  },
  currencyOptions(sel){ return CURRENCY_ORDER.map(c=>`<option value="${c}"${c===sel?' selected':''}>${c} · ${CURRENCIES[c].name}</option>`).join(''); },
  categoryOptions(kind, sel){ return Store.data.categories.filter(c=>c.kind===kind).map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${c.icon} ${esc(c.name)}</option>`).join(''); },
  personOptions(sel){
    return `<option value=""${!sel?' selected':''}>Selecciona una persona</option>` +
      Store.peopleSorted().map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${esc(p.name)}</option>`).join('') +
      `<option value="__new">＋ Nueva persona…</option>`;
  },
  amountHTML(value, curLabel, name='amount'){
    return `<div class="amount-wrap"><div class="cur" data-curlbl>${esc(curLabel)}</div><input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${value!=null?esc(value):''}"></div>`;
  },
  val(f, name){ const el = f.querySelector(`[name="${name}"]`); return el ? el.value.trim() : ''; },
  amount(f, name='amount'){ const v = parseAmount(this.val(f, name)); return isFinite(v) && v > 0 ? round2(v) : null; },
  selCur(select){ const o = select && select.selectedOptions[0]; return o ? (o.dataset.cur || null) : null; },
  focusAmount(f){ const i = f.querySelector('[name=amount]'); if (i) setTimeout(()=>i.focus(), 120); },

  /* campo de monto en otra moneda (cuando la cuenta no está en la moneda del monto) */
  bindCross(f, getFrom, getTo, { touched=false }={}){
    const box = f.querySelector('[data-cross]'); if (!box) return ()=>{};
    const input = box.querySelector('[name=crossAmount]');
    let userTouched = touched;
    input.addEventListener('input', ()=>{ userTouched = true; });
    const update = ()=>{
      const from = getFrom(), to = getTo();
      const amount = this.amount(f);
      if (!from || !to || from===to){ box.classList.add('hide'); return; }
      box.classList.remove('hide');
      box.querySelector('[data-crosscur]').textContent = CURRENCIES[to].name;
      const conv = amount ? Calc.convert(amount, from, to) : 0;
      if (!userTouched){ input.value = amount && conv ? String(CURRENCIES[to].decimals===0 ? Math.round(conv) : round2(conv)) : ''; }
      box.querySelector('[data-crosshint]').textContent = conv ? `Según la tasa actual: ${fmtMoney(conv, to)}. Ajústalo si el monto real fue otro.` : 'No hay tasa disponible; escribe el monto manualmente.';
    };
    f.querySelector('[name=amount]').addEventListener('input', update);
    return update;
  },
  crossHTML(label, value){
    return `<div class="field hide" data-cross><label>${label} <span data-crosscur></span></label><input name="crossAmount" inputmode="decimal" autocomplete="off" value="${value!=null?esc(value):''}"><div class="hint" data-crosshint></div></div>`;
  },

  /* ---------- Ingreso / egreso ---------- */
  transaction(tx=null, kind='expense', accId=null){
    const editing = !!tx; if (tx) kind = tx.kind;
    const acc0 = tx ? Store.account(tx.accountId) : (accId ? Store.account(accId) : Store.accountsSorted()[0]);
    const s = UI.sheet({ title: editing ? 'Editar movimiento' : (kind==='income' ? 'Nuevo ingreso' : 'Nuevo egreso'), html: `
      <div class="seg mb" data-seg><button data-k="expense" class="${kind==='expense'?'active r':''}">Egreso</button><button data-k="income" class="${kind==='income'?'active g':''}">Ingreso</button></div>
      ${this.amountHTML(tx ? tx.amount : null, acc0 ? CURRENCIES[acc0.currency].name : '')}
      <div class="field"><label>Cuenta</label><select name="account">${this.accountOptions(tx ? tx.accountId : (acc0 && acc0.id))}</select></div>
      <div class="field"><label>Categoría</label><select name="category">${this.categoryOptions(kind, tx && tx.categoryId)}</select></div>
      <div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${tx ? tx.date : todayISO()}"></div><div class="field"><label>Nota</label><input name="note" placeholder="Opcional" value="${esc(tx ? tx.note : '')}"></div></div>
      <button class="btn" data-save>${editing ? 'Guardar cambios' : 'Guardar'}</button>
      ${editing ? '<button class="btn danger mt" data-del>Eliminar movimiento</button>' : ''}` });
    const f = s.body;
    const accSel = f.querySelector('[name=account]');
    const upd = ()=>{ const c = this.selCur(accSel); f.querySelector('[data-curlbl]').textContent = c ? CURRENCIES[c].name : ''; };
    accSel.onchange = upd; upd();
    f.querySelector('[data-seg]').onclick = e=>{
      const b = e.target.closest('[data-k]'); if (!b) return;
      kind = b.dataset.k;
      f.querySelectorAll('[data-seg] button').forEach(x=>x.className='');
      b.className = 'active ' + (kind==='income' ? 'g' : 'r');
      f.querySelector('[name=category]').innerHTML = this.categoryOptions(kind, null);
    };
    f.querySelector('[data-save]').onclick = ()=>{
      const amount = this.amount(f); if (!amount) return UI.toast('Escribe un monto válido', true);
      const acc = Store.account(accSel.value); if (!acc) return UI.toast('Selecciona una cuenta', true);
      const date = this.val(f, 'date') || todayISO();
      const keepRate = tx && tx.date===date && tx.currency===acc.currency ? tx.rateUSD : null;
      Store.saveTx({ id: tx ? tx.id : undefined, createdAt: tx ? tx.createdAt : undefined, kind, amount, currency: acc.currency, accountId: acc.id,
        categoryId: this.val(f, 'category') || null, date, note: this.val(f, 'note'), rateUSD: keepRate });
      s.close(); App.render(); UI.toast('Movimiento guardado');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm('¿Eliminar este movimiento?')){ Store.deleteTx(tx.id); s.close(); App.render(); UI.toast('Eliminado'); } };
    if (!editing) this.focusAmount(f);
  },

  /* ---------- Transferencia ---------- */
  transfer(tx=null, fromId=null){
    const accs = Store.accountsSorted();
    if (accs.length < 2 && !tx) return UI.toast('Necesitas al menos dos cuentas', true);
    const from0 = tx ? tx.accountId : (fromId || (accs[0] && accs[0].id));
    const to0 = tx ? tx.toAccountId : (accs.find(a=>a.id!==from0) || {}).id;
    const s = UI.sheet({ title: tx ? 'Editar transferencia' : 'Transferencia entre cuentas', html: `
      <div class="field"><label>Desde</label><select name="from">${this.accountOptions(from0)}</select></div>
      <div class="field"><label>Hacia</label><select name="to">${this.accountOptions(to0)}</select></div>
      ${this.amountHTML(tx ? tx.amount : null, '')}
      ${this.crossHTML('Monto que llega en', tx && tx.toAmount!=null ? tx.toAmount : null)}
      <div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${tx ? tx.date : todayISO()}"></div><div class="field"><label>Nota</label><input name="note" placeholder="Opcional" value="${esc(tx ? tx.note : '')}"></div></div>
      <button class="btn" data-save>${tx ? 'Guardar cambios' : 'Transferir'}</button>
      ${tx ? '<button class="btn danger mt" data-del>Eliminar transferencia</button>' : ''}` });
    const f = s.body;
    const fromSel = f.querySelector('[name=from]'), toSel = f.querySelector('[name=to]');
    const update = this.bindCross(f, ()=>this.selCur(fromSel), ()=>this.selCur(toSel), { touched: !!(tx && tx.toAmount!=null && tx.toCurrency!==tx.currency) });
    const upd = ()=>{ const c = this.selCur(fromSel); f.querySelector('[data-curlbl]').textContent = c ? `Sale en ${CURRENCIES[c].name}` : ''; update(); };
    fromSel.onchange = upd; toSel.onchange = update; upd();
    f.querySelector('[data-save]').onclick = ()=>{
      const from = Store.account(fromSel.value), to = Store.account(toSel.value);
      if (!from || !to) return UI.toast('Selecciona las cuentas', true);
      if (from.id===to.id) return UI.toast('Las cuentas deben ser distintas', true);
      const amount = this.amount(f); if (!amount) return UI.toast('Escribe un monto válido', true);
      let toAmount = amount;
      if (from.currency!==to.currency){ toAmount = this.amount(f, 'crossAmount'); if (!toAmount) return UI.toast(`Indica cuánto llega en ${CURRENCIES[to.currency].name}`, true); }
      const date = this.val(f, 'date') || todayISO();
      Store.saveTx({ id: tx ? tx.id : undefined, createdAt: tx ? tx.createdAt : undefined, kind:'transfer', amount, currency: from.currency, accountId: from.id,
        toAccountId: to.id, toAmount, toCurrency: to.currency, date, note: this.val(f, 'note'), rateUSD: null });
      s.close(); App.render(); UI.toast('Transferencia guardada');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm('¿Eliminar esta transferencia?')){ Store.deleteTx(tx.id); s.close(); App.render(); UI.toast('Eliminada'); } };
    if (!tx) this.focusAmount(f);
  },

  /* ---------- Préstamo ---------- */
  loan({ direction='lent', personId=null, loan=null }={}){
    const editing = !!loan;
    if (loan){ direction = loan.direction; personId = loan.personId; }
    const cur0 = loan ? loan.currency : 'USD';
    const lbls = d=>({ person: d==='lent' ? 'A quién le prestaste' : 'Quién te prestó', acc: d==='lent' ? 'Cuenta de donde salió el dinero' : 'Cuenta donde entró el dinero' });
    const s = UI.sheet({ title: editing ? 'Editar préstamo' : (direction==='lent' ? 'Le presté a alguien' : 'Me prestaron'), html: `
      ${editing ? '' : `<div class="seg mb" data-seg><button data-k="lent" class="${direction==='lent'?'active r':''}">Le presté</button><button data-k="borrowed" class="${direction==='borrowed'?'active g':''}">Me prestó</button></div>`}
      <div class="field"><label data-personlbl>${lbls(direction).person}</label><select name="person">${this.personOptions(personId)}</select></div>
      ${this.amountHTML(loan ? loan.amount : null, CURRENCIES[cur0].name)}
      <div class="field"><label>Moneda del préstamo</label><select name="currency">${this.currencyOptions(cur0)}</select></div>
      <div class="field"><label data-acclbl>${lbls(direction).acc}</label><select name="account">${this.accountOptions(loan ? loan.accountId : '', { allowNone:true })}</select><div class="hint">Con "Sin cuenta" el préstamo se registra pero no cambia tus saldos. Útil para deudas anteriores a la app.</div></div>
      ${this.crossHTML('Monto que se movió en la cuenta, en', loan && loan.accountAmount!=null ? loan.accountAmount : null)}
      <div class="two"><div class="field"><label>Fecha del préstamo</label><input type="date" name="date" value="${loan ? loan.date : todayISO()}"></div><div class="field"><label>Para qué fue</label><input name="note" placeholder="Opcional" value="${esc(loan ? loan.note : '')}"></div></div>
      <div class="field"><label>Interés (opcional)</label><div class="two"><input name="interestRate" inputmode="decimal" placeholder="0 %" value="${loan && loan.interestRate ? loan.interestRate : ''}"><select name="interestPeriod">${Object.entries(Calc.PERIOD).map(([k,v])=>`<option value="${k}"${(loan ? loan.interestPeriod : 'monthly')===k ? ' selected' : ''}>% ${v}</option>`).join('')}</select></div><div class="hint">"Único" es un porcentaje fijo sobre el capital. Mensual y anual acumulan según el plazo o el tiempo transcurrido.</div></div>
      <div class="field"><label>Forma de pago</label><div class="two"><select name="frequency">${Object.entries(Calc.FREQ).map(([k,v])=>`<option value="${k}"${(loan ? loan.frequency || 'once' : 'once')===k ? ' selected' : ''}>${v.label}</option>`).join('')}</select><input name="installments" inputmode="numeric" placeholder="N° de cuotas" value="${loan && loan.installments ? loan.installments : ''}"></div></div>
      <div class="field"><label data-duelbl>Fecha límite de pago</label><input type="date" name="dueDate" value="${loan && loan.dueDate ? loan.dueDate : ''}"></div>
      <div class="card flat small" data-preview style="padding:10px 14px"></div>
      <button class="btn" data-save>${editing ? 'Guardar cambios' : 'Registrar préstamo'}</button>
      ${editing ? '<button class="btn danger mt" data-del>Eliminar préstamo y sus abonos</button>' : ''}` });
    const f = s.body;
    const curSel = f.querySelector('[name=currency]'), accSel = f.querySelector('[name=account]'), personSel = f.querySelector('[name=person]');
    const update = this.bindCross(f, ()=>curSel.value, ()=>this.selCur(accSel), { touched: !!(loan && loan.accountAmount!=null && loan.accountId && Store.account(loan.accountId) && Store.account(loan.accountId).currency!==loan.currency) });
    curSel.onchange = ()=>{ f.querySelector('[data-curlbl]').textContent = CURRENCIES[curSel.value].name; update(); };
    accSel.onchange = update; update();
    personSel.onchange = ()=>{
      if (personSel.value==='__new'){ personSel.value = ''; this.person(null, p=>{ personSel.innerHTML = this.personOptions(p.id); }); }
    };
    /* vista previa del plan: total con interés, cuota y próximo pago */
    const readPlan = ()=>({
      amount: this.amount(f) || 0, currency: curSel.value, date: this.val(f, 'date') || todayISO(), dueDate: this.val(f, 'dueDate') || null,
      interestRate: parseAmount(this.val(f, 'interestRate')) || 0, interestPeriod: this.val(f, 'interestPeriod'),
      frequency: this.val(f, 'frequency') || 'once', installments: parseInt(this.val(f, 'installments'), 10) || 0, payments: loan ? loan.payments : [],
    });
    const preview = ()=>{
      const p = readPlan(); const box = f.querySelector('[data-preview]');
      f.querySelector('[data-duelbl]').textContent = p.frequency==='once' ? 'Fecha límite de pago' : 'Fecha del primer pago';
      f.querySelector('[name=installments]').disabled = p.frequency==='once';
      if (!p.amount){ box.classList.add('hide'); return; }
      box.classList.remove('hide');
      const interest = Calc.loanInterest(p), total = Calc.loanTotal(p), cuota = Calc.loanInstallment(p);
      let t = `<b>Total a ${direction==='lent' ? 'cobrar' : 'pagar'}: ${fmtMoney(total, p.currency)}</b>`;
      if (interest) t += ` <span class="muted">(capital ${fmtMoney(p.amount, p.currency)} + interés ${fmtMoney(interest, p.currency)})</span>`;
      if (cuota) t += `<br>${p.installments} cuotas ${Calc.FREQ[p.frequency].label.toLowerCase()}es de <b>${fmtMoney(cuota, p.currency)}</b>`;
      if (p.dueDate){ const nd = Calc.loanNextDue(Object.assign({ id:'tmp' }, p)); if (nd) t += `<br>${p.frequency==='once' ? 'Vence' : 'Primer pago'} el ${fmtDate(nd.date)}`; }
      else if (p.frequency!=='once') t += `<br><span class="amber">Indica la fecha del primer pago para ver el calendario.</span>`;
      box.innerHTML = t;
    };
    ['interestRate', 'interestPeriod', 'frequency', 'installments', 'dueDate', 'date', 'amount', 'currency'].forEach(n=>{ const el = f.querySelector(`[name=${n}]`); el.addEventListener('input', preview); el.addEventListener('change', preview); });
    preview();
    const seg = f.querySelector('[data-seg]');
    if (seg) seg.onclick = e=>{
      const b = e.target.closest('[data-k]'); if (!b) return;
      direction = b.dataset.k;
      seg.querySelectorAll('button').forEach(x=>x.className='');
      b.className = 'active ' + (direction==='lent' ? 'r' : 'g');
      f.querySelector('[data-personlbl]').textContent = lbls(direction).person;
      f.querySelector('[data-acclbl]').textContent = lbls(direction).acc;
      preview();
    };
    f.querySelector('[data-save]').onclick = ()=>{
      const pid = personSel.value; if (!pid || pid==='__new') return UI.toast('Selecciona una persona', true);
      const amount = this.amount(f); if (!amount) return UI.toast('Escribe un monto válido', true);
      const currency = curSel.value;
      const acc = accSel.value ? Store.account(accSel.value) : null;
      let accountAmount = null;
      if (acc){ accountAmount = acc.currency===currency ? amount : this.amount(f, 'crossAmount'); if (!accountAmount) return UI.toast(`Indica el monto en ${CURRENCIES[acc.currency].name}`, true); }
      const date = this.val(f, 'date') || todayISO();
      const plan = readPlan();
      if (plan.frequency!=='once' && !plan.dueDate) return UI.toast('Indica la fecha del primer pago', true);
      if (plan.dueDate && plan.dueDate < date) return UI.toast('La fecha de pago no puede ser anterior al préstamo', true);
      Store.saveLoan({ id: loan ? loan.id : undefined, createdAt: loan ? loan.createdAt : undefined, payments: loan ? loan.payments : [], txId: loan ? loan.txId : null,
        personId: pid, direction, amount, currency, date, dueDate: plan.dueDate, note: this.val(f, 'note'), accountId: acc ? acc.id : null, accountAmount,
        interestRate: plan.interestRate, interestPeriod: plan.interestPeriod, frequency: plan.frequency, installments: plan.frequency==='once' ? 0 : plan.installments });
      s.close();
      if (location.hash==='#/personas/'+pid) App.render(); else App.go('#/personas/'+pid);
      UI.toast(editing ? 'Préstamo actualizado' : 'Préstamo registrado');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm('¿Eliminar este préstamo y todos sus abonos?')){ Store.deleteLoan(loan.id); s.close(); App.render(); UI.toast('Préstamo eliminado'); } };
    if (!editing) this.focusAmount(f);
  },

  /* ---------- Abono / pago de préstamo ---------- */
  payment({ loan, payment=null }){
    const person = Store.person(loan.personId);
    const lent = loan.direction==='lent';
    const pending = round2(Calc.loanOutstanding(loan) + (payment ? payment.amount : 0));
    const s = UI.sheet({ title: payment ? 'Editar abono' : (lent ? 'Registrar abono recibido' : 'Registrar pago que hice'), html: `
      <div class="card flat" style="padding:10px 14px;margin-bottom:12px"><div class="semibold">${esc(person ? person.name : '')} · ${lent ? 'te debe' : 'le debes'} ${fmtMoney(Calc.loanOutstanding(loan), loan.currency)}</div><div class="small muted">Préstamo del ${fmtDate(loan.date)} por ${fmtMoney(loan.amount, loan.currency)}${Calc.loanInterest(loan) ? ` + interés ${fmtMoney(Calc.loanInterest(loan), loan.currency)}` : ''}${loan.note ? ' · ' + esc(loan.note) : ''}</div></div>
      ${this.amountHTML(payment ? payment.amount : null, CURRENCIES[loan.currency].name)}
      <div class="center mb"><button class="btn secondary sm" data-all>Saldar todo (${fmtMoney(pending, loan.currency)})</button></div>
      <div class="field"><label>${lent ? 'Cuenta donde entra el dinero' : 'Cuenta de donde sale el dinero'}</label><select name="account">${this.accountOptions(payment ? payment.accountId : '', { allowNone:true })}</select></div>
      ${this.crossHTML('Monto que se movió en la cuenta, en', payment && payment.accountAmount!=null ? payment.accountAmount : null)}
      <div class="two"><div class="field"><label>Fecha</label><input type="date" name="date" value="${payment ? payment.date : todayISO()}"></div><div class="field"><label>Nota</label><input name="note" placeholder="Ej. pago móvil" value="${esc(payment ? payment.note : '')}"></div></div>
      <button class="btn" data-save>${payment ? 'Guardar cambios' : 'Guardar abono'}</button>
      ${payment ? '<button class="btn danger mt" data-del>Eliminar abono</button>' : ''}` });
    const f = s.body;
    const accSel = f.querySelector('[name=account]');
    const update = this.bindCross(f, ()=>loan.currency, ()=>this.selCur(accSel), { touched: !!(payment && payment.accountAmount!=null && payment.accountId && Store.account(payment.accountId) && Store.account(payment.accountId).currency!==loan.currency) });
    accSel.onchange = update; update();
    f.querySelector('[data-all]').onclick = ()=>{ f.querySelector('[name=amount]').value = String(pending); update(); };
    f.querySelector('[data-save]').onclick = ()=>{
      const amount = this.amount(f); if (!amount) return UI.toast('Escribe un monto válido', true);
      if (amount > pending + 0.005) return UI.toast(`El abono supera lo pendiente (${fmtMoney(pending, loan.currency)})`, true);
      const acc = accSel.value ? Store.account(accSel.value) : null;
      let accountAmount = null;
      if (acc){ accountAmount = acc.currency===loan.currency ? amount : this.amount(f, 'crossAmount'); if (!accountAmount) return UI.toast(`Indica el monto en ${CURRENCIES[acc.currency].name}`, true); }
      Store.savePayment(loan.id, { id: payment ? payment.id : undefined, txId: payment ? payment.txId : null, amount, date: this.val(f, 'date') || todayISO(), note: this.val(f, 'note'), accountId: acc ? acc.id : null, accountAmount });
      s.close(); App.render(); UI.toast(Calc.loanIsOpen(Store.loan(loan.id)) ? 'Abono guardado' : 'Préstamo saldado ✅');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm('¿Eliminar este abono?')){ Store.deletePayment(loan.id, payment.id); s.close(); App.render(); UI.toast('Abono eliminado'); } };
    if (!payment) this.focusAmount(f);
  },

  /* ---------- Persona ---------- */
  person(p=null, onSaved=null){
    const s = UI.sheet({ title: p ? 'Editar persona' : 'Nueva persona', html: `
      <div class="field"><label>Nombre</label><input name="name" value="${esc(p ? p.name : '')}" placeholder="Ej. José Daniel" autofocus></div>
      <div class="field"><label>Teléfono o referencia</label><input name="phone" value="${esc(p ? p.phone || '' : '')}" placeholder="Opcional"></div>
      <div class="field"><label>Notas</label><textarea name="note" placeholder="Opcional">${esc(p ? p.note || '' : '')}</textarea></div>
      <button class="btn" data-save>Guardar</button>
      ${p ? '<button class="btn danger mt" data-del>Eliminar persona y sus préstamos</button>' : ''}` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{
      const name = this.val(f, 'name'); if (!name) return UI.toast('Escribe un nombre', true);
      const dup = Store.data.people.find(x=>x.name.toLowerCase()===name.toLowerCase() && (!p || x.id!==p.id));
      if (dup) return UI.toast('Ya existe una persona con ese nombre', true);
      const obj = Store.upsert('people', { id: p ? p.id : uid(), name, phone: this.val(f, 'phone'), note: this.val(f, 'note'), createdAt: p ? p.createdAt : new Date().toISOString() });
      s.close();
      if (onSaved) onSaved(obj); else App.render();
      UI.toast('Persona guardada');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm(`¿Eliminar a ${p.name} con todos sus préstamos y abonos?`)){ Store.deletePerson(p.id); s.close(); App.go('#/personas'); App.render(); UI.toast('Persona eliminada'); } };
  },

  /* ---------- Cuenta ---------- */
  account(a=null){
    const hasTx = a && Store.data.transactions.some(t=>t.accountId===a.id || t.toAccountId===a.id);
    let color = (a && a.color) || ACCOUNT_COLORS[Store.data.accounts.length % ACCOUNT_COLORS.length];
    const s = UI.sheet({ title: a ? 'Editar cuenta' : 'Nueva cuenta', html: `
      <div class="icon-preview"><div data-iconprev></div><div class="grow"><div class="semibold" data-nameprev>${esc(a ? a.name : 'Nueva cuenta')}</div><div class="small muted">Así se verá en la lista</div></div></div>
      <div class="two"><div class="field"><label>Nombre</label><input name="name" value="${esc(a ? a.name : '')}" placeholder="Ej. Binance, Banesco" autofocus></div><div class="field"><label>Etiqueta</label><input name="tag" value="${esc(a ? a.tag || '' : '')}" placeholder="Ej. Jose, Hugueth"></div></div>
      <div class="two"><div class="field"><label>Moneda</label><select name="currency" ${hasTx ? 'disabled' : ''}>${this.currencyOptions(a ? a.currency : 'USD')}</select></div><div class="field"><label>Tipo</label><select name="type">${Object.entries(ACCOUNT_TYPES).map(([k,v])=>`<option value="${k}"${a && a.type===k ? ' selected' : ''}>${v}</option>`).join('')}</select></div></div>
      ${hasTx ? '<div class="hint" style="margin:-8px 0 12px">No se puede cambiar la moneda de una cuenta con movimientos.</div>' : ''}
      <div class="field"><label>Saldo inicial</label><input name="initial" inputmode="decimal" value="${a ? a.initial : ''}" placeholder="0"><div class="hint">Lo que tiene la cuenta hoy, al empezar a registrar en la app.</div></div>
      <div class="field"><label>Sitio web (para cargar el logo)</label><input name="site" value="${esc(a ? a.site || '' : '')}" placeholder="Ej. binance.com, cash.app, bancamiga.com" inputmode="url" autocapitalize="off"><div class="hint">Escribe la dirección del banco o app y el logo se carga solo.</div></div>
      <div class="two"><div class="field"><label>Emoji (si no hay logo)</label><input name="icon" value="${esc(a ? a.icon || '' : '')}" placeholder="💵"></div><div class="field"><label>Color</label><div class="palette" data-palette>${ACCOUNT_COLORS.map(c=>`<button type="button" data-color="${c}" class="${c===color ? 'sel' : ''}" style="background:${c}" aria-label="Color"></button>`).join('')}</div></div></div>
      <button class="btn" data-save>Guardar</button>
      ${a ? '<button class="btn danger mt" data-del>Eliminar cuenta</button>' : ''}` });
    const f = s.body;
    const prev = ()=>{
      f.querySelector('[data-iconprev]').innerHTML = UI.accIcon({ name: this.val(f, 'name') || 'Cuenta', site: this.val(f, 'site'), icon: this.val(f, 'icon'), color }, 'lg');
      f.querySelector('[data-nameprev]').textContent = this.val(f, 'name') || 'Nueva cuenta';
    };
    ['name', 'site', 'icon'].forEach(n=>{ const el = f.querySelector(`[name=${n}]`); let t; el.addEventListener('input', ()=>{ clearTimeout(t); t = setTimeout(prev, n==='site' ? 600 : 0); }); });
    f.querySelector('[data-palette]').onclick = e=>{ const b = e.target.closest('[data-color]'); if (!b) return; color = b.dataset.color; f.querySelectorAll('[data-palette] button').forEach(x=>x.classList.toggle('sel', x===b)); prev(); };
    prev();
    f.querySelector('[data-save]').onclick = ()=>{
      const name = this.val(f, 'name'); if (!name) return UI.toast('Escribe un nombre', true);
      const initial = parseAmount(this.val(f, 'initial') || '0'); if (!isFinite(initial)) return UI.toast('Saldo inicial inválido', true);
      if (siteDomain(this.val(f, 'site'))) AccIcons.forget(siteDomain(this.val(f, 'site')));
      Store.upsert('accounts', { id: a ? a.id : uid(), name, tag: this.val(f, 'tag'), currency: a && hasTx ? a.currency : this.val(f, 'currency'), type: this.val(f, 'type'), initial: round2(initial),
        site: siteDomain(this.val(f, 'site')), icon: this.val(f, 'icon'), color, favorite: a ? !!a.favorite : false, createdAt: a ? a.createdAt : todayISO() });
      s.close(); if (!a) App.go('#/cuentas'); App.render(); UI.toast('Cuenta guardada');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm(`¿Eliminar "${a.name}" y todos sus movimientos?`)){ Store.deleteAccount(a.id); s.close(); App.go('#/cuentas'); App.render(); UI.toast('Cuenta eliminada'); } };
  },

  /* ---------- Categoría ---------- */
  category(c=null, kind='expense'){
    if (c) kind = c.kind;
    const s = UI.sheet({ title: c ? 'Editar categoría' : 'Nueva categoría', html: `
      ${c ? '' : `<div class="seg mb" data-seg><button data-k="expense" class="${kind==='expense'?'active r':''}">Egreso</button><button data-k="income" class="${kind==='income'?'active g':''}">Ingreso</button></div>`}
      <div class="two"><div class="field"><label>Emoji</label><input name="icon" value="${esc(c ? c.icon : '')}" placeholder="🍕"></div><div class="field"><label>Nombre</label><input name="name" value="${esc(c ? c.name : '')}" placeholder="Ej. Sofía" autofocus></div></div>
      <button class="btn" data-save>Guardar</button>
      ${c ? '<button class="btn danger mt" data-del>Eliminar categoría</button>' : ''}` });
    const f = s.body;
    const seg = f.querySelector('[data-seg]');
    if (seg) seg.onclick = e=>{ const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; seg.querySelectorAll('button').forEach(x=>x.className=''); b.className = 'active ' + (kind==='income' ? 'g' : 'r'); };
    f.querySelector('[data-save]').onclick = ()=>{
      const name = this.val(f, 'name'); if (!name) return UI.toast('Escribe un nombre', true);
      Store.upsert('categories', { id: c ? c.id : uid(), name, icon: this.val(f, 'icon') || '🏷️', kind });
      s.close(); App.render(); UI.toast('Categoría guardada');
    };
    const del = f.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{ if (await UI.confirm(`¿Eliminar la categoría "${c.name}"? Los movimientos quedarán sin categoría.`)){ Store.remove('categories', c.id); s.close(); App.render(); UI.toast('Categoría eliminada'); } };
  },

  /* ---------- Tasa manual ---------- */
  rate(cur){
    const r = Store.data.settings.rates[cur]; const c = CURRENCIES[cur];
    const s = UI.sheet({ title: `Tasa ${c.name}`, html: `
      <div class="muted small mb">1 USD = ¿cuántos ${c.name.toLowerCase()}?</div>
      ${this.amountHTML(r.value || '', c.symbol)}
      <div class="muted small center mb">Actual: ${fmtRate(cur, r.value)} · ${esc(r.source || 'sin fuente')} · ${timeAgo(r.updatedAt)}</div>
      <button class="btn" data-save>Guardar tasa manual</button>
      ${cur!=='USDT' ? '<button class="btn secondary mt" data-auto>Volver a automática y actualizar</button>' : ''}` });
    const f = s.body;
    f.querySelector('[data-save]').onclick = ()=>{
      const v = parseAmount(this.val(f, 'amount')); if (!isFinite(v) || v<=0) return UI.toast('Tasa inválida', true);
      Rates.setManual(cur, v); s.close(); App.render(); UI.toast('Tasa guardada');
    };
    const auto = f.querySelector('[data-auto]');
    if (auto) auto.onclick = async ()=>{ r.manual = false; Store.save(); s.close(); await App.refreshRates(true); };
    this.focusAmount(f);
  },
};
