# Muudatuste ajalugu (Changelog)

See fail kirjeldab rakenduse `index.html` versioonimuudatusi, arhitektuurilisi kokkuleppeid ning UI/UX täiendusi. Dokument on mõeldud nii haldajale kui ka AI-assistentidele (sh Claude AI), et tagada edasiste arenduste ühtsus.

---

## [3.2.1] ja energy-dashboard.html [2.2.1] — 2026-10-31 · koodi ülevaatus ja optimeerimine

Kuvatavad numbrid ja tekstid ei muutunud (kontrollitud fikseeritud kella ja sünteetiliste andmetega: hele/tume teema,
1280/390 px, hõljutus, sakid, teemanupp – kõigi hetktõmmiste tekst ja tooltipid on samad), välja arvatud allpool
nimetatud vigade parandused. `js/common.js?v=20261031`, `css/energy-dashboard.css?v=20261031`.

### 1. Ühine skriptikood `js/common.js`
- Mõlemas lehes baidi täpsusega samad 101 tipptaseme deklaratsiooni (~1120 rida kummaski: Tallinna aeg,
  vormindamine, hinnaarvutuste abifunktsioonid, DOM-abi ja kogu „GRAAFIKUTE ÜHISOSA“) on nüüd ühes failis, mis
  laaditakse tavalise skriptina enne lehe põhiskripti. Brauser laadib ja hoiab selle vahemälus üks kord; parandus
  tehakse ühes kohas (varasem „baidi täpsusega sama“ `diff`-kontroll pole enam vajalik). `index.html` väheneb
  ~1180 rea võrra (ka energialehe `loadTariffs` laadib vähem).
- Eemaldatud surnud kood: `index.html`-i esimene `iconEl` (hilisem deklaratsioon kirjutas selle alati üle),
  `CATEGORY_ORDER`, `CHART_HEIGHT`, `CHART_HEIGHT_DESKTOP`, kasutamata olekuväljad (`chart`, `chartView`,
  `chartItems`, `chartCrosshairs`, `tooltipIndex`, `tooltipPointer`).

### 2. Vähem tööd ja andmesidet
- **Minutitikk peidetud vahelehel ei joonista** (mõlemad lehed); vahelehele naastes joonistatakse kohe. Tikk on
  `try/finally`-s: üks visatud viga ei peata enam kella ja „praegu“-joont kogu sessiooniks.
- **Muutuseta andmefail ei ehita lehte ümber:** hinnad (mõlemad lehed) ja energialehe `paevad.json` loetakse
  tekstina; sama sisu korral versioon ei suurene, nii et graafikuid, tabeleid ja nende kerimisasendit ei
  puudutata (töövoog kirjutab faile ainult muutuse korral, enamik kontrolle on muutuseta).
- **Elektriinfo leht laadib `paevad.json`-i (~100 kB) uuesti ainult vajadusel:** kasutusel on ainult eilne
  kirje; kui see on lõplik, laaditakse fail uuesti alles uuel päeval või 6 h pärast (varem igal kontrollil).
- Energialehe lõpphind arvutatakse perioodi kohta üks kord (`finalCents`), mitte igal kutsel (Tallinna
  kuupäevaosad ja pühade arvutus).
- Energiavoo SVG-d ei ehitata enam ümber hinnauuenduse ja 5 minuti sammu pärast (täpid ei hüppa algusesse), ja
  täppide animatsioon seisab, kui kaart pole ekraanil (`IntersectionObserver`, `.is-offscreen`).

### 3. Vigade parandused
- **Energialehe tarbimise prognoos kellakeeramise päeval:** 25-tunnisel päeval puudus esimene 03:00 tund (prognoos
  ~1/25 liiga väike, „Homme“ graafikul auk); nüüd käiakse päev läbi UTC tundide kaupa.
- **Energialehe päevade graafik pärast keskööd:** võti sisaldab esimest päeva, nii et graafik ja selle kirjeldus
  ei näita enam eri päevi.
- **Ekraanilugeja:** olekurida (`aria-live`) ja hoiatusbänner (`role="alert"`) uuendatakse ainult sisu muutusel
  (varem loeti sama teade iga minut uuesti ette). Energialehe aegunud päikeseandmete teatest jäi välja minutiti
  muutuv vanus (see on energiavoo märgil): „Solarmani mõõtmised on aegunud (viimane 14:05)“.
- **Elektriinfo „Eile“ rida** ehitatakse uuesti ainult sisu muutusel (lingil olev klaviatuurifookus ei kao iga minut).

### 4. Töövoog `uuenda-hinnad.yml` (päevakokkuvõtted)
- Muutumata päevakirje tunnistatakse taas muutumatuks (võrdlus jätab tuletatud `batteryGainEur`-i välja): varem
  sai iga ümberarvutatud kirje uue `updatedAt`-i ja pooliku eilse päeva ajal tehti igal käivitusel uus
  `paevad.json`-i commit.
- Kui Eleringi hinnapäring varasemate päevade jaoks ebaõnnestub, jäetakse partii järgmisele käivitusele (hoiatus
  „Börsihindu ei saanud laadida …“); varem salvestati päevad jäädavalt eurodeta.

---

## Turvaparandused — 2026-10-31

Lehe ja andmete loogika ei muutunud; `js/lukk.js?v=20261031b`.

### 1. Actions'i logides pole mõõteväärtusi
- Avaliku repo logid on kõigile nähtavad ja lekitasid krüpteeritud andmeid: `uuenda-hinnad.yml` ei prindi enam kuude
  kWh-d ja €-sid (jooksev kuu, varasemad kuud, osalise Estfeedi vastuse võrdlus), `uuenda-paike.yml` ei kirjuta
  `gridPower` hoiatusse reaalaja võimsust. Logisse jäävad ainult kuupäevad, arvud ja olekud.

### 2. Lehe võti mitte-eksporditavana IndexedDB-s
- `js/lukk.js`: võti tuletatakse `extractable: false` ja hoitakse IndexedDB-s (`kauge32-lukk`/`votmed`): kirje `pysiv`
  („Jäta meelde“) või `sessioon:<id>` (id vahelehe `sessionStorage`-is, kirje aegub 12 h pärast viimast kasutust ja
  koristatakse järgmisel avamisel). Sama saidi skript ei saa võtit enam välja lugeda. Vana eksporditud võti
  (`localStorage`/`sessionStorage` `kauge32_lukk`) kolitakse üle ja kustutatakse; parooli uuesti küsida pole vaja.
  „Lukusta leht“ kustutab kõik selle brauseri kirjed. IndexedDB puudumisel jääb võti ainult mällu.

### 3. Töövoogude tarneahel
- `cryptography` paigaldatakse uues sammus „Paigalda krüpteerimise teek“, kus secret'eid pole, eraldi venv'i ja ainult
  `.github/scripts/requirements-lukk.txt` räsidega (`--require-hashes --only-binary=:all:`); runner'i süsteemi
  `cryptography` sobib samuti. `lukk.py` käivitatakse `$LUKK_PY`-ga.
- `actions/checkout` commit'i SHA-ga (v5.1.0) ja `persist-credentials: false`; token antakse ainult sammule
  „Salvesta muudatus“ (`http.extraheader`, maskitud).

---

## [3.2.0] ja energy-dashboard.html [2.2.0] — 2026-10-31

Parooliga kaitse ja otsingumootorite indekseerimise keeld. `APP_VERSION` `3.2.0` / `2.2.0`, `css/common.css?v=20261031`,
uus `js/lukk.js?v=20261031`. Andme- ja arvutusloogika ei muutunud; muutus ainult andmefailide laadimine
(`fetch` → `Lukk.fetch`) ja lehe käivitus (`init()` pärast `Lukk.valmis()`).

### 1. Parooliga kaitse krüpteerimisega (README „Parooliga kaitse“)
- `.github/scripts/lukk.py`: töövoogude sammud „Ava krüpteeritud andmefailid“ ja „Lukusta andmefailid“ mõlemas
  töövoos. Andmefailid avaldatakse ümbrikuna `{"lukk":1,"kdf":"PBKDF2-SHA256","iter":600000,"salt","iv","ct"}`
  (AES-256-GCM, võti paroolist PBKDF2-HMAC-SHA256-ga). `lukk.json` hoiab soola ja parooli kontrollväärtust
  (`AES-GCM(võti, "kauge32-lukk")`). Secret `LEHE_PAROOL`; `LEHE_PAROOL_VANA` parooli vahetuseks või kaitse
  mahavõtmiseks. Ilma secret'ita käitub kõik nagu enne.
