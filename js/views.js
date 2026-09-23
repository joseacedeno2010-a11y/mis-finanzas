'use strict';
/* Vistas (devuelven HTML) */
const Views = {
  back(hash, title, right=''){
    return `<div class="topbar"><button class="iconbtn" data-go="${hash}" aria-label="Volver">${UI.icon('back')}</button><h1>${esc(title)}</h1>${right}</div>`;
  },

  /* ----- presentación de un movimiento ----- */
  txView(tx){
    const acc = Store.account(tx.accountId); const accName = acc ? acc.name : 'Cuenta eliminada';
    const person = tx.personId ? Store.person(tx.personId) : null; const pn = person ? person.name : '—';
    const note = tx.note ? ' · ' + tx.note : '';
    switch (tx.kind){
      case 'income': { const c = Store.category(tx.categoryId); return { icon: c ? c.icon : '💰', cls:'g', title: c ? c.name : 'Ingreso', sub: accName + note, amt: fmtMoney(tx.amount, tx.currency, { plus:true }) }; }
      case 'expense': { const c = Store.category(tx.categoryId); return { icon: c ? c.icon : '🧾', cls:'r', title: c ? c.name : 'Egreso', sub: accName + note, amt: fmtMoney(-tx.amount, tx.currency) }; }
      case 'transfer': {
        const to = Store.account(tx.toAccountId); const toCur = tx.toCurrency || (to && to.currency) || tx.currency;
        const diff = toCur!==tx.currency || tx.toAmount!==tx.amount;
        return { icon: UI.icon('swap'), cls:'b', title:'Transferencia', sub:`${accName} → ${to ? to.name : '?'}${note}`, amt: fmtMoney(-tx.amount, tx.currency), amt2: diff ? fmtMoney(tx.toAmount, toCur, { plus:true }) : '' };
      }
      case 'loan_out': return { icon:'🤝', cls:'r', title:`Presté a ${pn}`, sub: accName + note, amt: fmtMoney(-tx.amount, tx.currency) };
      case 'loan_in': return { icon:'🤝', cls:'g', title:`Me prestó ${pn}`, sub: accName + note, amt: fmtMoney(tx.amount, tx.currency, { plus:true }) };
      case 'loan_collect': return { icon:'💵', cls:'g', title:`Abono de ${pn}`, sub: accName + note, amt: fmtMoney(tx.amount, tx.currency, { plus:true }) };
      case 'loan_repay': return { icon:'💸', cls:'r', title:`Pago a ${pn}`, sub: accName + note, amt: fmtMoney(-tx.amount, tx.currency) };
    }
    return { icon:'•', cls:'', title: tx.kind, sub:'', amt:'' };
  },
  txRow(tx, { showDate=false }={}){
    const v = this.txView(tx);
    const color = v.cls==='g' ? 'green' : v.cls==='r' ? 'red' : 'blue';
    return `<button class="item clickable" data-action="tx" data-id="${tx.id}">
      <div class="ic ${v.cls}">${v.icon}</div>
      <div class="body"><div class="title ellipsis">${esc(v.title)}</div><div class="sub ellipsis">${esc(v.sub)}</div></div>
      <div class="amt ${color}">${v.amt}${v.amt2 ? `<div class="sub green">${v.amt2}</div>` : ''}${showDate ? `<div class="sub muted">${fmtDate(tx.date, 'short')}</div>` : ''}</div></button>`;
  },
  txGroups(txs){
    const groups = []; let g = null;
    for (const t of txs){ if (!g || g.date!==t.date){ g = { date: t.date, txs: [] }; groups.push(g); } g.txs.push(t); }
    return groups.map(g=>{
      let inc = 0, exp = 0;
      for (const t of g.txs){ if (t.kind==='income' || t.kind==='loan_in' || t.kind==='loan_collect') inc += Calc.txUSD(t); else if (t.kind!=='transfer') exp += Calc.txUSD(t); }
      const tot = `${inc ? `<span class="green">+${fmtMoney(inc)}</span> ` : ''}${exp ? `<span class="red">-${fmtMoney(exp)}</span>` : ''}`;
      return `<div class="day-head"><span>${fmtDate(g.date, 'day')}</span><span>${tot}</span></div><div class="card tight"><div class="list">${g.txs.map(t=>this.txRow(t)).join('')}</div></div>`;
    }).join('');
  },

  /* ----- Inicio ----- */
  home(){
    const S = App.state, vc = S.viewCur;
    const nw = Calc.netWorth();
    const ms = Calc.monthSummary(thisMonthKey());
    const rates = Store.data.settings.rates;
    const noRate = vc!=='USD' && !Calc.rate(vc);
    const total = Calc.fromUSD(nw.accountsUSD, vc);
    const now = new Date();
    const dateStr = `${DAYS_SHORT[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;
    let html = `<div class="topbar"><div class="grow"><div class="muted small">${dateStr[0].toUpperCase() + dateStr.slice(1)}</div><h1>Mis finanzas</h1></div><button class="iconbtn" data-go="#/tasas" aria-label="Tasas">${UI.icon('coins')}</button></div>`;
    html += `<div class="hero"><div class="label">Total en cuentas</div><div class="big">${noRate ? 'Sin tasa' : fmtMoney(total, vc)}</div>
      <div class="chips">${CURRENCY_ORDER.map(c=>`<button class="chip ${c===vc ? 'active' : ''}" data-action="viewcur" data-cur="${c}">${CURRENCIES[c].short}</button>`).join('')}</div>
      <div class="hero-tiles">
        <button class="hero-tile" data-go="#/balance"><div class="t">${UI.icon('scale')} Patrimonio</div><div class="v">${fmtMoney(nw.netUSD)}</div></button>
        <button class="hero-tile pos" data-go="#/personas"><div class="t">${UI.icon('down')} Te deben</div><div class="v">${fmtMoney(nw.receivables.usd)}</div></button>
        <button class="hero-tile neg" data-go="#/personas"><div class="t">${UI.icon('up')} Debes</div><div class="v">${fmtMoney(nw.payables.usd)}</div></button>
      </div></div>`;
    if (!Store.data.accounts.length && !Store.data.transactions.length && !Store.data.people.length){
      if (Sync.enabled() && !Sync.user && Sync.status!=='syncing'){
        html += `<div class="card" style="border:1px solid var(--accent)"><div class="semibold">☁️ ¿Ya tienes cuenta en la nube?</div><div class="small muted" style="margin:4px 0 10px">Inicia sesión con tu correo y contraseña y tus datos aparecerán aquí. Si es tu primera vez, crea la cuenta para no perder nada.</div><div class="btnrow" style="margin:0"><button class="btn sm" data-action="sync-login">Iniciar sesión</button><button class="btn sm secondary" data-action="paste-json">Pegar respaldo</button></div></div>`;
      } else if (Sync.status==='syncing'){
        html += `<div class="card" style="border:1px solid var(--accent)"><div class="semibold">⏳ Descargando tus datos de la nube…</div></div>`;
      } else if (!Sync.user){
        html += `<div class="card" style="border:1px solid var(--accent)"><div class="semibold">¿Ya tenías datos registrados?</div><div class="small muted" style="margin:4px 0 10px">Pega aquí un respaldo copiado desde otro dispositivo.</div><div class="btnrow" style="margin:0"><button class="btn sm" data-action="paste-json">Pegar respaldo</button><button class="btn sm secondary" data-action="new-account">Empezar de cero</button></div></div>`;
      }
    }
    const lu = Rates.lastUpdate();
    html += `<div class="card" style="padding:12px 14px"><div class="row between"><div class="chips grow">${['VES','COP','EUR'].map(c=>`<button class="chip" data-action="edit-rate" data-cur="${c}">${fmtRate(c, rates[c].value)}${rates[c].manual ? ' ✎' : ''}</button>`).join('')}</div><button class="iconbtn ghost ${Rates.busy ? 'spin' : ''}" data-action="refresh-rates" aria-label="Actualizar tasas">${UI.icon('refresh')}</button></div><div class="xs muted" style="margin-top:6px">Por 1 USD · Binance P2P (venta USDT) · actualizado ${timeAgo(lu)}</div></div>`;
    html += `<div class="grid2"><button class="stat" data-go="#/movimientos"><div class="t"><span class="dot g">${UI.icon('up')}</span>Ingresos del mes</div><div class="v">${fmtMoney(ms.income)}</div></button><button class="stat" data-go="#/movimientos"><div class="t"><span class="dot r">${UI.icon('down')}</span>Egresos del mes</div><div class="v">${fmtMoney(ms.expense)}</div></button></div>`;
    html += `<div class="section-title"><h2>Mis cuentas</h2><div class="row"><button class="link" data-action="new-account">+ Nueva cuenta</button><a class="link" href="#/cuentas">Ver todas</a></div></div>`;
    const curs = CURRENCY_ORDER.filter(c=>nw.byCurrency[c]);
    if (!curs.length) html += `<div class="card">${UI.empty('👛', 'Aún no tienes cuentas', 'Toca "Nueva cuenta" para crear la primera')}</div>`;
    for (const c of curs){
      const g = nw.byCurrency[c];
      html += `<div class="card tight"><div class="row between" style="padding:6px 16px 4px"><div class="semibold">${CURRENCIES[c].name}</div><div class="right"><div class="bold">${fmtMoney(g.total, c)}</div>${c!=='USD' ? `<div class="xs muted">≈ ${fmtMoney(g.usd)}</div>` : ''}</div></div><div class="list">${g.accounts.map(x=>`<button class="item clickable" data-go="#/cuentas/${x.acc.id}">${UI.accIcon(x.acc, 'sm')}<div class="body"><div class="title ellipsis">${esc(x.acc.name)}${x.acc.tag ? `<span class="tagb">${esc(x.acc.tag)}</span>` : ''}</div><div class="sub">${ACCOUNT_TYPES[x.acc.type] || ''}</div></div><div class="amt">${fmtMoney(x.balance, c)}</div><span class="chev">${UI.icon('chevron')}</span></button>`).join('')}</div></div>`;
    }
    if (Store.data.budgets.length){
      const b = Calc.budgetSummary(thisMonthKey()); const cls = pct=>pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
      html += `<button class="card" style="width:100%;text-align:left" data-go="#/presupuesto"><div class="card-head"><h3>Presupuesto del mes</h3><span class="link">Ver</span></div><div class="row between"><span class="semibold">${fmtMoney(b.spent)} <span class="muted small">de ${fmtMoney(b.total)}</span></span><span class="small ${b.left < 0 ? 'red bold' : 'muted'}">${b.left < 0 ? `Excedido ${fmtMoney(-b.left)}` : `Quedan ${fmtMoney(b.left)}`}</span></div><div class="progress"><div class="${cls(b.pct)}" style="width:${Math.min(100, b.pct)}%"></div></div>
        ${b.items.slice(0, 3).map(x=>`<div class="row between xs muted" style="margin-top:8px"><span>${x.cat.icon} ${esc(x.cat.name)}</span><span class="${x.pct >= 100 ? 'red' : ''}">${x.pct}%</span></div><div class="progress" style="height:4px;margin-top:3px"><div class="${cls(x.pct)}" style="width:${Math.min(100, x.pct)}%"></div></div>`).join('')}</button>`;
    }
    const up = Calc.upcomingPayments(45);
    if (up.length){
      html += `<div class="card tight"><div class="card-head" style="padding:6px 16px 0"><h3>Próximos pagos</h3><span class="muted small">45 días</span></div><div class="list">${up.map(x=>{ const l = x.loan, p = Store.person(l.personId); const lent = l.direction==='lent'; const overdue = x.due.date < todayISO(); return `<button class="item clickable" data-go="#/personas/${l.personId}"><div class="ic ${lent ? 'g' : 'r'}">${UI.icon('calendar')}</div><div class="body"><div class="title ellipsis">${lent ? 'Cobrar a' : 'Pagar a'} ${esc(p ? p.name : '?')}</div><div class="sub ellipsis ${overdue ? 'red' : ''}">${fmtDate(x.due.date, 'day')}${overdue ? ' · vencido' : ''}${x.due.n > 1 ? ` · cuota ${x.due.k + 1}/${x.due.n}` : ''}${l.note ? ' · ' + esc(l.note) : ''}</div></div><div class="amt ${lent ? 'green' : 'red'}">${fmtMoney(x.due.amount, l.currency)}</div></button>`; }).join('')}</div></div>`;
    }
    if (ms.cats.length){
      html += `<div class="card"><div class="card-head"><h3>Top categorías</h3><span class="muted small">${fmtMonth(thisMonthKey())}</span></div><div class="list">${ms.cats.slice(0, 5).map(x=>{ const pct = ms.expense ? Math.round(x.usd / ms.expense * 100) : 0; return `<div class="item" style="padding:8px 0"><div class="ic">${x.cat ? x.cat.icon : '🧾'}</div><div class="body"><div class="row between"><span class="title">${esc(x.cat ? x.cat.name : 'Sin categoría')}</span><span class="semibold">${fmtMoney(x.usd)}</span></div><div class="progress" style="margin-top:6px"><div style="width:${pct}%"></div></div></div><span class="badge">${pct}%</span></div>`; }).join('')}</div></div>`;
    }
    const recent = [...Store.data.transactions].sort(Calc.sortDesc).slice(0, 6);
    html += `<div class="card tight"><div class="card-head" style="padding:6px 16px 0"><h3>Movimientos recientes</h3><a class="link" href="#/movimientos">Ver todos</a></div>${recent.length ? `<div class="list">${recent.map(t=>this.txRow(t, { showDate:true })).join('')}</div>` : UI.empty('🧾', 'Sin movimientos todavía', 'Usa el botón + para registrar uno')}</div>`;
    return html;
  },

  /* ----- Movimientos ----- */
  movements(){
    const S = App.state; const ms = Calc.monthSummary(S.month);
    return `<div class="topbar"><h1>Movimientos</h1><button class="iconbtn" data-action="export-csv" aria-label="Exportar CSV">${UI.icon('download')}</button></div>
      <div class="monthnav"><button data-action="month" data-delta="-1">${UI.icon('left')}</button><div class="m">${fmtMonth(S.month)}</div><button data-action="month" data-delta="1">${UI.icon('chevron')}</button></div>
      <div class="grid2"><div class="stat"><div class="t"><span class="dot g">${UI.icon('up')}</span>Ingresos</div><div class="v">${fmtMoney(ms.income)}</div></div><div class="stat"><div class="t"><span class="dot r">${UI.icon('down')}</span>Egresos</div><div class="v">${fmtMoney(ms.expense)}</div></div></div>
      <div class="search">${UI.icon('search')}<input data-search placeholder="Buscar por nota, persona o categoría" value="${esc(S.q)}"></div>
      <div class="field"><select data-filter-acc><option value="">Todas las cuentas</option>${Store.accountsSorted().map(a=>`<option value="${a.id}"${S.fAcc===a.id ? ' selected' : ''}>${esc(a.name)} · ${CURRENCIES[a.currency].short}</option>`).join('')}</select></div>
      <div id="list">${this.movementsList()}</div>`;
  },
  movementsList(){
    const S = App.state; const q = (S.q || '').toLowerCase();
    let txs = Calc.monthTxs(S.month);
    if (S.fAcc) txs = txs.filter(t=>t.accountId===S.fAcc || t.toAccountId===S.fAcc);
    if (q) txs = txs.filter(t=>{ const v = this.txView(t); return (v.title + ' ' + v.sub).toLowerCase().includes(q); });
    txs.sort(Calc.sortDesc);
    if (!txs.length) return `<div class="card">${UI.empty('🗒️', 'Nada por aquí', 'No hay movimientos en este mes con esos filtros')}</div>`;
    return this.txGroups(txs);
  },

  /* ----- Personas ----- */
  balanceLines(bal){
    const curs = Object.keys(bal).filter(c=>Math.abs(bal[c].net) > 0.004);
    if (!curs.length) return { amt:'<span class="muted">Al día</span>', sub:'Sin saldo pendiente' };
    const pos = curs.filter(c=>bal[c].net > 0).length, neg = curs.length - pos;
    const amt = curs.map(c=>`<div class="${bal[c].net > 0 ? 'green' : 'red'}">${fmtMoney(bal[c].net, c)}</div>`).join('');
    return { amt, sub: pos && neg ? 'Te debe y le debes' : pos ? 'Te debe' : 'Le debes' };
  },
  people(){
    const S = App.state; const f = S.peopleFilter || 'all';
    const s = Calc.loansSummary();
    const nRec = Object.keys(s.receivables.byPerson).length, nPay = Object.keys(s.payables.byPerson).length;
    const sortLabels = { balance:'Saldo', name:'Nombre', due:'Vencimiento' };
    return `<div class="topbar"><h1>Personas</h1><button class="iconbtn" data-action="new-person" aria-label="Nueva persona">${UI.icon('plus')}</button></div>
      <div class="seg mb"><button class="${f==='all' ? 'active' : ''}" data-action="people-filter" data-f="all">Todas</button><button class="${f==='lent' ? 'active g' : ''}" data-action="people-filter" data-f="lent">Me deben</button><button class="${f==='borrowed' ? 'active r' : ''}" data-action="people-filter" data-f="borrowed">Debo</button></div>
      <div class="grid2"><button class="stat ${f==='lent' ? 'sel' : ''}" data-action="people-filter" data-f="${f==='lent' ? 'all' : 'lent'}"><div class="t"><span class="dot g">${UI.icon('down')}</span>Por cobrar</div><div class="v green">${fmtMoney(s.receivables.usd)}</div><div class="xs muted">${nRec} persona${nRec===1 ? '' : 's'}</div></button><button class="stat ${f==='borrowed' ? 'sel' : ''}" data-action="people-filter" data-f="${f==='borrowed' ? 'all' : 'borrowed'}"><div class="t"><span class="dot r">${UI.icon('up')}</span>Por pagar</div><div class="v red">${fmtMoney(s.payables.usd)}</div><div class="xs muted">${nPay} persona${nPay===1 ? '' : 's'}</div></button></div>
      <div class="row mb"><div class="search grow" style="margin:0">${UI.icon('search')}<input data-search-people placeholder="Buscar persona" value="${esc(S.pq || '')}"></div><button class="btn secondary sm" data-action="people-sort">${UI.icon('sort')} ${sortLabels[S.peopleSort || 'balance']}</button></div>
      <div id="list">${this.peopleList()}</div>`;
  },
  peopleList(){
    const S = App.state; const f = S.peopleFilter || 'all'; const q = (S.pq || '').toLowerCase(); const sort = S.peopleSort || 'balance';
    const today = todayISO();
    const rows = Store.peopleSorted().filter(p=>!q || p.name.toLowerCase().includes(q)).map(p=>{
      const bal = Calc.personBalances(p.id); const open = Calc.personLoans(p.id).filter(l=>Calc.loanIsOpen(l));
      const rec = open.filter(l=>l.direction==='lent'), pay = open.filter(l=>l.direction==='borrowed');
      const usd = ls=>ls.reduce((s,l)=>s + Calc.toUSD(Calc.loanOutstanding(l), l.currency), 0);
      const due = ls=>ls.map(l=>Calc.loanNextDue(l)).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date))[0] || null;
      return { p, bal, rec, pay, recUSD: usd(rec), payUSD: usd(pay), dueRec: due(rec), duePay: due(pay) };
    }).filter(r=>f==='lent' ? r.rec.length : f==='borrowed' ? r.pay.length : true);
    const key = r=>f==='lent' ? r.recUSD : f==='borrowed' ? r.payUSD : Math.abs(r.recUSD - r.payUSD);
    const dueOf = r=>f==='lent' ? r.dueRec : f==='borrowed' ? r.duePay : ([r.dueRec, r.duePay].filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date))[0] || null);
    if (sort==='name') rows.sort((a,b)=>a.p.name.localeCompare(b.p.name));
    else if (sort==='due') rows.sort((a,b)=>{ const da = dueOf(a), db = dueOf(b); if (!da && !db) return key(b) - key(a); if (!da) return 1; if (!db) return -1; return da.date.localeCompare(db.date); });
    else rows.sort((a,b)=>key(b) - key(a) || a.p.name.localeCompare(b.p.name));
    if (!rows.length){
      const msg = q ? ['Sin resultados', ''] : f==='lent' ? ['Nadie te debe', 'Cuando prestes dinero, aparecerá aquí'] : f==='borrowed' ? ['No debes nada 🎉', ''] : ['Aún no hay personas', 'Agrega a quien le prestas o te presta dinero'];
      return `<div class="card">${UI.empty(f==='borrowed' ? '✅' : '👥', msg[0], msg[1])}</div>${q || f!=='all' ? '' : '<button class="btn" data-action="new-person">Agregar persona</button>'}`;
    }
    const row = r=>{
      const d = dueOf(r); const overdue = d && d.date < today;
      const dueTxt = d ? `<span class="${overdue ? 'red' : ''}">${overdue ? 'venció' : 'vence'} ${fmtDate(d.date, 'short')}</span>` : '';
      let amt, sub;
      if (f==='lent'){ amt = Object.keys(r.bal).filter(c=>r.bal[c].lent > 0).map(c=>`<div class="green">${fmtMoney(r.bal[c].lent, c)}</div>`).join(''); sub = `${r.rec.length} préstamo${r.rec.length===1 ? '' : 's'}`; }
      else if (f==='borrowed'){ amt = Object.keys(r.bal).filter(c=>r.bal[c].borrowed > 0).map(c=>`<div class="red">${fmtMoney(r.bal[c].borrowed, c)}</div>`).join(''); sub = `${r.pay.length} préstamo${r.pay.length===1 ? '' : 's'}`; }
      else { const l = this.balanceLines(r.bal); amt = l.amt; sub = l.sub; }
      return `<button class="item clickable" data-go="#/personas/${r.p.id}">${UI.avatar(r.p.name)}<div class="body"><div class="title">${esc(r.p.name)}${overdue ? ' <span class="badge r">vencido</span>' : ''}</div><div class="sub">${sub}${dueTxt ? ' · ' + dueTxt : ''}</div></div><div class="amt">${amt}</div><span class="chev">${UI.icon('chevron')}</span></button>`;
    };
    if (f!=='all') return `<div class="card tight"><div class="list">${rows.map(row).join('')}</div></div>`;
    const withBal = rows.filter(r=>r.rec.length || r.pay.length), clear = rows.filter(r=>!r.rec.length && !r.pay.length);
    let html = '';
    if (withBal.length) html += `<div class="day-head"><span>Con saldo pendiente</span><span>${withBal.length}</span></div><div class="card tight"><div class="list">${withBal.map(row).join('')}</div></div>`;
    if (clear.length) html += `<div class="day-head"><span>Al día</span><span>${clear.length}</span></div><div class="card tight"><div class="list">${clear.map(row).join('')}</div></div>`;
    return html;
  },

  /* ----- Presupuesto ----- */
  budget(){
    const S = App.state; const key = S.bMonth || thisMonthKey(); const isCur = key===thisMonthKey();
    const b = Calc.budgetSummary(key);
    const [y, m] = key.split('-').map(Number); const dim = new Date(y, m, 0).getDate();
    const daysLeft = isCur ? dim - new Date().getDate() + 1 : 0;
    let html = this.back('#/menu', 'Presupuesto', `<button class="iconbtn" data-action="new-budget" aria-label="Nuevo presupuesto">${UI.icon('plus')}</button>`);
    html += `<div class="monthnav"><button data-action="bmonth" data-delta="-1">${UI.icon('left')}</button><div class="m">${fmtMonth(key)}</div><button data-action="bmonth" data-delta="1">${UI.icon('chevron')}</button></div>`;
    if (!Store.data.budgets.length){
      html += `<div class="card">${UI.empty('🎯', 'Sin presupuestos todavía', 'Define cuánto quieres gastar al mes en cada categoría y la app te muestra cuánto llevas y cuánto te queda.')}<button class="btn" data-action="new-budget">${UI.icon('plus')} Crear mi primer presupuesto</button></div>`;
      return html;
    }
    const cls = pct=>pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    html += `<div class="hero"><div class="label">Gastado en ${fmtMonth(key).toLowerCase()}</div><div class="big">${fmtMoney(b.spent)}</div><div class="sub">de ${fmtMoney(b.total)} presupuestados · ${b.left >= 0 ? `quedan <b>${fmtMoney(b.left)}</b>` : `excedido por <b>${fmtMoney(-b.left)}</b>`}</div>
      <div class="progress hero-progress"><div class="${cls(b.pct)}" style="width:${Math.min(100, b.pct)}%"></div></div>
      ${isCur ? `<div class="hero-tiles"><div class="hero-tile"><div class="t">Usado</div><div class="v">${b.pct}%</div></div><div class="hero-tile"><div class="t">Días restantes</div><div class="v">${daysLeft}</div></div><div class="hero-tile ${b.left >= 0 ? 'pos' : 'neg'}"><div class="t">Por día</div><div class="v">${fmtMoney(b.left >= 0 && daysLeft ? b.left / daysLeft : 0)}</div></div></div>` : ''}</div>`;
    html += `<div class="card tight"><div class="list">${b.items.map(x=>`<button class="item clickable" data-action="edit-budget" data-id="${x.id}"><div class="ic">${x.cat.icon}</div><div class="body"><div class="row between"><span class="title">${esc(x.cat.name)}</span><span class="small ${x.left < 0 ? 'red bold' : 'muted'}">${x.left < 0 ? `Excedido ${fmtMoney(-x.left)}` : `Quedan ${fmtMoney(x.left)}`}</span></div><div class="progress"><div class="${cls(x.pct)}" style="width:${Math.min(100, x.pct)}%"></div></div><div class="xs muted" style="margin-top:4px">${fmtMoney(x.spent)} de ${fmtMoney(x.amount)} · ${x.pct}%</div></div></button>`).join('')}</div></div>`;
    if (b.others.length){
      html += `<div class="section-title"><h2>Gastos sin presupuesto</h2><span class="muted small">${fmtMoney(b.others.reduce((s,c)=>s + c.usd, 0))}</span></div><div class="card tight"><div class="list">${b.others.map(c=>`<div class="item"><div class="ic">${c.cat ? c.cat.icon : '🧾'}</div><div class="body"><div class="title">${esc(c.cat ? c.cat.name : 'Sin categoría')}</div><div class="sub">${fmtMoney(c.usd)} este mes</div></div>${c.cat ? `<button class="btn secondary sm" data-action="new-budget" data-cat="${c.id}">Asignar</button>` : ''}</div>`).join('')}</div></div>`;
    }
    html += `<div class="xs muted center mt">Los presupuestos son mensuales y en dólares. Los gastos en otras monedas se convierten con la tasa del día en que se registraron.</div>`;
    return html;
  },
  person(id){
    const p = Store.person(id);
    if (!p) return this.back('#/personas', 'Persona') + UI.empty('🤷', 'Persona no encontrada');
    const bal = Calc.personBalances(id); const loans = Calc.personLoans(id);
    const open = loans.filter(l=>Calc.loanIsOpen(l)), closed = loans.filter(l=>!Calc.loanIsOpen(l));
    const curs = Object.keys(bal).filter(c=>Math.abs(bal[c].net) > 0.004);
    const netUSD = Calc.personNetUSD(id);
    let html = this.back('#/personas', p.name, `<button class="iconbtn" data-action="edit-person" data-id="${id}" aria-label="Editar">${UI.icon('edit')}</button>`);
    html += `<div class="card"><div class="row"><div class="avatar lg" style="background:${colorFor(p.name)}">${esc(initials(p.name))}</div><div class="grow"><div class="bold" style="font-size:18px">${esc(p.name)}</div><div class="small muted">${esc(p.phone || '')}${p.phone && p.note ? ' · ' : ''}${esc(p.note || '')}</div></div></div>
      <div class="mt">${curs.length ? curs.map(c=>`<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="muted">${bal[c].net > 0 ? 'Te debe' : 'Le debes'}</span><span class="bold ${bal[c].net > 0 ? 'green' : 'red'}" style="font-size:18px">${fmtMoney(Math.abs(bal[c].net), c)}</span></div>`).join('') + (curs.some(c=>c!=='USD') || curs.length > 1 ? `<div class="xs muted right">Neto ≈ ${fmtMoney(netUSD)}</div>` : '') : '<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="muted">Saldo</span><span class="bold">Al día ✅</span></div>'}</div>
      <div class="btnrow"><button class="btn sm secondary" data-action="new-loan" data-direction="lent" data-person="${id}">Le presté</button><button class="btn sm secondary" data-action="new-loan" data-direction="borrowed" data-person="${id}">Me prestó</button>${open.length ? `<button class="btn sm" data-action="pay-person" data-id="${id}">Abonar</button>` : ''}</div></div>`;
    html += `<div class="section-title"><h2>Pendientes</h2><span class="muted small">${open.length}</span></div>`;
    html += open.length ? open.map(l=>this.loanCard(l)).join('') : `<div class="card">${UI.empty('✅', 'Nada pendiente')}</div>`;
    if (closed.length){
      html += `<div class="section-title"><h2>Saldados</h2><span class="muted small">${closed.length}</span></div><div class="card tight"><div class="list">${closed.map(l=>`<button class="item clickable" data-action="edit-loan" data-id="${l.id}"><div class="ic">${l.direction==='lent' ? '✅' : '🆗'}</div><div class="body"><div class="title">${l.direction==='lent' ? 'Le prestaste' : 'Te prestó'} ${fmtMoney(l.amount, l.currency)}</div><div class="sub">${fmtDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''} · saldado</div></div><span class="chev">${UI.icon('chevron')}</span></button>`).join('')}</div></div>`;
    }
    const events = [];
    for (const l of loans){
      events.push({ date: l.date, ts: l.createdAt || '', cls: l.direction==='lent' ? 'r' : 'g', text: `${l.direction==='lent' ? 'Le prestaste' : 'Te prestó'} <b>${fmtMoney(l.amount, l.currency)}</b>${l.note ? ' · ' + esc(l.note) : ''}` });
      for (const pm of l.payments) events.push({ date: pm.date, ts: pm.id, cls: l.direction==='lent' ? 'g' : 'r', text: `${l.direction==='lent' ? 'Te abonó' : 'Le pagaste'} <b>${fmtMoney(pm.amount, l.currency)}</b>${pm.note ? ' · ' + esc(pm.note) : ''}` });
    }
    events.sort((a,b)=>b.date.localeCompare(a.date) || b.ts.localeCompare(a.ts));
    if (events.length) html += `<div class="section-title"><h2>Historial</h2></div><div class="card"><div class="tl">${events.map(e=>`<div class="ev ${e.cls}"><div class="xs muted">${fmtDate(e.date)}</div><div class="small">${e.text}</div></div>`).join('')}</div></div>`;
    return html;
  },
  loanCard(l){
    const out = Calc.loanOutstanding(l), paid = Calc.loanPaid(l), interest = Calc.loanInterest(l), total = Calc.loanTotal(l);
    const pct = total ? Math.min(100, Math.round(paid / total * 100)) : 0;
    const lent = l.direction==='lent'; const acc = l.accountId && Store.account(l.accountId);
    const nd = Calc.loanNextDue(l); const overdue = nd && nd.date < todayISO();
    const f = l.frequency || 'once';
    const pays = [...l.payments].sort((a,b)=>b.date.localeCompare(a.date));
    let plan = '';
    if (interest) plan += `<div class="xs muted">Interés ${l.interestRate}% ${Calc.PERIOD[l.interestPeriod] || ''} · ${fmtMoney(interest, l.currency)} · total ${fmtMoney(total, l.currency)}</div>`;
    if (nd) plan += `<div class="xs ${overdue ? 'red' : 'amber'}">${f==='once' ? 'Vence' : 'Próximo pago'} ${fmtDate(nd.date)}${nd.n > 1 ? ` · cuota ${nd.k + 1} de ${nd.n}` : ''} · ${fmtMoney(nd.amount, l.currency)}${overdue ? ' · vencido' : ''}</div>`;
    else if (f!=='once') plan += `<div class="xs muted">Pago ${Calc.FREQ[f].label.toLowerCase()}${l.installments ? ` · ${l.installments} cuotas` : ''}</div>`;
    return `<div class="card flat"><div class="row between"><div class="grow"><div class="semibold">${lent ? 'Le prestaste' : 'Te prestó'} ${fmtMoney(l.amount, l.currency)}</div><div class="small muted">${fmtDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''} · ${acc ? esc(acc.name) : 'sin cuenta'}</div>${plan}</div><div class="right"><div class="bold ${lent ? 'green' : 'red'}" style="font-size:17px">${fmtMoney(out, l.currency)}</div><div class="xs muted">pendiente${paid ? ` · abonado ${fmtMoney(paid, l.currency)}` : ''}</div></div></div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      ${pays.length ? `<div class="mt">${pays.map(pm=>{ const pa = pm.accountId && Store.account(pm.accountId); return `<button class="payrow" data-action="edit-payment" data-loan="${l.id}" data-pid="${pm.id}"><span class="muted">${fmtDate(pm.date)}${pm.note ? ' · ' + esc(pm.note) : ''}${pa ? ' · ' + esc(pa.name) : ''}</span><span class="semibold">${lent ? '+' : '-'}${fmtMoney(pm.amount, l.currency)}</span></button>`; }).join('')}</div>` : ''}
      <div class="btnrow"><button class="btn sm" data-action="pay" data-id="${l.id}">${lent ? 'Registrar abono' : 'Registrar pago'}</button><button class="btn secondary sm" data-action="edit-loan" data-id="${l.id}">Editar</button></div></div>`;
  },

  /* ----- Balance general ----- */
  balance(){
    const nw = Calc.netWorth(); const series = Calc.monthlyNetWorthSeries(12);
    let html = `<div class="topbar"><h1>Balance general</h1></div>`;
    html += `<div class="hero"><div class="label">Patrimonio neto (activos − pasivos)</div><div class="big">${fmtMoney(nw.netUSD)}</div><div class="sub">Activos <b>${fmtMoney(nw.assetsUSD)}</b> · Pasivos <b>${fmtMoney(nw.liabilitiesUSD)}</b></div></div>`;
    html += `<div class="card"><div class="card-head"><h3>Evolución</h3><span class="muted small">últimos 12 meses</span></div>${this.chartSVG(series)}</div>`;
    const pname = id=>{ const p = Store.person(id); return p ? p.name : 'Persona eliminada'; };
    const curLine = byCur=>Object.keys(byCur).map(c=>fmtMoney(byCur[c], c)).join(' · ');
    const S = App.state;
    const group = (key, title, icon, cls, total, rows, verb)=>{
      const open = !!S[key];
      let h = `<div class="item clickable" data-action="toggle" data-key="${key}"><div class="ic ${cls}">${icon}</div><div class="body"><div class="title">${title}</div><div class="sub">${rows.length ? `${rows.length} persona${rows.length===1 ? '' : 's'} · toca para ${open ? 'ocultar' : 'ver'} el detalle` : 'Nada pendiente'}</div></div><div class="amt ${cls==='g' ? 'green' : 'red'}">${fmtMoney(total)}</div>${rows.length ? `<span class="chev ${open ? 'open' : ''}">${UI.icon('chevron')}</span>` : ''}</div>`;
      if (open && rows.length) h += `<div class="sublist">${rows.map(([pid, v])=>`<button class="item clickable" data-go="#/personas/${pid}">${UI.avatar(pname(pid))}<div class="body"><div class="title">${verb} ${esc(pname(pid))}</div><div class="sub">${curLine(v.byCur)}</div></div><div class="amt ${cls==='g' ? 'green' : 'red'}">${fmtMoney(v.usd)}</div></button>`).join('')}</div>`;
      return h;
    };
    const recRows = Object.entries(nw.receivables.byPerson).sort((a,b)=>b[1].usd - a[1].usd);
    const payRows = Object.entries(nw.payables.byPerson).sort((a,b)=>b[1].usd - a[1].usd);
    html += `<div class="section-title"><h2>Activos</h2><span class="bold green">${fmtMoney(nw.assetsUSD)}</span></div><div class="card tight"><div class="list">`;
    html += nw.accounts.map(x=>`<button class="item clickable" data-go="#/cuentas/${x.acc.id}">${UI.accIcon(x.acc, 'sm')}<div class="body"><div class="title">${esc(x.acc.name)}${x.acc.tag ? `<span class="tagb">${esc(x.acc.tag)}</span>` : ''}</div><div class="sub">${fmtMoney(x.balance, x.acc.currency)}</div></div><div class="amt">${fmtMoney(x.usd)}</div></button>`).join('');
    html += group('showRec', 'Cuentas por cobrar', '🤝', 'g', nw.receivables.usd, recRows, 'Te debe');
    html += `</div></div>`;
    html += `<div class="section-title"><h2>Pasivos</h2><span class="bold red">${fmtMoney(nw.liabilitiesUSD)}</span></div><div class="card tight"><div class="list">`;
    html += group('showPay', 'Cuentas por pagar', '💸', 'r', nw.payables.usd, payRows, 'Le debes a');
    html += `</div></div><div class="xs muted center">Todo convertido a USD con las tasas actuales. El histórico usa la tasa de cada fecha.</div>`;
    return html;
  },
  chartSVG(series){
    const W = 600, H = 210, padL = 6, padR = 6, padT = 26, padB = 26;
    const vals = series.map(s=>s.net);
    const max = Math.max(0, ...vals), min = Math.min(0, ...vals); const range = (max - min) || 1;
    const innerH = H - padT - padB; const bw = (W - padL - padR) / series.length;
    const y0 = padT + (max / range) * innerH;
    let bars = '';
    series.forEach((s, i)=>{
      const h = Math.abs(s.net) / range * innerH; const y = s.net >= 0 ? y0 - h : y0;
      const x = padL + i * bw + bw * 0.18;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="4" fill="${s.net >= 0 ? 'var(--accent)' : 'var(--red)'}" opacity="${i===series.length - 1 ? 1 : 0.55}"/>`;
      bars += `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${fmtMonthShort(s.key).split(' ')[0]}</text>`;
      if (i===series.length - 1 || i===0) bars += `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${(s.net >= 0 ? y - 6 : y + h + 12).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${fmtMoney(s.net, 'USD', { decimals:0 })}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="${padL}" x2="${W - padR}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>${bars}</svg>`;
  },

  syncCard(){
    if (!Sync.enabled()) return `<div class="card"><div class="row"><div class="ic acc-ic" style="background:var(--card-2)">☁️</div><div class="grow"><div class="semibold">Sincronización no configurada</div><div class="small muted">Los datos se guardan solo en este dispositivo.</div></div></div></div>`;
    if (Sync.status==='error') return `<div class="card"><div class="row"><div class="ic acc-ic" style="background:var(--red-soft)">⚠️</div><div class="grow"><div class="semibold red">Error de sincronización</div><div class="small muted">${esc(Sync.lastError)}</div><div class="small muted ellipsis">${esc(Sync.user ? Sync.user.email || '' : '')}</div></div></div><div class="btnrow"><button class="btn sm" data-action="sync-push">${UI.icon('upload')} Reintentar subida</button><button class="btn secondary sm" data-action="sync-pull">Reconectar</button>${Sync.user ? '<button class="btn secondary sm" data-action="sync-logout">Salir</button>' : ''}</div></div>`;
    if (!Sync.user) return `<div class="card"><div class="row"><div class="ic acc-ic" style="background:var(--card-2)">☁️</div><div class="grow"><div class="semibold">Guarda tus datos en la nube</div><div class="small muted">Inicia sesión para tenerlos en todos tus dispositivos y no perderlos si borras la app.</div></div></div><button class="btn mt" data-action="sync-login">Iniciar sesión o crear cuenta</button></div>`;
    const syncing = Sync.status==='syncing';
    const counts = Sync.COLLS.map(c=>`${Store.data[c].length} ${({accounts:'cuentas', categories:'categorías', people:'personas', loans:'préstamos', transactions:'movimientos', budgets:'presupuestos'})[c]}`).join(' · ');
    return `<div class="card"><div class="row"><div class="ic acc-ic" style="background:var(--green-soft)">${syncing ? '⏳' : Sync.pending ? '🔄' : '✅'}</div><div class="grow"><div class="semibold">${syncing ? 'Sincronizando…' : Sync.pending ? `Subiendo ${Sync.pending} cambio${Sync.pending===1 ? '' : 's'}…` : 'Sincronizado'}</div><div class="small muted ellipsis">${esc(Sync.user.email || '')}</div></div><button class="btn secondary sm" data-action="sync-logout">Salir</button></div>
      <div class="xs muted mt">${counts}</div><div class="xs muted">Última subida: ${Sync.lastPushAt ? timeAgo(Sync.lastPushAt) : 'ninguna en esta sesión'}${navigator.onLine ? '' : ' · sin conexión'}</div>
      <div class="btnrow"><button class="btn secondary sm" data-action="sync-push">${UI.icon('upload')} Subir todo ahora</button><button class="btn secondary sm" data-action="sync-pull">${UI.icon('download')} Volver a descargar</button></div></div>`;
  },

  /* ----- Menú ----- */
  menu(){
    const item = (go, icon, label)=>`<button data-go="${go}"><div class="ic">${UI.icon(icon)}</div>${label}</button>`;
    return `<div class="topbar"><h1>Menú</h1></div>
      <h2>Gestión</h2><div class="menu-grid">${item('#/cuentas', 'wallet', 'Cuentas')}${item('#/presupuesto', 'target', 'Presupuesto')}${item('#/categorias', 'tag', 'Categorías')}${item('#/personas', 'users', 'Personas')}${item('#/tasas', 'coins', 'Tasas')}${item('#/balance', 'scale', 'Balance')}</div>
      <h2>Nube</h2>${this.syncCard()}
      <h2>Datos</h2><div class="card tight"><div class="list">
        <button class="item clickable" data-action="copy-json"><div class="ic">${UI.icon('file')}</div><div class="body"><div class="title">Copiar respaldo</div><div class="sub">Copia todos tus datos al portapapeles para pegarlos en otro dispositivo o app</div></div></button>
        <button class="item clickable" data-action="paste-json"><div class="ic">${UI.icon('check')}</div><div class="body"><div class="title">Pegar respaldo</div><div class="sub">Pega aquí un respaldo copiado para restaurarlo</div></div></button>
        <button class="item clickable" data-action="export-json"><div class="ic">${UI.icon('download')}</div><div class="body"><div class="title">Exportar respaldo</div><div class="sub">Archivo JSON con todos tus datos</div></div></button>
        <button class="item clickable" data-action="export-csv"><div class="ic">${UI.icon('file')}</div><div class="body"><div class="title">Exportar movimientos</div><div class="sub">CSV para Excel o Google Sheets</div></div></button>
        <button class="item clickable" data-action="import-json"><div class="ic">${UI.icon('upload')}</div><div class="body"><div class="title">Importar respaldo</div><div class="sub">Reemplaza los datos actuales con un archivo JSON</div></div></button>
        <button class="item clickable" data-action="reset"><div class="ic r">${UI.icon('trash')}</div><div class="body"><div class="title red">Borrar todos los datos</div><div class="sub">Empieza de cero en este dispositivo</div></div></button>
      </div></div>
      <h2>Instalar como app</h2><div class="card install-hint">
        <b>iPhone:</b> abre esta página en Safari, toca Compartir y luego <b>Añadir a pantalla de inicio</b>.<br>
        <b>Android:</b> en Chrome, menú ⋮ y <b>Instalar aplicación</b>.<br>
        <b>PC:</b> en Chrome o Edge, ícono de instalar en la barra de direcciones.<br><br>
        Los datos se guardan solo en este dispositivo. En iPhone, la app instalada y Safari guardan datos por separado: para pasarlos usa <b>Copiar respaldo</b> en uno y <b>Pegar respaldo</b> en el otro. Haz un respaldo cada cierto tiempo.
      </div>
      <div class="center mt"><button class="btn secondary sm" data-action="check-update">${UI.icon('refresh')} Buscar actualización</button><div class="xs muted" style="margin-top:8px">Mis Finanzas · versión ${APP_VERSION}</div></div>`;
  },

  /* ----- Cuentas ----- */
  accounts(){
    const S = App.state; const vc = S.viewCur;
    const all = Store.data.accounts.filter(a=>!a.archived);
    let html = this.back('#/menu', 'Cuentas', `<button class="iconbtn" data-action="new-account" aria-label="Nueva cuenta">${UI.icon('plus')}</button>`);
    if (!all.length){
      html += `<div class="card">${UI.empty('👛', 'Aún no tienes cuentas', 'Crea una por cada banco, billetera o exchange, en su moneda y con su saldo actual.')}<button class="btn" data-action="new-account">${UI.icon('plus')} Crear mi primera cuenta</button></div>`;
      return html;
    }
    const curs = CURRENCY_ORDER.filter(c=>all.some(a=>a.currency===c));
    const filter = curs.includes(S.accCur) ? S.accCur : 'all';
    let list = all.filter(a=>filter==='all' || a.currency===filter).map(a=>{ const bal = Calc.accountBalance(a); return { a, bal, usd: Calc.toUSD(bal, a.currency) }; });
    const sorters = { fav: (x,y)=>(!!y.a.favorite - !!x.a.favorite) || y.usd - x.usd, balance: (x,y)=>y.usd - x.usd, name: (x,y)=>x.a.name.localeCompare(y.a.name) };
    const sortLabels = { fav:'Favoritas', balance:'Saldo', name:'Nombre' };
    list.sort(sorters[S.accSort] || sorters.fav);
    const totalUSD = list.reduce((s,x)=>s + x.usd, 0);
    const totalShown = filter==='all' ? fmtMoney(Calc.fromUSD(totalUSD, vc), vc) : fmtMoney(list.reduce((s,x)=>s + x.bal, 0), filter);
    if (curs.length > 1) html += `<div class="seg mb"><button class="${filter==='all' ? 'active' : ''}" data-action="acc-filter" data-cur="all">Todas</button>${curs.map(c=>`<button class="${filter===c ? 'active' : ''}" data-action="acc-filter" data-cur="${c}">${CURRENCIES[c].short}</button>`).join('')}</div>`;
    const slices = list.filter(x=>x.usd > 0).map(x=>({ value: x.usd, color: x.a.color || colorFor(x.a.name) }));
    html += `<div class="card donut-card">${UI.donut(slices)}<div class="donut-info grow"><div class="label">Balance total</div><div class="big">${totalShown}</div>${filter==='all' ? `<div class="chips">${CURRENCY_ORDER.map(c=>`<button class="chip ${c===vc ? 'active' : ''}" data-action="viewcur" data-cur="${c}">${c}</button>`).join('')}</div>` : `<div class="small muted">≈ ${fmtMoney(totalUSD)}</div>`}</div></div>`;
    html += `<div class="row between" style="margin:4px 4px 8px"><span class="small muted">${list.length} cuenta${list.length===1 ? '' : 's'}</span><button class="btn secondary sm" data-action="acc-sort">${UI.icon('sort')} ${sortLabels[S.accSort] || 'Favoritas'}</button></div>`;
    html += `<div class="card tight"><div class="list">${list.map(x=>`<div class="item clickable" data-go="#/cuentas/${x.a.id}">${UI.accIcon(x.a)}<div class="body"><div class="title ellipsis">${esc(x.a.name)}${x.a.tag ? `<span class="tagb">${esc(x.a.tag)}</span>` : ''}</div><div class="sub">${fmtMoney(x.bal, x.a.currency)}${x.a.currency!=='USD' ? ` <span class="xs">≈ ${fmtMoney(x.usd)}</span>` : ''}</div></div><button class="starbtn ${x.a.favorite ? 'on' : ''}" data-action="fav-account" data-id="${x.a.id}" aria-label="Favorita">${UI.icon('star')}</button></div>`).join('')}</div></div>`;
    html += `<button class="btn secondary" data-action="new-account">${UI.icon('plus')} Nueva cuenta</button>`;
    return html;
  },
  account(id){
    const a = Store.account(id);
    if (!a) return this.back('#/cuentas', 'Cuenta') + UI.empty('🤷', 'Cuenta no encontrada');
    const bal = Calc.accountBalance(a); const txs = Calc.accountTxs(id);
    let html = this.back('#/cuentas', a.name, `<button class="iconbtn" data-action="edit-account" data-id="${id}" aria-label="Editar">${UI.icon('edit')}</button>`);
    html += `<div class="hero"><div class="row" style="margin-bottom:8px">${UI.accIcon(a)}<div class="label">${CURRENCIES[a.currency].name} · ${ACCOUNT_TYPES[a.type] || ''}${a.tag ? ' · ' + esc(a.tag) : ''}</div></div><div class="big">${fmtMoney(bal, a.currency)}</div><div class="sub">${a.currency!=='USD' ? `≈ ${fmtMoney(Calc.toUSD(bal, a.currency))} · ` : ''}saldo inicial ${fmtMoney(a.initial, a.currency)}</div></div>`;
    html += `<div class="btnrow" style="margin:0 0 12px"><button class="btn sm secondary" data-action="new-tx" data-kind="income" data-acc="${id}">Ingreso</button><button class="btn sm secondary" data-action="new-tx" data-kind="expense" data-acc="${id}">Egreso</button><button class="btn sm secondary" data-action="new-transfer" data-acc="${id}">Transferir</button></div>`;
    html += txs.length ? this.txGroups(txs) : `<div class="card">${UI.empty('🧾', 'Sin movimientos en esta cuenta')}</div>`;
    return html;
  },

  /* ----- Categorías ----- */
  categories(){
    const kind = App.state.catKind;
    const cats = Store.data.categories.filter(c=>c.kind===kind).sort((a,b)=>a.name.localeCompare(b.name));
    const ms = Calc.monthSummary(thisMonthKey());
    let html = this.back('#/menu', 'Categorías', `<button class="iconbtn" data-action="new-category" data-kind="${kind}" aria-label="Nueva categoría">${UI.icon('plus')}</button>`);
    html += `<div class="seg mb"><button class="${kind==='expense' ? 'active r' : ''}" data-action="cat-kind" data-kind="expense">Egresos</button><button class="${kind==='income' ? 'active g' : ''}" data-action="cat-kind" data-kind="income">Ingresos</button></div>`;
    html += cats.length ? `<div class="card tight"><div class="list">${cats.map(c=>{ const m = kind==='expense' ? ms.cats.find(x=>x.id===c.id) : null; return `<button class="item clickable" data-action="edit-category" data-id="${c.id}"><div class="ic">${c.icon}</div><div class="body"><div class="title">${esc(c.name)}</div>${m ? `<div class="sub">${fmtMoney(m.usd)} este mes</div>` : ''}</div><span class="chev">${UI.icon('chevron')}</span></button>`; }).join('')}</div></div>` : `<div class="card">${UI.empty('🏷️', 'Sin categorías')}</div>`;
    return html;
  },

  /* ----- Tasas ----- */
  rates(){
    const r = Store.data.settings.rates; const auto = Store.data.settings.autoRates;
    let html = this.back('#/menu', 'Tasas de cambio');
    html += `<div class="card"><div class="row between"><div><div class="semibold">Actualización automática</div><div class="small muted">Al abrir la app, si pasaron más de 30 min</div></div><button class="switch ${auto ? 'on' : ''}" data-action="toggle-auto" aria-label="Automático"></button></div>
      <button class="btn mt" data-action="refresh-rates" data-force="1">${UI.icon('refresh')} Actualizar ahora</button></div>`;
    html += `<div class="card tight"><div class="list">${['VES', 'COP', 'EUR', 'USDT'].map(c=>`<button class="item clickable" data-action="edit-rate" data-cur="${c}"><div class="ic" style="font-size:11px;font-weight:700">${c}</div><div class="body"><div class="title">${CURRENCIES[c].name}</div><div class="sub">${esc(r[c].source || 'Sin dato')}${r[c].manual && c!=='USDT' ? ' · manual' : ''} · ${timeAgo(r[c].updatedAt)}</div></div><div class="amt">${fmtRate(c, r[c].value)}<div class="sub">por 1 USD</div></div><span class="chev">${UI.icon('chevron')}</span></button>`).join('')}</div></div>`;
    html += `<div class="card install-hint"><b>Fuentes.</b> Bolívares y pesos: precio promedio de <b>venta de USDT en Binance P2P</b> (lo que te dan por tu USDT). Si Binance no responde para pesos, se usa la TRM oficial. Euros: tasa de mercado (ExchangeRate-API). Toca una tasa para fijarla a mano; la app guarda el histórico diario para valorar movimientos antiguos con la tasa de su fecha.</div>`;
    return html;
  },
};
