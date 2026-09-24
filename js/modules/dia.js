'use strict';
/* Módulo "Mi día": ritual matutino, temporizador de enfoque, palabras guía, pregunta del día y reflexión nocturna.
   Colecciones propias: rituals, ritualLogs, focusSessions, journal (id = fecha, una entrada por día). */

const DIA_QUESTIONS = [
  // propósito
  '¿Qué harías hoy si supieras que no puedes fallar?',
  '¿Qué actividad te hace perder la noción del tiempo?',
  'Si tu vida fuera un libro, ¿cómo se llamaría el capítulo actual?',
  '¿Qué te gustaría que dijeran de ti dentro de diez años?',
  '¿Qué parte de tu día te hace sentir más vivo?',
  '¿Qué dejarías de hacer si nadie te estuviera mirando?',
  '¿A qué le dirías que no esta semana para decirle que sí a lo importante?',
  '¿Qué pequeño paso te acerca hoy a la vida que quieres?',
  // relaciones
  '¿A quién le debes una llamada o un mensaje?',
  '¿Quién te hizo sentir bien últimamente y por qué?',
  '¿Qué persona te inspira y qué podrías aprender de ella?',
  '¿Cómo puedes hacer sentir valorada a alguien hoy?',
  '¿Qué conversación pendiente te quitaría un peso de encima?',
  '¿Con quién te gustaría pasar más tiempo este mes?',
  '¿Qué te gustaría perdonar (o perdonarte) para avanzar?',
  '¿Qué haces que hace la vida de otros más fácil?',
  // hábitos
  '¿Qué hábito pequeño, si lo mantuvieras un año, cambiaría tu vida?',
  '¿Qué te roba más energía en un día normal?',
  '¿Qué haces por costumbre que ya no te suma?',
  '¿Cuál es tu mejor hora del día y cómo la estás usando?',
  '¿Qué te ayudó a dormir mejor la última vez que descansaste bien?',
  '¿Qué haces cuando estás por rendirte con algo?',
  '¿Qué distracción te gustaría dejar por una semana?',
  '¿Qué rutina te gustaría tener y qué te detiene?',
  // dinero
  '¿Qué compra reciente te dio más felicidad por lo que costó?',
  '¿En qué gasto sientes que estás pagando por una versión de ti que no existe?',
  '¿Cómo sería un mes sin gastos innecesarios? ¿Qué harías con lo ahorrado?',
  '¿Qué te enseñaron sobre el dinero en tu casa y qué quieres conservar?',
  '¿Qué meta de dinero te emociona de verdad?',
  '¿Qué gasto pequeño y repetido podrías revisar hoy?',
  'Si te llegara un ingreso extra este mes, ¿a qué lo destinarías primero?',
  '¿Qué significa para ti "tener suficiente"?',
  // salud
  '¿Cómo se siente tu cuerpo ahora mismo? ¿Qué te pide?',
  '¿Qué comida te hace sentir bien horas después de comerla?',
  '¿Cuándo fue la última vez que moviste el cuerpo por gusto y no por deber?',
  '¿Qué harías distinto si tu energía fuera tu recurso más valioso?',
  '¿Qué te ayuda a calmarte cuando estás tenso?',
  '¿Qué límite necesitas poner para cuidar tu descanso?',
  '¿Qué actividad al aire libre podrías regalarte esta semana?',
  '¿Qué señal de cansancio sueles ignorar?',
  // gratitud
  '¿Qué tienes hoy que hace un año era solo un deseo?',
  '¿Qué comodidad cotidiana das por sentada?',
  '¿Qué habilidad tuya agradeces tener?',
  '¿Qué momento de la última semana volverías a vivir?',
  '¿Qué dificultad pasada te hizo mejor persona?',
  '¿A quién le agradecerías hoy si tuvieras que elegir a una sola persona?',
  '¿Qué lugar te hace sentir en paz?',
  '¿Qué te hizo sonreír hoy, aunque fuera pequeño?',
  // decisiones
  '¿Qué decisión llevas postergando y qué es lo peor que puede pasar si la tomas?',
  '¿Qué elegirías si el miedo no opinara?',
  '¿Qué decisión reciente estuvo bien tomada? ¿Qué la hizo buena?',
  '¿Qué consejo le darías a alguien en tu misma situación?',
  '¿Qué te diría tu yo de 80 años sobre lo que te preocupa hoy?',
  '¿Qué pesa más para ti ahora: la seguridad o la aventura? ¿Por qué?',
  '¿Qué compromiso deberías soltar para tener espacio?',
  '¿Qué harías con una hora libre de verdad, sin pantallas?',
  // crecimiento, emociones y trabajo
  '¿Qué aprendiste esta semana que no sabías la anterior?',
  '¿Qué error reciente te enseñó algo valioso?',
  '¿Qué te da miedo intentar y qué ganarías si lo hicieras?',
  '¿En qué eres mejor hoy que hace un año?',
  '¿Qué emoción has estado evitando sentir?',
  '¿Qué necesitas escuchar hoy que nadie te ha dicho?',
  '¿Qué parte de tu trabajo disfrutas de verdad?',
  '¿Qué harías si tuvieras un día entero solo para ti?',
  '¿Qué te gustaría aprender antes de que termine el año?',
  '¿Qué te dice tu intuición sobre algo que estás dudando?',
  '¿Qué te haría sentir orgulloso al final de esta semana?',
  '¿Qué cosa sencilla podrías simplificar aún más?',
  '¿A qué le estás dando más importancia de la que merece?',
  '¿Qué recuerdo de tu infancia te sigue dando alegría?',
  '¿Qué versión de ti quieres que aparezca en el próximo reto difícil?',
  '¿Qué te gustaría celebrar hoy que normalmente pasa desapercibido?',
];
const DIA_WORDS = ['Enfocado', 'Tranquilo', 'Valiente', 'Presente', 'Agradecido', 'Disciplinado', 'Alegre', 'Paciente'];
const DIA_MOODS = [[1, '😞', 'Mal'], [2, '😕', 'Regular'], [3, '😐', 'Normal'], [4, '🙂', 'Bien'], [5, '😄', 'Genial']];
const DIA_TEMPLATE = { name:'Ritual matutino', icon:'🌅', time:'07:00', steps:['Despertar sin celular 📵', 'Agua 💧', 'Estirar 🧘', 'Escribir 3 prioridades ✍️', 'Leer 10 min 📚'] };
const DIA_FOCUS_CHIPS = [15, 20, 45, 60];
const DIA_FOCUS_DEFAULT = 20;

