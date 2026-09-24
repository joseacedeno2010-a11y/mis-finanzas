'use strict';
/* Robot de avisos. Corre en GitHub Actions cada 15 minutos (ver .github/workflows/avisos.yml).
   Lee los datos de cada usuario en Firestore, decide qué recordatorios tocan ahora (en la zona horaria
   del usuario) y los envía por Web Push a sus dispositivos. Cada aviso tiene una clave única y se anota en
   users/{uid}/meta/notifyLog para no repetirlo. */
const admin = require('firebase-admin');
const webpush = require('web-push');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id){ console.error('Falta el secreto FIREBASE_SERVICE_ACCOUNT'); process.exit(1); }
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY){ console.error('Faltan las claves VAPID'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:joseacedenof20@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const WINDOW_MIN = 40; // tolerancia por retrasos del cron (GitHub puede tardar)

/* ---------- utilidades de fecha ---------- */
function localParts(tz, date = new Date()){
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }); }
  catch(e){ f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }); }
  const p = Object.fromEntries(f.formatToParts(date).map(x=>[x.type, x.value]));
  const hour = p.hour==='24' ? 0 : Number(p.hour);
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour*60 + Number(p.minute) };
}
function hm(str, def){ const m = /^(\d{1,2}):(\d{2})$/.exec(str || ''); return m ? Number(m[1])*60 + Number(m[2]) : def; }
function inWindow(nowMin, targetMin){ return targetMin >= 0 && nowMin >= targetMin && nowMin < targetMin + WINDOW_MIN; }
function addDays(iso, n){ const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dowOf(iso){ return new Date(iso + 'T00:00:00Z').getUTCDay(); }
function fmtDate(iso){ const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']; const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} ${M[d.getUTCMonth()]}`; }
function fmtMoney(n, cur){
  const sym = { USD:'$', USDT:'USDT', VES:'Bs', COP:'COP', EUR:'€' }[cur] || cur;
  const dec = cur==='COP' ? 0 : 2;
  return `${sym} ${Number(n).toLocaleString(['VES','COP','EUR'].includes(cur) ? 'es-VE' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

/* ---------- préstamos (misma lógica que js/calc.js) ---------- */
const FREQ_MONTHS = { weekly: 7/30.4375, biweekly: 15/30.4375, monthly: 1 };
function loanPaid(l){ return (l.payments || []).reduce((s, p)=>s + (Number(p.amount) || 0), 0); }
function monthsElapsed(a, b){ const d1 = new Date(a + 'T00:00:00Z'), d2 = new Date(b + 'T00:00:00Z'); let m = (d2.getUTCFullYear() - d1.getUTCFullYear())*12 + (d2.getUTCMonth() - d1.getUTCMonth()); if (d2.getUTCDate() < d1.getUTCDate()) m--; return Math.max(0, m); }
function loanTotal(l, today){
  const r = Number(l.interestRate) || 0; if (!r) return l.amount;
  if (l.interestPeriod==='total') return l.amount * (1 + r/100);
  const monthly = l.interestPeriod==='yearly' ? r/12 : r;
  const f = l.frequency || 'once'; let term = null;
  if (f==='once'){ if (l.dueDate) term = Math.max(1, (new Date(l.dueDate) - new Date(l.date)) / 86400000 / 30.4375); }
  else if (Number(l.installments) > 0) term = Number(l.installments) * FREQ_MONTHS[f];
  const el = monthsElapsed(l.date, today);
  const periods = term==null ? el : Math.max(term, el);
  return l.amount * (1 + monthly/100 * periods);
}
function loanOutstanding(l, today){ return Math.max(0, loanTotal(l, today) - loanPaid(l)); }
function loanNextDue(l, today){
  if (!l.dueDate) return null;
  const out = loanOutstanding(l, today); if (out <= 0.004) return null;
  const f = l.frequency || 'once';
  if (f==='once') return { date: l.dueDate, amount: out };
  const n = Number(l.installments) || 0; const cuota = n ? loanTotal(l, today) / n : null;
  let k = cuota ? Math.floor(loanPaid(l) / cuota + 1e-6) : (l.payments || []).length;
  if (n > 0) k = Math.min(k, n - 1);
  const d = new Date(l.dueDate + 'T00:00:00Z');
  if (f==='monthly') d.setUTCMonth(d.getUTCMonth() + k); else d.setUTCDate(d.getUTCDate() + k * (f==='weekly' ? 7 : 15));
  return { date: d.toISOString().slice(0, 10), amount: cuota ? Math.min(cuota, out) : out };
}

/* ---------- por usuario ---------- */
async function coll(ref, name){ const s = await ref.collection(name).get(); return s.docs.map(d=>d.data()); }

async function processUser(uidRef){
  const uid = uidRef.id;
  const settingsSnap = await uidRef.collection('meta').doc('settings').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const cfg = Object.assign({ enabled:false, tz:'America/Caracas', morning:'07:00', evening:'21:00', habitsAt:'19:00', tasksAt:'20:00', tasks:true, habits:true, finance:true, focus:true, streaks:true }, settings.notify || {});
  if (!cfg.enabled) return { uid, skipped:'avisos desactivados' };
  const subsSnap = await uidRef.collection('pushSubs').get();
  const subs = subsSnap.docs.map(d=>({ ref: d.ref, ...d.data() }));
  if (!subs.length) return { uid, skipped:'sin dispositivos' };

  const now = localParts(cfg.tz); const today = now.date;
  const logRef = uidRef.collection('meta').doc('notifyLog');
  const logSnap = await logRef.get(); const log = logSnap.exists ? (logSnap.data().sent || {}) : {};
  const out = [];
  const push = (key, title, body, url='#/')=>{ if (!log[key]) out.push({ key, title, body, url }); };

  const [tasks, habits, habitLogs, rituals, ritualLogs, loans, people, journal, budgets, transactions, categories] =
    await Promise.all(['tasks','habits','habitLogs','rituals','ritualLogs','loans','people','journal','budgets','transactions','categories'].map(c=>coll(uidRef, c)));

  const todayTasks = tasks.filter(t=>t.date===today);
  const pendingTasks = todayTasks.filter(t=>!t.done);
  const dow = dowOf(today);
  const activeOn = d=>{ const dw = dowOf(d); return habits.filter(h=>!h.archived && (!h.days || !h.days.length || h.days.includes(dw)) && (!h.createdAt || String(h.createdAt).slice(0, 10) <= d)); };
  const activeHabits = activeOn(today);
  const doneToday = new Set(habitLogs.filter(l=>l.date===today).map(l=>l.habitId));
  const habitsLeft = activeHabits.filter(h=>!doneToday.has(h.id));
  const ritual = rituals.slice().sort((a, b)=>(a.order || 0) - (b.order || 0))[0];
  const ritualDone = !!(ritual && ritualLogs.some(l=>l.ritualId===ritual.id && l.date===today && l.completed));
  const morningMin = hm(cfg.morning, 7*60);

  // Buenos días
  if (inWindow(now.minutes, morningMin)){
    const parts = [];
    if (ritual && !ritualDone) parts.push('tu ritual te espera');
    if (todayTasks.length) parts.push(`${todayTasks.length} tarea${todayTasks.length===1 ? '' : 's'}`);
    if (activeHabits.length) parts.push(`${activeHabits.length} hábito${activeHabits.length===1 ? '' : 's'}`);
    push(`morning:${today}`, 'Buenos días ☀️', parts.length ? 'Hoy: ' + parts.join(' · ') + '.' : 'Empieza el día con intención. ¿Qué vas a lograr hoy?', '#/');
  }
  // Ritual a su hora (si tiene hora distinta de la del saludo)
  if (ritual && ritual.time && !ritualDone){ const rt = hm(ritual.time, -1); if (rt >= 0 && Math.abs(rt - morningMin) > WINDOW_MIN && inWindow(now.minutes, rt)) push(`ritual:${today}`, `${ritual.icon || '🌅'} Hora de tu ritual`, `${ritual.name}: ${(ritual.steps || []).length} pasos. Comienza ahora.`, '#/ritual'); }
  // Tareas con hora concreta (campo opcional "time")
  if (cfg.tasks) for (const t of pendingTasks){ if (t.time && inWindow(now.minutes, hm(t.time, -1))) push(`task:${t.id}:${today}`, '⏰ ' + t.title, t.minutes ? `${t.minutes} min planificados.` : 'Es la hora que elegiste.', '#/semana'); }
  // Tareas pendientes por la noche
  if (cfg.tasks && pendingTasks.length && inWindow(now.minutes, hm(cfg.tasksAt, 20*60))) push(`tasks:${today}`, `Te quedan ${pendingTasks.length} tarea${pendingTasks.length===1 ? '' : 's'} hoy`, pendingTasks.slice(0, 3).map(t=>'• ' + t.title).join('\n'), '#/semana');
  // Hábitos que faltan
  if (cfg.habits && habitsLeft.length && inWindow(now.minutes, hm(cfg.habitsAt, 19*60))) push(`habits:${today}`, `Faltan ${habitsLeft.length} hábito${habitsLeft.length===1 ? '' : 's'} hoy`, habitsLeft.slice(0, 4).map(h=>(h.icon || '•') + ' ' + h.name).join('  '), '#/habitos');
  // Racha en riesgo (2 h después del aviso de hábitos)
  if (cfg.streaks && habitsLeft.length && inWindow(now.minutes, hm(cfg.habitsAt, 19*60) + 120)){
    let streak = 0;
    for (let i=1; i<90; i++){ const d = addDays(today, -i); const hs = activeOn(d); if (!hs.length) continue; const done = new Set(habitLogs.filter(l=>l.date===d).map(l=>l.habitId)); if (hs.every(h=>done.has(h.id))) streak++; else break; }
    if (streak >= 2) push(`streak:${today}`, `🔥 Llevas ${streak} días de racha`, `Te falta${habitsLeft.length===1 ? '' : 'n'} ${habitsLeft.length} hábito${habitsLeft.length===1 ? '' : 's'} para no romperla hoy.`, '#/habitos');
  }
  // Reflexión nocturna
  const j = journal.find(x=>x.id===today);
  if (inWindow(now.minutes, hm(cfg.evening, 21*60)) && !(j && (j.mood || j.highlights || j.gratitude))) push(`evening:${today}`, '🌙 ¿Cómo estuvo tu día?', 'Un minuto para cerrar: tu ánimo, lo mejor y por qué das gracias.', '#/diario');
  // Finanzas: préstamos que vencen hoy/mañana o atrasados (con el saludo de la mañana) y presupuesto
  if (cfg.finance && inWindow(now.minutes, morningMin)){
    const tomorrow = addDays(today, 1);
    for (const l of loans){
      const d = loanNextDue(l, today); if (!d) continue;
      const p = people.find(x=>x.id===l.personId); const who = p ? p.name : 'alguien'; const lent = l.direction==='lent';
      if (d.date===today || d.date===tomorrow) push(`loan:${l.id}:${d.date}`, lent ? `💵 ${d.date===today ? 'Hoy' : 'Mañana'} te paga ${who}` : `💸 ${d.date===today ? 'Hoy' : 'Mañana'} le pagas a ${who}`, `${fmtMoney(d.amount, l.currency)} · vence ${d.date===today ? 'hoy' : 'mañana'}${l.note ? ' · ' + l.note : ''}`, '#/personas/' + l.personId);
      else if (d.date < today) push(`loanlate:${l.id}:${today}`, lent ? `⚠️ ${who} se atrasó` : `⚠️ Tienes un pago atrasado con ${who}`, `${fmtMoney(d.amount, l.currency)} venció el ${fmtDate(d.date)}.`, '#/personas/' + l.personId);
    }
    if (budgets.length){
      const month = today.slice(0, 7);
      const rates = (settings.rates || {});
      const toUSD = (amt, cur)=>cur==='USD' ? amt : (rates[cur] && rates[cur].value > 0 ? amt / rates[cur].value : 0);
      const spentBy = {};
      for (const t of transactions){ if (t.kind==='expense' && String(t.date).slice(0, 7)===month){ const usd = t.rateUSD ? t.amount / t.rateUSD : toUSD(t.amount, t.currency); spentBy[t.categoryId] = (spentBy[t.categoryId] || 0) + usd; } }
      for (const b of budgets){
        const spent = spentBy[b.id] || 0; const pct = b.amount ? spent / b.amount : 0; const cat = categories.find(c=>c.id===b.id); const name = cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'una categoría';
        if (pct >= 1) push(`budget100:${b.id}:${month}`, `🚨 Presupuesto excedido: ${name}`, `Llevas ${fmtMoney(spent, 'USD')} de ${fmtMoney(b.amount, 'USD')} este mes.`, '#/presupuesto');
        else if (pct >= 0.8) push(`budget80:${b.id}:${month}`, `⚠️ ${name} al ${Math.round(pct*100)}%`, `Te quedan ${fmtMoney(b.amount - spent, 'USD')} de ${fmtMoney(b.amount, 'USD')} este mes.`, '#/presupuesto');
      }
    }
  }
  // Sesión de enfoque terminada con la app cerrada
  const focus = settings.dia && settings.dia.focus;
  if (cfg.focus && focus && focus.endsAt && !focus.pausedAt && Date.now() >= focus.endsAt && Date.now() < focus.endsAt + 20*60000) push(`focus:${focus.endsAt}`, '🎯 Sesión de enfoque terminada', `${focus.minutes} min${focus.label ? ' · ' + focus.label : ''}. ¡Bien hecho!`, '#/enfoque');

  if (!out.length) return { uid, sent: 0 };
  let sent = 0;
  for (const n of out){
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.key });
    for (const s of subs){
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600, urgency:'normal' }); sent++; }
      catch(e){
        if (e.statusCode===404 || e.statusCode===410){ await s.ref.delete(); console.log('dispositivo dado de baja', uid); }
        else console.error('push falló', uid, e.statusCode, e.body || e.message);
      }
    }
    log[n.key] = Date.now();
  }
  const cutoff = Date.now() - 10*86400000;
  for (const k of Object.keys(log)) if (log[k] < cutoff) delete log[k];
  await logRef.set({ sent: log });
  return { uid, sent, keys: out.map(n=>n.key) };
}

(async()=>{
  const refs = await db.collection('users').listDocuments();
  const results = [];
  for (const r of refs){ try { results.push(await processUser(r)); } catch(e){ console.error('usuario', r.id, e); results.push({ uid: r.id, error: e.message }); } }
  console.log(new Date().toISOString(), JSON.stringify(results));
  process.exit(0);
})();
