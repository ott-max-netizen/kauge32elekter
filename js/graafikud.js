/* Kauge 32 · Graafikud (graafikud.html) – lehe põhiskript.
 * Lehe seaded (CONFIG) on HTML-is plokis <script type="text/plain" id="lehe-config">: haldaja muudab neid seal (README
 * „Seadete muutmine“) ja need loetakse ilma eval-ita (readPageConfig, js/common.js). Skript on failis, sest turvapoliitika
 * lubab ainult samalt saidilt laaditud skripte (script-src 'self', README „Turvalisus“). Muutmisel suurenda HTML-i lingis ?v=.
 */
'use strict';

const CONFIG = readPageConfig();

const APP_VERSION = '1.6.0';
const BATTERY_IDLE_KW = 0.2;     // väiksem aku võimsus = „ootel“ (hoidevool), nagu energialehel
const TARIFF_KEYS = ['marginaal', 'vorgutasuPaev', 'vorgutasuOo', 'taastuvenergiaTasu', 'aktsiis', 'kaibemaks', 'algus', 'lopp'];
const MAX_PERIOD_MINUTES = 60;   // common.js nõue (pikim hinnaperiood)

/* ==========================================================================
   2. Olek
   ========================================================================== */
const state = {
  loadedAt: 0,
  vat: 1 + CONFIG.kaibemaks / 100,
  prices: [],        // [{ t (ms), end (ms), spot (börsihind s/kWh ilma KM-ta) }]
  tariffs: null,     // hinnad.json meta.tariffs (töövoo kasutatud index.html CONFIG): tasud s/kWh ilma KM-ta, KM %, öötariif
  tariffChanges: [], // hinnad.json meta.tariffChanges (index.html CONFIG.hinnamuudatused): kuupäevast kehtivad tasud
  realTime: null,    // paike.json realTime: aku laetus ja võimsus praegu
  frames: [],        // [{ t, pv, load, buy } kW]
  days: [],          // paevad.json kirjed (noData-ta), kuupäeva järgi
  months: [],        // hinnad.json majaElekter (noData-ta)
  errors: {},        // { prices, solar, days }: veateade
  generated: {},     // faili generatedAt (Date)
  charts: new Map(), // canvas.id -> Chart
  drawn: new Set(),  // kaardid, mis on vaates olnud (nende graafik joonistatakse/uuendatakse)
  priceDay: 0,
  priceRes: window.matchMedia && window.matchMedia('(max-width: 767px)').matches ? 60 : 15,   // telefonis 1 h, arvutis 15 min
  powerDay: 0,
  batteryDay: 0,
  daysRange: 30,
  monthsMetric: 'kwh',
  theme: 'auto',
  instant: false     // true = joonista ilma animatsioonita (teema vahetus)
};
const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* ==========================================================================
   3. Aeg ja vormindamine (ühised Tallinna aja funktsioonid on js/common.js-is)
   ========================================================================== */
/** Tallinna seinakella aeg UTC hetkeks (common.js getTallinnDayStart vajab seda). */
function tallinnLocalToUtc(year, month, day, hour = 0, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wall - tallinnOffsetMs(new Date(wall));
  utc = wall - tallinnOffsetMs(new Date(utc));
  return new Date(utc);
}
function dayKey(date) {
  const p = getTallinnDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
const NF = {
  d0: new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0, useGrouping: 'always' }),
  d1: new Intl.NumberFormat('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' }),
  d2: new Intl.NumberFormat('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }),
  pct: new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 })
};
const monthShort = new Intl.DateTimeFormat('et-EE', { timeZone: 'UTC', month: 'short' });
const dateTimeShort = new Intl.DateTimeFormat('et-EE', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtKwh = v => `${NF.d0.format(v)} kWh`;
const fmtEur = v => `${NF.d2.format(v)} €`;
const fmtCents = v => `${NF.d2.format(v)} s/kWh`;
const hh = date => String(getTallinnDateParts(date).hour).padStart(2, '0');
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* ==========================================================================
   4. Andmed
   ========================================================================== */
async function loadJson(file) {
  const response = await Lukk.fetch(`${file}?v=${Date.now()}`, { cache: 'no-store' });   // avab krüpteeritud faili (js/lukk.js)
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!json || json.success !== true || !json.data) throw new Error('success !== true või data puudub');
  return json;
}

/** hinnad.json: börsihinnad (s/kWh ilma KM-ta), tasud meta.tariffs-ist ja maja üldelektri kuud. */
function readPrices(json) {
  const t = json.meta && json.meta.tariffs && typeof json.meta.tariffs === 'object' ? json.meta.tariffs : null;
  state.tariffs = t && TARIFF_KEYS.every(k => num(t[k]) != null) ? {
    marginaal: t.marginaal, vorgutasuPaev: t.vorgutasuPaev, vorgutasuOo: t.vorgutasuOo, taastuvenergiaTasu: t.taastuvenergiaTasu,
    aktsiis: t.aktsiis, kaibemaks: t.kaibemaks, algus: t.algus, lopp: t.lopp,
    tasakaalustamisTasu: num(t.tasakaalustamisTasu) ?? 0,
    varustuskindlusTasu: num(t.varustuskindlusTasu) ?? 0,  // vanemas failis on see taastuvenergiaTasu sees   // puudub vanemas hinnad.json-is (enne töövoo CALC_VERSION 5) -> 0
    nadalavahetusOnOo: t.nadalavahetusOnOo !== false, riigipuhadOnOo: t.riigipuhadOnOo !== false
  } : null;
  state.tariffChanges = state.tariffs ? normalizeTariffChanges(json.meta.tariffChanges, state.tariffs) : [];
  const vatPct = t && num(t.kaibemaks) != null && t.kaibemaks >= 0 && t.kaibemaks < 100 ? t.kaibemaks : CONFIG.kaibemaks;
  state.vat = 1 + vatPct / 100;
  const rows = (Array.isArray(json.data.ee) ? json.data.ee : [])
    .filter(r => r && Number.isInteger(r.timestamp) && num(r.price) != null)
    .sort((a, b) => a.timestamp - b.timestamp);
  state.prices = rows.map((r, i) => {
    const t0 = r.timestamp * 1000;
    const next = rows[i + 1] ? rows[i + 1].timestamp * 1000 : null;
    const step = next && next - t0 <= HOUR_MS ? next - t0 : 15 * MINUTE_MS;   // puuduv periood ei pikenda eelmist
    return { t: t0, end: t0 + step, spot: r.price / 10 };
  });
  state.months = (Array.isArray(json.data.majaElekter) ? json.data.majaElekter : [])
    .filter(m => m && typeof m.kuu === 'string' && /^\d{4}-\d{2}$/.test(m.kuu) && !m.noData && num(m.kwh) != null);
}

/** paike.json: 15-min kaadrid (kW; aku laadimine ja tühjenemine absoluutväärtusena) ja hetkeseis (realTime). */
function readSolar(json) {
  const kw = v => (num(v) != null ? v / 1000 : null);
  const abs = v => (num(v) != null ? Math.abs(v) / 1000 : null);
  state.frames = (Array.isArray(json.data.frames) ? json.data.frames : [])
    .filter(f => f && num(f.dateTime) != null)
    .map(f => ({
      t: (f.dateTime > 1e11 ? f.dateTime : f.dateTime * 1000),
      pv: kw(f.generationPower),
      load: kw(f.usePower),
      buy: kw(f.purchasePower),
      charge: abs(f.chargePower),        // kaadrites laadimisel positiivne (README „Märgid ja väljad“)
      discharge: abs(f.dischargePower),
      soc: num(f.batterySoc)
    }))
    .sort((a, b) => a.t - b.t);
  const rt = json.data.realTime && typeof json.data.realTime === 'object' ? json.data.realTime : null;
  const updated = num(json.data.lastUpdateTime);
  state.realTime = rt ? {
    soc: num(rt.batterySoc),
    kw: ((abs(rt.chargePower) || 0) - (abs(rt.dischargePower) || 0)),   // + laeb, − tühjeneb (realTime chargePower on laadimisel negatiivne)
    updated: updated != null ? new Date(updated > 1e11 ? updated : updated * 1000) : null
  } : null;
}

