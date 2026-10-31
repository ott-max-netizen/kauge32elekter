/* Kauge 32 · mõlema lehe (index.html ja energy-dashboard.html) ühine skriptikood.
 *
 * Siin on funktsioonid ja konstandid, mis olid varem mõlemas lehes baidi täpsusega samad: Tallinna aeg,
 * vormindamine, hinnaarvutuste abifunktsioonid, DOM-abi ja kogu graafikute ühisosa (Chart.js virn, tooltip,
 * pluginad). Lehepõhine kood (CONFIG, state, normalizePrices, renderdamine jms) jääb lehe enda <script>-i.
 *
 * Laadimine: tavaline (mitte defer) <script> vahetult enne lehe põhiskripti, nii et siinsed deklaratsioonid on
 * olemas, kui põhiskript käivitub (nt `3 * MINUTE_MS` ja lõpu start()). Kõik on klassikalise skripti globaalid:
 * lehe tipptaseme const/let/function deklaratsioonid ei tohi siinseid nimesid uuesti deklareerida.
 *
 * Siinsed funktsioonid kasutavad kutsumise hetkel lehe põhiskripti globaale, mis peavad mõlemal lehel olemas
 * olema (lehtedel on neil erinev sisu): CONFIG, MAX_PERIOD_MINUTES, numberFormat, dstMark, formatCents,
 * tallinnLocalToUtc, getPriceCategory ja init.
 *
 * Muutmisel suurenda mõlema HTML-faili lingis `js/common.js?v=` väärtust (GitHub Pages hoiab faile vahemälus 10 min).
 */
'use strict';

/* ==========================================================================
   1. Konstandid
   ========================================================================== */
const TIME_ZONE = 'Europe/Tallinn';
const API_URL = 'https://dashboard.elering.ee/api/nps/price';
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/* ==========================================================================
   2. Aeg — kõik Tallinna aja järgi, DST-kindlalt Intl.DateTimeFormat abil
   ========================================================================== */
const tallinnPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Tagastab kuupäeva osad Tallinna kohalikus ajas. */
function getTallinnDateParts(date) {
  const parts = {};
  for (const part of tallinnPartsFormatter.formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? date.getUTCDay()
  };
}

/** Tallinna ajavööndi nihe UTC suhtes antud hetkel (millisekundites). */
function tallinnOffsetMs(date) {
  const p = getTallinnDateParts(date);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Tallinna kohaliku päeva algus (00:00) antud hetke suhtes; dayOffset = -1 eile, 0 täna, 1 homme ... */
function getTallinnDayStart(date, dayOffset = 0) {
  const p = getTallinnDateParts(date);
  return tallinnLocalToUtc(p.year, p.month, p.day + dayOffset, 0, 0);
}

/** Tänane homsete hindade avaldamise hetk Tallinna aja järgi (CONFIG.homsedHinnad.avaldamiseKell). */
function getTomorrowPublishTime(now) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(CONFIG.homsedHinnad?.avaldamiseKell ?? ''));
  const hour = match ? Number(match[1]) : 15;
  const minute = match ? Number(match[2]) : 0;
  const p = getTallinnDateParts(now);
  return tallinnLocalToUtc(p.year, p.month, p.day, hour, minute);
}

/* ==========================================================================
   3. Vormindamine — et-EE locale
   ========================================================================== */
const timeFormatter = new Intl.DateTimeFormat('et-EE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateLongFormatter = new Intl.DateTimeFormat('et-EE', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });

// Kellakeeramise päeval: perioodi lõpp kuvatakse alguse nihkes (Tallinna formaatija annaks sügisel „03:45–03:00“)
const utcTimeFormatter = new Intl.DateTimeFormat('et-EE', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function formatTime(date) { return timeFormatter.format(date) + dstMark(date); }

function formatPercentAbs(value) { return `${numberFormat.pct.format(Math.abs(value))}%`; }

function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

function capitalize(text) { return text ? text.charAt(0).toUpperCase() + text.slice(1) : text; }

/** Päeva sõna antud hetke jaoks: 'eile' | 'täna' | 'homme' | 'ülehomme'. */
function dayWord(date, now) {
  const t = date.getTime();
  if (t < getTallinnDayStart(now, 0).getTime()) return 'eile';
  if (t < getTallinnDayStart(now, 1).getTime()) return 'täna';
  if (t < getTallinnDayStart(now, 2).getTime()) return 'homme';
  return 'ülehomme';
}

/** "18:45" kui täna, muidu "homme 02:00". asEnd = true: keskööd loetakse lõppeva päeva osaks ("kuni 00:00"). */
function describeTime(date, now, asEnd = false) {
  const word = dayWord(asEnd ? new Date(date.getTime() - 1) : date, now);
  return word === 'täna' ? formatTime(date) : `${word} ${formatTime(date)}`;
}

/** Andmete lõpphetk: „kuni 14:15“, „kuni homme 01:00“; keskööl „homse päeva lõpuni“ („kuni homme 00:00“ oleks kahemõtteline). */
function describeUntil(date, now) {
  const p = getTallinnDateParts(date);
  if (p.hour === 0 && p.minute === 0) {
    const word = dayWord(new Date(date.getTime() - 1), now);
    return `${{ eile: 'eilse', täna: 'tänase', homme: 'homse', ülehomme: 'ülehomse' }[word]} päeva lõpuni`;
  }
  return `kuni ${describeTime(date, now, true)}`;
}

/* ==========================================================================
   4. Hinnaandmed ja arvutused
   ========================================================================== */
/** Tuvastab perioodi pikkuse (minutites) järjestikuste timestampide vahest (kõige sagedasem vahe). */
function detectInterval(sorted) {
  const counts = new Map();
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i].timestamp - sorted[i - 1].timestamp) / 60;
    if (diff > 0 && diff <= MAX_PERIOD_MINUTES) counts.set(diff, (counts.get(diff) || 0) + 1);
  }
  let best = 60;
  let bestCount = 0;
  for (const [diff, count] of counts) {
    if (count > bestCount) { best = diff; bestCount = count; }
  }
  return best;
}

function getDayPrices(periods, now, dayOffset) {
  const start = getTallinnDayStart(now, dayOffset).getTime();
  const end = getTallinnDayStart(now, dayOffset + 1).getTime();
  return periods.filter(p => p.start.getTime() >= start && p.start.getTime() < end);
}

function getCurrentPricePeriod(periods, now) {
  const t = now.getTime();
  return periods.find(p => p.start.getTime() <= t && t < p.end.getTime()) || null;
}

/** Ajaliselt kaalutud keskmine (s/kWh koos KM-ga). */
function calculateWeightedAverage(periods) {
  let weighted = 0;
  let minutes = 0;
  for (const p of periods) {
    weighted += p.spotIncVatCentsKwh * p.durationMinutes;
    minutes += p.durationMinutes;
  }
  return minutes > 0 ? weighted / minutes : null;
}

