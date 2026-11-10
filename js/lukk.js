/* Kauge 32 · Lukk: parooliga kaitstud andmefailide avamine brauseris (vt README „Parooliga kaitse“).
 *
 * GitHub Pages ei oska parooli küsida ja repo on avalik, seega on andmefailid (hinnad.json, paike.json,
 * paevad.json) repo's krüpteeritud (.github/scripts/lukk.py, AES-256-GCM, võti paroolist PBKDF2-SHA256-ga)
 * ja see skript dekrüpteerib need brauseris WebCrypto-ga. Parooli ei saadeta kuhugi: võti tuletatakse
 * siinsamas ja andmed avatakse ainult selles brauseris.
 *
 * Kasutus lehe skriptis:
 *   Lukk.valmis()            – lubadus, mis täitub, kui leht on avatud (parool sisestatud või lehel pole lukku);
 *                              seni on <div id="lukk"> avamisvaade nähtav ja .app peidetud (html.lukk-ootel)
 *   Lukk.fetch(url, valikud) – nagu fetch(); krüpteeritud ümbriku ({"lukk":1,...}) korral tagastab dekrüpteeritud
 *                              JSON-i Response'i. Teise saidi aadress (nt Eleringi API) läheb tavalise fetch()-iga
 *                              mööda dekrüpteerijast. Lukustatud lehel ei võeta samalt saidilt krüpteerimata JSON-i
 *                              vastu (viga), lukuta lehel tagastatakse tavaline fail muutmata kujul
 *   Lukk.lukusta()           – unustab kõik selle brauseri salvestatud võtmed ja laeb lehe uuesti (jaluse nupp „Lukusta leht“)
 *   Lukk.taastub(valikud)    – kas leht avaneb pärast uuesti laadimist ilma paroolita (js/common.js, uus versioon). Ilma
 *                              valikuta ainult loeb (true/false); { pikenda: true } (vahetult enne laadimist) kontrollib värsket
 *                              lukk.json-i (15 s ajapiir; viga -> null) ja lükkab selle vahelehe OLEMASOLEVA kirje aegumise
 *                              12 h edasi. Puuduvat kirjet ei looda („Lukusta leht“ jääb kehtima); „Jäta meelde“ ei pikene
 *
 * Failid: lukk.json {lukk, kdf, iter, salt, kontroll:{iv, ct}} – sool ja parooli kontrollväärtus
 *         (kontroll = AES-GCM(võti, "kauge32-lukk")); puudumine (404) tähendab, et lehel pole lukku.
 *         Andmefail  {lukk, kdf, iter, salt, iv, ct}.
 * Võti (mitte parool) on mitte-eksporditav CryptoKey (extractable: false) ja seda hoitakse IndexedDB-s
 * (andmebaas kauge32-lukk, hoidla votmed): „Jäta meelde“ korral kirje „pysiv“ (kehtib 30 päeva salvestamisest, siis
 * küsitakse parooli uuesti), muidu selle vahelehe kirje
 * „sessioon:<id>“, mille id on vahelehe sessionStorage'is (kauge32_lukk_sessioon). Vahelehe sulgemisel kaob id ja
 * kirjet ei saa enam kasutada; aegunud sessioonikirjed (12 h viimasest laadimisest; lahti olev vaheleht pikendab olemasolevat
 * kirjet vahetult enne automaatset uuesti laadimist) kustutatakse järgmisel avamisel.
 * Mitte-eksporditavat võtit ei saa ka sama saidi (*.github.io) skript välja lugeda ega teise seadmesse viia, ainult
 * selles brauseris kasutada. Varasem eksporditud võti (localStorage/sessionStorage kauge32_lukk) kolitakse üle ja
 * kustutatakse. Parooli ennast ei salvestata ega hoita mälus: sellest tuletatakse võti ja vormi väli tühjendatakse.
 * Kui mõni andmefail on teise soolaga (lukk.json loodi vahepeal uuesti), küsitakse parooli selle faili jaoks veel kord.
 * Skript laaditakse <head>-is ilma defer'ita, et globaal Lukk oleks lehe skriptile olemas ja .app saaks
 * peita enne esimest joonistamist.
 */
