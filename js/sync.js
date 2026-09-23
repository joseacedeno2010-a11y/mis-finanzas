'use strict';
/* Sincronización en la nube (Firebase Auth + Firestore).
   Estructura: users/{uid}/meta/settings y colecciones users/{uid}/{accounts|categories|people|loans|transactions|budgets}/{id}.
   Estrategia: cada documento se escribe cuando cambia localmente (con reintento si falla);
   onSnapshot trae los cambios de otros dispositivos. En la primera conexión se combinan nube y local. */
const Sync = {
  COLLS: ['accounts', 'categories', 'people', 'loans', 'transactions', 'budgets'],
  config: window.FIREBASE_CONFIG || null,
  user: null,
  db: null,
  status: 'off',       // off | signed_out | syncing | online | error
  lastError: '',
  lastPushAt: null,
  pending: 0,
  _shadow: {},          // último estado confirmado en la nube por colección: {id: json}
  _settingsShadow: '',
  _unsubs: [],
  _applying: false,
  _dirty: false,

  enabled(){ return !!(this.config && window.firebase); },

  init(){
    if (!this.enabled()) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(this.config);
      this.db = firebase.firestore();
      try { this.db.enablePersistence({ synchronizeTabs: true }).catch(()=>{}); } catch(e){}
      this.status = 'signed_out';
      firebase.auth().onAuthStateChanged(u=>{
        this.user = u;
        if (u) this.start(); else this.stop();
        App.render();
      });
    } catch(e){ this.status = 'error'; this.lastError = e.message; console.error(e); }
  },

  /* ---- sesión ---- */
  async signIn(email, password){ await firebase.auth().signInWithEmailAndPassword(email, password); },
  async signUp(email, password){ await firebase.auth().createUserWithEmailAndPassword(email, password); },
  async resetPassword(email){ await firebase.auth().sendPasswordResetEmail(email); },
  async signOut(){ await firebase.auth().signOut(); },
  errorText(e){
    const m = { 'auth/invalid-email':'Correo inválido', 'auth/user-not-found':'No existe una cuenta con ese correo', 'auth/wrong-password':'Contraseña incorrecta', 'auth/invalid-credential':'Correo o contraseña incorrectos', 'auth/email-already-in-use':'Ese correo ya tiene cuenta; inicia sesión', 'auth/weak-password':'La contraseña debe tener al menos 6 caracteres', 'auth/network-request-failed':'Sin conexión a internet', 'auth/too-many-requests':'Demasiados intentos, espera un momento' };
    return m[e && e.code] || (e && e.message) || 'Error desconocido';
  },

  /* ---- referencias ---- */
  ref(coll){ return this.db.collection('users').doc(this.user.uid).collection(coll); },
  settingsRef(){ return this.db.collection('users').doc(this.user.uid).collection('meta').doc('settings'); },
  clean(obj){ return JSON.parse(JSON.stringify(obj)); },

  /* ---- arranque: combinar nube y local, luego escuchar ---- */
  async start(){
    this.stop();
    this.status = 'syncing'; this.lastError = '';
    this._shadow = {}; this.COLLS.forEach(c=>this._shadow[c] = {}); this._settingsShadow = '';
    try {
      const remote = {};
      for (const c of this.COLLS){ const snap = await this.ref(c).get(); remote[c] = snap.docs.map(d=>d.data()); }
      const settingsSnap = await this.settingsRef().get();
      const cloudEmpty = this.COLLS.every(c=>!remote[c].length);
      this._applying = true;
      // la sombra refleja SOLO lo que está en la nube; todo lo local que difiera se subirá en flush()
      for (const c of this.COLLS){
        const byId = new Map(remote[c].map(x=>[x.id, x]));
        remote[c].forEach(x=>{ this._shadow[c][x.id] = JSON.stringify(x); });
        if (!cloudEmpty){
          // la nube manda sobre lo local con el mismo id; lo local que no exista en la nube se conserva (y se subirá)
          const localExtra = Store.data[c].filter(x=>!byId.has(x.id));
          Store.data[c] = remote[c].concat(localExtra);
        }
      }
      if (settingsSnap.exists){
        this._settingsShadow = JSON.stringify(settingsSnap.data());
        if (!cloudEmpty) Store.data.settings = Object.assign(Store.data.settings, settingsSnap.data());
      }
      localStorage.setItem(Store.KEY, JSON.stringify(Store.data));
      this._applying = false;
      this.status = 'online';
      this.listen();
      this.flush();            // sube todo lo local que no esté en la nube
    } catch(e){
      this._applying = false;
      this.status = 'error'; this.lastError = e.message || String(e); console.error('Sync.start', e);
    }
    App.render();
  },
  listen(){
    for (const c of this.COLLS){
      this._unsubs.push(this.ref(c).onSnapshot(snap=>{
        if (snap.metadata.hasPendingWrites) return;
        let changed = false;
        snap.docChanges().forEach(ch=>{
          const d = ch.doc.data(); const json = JSON.stringify(d);
          if (ch.type==='removed'){
            if (this._shadow[c][d.id]!==undefined){ delete this._shadow[c][d.id]; Store.data[c] = Store.data[c].filter(x=>x.id!==d.id); changed = true; }
            return;
          }
          if (this._shadow[c][d.id]===json) return;
          this._shadow[c][d.id] = json;
          const i = Store.data[c].findIndex(x=>x.id===d.id);
          if (i>=0) Store.data[c][i] = d; else Store.data[c].push(d);
          changed = true;
        });
        if (changed){ this._applying = true; Store.save(); this._applying = false; App.render(); }
      }, e=>{ this.status = 'error'; this.lastError = e.message; console.error(e); App.render(); }));
    }
    this._unsubs.push(this.settingsRef().onSnapshot(doc=>{
      if (!doc.exists || doc.metadata.hasPendingWrites) return;
      const json = JSON.stringify(doc.data());
      if (json===this._settingsShadow) return;
      this._settingsShadow = json;
      this._applying = true; Store.data.settings = Object.assign(Store.data.settings, doc.data()); Store.save(); this._applying = false; App.render();
    }));
  },
  stop(){ this._unsubs.forEach(u=>u()); this._unsubs = []; if (this.status!=='off' && this.status!=='error') this.status = 'signed_out'; },
  restart(){ if (this.user) this.start(); },

  /* ---- subida ---- */
  _write(promiseFactory, onOk, onFail){
    this.pending++;
    promiseFactory().then(()=>{ this.pending--; this.lastPushAt = new Date().toISOString(); if (this.status==='error'){ this.status = 'online'; this.lastError = ''; } onOk && onOk(); })
      .catch(e=>{ this.pending--; this.lastError = e.message || String(e); this.status = 'error'; console.error('Sync write', e); onFail && onFail(); App.render(); });
  },
  /* tras importar o pegar un respaldo: subir todo lo local (sin borrar nada) y volver a combinar con la nube */
  async afterImport(){
    if (!this.user) return;
    try { await this.pushAll(); } catch(e){ this.lastError = e.message; this.status = 'error'; }
    this.restart();
  },
  /* sube todo lo que difiera de la sombra (lo llama Store.save y el arranque) */
  flush(){
    if (!this.user || this._applying) return;
    if (this.status==='syncing' || this.status==='signed_out' || this.status==='off'){ this._dirty = true; return; }
    this._dirty = false;
    for (const c of this.COLLS){
      const seen = new Set();
      for (const x of Store.data[c]){
        seen.add(x.id);
        const json = JSON.stringify(x);
        if (this._shadow[c][x.id]!==json && this._inflight(c, x.id)!==json){
          this._setInflight(c, x.id, json);
          this._write(()=>this.ref(c).doc(x.id).set(this.clean(x)), ()=>{ this._shadow[c][x.id] = json; this._setInflight(c, x.id, null); }, ()=>this._setInflight(c, x.id, null));
        }
      }
      for (const id of Object.keys(this._shadow[c])){
        if (!seen.has(id)){ const key = c + '/' + id; if (this._deleting.has(key)) continue; this._deleting.add(key); this._write(()=>this.ref(c).doc(id).delete(), ()=>{ delete this._shadow[c][id]; this._deleting.delete(key); }, ()=>this._deleting.delete(key)); }
      }
    }
    const sj = JSON.stringify(Store.data.settings);
    if (sj!==this._settingsShadow && this._settingsInflight!==sj){
      this._settingsInflight = sj;
      this._write(()=>this.settingsRef().set(this.clean(Store.data.settings)), ()=>{ this._settingsShadow = sj; this._settingsInflight = null; }, ()=>{ this._settingsInflight = null; });
    }
  },
  _inflightMap: {}, _deleting: new Set(), _settingsInflight: null,
  _inflight(c, id){ return this._inflightMap[c + '/' + id]; },
  _setInflight(c, id, v){ if (v==null) delete this._inflightMap[c + '/' + id]; else this._inflightMap[c + '/' + id] = v; },
  onLocalSave(){ this.flush(); },

  /* fuerza la subida de TODO lo local (sin borrar nada en la nube) */
  async pushAll(){
    if (!this.user) throw new Error('Sin sesión');
    for (const c of this.COLLS){
      let batch = this.db.batch(), n = 0;
      for (const x of Store.data[c]){ batch.set(this.ref(c).doc(x.id), this.clean(x)); if (++n===400){ await batch.commit(); batch = this.db.batch(); n = 0; } }
      if (n) await batch.commit();
      Store.data[c].forEach(x=>{ this._shadow[c][x.id] = JSON.stringify(x); });
    }
    await this.settingsRef().set(this.clean(Store.data.settings));
    this._settingsShadow = JSON.stringify(Store.data.settings);
    this.lastPushAt = new Date().toISOString();
    if (this.status==='error'){ this.status = 'online'; this.lastError = ''; }
  },
};
