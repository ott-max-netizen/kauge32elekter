# Muudatuste ajalugu (Changelog)

See fail kirjeldab rakenduse `index.html` versioonimuudatusi, arhitektuurilisi kokkuleppeid ning UI/UX täiendusi. Dokument on mõeldud nii haldajale kui ka AI-assistentidele (sh Claude AI), et tagada edasiste arenduste ühtsus.

---

## [2.4.2] ja energy-dashboard.html [1.1.1] — 2026-10-21

### Ülevaade
Elektriinfo lehe (`index.html`) andmete ja arvutusvalemite kontroll. Põhiprobleem: päikesemoodul (2.4.0) ei kasutanud inverteri andmeid üldse, vaid **selge taeva mudelit**, ja näitas selle tulemusi siltidega „(Inverter)“. Mudeli järgi oli lõunaaeg kell 12:00 (tegelikult ~13:05 suveajal), päikesepargi võimsus 15 kWp (tegelikult 27,5 kWp, nagu Solarmanis; `CONFIG.paike.paneelideKw` on parandatud). „Täna toodang“ ja sääst sisaldasid kogu päeva, ka tulevikku. Seepärast näitas graafik juba hommikul keskpäeva päikesetoodangut. `APP_VERSION` on `index.html`-is `2.4.2` ja `energy-dashboard.html`-is `1.1.1`.

### 1. Päike, maja tarbimine ja aku ainult mõõtmistest (`paike.json`)
- Mudel (`getSolarMetrics`, `calculateSolarDay`, fikseeritud 65% omatarve) on eemaldatud. `index.html` loeb nüüd sama faili `paike.json` (Solarman, töövoog `uuenda-paike.yml`) mis energialeht: `loadSolarData` → `buildSolarView` (arvutatakse igal renderdamisel, et keskööl vahetuks päev).
- **Energiavoog** näitab inverteri hetkeseisu: päike, maja ja võrk (ost või müük). Maja tarbimise allikad on jaotatud päikese, aku ja võrgu vahel; aku laetus ja suund on eraldi real. Müük võrku tuletatakse energiabilansist, mitte fikseeritud osakaalust. Kui viimane mõõtmine on vanem kui `CONFIG.paike.aegunudMinutites` (45 min), hetkeseisu ei kuvata ja märk on kollane.
- **Kogused** (täna toodetud, maja tarbis, ost võrgust, päikeseenergia väärtus) on 15-min mõõtmiste summad kuni viimase mõõtmiseni, mitte terve päeva prognoos. Maja tarbimine = inverteri `usePower`. Varasem valem „Enefiti ost + päikese omatarve“ luges ka öise aku laadimise võrgust maja tarbimiseks (21.10 kella 8-ni: 114,7 kWh vs mõõdetud 60,8 kWh).
- **Hinnagraafik**: päikesetoodang on mõõdetud 15-min energia (kWh) ainult tänase päeva möödunud perioodides. Sellel on ühine parempoolne kWh-telg ostuga võrgust, ja telgedel on ühikud. Eile/homme päikesekihti ei näidata, sest `paike.json` sisaldab ainult tänast päeva.
- `CONFIG.paike`: lisatud `andmefail` ja `aegunudMinutites`. Eemaldatud ainult mudelis kasutatud võtmed `asimuut`, `kaldenurk`, `inverteriKasutegur`, `omatarbimiseOsa`, `aastaneToodangKwh`. `paneelideKw`/`paneelideArv` jäävad ainult sildile; `paneelideKw` = 27,5 (oli 15).
- Päise märk „OTSEÜHENDUS“ (alati roheline) → tegelik andmete värskus: **ANDMED AJAKOHASED** / **OSA ANDMEID VANANENUD** / **ANDMED PUUDUVAD**. Andmed tulevad GitHub Actionsi failidest, mitte otseühendusest.