function getMinMax(periods) {
  if (!periods.length) return { min: null, max: null };
  let min = periods[0];
  let max = periods[0];
  for (const p of periods) {
    if (p.spotIncVatCentsKwh < min.spotIncVatCentsKwh) min = p;
    if (p.spotIncVatCentsKwh > max.spotIncVatCentsKwh) max = p;
  }
  return { min, max };
}

/** Lihavõttepüha (1. püha) kuupäev Gregoriuse kalendris (anonüümne Gregoriuse algoritm). */
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

/** Eesti riigipüha (Tallinna kuupäev): fikseeritud päevad, suur reede, ülestõusmis- ja nelipühade 1. püha. */
function isPublicHoliday(year, month, day) {
  if (['1-1', '2-24', '5-1', '6-23', '6-24', '8-20', '12-24', '12-25', '12-26'].includes(`${month}-${day}`)) return true;
  const easter = easterSunday(year);
  const diff = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, easter.month - 1, easter.day)) / 86400000);
  return diff === -2 || diff === 0 || diff === 49;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

/** Praeguse hinna võrdlus tänase keskmisega: "42% alla tänase keskmise (9,11 s/kWh)". */
function compareToDayAverage(price, avg) {
  if (avg == null) return null;
  const diff = price - avg;
  const avgText = formatCents(avg);
  if (Math.abs(diff) < 0.005) return `Sama, mis tänane keskmine (${avgText})`;
  const direction = diff < 0 ? 'alla' : 'üle';
  if (avg > 0 && price > 0) return `${formatPercentAbs(diff / avg * 100)} ${direction} tänase keskmise (${avgText})`;
  return `${formatCents(Math.abs(diff), 1)} ${direction} tänase keskmise (${avgText})`;
}

/* ==========================================================================
   5. Mõõteandmete abifunktsioonid
   ========================================================================== */
const EXPORT_MIN_SHARE = 0.03;

/** Lõplik arv või null (Solarman tagastab puuduva väärtuse null-ina). */
function finiteOrNull(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Valideeritud paike.json / hinnad.json meta-plokk (andmetoru olek) või null, kui failis seda pole. */
function readDataMeta(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .filter(w => typeof w === 'string' && w.trim()).map(w => w.trim().slice(0, 200)).slice(0, 5);
  return { ...raw, warnings };
}

/* ==========================================================================
   6. DOM abifunktsioonid — sisu lisatakse alati textContent/createElement kaudu
   ========================================================================== */
const SVG_NS = 'http://www.w3.org/2000/svg';

function byId(id) { return document.getElementById(id); }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

/** "Ilusad" teljejaotised: umbes `count` sammu, sammud 1/2/5 × 10^n. */
function niceTicks(min, max, count = 4) {
  const span = Math.max(max - min, 1e-9);
  const magnitude = Math.pow(10, Math.floor(Math.log10(span / count)));
  const candidates = [1, 2, 5, 10, 20, 50].map(m => m * magnitude);
  const step = candidates.find(s => span / s <= count + 3) || candidates[candidates.length - 1];
  const ticks = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return { ticks, step, format: step < 1 ? numberFormat.d1 : numberFormat.d0 };
}

/** Piktogramm spritest img/icons.svg (p 8): alati dekoratiivne, tähendus on kõrval tekstina; värv tuleb CSS-i color-ist. */
const ICON_SPRITE = 'img/icons.svg?v=20261023';

function iconEl(name) {
  return svgEl('svg', { class: 'icon', 'aria-hidden': 'true', focusable: 'false' }, [svgEl('use', { href: `${ICON_SPRITE}#i-${name}` })]);
}

/* ==========================================================================
   7. Graafikute ühisosa · Chart.js 4.5.1 (js/vendor/chart.umd.min.js, globaal Chart)
   ========================================================================== */
const CHART = { Y_MIN_W: 40, PAD_R: 12, PAD_TOP: 24, BAR_MAX: 24, END_LABEL_PX: 72, SLOP_PX: 16 };
const CHART_INSPECTOR_ONLY = '(max-width: 767px), (pointer: coarse)';

const SUN_PATH = 'M16.2 12A4.2 4.2 0 1 1 7.8 12A4.2 4.2 0 1 1 16.2 12ZM19.2 12H22M2 12H4.8M12 19.2V22M12 2V4.8'
  + 'M17.09 17.09L19.07 19.07M4.93 4.93L6.91 6.91M6.91 17.09L4.93 19.07M19.07 4.93L17.09 6.91';

const chartRegistry = new Map();   // canvas.id -> Chart
let T = null;                      // chartTokens(); null = Chart.js puudub
let chartPrintTheme = null;

/** '#rrggbb' / '#rgb' / 'rgb(a)(…)' -> [r, g, b]; muu -> null. */
function parseColor(value) {
  const v = String(value).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  return m ? [m[1], m[2], m[3]].map(Number) : null;
}

/** Läbipaistmatu segu a·fg + (1 − a)·bg sRGB-s (= color-mix(in srgb, fg a, bg)). */
function mixColor(fg, bg, a) {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return fg;
  return '#' + f.map((c, i) => Math.round(a * c + (1 - a) * b[i]).toString(16).padStart(2, '0')).join('');
}

/** Graafikute värvid tokenitest (p 3). Tuletised on läbipaistmatud. */
function chartTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();
  const t = {
    font: v('--font') || 'system-ui, sans-serif',
    text: v('--text'), muted: v('--muted'), plot: v('--plot'), hairline: v('--hairline'), axis: v('--axis'),
    focus: v('--focus'), focusBg: v('--focus-bg'),
    solar: v('--solar'), home: v('--home'), grid: v('--grid'), export: v('--export'), battery: v('--battery'),
    cat: Object.fromEntries(['roheline', 'kollane', 'oranz', 'punane'].map(k => [k, v(`--cat-${k}`)])),
    share: [1, 2, 3, 4, 5].map(i => v(`--share-${i}`)),
    textures: window.matchMedia('(forced-colors: active), (prefers-contrast: more)').matches,
    patterns: new Map()
  };
  t.css = value => { const m = /^var\((--[\w-]+)\)$/.exec(String(value).trim()); return m ? v(m[1]) : value; };
  t.mix = (color, a) => mixColor(color, t.plot, a);
  t.past = color => t.mix(color, 0.6);        // möödunud periood
  t.partial = color => t.mix(color, 0.5);     // pooleli või aukudega päev
  t.area = color => t.mix(color, 0.10);       // ala joone all
  t.barPrev = t.mix(t.grid, 0.28);            // „aasta varem“
  t.selectedBg = t.mix(t.text, 0.06);         // valitud veerg
  return t;
}

/** Tekstuur (forced-colors / prefers-contrast: more): tihedus kasvab hinnaklassiga; 'missing' = 135° viirutus. */
function chartTexture(color, kind) {
  const key = `${color}|${kind}`;
  if (T.patterns.has(key)) return T.patterns.get(key);
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (kind === 'punane') { g.fillStyle = color; g.fillRect(0, 0, size, size); }
  else {
    if (kind !== 'missing') { g.fillStyle = mixColor(color, T.plot, 0.25); g.fillRect(0, 0, size, size); }
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    const spacing = kind === 'roheline' || kind === 'missing' ? 8 : 4;
    const diag = rising => {
      for (let o = -size; o <= size * 2; o += spacing) {
        g.beginPath();
        if (rising) { g.moveTo(o, size); g.lineTo(o + size, 0); } else { g.moveTo(o, 0); g.lineTo(o + size, size); }
        g.stroke();
      }
    };
    diag(kind !== 'missing');
    if (kind === 'oranz') diag(false);
  }
  const pattern = g.createPattern(canvas, 'repeat');
  T.patterns.set(key, pattern);
  return pattern;
}

