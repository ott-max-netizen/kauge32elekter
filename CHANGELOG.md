# Muudatuste ajalugu (Changelog)

See fail kirjeldab rakenduse `index.html` versioonimuudatusi, arhitektuurilisi kokkuleppeid ning UI/UX täiendusi. Dokument on mõeldud nii haldajale kui ka AI-assistentidele (sh Claude AI), et tagada edasiste arenduste ühtsus.

---

## energy-dashboard.html [1.0.0] — 2026-10-20

### Ülevaade
Uus eraldiseisev leht `energy-dashboard.html` (`APP_VERSION = '1.0.0'`), mis koondab päikesepargi, akupanga ja börsihinna ühte reaalajas vaatesse. Kasutab sama disainikeelt (tokenid, kaardid, `.stat`, `.card--hero`, tabid, tooltip) ja samu reegleid nagu `index.html`: üks fail, `el()`/`svgEl()` + `textContent`, Tallinna aeg `getTallinnDateParts`/`getTallinnDayStart` kaudu.

### 1. Solarman OpenAPI ja GitHub Actions (`.github/workflows/uuenda-paike.yml`)
- Secrets `SOLARMAN_APP_ID`, `SOLARMAN_APP_SECRET`, `SOLARMAN_EMAIL`, `SOLARMAN_PASSWORD` (tavatekst või SHA-256), valikuline `SOLARMAN_STATION_ID`.
- Päringud: `POST /account/v1.0/token?appId=…&language=en` → `/station/v1.0/list` (ainult kui jaama ID või võimsus on teadmata) → `/station/v1.0/realTime` → `/station/v1.0/history` (`timeType` 2 = päeva kogused, 1 = 5-min kaadrid, koondatakse 15-min keskmisteks).
- Väljund `paike.json`: `data.realTime` (W, Solarmani väljanimed), `data.day` (kWh), `data.frames`, `data.lastUpdateTime`, `data.installedCapacityKw`. Commit ainult muutuse korral; cron `*/10` (GitHub Pagesi 10 avaldamist/h piirang).

### 2. Lehe plokid
- **Soovitus** (`#section-advice` / `buildAdvice`): negatiivne hind → päikese ülejääk (lae akut / müü / tarbi ise) → võrgust laadimise tasuvus (lõpphind ÷ kasutegur vs. järgmise 12 h tipp) → kallis hind (kasuta akut / säästa) → odav hind → tavarežiim. Aegunud päikeseandmeid (`CONFIG.solarman.aegunudMinutites`) ei arvestata.
- **Energiavoog** (`#section-flow` / `buildFlowSvg`): Päike, Võrk, Maja, Aku sõlmed; animeeritud vood (`allocateFlows`: päike → maja → aku → võrk), SoC ja tootmisprotsendi rõngad, tekstiline voogude nimekiri ning ost/müük/isevarustatus koos € hinnanguga.
- **Päikesepark**, **Akupank** (SoC indikaator, laeb/tühjeneb, valikuline ajahinnang `CONFIG.aku.mahtKwh` põhjal), **Elektrihind praegu** (nagu `index.html`-i „Elekter praegu“ + järgmised tunnid).
- **Päeva ülevaade**: börsihinna tulbad (s/kWh) ja päikesetoodang + tarbimine (kW) kahe eraldi teljega graafikuna ühise ajatelje, ristkursori ja tooltipiga; „Homme“ vahekaart; tabelivaade tunni kaupa.

### 3. Andmed ja olekud
- Märgikokkulepe: `CONFIG.solarman.akuMark` / `vorguMark` (`"auto"` tuvastab energiabilansist).
- Otseühendus (valikuline dialoog): `crypto.subtle.digest('SHA-256')` väiketähtedega hex, token `localStorage`-is koos aegumisajaga, jaama vahemälu, CORS-proksi tugi; ebaõnnestumisel varuks `paike.json`.
- Värskendus iga `CONFIG.uuendusMinutites` (5) järel ja „Värskenda“ nupuga; skeletonid esmalaadimisel, värskendamisel jääb eelmine vaade poolläbipaistvana nähtavale; allikapõhised veateated ja aegunud andmete hoiatus.

---

## [2.3.0] — 2026-10-18

