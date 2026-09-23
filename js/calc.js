'use strict';
/* Cálculos: saldos, conversión, préstamos, patrimonio */
const Calc = {
  rate(cur, rates){
    rates = rates || Store.data.settings.rates;
    if (cur==='USD') return 1;
    const r = rates[cur];
    return r && r.value > 0 ? r.value : null;
  },
  /* tasa vigente en una fecha (histórico) o la actual */
  rateOn(cur, dateISO){
    if (cur==='USD') return 1;
    const h = Store.data.settings.rateHistory || {};
    const keys = Object.keys(h).filter(k=>k <= (dateISO || todayISO())).sort();
    for (let i=keys.length-1; i>=0; i--){ const v = h[keys[i]][cur]; if (v > 0) return v; }
    return this.rate(cur) || (cur==='USDT' ? 1 : null);
  },
  ratesOn(dateISO){
    const out = {};
    for (const c of Object.keys(CURRENCIES)) if (c!=='USD'){ const v = this.rateOn(c, dateISO); out[c] = { value: v || 0 }; }
    return out;
  },
  toUSD(amount, cur, rates){ const r = this.rate(cur, rates); return r ? amount / r : 0; },
  fromUSD(usd, cur, rates){ const r = this.rate(cur, rates); return r ? usd * r : 0; },
  convert(amount, from, to, rates){ if (from===to) return amount; return this.fromUSD(this.toUSD(amount, from, rates), to, rates); },
  txUSD(tx){ const r = tx.rateUSD || this.rate(tx.currency) || 1; return tx.amount / r; },

  txDelta(tx, accountId){
    let d = 0;
    if (tx.accountId===accountId){
      if (tx.kind==='income' || tx.kind==='loan_in' || tx.kind==='loan_collect') d += tx.amount;
      else d -= tx.amount;
    }
    if (tx.kind==='transfer' && tx.toAccountId===accountId) d += (tx.toAmount ?? tx.amount);
    return d;
  },
  accountBalance(acc, asOf){
    let b = Number(acc.initial) || 0;
    for (const tx of Store.data.transactions){ if (asOf && tx.date > asOf) continue; b += this.txDelta(tx, acc.id); }
    return round2(b);
  },
  sortDesc(a, b){ return b.date.localeCompare(a.date) || (b.createdAt||'').localeCompare(a.createdAt||''); },
  accountTxs(accountId){
    return Store.data.transactions.filter(t=>t.accountId===accountId || t.toAccountId===accountId).sort(this.sortDesc);
  },

  /* ----- intereses y plan de pago ----- */
  FREQ: {
    once:     { label:'Un solo pago', months:null, days:null },
    weekly:   { label:'Semanal',      months:7/30.4375,  days:7 },
    biweekly: { label:'Quincenal',    months:15/30.4375, days:15 },
    monthly:  { label:'Mensual',      months:1,          days:null },
  },
  PERIOD: { monthly:'mensual', yearly:'anual', total:'único' },
  daysBetween(a, b){ return Math.round((parseISO(b) - parseISO(a)) / 86400000); },
  monthsElapsed(a, b){
    const d1 = parseISO(a), d2 = parseISO(b);
    let m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (d2.getDate() < d1.getDate()) m--;
    return Math.max(0, m);
  },
  addFreq(dateISO, f, k){
    const d = parseISO(dateISO);
    if (f==='monthly') d.setMonth(d.getMonth() + k); else d.setDate(d.getDate() + k * (this.FREQ[f].days || 0));
    return toISO(d);
  },
  /* plazo en meses si el préstamo tiene un plan definido; null si es abierto */
  loanTermMonths(loan){
    const f = loan.frequency || 'once';
    if (f==='once') return loan.dueDate ? Math.max(1, this.daysBetween(loan.date, loan.dueDate) / 30.4375) : null;
    const n = Number(loan.installments) || 0;
    return n > 0 ? n * this.FREQ[f].months : null;
  },
  loanInterest(loan, asOf){
    const r = Number(loan.interestRate) || 0; if (!r) return 0;
    const P = loan.amount;
    if (loan.interestPeriod==='total') return round2(P * r / 100);
    const monthly = loan.interestPeriod==='yearly' ? r / 12 : r;
    const elapsed = this.monthsElapsed(loan.date, asOf || todayISO());
    const term = this.loanTermMonths(loan);
    const periods = term==null ? elapsed : Math.max(term, elapsed);
    return round2(P * monthly / 100 * periods);
  },
  loanTotal(loan, asOf){ return round2(loan.amount + this.loanInterest(loan, asOf)); },
  loanInstallment(loan){
    const n = Number(loan.installments) || 0; const f = loan.frequency || 'once';
    if (f==='once' || !n) return null;
    return round2(this.loanTotal(loan) / n);
  },
  loanNextDue(loan){
    if (!loan.dueDate || !this.loanIsOpen(loan)) return null;
    const f = loan.frequency || 'once';
    if (f==='once') return { date: loan.dueDate, amount: this.loanOutstanding(loan), k:0, n:1 };
    const n = Number(loan.installments) || 0; const cuota = this.loanInstallment(loan);
    let k = cuota ? Math.floor(this.loanPaid(loan) / cuota + 1e-6) : (loan.payments || []).length;
    if (n > 0) k = Math.min(k, n - 1);
    const out = this.loanOutstanding(loan);
    return { date: this.addFreq(loan.dueDate, f, k), amount: cuota ? Math.min(cuota, out) : out, k, n };
  },
  upcomingPayments(days=45){
    const lim = new Date(); lim.setDate(lim.getDate() + days); const limISO = toISO(lim);
    return Store.data.loans.map(l=>({ loan:l, due:this.loanNextDue(l) })).filter(x=>x.due && x.due.date <= limISO).sort((a,b)=>a.due.date.localeCompare(b.due.date));
  },
  loanPaid(loan, asOf){ return round2((loan.payments||[]).filter(p=>!asOf || p.date <= asOf).reduce((s,p)=>s + p.amount, 0)); },
  loanOutstanding(loan, asOf){ if (asOf && loan.date > asOf) return 0; return round2(Math.max(0, this.loanTotal(loan, asOf) - this.loanPaid(loan, asOf))); },
  loanIsOpen(loan){ return this.loanOutstanding(loan) > 0.004; },
  personLoans(personId){ return Store.data.loans.filter(l=>l.personId===personId).sort((a,b)=>b.date.localeCompare(a.date)); },
  personBalances(personId, asOf){
    const out = {};
    for (const l of Store.data.loans){
      if (l.personId!==personId) continue;
      const o = this.loanOutstanding(l, asOf); if (o <= 0) continue;
      out[l.currency] = out[l.currency] || { lent:0, borrowed:0, net:0 };
      if (l.direction==='lent') out[l.currency].lent += o; else out[l.currency].borrowed += o;
      out[l.currency].net = round2(out[l.currency].lent - out[l.currency].borrowed);
    }
    return out;
  },
  personNetUSD(personId, asOf, rates){
    const b = this.personBalances(personId, asOf);
    let usd = 0; for (const c in b) usd += this.toUSD(b[c].net, c, rates);
    return round2(usd);
  },
  loansSummary(asOf, rates){
    const rec = { usd:0, byPerson:{} }, pay = { usd:0, byPerson:{} };
    for (const l of Store.data.loans){
      const o = this.loanOutstanding(l, asOf); if (o <= 0) continue;
      const usd = this.toUSD(o, l.currency, rates);
      const tgt = l.direction==='lent' ? rec : pay;
      tgt.usd += usd;
      tgt.byPerson[l.personId] = tgt.byPerson[l.personId] || { usd:0, byCur:{} };
      tgt.byPerson[l.personId].usd += usd;
      tgt.byPerson[l.personId].byCur[l.currency] = (tgt.byPerson[l.personId].byCur[l.currency] || 0) + o;
    }
    rec.usd = round2(rec.usd); pay.usd = round2(pay.usd);
    return { receivables: rec, payables: pay };
  },
  netWorth(asOf, rates){
    rates = rates || Store.data.settings.rates;
    const accounts = Store.data.accounts.filter(a=>!a.archived).map(a=>{ const bal = this.accountBalance(a, asOf); return { acc:a, balance:bal, usd: this.toUSD(bal, a.currency, rates) }; });
    const accountsUSD = accounts.reduce((s,x)=>s + x.usd, 0);
    const byCurrency = {};
    for (const x of accounts){
      const g = byCurrency[x.acc.currency] = byCurrency[x.acc.currency] || { total:0, usd:0, accounts:[] };
      g.total += x.balance; g.usd += x.usd; g.accounts.push(x);
    }
    const { receivables, payables } = this.loansSummary(asOf, rates);
    const assetsUSD = accountsUSD + receivables.usd;
    return { accounts, byCurrency, accountsUSD: round2(accountsUSD), receivables, payables, assetsUSD: round2(assetsUSD), liabilitiesUSD: payables.usd, netUSD: round2(assetsUSD - payables.usd) };
  },
  monthlyNetWorthSeries(n=12){
    const out = []; let key = thisMonthKey();
    for (let i=0; i<n; i++){
      const end = i===0 ? todayISO() : monthEnd(key);
      const nw = this.netWorth(end, this.ratesOn(end));
      out.unshift({ key, net: nw.netUSD, assets: nw.assetsUSD, liabilities: nw.liabilitiesUSD });
      key = shiftMonth(key, -1);
    }
    return out;
  },
  monthTxs(key){ return Store.data.transactions.filter(t=>monthKey(t.date)===key); },
  budgetSummary(key){
    const ms = this.monthSummary(key); const spentBy = {}; ms.cats.forEach(c=>spentBy[c.id] = c.usd);
    const items = (Store.data.budgets || []).map(b=>{ const cat = Store.category(b.id); const spent = round2(spentBy[b.id] || 0); return { id: b.id, cat, amount: b.amount, spent, left: round2(b.amount - spent), pct: b.amount ? Math.round(spent / b.amount * 100) : 0 }; }).filter(x=>x.cat).sort((a,b)=>b.pct - a.pct);
    const total = items.reduce((s,x)=>s + x.amount, 0), spent = items.reduce((s,x)=>s + x.spent, 0);
    const others = ms.cats.filter(c=>!(Store.data.budgets || []).some(b=>b.id===c.id));
    return { items, total: round2(total), spent: round2(spent), left: round2(total - spent), pct: total ? Math.round(spent / total * 100) : 0, others, expense: ms.expense };
  },
  monthSummary(key){
    let income = 0, expense = 0; const byCat = {};
    for (const t of this.monthTxs(key)){
      if (t.kind==='income'){ income += this.txUSD(t); }
      else if (t.kind==='expense'){ const u = this.txUSD(t); expense += u; byCat[t.categoryId || 'none'] = (byCat[t.categoryId || 'none'] || 0) + u; }
    }
    const cats = Object.entries(byCat).map(([id, usd])=>({ id, cat: Store.category(id), usd })).sort((a,b)=>b.usd - a.usd);
    return { income: round2(income), expense: round2(expense), cats };
  },
};