/** Kutsutakse init()-i alguses. false = Chart.js ei laadinud: kaevudes teade, tabelivaated avatud. */
function setupCharts() {
  if (typeof Chart === 'undefined') {
    for (const well of document.querySelectorAll('.chart-well')) {
      well.replaceChildren(el('p', { class: 'chart-fallback', text: 'Graafikut ei saanud laadida. Andmed on tabelivaates.' }));
    }
    for (const details of document.querySelectorAll('.table-view')) details.open = true;
    return false;
  }
  T = chartTokens();
  Object.assign(Chart.defaults, { animation: false, events: [], color: T.muted });
  Chart.defaults.font.family = T.font;
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.enabled = false;
  Chart.register(...K_PLUGINS);
  if (window.matchMedia('(forced-colors: active)').matches) {
    for (const details of document.querySelectorAll('.table-view')) details.open = true;
  }
  for (const query of ['(forced-colors: active)', '(prefers-contrast: more)']) {
    window.matchMedia(query).addEventListener?.('change', refreshChartTheme);
  }
  window.addEventListener('beforeprint', () => {
    chartPrintTheme = document.documentElement.dataset.theme;
    if (chartPrintTheme === 'dark') { document.documentElement.dataset.theme = 'light'; refreshChartTheme(); }
    for (const chart of chartRegistry.values()) chart.resize();
  });
  window.addEventListener('afterprint', () => {
    if (chartPrintTheme === 'dark') { document.documentElement.dataset.theme = 'dark'; refreshChartTheme(); }
    chartPrintTheme = null;
    for (const chart of chartRegistry.values()) chart.resize();
  });
  return true;
}

/** Teema, kontrastieelistuse või printimise muutus: uued värvid; leht ehitab graafikud sündmuse peale ümber. */
function refreshChartTheme() {
  if (!T) return;
  T = chartTokens();
  Chart.defaults.color = T.muted;
  Chart.defaults.font.family = T.font;
  document.dispatchEvent(new CustomEvent('k32:charttheme'));
}

/** Tallinna tunnijaotised päevale [dayStartMs, dayEndMs): { value, label }. Korduv tund (oktoobris) „03“ ja „03*“. */
function tallinnHourTicks(dayStartMs, dayEndMs, stepH) {
  const hours = [];
  for (let t = dayStartMs; t < dayEndMs; t += HOUR_MS) hours.push({ t, h: getTallinnDateParts(new Date(t)).hour });
  const count = new Map();
  for (const { h } of hours) count.set(h, (count.get(h) || 0) + 1);
  const seen = new Set();
  const ticks = [];
  for (const { t, h } of hours) {
    const again = seen.has(h);
    seen.add(h);
    const onStep = h % stepH === 0;
    if (onStep ? again && stepH > 2 : !(count.get(h) > 1 && stepH <= 2)) continue;
    ticks.push({ value: t, label: String(h).padStart(2, '0') + (again ? '*' : '') });
  }
  return ticks;
}

/** Lineaarne ms-telg Tallinna kellaaegadega; sama min/max igal virna paneelil. Samm 2 h (plot ≥ 560 px) või 4 h. */
function timeAxis({ dayStartMs, dayEndMs, showLabels }) {
  const sets = { 2: tallinnHourTicks(dayStartMs, dayEndMs, 2), 4: tallinnHourTicks(dayStartMs, dayEndMs, 4) };
  let labels = new Map();
  return {
    type: 'linear', min: dayStartMs, max: dayEndMs, offset: false, bounds: 'data',
    afterBuildTicks: scale => {
      const set = sets[scale.width >= 560 ? 2 : 4];
      labels = new Map(set.map(tick => [tick.value, tick.label]));
      scale.ticks = set.map(tick => ({ value: tick.value }));
    },
    ticks: { display: showLabels, autoSkip: false, maxRotation: 0, padding: 6, color: T.muted, font: { size: 12 },
      callback: value => labels.get(value) ?? '' },
    grid: { display: true, drawOnChartArea: false, drawTicks: showLabels, tickLength: 4, tickColor: T.axis, color: T.axis },
    border: { display: true, color: T.axis, width: 1 }
  };
}

/** y-telg: hairline-ruudustik, sildid --muted; laius = virna ühine laius (kaks käiku, syncStack). */
function valueAxis(stack, extra = {}) {
  const ticks = Object.assign({ color: T.muted, padding: 6, font: { size: 12 }, maxTicksLimit: 5 }, extra.ticks);
  return Object.assign({
    grid: { color: T.hairline, lineWidth: 1, drawTicks: false },
    border: { display: false },
    afterFit: scale => { scale.$naturalWidth = scale.width; scale.width = stack.yW; }
  }, extra, { ticks });
}

/** Kahesuunalise telje piirid (müük/ost, laetud/tühjendatud): tühi pool ≥ 15 % teisest ja vähemalt üks samm;
 *  piirid on sammu kordsed, et ääresildid oleksid ümmargused (niceTicks on mõlemas lehes sama). */
function divergingRange(up, down) {
  const top = Math.max(up, down * 0.15, 0.1) * 1.1;
  const bottom = Math.max(down, up * 0.15, 0.1) * 1.1;
  const { step } = niceTicks(-bottom, top, 2);   // ≤ 6 jaotist: Chart.js ei asenda sammu kitsal paneelil
  return { min: -Math.ceil(bottom / step - 1e-9) * step, max: Math.ceil(top / step - 1e-9) * step, step };
}

/** Ühised valikud (animatsioonita, Chart.js-i sündmusteta, HTML-legend ja -tooltip). */
function chartOptions(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false, animation: false, events: [],
    devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
    layout: { padding: { left: 0, right: CHART.PAD_R, top: CHART.PAD_TOP, bottom: 0 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    onResize: chart => { const stack = chart.data.$k?.stack; if (stack) queueStackSync(stack); }
  }, extra);
}

/** Loob graafiku või uuendab olemasolevat (sama canvas ja tüüp): andmed ja valikud vahetatakse, update('none'). */
function upsertChart(canvas, config) {
  if (!T || !canvas) return null;
  let chart = chartRegistry.get(canvas.id);
  if (chart && (chart.canvas !== canvas || chart.config.type !== config.type)) { chart.destroy(); chart = null; }
  if (!chart) {
    chart = new Chart(canvas, config);
    chartRegistry.set(canvas.id, chart);
  } else {
    chart.data = config.data;
    chart.options = config.options;
    chart.update('none');
  }
  return chart;
}