function readDays(json) {
  state.days = (Array.isArray(json.data.days) ? json.data.days : [])
    .filter(r => r && typeof r.paev === 'string' && !r.noData)
    .sort((a, b) => (a.paev < b.paev ? -1 : 1));
}

async function loadAll() {
  setStatus('Andmete laadimine…');
  const [prices, solar, days] = await Promise.allSettled([loadJson(CONFIG.hinnafail), loadJson(CONFIG.paikefail), loadJson(CONFIG.paevadeFail)]);
  const take = (key, result, reader, label) => {
    if (result.status === 'fulfilled') {
      reader(result.value);
      state.errors[key] = null;
      state.generated[key] = result.value.generatedAt ? new Date(result.value.generatedAt) : null;
    } else {
      console.error(`${label} laadimine ebaõnnestus:`, result.reason);
      state.errors[key] = `${label} ei õnnestunud laadida.`;
    }
  };
  take('prices', prices, readPrices, 'Hinnaandmeid (hinnad.json)');
  take('solar', solar, readSolar, 'Päikeseandmeid (paike.json)');
  take('days', days, readDays, 'Päevakokkuvõtteid (paevad.json)');
  state.loadedAt = Date.now();
  const parts = [];
  if (state.generated.prices) parts.push(`hinnad ${dateTimeShort.format(state.generated.prices)}`);
  if (state.generated.solar) parts.push(`päike ${dateTimeShort.format(state.generated.solar)}`);
  if (state.generated.days) parts.push(`päevad ${dateTimeShort.format(state.generated.days)}`);
  setStatus(parts.length ? `Andmed: ${parts.join(' · ')}` : 'Andmeid ei õnnestunud laadida.');
  renderKpis();
  for (const id of state.drawn) drawSection(id);
}

function setStatus(text) {
  const status = byId('status');
  if (status.textContent !== text) status.textContent = text;
}

/** Lõppenud päevade kirjed: viimased n Tallinna päeva enne tänast (puuduv päev = null). */
function lastDays(n) {
  const now = new Date();
  const byKey = new Map(state.days.map(r => [r.paev, r]));
  const out = [];
  for (let i = n; i >= 1; i--) {
    const date = getTallinnDayStart(now, -i);
    const key = dayKey(date);
    out.push({ key, date, rec: byKey.get(key) || null });
  }
  return out;
}
const sumOf = (list, field) => {
  let total = 0;
  let count = 0;
  for (const r of list) {
    const v = r ? num(r[field]) : null;
    if (v != null) { total += v; count++; }
  }
  return count ? { total, count } : null;
};

/** Võrgutariif Tallinna aja järgi: 'oo' | 'paev' (sama reegel mis index.html getNetworkTariff: öötunnid, nädalavahetus, riigipühad). */
function networkTariff(date) {
  const r = state.tariffs;
  const p = getTallinnDateParts(date);
  if (r.nadalavahetusOnOo && (p.weekday === 0 || p.weekday === 6)) return 'oo';
  if (r.riigipuhadOnOo && isPublicHoliday(p.year, p.month, p.day)) return 'oo';
  const hour = p.hour + p.minute / 60;
  const start = Number(r.algus);
  const end = Number(r.lopp);
  return (start > end ? (hour >= start || hour < end) : (hour >= start && hour < end)) ? 'oo' : 'paev';
}

/** Perioodi hind s/kWh koos KM-ga (index.html calculateFinalPrice): börsihind + marginaal + võrgutasu + taastuvenergia-
 *  ja varustuskindluse tasu + aktsiis + tasakaalustamisvõimsuse kulu, KM kogu summale; kuutasud pole sees. Tasudeta (vana fail) ainult börsihind KM-ga. */
function priceParts(spot, date) {
  if (!state.tariffs) return { spot: spot * state.vat, fees: 0, total: spot * state.vat, tariff: null };
  const f = tariffsAt(state.tariffs, state.tariffChanges, date);
  const tariff = networkTariff(date);
  const fees = f.marginaal + (tariff === 'oo' ? f.vorgutasuOo : f.vorgutasuPaev) + f.taastuvenergiaTasu + f.varustuskindlusTasu + f.aktsiis + f.tasakaalustamisTasu;
  return { spot: spot * state.vat, fees: fees * state.vat, total: (spot + fees) * state.vat, tariff };
}

/** Ühe Tallinna päeva hinnaperioodid: 15 min (nagu andmetes) või tunni kaupa (kestusega kaalutud keskmine). */
function pricePeriods(dayOffset, resolution) {
  const now = new Date();
  const start = getTallinnDayStart(now, dayOffset).getTime();
  const end = getTallinnDayStart(now, dayOffset + 1).getTime();
  const rows = state.prices.filter(p => p.t >= start && p.t < end).map(p => ({ t: p.t, end: p.end, ...priceParts(p.spot, new Date(p.t)) }));
  if (resolution !== 60) return rows;
  const hours = new Map();
  for (const r of rows) {
    const h = Math.floor(r.t / HOUR_MS) * HOUR_MS;   // Tallinna nihe on täistundides: UTC tund = kohalik tund
    const acc = hours.get(h) || { t: h, end: h + HOUR_MS, spot: 0, fees: 0, total: 0, min: 0, tariff: r.tariff };
    const minutes = (r.end - r.t) / MINUTE_MS;
    acc.spot += r.spot * minutes;
    acc.fees += r.fees * minutes;
    acc.total += r.total * minutes;
    acc.min += minutes;
    hours.set(h, acc);
  }
  return [...hours.values()].sort((a, b) => a.t - b.t)
    .map(a => ({ t: a.t, end: a.end, spot: a.spot / a.min, fees: a.fees / a.min, total: a.total / a.min, tariff: a.tariff }));
}

/** Kestusega kaalutud keskmine lõpphind. */
function averageTotal(items) {
  let sum = 0;
  let minutes = 0;
  for (const i of items) { const m = (i.end - i.t) / MINUTE_MS; sum += i.total * m; minutes += m; }
  return minutes ? sum / minutes : null;
}

/* ==========================================================================
   5. Animatsioonid ja Chart.js-i seadistus (teistel lehtedel on graafikud tahtlikult animatsioonita; see leht on
      ülevaateleht ja animeerib, kuid mitte vähendatud liikumise eelistusega)
   ========================================================================== */
let C = null;   // värvid tokenitest: chartTokens() (common.js) + lehe tuletised

function colors() {
  const t = chartTokens();
  const alpha = (color, a) => {
    const rgb = parseColor(color);
    return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : color;
  };
  return Object.assign(t, {
    alpha,
    surface: t.css('var(--surface)'),
    border: t.css('var(--border)'),
    avgLine: t.css('var(--avg-line)') || t.muted
  });
}

function setupChartDefaults() {
  if (typeof Chart === 'undefined') {
    for (const box of document.querySelectorAll('.chart-box')) {
      box.replaceChildren(el('p', { class: 'chart-box__fallback', text: 'Graafikut ei saanud laadida (Chart.js puudub).' }));
    }
    return false;
  }
  C = colors();
  Chart.defaults.font.family = C.font;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = C.muted;
  Chart.defaults.borderColor = C.hairline;
  return true;
}

const motion = () => !state.instant && !reducedMotion.matches;

/** Tulpade sisenemine: kasvavad alusjoonest vasakult paremale lainena. */
function barAnimation(step = 22) {
  if (!motion()) return false;
  return {
    duration: 700,
    easing: 'easeOutQuart',
    delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * step : 0)
  };
}