### 2. Arvutusvalemite parandused
- **Võrgutasu riigipühadel**: Elektrilevi hinnakirja järgi kehtib öötariif ka riigipühadel kogu ööpäeva. Uus `CONFIG.ootariif.riigipuhadOnOo` (fikseeritud pühad + suur reede, ülestõusmis- ja nelipühade 1. püha) kehtib mõlemal lehel ja töövoo kuuarvutuses (`calc_final_cents_kwh`).
- **Soovitus „Võimalusel oota“**: varem kirjutati „Järgmine odavam 2-tunnine periood algab 23:00“, kuigi see oli järgmise 24 h *odavaim* aken (odavam algas juba 09:00). Nüüd: „Järgmise 24 h odavaim 2-tunnine aeg … (keskmiselt X s/kWh, Y% odavam kui praegu)“.
- **Tunnivaade**: osaliselt mõõdetud tunni ostu ei näidata enam terve tunni summana.
- **Lõpphinna kaart**: „Võrgu- ja riigitasud“ → „Marginaal, võrgu- ja riigitasud“ (sisaldab müüja marginaali). Osakaalud ümardatakse suurima jäägi meetodiga, nii et summa on 100% (varem 101%). „Ostukulu (Enefit)“ → „Ostukulu koos tasudega“.
- **Kellakeeramine**: ajavahemikule lisatakse märkus „(kell keeratakse tagasi/edasi)“ (25.10 näidati 2 h akent „03:20–04:20“).
- **Töövoog `uuenda-hinnad.yml`**: kui kuu börsihindade päring ebaõnnestus, arvestati puuduvaid perioode hinnaga 0 €/MWh, mistõttu kuu € oli sadu eurosid liiga väike. Nüüd ei uuendata kuu kirjet, kui hind puudub üle 1% perioodidest (jääb varasem). Üksikud augud kaetakse kuu keskmise hinnaga.
- **Töövoo kuukirjete vahemälu**: lõpetatud kuid ei arvutatud kunagi uuesti, seega ei jõudnud valemiparandused vanadesse kuudesse. Pooliku kuu „aasta varem sama ajani“ (`kwhToDate`) väärtus jäi samuti vanaks. Kirjetel on nüüd arvutusversioon `v` (`CALC_VERSION = 2`): versiooni muutumisel arvutatakse kõik kuud uuesti, „sama ajani“ võrdluskuu aga iga käivitusega. **Esimene käivitus pärast uuendust teeb ~40 Estfeedi päringut (3–5 min).**
- **Käibemaks ajaloos**: töövoog arvestas kõigile kuudele 24% KM-i, kuigi enne 01.07.2025 oli see 22% (`KM_AJALUGU`).
- **„Leia odavaim aeg“, elektriauto ja soovitused** järjestasid aknaid ainult börsihinna järgi. Päeva- ja öötariifi vahe (1,86 s/kWh koos KM-ga) muudab aga sageli odavaimaks hoopis öise akna. Nüüd on aluseks lõpphind koos võrgutasu, maksude ja KM-ga (`avgFinal`); börsihind on näidatud kõrval. Elektriauto kulu on kogukulu (`cost`), börsiosa eraldi (`spotCost`).
- **Maja üldelekter**: „12 kuu ost“ hõlmas poolikut jooksvat kuud. Nüüd on see viimase 12 täiskuu summa ja periood on näha (nt „okt 25 – sept 26“). Jooksva kuu „aasta varem“ tulp näitab sama päevani kogust, mitte terve kuu oma. Kuu € on märgitud hinnanguks („≈ … (hinnang)“): selles pole kuutasu ega muid arve ridu.
- Soovitustes „Hind püsib alla päeva keskmise“ → „… alla **tänase** keskmise“, sama mis hinnakaardil (võrreldakse tänase päeva keskmisega, ka siis, kui graafikul on homme). Neljakohalised summad on tuhandeeraldajaga (1 291,70 €), nagu suuremad.
- **Vaatefilter**: akna suuruse muutmisel või telefoni pööramisel ilmus „Elekter“, „Päike“ või „Planeerija“ vaates peidetud „Maja üldelekter“ uuesti nähtavale. Nüüd arvestavad kaardid aktiivset vaadet. Jaluses ja legendis „Enefiti arvesti“ → „liitumispunkti arvesti“ / „Estfeed“: arvesti on võrguettevõtja oma, andmed tulevad Elering Estfeedist.

