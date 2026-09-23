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

  loanPaid(loan, asOf){ return round2((loan.payments||[]).filter(p=>!asOf || p.date <= asOf).reduce((s,p)=>s + p.amount, 0)); },
  loanOutstanding(loan, asOf){ if (asOf && loan.date > asOf) return 0; return round2(Math.max(0, loan.amount - this.loanPaid(loan, asOf))); },
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
