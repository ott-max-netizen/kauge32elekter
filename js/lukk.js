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
 *   Lukk.lukusta()           – unustab salvestatud võtme ja laeb lehe uuesti (jaluse nupp „Lukusta leht“)
 *
 * Failid: lukk.json {lukk, kdf, iter, salt, kontroll:{iv, ct}} – sool ja parooli kontrollväärtus
 *         (kontroll = AES-GCM(võti, "kauge32-lukk")); puudumine (404) tähendab, et lehel pole lukku.
 *         Andmefail  {lukk, kdf, iter, salt, iv, ct}.
 * Võti (mitte parool) hoitakse sessionStorage'is (vaikimisi) või „Jäta meelde“ korral localStorage'is võtme
 * kauge32_lukk all; parool ise jääb lehe sulgemiseni ainult mällu (teise soolaga faili jaoks).
 * Skript laaditakse <head>-is ilma defer'ita, et globaal Lukk oleks lehe skriptile olemas ja .app saaks
 * peita enne esimest joonistamist.
 */
(function (global) {
  'use strict';

  const LUKU_FAIL = 'lukk.json';
  const SALVESTUS = 'kauge32_lukk';
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

  function b64e(bytes) {
    let bin = '';
    for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
    return btoa(bin);
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
      alus, { name: 'AES-GCM', length: 256 }, true, ['decrypt']
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

  function salvestus(pysiv) {
    try { return pysiv ? global.localStorage : global.sessionStorage; } catch (error) { return null; }
  }

  function loeSalvestatud() {
    for (const pysiv of [true, false]) {
      try {
        const raw = salvestus(pysiv) && salvestus(pysiv).getItem(SALVESTUS);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.salt === 'string' && Number.isInteger(obj.iter) && typeof obj.key === 'string') return obj;
        }
      } catch (error) { /* salvestusruum keelatud või vigane kirje */ }
    }
    return null;
  }

  function unustaSalvestatud() {
    for (const pysiv of [true, false]) {
      try { salvestus(pysiv) && salvestus(pysiv).removeItem(SALVESTUS); } catch (error) { /* ignoreeri */ }
    }
  }

  async function salvestaVoti(voti, info, pysiv) {
    unustaSalvestatud();
    try {
      const raw = await subtle.exportKey('raw', voti);
      const s = salvestus(pysiv);
      if (s) s.setItem(SALVESTUS, JSON.stringify({ salt: info.salt, iter: info.iter, key: b64e(raw) }));
    } catch (error) { /* salvestusruum keelatud: küsitakse järgmisel laadimisel uuesti */ }
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

  function lukusta() {
    unustaSalvestatud();
    votmed.clear();
    parool = null;
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
      // Võti ei sobi: parool on vahetatud (salvestatud võti on vana) – küsi uuesti ja proovi veel üks kord
      votmed.delete(votmeId(umbrik.salt, umbrik.iter));
      parool = null;
      unustaSalvestatud();
      lukuInfo = await laeLukuFail().catch(() => lukuInfo);
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
    const salvestatud = loeSalvestatud();
    if (salvestatud && salvestatud.salt === lukuInfo.salt && salvestatud.iter === lukuInfo.iter) {
      try {
        const voti = await subtle.importKey('raw', b64d(salvestatud.key), { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
        if (await kontrolliVoti(voti, lukuInfo)) {
          votmed.set(votmeId(lukuInfo.salt, lukuInfo.iter), voti);
          lopetaAvamine();
          return true;
        }
      } catch (error) { /* vigane salvestatud võti: küsi parool */ }
      unustaSalvestatud();
      await kysiParool('Parool on vahetatud. Sisesta uus parool.');
      return true;
    }
    if (salvestatud) unustaSalvestatud();
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