function destroyChart(canvasId) {
  const chart = chartRegistry.get(canvasId);
  if (chart) { chart.destroy(); chartRegistry.delete(canvasId); }
}

/* ---------- Virn: ühine y-telje laius, üks valitud periood, DOM-ristjoon, sündmused ---------- */
/** opts: { kind: 'time' | 'category', items: [{ startMs, endMs }] või päevad/kuud, defaultIndex, sticky,
 *  hoverSelects, onSelect(index, pointerType), onClear() } */
function chartStack(el, opts) {
  let stack = el.$stack;
  if (!stack) {
    stack = { el, yW: CHART.Y_MIN_W, charts: [], items: [], kind: 'time', active: null, pointer: null, sticky: false, hoverSelects: true };
    el.$stack = stack;
    attachStackEvents(stack);
  }
  const previous = stack.kind === 'time' && stack.active != null ? stack.items[stack.active] : null;
  Object.assign(stack, opts);
  stack.charts = [];
  if (previous) {   // sama kellaaeg jääb valituks ka pärast 1 h / 15 min vahetust ja andmete uuendust
    const mid = (previous.startMs + previous.endMs) / 2;
    const index = stack.items.findIndex(item => item.startMs <= mid && mid < item.endMs);
    stack.active = index >= 0 ? index : null;
  } else if (stack.active != null && stack.active >= stack.items.length) stack.active = null;
  return stack;
}

/** Teine käik: suurim loomulik y-telje laius kõigile paneelidele; plot-ala servad CSS-muutujateks (režiimiriba). */
function syncStack(stack) {
  const charts = stack.charts.filter(Boolean);
  if (!charts.length) return;
  const need = Math.max(CHART.Y_MIN_W, ...charts.map(c => Math.ceil(c.scales.y?.$naturalWidth || 0)));
  if (need !== stack.yW) {
    stack.yW = need;
    for (const chart of charts) chart.update('none');
  }
  stack.el.style.setProperty('--plot-left', `${stack.yW}px`);
  stack.el.style.setProperty('--plot-right', `${CHART.PAD_R}px`);
  for (const chart of charts) { chart.data.$k.active = stack.active; chart.data.$k.activeItem = stack.items[stack.active] || null; }
  if (stack.active != null) for (const chart of charts) chart.draw();
  positionCross(stack);
  stack.onLayout?.();
}

/** Minutitikk: „praegu“-joon ja -silt liiguvad ilma graafikut ümber ehitamata. */
function updateNowMarkers(nowMs) {
  const label = timeFormatter.format(new Date(nowMs));
  for (const chart of chartRegistry.values()) {
    const k = chart.data.$k;
    if (k?.nowMs == null) continue;
    k.nowMs = nowMs;
    if (k.nowLabel) k.nowLabel = label;
    chart.draw();
  }
}

function queueStackSync(stack) {
  if (stack.syncQueued) return;
  stack.syncQueued = true;
  requestAnimationFrame(() => { stack.syncQueued = false; syncStack(stack); });
}

function stackIndexAt(stack, clientX) {
  const chart = stack.charts[0];
  const n = stack.items.length;
  if (!chart || !n) return null;
  const a = chart.chartArea;
  const px = clientX - chart.canvas.getBoundingClientRect().left;
  if (px < a.left - CHART.SLOP_PX || px > a.right + CHART.SLOP_PX) return null;
  const value = chart.scales.x.getValueForPixel(clamp(px, a.left, a.right - 0.01));
  if (stack.kind === 'category') return clamp(Math.round(value), 0, n - 1);
  let best = null;
  let distance = Infinity;
  stack.items.forEach((item, i) => {
    if (distance === 0) return;
    if (value >= item.startMs && value < item.endMs) { best = i; distance = 0; return; }
    const d = Math.min(Math.abs(value - item.startMs), Math.abs(value - item.endMs));
    if (d < distance) { best = i; distance = d; }
  });
  if (best != null && distance > 0) {
    const item = stack.items[best];
    const edge = value < item.startMs ? item.startMs : item.endMs;
    if (Math.abs(chart.scales.x.getPixelForValue(edge) - px) > CHART.SLOP_PX) return null;   // auk andmetes
  }
  return best;
}

function selectInStack(stack, index, pointerType) {
  if (index == null || (index === stack.active && pointerType === stack.pointer)) return;
  stack.active = index;
  stack.pointer = pointerType;
  for (const chart of stack.charts) {
    chart.data.$k.active = index;
    chart.data.$k.activeItem = stack.items[index];
    chart.draw();
  }
  positionCross(stack);
  stack.onSelect?.(index, pointerType);
}

function clearStack(stack, force = false) {
  if ((stack.sticky && !force) || stack.active == null) return;
  stack.active = null;
  stack.pointer = null;
  for (const chart of stack.charts) { chart.data.$k.active = null; chart.data.$k.activeItem = null; chart.draw(); }
  positionCross(stack);
  stack.onClear?.();
}

function positionCross(stack) {
  const cross = stack.el.querySelector('.chart-stack__cross');
  if (!cross) return;
  const chart = stack.charts[0];
  const item = stack.active != null ? stack.items[stack.active] : null;
  cross.hidden = !(chart && item && stack.kind === 'time');
  if (!cross.hidden) cross.style.transform = `translateX(${Math.round(chart.scales.x.getPixelForValue((item.startMs + item.endMs) / 2))}px)`;
}

function chartKeyboardFocus(node) {
  try { return node.matches(':focus-visible'); } catch (error) { return true; }
}

function attachStackEvents(stack) {
  const node = stack.el;
  let touchActive = false;
  const pick = event => selectInStack(stack, stackIndexAt(stack, event.clientX), event.pointerType || 'mouse');
  node.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') touchActive = true; pick(event); });
  node.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' ? !touchActive : !stack.hoverSelects) return;
    pick(event);
  });
  node.addEventListener('pointerup', () => { touchActive = false; });
  node.addEventListener('pointercancel', () => { touchActive = false; });
  node.addEventListener('pointerleave', event => {
    touchActive = false;
    if (event.pointerType !== 'touch' && document.activeElement !== node) clearStack(stack);
  });
  node.addEventListener('focus', () => {
    if (chartKeyboardFocus(node)) selectInStack(stack, stack.active ?? stack.defaultIndex ?? 0, 'keyboard');
  });
  node.addEventListener('blur', () => clearStack(stack));
  node.addEventListener('keydown', event => {
    const n = stack.items.length;
    if (!n) return;
    if (event.key === 'Escape') { clearStack(stack); return; }
    const from = stack.active ?? stack.defaultIndex ?? 0;
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 }[event.key];
    const next = step != null ? from + step : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : null;
    if (next == null) return;
    event.preventDefault();
    stack.pointer = null;   // sama indeks klaviatuurilt teatatakse uuesti
    selectInStack(stack, clamp(next, 0, n - 1), 'keyboard');
  });
}