### Ülevaade
Versioon `2.3.0` (defineeritud konstandina `APP_VERSION = '2.3.0'` failis `index.html`) uuendab **„Maja üldelekter" mooduli** (`#section-building`):
- Moodul kuvab **alati täpselt viimased 12 järjestikust kalendrikuud** koos eelmise aasta sama kuu võrdlusega.
- **Ruumisäästlik kujundus (kompaktne mobiilis ja desktopil):** Graafiku kõrgust vähendati 200px → 162px mobiilis / 176px desktopil, pealkirja kõrval kuvatakse kompaktne 12 kuu koondmahu pill (`#building-rolling-badge`), 3 suure stat-kasti asemel kasutatakse ühtlast 4-veerulist kompaktset ruudustikku (`.stats--building`), ning aastavahetus (detsember → jaanuar) on eraldatud punktiirjoone ja aastatähistega (`'25` / `'26`).
- **Elering Estfeed taustalaadimine (`uuenda-hinnad.yml`):** `MAX_BACKFILL_PAIRS` tõsteti 4 → 12 peale, tagades kõigi puuduvate kuude automaatse laadimise ja puhverdamise (`complete: true`).

---

## [2.2.0] — 2026-10-18

### Ülevaade
Versioon `2.2.0` (defineeritud konstandina `APP_VERSION = '2.2.0'` failis `index.html`) integreerib **Elering Estfeed API** (`https://estfeed.elering.ee/api/public/v1/metering-data`) läbi GitHub Actionsi töövoo `.github/workflows/uuenda-hinnad.yml`. Elektrihinna graafikule on lisatud maja **15-minutiline tarbimine (`kWh`) ja maksumus (`€`)**, andmeid uuendatakse **iga tunni järel** ning automaatselt arvutatakse kokku **käesoleva ja eelneva aasta vastavate kuude tarbitud `kWh` ja maksumus (`€`)**.

### 1. Elering Estfeed API ja iga-tunnine uuendus (`.github/workflows/uuenda-hinnad.yml`)
- **Ajastus (`schedule`):** Lisatud iga-tunnine cron (`12 * * * *`) lisaks 15:00 börsihindade avaldamise aknale (`2-57/5 11-14 * * *`).
- **Turvaline autentimine:** Töövoog loeb GitHub Actions Secrets keskkonnamuutujaid `ELERING_CLIENT_ID`, `ELERING_CLIENT_SECRET` ja `ELERING_EIC`, hangib OAuth2 `client_credentials` ligipääsu-tokeni (`https://kc.elering.ee/realms/elering-sso/protocol/openid-connect/token`) ja pärib mõõtepunkti 15-minutilised tarbimisandmed (`resolution=fifteen_minutes`) pidades kinni Estfeedi `1 päring / 5 s` piirangust. Võtmeid ega EIC-koodi ei salvestata kunagi `hinnad.json` ega `index.html` faili.
- **15-minutiline tarbimine `hinnad.json` failis:** Iga `data.ee` kirje sisaldab (olemasolu korral) välja `"kwh"` (nt `{"timestamp": 1792056600, "price": 13.69, "kwh": 0.412}`).
- **Kuu elektri `kWh` ja maksumuse arvutus (`data.majaElekter`):**
  - Töövoog arvutab 15-minutiliste tarbimisandmete ja Eleringi börsihindade + `index.html` `CONFIG` tariifide (päeva-/öövõrgutasu, marginaal, taastuvenergiatasu, aktsiis, kuutasu, käibemaks) põhjal kokku iga kuu `kwh` ja `eur` nii käesoleva aasta kuude kui ka eelneva aasta vastavate kuude kohta.
  - Jooksva (pooliku) kuu jaoks arvutatakse eelmise aasta vastava kuu juurde ka `kwhToDate` ja `eurToDate` (tarbimine ja kulu täpselt sama kuupäeva ja kellaajani aasta varem), et võrdlus oleks õiglane. Möödunud täiskuud puhverdatakse (`"complete": true`), et vältida korduvaid API päringuid.