### 3. PR #5 parandused, mis 2.4.0 ümberkirjutusega kadusid, on taastatud
- Puuduv „Aasta varem“ kast (`previousOfLatest`); pooliku kuu võrdlus „sama ajani“. „Oktoober 2026 2026“ (aasta kahekordselt); juuni/juuli lühendid; maja üldelektri valitud tulba number ei lõigu ära; väikseim graafikutekst 11 px.
- Hinnagraafiku kWh-telg, ühikud ja halo. Praeguse perioodi kontuur ümbritseb ka negatiivse hinna tulpa ning keskmise silt ei kata kontuuri. Legendis on ainult graafikul olevad elemendid.
- Link energialehele (vaadete ribal „🔋 Energia (aku, energiavoog) →“ ja päikesekaardil), CSP ja referrer meta-sildid, tühi favicon.
- Värskendusnupu ja „Proovi uuesti“ ooteaeg 15 s (kiire mitmekordne vajutamine teeb ühe päringu). Teema salvestamine ei murra lehte, kui salvestusruum on keelatud.
- Tekstid: „12 kuu ost“, „12 kuu keskmine“, „Taastuvenergia- ja varustuskindluse tasu“, jaluses kõik kolm andmeallikat.
- CSS-i järjekorravead: `.legend__swatch--solar`, `.badge-pill--solar` ja `.stats--solar` kirjutati hiljem defineeritud baasreeglitega üle (hall ruut legendis, mobiilis 3+1 kasti).
- **Kujundus on eraldi failis `css/index.css`** (varem ~1 490-realine `<style>`-plokk `index.html`-is, link `css/index.css?v=20261021`). Sisu jäi samaks: lehe pildid enne ja pärast olid piksel-identsed heledas ja tumedas teemas, telefoni ja arvuti laiusel. `css/common.css` faili elektriinfo leht ei kasuta, sest 2.4.0 teemamootoril on oma tokenid ja klassinimed.

### 4. Energialeht (`energy-dashboard.html` 1.1.1)
- **Päeva kogused ~10× liiga väikesed**: Solarmani päevakogused (`paike.json` → `data.day`) on selle jaama puhul ~10 korda väiksemad kui 15-min mõõtmiste summa, kuigi mõõtmised klapivad Estfeedi arvestiga. Näiteks 20.10: päike 5,5 vs 55,6 kWh; maja 24,5 vs 246 kWh; ost 19,3 vs 196 kWh. `computeDayTotals` eelistab nüüd mõõtmiste summat, päevakoguseid kasutatakse ainult siis, kui mõõtmisi pole.
- Riigipühade öötariif (vt p 2).

---

## [2.4.1] — 2026-10-20

> NB: valem „maja reaalne tarbimine = ost + päikese omatarve“ ei arvesta akut (seda laetakse ka võrgust); alates 2.4.2 võetakse maja tarbimine inverterist (`usePower`).

### Ülevaade
Versioon `2.4.1` (defineeritud konstandina `APP_VERSION = '2.4.1'` failis `index.html`) viib andmete kuvamise vastavusse reaalsete mõõtmisallikatega:
- **Enefiti / Estfeedi andmed = Elektri ost võrgust (`Ostetud võrgust (Enefit)`)**:
  - Võrguettevõtja ja elektrimüüja (Enefit / Elektrilevi) arvesti mõõdab ainult võrguühenduspunkti läbivat elektrit ehk seda mahtu, mis ostetakse võrgust juurde. See on elektriarve tegelik alus.
- **Inverteri andmed = Maja reaalne tarbimine ja päikesetoodang (`Maja reaalne tarbimine (Inverter)`)**:
  - Inverter mõõdab katuselt toodetud päikeseenergiat ning hoone tegelikku kogukoormust:
    $$\text{Maja reaalne tarbimine (Inverter)} = \text{Elektri ost võrgust (Enefit)} + \text{Päikese omatarbimine (Inverter)}$$
  - Päikeseenergia omatarbimine asendab otseselt võrgust ostetavat elektrit, säästes börsihinna, võrgutasu (päeva/öö), taastuvenergiatasu, aktsiisi ja käibemaksu.