/** HTML-tooltip valitud perioodi kõrvale (paremale, kui mahub). false = sel sisendil/laiusel ainult inspektor. */
function placeChartTooltip(tooltip, wrapper, stack, pointerType) {
  if (pointerType === 'touch' || window.matchMedia(CHART_INSPECTOR_ONLY).matches) { tooltip.hidden = true; return false; }
  const chart = stack.charts[0];
  const item = stack.items[stack.active];
  if (!chart || !item) return false;
  tooltip.hidden = false;
  const offset = chart.canvas.getBoundingClientRect().left - wrapper.getBoundingClientRect().left;
  const x0 = offset + chart.scales.x.getPixelForValue(item.startMs);
  const x1 = offset + chart.scales.x.getPixelForValue(item.endMs);
  const tw = tooltip.offsetWidth;
  const left = x1 + 10 + tw <= wrapper.clientWidth ? x1 + 10 : x0 - 10 - tw;
  tooltip.style.left = `${Math.round(clamp(left, 0, Math.max(0, wrapper.clientWidth - tw)))}px`;
  const top = chart.canvas.getBoundingClientRect().top - wrapper.getBoundingClientRect().top + chart.chartArea.top;
  tooltip.style.top = `${Math.round(top)}px`;
  return true;
}

/** Astmelise joone punktid: väärtus kehtib perioodi algusest lõpuni; auk või null katkestab joone.
 *  tagOf(row) lisatakse punktile (nt tunni keskmine -> segment.borderDash). */
function stepPoints(rows, valueOf, startOf, endOf, tagOf = () => undefined) {
  const pts = [];
  rows.forEach((row, i) => {
    const value = valueOf(row) ?? null;
    const end = endOf(row);
    pts.push({ x: startOf(row), y: value, tag: tagOf(row) });
    const next = rows[i + 1];
    const contiguous = next != null && startOf(next) === end;
    if (value != null && (!contiguous || (valueOf(next) ?? null) == null)) pts.push({ x: end, y: value, tag: tagOf(row) });
    if (!contiguous) pts.push({ x: end, y: null });
  });
  return pts;
}

/** Hinnatulba täide (mõlemal lehel sama): klassi toon, möödunud = 60 % segu, kõrgendatud kontrastil tekstuur. */
function priceFill(price, past) {
  const category = getPriceCategory(price);
  const color = past ? T.past(T.cat[category]) : T.cat[category];
  return T.textures ? chartTexture(color, category) : color;
}

/** Katmata vahemikud [fromMs, toMs) sees (puuduvad hinnaperioodid): [[algusMs, lõppMs], …]. */
function gapRanges(items, fromMs, toMs) {
  const gaps = [];
  let cursor = fromMs;
  for (const item of items) {
    if (item.startMs > cursor) gaps.push([cursor, item.startMs]);
    cursor = Math.max(cursor, item.endMs);
  }
  if (items.length && cursor < toMs) gaps.push([cursor, toMs]);
  return gaps;
}

/* ---------- Joonistusabi ---------- */
function haloText(ctx, text, x, y, color) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = T.plot;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function hline(ctx, a, py) { ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); }

function vline(ctx, px, top, bottom) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke(); }

function boxesOverlap(p, q) { return p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0; }

function lastPoint(data) {
  for (let i = data.length - 1; i >= 0; i--) if (data[i] && data[i].y != null) return data[i];
  return null;
}

/** Sarja väärtus perioodis (astmeline: periood katab keskpunkti; keskpunktidega joon: punkt perioodis). */
function valueInSlot(ds, startMs, endMs) {
  const mid = (startMs + endMs) / 2;
  let last = null;
  let next = null;
  for (const p of ds.data) { if (p.x <= mid) last = p; else { next = p; break; } }
  if (!last || last.y == null) return null;
  return (ds.stepped && next) || last.x >= startMs ? last.y : null;
}

/** Praeguse perioodi tulba kontuur (kitsal tulbal laiem). */
function currentBox(chart) {
  const k = chart.data.$k;
  if (k?.currentIndex == null) return null;
  const bar = chart.getDatasetMeta(0).data[k.currentIndex];
  if (!bar) return null;
  const w = Math.max(bar.width, 3) + (k.slim ? 4 : 2);
  const y0 = Math.min(bar.y, bar.base) - 2;
  return { x0: bar.x - w / 2, x1: bar.x + w / 2, y0, y1: Math.max(Math.max(bar.y, bar.base) + 2, y0 + 4) };
}

/** Kas kast kataks tulpa, $avoid-joont (allLines: iga joont), praeguse perioodi kontuuri või paigutatud silti? */
function chartHits(chart, box, allLines = false) {
  const pad = 2;
  for (let d = 0; d < chart.data.datasets.length; d++) {
    if (!chart.isDatasetVisible(d)) continue;
    const ds = chart.data.datasets[d];
    const meta = chart.getDatasetMeta(d);
    if ((ds.type || chart.config.type) === 'bar') {
      for (const bar of meta.data) {
        if (!bar || bar.skip || bar.width == null) continue;
        const r = { x0: bar.x - bar.width / 2 - pad, x1: bar.x + bar.width / 2 + pad, y0: Math.min(bar.y, bar.base) - pad, y1: Math.max(bar.y, bar.base) + pad };
        if (boxesOverlap(r, box)) return true;
      }
    } else if (ds.$avoid || allLines) {
      const pts = meta.data;
      for (let i = 0; i + 1 < pts.length; i++) {
        const p = pts[i];
        const q = pts[i + 1];
        if (p.skip || q.skip) continue;
        const segments = ds.stepped
          ? [{ x0: p.x, x1: q.x, y0: p.y - 3, y1: p.y + 3 }, { x0: q.x - 1, x1: q.x + 1, y0: Math.min(p.y, q.y) - 3, y1: Math.max(p.y, q.y) + 3 }]
          : [{ x0: p.x, x1: q.x, y0: Math.min(p.y, q.y) - 3, y1: Math.max(p.y, q.y) + 3 }];
        if (segments.some(seg => boxesOverlap(seg, box))) return true;
      }
    }
  }
  const cur = currentBox(chart);
  if (cur && boxesOverlap(cur, box)) return true;
  return (chart.data.$k.$boxes || []).some(b => boxesOverlap(b, box));
}

/* ---------- Pluginad: olek on chart.data.$k-s (muutus + chart.draw(), ilma update'ita) ---------- */
const kBarSize = {
  id: 'kBarSize',
  beforeUpdate(chart) {
    const k = chart.data.$k;
    if (!k?.slotMs) return;
    const plotW = Math.max(1, chart.width - k.stack.yW - CHART.PAD_R);
    const slot = plotW * k.slotMs / (k.dayEndMs - k.dayStartMs);
    const slim = slot < 6;
    const w = slim ? Math.max(1, slot) : Math.min(CHART.BAR_MAX, Math.floor(slot * 0.8));
    const radius = slim || w < 6 ? 0 : Math.min(4, Math.floor(w / 3));
    for (const ds of chart.data.datasets) {
      if ((ds.type || chart.config.type) !== 'bar') continue;
      ds.barThickness = w;
      ds.borderRadius = radius;
    }
    Object.assign(k, { slim, slotPx: slot, barPx: w, $boxes: [] });
  },
  beforeDraw(chart) {   // iga joonistus paigutab sildid uuesti
    const k = chart.data.$k;
    if (k) { k.$boxes = []; k.$bestBox = null; }
  }
};