/** Joon joonistub vasakult paremale (Chart.js „progressive line“): iga punkt algab eelmise punkti kõrguselt. */
function lineAnimations(points, total = 1200) {
  if (!motion()) return {};
  const between = total / Math.max(1, points);
  const previousY = ctx => {
    if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(0);
    const prev = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1];
    return prev ? prev.getProps(['y'], true).y : ctx.chart.scales.y.getPixelForValue(0);
  };
  return {
    x: { type: 'number', easing: 'linear', duration: between, from: NaN,
      delay(ctx) { if (ctx.type !== 'data' || ctx.xStarted) return 0; ctx.xStarted = true; return ctx.index * between; } },
    y: { type: 'number', easing: 'linear', duration: between, from: previousY,
      delay(ctx) { if (ctx.type !== 'data' || ctx.yStarted) return 0; ctx.yStarted = true; return ctx.index * between; } }
  };
}

/** Ühine tooltip: 13 px kiri, joonte rida joonevõtmega, tulpade rida ristkülikuga (nagu legendis). */
function tooltip(extra = {}) {
  const callbacks = Object.assign({
    labelPointStyle: ctx => ({ pointStyle: (ctx.dataset.type || ctx.chart.config.type) === 'line' ? 'line' : 'rectRounded', rotation: 0 })
  }, extra.callbacks || {});
  return Object.assign({
    enabled: true,
    backgroundColor: C.surface,
    titleColor: C.text,
    bodyColor: C.text,
    footerColor: C.muted,
    borderColor: C.border,
    borderWidth: 1,
    padding: 12,
    cornerRadius: 10,
    boxPadding: 6,
    boxWidth: 12,
    boxHeight: 12,
    usePointStyle: true,
    titleFont: { size: 13, weight: '700' },
    bodyFont: { size: 13 },
    footerFont: { size: 12, weight: '500' },
    titleMarginBottom: 6,
    footerMarginTop: 6,
    caretSize: 6
  }, extra, { callbacks });
}

function axis(extra = {}) {
  return Object.assign({
    grid: { color: C.hairline, drawTicks: false },
    border: { display: false },
    ticks: { color: C.muted, padding: 6 }
  }, extra);
}

const LINE_W = 2;                 // joone paksus (px)
const PAD_TOP = 22;               // plot-ala kohal ruum ühikule ja siltidele