- **Kuvade ja terminite parandused**:
  - **Hinnagraafiku legend ja joon**: lillakas joon on nüüd selgelt sildistatud kui `ost võrgust (Enefit, kWh)` ning kuldne kõver kui `päikesetoodang (Inverter, kW)`.
  - **Tööriistavihje (Tooltip & Inspector)**: kuvab eraldi rea `Ost võrgust (Enefit)`, `Päikese toodang (Inverter)` ja `Maja reaalne tarbimine (Inverter)` (koos päikese omatarbe ja säästu summaga).
  - **Päeva KPI-kaardid (`renderDaySummary`)**: näitab kõrvuti `Ostetud võrgust (Enefit)` (kWh ja arve maksumus) ning `Maja reaalne tarbimine (Inverter)` ja `Päikese sääst (Inverter)`.
  - **Reaalajas energiavoog (`renderSolarDashboard`)**: selgitab voolusõlmi: Päikesepark (Inverter) ➔ Maja reaalne tarbimine (Inverter) ➔ Elektrivõrk (Enefit, ost või müük).
  - **Maja üldelektri moodul (`#section-building`)**: pealkiri ja sildid täpsustatud: `Maja üldelekter (ost võrgust)`, tulpade selgitus `viimased 12 kuud: ost võrgust (Enefiti arvesti)`.

---

## [2.4.0] — 2026-10-20

> NB: allpool kirjeldatud selge taeva päikesemudel, fikseeritud 65% omatarve ja „OTSEÜHENDUS“ märk asendati versioonis 2.4.2 inverteri mõõtmistega (vt 2.4.2).

### Ülevaade
Versioon `2.4.0` (defineeritud konstandina `APP_VERSION = '2.4.0'` failis `index.html`) toob kaasa põhjaliku visuaalse ja UX moderniseerimise ning integreerib **täieliku päikeseenergia (Solar) dashboardi**:
- **Päikeseenergia dashboard ja reaalajas energiavoog (`#section-solar` / `renderSolarDashboard`)**:
  - Astronoomiline päikese asendi ja selge taeva kiirgusmudel Tallinna koordinaatidel (59.437° N), mis arvestab päeva numbrit, deklinatsiooni, seniidi nurka, paneelide kaldenurka ja inverteri kasutegurit.
  - Interaktiivne 3-sõlmeline **energiavoo skeem (Energy Flow)**: Päikesepark (kW) ➔ Maja tarbimine (kW) ➔ Elektrivõrk (kW) koos animeeritud suunaviitadega (näitab reaalajas omatarbimist, võrku müüki või võrgust ostmist).
  - 4-kaardiline **Päikese KPI ruudustik**: *Hetketootmine*, *Päeva toodang* (kWh), *Omatarbe sääst* (€ koos võrgutasu ja KM-ga) ja *Võrku müügi tulu* (€ börsihinnaga).
  - Nutikas **päikesesoovitus**: toob esile parima ajaakna seadmete käivitamiseks (nt 11:00–14:30), mil elekter on tasuta ja võrgutasusid ei lisandu.
  - Seadistatav objektis `CONFIG.paike` (15 kWp, 36 paneeli, lõunasuund, kaldenurk 35°).
- **Päikesekõver 15-minutilisel elektrihinna graafikul (`buildPriceChartSvg`)**:
  - Kuldne päikesetootmise kiht (`.solar-area`, `.solar-line`) kõrvuti börsihindade ja tarbimisega.
  - Legendis selgitus `☀️ päikesetoodang (kW)`.
  - Tööriistavihjes kuvatakse iga perioodi päikesevõimsus (kW/kWh), omatarve ja võrguga vahetus.
- **Tänapäevane moderne Frontend & nutitelefoni UX**:
  - **Teemamootor (Theme Engine)**: Hele (Light), Tume (Dark) ja süsteemi režiim sujuva SVG-nupuga päises (`#theme-toggle`) ning eelistuse salvestamisega (`localStorage`).
  - **Vaadete lüliti (View Switcher)**: Horisontaalselt keritav reageeriv segmendiriba (`.view-filter`: *Kõik vaated* | *⚡ Elekter* | *☀️ Päike* | *⏱️ Planeerija & EV* | *🏢 Maja 12 k*).
  - **Päise indikaatorid**: Pulseeriv roheline märgis `OTSEÜHENDUS`, käsitsi värskenduse pöörlev nupp (`#refresh-button`), kaasaegne tüpograafia ja peened gradient-aktsendid.
  - **Bento Grid paigutus**: Desktopil (`>= 768px`) on kõrvuti *Elekter praegu* ja *Päikeseenergia tootmine*, millele järgneb täislaiuses interaktiivne graafik, seejärel *Planeerija* ja *Lõpphind* ning täislaiuses *Maja üldelekter*.