- Muutumata andmefail taastatakse baidi täpsusega (juhuslik nonss annaks muidu iga käivitusega asjatu commit'i);
  teise töövoo failid (nt `paike.json` hindade töövoos) taastatakse algsel kujul, et `git pull --rebase` töötaks.
  `lukk.json` lisatakse commit'i (loodud, uuendatud või kustutatud).
- `js/lukk.js` (globaal `Lukk`, laaditakse `<head>`-is ilma `defer`'ita): `Lukk.valmis()` näitab avamisvaadet
  `<div id="lukk">`, kuni parool on sisestatud (`lukk.json` 404 = lukku pole, leht avaneb kohe); `Lukk.fetch()`
  dekrüpteerib ümbriku ja tagastab tavalise `Response`'i, krüpteerimata fail ja Eleringi vastus lähevad läbi muutmata;
  vale või vahetatud parooli korral küsitakse uuesti. Võti (mitte parool) hoitakse `sessionStorage`-is või
  „Jäta meelde selles seadmes“ korral `localStorage`-is (`kauge32_lukk`); jaluse „Lukusta leht“ unustab võtme.
  `html.lukk-ootel .app { visibility: hidden }` seatakse enne esimest joonistamist, `.app` on lukus olles `inert`.
- `css/common.css` jaotis 29 „Lukk“: täisekraani kiht lehe tokenitega (hele, tume, sunnitud värvid, print peidetud).

### 2. Otsingumootorid
- `<meta name="robots" content="noindex, nofollow, noarchive">` mõlemal lehel (varem `noindex`).
- `robots.txt`: andme- ja abifailid blokeeritud, HTML-lehed tahtlikult loetavad, et `noindex` jõuaks robotini
  (README „Otsingumootorid“).

---

## [3.1.0] ja energy-dashboard.html [2.1.0] — 2026-10-30

Prognoos päevatüübi järgi, elektriinfo lehe „Eile“ rida ja müügitasu `index.html`-i CONFIG-is. `APP_VERSION` `3.1.0` / `2.1.0`, `css/index.css?v=20261030`. Kuu- ja päevakirjeid ümber ei arvutata (tasude ja müügitasu väärtused ning sõrmejäljed ei muutunud).

### 1. Tarbimise prognoos päevatüübi järgi (`energy-dashboard.html`)
- `loadForecastProfile(now, dayStart)`: prognoositava päevaga sama tüüpi (tööpäev / puhkepäev – laupäev, pühapäev, riigipüha, `isRestDay`) viimase 7 täieliku päeva keskmine; alla 3 sama tüüpi päeva korral kõigi viimase 7 päeva keskmine (`kind: 'all'`). Sildid (`forecastBasis`): „7 tööpäeva keskmine“, „7 puhkepäeva keskmine“, „7 päeva keskmine“ – selgituses, legendis ja homses plaadis.
- Andmed (142 päeva): puhkepäeval on hommik madalam ja keskpäev kuni ~2,5 kW kõrgem, päeva tarbimine ~6 % suurem; tagasiulatuvalt (112 päeva) väheneb tunni viga 1,16 → 1,10 kW ja päeva viga 14,3 → 13,7 kWh.

### 2. Elektriinfo lehe „Eile“ rida (`index.html`, `css/index.css`)
- Päikesekaardi põhjas: „Eile (inverter): aku tulu ≈ +15,27 € · maja maksis 24,51 s/kWh (keskmine ostuhind 30,76, 20% odavam)“ ja link energialehe perioodivalikule. Andmed `paevad.json`-i eilsest kirjest (`loadDaysData`, uus `CONFIG.paike.paevadeFail`); kirje puudumisel on rida peidetud.
- Töövoog lisab päevakirjele tuletatud välja **`batteryGainEur`** (`battery_gain`, sama valem mis energialehe `finishTotals`, mahutavus energialehe `CONFIG.aku.mahtKwh`-st, `meta.batteryKwh`). See arvutatakse igal käivitusel kirje väljadest (Solarmani päringuid ei lisandu); kontrollitud: 142 päeval sama mis energialehel (≤ 0,0005 € ümardus).

### 3. Müügitasu ühes kohas
- Uus `index.html` `CONFIG.hinnad.muugitasu` (1,05 s/kWh koos KM-ga). Energialeht loeb selle `loadTariffs`-iga nagu teised tasud (varukoopia energialehe `CONFIG.hinnad.muugitasu`); energialehe `CONFIG.muuk` on eemaldatud. Töövoog (`read_sell_fee`) loeb müügitasu `index.html`-ist; väärtus on sama, seega päevakirjete sõrmejälg ei muutu.

---

## [3.0.0] ja energy-dashboard.html [2.0.0] — uus disain — 2026-10-23

Mõlema lehe kujundus on uuesti üles ehitatud omaniku tellitud põhimõtetel: **Bento Grid, klaasmorfism, SVG energiavoog ja Chart.js graafikud**; olemasolev aku tähistus (`buildBatterySvg`, `batteryColor`, „laeb / tühjeneb / ootel“) jäi alles. `APP_VERSION` on `index.html`-is `3.0.0` ja `energy-dashboard.html`-is `2.0.0`, CSS-i ja sprite'i lingid `?v=20261023`. Alus oli main'i seis pärast PR #14 (index 2.5.0, energialeht 1.5.0). **Andme- ja loogikakiht ei muutunud:** `CONFIG`, laadimine, normaliseerimine ja kõik arvutusfunktsioonid on mõlemas lehes baidi täpsusega samad (ainult `APP_VERSION`), töövood on muutmata; muutusid markup, CSS ja renderdamiskiht. Kõik vanal lehel kuvatud numbrid on uuel lehel samad (kontrollitud fikseeritud kellaga 22.10.2026 23:34 pinned andmefailidega).

Disain sündis kolme sõltumatu kontseptsiooni („Hind esimesena“, „Energiavoog keskmes“, „Rahulik tööriist“) ja kahe kohtuniku hindamise põhjal; võitis „Rahulik tööriist“, millesse liideti teiste parimad ideed. Lõplik spetsifikatsioon (tokenid, ruudustik, komponendid, iga graafiku Chart.js seadistus, ikoonid, tekstid, 108 `data-testid` atribuuti) testiti enne ehitust prototüübina Playwrightiga.

### 1. Disainisüsteem (`css/common.css`, `img/icons.svg`)
- **Tokenid ainult ühes failis:** `css/common.css` sisaldab heleda ja tumeda komplekti (tume `:root[data-theme="dark"]` ja `prefers-color-scheme: dark` all, ainult `@media screen` → prinditakse heledana), klaasi, mesh-tausta, bento-aluse, komponendid, graafikuraami, olekud ning `prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors` ja `@supports not (backdrop-filter)` varuvariandid. `css/index.css` ja `css/energy-dashboard.css` sisaldavad ainult lehe `grid-template-areas` paigutust ja lehepõhiseid komponente.
- **Klaas:** kaardid `rgba(255,255,255,.76)` / `rgba(21,30,43,.74)` + `backdrop-filter: blur(16px)` (telefonis 12 px) madala kontrastiga mesh-tausta kohal; kaardi sees on ainult läbipaistmatud pinnad (plaadid, graafikukaev, tabelid). Tekst on halvimal komposiitpinnal ≥ 7:1 (mõõdetud renderdatud kaardilt), hinnaklasside märgid ≥ 3:1.
- **Bento-ruudustik:** `.layout` 1 / 6 / 12 veergu (< 640 / 640–1023 / ≥ 1024 px) nimetatud aladega; telefonis DOM-järjekord. Elektriinfo: hind 7 + odavaim aeg 5, graafik 12, päike ja aku 7 + lõpphind 5, maja 12. Energia: soovitus 12, voog 7 × 2 rida + hind 5 ja uus „Järgmised tunnid“ 5, aku 6 + päikesepark 6, „Täna kokku“ 12, päeva ülevaade 12. Kaardi sisemine paigutus kohandub konteineripäringuga (`@container`), vaadete filtris on nähtav kaart terve rea laiune.
- **Hinnaklasside skaala** on uus semantiline soojusskaala mõlemas teemas (heledus ja kontrast muutuvad hinnaga monotoonselt; naaberklasside ΔE ≥ 15 tavanägemisel, ≥ 8 deuteranoopias; validaatoriga kontrollitud). Osapooled: päike `--solar`, maja `--home`, võrk/ost `--grid`, müük `--export`, aku `--battery`; valik/aktsent `--focus`. Üks hero-number vaate kohta (börsihind 52 / 60 px), teised suured numbrid 32 / 40 px.
- **Piktogrammid:** 20 ikooni sprite'is `img/icons.svg` (`<use href="img/icons.svg?v=…#i-…">`, JS-is `iconEl()`), sh aku, kontrast (teemanupp; päike jääb osapoole ikooniks), olekuikoonid `i-check-circle` / `i-alert-triangle` / `i-x-circle` olekupillis ja märkides. `index.html`-i inline sprite on eemaldatud.
- **Komponendid** (klassinimed on leping, vt `css/common.css`): kaart ja päis, plaadid ja rühmad, märgid ja olekupill, vaatepillid, vahelehed (`.tab__badge` „uus“ täpi asemel), segmentlülitid, nupud, HTML-legend (`.legend__swatch`, `.line-key`, `aria-pressed` lülitusnupud), graafikukaev (`.chart-well`, `.chart-stack`, `.chart-host--*`), režiimiriba, tooltip ja inspektor, tabelivaade, skeleton, teated. Puutealad ≥ 44 px, fookusrõngas 3 px `--focus` (forced-colors: `Highlight`).

### 2. Graafikud Chart.js 4.5.1-ga (`js/vendor/chart.umd.min.js`)
- Teek on repo sees (CSP lubab skripte ainult samalt saidilt) ja laaditakse `<head>`-is `defer`-iga; kui see ei laadi, näitab iga graafikukaev teate ja tabelivaated avanevad. Käsitsi joonistatud SVG-graafikud ja nende CSS on eemaldatud.
- **„GRAAFIKUTE ÜHISOSA“** on identne skriptiplokk mõlemas lehes (identsust kontrollib spetsi p 12.3 `diff`): tokenitest loetud värvid (`chartTokens`, teema vahetus joonistab ümber ilma andmeid laadimata), tekstuurid `forced-colors` / `prefers-contrast: more` korral, Tallinna aja tunnisildid (DST „03*“), virna ühine y-telje laius (`--plot-left` / `--plot-right` ka režiimiribale), tulba laius plot-laiusest, möödunud/pooleli toonid läbipaistmatu seguna, pluginad (keskmine, odavaim aken, praegune periood ja „praegu“-joon, lävijooned, mõõtmiste lõpu rõngas ja silt „kuni HH:MM“, mis väldib „praegu“-joont ja teisi jooni, „praegu“-silt, mis nihkub kesköö lähedal ühikusildi alt plot-alasse, võrguga vahetuse nurgasildid, mis väldivad tulpi ja teisi silte, puuduva perioodi pesa, otsasildid, ühik), ristjoon, tooltip ja inspektor, puude ja klaviatuur (nooled, `PageUp`/`PageDown`, `Home`/`End`, `Esc`; teade `#chart-announcer`-isse ainult klaviatuurilt), print ja `beforeprint`. Graafikutel pole animatsiooni; minutitikk ainult joonistab (`updateNowMarkers`), ei ehita ümber.
- **Kaksiktelge pole kuskil:** elektriinfo hinnagraafik on kahe paneeli virn (hind; kWh-paneel ostu ja päikesega omaette teljel), energialehe päeva ülevaade on nelja osa virn (hind koos ostu- ja müügihinnaga; „Energiavood“ või „Võrguga vahetus“; HTML/CSS režiimiriba; **aku laetus % omaette paneelina** reservijoonega 20 %). Lisaks Chart.js-is: maja 12 kuu rühmatulbad (päikesepargi algus punktiirjoonena, valitud kuu silt ja peidetud DOM-kaksik `building-selected`), hinnakomponentide osakaalu riba, energialehe päevade graafik (5 näitajat, valitud päeva inspektor) ja uus „Järgmised tunnid“ horisontaaltulbad. Igal graafikul on HTML-legend (≥ 2 sarja), tabelikaksik ja `aria-label`.
- Telefonis (< 768 px) ja puutel on hõljuv tooltip asendatud fikseeritud kõrgusega inspektoriga (graafik ei nihku); laial ekraanil on tooltip tulba kõrval.

### 3. Elektriinfo leht (`index.html` 3.0.0)
- Uus kaartide järjekord (= DOM = telefoni järjekord): „Elekter praegu“ (hero) → „Leia odavaim aeg“ → „Börsihind eile, täna ja homme“ → „Päike ja aku“ → „Hind koos tasudega praegu“ → „Maja üldelekter“. Päises on sama `nav.site-nav`, olekupill ikooniga ja teemanupp `i-contrast`; vaadete riba murdub mitmele reale.
- Päeva kokkuvõtte kuu-rühm on eemaldatud (samad arvud on maja kaardil); „Tabelivaade (tunni kaupa)“ on uus. Päikesekaardil on kompaktne SVG-voog (päike, maja, võrk, aku rida), olekupill ja neli plaati. Lõpphinna kaardil on komponentide tabel ja osakaalude riba Chart.js-is.
- Sildid: „ost võrgust (võrguarvesti)“ legendis ja tooltipis, plaadil „võrguarvesti (Estfeed) · kuni HH:MM · arve alus“; „(inverter)“ väiketähega. Numbrid ja ühikud on mittekatkeva tühikuga („11 kW“, „10 686 kWh“), tabelivaate kerimisvihje on ekraanilugejale peidetud, päikeseenergia väärtus näitab hindade puudumisel „—“ („hinnad puuduvad“).

### 4. Energialeht (`energy-dashboard.html` 2.0.0)
- Uus kaartide järjekord: soovitus → „Energiavoog praegu“ (7/12 × 2 rida; SVG kolme geomeetriaga: kompaktne telefonis, lai ≥ 520 px konteineris ja ≥ 1024 px kõrge „lohe“ 520 × 520–720, mis täidab kahe rea kõrguse kaardi; joone laius √kW järgi, iga marsruudi lõpus nooleots, kW-pillid ≥ 640 px; täpid liiguvad ainult liikumiseelistuse lubamisel, muidu on joon pidev ja suunda näitab nooleots; vananenud olekus on tuhm ainult graafika, tekst jääb täiskontrastiga) → „Elektrihind praegu“ (hero) → uus kaart **„Järgmised tunnid“** (Chart.js; varem hinnakaardi sees; graafiku all hinnaklasside legend sõna ja vahemikuga) → „Akupank“ (aku glüüf ja tähistus endised) → „Päikesepark“ → „Täna kokku“ (perioodivalik, 4 plokki – kitsas plokis silt väärtuse kohal –, maja energiahind, „Kogusummad tabelina“, mitme päeva korral päevade graafik, mille legendis on ainult perioodis esinevad sarjad, ja tabel) → „Päeva ülevaade“ (tunnitabelis ka müügihind ja valdav inverteri režiim; osaline „Homme“ päev joonistatakse, puuduvad perioodid punktiirpesaga).
- Päises on uus teemanupp (sama `kauge32_theme` võti ja `<head>`-i teemaskript nagu elektriinfo lehel). Tänased kogused on tulemuste kaardil (voo kaart viitab sinna). Laadimise ajal on kaartidel lõppmõõtudes skeletonid (paigutusnihe esimesel laadimisel ≤ 0,01) ja 640–889 px laiusel on päise nupud alati teisel real. Hindade laadimisvea korral on hinnakaardil, bänneris ja graafiku all teade koos „Proovi uuesti“ nupuga; soovituse kiibi ikoon tuleb soovitatud tegevusest (aku, päike, tarbi, võrk, oota).

### 5. Kontroll
- Kontrollraamistik (Playwright, fikseeritud kell, pinned andmefailid): 0 konsoolivea ja 0 ebaõnnestunud päringut mõlemal lehel 390 ja 1280 px heledas ja tumedas teemas; kõik vana lehe numbrid olemas (puuduvad ainult lõuendile joonistatud teljesildid); `verify_config.py` (CONFIG regexid, CSP, välisviited) ja loogikakihi diff (ainult `APP_VERSION`); ühisploki identsus; mobiilis horisontaalset kerimist pole; puutealad ≥ 44 px; 4× CPU aeglustusega kerimine ≥ 60 fps.
- Kaks sõltumatut QA-vooru (elektriinfo: 6 väikest leidu; energialeht: 4 olulist ja 9 väikest) on parandatud: „kuni HH:MM“ silt ei jää „praegu“-joone alla, `building-selected` kaksik, mittekatkevad ühikud, energiavoo kaardi kõrgem geomeetria laial ekraanil, skeletonid lõppmõõtudes (paigutusnihe), voo suund loetav ka ilma liikumiseta, vananenud oleku tekstikontrast, hindade veaolek koos „Proovi uuesti“ nupuga, osaline „Homme“ päev graafikul, siltide kokkupõrked ühisplokis, päevade graafiku legend, „Järgmised tunnid“ hinnaklassi sõnad, tunnitabeli müügihinna ja režiimi veerud, tulemusplokkide read, soovituse ikoonid, tühi tabelivaade laadimisel.

### 6. Teadlikult muutmata
- `CONFIG` ja kõik arvutused, töövood ja andmefailide lepingud; otseühenduse dialoog; aku tähistus; allikasildid ja lõikeajad (2.5.0 / 1.5.0 reeglid). Tariifid loetakse endiselt `index.html`-i CONFIG-plokist regulaaravaldisega.

---

## Töövood: samaaegsed käivitused — 2026-10-22

- PR-ide #12 ja #13 ühendamine 23 s vahega käivitas kaks „Uuenda elektrihinnad“ käivitust. Teine võttis aluseks oma sündmuse commit'i (mitte `main`-i uusimat seisu), selle push lükati tagasi ja `git pull --rebase` jooksis `hinnad.json`-is ja `paevad.json`-is konflikti (punane käivitus). Sama võis juhtuda varem, kui käivitus ootas järjekorras (`concurrency`).
- Mõlemas töövoos (`uuenda-hinnad.yml`, `uuenda-paike.yml`): `actions/checkout` võtab haru uusima seisu (`ref: github.ref_name`). Kui push'i järel tekib andmefailides konflikt, katkestatakse rebase ja käivitus lõpeb hoiatusega („Teine käivitus uuendas samal ajal andmefaile …“): andmefailid on täielikult tuletatud ja järgmine käivitus arvutab need uuesti.

---

## energy-dashboard.html [1.5.0] — tarbimise prognoos — 2026-10-22

Maja tarbimise prognoos päeva graafikul. `APP_VERSION` `1.5.0`, CSS-i lingid `?v=20261022d`. Päikese prognoosi ja inverteri plaani ei kuvata (omaniku otsus).

### 1. Töövoog (`uuenda-hinnad.yml`, `paevad.json`)
- Päevakirjel on maja tarbimise tunniprofiil `loadH` (24 kellatundi, kWh tunnis; mõõtmisteta tund `null`, kellakeeramise päeval korduv tund keskmine). Viimase `PROFIIL_PAEVI` (14) päeva kirjed ilma `loadH`-ta arvutatakse üks kord uuesti (Solarmanist kuni 10 päeva käivituse kohta; eilne `paike.json`-ist). `PAEVAD_VERSION` jääb 1 (väli lisandub, olemasolevad väärtused ei muutu).

### 2. Energialeht
- **Prognoos** (`loadForecastProfile`, `buildLoadForecast`): viimase 7 täieliku päeva sama kellatunni keskmine (vähemalt 3 päeva). Võimsuspaneelil katkendjoon maja tooniga – „Täna“ praegusest hetkest päeva lõpuni, „Homme“ terve päev (alumine paneel on siis ainult prognoos). Tooltipis „maja prognoos 14,9 kW“ perioodidel, millel mõõtmist pole.
- „Homme“ plaat **Tarbimise prognoos** (≈ kWh ja ≈ € võrgust ostes, lõpphinnaga) ning graafiku all selgitus (päevade vahemik, kogus, maksumus, täna lisaks mõõdetud + prognoos kokku).
- Prognoos on märgitud „prognoos“ ja „N päeva keskmine“, mitte „(inverter)“ (reegel 6); nädalapäevi ja ilma ei arvestata.

---

## energy-dashboard.html [1.4.0] ja päevakokkuvõtted — 2026-10-22

Kokkuvõtte perioodivalik (eile, 7 päeva, kuu) ja päevade graafik. Uus andmefail `paevad.json`, mille kirjutab töövoog `uuenda-hinnad.yml`. `APP_VERSION` `1.4.0`, CSS-i lingid `?v=20261022c`.

### 1. Töövoog ja andmefail (`uuenda-hinnad.yml`, `paevad.json`)
- **Päevakokkuvõtted** (`update_daily_summaries`, `compute_day_record`): iga lõppenud päeva inverteri kWh ja € (päike, maja, ost, müük, aku laetud ja tühjendatud) ning laetus päeva alguses ja lõpus. Reeglid on samad mis energialehe `computeDayTotals`-is (`frame_sample` = `sampleFromRaw`, `solar_split` = `allocateFlows`); kontrollitud: tänaste kaadritega annavad mõlemad samad kWh ja € (3 komakohta).
- Eurod `calc_final_cents_kwh`-ga (perioodikohased tasud ja KM, sama mis kuude summadel), müügihind = börsihind ilma KM-ta − `energy-dashboard.html` `CONFIG.muuk.tasu`.
- **Eilne päev** `paike.json`-ist (poolik päev arvutatakse järgmistel käivitustel uuesti), **varasemad päevad** `CONFIG.paike.kasutuselAlates` kuust alates Solarmani history-päringuga, 10 päeva käivituse kohta (uuemad enne). Töövoo sammule lisati `SOLARMAN_*` Secrets; nende puudumisel arvutatakse ainult eilne päev.
- Kirje sõrmejälg `cfg` (tasude sõrmejälg + müügitasu) ja `v` (`PAEVAD_VERSION`): muutusel arvutatakse päevad järk-järgult uuesti. Päevakokkuvõtte viga ei takista `hinnad.json`-i uuendamist. Commit lisab `paevad.json`-i, kui see on olemas.

### 2. Energialeht
- **Perioodivalik** kokkuvõtte kaardil (pealkiri „Täna kokku“, „Eile kokku“, „7 päeva kokku“, „Oktoober kokku“ …): sama neli plokki ja maja energiahind perioodi kohta (`buildPeriodView`, `sumTotals`, `finishTotals` – päeva ja perioodi tuletatud näitajad ühest funktsioonist). Lüliti on peidetud, kuni `paevad.json`-i pole (leht töötab nagu varem).
- **Päevade graafik** (`buildDaysChart`, `renderDaysPanel`): päike, tarbimine, võrk (ost alla, müük üles), aku (laetud üles, tühjendatud alla) ja energiahind (keskmine ostuhind vs maja maksis, s/kWh); valitud päeva rida graafiku kohal, nooleklahvid, tuhmim tulp = pooleli päev või mõõtmistes auke; tabelivaade päeva kaupa.
- Märkused: laadimata päevad („laaditakse järk-järgult“) ja aukudega päevad. Perioodi eurod on „—“, kui mõnel päeval eurod puuduvad.
- `index.html`: `CONFIG.paike.kasutuselAlates` kommentaar (määrab ka päevakokkuvõtete alguse); väärtus ja võti on samad.

---

## energy-dashboard.html [1.3.0] — 2026-10-22

Energialehe täiendused olemasolevate andmetega (uut andmeallikat ega töövoo muudatust pole): päeva tulemus kWh ja eurodes, inverteri režiim, ostu- ja müügihind graafikul, aku laetus graafikul, võrguga vahetuse vaade ja 15 min / 1 h samm. `APP_VERSION` `1.3.0`, CSS-i lingid `?v=20261022b`. Kõik kogused on endiselt inverteri mõõtmised; eurod on ≈-ga hinnangud perioodi hinnaga.

### 1. Seaded (omaniku vastused)
- `CONFIG.aku.mahtKwh` = **100** (kasutatav mahutavus): laadimis-/tühjenemisaja hinnang, „Salvestatud“ plaat ja aku tulu laetuse muutus.
- `CONFIG.muuk.tasu` = **1,05** s/kWh (müügilepingu marginaal koos KM-ga): müügihind = börsihind ilma KM-ta − 1,05; müügihinnale KM-i ei lisata.

### 2. Täna kokku (`#section-results`, `renderResults`, `computeDayTotals`)
- Neli plokki: **Aku** (tulu, laetud/tühjendatud kWh ja €, laetuse muutus), **Võrk** (ost, müük, netokulu), **Päike** (toodang, väärtus, päikesest kaetud), **Tarbimine** (kWh, hind ilma päikese ja akuta, võrgu netokulu).
- **Maja energiahind täna:** keskmine ostuhind (maja tarbimine lõpphinnaga) → maja maksis (võrgu netokulu / tarbimine), „x % odavam“ ja aku laetuse muutuse selgitus.
- Arvutusreeglid (`computeDayTotals`): ost, maja tarbimine ja aku tühjendamine lõpphinnaga; müük ja päikesest laetud energia müügihinnaga; päike otse majja lõpphinnaga, akusse/võrku müügihinnaga. Aku tulu = tühjendamise väärtus − laadimise kulu + laetuse muutus × tänane keskmine laadimishind (ilma selleta oli eile laetud energia tühjendamine „tasuta“: näidisandmetel +12,40 € → +9,21 €).

### 3. Päeva graafik
- **Inverteri režiimi riba** (`buildModeRuns`, `inverterMode`): laeb võrgust / laeb päikesest / aku kasutus / müük võrku / aku ootel iga 15-min kaadri kohta, ka 1 h vaates. Mõõtmistest tuletatud olek, mitte plaan. Riba kohal „Inverter praegu: Aku kasutus · alates 22:00“ (`renderCurrentMode`).
- **Ostuhind ja müügihind** astmeliste joontena hinnapaneelil (pidev neutraalne / punktiir; mitte hinnaklassi toonid); telg mahutab mõlemad. Tooltipis ka „müügihind“.
- **Aku laetus** punktiirjoonena võimsuspaneelil, parem telg 0–100 % (ei ole eraldi paneel: graafik ei lähe kõrgemaks).
- **Võrguga vahetus** (lüliti „Energiavood / Võrguga vahetus“, ainult „Täna“): ost allapoole ja müük ülespoole, kWh perioodi kohta (ainult mõõdetud osa); tooltipis kogus ja ≈ €.
- **1 h / 15 min** lüliti (nagu elektriinfo lehel; telefonis vaikimisi 1 h): tunnised hinnad on veerandtundide kestusega kaalutud keskmine, võimsused tunni keskmised, laetus tunni viimane. Joon katkeb ainult üle ühe sammu pikkuse augu korral.
- **Päeva kogusummad** (`renderChartSums`, avatav plokk): päike, maja, ost, müük, aku laetud/tühjendatud – kWh, ≈ € ja keskmine s/kWh.
- Uued tokenid ainult energialehel (`css/energy-dashboard.css`): `--export` (müük, lilla) ja `--mode-idle` (aku ootel), heledas ja tumedas teemas.

### 4. Teadlikult tegemata
- Inverteri plaani ja päikese prognoosi ei kuvata (omaniku otsus). Režiimiriba näitab ainult mõõdetud minevikku.
- Perioodivalik (nädal, kuu) vajab päevakokkuvõtete faili – järgmine samm.

---

## [2.5.0] ja energy-dashboard.html [1.2.0] — 2026-10-22

Graafikute ülevaate (21.10.2026) punkti 5 kõik soovitused („Kohe“, „Järgmisena“ ja „Hiljem“) mõlemal lehel ja mõlemas töövoos. Leiu tunnused (`L-…`, `K-…`) on ülevaate omad. `APP_VERSION` on `index.html`-is `2.5.0` ja `energy-dashboard.html`-is `1.2.0`, CSS-i lingid `?v=20261022`. Kõik numbrid on endiselt mõõtmised (Estfeed, inverter) või ≈-ga märgitud hinnangud; muutusid tõlgendus, allikasildid, graafikud ja kujundus. Viimased read igas punktis („Lõppkontroll“, „Teine kontroll“) on sõltumatute kontrollide järel tehtud parandused.

### 1. Töövood ja andmefailid (`uuenda-hinnad.yml`, `uuenda-paike.yml`)
- **Tasude ajalugu (L-087, L-077, L-036):** `TASUDE_AJALUGU` `KM_AJALUGU` kõrval: taastuvenergia tasu 1,05 (2024) / 0,84, varustuskindluse tasu 0,758 alates 01.01.2026, aktsiis 0,145 enne 01.05.2025 (allikad kommentaarides). Kuutasu on kuupäevapõhise ajalooga mehhanism (summad 0, vt p 9); jooksval kuul ja `eurToDate`-is lisatakse möödunud osa.
- **Ümberarvutus (L-022):** `CALC_VERSION` 3 ja kuu kirje tasude sõrmejälg `cfg`: CONFIG-i tasu või ajaloo muutusel arvutatakse vahemälus olevad kuud järgmisel käivitusel perioodikohaste tasudega uuesti. Kuu kirjel `updatedAt` (muutub ainult sisu muutusel).
- **kWh kaitsed (K-003, K-004, L-081, L-082):** tunnine Eleringi rida saab nelja veerandi summa ainult täistunni korral; tunnine Estfeed jagatakse 15-min ridadele märkega `kwhRes: "hour"`; puuduvat hinnaperioodi ei sillutata (hoiatus); osaline Estfeedi vastus ei kustuta varem avaldatud kWh-d; EIC-varuvariant võtab vastusest ainult `ELERING_EIC` mõõtepunkti.
- **JSON-lepingud (L-083, L-084, L-056, L-085, L-057):** `hinnad.json` tipptasemel `meta` (`pricesOk`, `pricesUntil`, `estfeedOk`, `estfeedUntil`, `tariffs`, `warnings`); tariifid loetakse ainult `index.html`-i CONFIG-plokist (`meta.tariffs.source`). `paike.json`: ka eilsed kaadrid (vanad ja uued ühendatakse, lühem vastus ei kustuta päeva algust), `frameSeconds`, `data.meta` (`framesUntil`, `warnings`); Solarmani ~10× vale `data.day` on eemaldatud. Lehed toetavad ka vana kuju.
- **Ajastus ja märgid (L-075, L-047, L-044):** väline ajastaja iga 30 min (GitHubi `schedule` on varu); pargi võimsus `installedCapacityKw` kord päevas; logihoiatus, kui |`gridPower`| ≥ 50 W või |`wirePower` − `purchasePower`| ≥ 50 W (müügi märk on seni kontrollimata).
- **Lõppkontroll (L-022, L-081):** tühi Estfeedi vastus (HTTP 200 `[]`) täieliku ümberarvutuse ajal ei muuda enam varem mõõdetud kuid „andmed puuduvad“ kirjeks (kuu jääb alles, üks koondhoiatus „Estfeed ei andnud mõõteandmeid N kuu kohta …“; `noData` tehakse ainult kuule, millel mõõdetud kirjet pole). Jooksva kuu kWh ei kahane sama kuu jooksul: tühi või ainult viimaseid päevi kattev vastus jätab kirje varasemaks (hoiatus „Estfeedi vastus oli puudulik …“).
- **Teine kontroll (toru2-01, toru2-02, toru2-06, andmed-1):** 31-päevane kuu päritakse kahes lõigus (30 + 1 päeva); kui üks lõik tuli tühjana või auklikuna, salvestati osaline kuu lõplikuna uue `cfg`-ga ja hoiatuseta (nt 2025-05 3 452 → 111 kWh). Nüüd kontrollitakse lõpliku kuu kaetust: alla 99 % perioodidest ja varasemast väiksema kWh korral jääb varasem kirje alles (koondhoiatus „Estfeedi vastus oli N kuu kohta osaline …“) ja kuu arvutatakse järgmisel käivitusel uuesti. Vana faili ülekirjutuse kaitse võrdleb viimase hinnarea **lõppu**, mitte algust: tunnine Eleringi vastus (viimane rida 23:00) 15-min faili (viimane rida 23:45) peal ei katkesta enam iga käivitust („ulatub vähem tulevikku“), K-003 test kasutab nüüd 15-min vana faili. `meta.warnings` on tavakeeles, sest lehed näitavad neid elanikele („Estfeed andis ainult tunnised kogused; 15-min jaotus on tunni keskmine“, „Tasude seadeid ei saanud lugeda …“, „Estfeedi ligipääs pole seadistatud …“); sisemised nimed (`kwhRes`, `CONFIG`, `TASUDE_AJALUGU`, `ELERING_CLIENT_ID`) on ainult Actions-i logis. `paike.json` `meta.framesUntil` on viimase kaadri lõpp, kuid mitte hilisem kui viimane mõõtmine (`lastUpdateTime`): pooleli kaader oli kuni 15 min tulevikus. Kommentaar „gridPower on alati 0“ → „peaaegu alati 0 (ostu ajal harva paar kümmet vatti)“.

### 2. Päikesekaart (`index.html`; L-074, L-044, L-045, L-046, L-047, L-048, L-051, L-055, L-058, L-085, L-133, L-078, L-083, L-075, L-056)
- **Aku märk:** `batteryKw = |chargePower| − |dischargePower|` (realTime'is on laadimine negatiivne, leht näitas laadivat akut tühjenevana); hoidevool (< 0,2 kW, laetus ei muutu) on „ootel“. **Müük** ainult ostuta ja kadude varu (0,3 kW / 3 %) ületava ülejäägiga.
- **„Päikesest kaetud 32 %“** (toodang − müük) / tarbimine, alltekst „täna · 43,5 kWh 136,5-st“ – sama mõõdik mis energialehel; korduv kWh-lause eemaldatud.
- **Allikad ja lõikeajad:** Estfeed legendis, tooltipis, inspektoris ja plaadil („Estfeed · kuni 14:15 · arve alus“), inverteri ost „(inverter)“ koos lõikeajaga, võrgusõlm „Elektrivõrk · ost võrgust · inverter“; lause inverteri ja Estfeedi erinevusest samades perioodides (arve ja inverteri arve ei liideta).
- **Aegumine ja kesköö:** lävi 45 min (`CONFIG.paike.aegunudMinutites`, sama energialehel), märgil „Mõõdetud 14:59 · 23 min tagasi“; pärast keskööd „Uus päev algas …“, mitte „vananenud“. Kohatäide ilma arvudeta, laadimise ajal „Laadin…“.
- **Laadimine võrgust:** sõlmedes „sellest akusse 18,8 kW“, lause „Akut laeti täna … (võrgust …, päikesest …)“ üle 1 kWh korral. Pargi võimsus `installedCapacityKw`-st („41% võimsusest“).
- **Mobiil:** ≤ 480 px lühikesed sõlmesildid, „tipp 11,2 kW · 12:15“, olekumärk oma real. Andmete seis (`meta`) päise vihjes ja jaluses; „Eile“ vaates päikesejoon, kui failis on eilsed kaadrid.
- **Lõppkontroll:** aku lausel on allikas ja lõikeaeg („Akut laeti täna (inverter, kuni 14:59) 31,8 kWh …“, lepe 6); jaluses kaadri pikkus failist („inverteri 15-min kaadrid“, L-056); ≤ 380 px väiksem sõlmekiri, kitsamad noolte vahed ja „Päikese-park“ poolitub (320–375 px ulatus tekst üle sõlme serva, L-058). `meta.pricesOk: false` tähendab auku või tunnist sammu (ebaõnnestunud päring faili ei kirjuta): jaluses ei väideta enam „börsihindade viimane päring ebaõnnestus“, märk on „OSA ANDMEID PUUDU“, mitte „VANANENUD“.
- **Teine kontroll (andmed-1, andmed-3, andmed-4, L-051, V2-VIS-01, V2-VIS-05):** kogused, plaatide „kuni HH:MM“ ja jaluse „kaadrid kuni“ lõpevad inverteri viimasel mõõtmisel (`lastUpdateTime`), mitte lehe kellal ega pooleli kaadri lõpul – öösel 03:10 oli „kuni 03:10“, jaluses „kuni 03:15“ ja maja tarbimine 0,6 kWh mõõtmisest suurem, kuigi mõõdetud oli 03:04 (sama energialehel). Kui realTime'is puuduvad `chargePower` ja `dischargePower` (Solarman andis `null`), loetakse aku suund `batteryPower`-ist (< 0 = laeb), mitte „ootel“. „Päikeseenergia väärtus“ plaadil „täna kuni 14:59 · hinnang …“; „Maja tarbis täna“ alltekstis „ost võrgust 126,5 kWh (inverter), sellest akusse 31,2 · kuni 14:59“. Kahe veeru paigutuses (768–1179 px) ja printimisel on neli plaati kahes veerus: väärtus „136,5 kWh“ lõigati kitsal plaadil „136,5 k“-ks ja „43,5 kWh“ „43,5 kW“-ks. 768–1023 px on voosõlmedes lühikesed sildid nagu telefonis („tipp 11,2 kW · 12:15“, „ost võrgust“; „tänane tipp …“ oli 7 real), „ost võrgust · inverter“ punkt ei jää üksi reale.

### 3. Hinnagraafik, tooltip ja päeva kokkuvõte (`index.html`; L-001–L-010, L-012–L-017, L-019, K-002–K-004, K-006, L-054, L-089, L-102, L-104, L-119, L-126, L-128, L-129, L-139, L-140, L-142, L-144, L-147)
- **Telefonis (< 768 px) on vaikimisi 1 h vaade (L-003)** – see muudab 2.2.0 otsust „Vaikimisi 15-minutiline vaade“: 15 min tulbad olid 390 px laiusel ~2,7 px. Ilma kasutaja valikuta vahetub samm ka akna suuruse muutmisel; lüliti „1 h / 15 min“ valik jääb kehtima. Kitsal plotil 15 min tulbad ilma vahe ja ümardusteta.
- **Päikesejoon (L-001):** pooleli perioodi joonele ei kanta (tooltipis „pooleli, kuni HH:MM“); puuduv periood katkestab ostu- ja päikesejoone (L-009). Mõõtmiste lõpus rõngas ja silt „kuni HH:MM“ (L-006).
- **kWh-telg (L-089, L-010, L-002):** kWh null on hinna nulljoonel, skaala kasutab poolt hinnaala kõrgusest, alad tulpade all; sildid paremale joondatud ilma kriipsuta (ei paista miinusmärgina), ühik „kWh / 15 min“ või „kWh / 1 h“.
- **Odavaim aken (L-012, L-104, L-147, L-007):** servad punktiirina, silt „odavaim 2 h · 04:15–06:15“, legendis kriteerium (koos võrgutasuga, keskm.); aken uuendatakse paigas, minutitiks ei joonista graafikut ümber ega peida tooltipi.
- **Päeva keskmine (L-014):** silt vabale küljele; kui see kataks tulpi või kWh-joont, on väärtus legendis („päeva keskmine 8,29“). SVG-tekst 12 px (L-102).
- **Legend (L-128, L-016, L-019):** kaks rühma „Hind, s/kWh“ ja „Energia, kWh / … (parem telg)“, telefonis kahes veerus; tühjal päeval peidetud. Möödunud tulbad tuhmimad, legendis „tuhmim = möödunud“ (L-008; oli „heledam“, vt teine kontroll).
- **Kellakeeramine (K-002, L-017):** 25.10 perioodi lõpp alguse nihkes ja „(suveaeg)“/„(talveaeg)“, x-teljel „03“ ja „03*“.
- **Tooltip ja inspektor (L-142, L-013, L-119, L-005, L-054, L-126, L-144):** aeg, hind ja hinnaklass, „koos tasudega“, kogused värvivõtmega (ost võrgust (Estfeed) koos maksumusega, päike ja maja (inverter), aku laadimine võrgust/päikesest), keskmine kW ja võrdlus päeva keskmisega. Puutel ja kitsal ekraanil tooltipi ei kuvata (info fikseeritud kõrgusega inspektoris, graafik ei nihku); ekraanilugejale teatab ainult klaviatuur (`#chart-announcer`).
- **Päeva kokkuvõte (L-129, L-015, L-140, L-004, K-003, L-139):** rühmad „Hind, s/kWh“, „Ost võrgust sel päeval“ ja „Käesolev kuu · ost võrgust“; inverteri duplikaatplaadid on päikesekaardil. Eile-võrdlus neutraalne; „Homme“ täpi tähendus tekstina, enne avaldamist „(alates 15:00)“. Puuduv hinnaperiood jääb auguks, osaliste homsete hindade teade (K-004); „−0,00 €“ asemel „0,00 €“ (K-006).
- **Lõppkontroll:** puuteekraaniga tahvlis (768–1024 px, `pointer: coarse`) on inspektor samuti kaherealine paneel – üherealises lõigati päikese, maja ja aku väärtus „…“-ga ära ja tooltipi puutel pole (L-126); paneel katab päeva sildi tervenisti. Aku laadimise allikas omistatud energia järgi: „(võrgust 0,0, päikesest 0,5)“ asemel „(päikesest)“, alla 0,05 kWh osa ei nimetata (L-005). Legendis ei murdu „Mõõdukas 10–“ / „20“ (L-128). „Eile“ vaates on tulbad tuhmimad, kui graafikul on eilne päikesejoon – heledas teemas sulandus tume `--solar-line` muidu oranžide ja punaste tulpadega (L-088).
- **Teine kontroll (V2-VIS-03, V2-VIS-04, L-081, L-090, K-004, andmed-1):** kitsal ekraanil (< 768 px) ja puuteekraanil ei kuvata hõljuvat tooltipi ka klaviatuuri ja hiirega – see kattis 390 px laiusel 57–82 % graafikust ja vaadeldava tulba; info on kaherealises inspektoris ja ekraanilugejale `#chart-announcer`-is. Legendis „heledam = möödunud“ → „tuhmim = möödunud“ (0,6 läbipaistvus tumendab tumedas teemas). Estfeedi tunnise koguse neljandik (`kwhRes: "hour"`) on 15-min vaates katkendjoon, legendis „katkendjoon = tunni keskmine“ (tunnivaates on tunnisumma mõõtmine). Hinnaklasside lävejooned on punktiiriga (`2 3`), mitte tavalised ruudustiku jooned. Osaliste homsete hindade korral on vaheleht „Homme (osaline)“, mitte „(alates 15:00)“. Päike: periood, mille viimane kaader on mõõdetud ainult osaliselt, ei ole joonel (tooltipis „mõõdetud kuni 14:59“; praegune periood „pooleli, kuni …“).

### 4. Maja üldelekter (`index.html`; L-023, L-024, L-026–L-030, L-032, L-034, L-035, L-037–L-040, L-121, L-136)
- **Kuud:** jooksev kuu (`isOngoing`, „*“, punktiir) ja esialgne eelmine kuu (`isPreliminary`, 1.–3. kuupäeval, „°“) on eraldi; märk „N täiskuu ost (okt 25 – sept 26): …“; `noData` kuu = „andmed puuduvad“ (graafikus „—“). Jooksva kuu võrdlus ainult sama ajani, inforeal ka terve eelmise aasta kuu.
- **Graafik:** tulbad kuni 26 px, aasta varem tulp täidetud tooniga, y-telg 4–6 jaotust ühikuga, EKI kuulühendid (kitsal 4-täheline variant 10 px, väga kitsal iga teine kuu), aastasilt eraldusjoone järel, päikesepargi algus punktiirjoonena (`CONFIG.paike.kasutuselAlates`).
- **Allikas:** Estfeedi € on hinnang („≈“), CONFIG-i varuandmetel oma legend „haldaja sisestatud kuud (arved)“ ja märkus, € ilma „≈“-ta. Graafik on klaviatuuriga kasutatav (nooled, Home/End), inforida `aria-live`, peidetud andmetabel; surnud `.building-bar` CSS eemaldatud.
- **Lõppkontroll:** valitud kuu väärtussilt arvestab kõiki tulpi, mille kohale see kitsal ekraanil ulatub, ega kata naaberkuu tulpi (L-027); kui aken algab detsembris, jäetakse kitsal ekraanil esimene aastasilt ära (oli „'25'26“, L-030); peidetud sildiga esialgsel kuul on alles „°“, et legendi „° esialgne“ vastaks graafikule (L-023); „≈“ ja „€“ on summaga mittekatkeva tühikuga (`formatEur`, L-035); legendis pole enam sõna „CONFIG“ (L-031).
- **Teine kontroll (V2-VIS-02, V2-VIS-06):** `CONFIG.paike.kasutuselAlates = "2026-06"` (omaniku vastus). Kui „päikesepark“ ei mahu joonest paremale (alla ~350 px), jääb ainult päikese ikoon oma joone kõrvale – vasakule pööratud silt algas aastavahetuse joonelt ja näis märkivat jaanuari (legendis „päikesepark kasutusel alates juunist 2026“, kuu nimi seestütlevas käändes). Eraldusjooned lõpevad baasjoonel ega lõika kuusilte. Kuusiltide vahe on vähemalt ~4 px: 4-täheline variant alla ~600 px laiusel (oli 500 px juures „veebrmärts“ vahega 0), iga teine kuu alla ~440 px (390 px laiusel oli „veeb märt“ vahe 1,2 px).

### 5. Energialehe lõppkontroll
- „Homme“ vahelehel, kesköö järel ja päikeseandmeteta ei ilmu hinnaplaatide alla enam sõna „null“ (`setChildren` filtreerib puuduva „Suurim tarbimine“ plaadi, L-063).
- Kellakeeramise päeval ei jookse „03:00 (suveaeg) · käimas“ „Järgmiste tundide“ tulba peale: esimene veerg laieneb kõigil ridadel ühtmoodi (`subgrid`, K-002).
- `meta.pricesOk: false` ei anna enam bännerit „Töövoog ei saanud … börsihindu uuendada“: hinnad on värsked, auk või tunnine samm on jaluse töövoo hoiatustes.
- **Teine kontroll (L-126, andmed-1, andmed-2, V2-VIS-04, L-090):** puutel ei kuvata hõljuvat tooltipi ja inspektor on fikseeritud kõrgusega kaherealine paneel päeva sildi peal (nagu elektriinfo lehel): olekuriba kasvas puudutusel 26 → 70 px, graafik nihkus 44 px ja tooltip kattis hinnapaneeli; puudutusest tulnud fookus ei too tooltipi tagasi (`:focus-visible`). Päeva kogused, „Täna kuni …“ ja jaluse „kaadrid kuni“ lõpevad inverteri mõõtmisel („Täna kuni 14:59 (inverter)“, öösel 03:04, mitte 03:10/03:15). Tooltipis on hoidevool „aku ootel · hoiab +0,1 kW“, mitte „aku laeb 0,1 kW“ (lepe 1: alla 0,2 kW ja laetus eelmise perioodiga sama). Legend „tuhmim = möödunud“, lävejooned punktiiriga.

### 6. Energialeht (`energy-dashboard.html` 1.2.0)

Energialehe parandused graafikute ülevaate (21.10.2026) punkti 5 järgi. Kõik numbrid on endiselt mõõtmised (`paike.json`, `hinnad.json`); muutusid tõlgendus, sildid ja graafik.

#### 6.1 Andmete tõlgendus
- **Aku märk:** `batteryKw = |chargePower| − |dischargePower|` (nagu elektriinfo lehel). `batteryPower`-i märki kasutatakse ainult nende väljade puudumisel ja see kalibreeritakse kaadritest (enamus, varuks laetuse muutus); vaikimisi `batteryPower` < 0 = laeb. Varem jäi märk viiki ja vaikeväärtus oli andmetega vastuolus.
- **Ost ja müük:** ost = `purchasePower`; `gridPower`-it ei loeta enam ostuks. Müük tuletatakse bilansist ainult siis, kui ostu pole ja ülejääk ületab kadude varu (0,3 kW / 3 % toodangust); muidu 0, ja kui päike või tarbimine puudub, „—“ ja „müüki ei mõõdeta“. `CONFIG.solarman.vorguMark` on eemaldatud.
- **Hoidevool:** alla 0,2 kW muutumatu laetusega on aku „Ootel · hoiab +0,1 kW“; aku vood ei animeeru. kW ja päevakogused jäävad mõõtmisteks.
- **`data.day`** (Solarmani ~10× väikesed päevakogused) ei kasutata ka varuna; otseühendus ei päri neid. Kaadri samm loetakse väljast `frameSeconds` (vaikimisi 900 s); fail võib sisaldada eilseid kaadreid.
- **Kesköö:** tänased kaadrid valitakse igal renderdamisel; kuupäeva vahetusel laaditakse andmed kohe uuesti (minutitaimer ja `visibilitychange`).
- **Aegumislävi** 30 → 45 min, loetakse `index.html`-i `CONFIG.paike.aegunudMinutites`-ist. Aegunud mõõtmisel: pealkiri „Energiavoog kell 14:59“, „mõõdetud 14:59“, „Laeb (14:59)“, voog tuhm ja liikumatu; märgil „Mõõdetud 14:59 · 23 min tagasi“.
- **Puuduv hinnaperiood** jääb auguks (eelmist perioodi ei pikendata); homme on siis „(osaline)“ ja teade „Homsed hinnad on osalised (puudub HH:MM)“.

#### 6.2 Sildid ja kooskõla elektriinfo lehega
- „Isevarustatus 7 %“ → **„Päikesest kaetud 32 %“** (toodang − müük) / tarbimine, alltekst „täna · 43,5 kWh 136,5-st“ – sama mõõdik mis elektriinfo lehel.
- Ost võrgust: „täna 126,5 kWh · ≈ 15,28 € (inverter, hinnang)“, plaatide kohal „Täna kuni 14:59 (inverter)“; jaluses, et arve alus (Estfeed) on elektriinfo lehel. „graafikust kuni 14:59“ → „kuni 14:59“ (viimase arvestatud kaadri lõpp, pooleli kaader kuni inverteri mõõtmiseni; vt p 5).
- **Odavaim 2 h aken** valitakse lõpphinna järgi (`avgFinal`): „koos tasudega 7,34 s/kWh (börsihind 1,88 s/kWh)“.
- „Järgmised tunnid“: esimene rida „15:00 · käimas“ (terve tunni keskmine), mitte „praegu“.
- Võrgusõlme rõngas on võrgu osa maja tarbimisest („23% tarbimisest“), mitte täisring. Voo diagramm on kompaktsem (392 → 324).
- **Kellakeeramine:** `formatTimeRange` kuvab lõpu alguse nihkes ja 25.10 korduvale tunnile lisandub „(suveaeg)“/„(talveaeg)“ („03:45–04:00 (suveaeg)“, tabelis „03:00 (suveaeg)“ ja „03:00 (talveaeg)“).
- Andmete seis (`meta`: hinnad kuni, kaadrid kuni, töövoo hoiatused) jaluses ja päise oleku vihjes; tariifide varukoopia ja `meta.tariffs`-i erinevus bänneris; jaluses „Tariifid: sisemine koopia“.

#### 6.3 Päeva graafik ja tabel
- kW-paneelil lisaks **ost võrgust** (katkendjoon) ja **aku** (+ laeb / − tühjeneb) astmeliste 15-min sarjadena; telg ulatub alla nulli ainult negatiivsete väärtuste korral. Tooltipis „ost võrgust 28,1 kW“, „aku laeb 18,8 kW“ (hoidevool „aku ootel · hoiab +0,1 kW“), „laetus 59%“ (kW ühe komakohaga).
- „Praegu“ joon legendis ja kellaajaga, pv/maja joone lõpus täpp (viimane mõõtmine, ka aria-label'is).
- Odavaim 2 h aken hinnapaneelil (ka „Homme“ vahelehel, kui aken sinna jääb) koos legendikirjega.
- Keskmise silt pannakse vabale küljele; kui see kataks tulpi, on väärtus legendis („päeva keskmine 8,29“).
- Möödunud tulbad `opacity` 0,38 → 0,6, legendis „tuhmim = möödunud“. „Täna“ vahelehel lisaks „Suurim tarbimine“.
- Tabel: veerud „Võrk kW“ ja „Aku kW“ märgiga numbritena (+27,4 / −0,1), selgitus tabeli kohal, kleepuv kellaaja veerg ja kerimisvihje kitsal ekraanil.
- Ligipääsetavus: nähtaval inspektoril pole `aria-live`; ekraanilugejale loetakse ette ainult klaviatuuriga valitud periood (`#chart-announcer`); „Homme“ täpi tähendus on tekstina, enne avaldamist „(alates 15:00)“.

### 7. Kujundus: mõlemad lehed (L-068, L-088, L-090, L-091, L-094, L-097, L-098, L-106, L-138, L-049, K-005, L-145, L-134, L-130, L-146, L-112, L-011, L-120, L-115, L-031, L-035)

Graafikute ülevaate (21.10.2026) punkti 5 kujunduse, siltide ja ligipääsetavuse soovitused (`index.html`, `energy-dashboard.html`, `css/*`). Numbrid ja arvutused ei muutunud, muutusid värvid, sildid, täpsus ja paigutus.

#### 7.1 Ühised tokenid ja värvide tähendus
- **Üks tokenikomplekt kahes failis:** `css/index.css` ja `css/common.css` kasutavad samu väärtusi (pinnad, tekst, hinnaklassid, `--solar`/`--home`/`--grid`, `--solar-line`, `--avg-line`); varem erinesid `--cat-kollane` (`#c48f00` vs `#b58500`), tumedad pinnad (`#131c27` vs `#1a2230`) ja nupuga valitud hele teema süsteemi heledast (`--surface-2 #eef2f6`). Energialehe kasutamata `--bar-primary`/`--share-*` on eemaldatud.
- **Tume teema üks kord:** elektriinfo leht seab `<html data-theme>` alati („auto“ = süsteemi eelistus, ka süsteemi teema vahetusel), juba `<head>`-is enne esimest joonistamist; `css/index.css`-is on hele `:root` ja tume `:root[data-theme="dark"]` (varem kolm koopiat). Tume komplekt on `@media screen` all, seega **prinditakse heledana**.
- **Hinnaklassid:** heledas `--cat-kollane #b07f00` (≥ 3:1 ka `#f5f7fa` plaadil), `--cat-oranz #b54a10`, `--cat-punane #a51a1a` – heledus langeb hinnaga ja kollane/oranž eristuvad ka deuteranoopias; tumedas `#2d9b5a`/`#b08c18`/`#f09549`/`#ff8585` – kallis on kontrastseim, odav ei helenda. Hinnagraafikutel on lävedel 10 ja 20 s/kWh siltideta punktiirjoon, kui teljejaotus seda ei anna.
- **Osapooled mõlemal lehel:** maja = sinine `--home`, võrk ja ost võrgust = terashall `--grid` (`#4f6a8a`, varem lilla energialehel ja sinine `--bar-primary` elektriinfo lehel), päike = `--solar` (`#c27a12`; elektriinfo `--solar-gold` on sellele viide). Elektriinfo lehel kasutavad `--grid`-i ostu joon, voo nool, Elektrivõrgu sõlm ja maja üldelektri tulbad; Maja sõlm on sinine (oli roheline).
- **Mõõdetud päikesetoodangu joon** on mõlemal lehel `--solar-line` (`#92400e` / tumedas `#fde68a`), mitte kollase/oranži tulbaga sama toon; elektriinfo hinnagraafikul päikese ala pole, ostu ala 0,06.
- **Roheline ainult hinnale, olekule ja soodsale muutusele:** odavaim aken, planeerija plaan, legendi ruut ja „Homme“ täpp on sinise aktsendiga `--focus`; madalaim/kõrgeim hind on selle hinna klassi tooniga (2,53 roheline, 23,40 punane), „Täna toodetud“ päikese tooniga; `.stat__value--good/--bad` on mõlemal lehel `-fg` toonides (punane/roheline ainult võrdlusplaatidel). Lõpphinna osakaalude „Võrgutasu“ on hallsinine (`--share-2 #5b7a9a`, oli roheline).
- **Märgid:** jooned 2,5 px pinnavärvi haloga (ka energialehe päikese ja maja joon), päeva keskmise punktiiri all sama kriipsutusega halo (tumedas teemas oli joon kollastel tulpadel 1,45:1), möödunud tulbad 0,6. Legendis on joonte võti mõlemal lehel `.line-key` (ka keskmine). Maja üldelektri graafiku tekst 12 px, aasta varem tulp hele täide + pidev kontuur.

#### 7.2 Sildid ja täpsus
- **Täpsus:** kW ja kWh ühe komakohaga mõlemal lehel (energialeht: `formatKw`/`formatKwh` ja suur päikesenumber „6,6 kW“, varem „6,59“/„137 kWh“; elektriinfo tooltip ja inspektor „1,8 kWh“, varem „1,83“).
- **Allikad:** energialehe võrgusõlm „Elektrivõrk“ / „ost võrgust“ (nagu elektriinfo lehel); jaluses failinimede asemel „inverter (Solarman)“, „Börsihinnad: Elering“, „Tariifid: elektriinfo lehe seaded“ (varukoopia korral „sisemine koopia“). „SoC“ → „laetuse tase“.
- **Hinnangud ≈-ga:** päeva ostukulu, perioodi maksumus tooltipis, päikeseenergia väärtus; „sh börsiosa“ → „sellest börsihind“.
- **Maja üldelekter:** vaate pill „Maja üldelekter“ (oli „Maja 12 k“), märk „91 961 kWh“ (oli „92,0 MWh“), märkus „Eurod on hinnang (≈) …“; varuandmed „haldaja sisestatud arved“.
- **Lõpphinna osakaalud** samal baasil kui tabel: „Börsihind (ilma KM-ta)“, võrgutasu, marginaal, „Taastuvenergia tasu ja aktsiis“ ja eraldi „Käibemaks 24%“ (39/25/4/13/19 %); segmentide vahel on pinnavärvi vahe.

#### 7.3 Piktogrammid, navigatsioon ja ligipääsetavus
- **Üks ikoonisüsteem:** emojid (vaatepillid ⚡ ☀️ ⏱️ 🏢 🔋, voosõlmed ☀️/🌙 🏢 ⚡, maja graafiku ☀) on asendatud 24×24 stroke-SVG-ga (`<symbol id="i-…">` sprite `index.html`-i alguses, `iconEl()`), kujundid samad mis energialehe `flowIcon`-is. Välk = elekter, mast = elektrivõrk (⚡ ei tähista enam kaht asja). Ikoonid on `aria-hidden`, ekraanilugeja loeb pillist ainult teksti.
- **Navigatsioon:** elektriinfo lehe päises on sama `nav.site-nav` mis energialehel („Elektriinfo“ / „Energia“); vaadete ribal on ainult vaated (telefonis oli link 6. pillina vaatest väljas).
- **Odavaim 2 h aken** on hinnakaardi faktides ka soodsa hinna ajal („Odavaim 2 h aken: Homme 04:15–06:15 (koos tasudega 7,34 s/kWh)“); soovitus „Võimalusel oota“ ei korda seda. Faktid järgnevad nõuandele (töölaual ei jää kaardi keskele tühja ala).
- **Puuteala:** puuteekraanil (`pointer: coarse`) on vaadete pillid, lehtede navigatsioon, vahelehed, lülitid ja ikoonnupud ≥ 44 px; `.site-nav__link` on alati ≥ 40 px.
- **Liikumine ja printimine:** `prefers-reduced-motion` peatab ka olekutäpi pulsi, voo nooled ja spinneri. `@media print`: heledad tokenid, nupud/vaated/navigatsioon peidetud, möödunud tulbad 0,75, kaardid ei murdu.

#### 7.4 Lõppkontroll
- Puuteekraanil on ka planeerija „Elektriauto laadimine …“ kokkuvõtte rida ≥ 44 px (L-145).
- Reegel 11, README ja tokenite kommentaarid vastavad koodile: roheline on „Väga odav“, olek „korras“ ja soodne muutus (võrdlusplaatide vahe, planeerija sääst), energialehel ka aku (L-091, L-094).

### 8. Teadlikult tegemata
- **Eraldi kWh-paneel hinnagraafiku all** (L-089 „hiljem“): teeks graafiku telefonis kõrgemaks; kWh-jooned kasutavad praegu poolt graafiku kõrgust ja hinna nulljoont. Omaniku otsus (p 9).
- **Energialehe eraldi Estfeedi plaat** (L-078 valikuline osa) ja **eraldi laetuse (SoC) paneel** (L-059 alternatiiv): laetus on tooltipis, tabelis ja akukaardil, Estfeedi arve alus elektriinfo lehel; omaniku otsus.
- **Müügi märk** (L-044): andmetes pole müüki kunagi esinenud, seega märki ei saa kontrollida. Lehed tuletavad müüki ainult kitsalt bilansist, töövoog hoiatab esimese `gridPower` > 50 W korral – siis tuleb märk andmetest kontrollida.
- **Tasude summad, mida ei leitud ametlikest allikatest** (kuutasu, tasakaalustamisvõimsuse tasu, võrgutasu kWh-hindade ja marginaali ajalugu): mehhanism on olemas, väärtused jäid 0 või muutmata – ära arva, vt p 9.
- **Aku mahutavus** (energialehe `CONFIG.aku.mahtKwh = 0`): laadimise/tühjenemise ajahinnangut ja „Salvestatud kWh“ plaati ei kuvata, kuni mahutavus on teada.

### 9. Omanik peab veel andma või otsustama
- **Kuutasu (L-077/L-036):** üks arve igast perioodist (enne 08/2025, 08/2025–05/2026, alates 06/2026): fikseeritud kuutasud kokku koos KM-ga (võrgu kuu- ja läbilaskevõimetasu, müüja kuutasu). Need lähevad `CONFIG.hinnad.kuutasu`-sse ja töövoo `TASUDE_AJALUGU["kuutasu"]`-sse (praegu 0).
- **Tasakaalustamisvõimsuse tasu** (01.01.2026 alates 3,73 €/MWh, 2027 2,97 €/MWh müüja arvel): kas see on arvel eraldi rida või marginaali sees? Kui eraldi, lisada (nt `taastuvenergiaTasu`-sse alates 2026, ajalugu 0).
- **Võrgupakett ja marginaal:** kas maja on Elektrilevi „Võrk 4“ paketil ja kas kWh-hinnad 3,49/1,99 ning marginaal 0,6 s/kWh on kehtinud 11/2024-st muutumatult (ajalugu puudub).
- **Aku kasutatav mahutavus** (energialehe `CONFIG.aku.mahtKwh`). Päikesepargi kasutuselevõtu kuu on antud: `CONFIG.paike.kasutuselAlates = "2026-06"`.
- **Otsused:** 45 min aegumislävi (või 60/75 min); telefonis vaikimisi 1 h; keskmise silt legendis, kui see kataks tulpi; eraldi kWh-paneel; inverteri plaadid päeva kokkuvõttest eemaldatud; telefonis (< 768 px) ainult kaherealine inspektor ka klaviatuuri ja hiirega (320 px laiusel võib viimane väärtus „…“-ga lõppeda); maja graafiku 10 px kuusildid kitsal ekraanil; kas CONFIG-i `majaElekter` summad on täpsed arvesummad; uued hinnaklasside toonid; telefoni kolmerealine päis.

---

## Töövood — 2026-10-21

- **„Uuenda elektrihinnad“ käivitab käsitsi käivitamisel ka „Uuenda päikeseandmed“.** `uuenda-hinnad.yml`-is on uus töö `paike`: kui töövoog käivitatakse käsitsi (Run workflow või väline ajastaja, `workflow_dispatch`), käivitab see `gh workflow run uuenda-paike.yml` (õigus `actions: write`). Päikeseandmed uuenevad paralleelselt hindadega ega oota 15:00 akna hindu. Ajastatud käivitustel seda ei tehta: päikeseandmed uuenevad niigi iga 10 min järel ja lisakäivitused ületaksid GitHub Pagesi avaldamise piirangu. (22.10.2026: tegelikult käivitab mõlemat töövoogu väline ajastaja iga 30 min, GitHubi `schedule` on varu; vt [2.5.0], L-075.)
- Järjekorralukk (`concurrency: uuenda-hinnad`) on töövoo tasemelt viidud ainult tööle `uuenda`. Nii käivitub `paike` kohe ka siis, kui eelmine käivitus alles ootab 15:00 hindu. Varem jäi kogu käsitsi käivitus ootele ja järgmine ajastatud käivitus võis selle tühistada. Hindade uuendus töötab nagu enne: korraga üks, ootel ainult viimane.

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
- Mõlema lehe päises on `nav.site-nav` lingid **Elektriinfo** (`index.html`) ja **Energia** (`energy-dashboard.html`); aktiivne leht on märgitud `aria-current="page"`. Energialehe jaluse eraldi link eemaldati. (2.4.0 kaotas selle elektriinfo lehelt – link oli vaadete ribal; taastatud 2026-10-22, vt „Kujundus: mõlemad lehed“.)

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
- `--cat-kollane` `#c48f00` → `#b58500`: tulpade kontrast valgel taustal 2,9:1 → 3,3:1 (WCAG 1.4.11 nõuab 3:1). `.stat__value--good/--bad` kasutavad mõlemal lehel `-fg` toone (parem tekstikontrast). (Kehtis ainult energialehel: 2.4.0 `css/index.css` jäi `#c48f00` ja `--cat-*` toonidega. 2026-10-22 on mõlemas failis `#b07f00` ja `-fg` toonid, vt „Kujundus: mõlemad lehed“.)
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
3. **Repositooriumi kasv.** `paike.json` commit iga 10 min järel (~144 commit'i ööpäevas) + `hinnad.json` iga tunni järel paisutavad git-ajalugu (sadu MB aastas). (22.10.2026: väline ajastaja käivitab mõlemat iga 30 min, ~48 käivitust ööpäevas; GitHubi `schedule` on varu, vt [2.5.0], L-075.) Alternatiiv: andmefailid eraldi orphan-harus (force-push ilma ajaloota) või GitHub Pagesi avaldamine `actions/deploy-pages` artefaktina.
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
- **Vaikimisi 15-minutiline vaade (`state.chartResolution = 15`):** Graafik avaneb vaikimisi `15 min` resolutsioonis. (Alates 2.5.0 ainult arvutis; telefonis < 768 px vaikimisi 1 h, vt [2.5.0].)
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
- **Interaktiivsed kuutulbad (`state.selectedBuildingIndex`):** Iga kuu tulp on klikitav/puudutatav (`.building-bar-hit`). Valitud kuu tõstetakse esile ja selle täpsed väärtused kuvatakse graafiku kohal (`#building-chart-info`) ning allolevates KPI-kaartides (lahendab olukorra, kus `> 6` kuu puhul olid tulpade tekstid peidetud).
- **KPI-kaardid (`.stats`):** Senine tavaline täpp-loend on asendatud 3 numbrilise kaardiga: *Valitud kuu*, *Võrdlus eelmise aastaga* (värvikoodiga `.stat__value--good` / `.stat__value--bad`) ja *Korteri kohta*.

---

## Arhitektuurireeglid edasiseks arenduseks (Claude AI juhis)

1. **Failide jaotus:** `index.html` ja `energy-dashboard.html` sisaldavad HTML-i ja JS-i; kujundus on failis `css/common.css` (ühine disainisüsteem, **tokenid ainult siin**) ning lehe paigutus failides `css/index.css` / `css/energy-dashboard.css`. Piktogrammid on sprite'is `img/icons.svg`, Chart.js 4.5.1 failis `js/vendor/chart.umd.min.js` (uuendamisel vaheta fail ja `?v=`). Graafikute ühisplokk „GRAAFIKUTE ÜHISOSA“ peab olema mõlemas lehes baidi täpsusega sama (kontroll: `sed -n '/GRAAFIKUTE ÜHISOSA · Chart.js/,/GRAAFIKUTE ÜHISOSA lõpp/p'` mõlemast failist ja `diff`). CSS-i või sprite'i muutmisel suurenda linkides `?v=` väärtust. Väliseid raamistikke, CDN-e ega bundlereid ei kasutata.
2. **Muuda alati viimast versiooni:** enne muutmist tõmba `main`. Ära asenda faili vanema koopiaga: 2.4.0 kirjutas nii PR #5 parandused üle.
3. **`CONFIG` puutumatus:** Kõik kasutaja muudetavad parameetrid on skripti alguses objektis `CONFIG`. Võtmeid ei tohi ümber nimetada, sest `index.html`-i `CONFIG`-i loevad regulaaravaldisega ka `energy-dashboard.html` (`loadTariffs`, ka `aegunudMinutites`) ja töövoog `uuenda-hinnad.yml` (`load_tariff_config`). Töövoog loeb tariifid ainult `index.html`-i CONFIG-plokist (`meta.tariffs.source`), samuti müügitasu (`CONFIG.hinnad.muugitasu`, `read_sell_fee`) ja päevakokkuvõtete alguse (`CONFIG.paike.kasutuselAlates`); aku mahutavuse loeb see energialehe `CONFIG.aku.mahtKwh`-st. Tariifide varukoopiad on energialehe `CONFIG`-is ja töövoo vaikeväärtustes (`TARIFF_DEFAULTS`): tariifi muutmisel uuenda kõik kolm kohta või kontrolli `hinnad.json`-i `meta.tariffs`-i järgi (energialeht hoiatab erinevuse ja varukoopia kasutamise korral bänneris). **Tasu muutumisel** lisa vana väärtus koos muutuse kuupäevaga enne töövoo `TASUDE_AJALUGU`-sse (KM: `KM_AJALUGU`) ja muuda alles siis `CONFIG`-it – muidu arvutatakse ka varasemad kuud uue tasuga (`cfg` sõrmejälg käivitab ümberarvutuse).
4. **Turvaline DOM:** Kasuta elementide loomiseks ainult `el()` / `svgEl()` ja `textContent`-i, mitte `innerHTML`-i. Uue välise hosti lisamisel uuenda `Content-Security-Policy` meta-silti.
5. **Ajavöönd:** Kõik kuupäevade ja päeva alguste arvutused käivad läbi `getTallinnDateParts` / `getTallinnDayStart` (`Europe/Tallinn`).
6. **Mõõtmised vs hinnangud:** Näita mõõtmisi (Estfeed, inverter) ainult mõõtmistena. Tulevikku ei summeerita „tänase“ koguse sisse. Mudel või prognoos peab olema selgelt märgistatud, mitte „(inverter)“. Mõõtmise allikas on siltides väiketähega: „(inverter)“, „ost võrgust (võrguarvesti)“ (legend, tooltip, inspektor), Estfeedi plaadil „võrguarvesti (Estfeed) · kuni HH:MM · arve alus“; täisnimi „inverter (Solarman)“ ainult kaardi vihjes ja jaluses. Müüja nimi („Enefit“) ei ole andmeallika silt. Iga „täna“ kogusega käib allikas ja lõikeaeg („kuni HH:MM“); eri allikate arve (Estfeed ja inverter) ei liideta. Solarmani päevakoguseid (`data.day`) ei kasutata, sest need on ~10× liiga väikesed: kogused arvutatakse 15-min mõõtmistest.
7. **Hinnad:** Tariif ja KM rakenduvad nii lehtedel (`calculateFinalPrice`) kui ka töövoos (`calc_final_cents_kwh`); hoia need samad. Odavaima aja otsing kasutab hinda koos tasudega (`avgFinal`).
8. **Päringute sagedus:** Kasutaja algatatud värskendus arvestab ooteaega ja nupp on laadimise ajal keelatud.
9. **Navigatsioon:** Mõlemal lehel peab olema link teisele lehele.
10. **Ekraanilugeja teated:** Live-region (`aria-live`) uueneb ainult klaviatuuri ja fookuse rajalt (graafikul püsiv peidetud `#chart-announcer`). Hiire ja sõrme liigutus uuendab ainult nähtavat inspektorit, muidu tekiks iga liigutusega teadete tulv.
11. **Kujundus:** värvid ainult tokenitena ja tokenid ainult failis `css/common.css` (hele `:root`, tume `[data-theme="dark"]` ja `prefers-color-scheme`, ainult ekraanil). Põhimõtted: Bento Grid (`.layout` nimetatud alad, telefonis DOM-järjekord), klaaskaardid läbipaistmatute sisepindadega (tekst ≥ 4,5:1 halvimal komposiitpinnal, märgid ≥ 3:1 graafikupinnal), üks hero-number vaate kohta, ainus liikumine energiavoo täpid. Roheline = „Väga odav“, olek „korras“ ja soodne muutus, energialehel ka aku – mitte valik ega aktsent; valik/aktsent = `--focus`; mõõdetud seeria joon ei kasuta hinnaklassi tooni. Graafikud ainult Chart.js-iga ühisploki pluginatega: kaksiktelge ei tehta (eri suurused eraldi paneelil), igal graafikul legend, tabelikaksik ja `aria-label`, lõuenditekst ≥ 12 px, tulbad läbipaistmatu seguna. Piktogrammid on 24×24 stroke-SVG sprite'ist (`currentColor`, `aria-hidden`), mitte emojid. kW ja kWh ühe komakohaga, € kahega, € hinnangud „≈“-ga (märk, „€“ ja ühikud numbriga mittekatkeva tühikuga).
12. **Andmefailide lepingud:** `hinnad.json` `meta`, `paike.json` `data.meta`/`frameSeconds`/eilsed kaadrid ja `paevad.json` on kirjeldatud README-s. Päevakokkuvõtte reeglid töövoos (`compute_day_record`) ja energialehel (`computeDayTotals`) peavad jääma samaks; reeglite muutmisel suurenda `PAEVAD_VERSION`-it; lehed peavad toimima ka vanema failiga (väli puudub → käitu nagu varem). `meta.pricesOk: false` = hinnaridades on auk või tunnine samm (hinnad ise on värsked; ebaõnnestunud päring faili ei kirjuta), `estfeedOk: false` = Estfeedi päring ebaõnnestus. Töövoog ei kirjuta kunagi varem mõõdetud kWh-d ega kuukirjet tühja või osalise vastuse põhjal väiksemaks.