(function (global) {
  'use strict';

  const LUKU_FAIL = 'lukk.json';
  const VANA_SALVESTUS = 'kauge32_lukk';            // varasem eksporditud võti (local-/sessionStorage), kolitakse üle
  const IDB_NIMI = 'kauge32-lukk';
  const IDB_POOD = 'votmed';
  const PYSIV = 'pysiv';
  const SESSIOON = 'kauge32_lukk_sessioon';         // sessionStorage: selle vahelehe IndexedDB kirje id (mitte võti)
  const SESSIOONI_AEG_MS = 12 * 3600 * 1000;      // vahelehe kirje: 12 h viimasest laadimisest; lahti olev vaheleht pikendab
                                                  // olemasolevat kirjet vahetult enne automaatset uuesti laadimist
  const PYSIVA_AEG_MS = 30 * 24 * 3600 * 1000;      // „Jäta meelde“: 30 päeva salvestamisest, ei pikene (NIST SP 800-63B §7.2)
  const MAX_PAROOL = 256;
  const KONTROLL = 'kauge32-lukk';
  const KDF = 'PBKDF2-SHA256';
  const MIN_ITER = 600000;          // PBKDF2 iteratsioonide lubatud vahemik (sama mis .github/scripts/lukk.py-s): vähem = nõrk
  const MAX_ITER = 2000000;         // võti, rohkem = vigane või pahatahtlik fail koormaks protsessorit minuteid
  const SOOL_B = 16;
  const IV_B = 12;
  const VANAD_VOTMED = 'kauge32.energia.';         // varasema Solarmani otseühenduse võtmed (local-/sessionStorage): kustutatakse
  const TAASTUMISE_VARU_MS = 10 * 60 * 1000;   // „Jäta meelde“ kirje peab kehtima veel vähemalt nii kaua (laadimine + avamine)
  const LUKU_KORDUS_MS = 30 * 1000;            // lukk.json-i viga avamisel: automaatne kordus (seinaekraan ei jää ootama)
  const LUKU_AJAPIIR_MS = 15 * 1000;           // lukk.json-i päring avamisel ja taastub({ pikenda }): rippuv ühendus = viga

  const subtle = global.crypto && global.crypto.subtle;
  const utf8 = new TextEncoder();
  const utf8d = new TextDecoder();

  let lukuInfo = null;          // lukk.json sisu (null = lukku pole)
  let valmisLubadus = null;     // Lukk.valmis() tulemus (üks kord)
  const votmed = new Map();     // `${salt}|${iter}` -> CryptoKey
  let avamine = null;           // pooleli olev parooliküsimine { promise, resolve }

  if (location.protocol !== 'file:') document.documentElement.classList.add('lukk-ootel');

  /* ---------- abifunktsioonid ---------- */
  const byId = id => document.getElementById(id);

  function b64d(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function onUmbrik(obj) {
    return Boolean(obj) && typeof obj === 'object' && obj.lukk === 1 && typeof obj.ct === 'string' && typeof obj.iv === 'string';
  }

  function votmeId(salt, iter) {
    return `${salt}|${iter}`;
  }

  /** Base64 baitide arv; vigase base64 korral -1. */
  function baite(s) {
    try { return typeof s === 'string' ? b64d(s).length : -1; } catch (error) { return -1; }
  }

  function kehtivParameetrid(obj) {
    return Number.isInteger(obj.iter) && obj.iter >= MIN_ITER && obj.iter <= MAX_ITER
      && (obj.kdf === undefined || obj.kdf === KDF) && baite(obj.salt) >= SOOL_B;
  }

  async function tuletaVoti(pw, saltB64, iter) {
    const alus = await subtle.importKey('raw', utf8.encode(pw.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64d(saltB64), iterations: iter },
      alus, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
  }

  async function dekrypteeri(voti, ivB64, ctB64) {
    const tavatekst = await subtle.decrypt({ name: 'AES-GCM', iv: b64d(ivB64) }, voti, b64d(ctB64));
    return utf8d.decode(tavatekst);
  }

  /** Kas võti avab lukk.json-i kontrollväärtuse? (vale parool annab GCM autentimisvea) */
  async function kontrolliVoti(voti, info) {
    try {
      return (await dekrypteeri(voti, info.kontroll.iv, info.kontroll.ct)) === KONTROLL;
    } catch (error) {
      return false;
    }
  }

  /* ---------- võtme salvestus (IndexedDB, mitte-eksporditav CryptoKey) ---------- */
  let dbLubadus = null;

  /** IndexedDB ühendus või null (keelatud, privaatrežiim vms: võtit ei salvestata, parool küsitakse igal laadimisel). */
  function avaDb() {
    if (!dbLubadus) {
      dbLubadus = new Promise(resolve => {
        try {
          const req = global.indexedDB.open(IDB_NIMI, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(IDB_POOD);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      });
    }
    return dbLubadus;
  }

  /** Üks tehing: fn(store) tagastab päringu (või null); täitub päringu tulemusega pärast tehingu lõppu, vea korral undefined. */
  async function idb(mode, fn) {
    const db = await avaDb();
    if (!db) return undefined;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_POOD, mode);
        const req = fn(tx.objectStore(IDB_POOD));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => resolve(undefined);
        tx.onabort = () => resolve(undefined);
      } catch (error) {
        resolve(undefined);
      }
    });
  }

  function sessionStorageVoi() {
    try { return global.sessionStorage; } catch (error) { return null; }
  }

  /** Selle vahelehe sessioonikirje id; uue loob ainult siis, kui looUus (salvestamisel). */
  function sessiooniId(looUus) {
    const ss = sessionStorageVoi();
    if (!ss) return null;
    try {
      let id = ss.getItem(SESSIOON);
      if (!id && looUus) {
        const b = new Uint8Array(16);
        global.crypto.getRandomValues(b);
        id = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
        ss.setItem(SESSIOON, id);
      }
      return id || null;
    } catch (error) {
      return null;
    }
  }

  /** Salvestatud kirje: mitte-eksporditav AES-GCM võti (muud ei kasutata), aegumata. */
  function kehtivKirje(obj, nyyd = Date.now()) {
    return Boolean(obj) && typeof obj.salt === 'string' && Number.isInteger(obj.iter)
      && Boolean(obj.key) && typeof obj.key === 'object' && obj.key.type === 'secret' && obj.key.extractable === false
      && Boolean(obj.key.algorithm) && obj.key.algorithm.name === 'AES-GCM'
      && (obj.aegub === undefined || obj.aegub > nyyd);
  }

  /** Kustutab aegunud kirjed: sessioonid (ka teiste, juba suletud vahelehtede omad) ja 30 päeva vanuse püsiva võtme. */
  function koristaAegunud() {
    const nyyd = Date.now();
    return idb('readwrite', store => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        const k = String(c.key);
        const v = c.value;
        if (k.startsWith('sessioon:') && !(v && v.aegub > nyyd)) c.delete();
        else if (k === PYSIV && v && v.aegub !== undefined && !(v.aegub > nyyd)) c.delete();   // 30 päeva täis
        c.continue();
      };
      return null;
    });
  }

  /** Salvestatud kirje { salt, iter, key, pysiv } (enne püsiv, siis selle vahelehe oma) või null. */
  async function loeSalvestatud() {
    await koristaAegunud();
    const pysiv = await idb('readonly', store => store.get(PYSIV));
    if (kehtivKirje(pysiv)) {
      // Varasem püsiv kirje oli aegumiseta: 30 päeva hakkab lugema nüüd (elanikelt ei küsita parooli kohe uuesti)
      if (pysiv.aegub === undefined) await idb('readwrite', store => store.put({ ...pysiv, aegub: Date.now() + PYSIVA_AEG_MS }, PYSIV));
      return { salt: pysiv.salt, iter: pysiv.iter, key: pysiv.key, pysiv: true };
    }
    const id = sessiooniId(false);
    if (id) {
      const sess = await idb('readonly', store => store.get(`sessioon:${id}`));
      if (kehtivKirje(sess)) return { salt: sess.salt, iter: sess.iter, key: sess.key, pysiv: false };
    }
    return null;
  }

  /** Varasem eksporditud võti local-/sessionStorage'ist: imporditakse mitte-eksporditavana ja kustutatakse alati. */
  async function loeVanaSalvestus() {
    for (const pysiv of [true, false]) {
      let raw = null;
      try {
        const s = pysiv ? global.localStorage : global.sessionStorage;
        raw = s.getItem(VANA_SALVESTUS);
        s.removeItem(VANA_SALVESTUS);
      } catch (error) { /* salvestusruum keelatud */ }
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.salt === 'string' && Number.isInteger(obj.iter) && typeof obj.key === 'string') {
          const key = await subtle.importKey('raw', b64d(obj.key), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
          return { salt: obj.salt, iter: obj.iter, key, pysiv };
        }
      } catch (error) { /* vigane kirje */ }
    }
    return null;
  }

  function kirjutaKirje(voti, info, pysiv) {
    if (pysiv) return idb('readwrite', store => store.put({ salt: info.salt, iter: info.iter, key: voti, aegub: Date.now() + PYSIVA_AEG_MS }, PYSIV));
    const id = sessiooniId(true);
    if (!id) return Promise.resolve();   // sessionStorage keelatud: võti jääb ainult mällu
    return idb('readwrite', store => store.put(
      { salt: info.salt, iter: info.iter, key: voti, aegub: Date.now() + SESSIOONI_AEG_MS }, `sessioon:${id}`));
  }

  /** Kustutab varasema Solarmani otseühenduse võtmed (App Secret, e-post, parooli räsi, token): brauser neid enam ei kasuta. */
  function unustaVanadVotmed() {
    for (const s of ['localStorage', 'sessionStorage']) {
      try {
        const ala = global[s];
        for (const voti of Object.keys(ala)) if (voti.startsWith(VANAD_VOTMED)) ala.removeItem(voti);
      } catch (error) { /* salvestusruum keelatud: seal pole ka midagi kustutada */ }
    }
  }

  /** Unustab selle vahelehe ja püsiva võtme (kõik = true: ka teiste vahelehtede sessioonid). */
  async function unustaSalvestatud(koik) {
    for (const s of ['localStorage', 'sessionStorage']) {
      try { global[s].removeItem(VANA_SALVESTUS); } catch (error) { /* ignoreeri */ }
    }
    if (koik) {
      await idb('readwrite', store => store.clear());
      return;
    }
    const id = sessiooniId(false);
    await idb('readwrite', store => {
      store.delete(PYSIV);
      if (id) store.delete(`sessioon:${id}`);
      return null;
    });
  }

  async function salvestaVoti(voti, info, pysiv) {
    await unustaSalvestatud(false);
    await kirjutaKirje(voti, info, pysiv);
  }

  /* ---------- lukk.json ---------- */
  async function laeLukuFail(signal) {
    const response = await fetch(`${LUKU_FAIL}?v=${Date.now()}`, { cache: 'no-store', signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (!json || json.lukk !== 1 || !kehtivParameetrid(json) || json.kdf !== KDF
        || !json.kontroll || baite(json.kontroll.iv) !== IV_B || typeof json.kontroll.ct !== 'string') {
      throw new Error('lukk.json on vigane');
    }
    return json;
  }

  /** laeLukuFail ajapiiriga: rippuv päring lõpeb eestikeelse veaga (abort() põhjus ei jõua igas brauseris veateatesse);
   *  avamise 30-s kordus ja uue versiooni kontroll jätkavad. */
  function laeLukuFailAjaga() {
    const ohjur = new AbortController();
    const taimer = setTimeout(() => ohjur.abort(), LUKU_AJAPIIR_MS);
    return laeLukuFail(ohjur.signal)
      .catch(error => { throw ohjur.signal.aborted ? new Error(`lukk.json ei vastanud ${LUKU_AJAPIIR_MS / 1000} s jooksul`) : error; })
      .finally(() => clearTimeout(taimer));
  }

  /* ---------- avamisvaade ---------- */
  const ui = {
    get root() { return byId('lukk'); },
    get form() { return byId('lukk-form'); },
    get input() { return byId('lukk-parool'); },
    get remember() { return byId('lukk-pea-meeles'); },
    get error() { return byId('lukk-viga'); },
    get button() { return byId('lukk-ava'); },
    get text() { return byId('lukk-tekst'); }
  };

  /** Teade lehele (k32:lukk, detail 'kysitud' | 'avatud'): js/common.js loendab need külastuste statistikas. */
  function teata(olek) {
    try { document.dispatchEvent(new CustomEvent('k32:lukk', { detail: olek })); } catch (error) { /* teade pole kriitiline */ }
  }

  function naitaViga(msg) {
    const el = ui.error;
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function naitaVaadet(nahtav) {
    const root = ui.root;
    const app = document.querySelector('.app');
    if (root) root.hidden = !nahtav;
    if (app) {
      app.inert = nahtav;
      if (nahtav) app.setAttribute('aria-hidden', 'true');
      else app.removeAttribute('aria-hidden');
    }
    if (ui.input) ui.input.value = '';   // parool ei jää lehe vormi ka pärast avamist (peidetud vaates)
    if (nahtav && ui.input) {
      try { ui.input.focus({ preventScroll: true }); } catch (error) { /* fookus pole kriitiline */ }
    }
  }

  function tooOlek(toos, silt) {
    const button = ui.button;
    if (button) {
      button.disabled = toos;
      button.classList.toggle('is-loading', toos);
      button.textContent = silt || (toos ? 'Kontrollin…' : 'Ava');
    }
    if (ui.input) ui.input.disabled = toos;
  }

  /**
   * Näitab avamisvaadet ja täitub, kui õige parool on sisestatud (võti tuletatud ja kontrollitud). Tulemus on sisestatud
   * parool (ainult ootajale, kes vajab teise soolaga võtit; seda ei salvestata) või '', kui lukk vahepeal eemaldati.
   */
  function kysiParool(teade) {
    if (avamine) {
      if (teade) naitaViga(teade);
      return avamine.promise;
    }
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    avamine = { promise, resolve };
    tooOlek(false);      // enne naitaVaadet-i: keelatud välja (lukk.json-i korduse järel) ei saa fokuseerida
    naitaVaadet(true);
    teata('kysitud');
    naitaViga(teade || '');
    return promise;
  }

  async function esitaParool(event) {
    event.preventDefault();
    if (!avamine) return;
    const pw = (ui.input ? ui.input.value : '').trim();
    if (!pw) { naitaViga('Sisesta parool.'); return; }
    if (pw.length > MAX_PAROOL) { naitaViga(`Parool on liiga pikk (üle ${MAX_PAROOL} märgi).`); return; }
    naitaViga('');
    tooOlek(true);
    try {
      if (!lukuInfo) lukuInfo = await laeLukuFail();
      if (!lukuInfo) { lopetaAvamine(); return; }   // lukk eemaldati vahepeal
      const voti = await tuletaVoti(pw, lukuInfo.salt, lukuInfo.iter);
      if (!(await kontrolliVoti(voti, lukuInfo))) {
        tooOlek(false);
        naitaViga('Vale parool. Proovi uuesti.');
        if (ui.input) { ui.input.select(); }
        return;
      }
      votmed.set(votmeId(lukuInfo.salt, lukuInfo.iter), voti);
      await salvestaVoti(voti, lukuInfo, Boolean(ui.remember && ui.remember.checked));
      teata('avatud');
      lopetaAvamine(pw);
    } catch (error) {
      console.error('Lukk: avamine ebaõnnestus', error);
      tooOlek(false);
      naitaViga(`Avamine ebaõnnestus: ${error.message}`);
    }
  }

  function lopetaAvamine(pw = '') {
    naitaVaadet(false);
    document.documentElement.classList.remove('lukk-ootel');
    naitaLukustusnupp();
    const a = avamine;
    avamine = null;
    if (a) a.resolve(pw);
  }

  function naitaLukustusnupp() {
    const wrap = byId('lukk-lukusta-wrap');
    if (wrap) wrap.hidden = !lukuInfo;
    const btn = byId('lukk-lukusta');
    if (btn && !btn.dataset.lukkReady) {
      btn.dataset.lukkReady = '1';
      btn.addEventListener('click', lukusta);
    }
  }

  async function lukusta() {
    votmed.clear();
    unustaVanadVotmed();
    await unustaSalvestatud(true);
    location.reload();
  }

  /** Kas see vaheleht avaneb pärast uuesti laadimist ilma paroolita (js/common.js jaotis 10)? Lukuta lehel true, avamisvaate
   *  ajal false; { pikenda: true } korral null, kui lukk.json ei laadinud (viga või ajapiir – praegu ei saa öelda). Püsiv kirje
   *  peab kehtima veel TAASTUMISE_VARU_MS (30 päeva ei pikene); vahelehe kirje peab olemas olema – { pikenda: true } lükkab selle
   *  aegumise (ka aegunud kirje oma) ühes tehingus edasi, puuduvat ei looda kunagi. */
  async function taastub({ pikenda = false } = {}) {
    if (pikenda) {
      const info = await laeLukuFailAjaga().catch(() => undefined);
      if (info === undefined) return null;    // lukk.json ei laadi: ei tea (uus leht jääks ootama)
      if (info === null) return true;         // lukku pole (enam)
      if (!lukuInfo || info.salt !== lukuInfo.salt || info.iter !== lukuInfo.iter) return false;   // lukk lisati või parool vahetati
    } else if (!lukuInfo) {
      return true;
    }
    if (avamine || (ui.root && !ui.root.hidden)) return false;
    if (!votmed.has(votmeId(lukuInfo.salt, lukuInfo.iter))) return false;
    const sobib = (k, nyyd) => kehtivKirje(k, nyyd) && k.salt === lukuInfo.salt && k.iter === lukuInfo.iter;
    if (sobib(await idb('readonly', store => store.get(PYSIV)), Date.now() + TAASTUMISE_VARU_MS)) return true;
    const id = sessiooniId(false);
    if (!id) return false;
    const voti = `sessioon:${id}`;
    if (!pikenda) return sobib(await idb('readonly', store => store.get(voti)), 0);
    let pikendatud = false;
    const kirje = await idb('readwrite', store => {
      const req = store.get(voti);
      req.onsuccess = () => {
        if (!sobib(req.result, 0)) return;
        store.put({ ...req.result, aegub: Date.now() + SESSIOONI_AEG_MS }, voti).onsuccess = () => { pikendatud = true; };
      };
      return req;
    });
    return Boolean(kirje) && pikendatud;
  }

  /* ---------- võtme hankimine ja ümbriku avamine ---------- */
  /** Võti antud soola ja iteratsioonidega: vahemälust või küsides parooli (parool on ainult selle funktsiooni muutujas). */
  async function hangiVoti(salt, iter, teade) {
    const id = votmeId(salt, iter);
    if (votmed.has(id)) return votmed.get(id);
    const pw = await kysiParool(teade);
    if (votmed.has(id)) return votmed.get(id);
    if (!pw) throw new Error('lukk eemaldati avamise ajal, laadi leht uuesti');
    // parool sisestati lukk.json-i soolaga; see fail kasutab teist soola (lukk.json loodi vahepeal uuesti)
    const voti = await tuletaVoti(pw, salt, iter);
    votmed.set(id, voti);
    return voti;
  }

  async function avaUmbrik(umbrik) {
    if (!kehtivParameetrid(umbrik) || baite(umbrik.iv) !== IV_B) throw new Error('krüpteeritud faili parameetrid on vigased');
    if (!subtle) throw new Error('brauser ei toeta WebCrypto-t (vaja on HTTPS-i)');
    let teade;
    if (!votmed.has(votmeId(umbrik.salt, umbrik.iter))) {
      // Tundmatu sool: kas lukk.json on vahepeal uue soolaga (parooli vahetus)? Siis kontrollitakse uut parooli selle vastu.
      const info = await laeLukuFail().catch(() => null);
      if (info && info.salt === umbrik.salt && info.iter === umbrik.iter && (!lukuInfo || info.salt !== lukuInfo.salt)) {
        lukuInfo = info;
        await unustaSalvestatud(false);
        teade = 'Parool on vahetatud. Sisesta uus parool.';
      }
    }
    let voti = await hangiVoti(umbrik.salt, umbrik.iter, teade);
    try {
      return await dekrypteeri(voti, umbrik.iv, umbrik.ct);
    } catch (error) {
      // Kas parool on vahetatud? Kui olemasolev võti avab endiselt värske lukk.json-i kontrollväärtuse, siis mitte: viga
      // on selles failis (nt jäi see parooli vahetusel vana parooli alla, kuni töövoog selle uuesti salvestab). Siis
      // võtit ei unustata ega parooli küsita uuesti – muidu küsiks leht õiget parooli igal laadimisel.
      const info = await laeLukuFail().catch(() => null);
      const lukuVoti = info && votmed.get(votmeId(info.salt, info.iter));
      if (lukuVoti && await kontrolliVoti(lukuVoti, info)) {
        lukuInfo = info;
        throw new Error('andmefail ei avane kehtiva parooliga (töövoog pole seda veel uue parooliga salvestanud)');
      }
      // Võti ei sobi: parool on vahetatud (salvestatud võti on vana) – küsi uuesti ja proovi veel üks kord
      votmed.delete(votmeId(umbrik.salt, umbrik.iter));
      await unustaSalvestatud(false);
      lukuInfo = info || lukuInfo;
      voti = await hangiVoti(umbrik.salt, umbrik.iter, 'Parool on vahetatud. Sisesta uus parool.');
      return dekrypteeri(voti, umbrik.iv, umbrik.ct);
    }
  }

  /* ---------- avalik liides ---------- */
  async function kaivita() {
    // Teise lehe raamis (iframe) ei käivitu lukk üldse: IndexedDB-d ei avata, sessiooni ei pikendata, andmeid ei laadita
    // (GitHub Pagesil, kus frame-ancestors päist pole; js/teema.js peidab lehe). Lubadus ei täitu, seega leht ei käivitu.
    if (global.top !== global.self) return new Promise(() => {});
    unustaVanadVotmed();
    if (location.protocol === 'file:') {
      // file://: andmefaile nagunii ei loeta, lukk jääb vahele
      document.documentElement.classList.remove('lukk-ootel');
      return false;
    }
    if (!subtle) {
      // Ebaturvaline ühendus (http://) või WebCrypto-ta brauser: lukuta lehel jätkatakse, lukus lehel ei avata midagi
      let info;
      try { info = await laeLukuFail(); } catch (error) { info = undefined; }
      if (info === null) { lopetaAvamine(); return false; }
      naitaVaadet(true);
      tooOlek(true, 'Ava');
      naitaViga('Leht tuleb avada turvalise ühendusega (https://). Siin ei saa brauser andmeid dekrüpteerida.');
      return new Promise(() => {});
    }
    if (ui.form && !ui.form.dataset.lukkReady) {
      ui.form.dataset.lukkReady = '1';
      ui.form.addEventListener('submit', esitaParool);
    }
    let fookusNupul = false;   // automaatne kordus ei vii fookust ära (klaviatuuri- ja ekraanilugeja kasutaja)
    for (;;) {
      try {
        lukuInfo = await laeLukuFailAjaga();
        break;
      } catch (error) {
        console.error('Lukk: lukk.json laadimine ebaõnnestus', error);
        // Ilma lukufailita ei tea leht, kas ta on lukus: vaade veateatega; nupp proovib kohe, leht ise iga LUKU_KORDUS_MS järel
        const uuesti = new Promise(r => {
          const form = ui.form;
          let taimer = null;
          const handler = e => { e.preventDefault(); jatka(); };
          const jatka = () => { clearTimeout(taimer); if (form) form.removeEventListener('submit', handler, true); r(); };
          if (form) form.addEventListener('submit', handler, true);
          taimer = setTimeout(jatka, form ? LUKU_KORDUS_MS : 5000);
        });
        const esimest = !ui.root || ui.root.hidden;
        if (esimest) naitaVaadet(true);   // korduse ajal on vaade juba nähtav: fookust ei liigutata
        tooOlek(false, 'Proovi uuesti');
        if (ui.input) ui.input.disabled = true;
        if ((esimest || fookusNupul) && ui.button) {
          try { ui.button.focus({ preventScroll: true }); } catch (e) { /* fookus pole kriitiline */ }
        }
        const tekst = `Lehe oleku kontroll ebaõnnestus (${error.message}). Kontrolli internetiühendust – leht proovib iga ${LUKU_KORDUS_MS / 1000} sekundi järel ise uuesti.`;
        // role="alert": sama teadet ei kuulutata iga korduse järel uuesti
        if (!ui.error || ui.error.hidden || ui.error.textContent !== tekst) naitaViga(tekst);
        await uuesti;
        fookusNupul = Boolean(ui.button) && document.activeElement === ui.button;
        tooOlek(true, 'Kontrollin…');
      }
    }
    if (!lukuInfo) {
      lopetaAvamine();
      return false;
    }
    const vana = await loeVanaSalvestus();       // varasem eksporditud võti: kolitakse IndexedDB-sse
    const salvestatud = (await loeSalvestatud()) || vana;
    if (salvestatud && salvestatud.salt === lukuInfo.salt && salvestatud.iter === lukuInfo.iter) {
      if (await kontrolliVoti(salvestatud.key, lukuInfo)) {
        votmed.set(votmeId(lukuInfo.salt, lukuInfo.iter), salvestatud.key);
        // Ülekolimine või sessioonikirje aegumise edasilükkamine (12 h viimasest laadimisest; lahti olev vaheleht pikendab
        // olemasolevat kirjet vahetult enne automaatset uuesti laadimist)
        if (salvestatud === vana || !salvestatud.pysiv) await kirjutaKirje(salvestatud.key, lukuInfo, salvestatud.pysiv);
        lopetaAvamine();
        return true;
      }
      await unustaSalvestatud(false);
      await kysiParool('Parool on vahetatud. Sisesta uus parool.');
      return true;
    }
    if (salvestatud) await unustaSalvestatud(false);
    await kysiParool(salvestatud ? 'Parool on vahetatud. Sisesta uus parool.' : undefined);   // teine sool = parool vahetati
    return true;
  }

  function valmis() {
    if (!valmisLubadus) valmisLubadus = kaivita();
    return valmisLubadus;
  }

  /**
   * fetch(), mis avab samalt saidilt laaditud krüpteeritud ümbriku. Teise saidi vastust (Eleringi API, varuproksi) ei
   * proovita kunagi avada: võõras „ümbrik“ ei saa parooli küsida ega võtit kasutada. Lukustatud lehel on samalt saidilt
   * tulnud krüpteerimata JSON viga (keegi ei saa vahetada krüpteeritud andmefaili võltsitud tavafaili vastu), v.a kui
   * lukk.json on vahepeal eemaldatud (kaitse võeti maha): siis jätkab leht lukuta.
   */
  async function lukkFetch(url, valikud) {
    const siht = new URL(url, global.location.href);
    if (siht.origin !== global.location.origin) return fetch(url, valikud);
    await valmis();
    const response = await fetch(url, valikud);
    if (!response.ok) return response;
    const tekst = await response.text();
    let json = null;
    try { json = JSON.parse(tekst); } catch (error) { json = null; }
    if (!onUmbrik(json)) {
      if (lukuInfo && json !== null) {
        const info = await laeLukuFail().catch(() => undefined);
        if (info !== null) throw new Error('andmefail pole krüpteeritud, kuigi leht on parooliga kaitstud');
        lukuInfo = null;   // lukk.json kustutati (kaitse maha võetud): edasi lukuta
        naitaLukustusnupp();
      }
      const paised = { 'Content-Type': response.headers.get('Content-Type') || 'application/json' };
      return new Response(tekst, { status: response.status, statusText: response.statusText, headers: paised });
    }
    const tavatekst = await avaUmbrik(json);
    return new Response(tavatekst, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  global.Lukk = { valmis, fetch: lukkFetch, lukusta, taastub, get lukus() { return Boolean(lukuInfo); } };
})(window);