---

## PR #5: energy-dashboard.html [1.1.0], ühine CSS ja ülevaade — 2026-10-20

> NB: commit 733e5c5 (2.4.0) ehitas `index.html`-i PR #5-eelsest koopiast, mistõttu selle kirje
> `index.html`-i osad (CSS-failid, nav, CSP, ooteaeg, graafiku- ja tekstiparandused) kadusid. Enamik neist
> on taastatud versioonis 2.4.2. PR #5 `css/index.css` asendati 2.4.2-s 2.4.0 kujundusega (vt allpool).
> Energialehe (`energy-dashboard.html` 1.1.0) muudatused kehtivad.

### Ülevaade
Koodi-, kujunduse- ja turvaülevaate tulemused: ühine CSS, lehtedevaheline navigatsioon, värskendusnuppude sagedusepiirang, graafikute ja tekstide parandused ning turvatäiendused. `APP_VERSION` on `index.html`-is `2.4.0` ja `energy-dashboard.html`-is `1.1.0`.

### 1. Kujundus eraldi CSS-failides
- `css/common.css` — ühised tokenid (hele/tume teema), päis, navigatsioon, kaardid, teated, nupud, hinnakaart, tabid, graafiku üldosad, tooltip, legend, statistikakastid, jalus.
- `css/index.css` ja `css/energy-dashboard.css` — lehepõhised reeglid (paigutus, planeerija, lõpphind, maja üldelekter / energiavoog, aku, dialoog jne).
- Varem mõlemas failis dubleeritud kujundus (~700 rida) on ühes kohas; erinevused ühtlustati (`.card__head`, `.stats`, `.btn`, `.badge-pill`, `.tooltip > span`, jalus). Eemaldati kasutamata klassid `.building-bar` ja `.kpi-row` ning inline-stiilid asendati klassidega (`.shares-label`, `.building-legend`).
- Lingid on kujul `css/common.css?v=20261020`: GitHub Pages hoiab faile vahemälus 10 min, seega **CSS-i muutmisel suurenda `?v=` väärtust mõlemas HTML-failis**.

### 2. Navigatsioon lehtede vahel
- Mõlema lehe päises on `nav.site-nav` lingid **Elektriinfo** (`index.html`) ja **Energia** (`energy-dashboard.html`); aktiivne leht on märgitud `aria-current="page"`. Energialehe jaluse eraldi link eemaldati.

### 3. Värskendamise sagedusepiirang
- **Energia „Värskenda“ ja „Proovi uuesti“:** pärast iga värskendust (ka automaatset) on nupud `REFRESH_COOLDOWN_MS` (30 s) keelatud; nupul on loendur `(28 s)` (`aria-hidden`, et ekraanilugeja seda iga sekund ette ei loeks). Kiire mitmekordne klõpsamine teeb ühe päringu. Kaitseb Solarmani API päringupiirangut otseühenduse korral.
- `refreshNow({ force })`: automaatne ajastus ja otseühenduse seadete muutmine jätavad ooteaja vahele; kui värskendus juba käib, tehakse pärast seda kohe uus (`state.pendingRefresh`) — varem jäid käimasoleva värskenduse ajal salvestatud seaded kuni 5 min rakendamata.
- **Elektriinfo „Proovi uuesti“:** `RETRY_COOLDOWN_MS` (15 s) sama loenduriga.

### 4. Graafikud
- **Hinnagraafik (`index.html`):** tarbimisjoonel on nüüd oma parempoolne **kWh-telg** (varem polnud skaalat ja joon paistis hinnaskaalal); telgede ühikud `s/kWh` / `kWh`; tarbimisjoone all on hele „halo“, mis eraldab selle värvilistest tulpadest.
- **Praeguse perioodi kontuur** ümbritseb ka negatiivse hinna tulpa (varem 4 px kõrgune kast nulljoonel) — mõlemal lehel.
- **„keskmine X“ silt** paigutatakse praegusest perioodist eemale (varem kattis õhtuti kontuuri) — mõlemal lehel.
- **Legend** näitab ainult graafikul olevaid elemente: „praegune periood“ ainult täna, „valitud odavaim aken“ ainult siis, kui aken jääb valitud päeva.
- **Maja üldelekter:** valitud tulba number ei lõigu enam paremas servas ära (joondatakse sissepoole, halo taustaga); kitsal ekraanil olid juuni ja juuli mõlemad „Juu“ → „Jun“ / „Jul“; telje- ja aastasildid 10 → 11 px.