/** Tekst halo-ga (plot-ala värvi kontuur), et see oleks loetav ka tulpade ja joonte peal. */
function haloLabel(ctx, text, x, y, color, weight = 600) {
  ctx.font = `${weight} 12px ${C.font}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.plot;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Telje ühik plot-ala kohal vasakul (options.plugins.unitLabel.text, nt „s/kWh“); vajab layout.padding.top. */
const UNIT_PLUGIN = {
  id: 'unitLabel',
  afterDraw(chart, args, opts) {
    if (!opts || !opts.text) return;
    const { ctx, chartArea: a } = chart;
    const y = chart.scales.y;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    haloLabel(ctx, opts.text, y ? y.left : a.left, a.top - 8, C.muted);
    ctx.restore();
  }
};

/** Hinnagraafiku otsesildid: päeva keskmine joone paremas otsas, siis praegu / kalleim / odavaim tulba kohal
 *  (prioriteedi järjekorras; kattuv madalama prioriteediga silt jääb ära – väärtus on ka tooltipis ja aria-label'is). */
const PRICE_LABELS = {
  id: 'priceLabels',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts || !opts.items) return;
    const { ctx, chartArea: a } = chart;
    const boxes = [];
    const free = box => !boxes.some(b => box.x0 < b.x1 + 4 && box.x1 + 4 > b.x0 && box.y0 < b.y1 + 2 && box.y1 + 2 > b.y0);
    ctx.save();
    ctx.textBaseline = 'bottom';
    if (opts.avg != null) {
      ctx.font = `600 12px ${C.font}`;
      const text = opts.avgText;
      const w = ctx.measureText(text).width;
      const py = chart.scales.y.getPixelForValue(opts.avg) - 4;
      const box = { x0: a.right - w, x1: a.right, y0: py - 14, y1: py };
      ctx.textAlign = 'right';
      haloLabel(ctx, text, a.right, py, C.muted);
      boxes.push(box);
    }
    const meta = chart.getDatasetMeta(opts.topDataset);
    for (const item of opts.items) {
      const bar = meta.data[item.index];
      if (!bar) continue;
      const { x, y } = bar.getProps(['x', 'y']);
      ctx.font = `700 12px ${C.font}`;
      const w = ctx.measureText(item.text).width;
      const x0 = Math.min(Math.max(x - w / 2, a.left), a.right - w);
      const py = Math.max(y - 6, a.top + 12);
      const box = { x0, x1: x0 + w, y0: py - 14, y1: py };
      if (!free(box)) continue;
      ctx.textAlign = 'left';
      haloLabel(ctx, item.text, x0, py, C.text, 700);
      boxes.push(box);
    }
    ctx.restore();
  }
};

/** Aku võimsuse graafiku suunasildid plot-ala sees: „laeb ↑“ üleval ja „tühjeneb ↓“ all (kui tühjenemist on). */
const BAT_LABELS = {
  id: 'batLabels',
  afterDraw(chart) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    ctx.save();
    ctx.textAlign = 'left';
    if (y.max > 0) { ctx.textBaseline = 'top'; haloLabel(ctx, 'laeb ↑', a.left + 6, a.top + 4, C.muted); }
    if (y.min < 0) { ctx.textBaseline = 'bottom'; haloLabel(ctx, 'tühjeneb ↓', a.left + 6, a.bottom - 4, C.muted); }
    ctx.restore();
  }
};

/** x-telje sildid 15-min andmetel ainult täistundidel: iga 2 h, kitsal graafikul (< 560 px) iga 3 h. */
function hourTicks(times) {
  return {
    color: C.muted, maxRotation: 0, autoSkip: false, padding: 6,
    callback(value, index) {
      const t = times[index];
      if (t == null) return null;
      const p = getTallinnDateParts(new Date(t));
      if (p.minute !== 0) return null;
      return p.hour % (this.chart.width < 560 ? 3 : 2) === 0 ? String(p.hour).padStart(2, '0') : null;
    }
  };
}

/** y-telje ühtne laius (aku kaks graafikut üksteise all: plot-alad algavad samast kohast). */
const fixedYWidth = width => scale => { scale.width = width; };

/** Teksti värv ploki sees: valge või peaaegu must, kumb on täite peal kontrastsem (WCAG suhteline heledus). */
function onFill(color) {
  const rgb = parseColor(color);
  if (!rgb) return '#ffffff';
  const lin = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return (1.05) / (L + 0.05) >= (L + 0.05) / (0.0137 + 0.05) ? '#ffffff' : '#0b1220';
}

let measureCtx = null;
function textWidth(text, font) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/** Püstine ala-gradient (ülal toonis, all läbipaistev). */
function areaGradient(color, top = 0.35) {
  return ctx => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return C.alpha(color, top / 2);
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, C.alpha(color, top));
    g.addColorStop(1, C.alpha(color, 0));
    return g;
  };
}

/** Loob graafiku või uuendab olemasolevat (sama tüüp): uuendus animeerib tulbad uutele väärtustele. */
function upsert(id, config, recreate = false) {
  const canvas = byId(id);
  const existing = state.charts.get(id);
  if (existing && !recreate && existing.config.type === config.type) {
    existing.data.labels = config.data.labels;
    existing.data.datasets.forEach((ds, i) => Object.assign(ds, config.data.datasets[i]));
    if (existing.data.datasets.length !== config.data.datasets.length) existing.data.datasets = config.data.datasets;
    existing.options = config.options;
    existing.update();
    return existing;
  }
  if (existing) existing.destroy();
  const chart = new Chart(canvas, config);
  state.charts.set(id, chart);
  return chart;
}

/** Kaardi teade (andmed puuduvad või laadimine ebaõnnestus); null eemaldab selle. */
function cardNotice(sectionId, text) {
  const section = byId(sectionId);
  const box = section.querySelector(':scope > .chart-box, :scope > .mix');
  let notice = section.querySelector(':scope > .notice');
  for (const node of section.querySelectorAll(':scope > .chart-box, :scope > .legend, :scope > .mix')) node.hidden = Boolean(text);
  if (!text) { if (notice) notice.remove(); return; }
  if (!notice) {
    notice = el('p', { class: 'notice' });
    box.before(notice);
  }
  notice.textContent = text;
}

/** Plaadi number loendab nullist (~0,9 s): „<väärtus> <small>ühik</small>“. Loendamise ajal tabelnumbrid (ei värise),
 *  lõppväärtus proportsionaalsete numbritega. Uus kutse katkestab sama plaadi eelmise loendamise. */
function countUp(node, value, format, unit = '') {
  const token = (node.$count = (node.$count || 0) + 1);
  const paint = v => node.replaceChildren(format(v), ...(unit ? [el('small', { text: ` ${unit}` })] : []));
  if (value == null) { delete node.dataset.count; node.textContent = '—'; return; }
  if (!motion()) { delete node.dataset.count; paint(value); return; }
  node.dataset.count = '1';
  const t0 = performance.now();
  const duration = 900;
  const step = now => {
    if (node.$count !== token) return;
    const p = Math.min(1, (now - t0) / duration);
    paint(value * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
    else delete node.dataset.count;
  };
  requestAnimationFrame(step);
}

function renderKpis() {
  const nowMs = Date.now();
  const row = state.prices.find(p => p.t <= nowMs && nowMs < p.end);
  const current = row ? priceParts(row.spot, new Date(row.t)) : null;
  countUp(byId('kpi-price'), current ? current.total : null, v => NF.d2.format(v), 's/kWh');
  byId('kpi-price-sub').textContent = current
    ? (state.tariffs ? `börsihind ${NF.d2.format(current.spot)} + tasud ${NF.d2.format(current.fees)}` : 'börsihind KM-ga (tasusid ei leitud)')
    : (state.errors.prices || '');

  const recs = lastDays(CONFIG.kokkuvotePaevi).map(d => d.rec).filter(Boolean);
  const pv = sumOf(recs, 'pvKwh');
  const pvEur = sumOf(recs, 'pvEur');
  const gain = sumOf(recs, 'batteryGainEur');
  const load = sumOf(recs, 'loadKwh');
  const imp = sumOf(recs, 'importKwh');
  countUp(byId('kpi-solar'), pv ? pv.total : null, v => NF.d0.format(v), 'kWh');
  byId('kpi-solar-sub').textContent = pvEur ? `väärtus ≈ ${fmtEur(pvEur.total)}` : (state.errors.days || '');
  countUp(byId('kpi-battery'), gain ? gain.total : null, v => NF.d2.format(v), '€');
  byId('kpi-battery-sub').textContent = gain ? `${gain.count} päeva andmetest` : (state.errors.days || '');
  countUp(byId('kpi-load'), load ? load.total : null, v => NF.d0.format(v), 'kWh');
  byId('kpi-load-sub').textContent = imp ? `võrgust ostetud ${fmtKwh(imp.total)}` : '';
}

/* ==========================================================================
   7. Graafikud
   ========================================================================== */
/** Elektri hind: börsihind (all) + tasud (heledam, üleval) ühe tulbana, mõlemad KM-ga; värv päeva odavaimast (roheline)
 *  kalleimani (punane) lõpphinna järgi; möödunud perioodid tuhmid, praegune raamiga; 1 h või 15 min. */
function drawPrice() {
  const available = d => state.prices.length > 0 && pricePeriods(d, 60).length > 0;
  byId('price-yesterday').disabled = !available(-1);
  byId('price-tomorrow').disabled = !available(1);
  if (state.priceDay !== 0 && !available(state.priceDay)) { state.priceDay = 0; byId('price-today').checked = true; }
  byId(state.priceRes === 60 ? 'price-60' : 'price-15').checked = true;
  const notes = [];
  if (!available(1)) notes.push('homsed hinnad alates ~15:00');
  if (state.prices.length && !state.tariffs) notes.push('tasusid ei leitud (hinnad.json meta.tariffs): näidatakse börsihinda KM-ga');
  byId('price-note').textContent = notes.join(' · ');
  byId('price-hint').textContent = state.tariffs || !state.prices.length ? 'koos tasude ja KM-ga' : 'börsihind KM-ga';
  const items = pricePeriods(state.priceDay, state.priceRes);
  if (!items.length) { cardNotice('section-price', state.errors.prices || 'Selle päeva hindu pole.'); return; }
  cardNotice('section-price', null);
  const totals = items.map(i => i.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const avg = averageTotal(items);
  const nowMs = Date.now();
  const tone = v => {
    const s = max > min ? (v - min) / (max - min) : 0.5;
    return s < 0.5 ? mixColor(C.cat.kollane, C.cat.roheline, s * 2) : mixColor(C.cat.punane, C.cat.kollane, (s - 0.5) * 2);
  };
  const isNow = i => i.t <= nowMs && nowMs < i.end;
  const isPast = i => i.end <= nowMs;
  const hourly = state.priceRes === 60;
  const timeOf = ms => (hourly ? `${hh(new Date(ms))}:00` : timeFormatter.format(new Date(ms)));
  const labels = items.map(i => (hourly ? hh(new Date(i.t)) : timeFormatter.format(new Date(i.t))));
  const border = items.map(i => (isNow(i) ? C.text : 'transparent'));
  const borderWidth = items.map(i => (isNow(i) ? 2 : 0));
  const cheapest = items[totals.indexOf(min)];
  const dearest = items[totals.indexOf(max)];
  const dayName = { '-1': 'eile', 0: 'täna', 1: 'homme' }[state.priceDay];
  byId('c-price').setAttribute('aria-label', `Elektri hind ${state.tariffs ? 'koos tasude ja KM-ga ' : ''}${dayName}: odavaim ${timeOf(cheapest.t)} ${fmtCents(min)}, kalleim ${timeOf(dearest.t)} ${fmtCents(max)}, keskmine ${fmtCents(avg)}.`);
  const radiusTop = { topLeft: hourly ? 4 : 2, topRight: hourly ? 4 : 2, bottomLeft: 0, bottomRight: 0 };
  // Otsesildid (prioriteedi järjekorras): praegu, kalleim, odavaim; keskmine joone otsas
  const nowIndex = items.findIndex(isNow);
  const labelItems = [];
  if (nowIndex >= 0) labelItems.push({ index: nowIndex, text: `praegu ${NF.d2.format(items[nowIndex].total)}` });
  labelItems.push({ index: totals.indexOf(max), text: `kalleim ${NF.d2.format(max)}` });
  labelItems.push({ index: totals.indexOf(min), text: `odavaim ${NF.d2.format(min)}` });
  const seen = new Set();
  const priceLabels = labelItems.filter(l => (seen.has(l.index) ? false : seen.add(l.index)));
  // 2 px pind börsihinna ja tasude vahel (tasude ploki alumine serv plot-ala värvi); praegune periood raamiga
  const feeBorder = items.map(i => (isNow(i) ? { top: 2, left: 2, right: 2, bottom: 2 } : { top: 0, left: 0, right: 0, bottom: 2 }));
  const feeBorderColor = items.map(i => (isNow(i) ? C.text : C.plot));
  upsert('c-price', {
    type: 'bar',
    plugins: [UNIT_PLUGIN, PRICE_LABELS],
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Börsihind', stack: 'hind', data: items.map(i => i.spot),
          backgroundColor: items.map(i => (isPast(i) ? C.mix(tone(i.total), 0.55) : tone(i.total))), hoverBackgroundColor: items.map(i => tone(i.total)),
          borderColor: border, borderWidth, borderSkipped: 'end', borderRadius: state.tariffs ? 0 : radiusTop, maxBarThickness: 24, order: 2 },
        { type: 'bar', label: 'Tasud', stack: 'hind', data: items.map(i => i.fees),
          backgroundColor: items.map(i => C.mix(tone(i.total), isPast(i) ? 0.32 : 0.55)), hoverBackgroundColor: items.map(i => C.mix(tone(i.total), 0.7)),
          borderColor: feeBorderColor, borderWidth: feeBorder, borderSkipped: false, borderRadius: radiusTop, maxBarThickness: 24, order: 2 },
        { type: 'line', label: 'Päeva keskmine', stack: 'keskmine', data: items.map(() => avg), borderColor: C.avgLine, borderDash: [6, 4],
          borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, order: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: barAnimation(hourly ? 22 : 6),
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: 's/kWh' },
        priceLabels: { items: priceLabels, topDataset: state.tariffs ? 1 : 0, avg, avgText: `keskmine ${NF.d2.format(avg)}` },
        tooltip: tooltip({
          filter: item => item.datasetIndex === 0,
          callbacks: {
            title: list => { const i = items[list[0].dataIndex]; return `${timeOf(i.t)}–${timeOf(i.end)}${isNow(i) ? ' (praegu)' : ''}`; },
            label: item => {
              const i = items[item.dataIndex];
              if (!state.tariffs) return ` Börsihind KM-ga ${fmtCents(i.total)}`;
              return [` Kokku ${fmtCents(i.total)}`, ` börsihind ${fmtCents(i.spot)}`, ` tasud ${fmtCents(i.fees)} (${i.tariff === 'oo' ? 'öötariif' : 'päevatariif'})`];
            },
            footer: list => {
              const v = items[list[0].dataIndex].total;
              if (!avg) return '';
              const d = (v - avg) / Math.abs(avg) * 100;
              return Math.abs(d) < 0.5 ? 'sama mis päeva keskmine' : `${NF.pct.format(Math.abs(d))}% ${d < 0 ? 'alla' : 'üle'} päeva keskmise (${fmtCents(avg)})`;
            }
          }
        })
      },
      scales: {
        x: axis({ stacked: true, grid: { display: false },
          ticks: hourly ? { color: C.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 8, padding: 6 } : hourTicks(items.map(i => i.t)) }),
        y: axis({ stacked: true, beginAtZero: true, grace: '14%', ticks: { color: C.muted, padding: 6, callback: v => NF.d0.format(v) } })
      }
    }
  });
}

/** Kust energia tuli: kolm jagatud tulpa (eile, 7 päeva, 30 päeva) – päike vs ost võrgust (kogu majja tulnud energia).
 *  Osa protsent on ploki sees, kui mahub; kogus on rea päises ja all; ploki nimi ja kogus ka hõljutades (title). */
function drawMix() {
  const host = byId('mix-body');
  const periods = [[1, 'Eile'], [7, '7 päeva'], [CONFIG.kokkuvotePaevi, `${CONFIG.kokkuvotePaevi} päeva`]];
  const rows = periods.map(([n, label]) => {
    const recs = lastDays(n).map(d => d.rec).filter(Boolean);
    const pv = sumOf(recs, 'pvKwh');
    const imp = sumOf(recs, 'importKwh');
    return { n, label, pv: pv ? pv.total : 0, grid: imp ? imp.total : 0, days: recs.length };
  }).filter(r => r.pv + r.grid > 0);
  if (!rows.length) { cardNotice('section-mix', state.errors.days || 'Päevakokkuvõtteid pole veel.'); return; }
  cardNotice('section-mix', null);
  const animate = motion();
  const pct = v => `${NF.pct.format(v)} %`;
  host.replaceChildren(...rows.map(r => {
    const total = r.pv + r.grid;
    const parts = [['päike', r.pv, C.solar], ['ost võrgust', r.grid, C.grid]];
    const bar = el('div', { class: 'segbar', role: 'img',
      'aria-label': `${r.label}: päike ${fmtKwh(r.pv)} (${pct(r.pv / total * 100)}), ost võrgust ${fmtKwh(r.grid)} (${pct(r.grid / total * 100)}).` },
    parts.map(([name, v, color]) => {
      const share = v / total * 100;
      const part = el('span', { class: 'segbar__part', title: `${name}: ${fmtKwh(v)} (${pct(share)})`, style: `--fill: ${color}; --on-fill: ${onFill(color)}` },
        [el('span', { class: 'segbar__label', text: pct(share) })]);
      part.dataset.share = String(share);
      part.hidden = v <= 0;
      if (!animate) part.style.flexGrow = String(share);
      return part;
    }));
    return el('div', { class: 'mix-row' }, [
      el('p', { class: 'mix-row__head' }, [el('span', { class: 'mix-row__label', text: r.label }), el('span', { class: 'mix-row__total', text: fmtKwh(total) })]),
      bar,
      el('p', { class: 'mix-row__detail', text: `päike ${fmtKwh(r.pv)} · ost võrgust ${fmtKwh(r.grid)}${r.days < r.n ? ` · ${r.days} päeva ${r.n}-st andmetega` : ''}` })
    ]);
  }));
  fitSegLabels();
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const part of host.querySelectorAll('.segbar__part')) part.style.flexGrow = part.dataset.share;
  }));
}

/** Ploki sisse kirjutatakse osa protsent ainult siis, kui see mahub (lõpplaiuse järgi, mitte animatsiooni ajal). */
function fitSegLabels() {
  const font = `700 13px ${C ? C.font : 'system-ui'}`;
  for (const bar of document.querySelectorAll('#mix-body .segbar')) {
    const visible = [...bar.querySelectorAll('.segbar__part')].filter(p => !p.hidden);
    const width = bar.clientWidth - 2 * Math.max(0, visible.length - 1);
    for (const part of visible) {
      const label = part.firstChild;
      label.hidden = textWidth(label.textContent, font) + 16 > width * Number(part.dataset.share) / 100;
    }
  }
}

/** Päeva võimsused 15 min kaupa: päike alana, maja, ost võrgust ja aku joontena; joonistub vasakult paremale.
 *  Aku märk nagu energialehel: + laeb, − tühjeneb (aku annab majale) – laadimine selgitab, miks öösel ostetakse
 *  võrgust rohkem, kui maja tarbib. */
function drawPower() {
  const now = new Date();
  const start = getTallinnDayStart(now, state.powerDay).getTime();
  const end = getTallinnDayStart(now, state.powerDay + 1).getTime();
  const frames = state.frames.filter(f => f.t >= start && f.t < end);
  if (!frames.length) { cardNotice('section-power', state.errors.solar || 'Selle päeva mõõtmisi pole.'); byId('power-note').textContent = ''; return; }
  cardNotice('section-power', null);
  const labels = frames.map(f => timeFormatter.format(new Date(f.t)));
  const kwh = key => frames.reduce((s, f) => s + (f[key] || 0) * 0.25, 0);
  const last = frames[frames.length - 1];
  // Aku võimsus kW: + laeb, − tühjeneb; null, kui kaadris aku andmeid pole
  const battery = frames.map(f => (f.charge == null && f.discharge == null ? null : (f.charge || 0) - (f.discharge || 0)));
  const hasBattery = battery.some(v => v != null);
  const batteryText = hasBattery ? `, aku laetud ${fmtKwh(kwh('charge'))} ja kasutatud ${fmtKwh(kwh('discharge'))}` : '';
  byId('power-note').textContent = `${state.powerDay ? 'eile' : 'täna'} kuni ${timeFormatter.format(new Date(last.t + 15 * MINUTE_MS))}: päike ${fmtKwh(kwh('pv'))}, maja ${fmtKwh(kwh('load'))}${hasBattery ? `, akust ${fmtKwh(kwh('discharge'))}` : ''}`;
  byId('c-power').setAttribute('aria-label', `Päeva võimsused (${state.powerDay ? 'eile' : 'täna'}): päike ${fmtKwh(kwh('pv'))}, maja tarbimine ${fmtKwh(kwh('load'))}, ost võrgust ${fmtKwh(kwh('buy'))}${batteryText}.`);
  const line = (label, key, color, extra = {}) => Object.assign({
    // monotone: kõver ei viska astmete juures üle (aku 0 → 8 kW ei näi hetkeks negatiivsena, päike ei lange alla nulli)
    type: 'line', label, data: frames.map(f => f[key]), borderColor: color, backgroundColor: color, borderWidth: LINE_W,
    cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, pointHoverBorderWidth: 2, pointHoverBorderColor: C.plot, spanGaps: false
  }, extra);
  upsert('c-power', {
    type: 'line',
    plugins: [UNIT_PLUGIN],
    data: {
      labels,
      datasets: [
        line('Päike', 'pv', C.solar, { fill: 'origin', backgroundColor: areaGradient(C.solar, 0.22) }),
        line('Maja tarbimine', 'load', C.home),
        line('Ost võrgust', 'buy', C.grid, { borderWidth: 2 }),
        ...(hasBattery ? [line('Aku', 'battery', C.battery, { data: battery })] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animations: lineAnimations(frames.length),
      animation: motion() ? {} : false,
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: 'kW' },
        tooltip: tooltip({ callbacks: { label: item => {
          const v = item.parsed.y;
          if (v == null) return ` ${item.dataset.label}: —`;
          if (item.dataset.label === 'Aku') {
            return Math.abs(v) < BATTERY_IDLE_KW ? ' Aku: ootel' : v > 0 ? ` Aku: laeb ${NF.d1.format(v)}\u00a0kW` : ` Aku: tühjeneb ${NF.d1.format(-v)}\u00a0kW (majja)`;
          }
          return ` ${item.dataset.label}: ${NF.d1.format(v)}\u00a0kW`;
        } } })
      },
      scales: {
        x: axis({ grid: { display: false }, ticks: hourTicks(frames.map(f => f.t)) }),
        // Null-joon telje toonis: aku tühjenemine (−) jääb selle alla
        y: axis({ beginAtZero: true, grid: { color: ctx => (ctx.tick && ctx.tick.value === 0 ? C.axis : C.hairline), drawTicks: false },
          ticks: { color: C.muted, padding: 6, callback: v => `${NF.d0.format(v)}` } })
      }
    }
  }, true);   // joon joonistub igal päeva vahetusel uuesti vasakult paremale
}

/** Päevad: päike + ost võrgust virnastatud tulpadena (sisse tulnud energia), maja tarbimine joonena. */
function drawDays() {
  const days = lastDays(state.daysRange);
  if (!days.some(d => d.rec)) { cardNotice('section-days', state.errors.days || 'Päevakokkuvõtteid pole veel.'); return; }
  cardNotice('section-days', null);
  const labels = days.map(d => { const p = getTallinnDateParts(d.date); return `${p.day}.${p.month}`; });
  const pick = field => days.map(d => (d.rec ? num(d.rec[field]) : null));
  const pv = pick('pvKwh');
  const imp = pick('importKwh');
  const load = pick('loadKwh');
  const withData = days.filter(d => d.rec).length;
  byId('days-note').textContent = withData < days.length ? `${withData} päeva ${days.length}-st andmetega` : '';
  const sum = list => list.reduce((s, v) => s + (v || 0), 0);
  byId('c-days').setAttribute('aria-label', `Viimased ${days.length} päeva: päike kokku ${fmtKwh(sum(pv))}, ost võrgust ${fmtKwh(sum(imp))}, maja tarbimine ${fmtKwh(sum(load))}.`);
  upsert('c-days', {
    type: 'bar',
    plugins: [UNIT_PLUGIN],
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Päike', data: pv, backgroundColor: C.solar, hoverBackgroundColor: C.mix(C.solar, 0.8), stack: 'sisse', borderRadius: 0, maxBarThickness: 22, order: 2 },
        // 2 px pind päikese ja ostu vahel (ploki alumine serv plot-ala värvi), ümarad ainult tulba otsas
        { type: 'bar', label: 'Ost võrgust', data: imp, backgroundColor: C.grid, hoverBackgroundColor: C.mix(C.grid, 0.8), stack: 'sisse',
          borderColor: C.plot, borderWidth: { top: 0, left: 0, right: 0, bottom: 2 }, borderSkipped: false,
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, maxBarThickness: 22, order: 2 },
        { type: 'line', label: 'Maja tarbimine', data: load, stack: 'tarbimine', borderColor: C.home, backgroundColor: C.home, borderWidth: LINE_W,
          tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: C.plot, pointHoverBorderWidth: 2, order: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: barAnimation(state.daysRange > 45 ? 6 : 18),
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: 'kWh' },
        tooltip: tooltip({
          callbacks: {
            title: items => { const d = days[items[0].dataIndex]; return dateLongFormatter.format(d.date); },
            label: item => ` ${item.dataset.label}: ${item.parsed.y == null ? '—' : fmtKwh(item.parsed.y)}`,
            footer: items => {
              const rec = days[items[0].dataIndex].rec;
              const gain = rec ? num(rec.batteryGainEur) : null;
              return gain != null ? `aku tulu ${fmtEur(gain)}` : '';
            }
          }
        })
      },
      scales: {
        x: axis({ stacked: true, grid: { display: false }, ticks: { color: C.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } }),
        y: axis({ stacked: true, beginAtZero: true, ticks: { color: C.muted, padding: 6, callback: v => NF.d0.format(v) } })
      }
    }
  });
}

/** Tunniprofiil: maja keskmine kW kellatunni järgi viimase 14 päeva kirjetest (loadH), tööpäev vs puhkepäev. */
function drawProfile() {
  const groups = { work: [], rest: [] };
  for (const d of lastDays(CONFIG.profiiliPaevi)) {
    if (!d.rec || !Array.isArray(d.rec.loadH) || d.rec.loadH.length !== 24) continue;
    const [y, m, day] = d.key.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    const rest = weekday === 0 || weekday === 6 || isPublicHoliday(y, m, day);
    groups[rest ? 'rest' : 'work'].push(d.rec.loadH);
  }
  const avgProfile = list => Array.from({ length: 24 }, (_, h) => {
    const vals = list.map(p => num(p[h])).filter(v => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  });
  if (!groups.work.length && !groups.rest.length) { cardNotice('section-profile', state.errors.days || 'Tunniprofiili andmeid pole veel.'); return; }
  cardNotice('section-profile', null);
  const work = avgProfile(groups.work);
  const rest = avgProfile(groups.rest);
  byId('profile-note').textContent = `keskmine võimsus · ${groups.work.length} tööpäeva ja ${groups.rest.length} puhkepäeva järgi`;
  const peak = list => { let best = -1; list.forEach((v, i) => { if (v != null && (best < 0 || v > list[best])) best = i; }); return best; };
  const pw = peak(work);
  const pr = peak(rest);
  byId('c-profile').setAttribute('aria-label', `Maja tarbimine kellaaja järgi: tööpäeviti suurim kell ${String(pw).padStart(2, '0')}${pw >= 0 ? ` (${NF.d1.format(work[pw])} kW)` : ''}, puhkepäeviti kell ${String(pr).padStart(2, '0')}${pr >= 0 ? ` (${NF.d1.format(rest[pr])} kW)` : ''}.`);
  upsert('c-profile', {
    type: 'line',
    plugins: [UNIT_PLUGIN],
    data: {
      labels: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
      datasets: [
        { label: 'Tööpäev', data: work, borderColor: C.home, backgroundColor: areaGradient(C.home, 0.2), fill: 'origin', borderWidth: LINE_W,
          tension: 0.4, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: C.plot, pointHoverBorderWidth: 2 },
        { label: 'Puhkepäev', data: rest, borderColor: C.battery, backgroundColor: C.battery, borderWidth: LINE_W, borderDash: [], tension: 0.4,
          pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: C.plot, pointHoverBorderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animations: lineAnimations(24, 1000),
      animation: motion() ? {} : false,
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: 'kW' },
        tooltip: tooltip({
          callbacks: {
            title: items => `kell ${items[0].label}:00–${String((Number(items[0].label) + 1) % 24).padStart(2, '0')}:00`,
            label: item => ` ${item.dataset.label}: ${item.parsed.y == null ? '—' : `${NF.d1.format(item.parsed.y)} kW`}`
          }
        })
      },
      scales: {
        x: axis({ grid: { display: false }, ticks: { color: C.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }),
        y: axis({ beginAtZero: true, ticks: { color: C.muted, padding: 6, callback: v => NF.d0.format(v) } })
      }
    }
  }, true);
}

/** Maja üldelekter: viimased 12 kuud (arvesti, hinnad.json majaElekter) ja aasta varasem sama kuu; kWh või €. */
function drawMonths() {
  if (!state.months.length) { cardNotice('section-months', state.errors.prices || 'Kuude andmeid pole.'); return; }
  cardNotice('section-months', null);
  const byKey = new Map(state.months.map(m => [m.kuu, m]));
  const lastKey = state.months.map(m => m.kuu).sort().pop();
  const [ly, lm] = lastKey.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ly, lm - 12 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const prev = `${d.getUTCFullYear() - 1}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, date: d, cur: byKey.get(key) || null, prev: byKey.get(prev) || null };
  });
  const metric = state.monthsMetric;
  const value = rec => (rec ? num(rec[metric]) : null);
  const fmt = v => (metric === 'eur' ? fmtEur(v) : fmtKwh(v));
  const labels = months.map(m => `${monthShort.format(m.date).replace('.', '')} ${String(m.date.getUTCFullYear()).slice(2)}`);
  const cur = months.map(m => value(m.cur));
  const prev = months.map(m => value(m.prev));
  const partial = months.map(m => Boolean(m.cur && m.cur.complete === false));
  byId('months-note').textContent = partial.some(Boolean) ? 'viimane kuu on pooleli' : '';
  const lastM = months[months.length - 1];
  byId('c-months').setAttribute('aria-label', `Maja üldelekter, viimased 12 kuud (${metric === 'eur' ? 'eurodes, koos kuutasudega' : 'kWh'}): ${labels[11]} ${value(lastM.cur) != null ? fmt(value(lastM.cur)) : '—'}${value(lastM.prev) != null ? `, aasta varem ${fmt(value(lastM.prev))}` : ''}.`);
  upsert('c-months', {
    type: 'bar',
    plugins: [UNIT_PLUGIN],
    data: {
      labels,
      datasets: [
        { label: 'Aasta varem', data: prev, backgroundColor: C.mix(C.grid, 0.35), hoverBackgroundColor: C.mix(C.grid, 0.5), borderRadius: 4, maxBarThickness: 18, categoryPercentage: 0.7 },
        { label: 'Kuu', data: cur, backgroundColor: months.map((m, i) => (partial[i] ? C.alpha(C.grid, 0.55) : C.grid)), hoverBackgroundColor: C.mix(C.grid, 0.85),
          borderColor: months.map((m, i) => (partial[i] ? C.grid : 'transparent')), borderWidth: months.map((m, i) => (partial[i] ? 1.5 : 0)),
          borderRadius: 4, maxBarThickness: 18, categoryPercentage: 0.7 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: barAnimation(35),
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: metric === 'eur' ? '€' : 'kWh' },
        tooltip: tooltip({
          callbacks: {
            title: items => { const m = months[items[0].dataIndex]; return `${monthShort.format(m.date).replace('.', '')} ${m.date.getUTCFullYear()}${partial[items[0].dataIndex] ? ' (pooleli)' : ''}`; },
            label: item => ` ${item.dataset.label}: ${item.parsed.y == null ? '—' : fmt(item.parsed.y)}`,
            footer: items => {
              const i = items[0].dataIndex;
              if (cur[i] == null || prev[i] == null || !prev[i] || partial[i]) return '';
              const d = (cur[i] - prev[i]) / prev[i] * 100;
              return `${d < 0 ? '−' : '+'}${NF.pct.format(Math.abs(d))}% võrreldes aasta varasemaga`;
            }
          }
        })
      },
      scales: {
        x: axis({ grid: { display: false }, ticks: { color: C.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 6 } }),
        y: axis({ beginAtZero: true, ticks: { color: C.muted, padding: 6, callback: v => NF.d0.format(v) } })
      }
    }
  });
}

