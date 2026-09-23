'use strict';
/* Almacenamiento local (localStorage) y mutaciones con integridad préstamo <-> movimiento */
const Store = {
  KEY: 'finanzas.v1',
  data: null,

  defaults(){
    return {
      version: 1,
      settings: {
        baseCurrency: 'USD',
        autoRates: true,
        rates: {
          USDT: { value: 1, source: 'Fijo 1:1', updatedAt: null, manual: true },
          VES:  { value: 0, source: '', updatedAt: null, manual: false },
          COP:  { value: 0, source: '', updatedAt: null, manual: false },
          EUR:  { value: 0, source: '', updatedAt: null, manual: false },
        },
        rateHistory: {},
      },
      accounts: [], categories: [], people: [], loans: [], transactions: [],
    };
  },

  load(){
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw){
        const parsed = JSON.parse(raw);
        const def = this.defaults();
        this.data = Object.assign(def, parsed);
        this.data.settings = Object.assign(def.settings, parsed.settings || {});
        this.data.settings.rates = Object.assign(def.settings.rates, (parsed.settings || {}).rates || {});
        if (!this.data.settings.rateHistory) this.data.settings.rateHistory = {};
        this.migrate();
        return;
      }
    } catch(e){ console.warn('No se pudo leer el almacenamiento', e); }
    this.data = this.defaults();
    this.seed();
    this.save();
  },
  save(){ localStorage.setItem(this.KEY, JSON.stringify(this.data)); },

  /* ajustes a datos guardados por versiones anteriores */
  migrate(){
    const s = this.data.settings;
    if (!s.seedCleaned){
      // la v1.0 creaba 4 cuentas de ejemplo; se quitan si siguen sin usar
      const sample = ['Efectivo $', 'Binance', 'Banco Bs', 'Cuenta COP'];
      const used = new Set();
      this.data.transactions.forEach(t=>{ used.add(t.accountId); used.add(t.toAccountId); });
      this.data.loans.forEach(l=>{ used.add(l.accountId); (l.payments||[]).forEach(p=>used.add(p.accountId)); });
      this.data.accounts = this.data.accounts.filter(a=>!(sample.includes(a.name) && !(Number(a.initial)||0) && !used.has(a.id) && !a.site && !a.tag && !a.icon && !a.favorite));
      s.seedCleaned = true;
      this.save();
    }
  },

  seed(){
    const exp = [['Alimentación','🍽️'],['Transporte','🚗'],['Hogar','🏠'],['Servicios','💡'],['Salud','🩺'],['Diversión','🍸'],['Viajes','✈️'],['Ropa','👕'],['Educación','📚'],['Regalos','🎁'],['Trading','📉'],['Inversión','⭐'],['Bienestar','🌿'],['Suscripciones','🔁'],['Otros','📦']];
    const inc = [['Salario','💼'],['Trading','📈'],['Ventas','🛒'],['Freelance','💻'],['Intereses','💹'],['Regalo','🎁'],['Otros','📦']];
    exp.forEach(([name,icon])=>this.data.categories.push({ id: uid(), name, icon, kind:'expense' }));
    inc.forEach(([name,icon])=>this.data.categories.push({ id: uid(), name, icon, kind:'income' }));
  },

  /* lecturas */
  account(id){ return this.data.accounts.find(a=>a.id===id); },
  category(id){ return this.data.categories.find(c=>c.id===id); },
  person(id){ return this.data.people.find(p=>p.id===id); },
  loan(id){ return this.data.loans.find(l=>l.id===id); },
  tx(id){ return this.data.transactions.find(t=>t.id===id); },
  accountsSorted(){ return [...this.data.accounts].sort((a,b)=>CURRENCY_ORDER.indexOf(a.currency)-CURRENCY_ORDER.indexOf(b.currency) || a.name.localeCompare(b.name)); },
  peopleSorted(){ return [...this.data.people].sort((a,b)=>a.name.localeCompare(b.name)); },

  /* genérico */
  upsert(coll, obj){
    const arr = this.data[coll];
    const i = arr.findIndex(x=>x.id===obj.id);
    if (i>=0) arr[i] = Object.assign(arr[i], obj); else arr.push(obj);
    this.save(); return arr[i>=0?i:arr.length-1];
  },
  remove(coll, id){ this.data[coll] = this.data[coll].filter(x=>x.id!==id); this.save(); },

  /* movimientos */
  saveTx(tx){
    if (!tx.id) tx.id = uid();
    if (!tx.createdAt) tx.createdAt = new Date().toISOString();
    if (tx.rateUSD == null) tx.rateUSD = Calc.rateOn(tx.currency, tx.date);
    return this.upsert('transactions', tx);
  },
  deleteTx(id){
    const tx = this.tx(id); if (!tx) return;
    if (tx.loanId){
      if (tx.paymentId) return this.deletePayment(tx.loanId, tx.paymentId);
      const loan = this.loan(tx.loanId);
      if (loan){ loan.accountId = null; loan.accountAmount = null; loan.txId = null; }
    }
    this.remove('transactions', id);
  },

  /* préstamos */
  saveLoan(loan){
    if (!loan.id) loan.id = uid();
    if (!loan.payments) loan.payments = [];
    if (!loan.createdAt) loan.createdAt = new Date().toISOString();
    this._syncLoanTx(loan);
    return this.upsert('loans', loan);
  },
  _syncLoanTx(loan){
    const acc = loan.accountId ? this.account(loan.accountId) : null;
    if (acc){
      const kind = loan.direction==='lent' ? 'loan_out' : 'loan_in';
      const existing = loan.txId ? this.tx(loan.txId) : null;
      const tx = existing || { id: uid(), createdAt: new Date().toISOString() };
      Object.assign(tx, { kind, amount: round2(loan.accountAmount ?? loan.amount), currency: acc.currency, accountId: acc.id,
        personId: loan.personId, loanId: loan.id, paymentId: null, date: loan.date, note: loan.note || '', categoryId: null });
      tx.rateUSD = Calc.rateOn(tx.currency, tx.date);
      if (!existing) this.data.transactions.push(tx);
      loan.txId = tx.id;
    } else if (loan.txId){
      this.data.transactions = this.data.transactions.filter(t=>t.id!==loan.txId);
      loan.txId = null;
    }
  },
  deleteLoan(id){
    this.data.transactions = this.data.transactions.filter(t=>t.loanId!==id);
    this.remove('loans', id);
  },
  /* abonos */
  savePayment(loanId, p){
    const loan = this.loan(loanId); if (!loan) return;
    if (!p.id) p.id = uid();
    const acc = p.accountId ? this.account(p.accountId) : null;
    if (acc){
      const kind = loan.direction==='lent' ? 'loan_collect' : 'loan_repay';
      const existing = p.txId ? this.tx(p.txId) : null;
      const tx = existing || { id: uid(), createdAt: new Date().toISOString() };
      Object.assign(tx, { kind, amount: round2(p.accountAmount ?? p.amount), currency: acc.currency, accountId: acc.id,
        personId: loan.personId, loanId: loan.id, paymentId: p.id, date: p.date, note: p.note || '', categoryId: null });
      tx.rateUSD = Calc.rateOn(tx.currency, tx.date);
      if (!existing) this.data.transactions.push(tx);
      p.txId = tx.id;
    } else if (p.txId){
      this.data.transactions = this.data.transactions.filter(t=>t.id!==p.txId);
      p.txId = null;
    }
    const i = loan.payments.findIndex(x=>x.id===p.id);
    if (i>=0) loan.payments[i] = Object.assign(loan.payments[i], p); else loan.payments.push(p);
    this.save(); return p;
  },
  deletePayment(loanId, paymentId){
    const loan = this.loan(loanId); if (!loan) return;
    const p = loan.payments.find(x=>x.id===paymentId);
    if (p && p.txId) this.data.transactions = this.data.transactions.filter(t=>t.id!==p.txId);
    loan.payments = loan.payments.filter(x=>x.id!==paymentId);
    this.save();
  },
  deletePerson(id){
    const loanIds = this.data.loans.filter(l=>l.personId===id).map(l=>l.id);
    this.data.transactions = this.data.transactions.filter(t=>!loanIds.includes(t.loanId));
    this.data.loans = this.data.loans.filter(l=>l.personId!==id);
    this.remove('people', id);
  },
  deleteAccount(id){
    this.data.loans.forEach(l=>{
      if (l.accountId===id){ l.accountId = null; l.txId = null; }
      l.payments.forEach(p=>{ if (p.accountId===id){ p.accountId = null; p.txId = null; } });
    });
    this.data.transactions = this.data.transactions.filter(t=>t.accountId!==id && t.toAccountId!==id);
    this.remove('accounts', id);
  },

  /* respaldo */
  exportJSON(){ return JSON.stringify(this.data, null, 2); },
  importJSON(text){
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.transactions)) throw new Error('El archivo no tiene el formato esperado');
    localStorage.setItem(this.KEY, JSON.stringify(d));
    this.load();
  },
  reset(){ this.data = this.defaults(); this.seed(); this.save(); },
};