const kBestWindow = {
  id: 'kBestWindow',
  beforeDatasetsDraw(chart) {
    const k = chart.data.$k;
    const w = k?.best;
    if (!w) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const x0 = Math.max(a.left, x.getPixelForValue(w.startMs));
    const x1 = Math.min(a.right, x.getPixelForValue(w.endMs));
    if (x1 - x0 < 1) return;
    const top = a.top - 4;
    ctx.save();
    ctx.fillStyle = T.focusBg;
    ctx.beginPath();
    ctx.moveTo(x0, a.bottom); ctx.lineTo(x0, top + 4); ctx.arcTo(x0, top, x0 + 4, top, 4);
    ctx.lineTo(x1 - 4, top); ctx.arcTo(x1, top, x1, top + 4, 4); ctx.lineTo(x1, a.bottom); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = T.focus;
    ctx.fillRect(x0, top, x1 - x0, 2);
    ctx.strokeStyle = T.focus;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    if (w.startMs >= k.dayStartMs) vline(ctx, Math.round(x0) + 0.5, top, a.bottom);   // lõigatud serval punktiiri pole
    if (w.endMs <= k.dayEndMs) vline(ctx, Math.round(x1) - 0.5, top, a.bottom);
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const w = k?.best;
    if (!w) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const x0 = Math.max(a.left, x.getPixelForValue(w.startMs));
    const x1 = Math.min(a.right, x.getPixelForValue(w.endMs));
    if (x1 - x0 < 1) return;
    ctx.save();
    ctx.font = `600 12px ${T.font}`;
    const text = a.right - a.left >= 480 ? w.label : w.labelShort;
    const tw = ctx.measureText(text).width;
    const lx = clamp((x0 + x1) / 2 - tw / 2, a.left + 2, a.right - tw - 2);
    haloText(ctx, text, lx, a.top - 8, T.text);
    k.$bestBox = { x0: lx, x1: lx + tw, y0: a.top - 20, y1: a.top - 5 };
    ctx.restore();
  }
};

const kSelected = {
  id: 'kSelected',
  beforeDatasetsDraw(chart) {
    const k = chart.data.$k;
    if (k?.stack?.kind !== 'category' || k.active == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const slot = (a.right - a.left) / chart.data.labels.length;
    const left = x.getPixelForValue(k.active) - slot / 2;
    ctx.save();
    ctx.fillStyle = T.selectedBg;
    ctx.fillRect(left, a.top - 6, slot, a.bottom - a.top + 6);
    ctx.fillStyle = T.text;
    ctx.fillRect(left, a.top - 6, slot, 2);
    ctx.restore();
  }
};

const kThresholds = {
  id: 'kThresholds',
  beforeDatasetsDraw(chart) {
    const list = chart.data.$k?.thresholds;
    if (!list) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    ctx.save();
    ctx.strokeStyle = T.axis;
    ctx.lineWidth = 1;
    for (const value of list) if (value > y.min && value < y.max) hline(ctx, a, Math.round(y.getPixelForValue(value)) + 0.5);
    ctx.restore();
  }
};

const kMissing = {
  id: 'kMissing',
  beforeDatasetsDraw(chart) {
    const list = chart.data.$k?.missing;   // ajateljel [[startMs, endMs], …], kategooriateljel [indeks, …]
    if (!list?.length) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const slot = chart.data.labels?.length ? (a.right - a.left) / chart.data.labels.length : 0;
    ctx.save();
    for (const entry of list) {
      const [x0, x1] = Array.isArray(entry)
        ? [Math.max(a.left, x.getPixelForValue(entry[0])), Math.min(a.right, x.getPixelForValue(entry[1]))]
        : [x.getPixelForValue(entry) - slot * 0.35, x.getPixelForValue(entry) + slot * 0.35];
      if (x1 - x0 < 3) continue;
      if (T.textures) { ctx.fillStyle = chartTexture(T.axis, 'missing'); ctx.fillRect(x0 + 1, a.top, x1 - x0 - 2, a.bottom - a.top); }
      ctx.strokeStyle = T.axis;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(Math.round(x0) + 1.5, Math.round(a.top) + 0.5, Math.round(x1 - x0) - 3, Math.round(a.bottom - a.top) - 1);
    }
    ctx.restore();
  }
};

const kYearMarks = {
  id: 'kYearMarks',
  beforeDatasetsDraw(chart) {
    const m = chart.data.$k?.yearMarks;   // { janIndex, solarIndex }
    if (!m) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const slot = (a.right - a.left) / chart.data.labels.length;
    const edge = i => Math.round(x.getPixelForValue(i) - slot / 2) + 0.5;
    ctx.save();
    ctx.lineWidth = 1;
    if (m.janIndex > 0) { ctx.strokeStyle = T.axis; ctx.setLineDash([2, 2]); vline(ctx, edge(m.janIndex), a.top - 4, a.bottom); }
    if (m.solarIndex >= 0) {
      const sx = edge(m.solarIndex);
      ctx.strokeStyle = T.solar;
      ctx.setLineDash([3, 3]);
      vline(ctx, sx, a.top - 4, a.bottom);
      ctx.setLineDash([]);
      const withText = sx + 100 <= a.right;
      const ix = sx + 16 <= a.right ? sx + 4 : sx - 16;
      ctx.save();
      ctx.translate(ix, a.top - 21);
      ctx.scale(0.5, 0.5);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke(new Path2D(SUN_PATH));
      ctx.restore();
      if (withText) { ctx.font = `12px ${T.font}`; haloText(ctx, 'päikesepark', sx + 19, a.top - 10, T.muted); }
    }
    ctx.restore();
  }
};

const kZero = {
  id: 'kZero',
  afterDatasetsDraw(chart) {
    const z = chart.data.$k?.zero;
    const y = chart.scales.y;
    if (!z || !y || !(z.always || y.min < 0)) return;
    const { ctx, chartArea: a } = chart;
    ctx.save();
    ctx.strokeStyle = z.color || T.text;
    ctx.lineWidth = z.width || 1;
    hline(ctx, a, Math.round(y.getPixelForValue(0)) + (ctx.lineWidth % 2 ? 0.5 : 0));
    ctx.restore();
  }
};

const kEndLabels = {
  id: 'kEndLabels',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const list = k?.endLabels;   // [{ ds, text, color }] joone lõpus paremal või [{ ds, text, at: 'along' }]
    if (!list?.length) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    ctx.save();
    ctx.font = `600 12px ${T.font}`;
    const outside = [];
    for (const item of list) {
      if (!chart.isDatasetVisible(item.ds)) continue;
      const data = chart.data.datasets[item.ds].data;
      if (item.at === 'along') {
        // silt joone kohale esimesse vabasse kohta vasakult (ostuhind): mitte tulpadel ega keskmise joonel
        const tw = ctx.measureText(item.text).width;
        const pts = chart.getDatasetMeta(item.ds).data;
        const avgY = k.avg?.value != null ? y.getPixelForValue(k.avg.value) : null;
        for (let x0 = a.left + 4; x0 + tw <= a.right - 4; x0 += 16) {
          let top = Infinity;
          pts.forEach((p, i) => {
            const end = pts[i + 1] && !pts[i + 1].skip ? pts[i + 1].x : p.x;
            if (!p.skip && end >= x0 && p.x <= x0 + tw) top = Math.min(top, p.y);
          });
          const c = { x0, x1: x0 + tw, y0: top - 17, y1: top - 3 };
          if (!Number.isFinite(top) || c.y0 < a.top - 2 || (avgY != null && avgY > c.y0 - 4 && avgY < c.y1 + 4) || chartHits(chart, c)) continue;
          haloText(ctx, item.text, x0, top - 6, T.text);
          k.$boxes.push(c);
          break;
        }
        continue;
      }
      const p = lastPoint(data);
      if (p) outside.push({ ...item, px: x.getPixelForValue(p.x), py: y.getPixelForValue(p.y) });
    }
    if (outside.length) {
      const lx = Math.max(...outside.map(o => o.px)) + 10;
      const need = Math.max(...outside.map(o => ctx.measureText(o.text).width)) + 12;
      if (a.right - lx >= Math.max(CHART.END_LABEL_PX, need)) {   // ei mahu: identiteet legendis ja tooltipis
        outside.sort((p, q) => p.py - q.py);
        let last = -Infinity;
        for (const o of outside) { o.ly = clamp(Math.max(o.py, last + 14), a.top + 6, a.bottom - 2); last = o.ly; }
        for (const o of outside) {
          if (Math.abs(o.ly - o.py) > 2) { ctx.strokeStyle = T.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(o.px + 3, o.py); ctx.lineTo(lx - 2, o.ly); ctx.stroke(); }
          ctx.fillStyle = o.color;
          ctx.fillRect(lx, o.ly - 1.5, 8, 3);
          haloText(ctx, o.text, lx + 11, o.ly + 4, T.text);
        }
      }
    }
    ctx.restore();
  }
};

