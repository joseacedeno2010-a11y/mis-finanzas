'use strict';
/* Tasas de cambio (unidades de moneda por 1 USD).
   VES: Binance P2P, precio de venta de USDT (promedio), vía criptoya.
   COP: Binance P2P vía criptoya; si falla, TRM oficial (datos.gov.co).
   EUR: Banco Central Europeo vía frankfurter. */
const Rates = {
  async fetchJSON(url, ms=12000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  },
  async fetchVES(){
    const j = await this.fetchJSON('https://criptoya.com/api/binancep2p/USDT/VES/1');
    const v = Number(j.bid || j.totalBid);
    if (!v) throw new Error('Sin dato');
    return { value: v, source: 'Binance P2P · venta USDT' };
  },
  async fetchCOP(){
    try {
      const j = await this.fetchJSON('https://criptoya.com/api/binancep2p/USDT/COP/1');
      const v = Number(j.bid || j.totalBid);
      if (!v) throw new Error('Sin dato');
      return { value: v, source: 'Binance P2P · venta USDT' };
    } catch(e){
      const j = await this.fetchJSON('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC');
      const v = Number(j && j[0] && j[0].valor);
      if (!v) throw new Error('Sin dato TRM');
      return { value: v, source: 'TRM oficial (respaldo)' };
    }
  },
  async fetchEUR(){
    try {
      const j = await this.fetchJSON('https://open.er-api.com/v6/latest/USD');
      const v = Number(j && j.rates && j.rates.EUR);
      if (!v) throw new Error('Sin dato');
      return { value: v, source: 'Mercado (ExchangeRate-API)' };
    } catch(e){
      const j = await this.fetchJSON('https://criptoya.com/api/binancep2p/USDT/EUR/1');
      const v = Number(j.bid || j.totalBid);
      if (!v) throw new Error('Sin dato');
      return { value: v, source: 'Binance P2P · venta USDT (respaldo)' };
    }
  },

  busy: false,
  async refresh({ force=false }={}){
    if (this.busy) return null;
    this.busy = true;
    const jobs = [['VES', this.fetchVES()], ['COP', this.fetchCOP()], ['EUR', this.fetchEUR()]];
    const results = await Promise.allSettled(jobs.map(j=>j[1]));
    const rates = Store.data.settings.rates;
    const ok = [], failed = [];
    results.forEach((r, i)=>{
      const cur = jobs[i][0];
      if (r.status==='fulfilled'){
        if (rates[cur].manual && !force){ ok.push(cur); return; }
        rates[cur] = { value: r.value.value, source: r.value.source, updatedAt: new Date().toISOString(), manual: false };
        ok.push(cur);
      } else { failed.push(cur); console.warn('Tasa', cur, r.reason); }
    });
    this.recordHistory();
    Store.save();
    this.busy = false;
    return { ok, failed };
  },
  setManual(cur, value){
    Store.data.settings.rates[cur] = { value: Number(value), source: 'Manual', updatedAt: new Date().toISOString(), manual: true };
    this.recordHistory();
    Store.save();
  },
  recordHistory(){
    const r = Store.data.settings.rates;
    const snap = {};
    for (const c of Object.keys(r)) if (r[c].value > 0) snap[c] = r[c].value;
    Store.data.settings.rateHistory[todayISO()] = snap;
    const keys = Object.keys(Store.data.settings.rateHistory).sort();
    while (keys.length > 1100){ delete Store.data.settings.rateHistory[keys.shift()]; }
  },
  isStale(minutes=30){
    const r = Store.data.settings.rates;
    const ts = ['VES','COP','EUR'].map(c=>r[c].updatedAt).filter(Boolean);
    if (!ts.length) return true;
    const newest = Math.max(...ts.map(t=>new Date(t).getTime()));
    return Date.now() - newest > minutes*60000;
  },
  lastUpdate(){
    const r = Store.data.settings.rates;
    const ts = ['VES','COP','EUR'].map(c=>r[c].updatedAt).filter(Boolean);
    if (!ts.length) return null;
    return new Date(Math.max(...ts.map(t=>new Date(t).getTime()))).toISOString();
  },
};