/** Aku: plaadid (laetus praegu, laetud ja tühjendatud valitud päeval, eilne tulu), laetus % joonena ja
 *  laadimine (üles) / tühjenemine (alla) kW tulpadena 15 min kaupa. Kaks eraldi graafikut (ühelgi pole kahte y-telge). */
function drawBattery() {
  const rt = state.realTime;
  countUp(byId('bat-soc'), rt && rt.soc != null ? rt.soc : null, v => NF.d0.format(v), '%');
  const rtState = rt => (Math.abs(rt.kw) < BATTERY_IDLE_KW ? 'ootel' : rt.kw > 0 ? `laeb ${NF.d1.format(rt.kw)}\u00a0kW` : `tühjeneb ${NF.d1.format(-rt.kw)}\u00a0kW`);
  byId('bat-soc-sub').textContent = rt && rt.soc != null ? `${rtState(rt)}${rt.updated ? ` · mõõdetud ${timeFormatter.format(rt.updated)}` : ''}` : (state.errors.solar || '');
  const yesterday = lastDays(1)[0].rec;
  const gain = yesterday ? num(yesterday.batteryGainEur) : null;
  countUp(byId('bat-gain'), gain, v => NF.d2.format(v), '€');
  const month = sumOf(lastDays(CONFIG.kokkuvotePaevi).map(d => d.rec).filter(Boolean), 'batteryGainEur');
  byId('bat-gain-sub').textContent = month ? `${CONFIG.kokkuvotePaevi} päeva kokku ${fmtEur(month.total)}` : (state.errors.days || '');

  const word = state.batteryDay ? 'eile' : 'täna';
  byId('bat-charge-label').textContent = `Laetud ${word}`;
  byId('bat-discharge-label').textContent = `Tühjendatud ${word}`;
  const now = new Date();
  const start = getTallinnDayStart(now, state.batteryDay).getTime();
  const end = getTallinnDayStart(now, state.batteryDay + 1).getTime();
  const frames = state.frames.filter(f => f.t >= start && f.t < end && (f.soc != null || f.charge != null || f.discharge != null));
  if (!frames.length) {
    for (const id of ['bat-charge', 'bat-discharge']) byId(id).textContent = '—';
    for (const id of ['bat-charge-sub', 'bat-discharge-sub']) byId(id).textContent = '';
    byId('battery-note').textContent = '';
    cardNotice('section-battery', state.errors.solar || 'Selle päeva aku mõõtmisi pole.');
    return;
  }
  cardNotice('section-battery', null);
  const kwh = key => frames.reduce((s, f) => s + (f[key] || 0) * 0.25, 0);
  const socs = frames.map(f => f.soc).filter(v => v != null);
  const peak = key => Math.max(0, ...frames.map(f => f[key] || 0));
  countUp(byId('bat-charge'), kwh('charge'), v => NF.d1.format(v), 'kWh');
  countUp(byId('bat-discharge'), kwh('discharge'), v => NF.d1.format(v), 'kWh');
  byId('bat-charge-sub').textContent = peak('charge') > 0 ? `suurim võimsus ${NF.d1.format(peak('charge'))}\u00a0kW` : 'ei laetud';
  byId('bat-discharge-sub').textContent = peak('discharge') > 0 ? `suurim võimsus ${NF.d1.format(peak('discharge'))}\u00a0kW` : 'ei tühjenenud';
  const last = frames[frames.length - 1];
  byId('battery-note').textContent = `${word} kuni ${timeFormatter.format(new Date(last.t + 15 * MINUTE_MS))}${socs.length ? ` · laetus ${NF.d0.format(socs[0])} → ${NF.d0.format(socs[socs.length - 1])}\u00a0%` : ''}`;
  const labels = frames.map(f => timeFormatter.format(new Date(f.t)));
  byId('c-soc').setAttribute('aria-label', `Aku laetus ${word}: ${socs.length ? `${NF.d0.format(socs[0])} % → ${NF.d0.format(socs[socs.length - 1])} %, vahemik ${NF.d0.format(Math.min(...socs))}–${NF.d0.format(Math.max(...socs))} %` : 'andmed puuduvad'}.`);
  byId('c-batpower').setAttribute('aria-label', `Aku ${word}: laetud ${NF.d1.format(kwh('charge'))} kWh, tühjendatud ${NF.d1.format(kwh('discharge'))} kWh.`);
  const xAxis = () => axis({ grid: { display: false }, ticks: hourTicks(frames.map(f => f.t)) });
  const Y_W = 40;   // mõlema aku graafiku y-telje laius: plot-alad algavad samast kohast
  upsert('c-soc', {
    type: 'line',
    plugins: [UNIT_PLUGIN],
    data: {
      labels,
      datasets: [{ label: 'Laetus', data: frames.map(f => f.soc), borderColor: C.battery, backgroundColor: areaGradient(C.battery, 0.22), fill: 'origin',
        borderWidth: LINE_W, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: C.plot, pointHoverBorderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animations: lineAnimations(frames.length),
      animation: motion() ? {} : false,
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, unitLabel: { text: '%' }, tooltip: tooltip({ callbacks: { label: item => ` Laetus ${item.parsed.y == null ? '—' : `${NF.d1.format(item.parsed.y)}\u00a0%`}` } }) },
      scales: {
        x: xAxis(),
        y: axis({ min: 0, max: 100, afterFit: fixedYWidth(Y_W), ticks: { color: C.muted, padding: 6, stepSize: 25, callback: v => NF.d0.format(v) } })
      }
    }
  }, true);
  const net = frames.map(f => (f.charge == null && f.discharge == null ? null : (f.charge || 0) - (f.discharge || 0)));
  upsert('c-batpower', {
    type: 'bar',
    plugins: [UNIT_PLUGIN, BAT_LABELS],
    data: {
      labels,
      datasets: [{ label: 'Aku', data: net, backgroundColor: net.map(v => (v != null && v < 0 ? C.mix(C.battery, 0.5) : C.battery)),
        hoverBackgroundColor: net.map(v => (v != null && v < 0 ? C.mix(C.battery, 0.7) : C.mix(C.battery, 0.85))), borderRadius: 2, borderSkipped: false,
        barPercentage: 1, categoryPercentage: 0.85 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: barAnimation(5),
      layout: { padding: { top: PAD_TOP } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        unitLabel: { text: 'kW' },
        tooltip: tooltip({ callbacks: { label: item => {
          const v = item.parsed.y;
          if (v == null) return ' —';
          return Math.abs(v) < BATTERY_IDLE_KW ? ' ootel' : v > 0 ? ` laeb ${NF.d1.format(v)}\u00a0kW` : ` tühjeneb ${NF.d1.format(-v)}\u00a0kW`;
        } } })
      },
      scales: {
        x: xAxis(),
        y: axis({ afterFit: fixedYWidth(Y_W), grace: '10%', grid: { color: ctx => (ctx.tick && ctx.tick.value === 0 ? C.axis : C.hairline), drawTicks: false },
          ticks: { color: C.muted, padding: 6, callback: v => NF.d0.format(v) } })
      }
    }
  });
}

const DRAW = { price: drawPrice, mix: drawMix, power: drawPower, battery: drawBattery, days: drawDays, profile: drawProfile, months: drawMonths };

/** Kaardi graafik (kui andmed on laaditud ja Chart.js olemas); vead jäävad selle kaardi sisse. */
function drawSection(id) {
  if (!C || !state.loadedAt || !DRAW[id]) return;
  try {
    DRAW[id]();
  } catch (error) {
    console.error(`Graafik „${id}“ ebaõnnestus:`, error);
  }
}

/** Kaardid ilmuvad (ja nende graafikud animeeruvad), kui jõuavad vaatesse. */
/** Jagatud tulpade protsendisildid sobitatakse uuesti, kui kaardi laius muutub. */
function setupResize() {
  if (typeof ResizeObserver !== 'function') return;
  let last = 0;
  new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width !== last) { last = width; fitSegLabels(); }
  }).observe(byId('mix-body'));
}