### 2. Graafiku täiendused (`#section-chart` / `buildPriceChartSvg` / `showTooltip`)
- **Vaikimisi 15-minutiline vaade (`state.chartResolution = 15`):** Graafik avaneb vaikimisi `15 min` resolutsioonis.
- **Tarbimise (`kWh`) joon ja pindala graafikul:** Kui valitud päeval („Eile" või „Täna") on Estfeedi tarbimisandmed olemas, joonistatakse hinnatulpade peale violetne tarbimisjoon (`.consumption-line`, `.consumption-area`, `.consumption-dot`) koos parempoolse `kWh` skaalaga.
- **15-minutiline tarbimine ja maksumus tööriistavihjes (`showTooltip` & `#chart-inspector`):** Iga 15-minutilise (või 1h) tulba juures kuvatakse lisaks börsihinnale ja lõpphinnale ka täpne tarbitud kogus ja maksumus: `Tarbitud: X,XXX kWh · Maksumus: X,XX € (börsihind: X,XX €)`.
- **Päeva ja kuu kokkuvõttekastid (`renderDaySummary`):** Graafiku all kuvatakse valitud päeva kogutarbimine (`kWh`) ja kogumaksumus (`€` koos võrgutasude ja KM-ga ning sulgudes puhta börsielektri osa) ning käesoleva kuu tarbimine võrrelduna eelneva aasta sama kuuga.

---

## [2.1.0] — 2026-10-18

