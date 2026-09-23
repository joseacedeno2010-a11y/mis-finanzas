'use strict';
/* Monedas, formato de números y fechas, utilidades */
const CURRENCIES = {
  USD:  { code:'USD',  name:'Dólares',          short:'Dólares', symbol:'$',    locale:'en-US', decimals:2, flag:'🇺🇸' },
  USDT: { code:'USDT', name:'USDT (Binance)',    short:'USDT',    symbol:'USDT', locale:'en-US', decimals:2, flag:'🟢' },
  VES:  { code:'VES',  name:'Bolívares',         short:'Bs',      symbol:'Bs',   locale:'es-VE', decimals:2, flag:'🇻🇪' },
  COP:  { code:'COP',  name:'Pesos colombianos', short:'Pesos',   symbol:'COP',  locale:'es-CO', decimals:0, flag:'🇨🇴' },
  EUR:  { code:'EUR',  name:'Euros',             short:'Euros',   symbol:'€',    locale:'es-ES', decimals:2, flag:'🇪🇺' },
};
const CURRENCY_ORDER = ['USD','USDT','VES','COP','EUR'];
const ACCOUNT_TYPES = { efectivo:'Efectivo', banco:'Banco', exchange:'Exchange / Cripto', billetera:'Billetera digital', otro:'Otro' };

function round2(x){ return Math.round((Number(x)||0)*100)/100; }
function fmtNum(n, decimals=2, locale='en-US'){
  return new Intl.NumberFormat(locale,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(Number(n)||0);
}
function fmtMoney(amount, cur='USD', opts={}){
  const c = CURRENCIES[cur] || CURRENCIES.USD;
  const dec = opts.decimals ?? c.decimals;
  const a = Number(amount)||0;
  const abs = Math.abs(a);
  const n = fmtNum(abs, dec, c.locale);
  let sign = '';
  if (a < 0 && abs >= Math.pow(10,-dec)/2) sign = '-';
  else if (opts.plus && a > 0) sign = '+';
  return `${sign}${c.symbol} ${n}`;
}
function fmtRate(cur, value){
  const c = CURRENCIES[cur]; if(!c || !value) return '—';
  const dec = cur==='COP' ? 0 : (value >= 100 ? 2 : 4);
  return `${c.symbol} ${fmtNum(value, dec, c.locale)}`;
}
/* Acepta "1.234,56", "1,234.56", "1234.5", "1.234" (=1234), "12,5" (=12.5) */
function parseAmount(str){
  if (typeof str === 'number') return str;
  let s = String(str ?? '').trim().replace(/\s/g,'').replace(/[^0-9.,-]/g,'');
  if(!s) return NaN;
  const neg = s.startsWith('-'); s = s.replace(/-/g,'');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc>=0 && ld>=0){
    s = lc>ld ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
  } else if (lc>=0 || ld>=0){
    const sep = lc>=0 ? ',' : '.';
    const parts = s.split(sep);
    if (parts.length===2 && parts[1].length===3 && parts[0].length>0) s = parts.join('');
    else if (parts.length===2) s = parts[0]+'.'+parts[1];
    else s = parts.join('');
  }
  const n = parseFloat(s);
  return neg ? -n : n;
}

/* Fechas (ISO local YYYY-MM-DD) */
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DAYS_SHORT = ['dom','lun','mar','mié','jue','vie','sáb'];
function pad2(n){ return String(n).padStart(2,'0'); }
function toISO(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function todayISO(){ return toISO(new Date()); }
function parseISO(s){ if(!s) return new Date(NaN); const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d||1); }
function monthKey(iso){ return (iso||'').slice(0,7); }
function thisMonthKey(){ return todayISO().slice(0,7); }
function shiftMonth(key, delta){ const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1+delta,1); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function monthEnd(key){ const [y,m]=key.split('-').map(Number); return toISO(new Date(y,m,0)); }
function fmtMonth(key){ const [y,m]=key.split('-').map(Number); const cap = MONTHS[m-1][0].toUpperCase()+MONTHS[m-1].slice(1); return `${cap} ${y}`; }
function fmtMonthShort(key){ const [y,m]=key.split('-').map(Number); return `${MONTHS_SHORT[m-1]} ${String(y).slice(2)}`; }
function fmtDate(iso, style='medium'){
  if(!iso) return 'Sin fecha';
  const d = parseISO(iso); if(isNaN(d)) return iso;
  const t = todayISO();
  if (style==='day'){
    if (iso===t) return 'Hoy';
    const y = new Date(); y.setDate(y.getDate()-1);
    if (iso===toISO(y)) return 'Ayer';
    const dd = `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    return d.getFullYear()===new Date().getFullYear() ? dd : `${dd} ${d.getFullYear()}`;
  }
  if (style==='short') return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(isoTs){
  if(!isoTs) return '—';
  const d = new Date(isoTs); if(isNaN(d)) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function timeAgo(isoTs){
  if(!isoTs) return 'nunca';
  const s = (Date.now()-new Date(isoTs).getTime())/1000;
  if (s<60) return 'hace un momento';
  if (s<3600) return `hace ${Math.floor(s/60)} min`;
  if (s<86400) return `hace ${Math.floor(s/3600)} h`;
  return `hace ${Math.floor(s/86400)} d`;
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase(); }
function colorFor(str){
  const palette = ['#0f766e','#2563eb','#7c3aed','#db2777','#ea580c','#ca8a04','#16a34a','#0891b2','#4f46e5','#be123c'];
  let h=0; for (const ch of String(str||'')) h=(h*31+ch.charCodeAt(0))>>>0;
  return palette[h%palette.length];
}