### 5. Tekstid, paigutus ja värvid
- Parandatud: „Oktoober 2026 2026“ (aasta kahekordselt), päeva kokkuvõtte puuduv **„Aasta varem“** kast (viitas olematule väljale `previousOfLatest`); pooliku kuu korral võrreldakse sama kuupäevani aasta varem.
- „12 k: …“ → „12 kuud: …“, „12 k keskmine“ → „12 kuu keskmine“, „puuduta tulpa“ → „vali tulp“, „Taastuvenergia+Varustuskindluse tasu“ → „Taastuvenergia- ja varustuskindluse tasu“; jaluses on andmeallikana ka Elering Estfeed.
- Päeva kokkuvõte on desktopil 4 veerus (8. kast jäi varem üksi teisele reale); maja üldelektri kaardil on näitajad otse graafiku all (varem suur tühimik keskel).
- Energialehe „Järgmised tunnid“: „homme 00:00“ murdus kahele reale → laiem esimene veerg; hinnakastides `kell 03:30` (varem murdus „03:30 · s/kWh“).
- Väikseim tekst 11 → 12 px (maja üldelektri kastid), energiavoo sildid 12–13 → 13–14 px (SVG skaleerub mobiilis ~0,85-ni).
- `--cat-kollane` `#c48f00` → `#b58500`: tulpade kontrast valgel taustal 2,9:1 → 3,3:1 (WCAG 1.4.11 nõuab 3:1). `.stat__value--good/--bad` kasutavad mõlemal lehel `-fg` toone (parem tekstikontrast).
- Mobiilis peidetakse energialehe olekust „· järgmine HH:MM“, et olek ja nupp mahuksid ühele reale.

### 6. Turvalisus
- **Content-Security-Policy** (`<meta http-equiv>`, sest GitHub Pages ei luba päiseid seada): skriptid/stiilid ainult samalt saidilt (+ lehesisesed), `connect-src 'self' https:` (+ localhost-proksi), `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`. `<meta name="referrer" content="no-referrer">` — välistele API-dele ja proksidele ei saadeta lehe aadressi.
- **CORS-proksi kontroll:** `^http://localhost` lubas ka `http://localhost.evil.example` → nüüd ainult `http://localhost[:port]` või `http://127.0.0.1[:port]`, muidu `https://`.
- **Otseühenduse võtmed:** vaikimisi `sessionStorage` (kustuvad vahelehe sulgemisel); „Jäta meelde selles seadmes“ → `localStorage`. Token ja jaama vahemälu on samas kohas; „Eemalda otseühendus“ kustutab mõlemast. Dialoogi hoiatus selgitab, et SHA-256 räsi on Solarmani jaoks parooliga samaväärne ja et kõik sama konto `*.github.io` lehed jagavad brauseri salvestusruumi.
- Tühi favicon (`data:,`) — brauser ei päri enam olematut `favicon.ico`-t (404 konsoolis).

---

## Koodiülevaade 2026-10-20: edasised ettepanekud (rakendamata)