### Ülevaade
Versioon `2.1.0` (defineeritud konstandina `APP_VERSION = '2.1.0'` failis `index.html`) lisab võimaluse vaadata **eilse päeva börsihindu** („Eile" vahekaart) koos päevadevahelise keskmise hinna võrdlusega ning täiustab **Desktop-vaate (`>= 768px` ja `>= 1024px`) UI/UX-i**, joondades kõrvuti asetsevad kaardid, suurendades graafiku detailsust ja lisades hiirekursori (`hover`) tagasiside.

### 1. Eilse elektrihinna vaade („Eile" nupp / vahekaart)
- **Vahekaart `#tab-yesterday` (`data-day="yesterday"`):** Lisatud graafiku päisesse (`.tabs`) valik **„Eile"** kõrvuti „Täna" ja „Homme" nuppudega. Täielik klaviatuuritugi (`ArrowLeft` / `ArrowRight` / `Home` / `End`).
- **Andmete tuletamine (`derive()`):** Kuna `hinnad.json` ja `buildApiRange(now)` sisaldavad juba andmeid alates eilse päeva südaööst (`getTallinnDayStart(now, -1)`), arvutab `derive()` nüüd ka `yesterday = getDayPrices(all, now, -1)` ja kaalutud keskmise `yesterdayAvg`.
- **Graafiku renderdamine (`renderPriceChart` / `buildPriceChartSvg`):**
  - Eilse päeva vaatamisel kuvatakse kuupäev kujul `Eile, <kuupäev>` ja kõik 96 (15 min) või 24 (1 h) tulpa täisvärvides (ilma `.bar--past` tuhmistuseta, mis kehtib ainult tänase päeva möödunud tundidele, et eilset hinnaprofiili oleks mugav analüüsida).
- **4. KPI-kaart päeva kokkuvõttes (`renderDaySummary` / `.stats--day`):**
  - Lisaks *Madalaim*, *Keskmine* ja *Kõrgeim* kaardile kuvatakse nüüd 4. võrdluskaart:
    - „Täna" vaates: **„Võrdlus eilsega"** (`±X,XX` s/kWh võrreldes eilse keskmisega, rohelise `.stat__value--good` või punase `.stat__value--bad` värvikoodiga).
    - „Eile" ja „Homme" vaates: **„Võrdlus tänasega"** (`±X,XX` s/kWh võrreldes tänase keskmisega).

### 2. Desktop-vaate UI/UX täiendused (`@media (min-width: 768px)` ja `>= 1024px`)
- **Kõrvuti asetsevate kaartide sümmeetria ja sisemine joondus:**
  - `.card` kasutab desktopil `display: flex; flex-direction: column;`.
  - Kaheveerulises paigutuses (`#section-now` + `#section-planner` ning `#section-final` + `#section-building`) joondatakse alumised alamsektsioonid (`#now-body .facts`, `#section-planner .ev`, `#section-building #building-body`) automaatselt kaardi alumisse serva (`margin-top: auto`), vältides tühimikke kõrvuti olevate kaartide vahel.
- **Laiem ja õhulisem töölaud (`>= 1024px`):**
  - `.app` maksimaalne laius on suurendatud `1120px` → `1180px`, `.layout` samm `1.5rem`, kaartide polsterdus `1.5rem 1.75rem`, pealkirja ja suure hinna tüpograafia skaleerub sujuvalt.
- **Desktopi kõrgem ja täpsem graafik (`CHART_HEIGHT_DESKTOP = 264`):**
  - Kui graafiku konteineri laius on `>= 640px`, renderdatakse SVG kõrgusega `264px` (mobiilis `220px`).
  - X-telje kellaajad kuvatakse laial ekraanil (`width >= 600px`) **iga 2 tunni tagant** (`00, 02, 04 ... 22`), mobiilis iga 4 tunni tagant.
- **Päeva KPI-ribad (`.stats--day`):** Mobiilis kompaktne `2×2` ruudustik, alates `640px` laiusest ühtlane 4-veeruline rida (`1×4`).
- **Hiirekursori (`@media (hover: hover)`) interaktsioonid:**
  - Lisatud peened hover-olekud vahekaartidele (`.tab:hover`), segmendinuppudele (`.segmented label:hover`) ja elektriauto akordioni päisele (`.ev__summary:hover`).
  - Graafikul on täppiskursor (`cursor: crosshair`) ja tulpade sujuv läbipaistvuse üleminek (`transition: opacity 0.12s ease`).

---

## [2.0.0] — 2026-10-18

### Ülevaade
Versioon `2.0.0` (defineeritud konstandina `APP_VERSION = '2.0.0'` failis `index.html`) toob kaasa põhjaliku visuaalse disaini, dashboardi loetavuse ja nutitelefoni puute-ergonoomika (touch UX) uuenduse, säilitades 100% ühe-faili null-sõltuvusega arhitektuuri ning `CONFIG` objekti tagasiühilduvuse.

### 1. Nutitelefoni ja PWA (Home Screen) tugi
- **`<head>` meta-sildid:** Lisatud `viewport-fit=cover`, `theme-color` (eraldi heleda `#f1f4f7` ja tumeda `#0f1620` režiimi jaoks) ning `apple-mobile-web-app-capable`.
- **Safe-area polsterdus:** `.app` konteiner arvestab `env(safe-area-inset-*)` väärtustega, et koduekraanile salvestatud veebirakendus ei jääks iOS/Android süsteemiribade alla.

### 2. Plokk 1 — „Elekter praegu" (`#section-now` / `renderCurrentPrice`)
- **Kompaktne mobiilivaade (Above the Fold):**
  - Ülemisel real (`.hero-top`) on kõrvuti hinnangusilt (`.verdict`) ja kehtivuse kellaaeg (`.hero-period`).
  - Hinnareal (`.hero-price-row`) kuvatakse börsihind (`.hero-price`) ja selle kõrval kompaktne infokapsel (`.hero-final-pill`) maja hinnangulise lõpphinnaga (`Koos tasudega: X,XX s/kWh`). Eemaldatud vana dubleeriv `<dl class="hero-final">` kaardi põhjast.
  - Soovituskast (`.advice`) kasutab nüüd hinnakategooria semantilist tausta (`--hero-bg`) ja tekstivärvi (`--hero-fg`).
  - Faktide loend (`.facts`) on muudetud täpp-loendist kompaktseks 2-veeruliseks infokaartide võrgustikuks (`grid-template-columns: repeat(auto-fit, minmax(210px, 1fr))`).

### 3. Plokk 2 — Börsihinna graafik (`#section-chart` / `renderPriceChart` / `buildPriceChartSvg`)
- **Möödunud tundide visuaalne taandamine:** Tänase päeva vaates saavad juba möödunud hinnaperioodid (`bar.end <= nowMs`) klassi `.bar--past` (`opacity: 0.38`), et praegune tund ja tulevased tunnid eristuksid kohe.
- **Planeerija odavaima akna kuvamine graafikul:** Funktsioon `buildPriceChartSvg` joonistab valitud kestuse (`state.selectedDuration`) odavaima ajaakna (`bestWindow`) taustale rohelise esiletõstu (`var(--cat-roheline-bg)`) ja ülemise aktsentjoone. Kestuse muutmisel planeerijas uueneb graafik koheselt (`chartKey` sisaldab `bestKey` väärtust).
- **Nutitelefoni Touch-Scrubbing (sõrmega libistamine):**
  - `.chart-svg` kasutab `touch-action: pan-y` ja `user-select: none`.
  - `attachChartInteraction` lubab puuteekraanil (`pointerType === 'touch'`) sõrme horisontaalselt üle tulpade libistada (`pointerdown` + `pointermove`), ilma et vertikaalne lehe kerimine blokeeruks.
- **Fikseeritud infopaneel (`#chart-inspector`):** Graafiku päises (`.chart-status-bar`) kuvatakse valitud tulba kellaaeg ja hind. Puuteekraanil hoitakse hõljuv `.tooltip` graafiku ülaservas (`top: 0px`), et see ei jääks kasutaja sõrme alla.
- **„Homme" vahekaardi olekuindikaator (`updateTomorrowTab`):** Vahekaart `#tab-tomorrow` näitab rohelist täppi (`.tab__dot`), kui homsed hinnad on saadaval, või avaldamise kellaaega `(15:00)` (`.tab__badge`), kui hindu veel oodatakse.

### 4. Plokk 3 — „Leia odavaim aeg" ja Elektriauto (`#section-planner` / `renderPlanner` / `renderEv`)
- **Ühtlane nupuvõrgustik (`.segmented--grid`):** Kestuse valikud (`1 h` … `6 h`) paiknevad CSS Gridis (`3×2` kitsal ekraanil, `6×1` alates `420px`), vältides ebaühtlast ridade murdumist.
- **Ajaline kontekst (`.plan__badge`):** Parima ajaakna päises (`.plan__head`) kuvatakse märgis `"Praegu käib"` või `"Algab X h Y min pärast"`.
- **Hoiatuse esiletõst (`.plan__avoid`):** Kõige kallima ajaakna hoiatus kasutab punast hoiatustausta (`--cat-punane-bg` / `--cat-punane-fg`).
- **Elektriauto akordion (`#ev-details`):** Lisatud animeeritud nooleikoon ja päise kokkuvõttesilt `#ev-summary-meta` (nt `20→80% · 11 kW`), mis on nähtav ka suletud olekus.

### 5. Plokk 4 — „Maja hinnanguline elektrihind praegu" (`#section-final` / `renderFinalPrice`)
- **Tariifimärgis (`.tariff-badge`):** Lõpphinna kõrval kuvatakse selgelt, kas hetkel kehtib `öötariif` või `päevatariif`.
- **Börsihinna ja lisatasude jaotus (`.final-split`):** Enne detailset tabelit on 2 ülevaatlikku KPI-kaarti (`.stat`), mis näitavad *koos käibemaksuga*, kui palju moodustab lõpphinnast börsihind ja kui palju fikseeritud võrgu- ning riigitasud (`+X,XX s/kWh`).

### 6. Plokk 5 — „Maja üldelekter" (`#section-building` / `renderBuildingElectricity` / `buildBuildingChartSvg`)
- **Interaktiivsed kuutulbad (`state.selectedBuildingIndex`):** Iga kuu tulp on klikitav/puudutatav (`.building-bar`). Valitud kuu tõstetakse esile ja selle täpsed väärtused kuvatakse graafiku kohal (`#building-chart-info`) ning allolevates KPI-kaartides (lahendab olukorra, kus `> 6` kuu puhul olid tulpade tekstid peidetud).
- **KPI-kaardid (`.stats`):** Senine tavaline täpp-loend on asendatud 3 numbrilise kaardiga: *Valitud kuu*, *Võrdlus eelmise aastaga* (värvikoodiga `.stat__value--good` / `.stat__value--bad`) ja *Korteri kohta*.

---

## Arhitektuurireeglid edasiseks arenduseks (Claude AI juhis)

1. **Ühe faili põhimõte:** Kogu HTML, CSS ja JS asub failis `index.html`. Väliseid raamistikke ega bundlereid ei kasutata.
2. **`CONFIG` puutumatus:** Kõik kasutaja poolt muudetavad parameetrid asuvad skripti alguses objektis `CONFIG`. Selle võtmeid ei tohi ümber nimetada.
3. **Turvaline DOM:** Kasuta elementide loomiseks ainult abifunktsioone `el()` ja `svgEl()` ning `textContent` omistamist. Ära kasuta `innerHTML`-i.
4. **Ajavöönd:** Kõik kuupäevade ja päeva alguste (`00:00`) arvutused peavad käima läbi `getTallinnDateParts` ja `getTallinnDayStart` (`Europe/Tallinn`), mitte brauseri kohaliku ajavööndi.