const Dia = {
  _timer: null,

  /* ---------- ajustes propios (Store.data.settings.dia) ---------- */
  settings(){ const s = Store.data.settings; if (!s.dia || typeof s.dia!=='object') s.dia = {}; return s.dia; },
  focus(){ const f = this.settings().focus; return f && f.endsAt ? f : null; },

  /* ---------- utilidades ---------- */
  plural(n, one, many){ return `${n} ${n===1 ? one : many}`; },
  fmtMin(m){ m = Math.round(Number(m) || 0); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; },
  fmtTime(x){ const d = new Date(x); return isNaN(d) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; },
  clock(ms){ const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; },
  splitEmoji(text){
    const t = String(text || '').trim();
    const pict = '\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|\\p{Emoji_Modifier})*';
    let m = t.match(new RegExp(`^(.*?)\\s*(${pict})$`, 'u')); if (m && m[1]) return { emoji: m[2], text: m[1] };
    m = t.match(new RegExp(`^(${pict})\\s*(.*)$`, 'u')); if (m && m[2]) return { emoji: m[1], text: m[2] };
    return { emoji: '', text: t };
  },

  /* =====================================================================
     RITUALES
     ===================================================================== */
  rituals(){ return [...Store.list('rituals')].sort((a, b)=>(a.order || 0) - (b.order || 0)); },
  ritual(id){ return Store.list('rituals').find(r=>r.id===id); },
  mainRitual(){ return this.rituals()[0] || null; },
  currentRitual(){ const id = App.state.dia_ritual; return (id && this.ritual(id)) || this.mainRitual(); },
  log(rid, date){ return Store.list('ritualLogs').find(l=>l.ritualId===rid && l.date===date) || null; },
  logOrNew(rid, date){ return this.log(rid, date) || { id: uid(), ritualId: rid, date, stepsDone: [], completed: false, completedAt: null }; },
  saveLog(r, log){
    const valid = new Set(r.steps.map(s=>s.id));
    log.stepsDone = (log.stepsDone || []).filter(id=>valid.has(id));
    if (r.steps.length && log.stepsDone.length===r.steps.length){ if (!log.completed){ log.completed = true; log.completedAt = new Date().toISOString(); } }
    else if (!log.stepsDone.length){ log.completed = false; log.completedAt = null; }
    Store.upsert('ritualLogs', log);
    return log;
  },
  ritualStatus(r, date){ const log = this.log(r.id, date); const done = log ? log.stepsDone.length : 0; return { log, done, total: r.steps.length, completed: !!(log && log.completed) }; },
  completedDates(rid){ return new Set(Store.list('ritualLogs').filter(l=>l.ritualId===rid && l.completed).map(l=>l.date)); },
  streak(rid){
    const done = this.completedDates(rid); const d = new Date();
    if (!done.has(toISO(d))) d.setDate(d.getDate() - 1);   // si hoy aún no está, la racha sigue viva desde ayer
    let n = 0; while (done.has(toISO(d))){ n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  bestStreak(rid){
    const dates = [...this.completedDates(rid)].sort(); let best = 0, run = 0, prev = null;
    for (const iso of dates){
      if (prev){ const p = parseISO(prev); p.setDate(p.getDate() + 1); run = toISO(p)===iso ? run + 1 : 1; } else run = 1;
      if (run > best) best = run; prev = iso;
    }
    return best;
  },
  useTemplate(){
    const r = { id: uid(), name: DIA_TEMPLATE.name, icon: DIA_TEMPLATE.icon, time: DIA_TEMPLATE.time, steps: DIA_TEMPLATE.steps.map(t=>({ id: uid(), text: t })), order: this.rituals().length };
    Store.upsert('rituals', r); App.state.dia_ritual = r.id; App.render(); UI.toast('Ritual creado. ¡Cuando quieras, comiénzalo!');
  },
  toggleStep(rid, stepId){
    const r = this.ritual(rid); if (!r) return;
    const log = this.logOrNew(rid, todayISO()); const was = log.completed;
    if (log.stepsDone.includes(stepId)) log.stepsDone = log.stepsDone.filter(x=>x!==stepId); else log.stepsDone.push(stepId);
    this.saveLog(r, log);
    if (!was && log.completed) UI.toast(`Ritual completado 🔥 Racha: ${this.plural(this.streak(rid), 'día', 'días')}`);
  },

  /* --- formulario crear / editar ritual --- */
  ritualForm(r=null){
    const editing = !!r;
    const steps = r ? r.steps.map(s=>({ id: s.id, text: s.text })) : [{ id: uid(), text:'' }, { id: uid(), text:'' }, { id: uid(), text:'' }];
    const s = UI.sheet({ title: editing ? 'Editar ritual' : 'Nuevo ritual', html:`
      <div class="row mb" style="align-items:flex-end"><div class="field" style="width:84px;margin:0"><label>Emoji</label><input name="icon" value="${esc(r ? r.icon : '🌅')}" maxlength="4" style="text-align:center;font-size:22px"></div><div class="field grow" style="margin:0"><label>Nombre</label><input name="name" placeholder="Ej. Ritual matutino" value="${esc(r ? r.name : '')}"${editing ? '' : ' autofocus'}></div></div>
      <div class="field"><label>Hora (opcional)</label><input type="time" name="time" value="${esc((r && r.time) || '')}"></div>
      <div class="field"><label>Pasos, en orden</label><div data-steps></div><button class="btn secondary sm" data-add>${UI.icon('plus')} Agregar paso</button><div class="hint">Cada paso es una pantalla cuando comienzas el ritual. Si pones un emoji al final, se muestra en grande.</div></div>
      <button class="btn" data-save>${editing ? 'Guardar cambios' : 'Crear ritual'}</button>
      ${editing ? `<button class="btn danger mt" data-del>${UI.icon('trash')} Eliminar ritual</button>` : ''}` });
    const box = s.body.querySelector('[data-steps]');
    const read = ()=>{ box.querySelectorAll('[data-i]').forEach(inp=>{ steps[+inp.dataset.i].text = inp.value; }); };
    const paint = ()=>{ box.innerHTML = steps.map((st, i)=>`<div class="dia-steprow"><span class="xs muted dia-stepnum">${i + 1}</span><input data-i="${i}" placeholder="Ej. Agua 💧" value="${esc(st.text)}"><button type="button" data-up="${i}" aria-label="Subir"${i===0 ? ' disabled' : ''}>${UI.icon('up')}</button><button type="button" data-down="${i}" aria-label="Bajar"${i===steps.length - 1 ? ' disabled' : ''}>${UI.icon('down')}</button><button type="button" data-rm="${i}" aria-label="Quitar">${UI.icon('x')}</button></div>`).join('') || '<div class="small muted mb">Sin pasos todavía.</div>'; };
    paint();
    box.addEventListener('click', e=>{
      const b = e.target.closest('button'); if (!b) return; read();
      if (b.dataset.up!=null){ const i = +b.dataset.up; if (i > 0) [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; }
      else if (b.dataset.down!=null){ const i = +b.dataset.down; if (i < steps.length - 1) [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; }
      else if (b.dataset.rm!=null) steps.splice(+b.dataset.rm, 1);
      paint();
    });
    s.body.querySelector('[data-add]').onclick = ()=>{ read(); steps.push({ id: uid(), text:'' }); paint(); const last = box.querySelector(`[data-i="${steps.length - 1}"]`); if (last) last.focus(); };
    s.body.querySelector('[data-save]').onclick = ()=>{
      read();
      const name = s.body.querySelector('[name=name]').value.trim(); if (!name) return UI.toast('Ponle un nombre al ritual', true);
      const clean = steps.map(st=>({ id: st.id, text: st.text.trim() })).filter(st=>st.text);
      if (!clean.length) return UI.toast('Agrega al menos un paso', true);
      const obj = { id: r ? r.id : uid(), name, icon: s.body.querySelector('[name=icon]').value.trim() || '🌅', time: s.body.querySelector('[name=time]').value || '', steps: clean, order: r ? (r.order || 0) : this.rituals().length };
      Store.upsert('rituals', obj); App.state.dia_ritual = obj.id; s.close(); App.render(); UI.toast(editing ? 'Ritual actualizado' : 'Ritual creado');
    };
    const del = s.body.querySelector('[data-del]');
    if (del) del.onclick = async ()=>{
      if (!(await UI.confirm('¿Eliminar este ritual y todo su historial?'))) return;
      Store.list('ritualLogs').filter(l=>l.ritualId===r.id).forEach(l=>Store.remove('ritualLogs', l.id));
      Store.remove('rituals', r.id); App.state.dia_ritual = null; s.close(); App.render(); UI.toast('Ritual eliminado');
    };
  },

  /* --- experiencia paso a paso --- */
  runRitual(id){
    const r = this.ritual(id); if (!r) return UI.toast('Ritual no encontrado', true);
    if (!r.steps.length) return UI.toast('Este ritual no tiene pasos. Edítalo primero.', true);
    const date = todayISO(); const log = this.logOrNew(r.id, date);
    const pending = r.steps.filter(st=>!log.stepsDone.includes(st.id));
    let idx = 0, skipped = 0;
    const s = UI.sheet({ title: null, html:'<div class="dia-run"></div>', onClose: ()=>App.render() });
    const box = s.body.querySelector('.dia-run');
    const finish = ()=>{
      if (log.stepsDone.length){
        if (!log.completed){ log.completed = true; log.completedAt = new Date().toISOString(); }
        Store.upsert('ritualLogs', log);
      }
      const streak = this.streak(r.id), best = this.bestStreak(r.id);
      if (log.stepsDone.length){
        const sub = skipped ? `Saltaste ${this.plural(skipped, 'paso', 'pasos')}. Puedes marcarlos después en la lista de hoy.` : `${r.steps.length} de ${r.steps.length} pasos · así se empieza el día.`;
        box.innerHTML = `<div class="dia-run-mid"><div class="dia-done-big">🔥</div><div class="dia-run-text">Ritual completado</div><div class="dia-num">Racha: ${this.plural(streak, 'día', 'días')}</div>${streak > 1 && streak===best ? '<span class="badge a">🏆 Tu mejor racha</span>' : ''}<div class="muted small">${sub}</div></div><button class="btn" data-close>Listo</button>`;
      } else {
        box.innerHTML = `<div class="dia-run-mid"><div class="dia-done-big">🌤️</div><div class="dia-run-text">Sin pasos hechos</div><div class="muted small">No pasa nada. Puedes retomarlo más tarde hoy mismo.</div></div><button class="btn secondary" data-close>Cerrar</button>`;
      }
    };
    const paint = ()=>{
      if (idx >= pending.length) return finish();
      const st = pending[idx]; const n = r.steps.indexOf(st) + 1; const total = r.steps.length; const done = log.stepsDone.length;
      const { emoji, text } = this.splitEmoji(st.text);
      box.innerHTML = `<div class="dia-run-top"><span>${esc(r.icon)} ${esc(r.name)}</span><span>Paso ${n} de ${total}</span></div>
        <div class="progress"><div style="width:${Math.round(done / total * 100)}%"></div></div>
        <div class="dia-run-mid"><div class="dia-run-emoji">${emoji || '✨'}</div><div class="dia-run-text">${esc(text)}</div><div class="muted small">${done} de ${total} listos</div></div>
        <div class="btnrow"><button class="btn secondary" data-skip>Saltar</button><button class="btn" data-done>${UI.icon('check')} Listo</button></div>`;
    };
    box.addEventListener('click', e=>{
      if (e.target.closest('[data-done]')){ const st = pending[idx]; if (st && !log.stepsDone.includes(st.id)) log.stepsDone.push(st.id); this.saveLog(r, log); idx++; paint(); }
      else if (e.target.closest('[data-skip]')){ skipped++; idx++; paint(); }
    });
    paint();
  },

  /* --- vista #/ritual --- */
  viewRitual(){
    const rs = this.rituals(); const r = this.currentRitual(); const today = todayISO();
    let html = Views.back('#/', 'Mi ritual', `<button class="iconbtn" data-action="dia-ritual-new" aria-label="Nuevo ritual">${UI.icon('plus')}</button>`);
    if (!r){
      html += `<div class="card">${UI.empty('🌅', 'Todavía no tienes un ritual', 'Un ritual son pocos pasos que repites cada mañana para empezar con intención. La app te guía paso a paso y lleva tu racha.')}
        <div class="card flat"><div class="semibold mb">${DIA_TEMPLATE.icon} ${esc(DIA_TEMPLATE.name)} · sugerido</div>${DIA_TEMPLATE.steps.map((t, i)=>`<div class="row small" style="padding:5px 0"><span class="badge">${i + 1}</span><span>${esc(t)}</span></div>`).join('')}</div>
        <button class="btn" data-action="dia-ritual-template">Usar esta plantilla</button><button class="btn secondary mt" data-action="dia-ritual-new">Crear el mío desde cero</button></div>`;
      return html;
    }
    if (rs.length > 1) html += `<div class="chips mb">${rs.map(x=>`<button class="chip ${x.id===r.id ? 'active' : ''}" data-action="dia-ritual-select" data-id="${x.id}">${esc(x.icon)} ${esc(x.name)}</button>`).join('')}</div>`;
    const st = this.ritualStatus(r, today); const streak = this.streak(r.id), best = this.bestStreak(r.id);
    const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    const isMain = rs[0].id===r.id;
    html += `<div class="hero"><div class="row"><div class="dia-hero-ic">${esc(r.icon)}</div><div class="grow"><div class="label">${r.time ? 'Cada día a las ' + esc(r.time) : 'Tu ritual'}${isMain && rs.length > 1 ? ' · principal' : ''}</div><div class="big" style="font-size:26px">${esc(r.name)}</div></div><button class="iconbtn ghost dia-hero-edit" data-action="dia-ritual-edit" data-id="${r.id}" aria-label="Editar ritual">${UI.icon('edit')}</button></div>
      <div class="hero-tiles"><div class="hero-tile"><div class="t">🔥 Racha</div><div class="v">${this.plural(streak, 'día', 'días')}</div></div><div class="hero-tile"><div class="t">🏆 Mejor</div><div class="v">${this.plural(best, 'día', 'días')}</div></div><div class="hero-tile ${st.completed ? 'pos' : ''}"><div class="t">Hoy</div><div class="v">${st.done} de ${st.total}</div></div></div>
      <div class="progress hero-progress"><div class="ok" style="width:${pct}%"></div></div>
      <button class="btn mt dia-hero-btn" data-action="dia-ritual-start" data-id="${r.id}">${st.done===st.total ? '✅ Completado hoy · repasar' : st.done ? '▶ Retomar ritual' : '▶ Comenzar ritual'}</button></div>`;
    html += `<div class="card tight"><div class="day-head" style="padding:8px 16px 4px"><span>Pasos de hoy</span><span>${st.done} de ${st.total}</span></div><div class="dia-steps">${r.steps.map(x=>{ const d = !!(st.log && st.log.stepsDone.includes(x.id)); return `<button class="dia-step ${d ? 'done' : ''}" data-action="dia-step-toggle" data-id="${r.id}" data-step="${x.id}"><span class="dia-check">${UI.icon('check')}</span><span class="dia-txt">${esc(x.text)}</span></button>`; }).join('')}</div></div>`;
    html += this.calendar(r);
    return html;
  },
  calendar(r){
    const key = App.state.dia_rMonth || thisMonthKey(); const [y, m] = key.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate(); const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;   // lunes primero
    const done = this.completedDates(r.id);
    const partial = new Set(Store.list('ritualLogs').filter(l=>l.ritualId===r.id && !l.completed && l.stepsDone.length).map(l=>l.date));
    const today = todayISO(); const inMonth = [...done].filter(d=>d.startsWith(key)).length;
    let cells = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(h=>`<div class="h">${h}</div>`).join('');
    for (let i = 0; i < offset; i++) cells += '<div></div>';
    for (let d = 1; d <= dim; d++){ const iso = `${key}-${pad2(d)}`; cells += `<div class="d ${done.has(iso) ? 'done' : partial.has(iso) ? 'part' : ''}${iso===today ? ' today' : ''}${iso > today ? ' future' : ''}">${d}</div>`; }
    return `<div class="card"><div class="card-head"><h3>📅 ${fmtMonth(key)}</h3><span class="row" style="gap:2px"><button class="iconbtn ghost" data-action="dia-ritual-month" data-delta="-1" aria-label="Mes anterior">${UI.icon('left')}</button><button class="iconbtn ghost" data-action="dia-ritual-month" data-delta="1" aria-label="Mes siguiente">${UI.icon('chevron')}</button></span></div><div class="dia-cal">${cells}</div><div class="xs muted mt">${this.plural(inMonth, 'día completado', 'días completados')} este mes · el círculo relleno es un día completo y el borde, uno a medias</div></div>`;
  },

  /* =====================================================================
     ENFOQUE (temporizador)
     ===================================================================== */
  remaining(f){ return f.endsAt - (f.pausedAt || Date.now()); },
  rememberLabel(){ const i = document.querySelector('[data-dia-label]'); if (i) App.state.dia_focusLabel = i.value; },
  startFocus(minutes, label){
    if (this.focus()) return UI.toast('Ya hay una sesión en curso', true);
    minutes = Math.round(Number(minutes) || 0);
    if (!(minutes >= 1 && minutes <= 600)) return UI.toast('Elige entre 1 y 600 minutos', true);
    const now = Date.now();
    this.settings().focus = { minutes, label: String(label || '').trim(), startedAt: new Date(now).toISOString(), endsAt: now + minutes * 60000, pausedAt: null };
    Store.save(); App.state.dia_focusLabel = ''; App.render(); UI.toast(`Enfoque de ${minutes} min iniciado 🎯`);
  },
  pauseFocus(){ const f = this.focus(); if (!f || f.pausedAt) return; f.pausedAt = Date.now(); Store.save(); App.render(); },
  resumeFocus(){ const f = this.focus(); if (!f || !f.pausedAt) return; f.endsAt += Date.now() - f.pausedAt; f.pausedAt = null; Store.save(); App.render(); },
  async stopFocus(){
    const f = this.focus(); if (!f) return;
    if (this.remaining(f) > 0 && !(await UI.confirm('¿Terminar la sesión antes de tiempo? Se guardan los minutos que llevas.', { ok:'Terminar', danger:false }))) return;
    this.finishFocus(false);
  },
  finishFocus(completed, { render=true }={}){
    const f = this.focus(); if (!f) return;
    const rem = Math.max(0, this.remaining(f)); const elapsed = f.minutes * 60000 - rem;
    const minutes = completed ? f.minutes : Math.round(elapsed / 60000);
    this.settings().focus = null; Store.save();
    if (minutes >= 1) Store.upsert('focusSessions', { id: uid(), date: toISO(new Date(f.startedAt)), minutes, label: f.label || '', startedAt: f.startedAt, endedAt: new Date().toISOString(), completed: !!completed });
    if (completed){
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); } catch(e){}
      UI.toast(`🎯 ¡Sesión de ${minutes} min completada!`);
    } else UI.toast(minutes >= 1 ? `Sesión guardada: ${minutes} min` : 'Sesión muy corta, no se guardó');
    if (render) App.render();
  },
  /* un solo intervalo para todo el módulo; se rehace en cada render */
  ensureTimer(){
    if (this._timer){ clearInterval(this._timer); this._timer = null; }
    if (!this.focus()) return;
    this.tick(); this._timer = setInterval(()=>this.tick(), 1000);
  },
  tick(){
    const f = this.focus();
    if (!f){ if (this._timer){ clearInterval(this._timer); this._timer = null; } return; }
    const rem = this.remaining(f);
    if (rem <= 0 && !f.pausedAt){ this.finishFocus(true); return; }
    const total = f.minutes * 60000; const p = total ? Math.min(1, Math.max(0, rem / total)) : 0;
    const txt = this.clock(rem);
    document.querySelectorAll('[data-dia-time]').forEach(el=>{ if (el.textContent!==txt) el.textContent = txt; });
    document.querySelectorAll('[data-dia-ring]').forEach(c=>{ const C = +c.dataset.c; c.style.strokeDashoffset = (C * (1 - p)).toFixed(2); });
  },
  ringHTML(f, sm=false){
    const R = 54, C = 2 * Math.PI * R; const rem = Math.max(0, this.remaining(f)); const total = f.minutes * 60000; const p = total ? Math.min(1, rem / total) : 0;
    return `<div class="dia-ring${sm ? ' sm' : ''}${f.pausedAt ? ' paused' : ''}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="${R}"/><circle class="fg" cx="60" cy="60" r="${R}" data-dia-ring data-c="${C.toFixed(2)}" stroke-dasharray="${C.toFixed(2)}" style="stroke-dashoffset:${(C * (1 - p)).toFixed(2)}"/></svg><div class="dia-ring-txt"><div class="dia-time" data-dia-time>${this.clock(rem)}</div>${sm ? '' : `<div class="dia-lbl">${f.pausedAt ? 'En pausa' : (f.label ? esc(f.label) : 'Enfoque')}</div>`}</div></div>`;
  },
  focusStats(){
    const ss = Store.list('focusSessions'); const today = todayISO();
    const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const monday = toISO(d);
    const sum = arr=>arr.reduce((s, x)=>s + (Number(x.minutes) || 0), 0);
    return { today: sum(ss.filter(x=>x.date===today)), week: sum(ss.filter(x=>x.date >= monday && x.date <= today)), recent: [...ss].sort((a, b)=>String(b.startedAt || b.date).localeCompare(String(a.startedAt || a.date))).slice(0, 8) };
  },
  customFocusSheet(){
    const s = UI.sheet({ title:'Minutos de enfoque', html:`<div class="field"><label>¿Cuántos minutos?</label><input name="min" type="number" inputmode="numeric" min="1" max="600" value="${App.state.dia_focusMin || 30}" autofocus></div><button class="btn" data-ok>Usar estos minutos</button>` });
    const ok = ()=>{ const n = Math.round(Number(s.body.querySelector('[name=min]').value)); if (!(n >= 1 && n <= 600)) return UI.toast('Escribe entre 1 y 600 minutos', true); App.state.dia_focusMin = n; s.close(); App.render(); };
    s.body.querySelector('[data-ok]').onclick = ok;
    s.body.querySelector('[name=min]').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); ok(); } });
  },
  /* hoja rápida (desde el botón +) */
  focusSheet(){
    if (this.focus()) return App.go('#/enfoque');
    let min = App.state.dia_focusMin || DIA_FOCUS_DEFAULT;
    const s = UI.sheet({ title:'Sesión de enfoque', html:`<div class="field"><label>¿En qué vas a enfocarte?</label><input name="label" placeholder="Opcional, ej. Estudiar inglés" value="${esc(App.state.dia_focusLabel || '')}"></div><div class="chips mb" data-chips></div><div class="field"><label>O escribe los minutos</label><input name="min" type="number" inputmode="numeric" min="1" max="600" value="${min}"></div><button class="btn" data-start>${UI.icon('target')} Comenzar</button>` });
    const chips = s.body.querySelector('[data-chips]'); const minInp = s.body.querySelector('[name=min]');
    const paint = ()=>{ chips.innerHTML = DIA_FOCUS_CHIPS.map(m=>`<button class="chip ${m===min ? 'active' : ''}" data-m="${m}">${m} min</button>`).join(''); };
    paint();
    chips.addEventListener('click', e=>{ const b = e.target.closest('[data-m]'); if (!b) return; min = +b.dataset.m; minInp.value = min; paint(); });
    minInp.addEventListener('input', ()=>{ min = Math.round(Number(minInp.value)) || 0; paint(); });
    s.body.querySelector('[data-start]').onclick = ()=>{
      if (!(min >= 1 && min <= 600)) return UI.toast('Escribe entre 1 y 600 minutos', true);
      App.state.dia_focusMin = min; const label = s.body.querySelector('[name=label]').value; s.close();
      this.startFocus(min, label); App.go('#/enfoque');
    };
  },
  /* --- vista #/enfoque --- */
  viewFocus(){
    const f = this.focus(); const st = this.focusStats();
    let html = Views.back('#/', 'Enfoque');
    if (f){
      html += `<div class="card center">${this.ringHTML(f)}<div class="btnrow">${f.pausedAt ? '<button class="btn" data-action="dia-focus-resume">▶ Reanudar</button>' : '<button class="btn secondary" data-action="dia-focus-pause">⏸ Pausar</button>'}<button class="btn danger" data-action="dia-focus-stop">Terminar</button></div><div class="xs muted mt">${f.pausedAt ? 'En pausa · el tiempo no corre' : `${f.minutes} min · termina a las ${this.fmtTime(f.endsAt)}`}</div></div>`;
    } else {
      const min = App.state.dia_focusMin || DIA_FOCUS_DEFAULT; const custom = !DIA_FOCUS_CHIPS.includes(min);
      html += `<div class="card"><div class="field"><label>¿En qué vas a enfocarte?</label><input data-dia-label placeholder="Opcional, ej. Estudiar inglés" value="${esc(App.state.dia_focusLabel || '')}" autocomplete="off"></div>
        <div class="chips mb">${DIA_FOCUS_CHIPS.map(m=>`<button class="chip ${m===min ? 'active' : ''}" data-action="dia-focus-min" data-min="${m}">${m} min</button>`).join('')}<button class="chip ${custom ? 'active' : ''}" data-action="dia-focus-custom">${custom ? min + ' min ✎' : 'Personalizado'}</button></div>
        <button class="btn" data-action="dia-focus-start">${UI.icon('target')} Comenzar ${min} min</button></div>`;
    }
    html += `<div class="grid2"><div class="stat"><div class="t">Hoy</div><div class="v">${this.fmtMin(st.today)}</div></div><div class="stat"><div class="t">Esta semana</div><div class="v">${this.fmtMin(st.week)}</div></div></div>`;
    if (st.recent.length){
      html += `<div class="section-title"><h2>Últimas sesiones</h2></div><div class="card tight"><div class="list">${st.recent.map(x=>`<div class="item"><div class="ic ${x.completed ? 'g' : 'a'}">${UI.icon('target')}</div><div class="body"><div class="title">${esc(x.label || 'Sesión de enfoque')}</div><div class="sub">${fmtDate(x.date, 'day')}${x.startedAt ? ' · ' + this.fmtTime(x.startedAt) : ''}${x.completed ? '' : ' · terminada antes'}</div></div><div class="amt">${x.minutes} min</div></div>`).join('')}</div></div>`;
    } else html += `<div class="card">${UI.empty('🎯', 'Sin sesiones todavía', 'Elige cuántos minutos y comienza. Al terminar, la sesión queda guardada aquí.')}</div>`;
    return html;
  },

  /* =====================================================================
     DIARIO: palabras guía, pregunta del día, reflexión
     ===================================================================== */
  journal(date){ return Store.list('journal').find(j=>j.id===date) || null; },
  saveJournal(date, patch){
    const cur = this.journal(date) || { id: date, guideWords: [], dayQuestionAnswer: '', mood: null, highlights: '', gratitude: '', notes: '' };
    return Store.upsert('journal', Object.assign({}, cur, patch, { id: date }));
  },
  question(date){ const n = Math.round(parseISO(date).getTime() / 86400000); const L = DIA_QUESTIONS.length; return DIA_QUESTIONS[((n % L) + L) % L]; },
  hasReflection(j){ return !!(j && (j.mood || j.highlights || j.gratitude || j.notes)); },
  moodOf(v){ return DIA_MOODS.find(m=>m[0]===Number(v)) || null; },
  words(j){ return j && Array.isArray(j.guideWords) ? j.guideWords : []; },

  wordsSheet(date=todayISO()){
    let sel = [...this.words(this.journal(date))];
    const s = UI.sheet({ title: date===todayISO() ? '¿Cómo quieres aparecer hoy?' : 'Palabras del ' + fmtDate(date, 'short'), html:`<div class="small muted mb">Elige de 1 a 3 palabras que guíen tu día.</div><div class="dia-words mb" data-words></div><div class="row mb"><div class="field grow" style="margin:0"><input name="custom" placeholder="Escribe la tuya" maxlength="24" autocomplete="off"></div><button class="btn secondary sm" data-add>Agregar</button></div><button class="btn" data-save>Guardar</button>` });
    const box = s.body.querySelector('[data-words]'); const inp = s.body.querySelector('[name=custom]');
    const paint = ()=>{ const all = [...DIA_WORDS]; sel.forEach(w=>{ if (!all.includes(w)) all.push(w); }); box.innerHTML = all.map(w=>`<button class="chip ${sel.includes(w) ? 'active' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join(''); };
    paint();
    box.addEventListener('click', e=>{ const b = e.target.closest('[data-w]'); if (!b) return; const w = b.dataset.w; if (sel.includes(w)) sel = sel.filter(x=>x!==w); else { if (sel.length >= 3) return UI.toast('Máximo 3 palabras', true); sel.push(w); } paint(); });
    const add = ()=>{ const w = inp.value.trim(); if (!w) return; if (sel.length >= 3) return UI.toast('Máximo 3 palabras', true); const cap = w[0].toUpperCase() + w.slice(1); if (!sel.includes(cap)) sel.push(cap); inp.value = ''; paint(); };
    s.body.querySelector('[data-add]').onclick = add;
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); add(); } });
    s.body.querySelector('[data-save]').onclick = ()=>{ if (!sel.length) return UI.toast('Elige al menos una palabra', true); this.saveJournal(date, { guideWords: sel }); s.close(); App.render(); UI.toast('Hoy: ' + sel.join(' · ')); };
  },
  questionSheet(date=todayISO()){
    const j = this.journal(date); const q = (j && j.dayQuestion) || this.question(date);
    const s = UI.sheet({ title: date===todayISO() ? 'Pregunta del día' : 'Pregunta del ' + fmtDate(date, 'short'), html:`<div class="dia-q mb">${esc(q)}</div><div class="field"><textarea name="a" placeholder="Escribe lo primero que te venga. No hay respuestas incorrectas." style="min-height:110px" autofocus>${esc((j && j.dayQuestionAnswer) || '')}</textarea></div><button class="btn" data-save>Guardar respuesta</button>` });
    s.body.querySelector('[data-save]').onclick = ()=>{ const a = s.body.querySelector('[name=a]').value.trim(); this.saveJournal(date, { dayQuestionAnswer: a, dayQuestion: q }); s.close(); App.render(); UI.toast(a ? 'Respuesta guardada' : 'Respuesta borrada'); };
  },
  reflectSheet(date=todayISO()){
    const j = this.journal(date) || {}; let mood = Number(j.mood) || 0;
    const s = UI.sheet({ title: date===todayISO() ? '¿Cómo estuvo tu día?' : 'Reflexión del ' + fmtDate(date, 'short'), html:`
      <div class="dia-mood mb" data-mood>${DIA_MOODS.map(([v, e, l])=>`<button type="button" data-v="${v}" class="${v===mood ? 'sel' : ''}">${e}<span>${l}</span></button>`).join('')}</div>
      <div class="field"><label>Lo mejor del día</label><textarea name="highlights" placeholder="Un momento, un logro, algo que salió bien">${esc(j.highlights || '')}</textarea></div>
      <div class="field"><label>Hoy doy gracias por…</label><textarea name="gratitude" placeholder="Algo o alguien">${esc(j.gratitude || '')}</textarea></div>
      <div class="field"><label>Nota libre</label><textarea name="notes" placeholder="Lo que quieras dejar escrito">${esc(j.notes || '')}</textarea></div>
      <button class="btn" data-save>Guardar reflexión</button>` });
    const box = s.body.querySelector('[data-mood]');
    box.addEventListener('click', e=>{ const b = e.target.closest('[data-v]'); if (!b) return; mood = +b.dataset.v; box.querySelectorAll('button').forEach(x=>x.classList.toggle('sel', +x.dataset.v===mood)); });
    s.body.querySelector('[data-save]').onclick = ()=>{
      const v = n=>s.body.querySelector(`[name=${n}]`).value.trim();
      const patch = { mood: mood || null, highlights: v('highlights'), gratitude: v('gratitude'), notes: v('notes') };
      if (!patch.mood && !patch.highlights && !patch.gratitude && !patch.notes) return UI.toast('Elige un ánimo o escribe algo', true);
      this.saveJournal(date, patch); s.close(); App.render(); UI.toast('Reflexión guardada 🌙');
    };
  },
  daySheet(date){
    const j = this.journal(date) || {}; const m = this.moodOf(j.mood); const q = j.dayQuestion || this.question(date); const words = this.words(j); const has = this.hasReflection(j);
    const s = UI.sheet({ title: fmtDate(date, 'day'), html:`
      <div class="card flat"><div class="row between"><div class="semibold">✨ Palabras guía</div><button class="link" data-edit="words">${words.length ? 'Cambiar' : 'Elegir'}</button></div><div class="dia-words" style="margin-top:8px">${words.length ? words.map(w=>`<span class="chip active">${esc(w)}</span>`).join('') : '<span class="small muted">Sin palabras</span>'}</div></div>
      <div class="card flat"><div class="row between"><div class="semibold">💭 Pregunta</div><button class="link" data-edit="question">${j.dayQuestionAnswer ? 'Editar' : 'Responder'}</button></div><div class="small muted" style="margin-top:6px">${esc(q)}</div>${j.dayQuestionAnswer ? `<div class="dia-ans">${esc(j.dayQuestionAnswer)}</div>` : ''}</div>
      <div class="card flat"><div class="row between"><div class="semibold">🌙 Reflexión${m ? ' · ' + m[1] + ' ' + m[2] : ''}</div><button class="link" data-edit="reflect">${has ? 'Editar' : 'Escribir'}</button></div>${j.highlights ? `<div class="small" style="margin-top:8px">⭐ ${esc(j.highlights)}</div>` : ''}${j.gratitude ? `<div class="small" style="margin-top:4px">🙏 ${esc(j.gratitude)}</div>` : ''}${j.notes ? `<div class="small muted" style="margin-top:4px">📝 ${esc(j.notes)}</div>` : ''}${has ? '' : '<div class="small muted" style="margin-top:6px">Sin reflexión</div>'}</div>
      ${j.id ? `<button class="btn danger" data-del>${UI.icon('trash')} Borrar este día del diario</button>` : ''}` });
    s.body.addEventListener('click', async e=>{
      const b = e.target.closest('[data-edit],[data-del]'); if (!b) return;
      if (b.dataset.del!=null){ if (!(await UI.confirm('¿Borrar la entrada de este día?'))) return; Store.remove('journal', date); s.close(); App.render(); UI.toast('Entrada borrada'); return; }
      s.close(); const k = b.dataset.edit;
      if (k==='words') this.wordsSheet(date); else if (k==='question') this.questionSheet(date); else this.reflectSheet(date);
    });
  },
  /* --- vista #/diario --- */
  viewJournal(){
    const key = App.state.dia_jMonth || thisMonthKey(); const today = todayISO(); const isCur = key===thisMonthKey();
    let html = Views.back('#/', 'Diario');
    html += `<div class="monthnav"><button data-action="dia-journal-month" data-delta="-1" aria-label="Mes anterior">${UI.icon('left')}</button><div class="m">${fmtMonth(key)}</div><button data-action="dia-journal-month" data-delta="1" aria-label="Mes siguiente">${UI.icon('chevron')}</button></div>`;
    const entries = Store.list('journal').filter(j=>typeof j.id==='string' && j.id.startsWith(key)).sort((a, b)=>b.id.localeCompare(a.id));
    const moods = entries.map(j=>Number(j.mood)).filter(v=>v >= 1 && v <= 5); const avg = moods.length ? moods.reduce((s, v)=>s + v, 0) / moods.length : 0;
    const avgMood = avg ? this.moodOf(Math.round(avg)) : null; const withRef = entries.filter(j=>this.hasReflection(j)).length;
    html += `<div class="grid2"><div class="stat"><div class="t">Ánimo del mes</div><div class="v">${avgMood ? avgMood[1] + ' ' + avg.toFixed(1) : '—'}</div><div class="xs muted">${moods.length ? 'de 5 · ' + this.plural(moods.length, 'día', 'días') : 'sin ánimo registrado'}</div></div><div class="stat"><div class="t">Días con reflexión</div><div class="v">${withRef}</div><div class="xs muted">${this.plural(entries.length, 'entrada', 'entradas')} este mes</div></div></div>`;
    if (isCur){
      const j = this.journal(today); const words = this.words(j);
      const tick = ok=>ok ? '<span class="badge g">listo</span>' : '<span class="badge">pendiente</span>';
      html += `<div class="card tight"><div class="day-head" style="padding:8px 16px 4px"><span>Hoy</span><span>${fmtDate(today, 'short')}</span></div><div class="list">
        <button class="item clickable" data-action="dia-words"><div class="ic">✨</div><div class="body"><div class="title">Palabras guía</div><div class="sub">${words.length ? esc(words.join(' · ')) : 'Cómo quieres aparecer hoy'}</div></div>${tick(words.length)}</button>
        <button class="item clickable" data-action="dia-question"><div class="ic">💭</div><div class="body"><div class="title">Pregunta del día</div><div class="sub ellipsis">${esc(this.question(today))}</div></div>${tick(j && j.dayQuestionAnswer)}</button>
        <button class="item clickable" data-action="dia-reflect"><div class="ic">🌙</div><div class="body"><div class="title">Reflexión nocturna</div><div class="sub">Ánimo, lo mejor del día y gratitud</div></div>${tick(this.hasReflection(j))}</button></div></div>`;
    }
    if (!entries.length) html += `<div class="card">${UI.empty('📓', isCur ? 'Tu diario está vacío' : 'Sin entradas este mes', isCur ? 'Cada palabra, respuesta o reflexión que guardes aparece aquí, día por día.' : 'Prueba con otro mes.')}</div>`;
    else html += `<div class="section-title"><h2>Días</h2><span class="muted small">toca uno para ver o editar</span></div>` + entries.map(j=>this.entryCard(j)).join('');
    return html;
  },
  entryCard(j){
    const m = this.moodOf(j.mood); const q = j.dayQuestion || this.question(j.id); const words = this.words(j);
    return `<button class="card dia-entry" data-action="dia-day" data-date="${j.id}"><div class="row between"><div class="semibold">${fmtDate(j.id, 'day')}</div>${m ? `<span class="badge">${m[1]} ${m[2]}</span>` : ''}</div>
      ${words.length ? `<div class="dia-words" style="margin-top:8px">${words.map(w=>`<span class="chip active">${esc(w)}</span>`).join('')}</div>` : ''}
      ${j.dayQuestionAnswer ? `<div class="small muted" style="margin-top:8px">${esc(q)}</div><div class="small" style="margin-top:2px">${esc(j.dayQuestionAnswer)}</div>` : ''}
      ${j.highlights ? `<div class="small" style="margin-top:8px">⭐ ${esc(j.highlights)}</div>` : ''}
      ${j.gratitude ? `<div class="small" style="margin-top:4px">🙏 ${esc(j.gratitude)}</div>` : ''}
      ${j.notes ? `<div class="small muted" style="margin-top:4px">📝 ${esc(j.notes)}</div>` : ''}</button>`;
  },

  /* =====================================================================
     TARJETAS DE INICIO
     ===================================================================== */
  ritualCard(){
    const r = this.mainRitual(); const today = todayISO();
    if (!r) return `<div class="card"><div class="card-head"><h3>🌅 ¿Empezamos el día?</h3></div><div class="small muted mb">Crea un ritual de pocos pasos para arrancar cada mañana con intención. La app te guía y lleva tu racha.</div><div class="btnrow" style="margin:0"><button class="btn sm" data-action="dia-ritual-template">Usar plantilla</button><button class="btn sm secondary" data-go="#/ritual">Ver más</button></div></div>`;
    const st = this.ritualStatus(r, today); const streak = this.streak(r.id);
    if (st.completed) return `<button class="card dia-entry" data-go="#/ritual"><div class="row"><div class="dia-hero-ic">🔥</div><div class="grow"><div class="semibold">Ritual completado</div><div class="small muted">Racha: ${this.plural(streak, 'día', 'días')} · ${esc(r.name)}${st.done < st.total ? ` · ${st.done} de ${st.total} pasos` : ''}</div></div><span class="chev">${UI.icon('chevron')}</span></div></button>`;
    return `<div class="hero" style="padding:16px 18px"><div class="row"><div class="dia-hero-ic">${esc(r.icon)}</div><div class="grow"><div class="label">¿Empezamos el día?</div><div class="big" style="font-size:22px">${esc(r.name)}</div><div class="sub">${st.done ? `${st.done} de ${st.total} pasos hechos` : `${this.plural(st.total, 'paso', 'pasos')}${r.time ? ' · ' + esc(r.time) : ''}`}${streak ? ` · 🔥 racha ${streak}` : ''}</div></div></div>
      ${st.done ? `<div class="progress hero-progress"><div class="ok" style="width:${Math.round(st.done / st.total * 100)}%"></div></div>` : ''}
      <div class="btnrow"><button class="btn dia-hero-btn" data-action="dia-ritual-start" data-id="${r.id}">${st.done ? '▶ Retomar ritual' : '▶ Comenzar ritual'}</button><button class="btn dia-hero-btn2" data-go="#/ritual">Ver</button></div></div>`;
  },
  wordsCard(){
    const words = this.words(this.journal(todayISO()));
    return `<div class="card"><div class="card-head"><h3>✨ Palabras guía de hoy</h3>${words.length ? '<button class="link" data-action="dia-words">Cambiar</button>' : ''}</div>${words.length ? `<div class="dia-words">${words.map(w=>`<span class="chip active dia-word-lg">${esc(w)}</span>`).join('')}</div>` : '<div class="small muted mb">Todavía no elegiste cómo quieres aparecer hoy.</div><button class="btn sm" data-action="dia-words">Elegir palabras</button>'}</div>`;
  },
  focusCard(){
    const f = this.focus(); const st = this.focusStats(); const min = App.state.dia_focusMin || DIA_FOCUS_DEFAULT;
    let inner;
    if (f) inner = `<div class="row" style="gap:14px">${this.ringHTML(f, true)}<div class="grow"><div class="semibold ellipsis">${esc(f.label || 'Sesión de enfoque')}</div><div class="small muted">${f.pausedAt ? 'En pausa' : `${f.minutes} min · termina ${this.fmtTime(f.endsAt)}`}</div><div class="row" style="margin-top:8px;gap:8px">${f.pausedAt ? '<button class="btn sm" data-action="dia-focus-resume">Reanudar</button>' : '<button class="btn sm secondary" data-action="dia-focus-pause">Pausar</button>'}<button class="btn sm secondary" data-action="dia-focus-stop">Terminar</button></div></div></div>`;
    else inner = `<div class="chips mb">${DIA_FOCUS_CHIPS.map(m=>`<button class="chip ${m===min ? 'active' : ''}" data-action="dia-focus-min" data-min="${m}">${m} min</button>`).join('')}<button class="chip ${DIA_FOCUS_CHIPS.includes(min) ? '' : 'active'}" data-action="dia-focus-custom">${DIA_FOCUS_CHIPS.includes(min) ? 'Otro' : min + ' min ✎'}</button></div><button class="btn" data-action="dia-focus-start">${UI.icon('target')} Comenzar ${min} min</button>`;
    return `<div class="card"><div class="card-head"><h3>🎯 Enfoque</h3><a class="link" href="#/enfoque">${st.today ? this.fmtMin(st.today) + ' hoy' : 'Historial'}</a></div>${inner}</div>`;
  },
  questionCard(){
    const today = todayISO(); const j = this.journal(today); const q = (j && j.dayQuestion) || this.question(today);
    return `<div class="card"><div class="card-head"><h3>💭 Pregunta del día</h3><a class="link" href="#/diario">Diario</a></div><div class="dia-q">${esc(q)}</div>${j && j.dayQuestionAnswer ? `<div class="dia-ans">${esc(j.dayQuestionAnswer)}</div><div class="right" style="margin-top:6px"><button class="link" data-action="dia-question">Editar</button></div>` : '<button class="btn sm mt" data-action="dia-question">Responder</button>'}</div>`;
  },
  reflectCard(){
    const j = this.journal(todayISO()); const has = this.hasReflection(j);
    if (!has && new Date().getHours() < 18) return '';
    if (!has) return `<div class="card"><div class="card-head"><h3>🌙 ¿Cómo estuvo tu día?</h3></div><div class="small muted mb">Un minuto para cerrar el día: tu ánimo, lo mejor y por qué das gracias.</div><button class="btn sm" data-action="dia-reflect">Reflexionar</button></div>`;
    const m = this.moodOf(j.mood);
    return `<div class="card"><div class="card-head"><h3>🌙 Tu día</h3><button class="link" data-action="dia-reflect">Editar</button></div><div class="row">${m ? `<div class="dia-hero-ic">${m[1]}</div>` : ''}<div class="grow small">${m ? `<div class="semibold">${m[2]}</div>` : ''}${j.highlights ? `<div>⭐ ${esc(j.highlights)}</div>` : ''}${j.gratitude ? `<div class="muted">🙏 ${esc(j.gratitude)}</div>` : ''}${!m && !j.highlights && !j.gratitude && j.notes ? `<div class="muted">📝 ${esc(j.notes)}</div>` : ''}</div></div></div>`;
  },

  /* ---------- arranque ---------- */
  init(){
    const f = this.focus();
    if (f && !f.pausedAt && this.remaining(f) <= 0) this.finishFocus(true, { render:false });   // terminó con la app cerrada
    document.addEventListener('input', e=>{ if (e.target && e.target.matches && e.target.matches('[data-dia-label]')) App.state.dia_focusLabel = e.target.value; });
    document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState==='visible') this.ensureTimer(); });
  },

  actions: {
    'dia-ritual-select'(d){ App.state.dia_ritual = d.id; App.render(); },
    'dia-ritual-new'(){ Dia.ritualForm(); },
    'dia-ritual-edit'(d){ const r = Dia.ritual(d.id); if (r) Dia.ritualForm(r); },
    'dia-ritual-template'(){ Dia.useTemplate(); },
    'dia-ritual-start'(d){ Dia.runRitual(d.id); },
    'dia-step-toggle'(d){ Dia.toggleStep(d.id, d.step); App.render(); },
    'dia-ritual-month'(d){ App.state.dia_rMonth = shiftMonth(App.state.dia_rMonth || thisMonthKey(), Number(d.delta)); App.render(); },
    'dia-focus-min'(d){ Dia.rememberLabel(); App.state.dia_focusMin = Number(d.min); App.render(); },
    'dia-focus-custom'(){ Dia.rememberLabel(); Dia.customFocusSheet(); },
    'dia-focus-start'(){ Dia.rememberLabel(); Dia.startFocus(App.state.dia_focusMin || DIA_FOCUS_DEFAULT, App.state.dia_focusLabel || ''); },
    'dia-focus-sheet'(){ Dia.focusSheet(); },
    'dia-focus-pause'(){ Dia.pauseFocus(); },
    'dia-focus-resume'(){ Dia.resumeFocus(); },
    'dia-focus-stop'(){ Dia.stopFocus(); },
    'dia-words'(d){ Dia.wordsSheet(d.date || todayISO()); },
    'dia-question'(d){ Dia.questionSheet(d.date || todayISO()); },
    'dia-reflect'(d){ Dia.reflectSheet(d.date || todayISO()); },
    'dia-day'(d){ if (d.date) Dia.daySheet(d.date); },
    'dia-journal-month'(d){ App.state.dia_jMonth = shiftMonth(App.state.dia_jMonth || thisMonthKey(), Number(d.delta)); App.render(); },
  },
};

const DIA_CSS = `
.dia-hero-ic{font-size:40px;line-height:1;flex:none}
.dia-hero-edit{color:#fff}
.dia-hero-btn{background:#fff;color:var(--accent)}
.dia-hero-btn2{flex:0 0 auto;width:auto;background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.25)}
.dia-entry{display:block;width:100%;text-align:left}
.dia-entry:active{background:var(--card-2)}
.dia-entry .chev{color:var(--muted)} .dia-entry .chev svg{width:18px;height:18px}
.dia-steps{display:flex;flex-direction:column}
.dia-step{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);width:100%;text-align:left;font-size:15px;font-weight:600}
.dia-step:last-child{border-bottom:0}
.dia-step:active{background:var(--card-2)}
.dia-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;flex:none;color:transparent;transition:.15s}
.dia-check svg{width:14px;height:14px;stroke-width:3}
.dia-step.done .dia-check{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.dia-step.done .dia-txt{color:var(--muted);text-decoration:line-through}
.dia-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}
.dia-cal .h{font-size:11px;color:var(--muted);font-weight:600;padding:2px 0 6px}
.dia-cal .d{width:34px;max-width:100%;aspect-ratio:1;margin:0 auto;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:600;color:var(--text)}
.dia-cal .d.done{background:var(--accent);color:var(--accent-ink)}
.dia-cal .d.part{box-shadow:inset 0 0 0 2px var(--accent)}
.dia-cal .d.today{outline:2px solid var(--muted);outline-offset:1px}
.dia-cal .d.future{color:var(--muted);opacity:.45}
.dia-run{min-height:min(72vh,560px);display:flex;flex-direction:column;padding:4px 0 8px}
.dia-run .progress{margin-top:10px}
.dia-run-top{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);font-weight:600}
.dia-run-mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:24px 8px}
.dia-run-emoji{font-size:72px;line-height:1;animation:dia-pop .35s cubic-bezier(.2,.8,.2,1)}
@keyframes dia-pop{from{transform:scale(.6);opacity:0}}
.dia-run-text{font-size:27px;font-weight:800;letter-spacing:-.02em;line-height:1.2}
.dia-run .btnrow{margin-top:0}
.dia-done-big{font-size:72px;line-height:1;margin-bottom:6px}
.dia-num{font-size:24px;font-weight:800;letter-spacing:-.02em;color:var(--accent)}
.dia-ring{position:relative;width:240px;height:240px;margin:6px auto 4px}
.dia-ring svg{width:100%;height:100%;transform:rotate(-90deg);display:block}
.dia-ring circle{fill:none;stroke-width:9;stroke-linecap:round}
.dia-ring .bg{stroke:var(--line)}
.dia-ring .fg{stroke:var(--accent);transition:stroke-dashoffset 1s linear}
.dia-ring.paused .fg{stroke:var(--amber);transition:none}
.dia-ring-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dia-time{font-size:50px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.dia-lbl{font-size:13px;color:var(--muted);margin-top:8px;max-width:170px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dia-ring.sm{width:92px;height:92px;margin:0;flex:none}
.dia-ring.sm circle{stroke-width:8}
.dia-ring.sm .dia-time{font-size:19px}
.dia-mood{display:flex;justify-content:space-between;gap:6px}
.dia-mood button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 2px;border-radius:14px;background:var(--card-2);border:2px solid transparent;font-size:26px;line-height:1.1}
.dia-mood button span{font-size:11px;font-weight:600;color:var(--muted)}
.dia-mood button.sel{border-color:var(--accent);background:var(--accent-soft)}
.dia-words{display:flex;flex-wrap:wrap;gap:8px}
.dia-word-lg{font-size:14px;padding:8px 14px}
.dia-q{font-size:17px;font-weight:700;line-height:1.35;letter-spacing:-.01em}
.dia-ans{background:var(--card-2);border-radius:12px;padding:10px 12px;font-size:14px;margin-top:10px;white-space:pre-wrap;line-height:1.45}
.dia-steprow{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.dia-stepnum{width:16px;text-align:right;flex:none}
.dia-steprow input{flex:1;min-width:0;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:15px;outline:none}
.dia-steprow input:focus{border-color:var(--accent)}
.dia-steprow button{width:34px;height:34px;border-radius:9px;background:var(--card-2);color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none}
.dia-steprow button:disabled{opacity:.3}
.dia-steprow button svg{width:16px;height:16px}
`;

App.registerModule({
  id: 'dia',
  name: 'Mi día',
  icon: 'star',
  collections: ['rituals', 'ritualLogs', 'focusSessions', 'journal'],
  routes: [
    [/^#\/ritual$/, ()=>Dia.viewRitual(), 'home'],
    [/^#\/enfoque$/, ()=>Dia.viewFocus(), 'home'],
    [/^#\/diario$/, ()=>Dia.viewJournal(), 'home'],
  ],
  menu: [
    { hash:'#/ritual', icon:'star', label:'Ritual' },
    { hash:'#/enfoque', icon:'target', label:'Enfoque' },
    { hash:'#/diario', icon:'file', label:'Diario' },
  ],
  homeCards: [
    { order: 5, render: ()=>Dia.ritualCard() },
    { order: 8, render: ()=>Dia.wordsCard() },
    { order: 25, render: ()=>Dia.focusCard() },
    { order: 30, render: ()=>Dia.questionCard() },
    { order: 35, render: ()=>Dia.reflectCard() },
  ],
  fab: [
    { label:'Sesión de enfoque', sub:'Minutos sin distracciones para una sola cosa', icon:'target', cls:'b', run(){ Dia.focusSheet(); } },
    { label:'Reflexión del día', sub:'¿Cómo estuvo tu día? Ánimo, lo mejor y gratitud', icon:'edit', cls:'a', run(){ Dia.reflectSheet(); } },
  ],
  actions: Dia.actions,
  css: DIA_CSS,
  init(){ Dia.init(); },
  afterRender(){ Dia.ensureTimer(); },
});