1. **Ühine JavaScript (`js/common.js`).** Mõlemas lehes on ~450 rida identset koodi: Tallinna aja funktsioonid, vormindajad, `normalizePrices`/`requestPrices`, akende otsing, `getNetworkTariff`/`calculateFinalPrice`, `el`/`svgEl`/`niceTicks`. Ühise mooduli korral parandus jõuab mõlemale lehele korraga.
2. **Tariifid ühes andmefailis.** Energialeht laadib igal avamisel kogu `index.html`-i (~105 kB) ainult selleks, et regulaaravaldisega `CONFIG` välja lugeda; sama teeb töövoog `uuenda-hinnad.yml`. Väike `config.json` (või `config.js`), mida loevad mõlemad lehed ja töövoog, oleks kiirem ja töökindlam (regex ei murdu, kui `CONFIG`-i vormingut muudetakse).
3. **Repositooriumi kasv.** `paike.json` commit iga 10 min järel (~144 commit'i ööpäevas) + `hinnad.json` iga tunni järel paisutavad git-ajalugu (sadu MB aastas). Alternatiiv: andmefailid eraldi orphan-harus (force-push ilma ajaloota) või GitHub Pagesi avaldamine `actions/deploy-pages` artefaktina.
4. **GitHub Actions'i kinnitamine commit-SHA-ga** (`actions/checkout@<sha> # v5`) ja Dependabot `github-actions` uuendusteks — tarneahela kaitse; praegu viitab silt `@v5`, mida saab ümber suunata.
5. **Avalikud andmed.** `hinnad.json` sisaldab maja 15-min tarbimist ja `paike.json` jaama võimsusi; mõlemad on avalikud nii GitHub Pagesis kui ka repo ajaloos (`noindex` ei takista ligipääsu). Kui see pole KÜ jaoks sobiv, on vaja privaatset hostingut.
6. **Otseühendus.** Kui seda ei kasutata, võiks funktsiooni eemaldada — brauseris hoitavad Solarmani võtmed on lehe suurim turvarisk. CSP `frame-ancestors` (clickjacking) vajaks HTTP-päist, mida GitHub Pages ei toeta.
7. **Jõudlus.** `renderAll` ehitab iga minut kõik kaardid uuesti; `prepareBuildingData` arvutatakse renderduse kohta kaks korda. Vahemälu `dataVersion` järgi vähendaks tööd (praegu pole see märgatav).
8. **Ligipääsetavus.** Maja üldelektri kuutulpi saab valida ainult hiire/puutega; `tabindex` + nooleklahvid (nagu hinnagraafikul) teeks need klaviatuuriga kasutatavaks.

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

1. **Failide jaotus:** `index.html` sisaldab HTML-i ja JS-i, kujundus on failis `css/index.css` (alates 2.4.2). `energy-dashboard.html` kasutab faile `css/common.css` ja `css/energy-dashboard.css`. CSS-i muutmisel suurenda linkides `?v=` väärtust. Väliseid raamistikke ega bundlereid ei kasutata.
2. **Muuda alati viimast versiooni:** enne muutmist tõmba `main`. Ära asenda faili vanema koopiaga: 2.4.0 kirjutas nii PR #5 parandused üle.
3. **`CONFIG` puutumatus:** Kõik kasutaja muudetavad parameetrid on skripti alguses objektis `CONFIG`. Võtmeid ei tohi ümber nimetada, sest `index.html`-i `CONFIG`-i loevad regulaaravaldisega ka `energy-dashboard.html` (`loadTariffs`) ja töövoog `uuenda-hinnad.yml` (`load_tariff_config`).
4. **Turvaline DOM:** Kasuta elementide loomiseks ainult `el()` / `svgEl()` ja `textContent`-i, mitte `innerHTML`-i. Uue välise hosti lisamisel uuenda `Content-Security-Policy` meta-silti.
5. **Ajavöönd:** Kõik kuupäevade ja päeva alguste arvutused käivad läbi `getTallinnDateParts` / `getTallinnDayStart` (`Europe/Tallinn`).
6. **Mõõtmised vs hinnangud:** Näita mõõtmisi (Estfeed, inverter) ainult mõõtmistena. Tulevikku ei summeerita „tänase“ koguse sisse. Mudel või prognoos peab olema selgelt märgistatud, mitte „(Inverter)“. Solarmani päevakoguseid (`data.day`) ei kasutata, sest need on ~10× liiga väikesed: kogused arvutatakse 15-min mõõtmistest.
7. **Hinnad:** Tariif ja KM rakenduvad nii lehtedel (`calculateFinalPrice`) kui ka töövoos (`calc_final_cents_kwh`); hoia need samad. Odavaima aja otsing kasutab hinda koos tasudega (`avgFinal`).
8. **Päringute sagedus:** Kasutaja algatatud värskendus arvestab ooteaega ja nupp on laadimise ajal keelatud.
9. **Navigatsioon:** Mõlemal lehel peab olema link teisele lehele.