const kMeasuredEnd = {
  id: 'kMeasuredEnd',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const list = k?.measuredEnd;   // [{ ds, text }]: viimane mõõdetud punkt + „kuni HH:MM“
    if (!list?.length) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    const rings = list.filter(e => chart.isDatasetVisible(e.ds)).map(e => {
      const ds = chart.data.datasets[e.ds];
      const p = lastPoint(ds.data);
      return p ? { ...e, color: ds.borderColor, px: x.getPixelForValue(p.x), py: y.getPixelForValue(p.y) } : null;
    }).filter(Boolean);
    ctx.save();
    for (const r of rings) {
      ctx.beginPath();
      ctx.arc(r.px, r.py, 4, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = T.plot;
      ctx.stroke();
    }
    ctx.font = `600 12px ${T.font}`;
    const nowPx = k.nowMs != null ? x.getPixelForValue(k.nowMs) : null;   // silt ei tohi jääda „praegu“-joone alla
    for (const r of rings) {
      if (!r.text) continue;
      const tw = ctx.measureText(r.text).width;
      const spot = [[r.px + 8, r.py + 4], [r.px - tw / 2, r.py - 9], [r.px - 8 - tw, r.py - 9], [r.px - tw / 2, r.py + 19], [r.px - 8 - tw, r.py + 19], [r.px - tw / 2, r.py - 23]]
        .map(([lx, base]) => ({ x0: lx, x1: lx + tw, y0: base - 12, y1: base + 3, base }))
        .find(c => c.x0 >= a.left && c.x1 <= a.right && c.y0 >= a.top - 18 && c.y1 <= a.bottom
          && !k.$boxes.some(b => boxesOverlap(b, c))
          && !(nowPx != null && c.x0 - 4 < nowPx && c.x1 + 4 > nowPx)
          && !chartHits(chart, c, true)
          && rings.every(o => o === r || Math.hypot(clamp(o.px, c.x0, c.x1) - o.px, clamp(o.py, c.y0, c.y1) - o.py) > 8));
      if (!spot) continue;
      k.$boxes.push(spot);
      haloText(ctx, r.text, spot.x0, spot.base, T.muted);
    }
    ctx.restore();
  }
};

const kAvgLine = {
  id: 'kAvgLine',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const avg = k?.avg;
    if (avg?.value == null) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    if (avg.value < y.min || avg.value > y.max) return;
    const py = Math.round(y.getPixelForValue(avg.value)) + 0.5;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = T.plot;
    hline(ctx, a, py);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = T.muted;
    hline(ctx, a, py);
    ctx.setLineDash([]);
    ctx.font = `600 12px ${T.font}`;
    const tw = ctx.measureText(avg.label).width + 6;
    const spot = [[a.right - tw, py - 17], [a.left, py - 17], [a.right - tw, py + 3], [a.left, py + 3]]
      .map(([x0, y0]) => ({ x0, x1: x0 + tw, y0, y1: y0 + 14 }))
      .find(c => c.y0 >= a.top - 2 && c.y1 <= a.bottom && !chartHits(chart, c));
    if (spot) { haloText(ctx, avg.label, spot.x0 + 3, spot.y1 - 3, T.text); k.$boxes.push(spot); }
    ctx.restore();
    if (Boolean(spot) !== k.$avgShown) { k.$avgShown = Boolean(spot); avg.onLabel?.(k.$avgShown); }
  }
};

const kReserve = {
  id: 'kReserve',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const r = k?.reserve;   // { value: 20, label: 'reserv 20%' }
    if (!r) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    const py = Math.round(y.getPixelForValue(r.value)) + 0.5;
    ctx.save();
    ctx.strokeStyle = T.axis;
    ctx.lineWidth = 1;
    hline(ctx, a, py);
    ctx.font = `600 12px ${T.font}`;
    const tw = ctx.measureText(r.label).width;
    const spot = [[a.right - tw - 4, py - 16], [a.left + 4, py - 16], [a.right - tw - 4, py + 2], [a.left + 4, py + 2]]
      .map(([x0, y0]) => ({ x0, x1: x0 + tw, y0, y1: y0 + 14 }))
      .find(c => c.y0 >= a.top - 4 && c.y1 <= a.bottom + 4 && !chartHits(chart, c, true));
    if (spot) { haloText(ctx, r.label, spot.x0, spot.y1 - 3, T.muted); k.$boxes.push(spot); }
    ctx.restore();
  }
};

