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
 *                              JSON-i Response'i, tavalise faili korral vastuse muutmata kujul
 *   Lukk.lukusta()           – unustab kõik selle brauseri salvestatud võtmed ja laeb lehe uuesti (jaluse nupp „Lukusta leht“)
 *
 * Failid: lukk.json {lukk, kdf, iter, salt, kontroll:{iv, ct}} – sool ja parooli kontrollväärtus
 *         (kontroll = AES-GCM(võti, "kauge32-lukk")); puudumine (404) tähendab, et lehel pole lukku.
 *         Andmefail  {lukk, kdf, iter, salt, iv, ct}.
 * Võti (mitte parool) on mitte-eksporditav CryptoKey (extractable: false) ja seda hoitakse IndexedDB-s
 * (andmebaas kauge32-lukk, hoidla votmed): „Jäta meelde“ korral kirje „pysiv“, muidu selle vahelehe kirje
 * „sessioon:<id>“, mille id on vahelehe sessionStorage'is (kauge32_lukk_sessioon). Vahelehe sulgemisel kaob id ja
 * kirjet ei saa enam kasutada; aegunud sessioonikirjed (12 h viimasest kasutusest) kustutatakse järgmisel avamisel.
 * Mitte-eksporditavat võtit ei saa ka sama saidi (*.github.io) skript välja lugeda ega teise seadmesse viia, ainult
 * selles brauseris kasutada. Varasem eksporditud võti (localStorage/sessionStorage kauge32_lukk) kolitakse üle ja
 * kustutatakse. Parool ise jääb lehe sulgemiseni ainult mällu (teise soolaga faili jaoks).
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
  const SESSIOONI_AEG_MS = 12 * 3600 * 1000;
  const KONTROLL = 'kauge32-lukk';
  const KDF = 'PBKDF2-SHA256';
  const MIN_ITER = 1000;

  const subtle = global.crypto && global.crypto.subtle;
  const utf8 = new TextEncoder();
  const utf8d = new TextDecoder();

  let lukuInfo = null;          // lukk.json sisu (null = lukku pole)
  let valmisLubadus = null;     // Lukk.valmis() tulemus (üks kord)
  let parool = null;            // ainult mälus; teise soolaga faili võtme tuletamiseks
  const votmed = new Map();     // `${salt}|${iter}` -> CryptoKey
  let avamine = null;           // pooleli olev parooliküsimine { promise, resolve }

  if (subtle && location.protocol !== 'file:') document.documentElement.classList.add('lukk-ootel');

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

  function kehtivParameetrid(obj) {
    return typeof obj.salt === 'string' && Number.isInteger(obj.iter) && obj.iter >= MIN_ITER && (obj.kdf === undefined || obj.kdf === KDF);
  }

  async function tuletaVoti(pw, saltB64, iter) {
    const alus = await subtle.importKey('raw', utf8.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
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

  function kehtivKirje(obj) {
    return Boolean(obj) && typeof obj.salt === 'string' && Number.isInteger(obj.iter)
      && Boolean(obj.key) && typeof obj.key === 'object' && obj.key.type === 'secret';
  }

  /** Kustutab aegunud sessioonikirjed (ka teiste, juba suletud vahelehtede omad). */
  function koristaAegunud() {
    const nyyd = Date.now();
    return idb('readwrite', store => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (String(c.key).startsWith('sessioon:') && !(c.value && c.value.aegub > nyyd)) c.delete();
        c.continue();
      };
      return null;
    });
  }

  /** Salvestatud kirje { salt, iter, key, pysiv } (enne püsiv, siis selle vahelehe oma) või null. */
  async function loeSalvestatud() {
    await koristaAegunud();
    const pysiv = await idb('readonly', store => store.get(PYSIV));
    if (kehtivKirje(pysiv)) return { salt: pysiv.salt, iter: pysiv.iter, key: pysiv.key, pysiv: true };
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
    if (pysiv) return idb('readwrite', store => store.put({ salt: info.salt, iter: info.iter, key: voti }, PYSIV));
    const id = sessiooniId(true);
    if (!id) return Promise.resolve();   // sessionStorage keelatud: võti jääb ainult mällu
    return idb('readwrite', store => store.put(
      { salt: info.salt, iter: info.iter, key: voti, aegub: Date.now() + SESSIOONI_AEG_MS }, `sessioon:${id}`));
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
  async function laeLukuFail() {
    const response = await fetch(`${LUKU_FAIL}?v=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (!json || json.lukk !== 1 || !kehtivParameetrid(json) || json.kdf !== KDF
        || !json.kontroll || typeof json.kontroll.iv !== 'string' || typeof json.kontroll.ct !== 'string') {
      throw new Error('lukk.json on vigane');
    }
    return json;
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
    if (nahtav && ui.input) {
      ui.input.value = '';
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

  /** Näitab avamisvaadet ja täitub, kui õige parool on sisestatud (võti tuletatud ja kontrollitud). */
  function kysiParool(teade) {
    if (avamine) {
      if (teade) naitaViga(teade);
      return avamine.promise;
    }
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    avamine = { promise, resolve };
    naitaVaadet(true);
    naitaViga(teade || '');
    tooOlek(false);
    return promise;
  }

  async function esitaParool(event) {
    event.preventDefault();
    if (!avamine) return;
    const pw = (ui.input ? ui.input.value : '').trim();
    if (!pw) { naitaViga('Sisesta parool.'); return; }
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
      parool = pw;
      votmed.set(votmeId(lukuInfo.salt, lukuInfo.iter), voti);
      await salvestaVoti(voti, lukuInfo, Boolean(ui.remember && ui.remember.checked));
      lopetaAvamine();
    } catch (error) {
      console.error('Lukk: avamine ebaõnnestus', error);
      tooOlek(false);
      naitaViga(`Avamine ebaõnnestus: ${error.message}`);
    }
  }

  function lopetaAvamine() {
    naitaVaadet(false);
    document.documentElement.classList.remove('lukk-ootel');
    naitaLukustusnupp();
    const a = avamine;
    avamine = null;
    if (a) a.resolve();
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
    parool = null;
    await unustaSalvestatud(true);
    location.reload();
  }

  /* ---------- võtme hankimine ja ümbriku avamine ---------- */
  /** Võti antud soola ja iteratsioonidega: vahemälust, mälus olevast paroolist või küsides parooli uuesti. */
  async function hangiVoti(salt, iter, teade) {
    const id = votmeId(salt, iter);
    if (votmed.has(id)) return votmed.get(id);
    if (parool) {
      const voti = await tuletaVoti(parool, salt, iter);
      votmed.set(id, voti);
      return voti;
    }
    await kysiParool(teade);
    if (votmed.has(id)) return votmed.get(id);
    if (!parool) throw new Error('lukk eemaldati avamise ajal, laadi leht uuesti');
    // parool sisestati lukk.json-i soolaga; see fail kasutab teist soola (nt parooli vahetus pooleli)
    const voti = await tuletaVoti(parool, salt, iter);
    votmed.set(id, voti);
    return voti;
  }

  async function avaUmbrik(umbrik) {
    if (!kehtivParameetrid(umbrik)) throw new Error('krüpteeritud faili parameetrid on vigased');
    if (!subtle) throw new Error('brauser ei toeta WebCrypto-t (vaja on HTTPS-i)');
    let voti = await hangiVoti(umbrik.salt, umbrik.iter);
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
      parool = null;
      await unustaSalvestatud(false);
      lukuInfo = info || lukuInfo;
      voti = await hangiVoti(umbrik.salt, umbrik.iter, 'Parool on vahetatud. Sisesta uus parool.');
      return dekrypteeri(voti, umbrik.iv, umbrik.ct);
    }
  }

  /* ---------- avalik liides ---------- */
  async function kaivita() {
    if (!subtle || location.protocol === 'file:') {
      // file:// või ebaturvaline kontekst: andmefaile nagunii ei loeta, lukk jääb vahele
      document.documentElement.classList.remove('lukk-ootel');
      return false;
    }
    if (ui.form && !ui.form.dataset.lukkReady) {
      ui.form.dataset.lukkReady = '1';
      ui.form.addEventListener('submit', esitaParool);
    }
    for (;;) {
      try {
        lukuInfo = await laeLukuFail();
        break;
      } catch (error) {
        console.error('Lukk: lukk.json laadimine ebaõnnestus', error);
        // Ilma lukufailita ei tea leht, kas ta on lukus: näita vaadet veateatega, nupp proovib uuesti
        const uuesti = new Promise(r => {
          const form = ui.form;
          const handler = e => { e.preventDefault(); form.removeEventListener('submit', handler, true); r(); };
          if (form) form.addEventListener('submit', handler, true);
          else setTimeout(r, 5000);
        });
        naitaVaadet(true);
        tooOlek(false, 'Proovi uuesti');
        if (ui.input) ui.input.disabled = true;
        naitaViga(`Lehe oleku kontroll ebaõnnestus (${error.message}). Kontrolli internetiühendust.`);
        await uuesti;
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
        // Ülekolimine või sessioonikirje aegumise edasilükkamine (12 h viimasest kasutusest)
        if (salvestatud === vana || !salvestatud.pysiv) await kirjutaKirje(salvestatud.key, lukuInfo, salvestatud.pysiv);
        lopetaAvamine();
        return true;
      }
      await unustaSalvestatud(false);
      await kysiParool('Parool on vahetatud. Sisesta uus parool.');
      return true;
    }
    if (salvestatud) await unustaSalvestatud(false);
    await kysiParool();
    return true;
  }

  function valmis() {
    if (!valmisLubadus) valmisLubadus = kaivita();
    return valmisLubadus;
  }

  /** fetch(), mis avab krüpteeritud ümbriku; tavaline (krüpteerimata) vastus tagastatakse muutmata. */
  async function lukkFetch(url, valikud) {
    const response = await fetch(url, valikud);
    if (!response.ok) return response;
    const tekst = await response.text();
    const paised = { 'Content-Type': response.headers.get('Content-Type') || 'application/json' };
    let json = null;
    try { json = JSON.parse(tekst); } catch (error) { json = null; }
    if (!onUmbrik(json)) return new Response(tekst, { status: response.status, statusText: response.statusText, headers: paised });
    await valmis();
    const tavatekst = await avaUmbrik(json);
    return new Response(tavatekst, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  global.Lukk = { valmis, fetch: lukkFetch, lukusta, get lukus() { return Boolean(lukuInfo); } };
})(window);