function setupReveal() {
  const cards = [...document.querySelectorAll('.reveal')];
  const show = card => {
    card.classList.add('is-visible');
    const id = card.dataset.chart;
    if (id && !state.drawn.has(id)) { state.drawn.add(id); drawSection(id); }
  };
  if (typeof IntersectionObserver !== 'function' || !motion()) { cards.forEach(show); return; }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      show(entry.target);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.15 });
  cards.forEach(card => observer.observe(card));
}

/* ==========================================================================
   8. Teema, juhtnupud ja käivitus
   ========================================================================== */
function applyTheme(theme) {
  const dark = theme === 'dark' || (theme !== 'light' && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const button = byId('theme-toggle');
  const label = THEME_LABELS[theme] || THEME_LABELS.auto;
  button.setAttribute('aria-label', label);
  button.title = label;
  if (C) {   // uued värvid: graafikud joonistatakse ilma sisenemisanimatsioonita uuesti
    C = colors();
    Chart.defaults.color = C.muted;
    Chart.defaults.borderColor = C.hairline;
    for (const chart of state.charts.values()) chart.destroy();
    state.charts.clear();
    state.instant = true;
    try {
      for (const id of state.drawn) drawSection(id);
    } finally {
      state.instant = false;
    }
  }
}

function initTheme() {
  try {
    state.theme = localStorage.getItem('kauge32_theme') || 'auto';
  } catch (error) { state.theme = 'auto'; }
  applyTheme(state.theme);
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (media && media.addEventListener) media.addEventListener('change', () => { if (state.theme === 'auto') applyTheme('auto'); });
  byId('theme-toggle').addEventListener('click', () => {
    state.theme = { auto: 'dark', dark: 'light', light: 'auto' }[state.theme] || 'auto';
    try { localStorage.setItem('kauge32_theme', state.theme); } catch (error) { /* salvestusruum keelatud */ }
    applyTheme(state.theme);
  });
}

function setupControls() {
  const onChange = (name, apply) => {
    for (const input of document.querySelectorAll(`input[name="${name}"]`)) input.addEventListener('change', () => { if (input.checked) apply(input.value); });
  };
  onChange('price-day', v => { state.priceDay = Number(v); drawSection('price'); });
  onChange('price-res', v => { state.priceRes = Number(v); drawSection('price'); });
  onChange('battery-day', v => { state.batteryDay = Number(v); drawSection('battery'); });
  onChange('power-day', v => { state.powerDay = Number(v); drawSection('power'); });
  onChange('days-range', v => { state.daysRange = Number(v); drawSection('days'); });
  onChange('months-metric', v => { state.monthsMetric = v; drawSection('months'); });
  // Vahelehele naastes värsked andmed (graafikud uuenevad animatsiooniga uutele väärtustele)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.loadedAt > CONFIG.uuendusMinutites * MINUTE_MS) loadAll();
  });
}

async function init() {
  byId('footer-version').textContent = `v${APP_VERSION}`;   // „Lukusta leht“ nuppu näitab js/lukk.js
  setupChartDefaults();
  initTheme();
  setupControls();
  setupResize();
  setupReveal();
  await loadAll();
}

// start() on failis js/common.js (ootab Lukk.valmis() ja kutsub siis init())
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