const kCurrent = {
  id: 'kCurrent',
  afterDatasetsDraw(chart) {
    const box = currentBox(chart);
    if (!box) return;
    const { ctx, chartArea: a } = chart;
    const cx = (box.x0 + box.x1) / 2;
    ctx.save();
    ctx.strokeStyle = T.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    ctx.fillStyle = T.text;
    ctx.beginPath();
    ctx.moveTo(cx, a.bottom + 2); ctx.lineTo(cx - 4, a.bottom + 8); ctx.lineTo(cx + 4, a.bottom + 8); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

const kActive = {
  id: 'kActive',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const item = k?.activeItem;
    if (!item || k.stack?.kind !== 'time') return;
    const { ctx, scales: { x, y } } = chart;
    ctx.save();
    chart.data.datasets.forEach((ds, d) => {
      if (!chart.isDatasetVisible(d) || ds.$noActive) return;
      if ((ds.type || chart.config.type) === 'bar') {
        const bar = chart.getDatasetMeta(d).data[k.active];
        if (!bar || bar.skip || !ds.data[k.active]?.y || k.active === k.currentIndex) return;
        const w = Math.max(bar.width, 3) + 2;
        ctx.strokeStyle = T.text;
        ctx.lineWidth = 1;
        ctx.strokeRect(bar.x - w / 2, Math.min(bar.y, bar.base) - 1.5, w, Math.abs(bar.base - bar.y) + 3);
        return;
      }
      const value = valueInSlot(ds, item.startMs, item.endMs);
      if (value == null) return;
      ctx.beginPath();
      ctx.arc(x.getPixelForValue((item.startMs + item.endMs) / 2), y.getPixelForValue(value), 4, 0, Math.PI * 2);
      ctx.fillStyle = ds.$color || ds.borderColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = T.plot;
      ctx.stroke();
    });
    ctx.restore();
  }
};

const kNow = {
  id: 'kNow',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    if (k?.nowMs == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    if (k.nowMs < x.min || k.nowMs > x.max) return;
    const px = Math.round(x.getPixelForValue(k.nowMs)) + 0.5;
    ctx.save();
    ctx.strokeStyle = T.muted;
    ctx.lineWidth = 1;
    vline(ctx, px, a.top - (k.nowLabel ? 4 : 0), a.bottom);
    if (k.nowLabel) {
      ctx.font = `600 12px ${T.font}`;
      const tw = ctx.measureText(k.nowLabel).width;
      const lx = clamp(px - tw / 2, a.left, a.right - tw);
      const b = k.$bestBox;
      const unitEnd = k.unit ? 4 + ctx.measureText(k.unit).width + 8 : 0;   // kUnit: ühik samal real alates x = 4
      // odavaima akna silt või telje ühik (kell 00:00–00:30) on samal real: silt plot-ala sisse, joonest paremale
      const inside = (b && b.x0 < lx + tw + 4 && b.x1 > lx - 4) || lx < unitEnd;
      haloText(ctx, k.nowLabel, inside ? Math.min(px + 4, a.right - tw) : lx, inside ? a.top + 14 : a.top - 8, T.muted);
    }
    ctx.restore();
  }
};

const kExchangeLabels = {
  id: 'kExchangeLabels',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const labels = k?.exchangeLabels;   // { up: 'müük ↑', down: 'ost ↓' }
    if (!labels) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    // Puuduvate andmete kontuurid (kMissing) on samuti takistus
    const slot = chart.data.labels?.length ? (a.right - a.left) / chart.data.labels.length : 0;
    const gaps = (k.missing || []).map(g => (Array.isArray(g) ? [x.getPixelForValue(g[0]), x.getPixelForValue(g[1])]
      : [x.getPixelForValue(g) - slot * 0.35, x.getPixelForValue(g) + slot * 0.35]));
    ctx.save();
    ctx.font = `600 12px ${T.font}`;
    // Nurgasilt ei kata tulpa, teist silti ega puuduvat perioodi: vasak nurk, siis parem; kui mõlemad on kaetud, jääb
    // silt ära (tähendus on legendis)
    for (const [text, base] of [[labels.up, a.top + 12], [labels.down, a.bottom - 5]]) {
      const tw = ctx.measureText(text).width;
      const spot = [a.left + 4, a.right - 4 - tw].map(lx => ({ x0: lx, x1: lx + tw, y0: base - 11, y1: base + 3 }))
        .find(box => !chartHits(chart, box) && !gaps.some(([g0, g1]) => g0 < box.x1 + 2 && g1 > box.x0 - 2));
      if (!spot) continue;
      if (k.$boxes) k.$boxes.push(spot);
      haloText(ctx, text, spot.x0, base, T.muted);
    }
    ctx.restore();
  }
};

const kValueLabels = {
  id: 'kValueLabels',
  afterDatasetsDraw(chart) {
    const k = chart.data.$k;
    const v = k?.valueLabels;   // { text(i), activeOnly, horizontal }
    if (!v) return;
    const { ctx, chartArea: a } = chart;
    const metas = chart.data.datasets.map((ds, d) => (chart.isDatasetVisible(d) ? chart.getDatasetMeta(d).data : []));
    ctx.save();
    ctx.font = `${v.horizontal ? 600 : 700} ${v.horizontal ? 13 : 12}px ${T.font}`;
    for (let i = 0; i < chart.data.labels.length; i++) {
      if (v.activeOnly && i !== k.active) continue;
      const text = v.text(i);
      const els = metas.map(m => m[i]).filter(e => e && !e.skip);
      if (!text || !els.length) continue;
      const tw = ctx.measureText(text).width;
      if (v.horizontal) {
        ctx.textBaseline = 'middle';
        haloText(ctx, text, Math.max(...els.map(e => Math.max(e.x, e.base))) + 6, els[0].y, T.text);
        continue;
      }
      const cx = chart.scales.x.getPixelForValue(i);
      const x0 = clamp(cx - tw / 2, a.left, a.right - tw);
      let top = Math.min(...els.map(e => e.y));
      for (const m of metas) for (const e of m) {
        if (e && !e.skip && e.width != null && e.x + e.width / 2 > x0 && e.x - e.width / 2 < x0 + tw) top = Math.min(top, e.y);
      }
      haloText(ctx, text, x0, Math.max(top - 5, a.top - 6), T.text);
    }
    ctx.restore();
  }
};

const kUnit = {
  id: 'kUnit',
  afterDraw(chart) {
    const unit = chart.data.$k?.unit;
    if (!unit) return;
    const { ctx, chartArea: a } = chart;
    ctx.save();
    ctx.font = `600 12px ${T.font}`;
    ctx.fillStyle = T.muted;
    ctx.fillText(unit, 4, a.top - 12);
    ctx.restore();
  }
};

const K_PLUGINS = [kBarSize, kBestWindow, kSelected, kThresholds, kMissing, kYearMarks, kZero, kReserve,
  kEndLabels, kMeasuredEnd, kAvgLine, kCurrent, kActive, kNow, kExchangeLabels, kValueLabels, kUnit];

/* ==========================================================================
   8. Teema ja käivitus
   ========================================================================== */
/** Teemanupu nimi (i-contrast, p 8 ja 9.1): eelistus, mitte efektiivne teema. */
const THEME_LABELS = { auto: 'Teema: automaatne', dark: 'Teema: tume', light: 'Teema: hele' };

/** Parooliga kaitstud lehel (lukk.json) käivitub init() alles pärast parooli sisestamist (js/lukk.js). */
function start() {
  Lukk.valmis().then(init, error => console.error('Lukk: lehe avamine ebaõnnestus', error));
}
