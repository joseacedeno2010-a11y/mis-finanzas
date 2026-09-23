'use strict';
/* Sincronización en la nube (Firebase Auth + Firestore).
   Estructura: users/{uid}/meta/settings y colecciones users/{uid}/{accounts|categories|people|loans|transactions}/{id}.
   Estrategia: cada documento se escribe cuando cambia localmente; onSnapshot trae cambios de otros dispositivos. */
const Sync = {
  COLLS: ['accounts', 'categories', 'people', 'loans', 'transactions', 'budgets'],
  config: window.FIREBASE_CONFIG || null,
  user: null,
  db: null,
  ready: false,
  status: 'off',       // off | signed_out | syncing | online | error
  lastError: '',
  _shadow: {},          // último estado enviado/recibido por colección: {id: json}
  _settingsShadow: '',
  _unsubs: [],
  _applying: false,

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

  /* ---- sincronización ---- */
  ref(coll){ return this.db.collection('users').doc(this.user.uid).collection(coll); },
  settingsRef(){ return this.db.collection('users').doc(this.user.uid).collection('meta').doc('settings'); },

  async start(){
    this.stop();
    this.status = 'syncing';
    this._shadow = {}; this.COLLS.forEach(c=>this._shadow[c] = {}); this._settingsShadow = '';
    // 1) leer lo que hay en la nube
    const remote = {};
    for (const c of this.COLLS){ const snap = await this.ref(c).get(); remote[c] = snap.docs.map(d=>d.data()); }
    const settingsSnap = await this.settingsRef().get();
    const cloudEmpty = this.COLLS.every(c=>!remote[c].length);
    const localEmpty = this.COLLS.every(c=>!Store.data[c].length);
    this._applying = true;
    if (cloudEmpty && !localEmpty){
      // primera vez: subir lo local
      await this.pushAll();
    } else if (!cloudEmpty){
      // combinar: lo de la nube manda; lo local que no exista en la nube se sube
      const toPush = {};
      for (const c of this.COLLS){
        const remoteIds = new Set(remote[c].map(x=>x.id));
        const extra = localEmpty ? [] : Store.data[c].filter(x=>!remoteIds.has(x.id));
        if (extra.length) toPush[c] = extra;
        Store.data[c] = remote[c].concat(extra);
      }
      if (settingsSnap.exists) Store.data.settings = Object.assign(Store.data.settings, settingsSnap.data());
      Store.save();
      for (const c in toPush) for (const x of toPush[c]) await this.ref(c).doc(x.id).set(this.clean(x));
    }
    this.COLLS.forEach(c=>{ Store.data[c].forEach(x=>{ this._shadow[c][x.id] = JSON.stringify(x); }); });
    this._settingsShadow = JSON.stringify(Store.data.settings);
    if (!settingsSnap.exists) await this.settingsRef().set(this.clean(Store.data.settings));
    this._applying = false;
    // 2) escuchar cambios de otros dispositivos
    for (const c of this.COLLS){
      this._unsubs.push(this.ref(c).onSnapshot(snap=>{
        if (snap.metadata.hasPendingWrites) return; // son mis propios cambios
        let changed = false;
        snap.docChanges().forEach(ch=>{
          const d = ch.doc.data(); const json = JSON.stringify(d);
          if (ch.type==='removed'){ if (this._shadow[c][d.id]!==undefined){ delete this._shadow[c][d.id]; Store.data[c] = Store.data[c].filter(x=>x.id!==d.id); changed = true; } return; }
          if (this._shadow[c][d.id]===json) return;
          this._shadow[c][d.id] = json;
          const i = Store.data[c].findIndex(x=>x.id===d.id);
          if (i>=0) Store.data[c][i] = d; else Store.data[c].push(d);
          changed = true;
        });
        if (changed){ this._applying = true; Store.save(); this._applying = false; App.render(); }
      }, e=>{ this.status = 'error'; this.lastError = e.message; console.error(e); }));
    }
    this._unsubs.push(this.settingsRef().onSnapshot(doc=>{
      if (!doc.exists || doc.metadata.hasPendingWrites) return;
      const json = JSON.stringify(doc.data());
      if (json===this._settingsShadow) return;
      this._settingsShadow = json;
      this._applying = true; Store.data.settings = Object.assign(Store.data.settings, doc.data()); Store.save(); this._applying = false; App.render();
    }));
    this.status = 'online';
    App.render();
  },
  stop(){ this._unsubs.forEach(u=>u()); this._unsubs = []; if (this.status!=='off' && this.status!=='error') this.status = 'signed_out'; },

  clean(obj){ return JSON.parse(JSON.stringify(obj)); }, // quita undefined
  async pushAll(){
    for (const c of this.COLLS){
      let batch = this.db.batch(), n = 0;
      for (const x of Store.data[c]){ batch.set(this.ref(c).doc(x.id), this.clean(x)); if (++n===400){ await batch.commit(); batch = this.db.batch(); n = 0; } }
      if (n) await batch.commit();
    }
    await this.settingsRef().set(this.clean(Store.data.settings));
  },
  /* llamado por Store.save(): envía solo lo que cambió */
  onLocalSave(){
    if (!this.user || this._applying || this.status==='syncing' || this.status==='signed_out' || this.status==='off') return;
    for (const c of this.COLLS){
      const seen = new Set();
      for (const x of Store.data[c]){
        seen.add(x.id);
        const json = JSON.stringify(x);
        if (this._shadow[c][x.id]!==json){ this._shadow[c][x.id] = json; this.ref(c).doc(x.id).set(this.clean(x)).catch(e=>console.error(e)); }
      }
      for (const id of Object.keys(this._shadow[c])){ if (!seen.has(id)){ delete this._shadow[c][id]; this.ref(c).doc(id).delete().catch(e=>console.error(e)); } }
    }
    const sj = JSON.stringify(Store.data.settings);
    if (sj!==this._settingsShadow){ this._settingsShadow = sj; this.settingsRef().set(this.clean(Store.data.settings)).catch(e=>console.error(e)); }
  },
};
