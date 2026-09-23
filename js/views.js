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
      <div class="sub">Patrimonio neto <b>${fmtMoney(nw.netUSD)}</b> · te deben <b>${fmtMoney(nw.receivables.usd)}</b> · debes <b>${fmtMoney(nw.payables.usd)}</b></div>
      <div class="chips">${CURRENCY_ORDER.map(c=>`<button class="chip ${c===vc ? 'active' : ''}" data-action="viewcur" data-cur="${c}">${CURRENCIES[c].short}</button>`).join('')}</div></div>`;
    const lu = Rates.lastUpdate();
    html += `<div class="card" style="padding:12px 14px"><div class="row between"><div class="chips grow">${['VES','COP','EUR'].map(c=>`<button class="chip" data-action="edit-rate" data-cur="${c}">${fmtRate(c, rates[c].value)}${rates[c].manual ? ' ✎' : ''}</button>`).join('')}</div><button class="iconbtn ghost ${Rates.busy ? 'spin' : ''}" data-action="refresh-rates" aria-label="Actualizar tasas">${UI.icon('refresh')}</button></div><div class="xs muted" style="margin-top:6px">Por 1 USD · Binance P2P (venta USDT) · actualizado ${timeAgo(lu)}</div></div>`;
    html += `<div class="grid2"><button class="stat" data-go="#/movimientos"><div class="t"><span class="dot g">${UI.icon('up')}</span>Ingresos del mes</div><div class="v">${fmtMoney(ms.income)}</div></button><button class="stat" data-go="#/movimientos"><div class="t"><span class="dot r">${UI.icon('down')}</span>Egresos del mes</div><div class="v">${fmtMoney(ms.expense)}</div></button></div>`;
    html += `<div class="section-title"><h2>Mis cuentas</h2><a class="link" href="#/cuentas">Ver todas</a></div>`;
    const curs = CURRENCY_ORDER.filter(c=>nw.byCurrency[c]);
    if (!curs.length) html += `<div class="card">${UI.empty('👛', 'Aún no tienes cuentas', 'Créalas desde Menú → Cuentas')}</div>`;
    for (const c of curs){
      const g = nw.byCurrency[c];
      html += `<div class="card tight"><div class="row between" style="padding:6px 16px 4px"><div class="semibold">${CURRENCIES[c].name}</div><div class="right"><div class="bold">${fmtMoney(g.total, c)}</div>${c!=='USD' ? `<div class="xs muted">≈ ${fmtMoney(g.usd)}</div>` : ''}</div></div><div class="list">${g.accounts.map(x=>`<button class="item clickable" data-go="#/cuentas/${x.acc.id}"><div class="body"><div class="title">${esc(x.acc.name)}</div><div class="sub">${ACCOUNT_TYPES[x.acc.type] || ''}</div></div><div class="amt">${fmtMoney(x.balance, c)}</div><span class="chev">${UI.icon('chevron')}</span></button>`).join('')}</div></div>`;
    }
    html += `<div class="section-title"><h2>Préstamos</h2><a class="link" href="#/personas">Ver personas</a></div><div class="grid2"><button class="stat" data-go="#/personas"><div class="t">Te deben</div><div class="v green">${fmtMoney(nw.receivables.usd)}</div><div class="xs muted">${Object.keys(nw.receivables.byPerson).length} persona(s)</div></button><button class="stat" data-go="#/personas"><div class="t">Debes</div><div class="v red">${fmtMoney(nw.payables.usd)}</div><div class="xs muted">${Object.keys(nw.payables.byPerson).length} persona(s)</div></button></div>`;
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
    const s = Calc.loansSummary();
    return `<div class="topbar"><h1>Personas</h1><button class="iconbtn" data-action="new-person" aria-label="Nueva persona">${UI.icon('plus')}</button></div>
      <div class="grid2"><div class="stat"><div class="t">Te deben</div><div class="v green">${fmtMoney(s.receivables.usd)}</div></div><div class="stat"><div class="t">Debes</div><div class="v red">${fmtMoney(s.payables.usd)}</div></div></div>
      <div class="search">${UI.icon('search')}<input data-search-people placeholder="Buscar persona" value="${esc(App.state.pq || '')}"></div>
      <div id="list">${this.peopleList()}</div>`;
  },
  peopleList(){
    const q = (App.state.pq || '').toLowerCase();
    const people = Store.peopleSorted().filter(p=>!q || p.name.toLowerCase().includes(q));
    if (!people.length) return `<div class="card">${UI.empty('👥', q ? 'Sin resultados' : 'Aún no hay personas', q ? '' : 'Agrega a quien le prestas o te presta dinero')}</div>${q ? '' : '<button class="btn" data-action="new-person">Agregar persona</button>'}`;
    const rows = people.map(p=>({ p, bal: Calc.personBalances(p.id), usd: Calc.personNetUSD(p.id) })).sort((a,b)=>Math.abs(b.usd) - Math.abs(a.usd) || a.p.name.localeCompare(b.p.name));
    return `<div class="card tight"><div class="list">${rows.map(r=>{ const l = this.balanceLines(r.bal); return `<button class="item clickable" data-go="#/personas/${r.p.id}">${UI.avatar(r.p.name)}<div class="body"><div class="title">${esc(r.p.name)}</div><div class="sub">${l.sub}</div></div><div class="amt">${l.amt}</div><span class="chev">${UI.icon('chevron')}</span></button>`; }).join('')}</div></div>`;
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
    const out = Calc.loanOutstanding(l), paid = Calc.loanPaid(l);
    const pct = l.amount ? Math.min(100, Math.round(paid / l.amount * 100)) : 0;
    const lent = l.direction==='lent'; const acc = l.accountId && Store.account(l.accountId);
    const overdue = l.dueDate && out > 0 && l.dueDate < todayISO();
    const pays = [...l.payments].sort((a,b)=>b.date.localeCompare(a.date));
    return `<div class="card flat"><div class="row between"><div class="grow"><div class="semibold">${lent ? 'Le prestaste' : 'Te prestó'} ${fmtMoney(l.amount, l.currency)}</div><div class="small muted">${fmtDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''} · ${acc ? esc(acc.name) : 'sin cuenta'}</div>${l.dueDate ? `<div class="xs ${overdue ? 'red' : 'muted'}">Vence ${fmtDate(l.dueDate)}${overdue ? ' · vencido' : ''}</div>` : ''}</div><div class="right"><div class="bold ${lent ? 'green' : 'red'}" style="font-size:17px">${fmtMoney(out, l.currency)}</div><div class="xs muted">pendiente${paid ? ` · abonado ${fmtMoney(paid, l.currency)}` : ''}</div></div></div>
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
    html += `<div class="section-title"><h2>Activos</h2><span class="bold green">${fmtMoney(nw.assetsUSD)}</span></div><div class="card tight"><div class="list">`;
    html += nw.accounts.map(x=>`<button class="item clickable" data-go="#/cuentas/${x.acc.id}"><div class="ic">${UI.icon('wallet')}</div><div class="body"><div class="title">${esc(x.acc.name)}</div><div class="sub">${fmtMoney(x.balance, x.acc.currency)}</div></div><div class="amt">${fmtMoney(x.usd)}</div></button>`).join('');
    html += Object.entries(nw.receivables.byPerson).sort((a,b)=>b[1].usd - a[1].usd).map(([pid, v])=>`<button class="item clickable" data-go="#/personas/${pid}"><div class="ic g">🤝</div><div class="body"><div class="title">Te debe ${esc(pname(pid))}</div><div class="sub">${curLine(v.byCur)}</div></div><div class="amt green">${fmtMoney(v.usd)}</div></button>`).join('');
    html += `<div class="item"><div class="body muted">Cuentas ${fmtMoney(nw.accountsUSD)} + por cobrar ${fmtMoney(nw.receivables.usd)}</div></div></div></div>`;
    html += `<div class="section-title"><h2>Pasivos</h2><span class="bold red">${fmtMoney(nw.liabilitiesUSD)}</span></div><div class="card tight"><div class="list">`;
    const pays = Object.entries(nw.payables.byPerson).sort((a,b)=>b[1].usd - a[1].usd);
    html += pays.length ? pays.map(([pid, v])=>`<button class="item clickable" data-go="#/personas/${pid}"><div class="ic r">💸</div><div class="body"><div class="title">Le debes a ${esc(pname(pid))}</div><div class="sub">${curLine(v.byCur)}</div></div><div class="amt red">${fmtMoney(v.usd)}</div></button>`).join('') : `<div class="item"><div class="body muted">No debes nada 🎉</div></div>`;
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

  /* ----- Menú ----- */
  menu(){
    const item = (go, icon, label)=>`<button data-go="${go}"><div class="ic">${UI.icon(icon)}</div>${label}</button>`;
    return `<div class="topbar"><h1>Menú</h1></div>
      <h2>Gestión</h2><div class="menu-grid">${item('#/cuentas', 'wallet', 'Cuentas')}${item('#/categorias', 'tag', 'Categorías')}${item('#/personas', 'users', 'Personas')}${item('#/tasas', 'coins', 'Tasas')}</div>
      <h2>Datos</h2><div class="card tight"><div class="list">
        <button class="item clickable" data-action="export-json"><div class="ic">${UI.icon('download')}</div><div class="body"><div class="title">Exportar respaldo</div><div class="sub">Archivo JSON con todos tus datos</div></div></button>
        <button class="item clickable" data-action="export-csv"><div class="ic">${UI.icon('file')}</div><div class="body"><div class="title">Exportar movimientos</div><div class="sub">CSV para Excel o Google Sheets</div></div></button>
        <button class="item clickable" data-action="import-json"><div class="ic">${UI.icon('upload')}</div><div class="body"><div class="title">Importar respaldo</div><div class="sub">Reemplaza los datos actuales con un archivo JSON</div></div></button>
        <button class="item clickable" data-action="reset"><div class="ic r">${UI.icon('trash')}</div><div class="body"><div class="title red">Borrar todos los datos</div><div class="sub">Empieza de cero en este dispositivo</div></div></button>
      </div></div>
      <h2>Instalar como app</h2><div class="card install-hint">
        <b>iPhone:</b> abre esta página en Safari, toca Compartir y luego <b>Añadir a pantalla de inicio</b>.<br>
        <b>Android:</b> en Chrome, menú ⋮ y <b>Instalar aplicación</b>.<br>
        <b>PC:</b> en Chrome o Edge, ícono de instalar en la barra de direcciones.<br><br>
        Los datos se guardan solo en este dispositivo. Haz un respaldo cada cierto tiempo desde "Exportar respaldo".
      </div>
      <div class="xs muted center mt">Mis Finanzas · v1.0</div>`;
  },

  /* ----- Cuentas ----- */
  accounts(){
    const nw = Calc.netWorth();
    let html = this.back('#/menu', 'Cuentas', `<button class="iconbtn" data-action="new-account" aria-label="Nueva cuenta">${UI.icon('plus')}</button>`);
    const curs = CURRENCY_ORDER.filter(c=>nw.byCurrency[c]);
    if (!curs.length) html += `<div class="card">${UI.empty('👛', 'Sin cuentas', 'Crea la primera con el botón +')}</div>`;
    for (const c of curs){
      const g = nw.byCurrency[c];
      html += `<div class="card tight"><div class="row between" style="padding:6px 16px 4px"><div class="semibold">${CURRENCIES[c].name}</div><div class="right"><div class="bold">${fmtMoney(g.total, c)}</div>${c!=='USD' ? `<div class="xs muted">≈ ${fmtMoney(g.usd)}</div>` : ''}</div></div><div class="list">${g.accounts.map(x=>`<button class="item clickable" data-go="#/cuentas/${x.acc.id}"><div class="ic">${UI.icon('wallet')}</div><div class="body"><div class="title">${esc(x.acc.name)}</div><div class="sub">${ACCOUNT_TYPES[x.acc.type] || ''}</div></div><div class="amt">${fmtMoney(x.balance, c)}</div><span class="chev">${UI.icon('chevron')}</span></button>`).join('')}</div></div>`;
    }
    html += `<div class="card row between"><span class="muted">Total en cuentas</span><span class="bold">${fmtMoney(nw.accountsUSD)}</span></div>`;
    return html;
  },
  account(id){
    const a = Store.account(id);
    if (!a) return this.back('#/cuentas', 'Cuenta') + UI.empty('🤷', 'Cuenta no encontrada');
    const bal = Calc.accountBalance(a); const txs = Calc.accountTxs(id);
    let html = this.back('#/cuentas', a.name, `<button class="iconbtn" data-action="edit-account" data-id="${id}" aria-label="Editar">${UI.icon('edit')}</button>`);
    html += `<div class="hero"><div class="label">${CURRENCIES[a.currency].name} · ${ACCOUNT_TYPES[a.type] || ''}</div><div class="big">${fmtMoney(bal, a.currency)}</div><div class="sub">${a.currency!=='USD' ? `≈ ${fmtMoney(Calc.toUSD(bal, a.currency))} · ` : ''}saldo inicial ${fmtMoney(a.initial, a.currency)}</div></div>`;
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
