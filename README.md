# Kauge 32 elektriinfo

Kauge 32 KÜ elanikele mõeldud leht, mis näitab Eesti börsihinda, maja hinnangulist
lõpphinda ja odavaimat aega elektri tarbimiseks.

## Kuidas see töötab

```
Elering API → GitHub Actions → hinnad.json → GitHub Pages → index.html brauseris
```

- Homsed börsihinnad avaldatakse iga päev kell 15:00 Eesti aja järgi.
- `.github/workflows/uuenda-hinnad.yml` laeb hinnad, kontrollib neid ja teeb commit'i
  ainult siis, kui need muutusid. Käivitus, mis algab 14:50–16:30, jääb ise ootama,
  kuni homsed hinnad ilmuvad (kuni 40 min).
- Töövood käivitab **väline ajastaja iga 30 minuti järel** (:00 ja :30): see käivitab
  `uuenda-hinnad.yml`-i ja too omakorda `uuenda-paike.yml`-i. GitHubi enda `schedule` on ainult
  lisavaru – GitHub lükkab ajastatud käivitusi edasi või jätab vahele (tegelikult ~5–6 korda ööpäevas).
- `index.html` loeb `hinnad.json`-i samast domeenist (Eleringi API ei luba brauserist
  otse pärida, CORS). Pärast 15:00 kontrollib leht faili iga 2 minuti järel, kuni
  homsed hinnad on käes.
- Kõik ajad arvutatakse Europe/Tallinn ajas; hinnad on 15-minutilised.

## Lehed ja failid

| Fail | Sisu |
|---|---|
| `index.html` | **Elektriinfo**: börsihind, odavaim aeg, päikesekaart, maja lõpphind ja üldelekter (HTML ja JS) |
| `energy-dashboard.html` | **Energia**: päikesepark, akupank, energiavoog, soovitus, „Täna kokku“ (kWh ja €; perioodid päevast aastani), päeva graafik (eile, täna, homme), päevade/kuude graafik ja „Trendid“ (kuud ja 12 kuu libisev keskmine) |
| `graafikud.html` | **Graafikud**: animeeritud ülevaateleht (elektri hind koos tasude ja KM-ga, kust energia tuli, päike/maja/võrk päeva jooksul, aku, päevad, tarbimine kellaaja järgi, maja üldelekter kuude kaupa), vt „Graafikud“ |
| `css/common.css` | **ühine disainisüsteem** mõlemale lehele: tokenid (hele ja tume), klaaskaardid ja mesh-taust, bento-ruudustiku alus, komponendid, graafikuraam, olekud, print ja eelistuste varuvariandid |
| `css/index.css`, `css/energy-dashboard.css`, `css/graafikud.css` | ainult lehe paigutus (`grid-template-areas`) ja lehepõhised komponendid |
| `img/icons.svg` | piktogrammide sprite (`<symbol id="i-…">`), mida kasutavad mõlemad lehed |
| `js/index.js`, `js/energy-dashboard.js`, `js/graafikud.js` | **lehtede põhiskriptid** (olek, andmete laadimine, arvutused, renderdamine); failides, sest turvapoliitika lubab ainult samalt saidilt laaditud skripte (vt „Turvalisus“). Lehe seaded (`CONFIG`) on HTML-is (vt „Seadete muutmine“) |
| `js/teema.js` | raamimise kaitse ja teema valik enne esimest joonistamist (kõigil lehtedel `<head>`-is) |
| `js/common.js` | **mõlema lehe ühine skriptikood**: Tallinna aeg, vormindamine, hinnaarvutuste abifunktsioonid, DOM-abi ja graafikute ühisosa (Chart.js virn, tooltip, pluginad); laaditakse enne lehe põhiskripti, lehepõhine kood (`CONFIG`, olek, renderdamine) jääb HTML-i |
| `js/vendor/chart.umd.min.js` | Chart.js 4.5.1 (MIT, `js/vendor/CHART_LICENSE.md`); graafikud joonistatakse sellega, teek on repo sees, sest CSP lubab skripte ainult samalt saidilt |
| `js/vendor/goatcounter-count.js` | GoatCounteri loendusskript (`count.js`, ISC, `js/vendor/GOATCOUNTER_LICENSE.md`): anonüümne külastuste statistika, vt „Külastuste statistika“ |
| `hinnad.json`, `paike.json`, `paevad.json` | GitHub Actionsi kirjutatud andmefailid (`paevad.json`: inverteri päevakokkuvõtted kWh ja €); parooliga kaitstud lehel krüpteeritud ümbrikud |
| `js/lukk.js`, `lukk.json`, `.github/scripts/lukk.py`, `.github/scripts/requirements-lukk.txt` | **parooliga kaitse**: brauseri avamisvaade ja dekrüpteerimine, lehe sool ja parooli kontrollväärtus, töövoogude krüpteerimisskript ja selle räsidega lukustatud sõltuvused (vt „Parooliga kaitse“) |
| `robots.txt` | otsingumootorite robotitele: andme- ja abifailid on blokeeritud; HTML-lehtedel on `noindex, nofollow, noarchive` |
| `package.json`, `package-lock.json` | ainult Firebase'i avaldamise tööriist `firebase-tools` lukustatud kaudsete sõltuvustega (vt „Turvalisus“); lehed neid ei kasuta |
| `firebase.json`, `.firebaserc`, `.github/workflows/firebase-hosting-*.yml` | **Firebase Hosting** (projekt `kauge32-elekter`): GitHub Pagesi kõrval teine koopia samadest failidest (`firebase.json`: ainult lehe failid, HTTP turvapäised, puuduv fail → 404, vt „Turvalisus“). `firebase-hosting-merge.yml` avaldab live-kanalisse pärast iga `main`-i push'i **ja iga andmefailide commit'i**: andmetöövood saadavad pärast õnnestunud push'i sündmuse `repository_dispatch` `andmed-uuendatud`, muutuseta käivitused ei avalda midagi. PR-idele teeb eelvaate `firebase-hosting-pull-request.yml`. Töövood on käsitsi muudetud – ära genereeri neid `firebase init hosting:github`-iga üle (kaoksid käivitajad, õigused ja SHA-d, vt „Turvalisus“) |

CSS-i, `js/*.js`-i või sprite'i muutmisel suurenda HTML-i linkides `?v=` väärtust (GitHub Pages hoiab faile
vahemälus 10 min).

Kõigi kolme lehe päises on sama lehtede navigatsioon **Elektriinfo** / **Energia** / **Graafikud** (aktiivne leht on
esile tõstetud); elektriinfo lehe päikesekaardil on lisaks link energialehele.

## Seadete muutmine

Tasud, tariifid ja maja andmed on `index.html`-is objektis `CONFIG` (iga rea
juures on selgitus). Muuda ainult numbreid ja tekste; jäta sulud, komad ja
jutumärgid alles. Muudatus jõuab lehele mõne minuti jooksul.

`CONFIG` on HTML-is plokis `<script type="text/plain" id="lehe-config">` (energialehel ja graafikute lehel samamoodi
nende enda seaded). Plokk ei käivitu: lehe skript (`js/<leht>.js`) loeb selle ilma `eval`-ita (`readPageConfig`,
`js/common.js`), sest turvapoliitika ei luba lehesiseseid skripte. Seetõttu on lubatud ainult väärtused – numbrid,
`"tekst"` (jutumärkides), `true`/`false`/`null`, objektid `{ }` ja massiivid `[ ]` – ning kommentaarid, mitte arvutused
(`24 * 60`) ega muutujad. Vea korral ei avane leht ja brauseri konsoolis on teade rea ja veeruga (nt
„CONFIG: oodati koma või „}“ (rida 12, veerg 5)“). Töövoog `uuenda-hinnad.yml` (Pythoni koopia `parse_config`) ja energialeht
(`loadTariffs`) loevad `index.html`-i `CONFIG`-ist tariifid sama reegliga: iga väärtus tuleb oma kohast (nt
`CONFIG.hinnad.marginaal`) ja kommentaarid ei sega – rida `// vana marginaal: 0.75` võib rahulikult alles jääda. Kui
`index.html`-i `CONFIG` on vigane, kasutab töövoog vaiketasusid ja energialeht oma varukoopiat (mõlemad annavad hoiatuse).

## Kui hinnad ei uuene

1. Ava **Actions → Uuenda elektrihinnad** ja vaata viimast käivitust.
2. Käivita töövoog käsitsi: **Run workflow**. Käsitsi käivitamine (ka välise ajastajaga) käivitab
   kohe ka töövoo **Uuenda päikeseandmed**, nii et mõlemad andmefailid uuenevad korraga.
3. Punane käivitus tähendab, et Elering ei vastanud või vastus oli vigane.
   Vana `hinnad.json` jääb sel juhul alles.

GitHub lükkab ajastatud käivitusi edasi või jätab need vahele, seega käivitab töövoo väline
ajastaja (nt cron-job.org) **iga 30 minuti järel** (:00 ja :30, ajavöönd Europe/Tallinn). Kui
ajastaja seiskub, vananevad andmefailid tundideks. Ajastaja saadab päringu:

```
POST https://api.github.com/repos/ott-max-netizen/kauge32elekter/actions/workflows/uuenda-hinnad.yml/dispatches
Authorization: Bearer <fine-grained token: ainult see repo, "Actions: Read and write">
Accept: application/vnd.github+json

{"ref":"main"}
```

**Firebase'i koopia** uueneb töövooga **Deploy to Firebase Hosting on merge**: see käivitub pärast iga andmefailide
commit'i ja iga `main`-i push'i järel. Kui GitHub Pagesi leht on värske, aga Firebase'i oma mitte, vaata selle töövoo
viimast käivitust või käivita see käsitsi (**Run workflow**, haru `main`). Andmetöövoo hoiatus „Firebase Hostingu
avaldamist ei õnnestunud käivitada“ tähendab, et sündmust ei saadetud; järgmine andmete commit avaldab ka need andmed.
Iga avaldamine on Firebase'is uus versioon (praegu ~45 ööpäevas): sea Firebase'i konsoolis Hostingu väljalaskeajaloo
menüüst *Release storage settings* hoitavate versioonide arv (nt 20), et vanad versioonid salvestusmahtu ei täidaks.

## Andmefail ja Elering Estfeed tarbimisandmed

`hinnad.json` uueneb välise ajastaja käivitusel **iga 30 minuti järel**, kui hinnad, tarbimine või
olekuinfo muutusid (kell 15:00 ootab töövoog homseid hindu). Estfeedi tarbimisandmed jõuavad kohale
mõnetunnise viivitusega, seega võib viimane `kwh` rida olla mitu tundi vana. Fail sisaldab:
1. Eesti hinnapiirkonna 15-minutilisi börsihindu eilsest 00:00 kuni ülehomme 00:00 koos maja 15-minutilise tarbimisega (`kwh`), kui GitHub Actions Secrets all on seadistatud `ELERING_CLIENT_ID`, `ELERING_CLIENT_SECRET` ja `ELERING_EIC`:

```json
{"success":true,"generatedAt":"2026-10-21T12:01:07Z","source":"Elering (Nord Pool day-ahead, EE + Estfeed)",
 "meta":{"pricesOk":true,"pricesUntil":"2026-10-22T21:00:00Z","estfeedOk":true,"estfeedUntil":"2026-10-21T11:15:00Z",
   "tariffs":{"marginaal":0.6,"vorgutasuPaev":3.49,"vorgutasuOo":1.99,"taastuvenergiaTasu":1.598,"aktsiis":0.21,
     "kuutasu":0.0,"kaibemaks":24.0,"algus":22.0,"lopp":7.0,"nadalavahetusOnOo":true,"riigipuhadOnOo":true,"source":"index.html"},
   "warnings":[]},
 "data":{
   "ee":[{"timestamp":1792056600,"price":13.69,"kwh":0.412}],
   "majaElekter":[{"kuu":"2026-10","kwh":480.5,"eur":112.4,"complete":false,"v":3,"cfg":"384c3bedbafc","updatedAt":"2026-10-21T12:01:00Z"}]
 }}
```

2. Käesoleva aasta ja eelneva aasta vastavate kuude kokkuarvutatud tarbimist (`kwh`) ja kogumaksumust (`eur` koos võrgutasude, aktsiisi ja käibemaksuga) massiivis `data.majaElekter`. Seda loevad elektriinfo lehe „Maja üldelekter“ ja energialehe aasta kokkuvõte („Ost võrgust AAAA“).

`timestamp` on perioodi algus (Unix sekundites, UTC), `price` on börsihind €/MWh ilma käibemaksuta ja `kwh` on perioodi ost võrgust kilovatt-tundides (Estfeed, liitumispunkti arvesti).

- **Rea kWh:** 15-min rida saab oma veerandi koguse. Kui Elering peaks tagastama tunnised hinnad, saab
  tunnirida nelja veerandi summa ainult siis, kui kõik veerandid on mõõdetud (poolik tund jääb `kwh`-ta);
  vana faili kaitse („uus vastus ulatub vähem tulevikku“) võrdleb viimase rea lõppu, nii et tunnine vastus
  15-min faili peal (mõlemad kuni 24:00) ei katkesta käivitust.
  Kui Estfeed annab ainult tunnised kogused, jagatakse tund 15-min ridadele neljaks ja rida saab märke
  `"kwhRes":"hour"` (tunni ja päeva summa on mõõtmine, 15-min jaotus mitte). Kui Estfeedi vastus mõnda
  varem avaldatud perioodi ei kata (osaline vastus või tõrge), jääb eelmise faili väärtus alles.
  Jooksva kuu kWh ei kahane sama kuu jooksul: tühi või ainult viimaseid päevi kattev vastus jätab kuu kirje
  varasemaks (hoiatus „Estfeedi vastus oli puudulik …“). Tühi vastus ei muuda varem mõõdetud kuud
  „andmed puuduvad“ kirjeks (üks koondhoiatus „Estfeed ei andnud mõõteandmeid N kuu kohta …“); `noData`
  kirje tehakse ainult kuule, millel mõõdetud kirjet pole olnud. Kuu päritakse kuni 30-päevaste lõikudena;
  kui vastus katab lõpliku kuu perioodidest alla 99 % ja annaks varasemast vähem kWh (nt üks lõik tuli
  tühjana), jääb varasem kirje alles (koondhoiatus „Estfeedi vastus oli N kuu kohta osaline …“) ja kuu
  arvutatakse järgmisel käivitusel uuesti.
- **Puuduv hinnaperiood** jääb failist välja (eelmist rida ei pikendata); töövoog kirjutab hoiatuse.
- **EIC:** kui `meteringPointEics`-filtriga päring ebaõnnestub, korratakse seda ilma filtrita, kuid
  vastusest võetakse ainult `ELERING_EIC` mõõtepunkt(id); logis on vastuse mõõtepunktide arv.
- **`meta`** (tipptasemel): `pricesOk` (hinnaread ilma aukudeta ja 15-min sammuga; `false` = hinnad on
  värsked, kuid neis on auk või tunnine samm – ebaõnnestunud hinnapäring faili üldse ei kirjuta), `pricesUntil`
  (viimase hinnarea lõpp, ISO UTC), `estfeedOk` (Estfeedi päring õnnestus sel käivitusel),
  `estfeedUntil` (viimase `kwh`-ga rea lõpp või `null`), `tariffs` (kuu € arvutamisel kasutatud
  CONFIG-i väärtused, `source` = `"index.html"` või `"default"`, kui CONFIG-plokki ei leitud) ja
  `warnings` (töövoo hoiatused; lehed näitavad neid elanikele, seega on need tavakeeles – sisemised nimed nagu
  `kwhRes`, `CONFIG`, `TASUDE_AJALUGU` on ainult Actions-i logis). Vanemas failis `meta`-t pole – lehed toimivad ka siis.
- **Kuu kirje:** `v` = arvutusreeglite versioon (`CALC_VERSION`), `cfg` = tasude sõrmejälg (versioon,
  KM ja tasude ajalugu, CONFIG-i tasud), `updatedAt` = millal kirje sisu viimati muutus. Alates `v` 4 on kirjes ka
  öö-/päevatariifi jaotus `kwhOo`, `kwhPaev`, `eurOo`, `eurPaev` (sama öötariifi reegel mis hinnal: öötunnid,
  nädalavahetus, riigipühad; kuutasu jaotusest välja) ja `spotAvg` (kuu kWh-ga kaalutud keskmine börsihind, €/MWh ilma
  KM-ta) – energialehe „Trendid“ kaart; vanemas kirjes puuduvad. Lõplik kuu
  arvutatakse uuesti, kui `v` või `cfg` erineb; `noData: true` = selle kuu kohta mõõteandmeid pole (graafikul „—“).

`paike.json` (töövoog `uuenda-paike.yml`) sisaldab inverteri hetkeseisu ja 15-min mõõtmisi:

```json
{"success":true,"generatedAt":"2026-10-21T12:01:40Z","source":"Solarman OpenAPI (station realTime + history)",
 "data":{
   "realTime":{"generationPower":6590,"usePower":8505,"purchasePower":2072,"wirePower":2072,
     "chargePower":-120,"dischargePower":0,"batteryPower":-120,"batterySoc":85.0},
   "frames":[{"dateTime":1792530000,"generationPower":0,"usePower":8654,"gridPower":0,"purchasePower":28106,
     "wirePower":28106,"chargePower":18787,"dischargePower":0,"batteryPower":-18787,"batterySoc":58.7}],
   "frameSeconds":900,"lastUpdateTime":1792583972,"installedCapacityKw":27.5,
   "meta":{"framesUntil":1792584000,"warnings":[]}
 }}
```

- `frames` on 15-min keskmised võimsused (W), `dateTime` = perioodi algus (Unix s); fail sisaldab
  **tänaseid ja eilseid** kaadreid (eilse päeva 00:00-st, Tallinna aeg) – lehed valivad vaadatava päeva
  ise. Uued ja vanad kaadrid ühendatakse `dateTime`'i järgi, nii et lühem või ebaõnnestunud
  Solarmani vastus ei kustuta päeva varasemaid kaadreid. Päeva esimesel 3 tunnil küsitakse Solarmanist ka eilne
  päev uuesti: keskööle eelnev käivitus näeb mõõtmisi ainult ~23:25-ni, nii et muidu puuduks eilsest viimane pool
  tundi kuni tund.
- `frameSeconds` = kaadri pikkus sekundites (900); lehed loevad selle (vaikimisi 900).
- `meta.framesUntil` = viimase kaadri lõpp (Unix s), kuid mitte hilisem kui viimane mõõtmine `lastUpdateTime`
  (viimane kaader on enamasti pooleli); `meta.warnings` = töövoo hoiatused.
- Solarmani päevakoguseid (`data.day`) enam ei kirjutata: selle jaama puhul on need ~10× liiga
  väikesed; kõik päeva kogused arvutatakse 15-min kaadritest.

## Päevakokkuvõtted (`paevad.json`)

Energialehe kokkuvõtte perioodivaliku (eile, 7 päeva, kuud, aastad) andmed. Faili kirjutab töövoog `uuenda-hinnad.yml`
(sama käivitus mis `hinnad.json`; eurode reeglid ja perioodikohased tasud on seal ühes kohas):

```json
{"success":true,"generatedAt":"2026-10-22T20:00:00Z","source":"Solarman (inverter, 15-min) + Elering (börsihind)",
 "data":{
   "days":[{"paev":"2026-10-21","pvKwh":46.11,"pvEur":5.351,"loadKwh":235.08,"loadEur":36.455,"importKwh":148.18,
     "importEur":18.919,"exportKwh":0.0,"exportEur":0.0,"chargeKwh":17.43,"chargeEur":1.322,"dischargeKwh":59.59,
     "dischargeEur":13.722,"socStart":70.0,"socEnd":28.0,"loadH":[8.02,7.08,"… 24 väärtust …",12.67],"kaadrid":96,"complete":true,"src":"paike","v":1,
     "cfg":"aeacd889b482","updatedAt":"2026-10-22T00:31:00Z"}],
   "meta":{"from":"2026-06-01","pending":0,"sellFee":1.05,"batteryKwh":100.0,"warnings":[]}
 }}
```

- Üks kirje iga **lõppenud** Tallinna päeva kohta; tänast päeva failis pole (leht arvutab selle `paike.json`-ist).
- Kogused ja eurod arvutatakse inverteri 15-min kaadritest **samade reeglitega mis energialehe „Täna kokku“**
  (`computeDayTotals`; kontrollitud: sama kaadrite ja hindade korral on tulemus sama). Ost, maja tarbimine ja aku
  tühjendamine on lõpphinnaga (`calc_final_cents_kwh`, sel ajal kehtinud tasud ja KM), müük ja päikesest laetud
  energia müügihinnaga (börsihind ilma KM-ta − `index.html` `CONFIG.hinnad.muugitasu`), päike otse majja
  lõpphinnaga ning akusse ja võrku müügihinnaga. Eurod on 3 komakohaga (summeerimiseks), kWh 2 komakohaga.
- **Eilne päev** arvutatakse `paike.json`-i kaadritest; kui päev on seal veel poolik (`complete: false`, nt
  käivitus kell 00:05, kui `paike.json`-is pole veel eilse päeva viimaseid kaadreid), arvutatakse see järgmistel
  käivitustel uuesti. **Varasemad päevad** alates
  `index.html` `CONFIG.paike.kasutuselAlates` kuust laaditakse Solarmani history-päringuga järk-järgult
  (10 päeva käivituse kohta, uuemad enne; vajab samu `SOLARMAN_*` Secrets'eid mis `uuenda-paike.yml`).
  `meta.pending` = veel laadimata päevi; päev, mille kohta Solarman mõõtmisi ei andnud, on `"noData": true`.
- `batteryGainEur` = päeva aku tulu (tuletatud: arvutatakse igal käivitusel kirje väljadest sama valemiga mis energialehe
  `finishTotals`, mahutavus `energy-dashboard.html` `CONFIG.aku.mahtKwh`-st, `meta.batteryKwh`); seda kasutab elektriinfo
  lehe päikesekaardi „Eile“ rida. `meta.sellFee` = kasutatud müügitasu.
- `loadH` = maja tarbimise tunniprofiil (24 Tallinna kellatundi, kWh tunnis = keskmine kW; alla poole tunni
  mõõtmisi → `null`, kellakeeramise päeval korduv tund on kahe tunni keskmine). Väli on viimase 14 päeva kirjetel
  (vanemad kirjed ilma selleta arvutatakse üks kord uuesti) ja sellest arvutab energialeht tarbimise prognoosi.
- `complete: false` = kaadrid katavad alla 97 % päevast või päeva viimane 15-min kaader puudub (kogused on mõõdetud
  osa summa; leht märgib selle). `src` = `"paike"` või `"solarman"`; poolik `paike`-kirje ja `paike`-kirje, milles on
  päeva perioodidest vähem kaadreid (`kaadrid`), laaditakse hiljem üks kord Solarmanist uuesti.
- `v` = arvutusreeglite versioon (`PAEVAD_VERSION`), `cfg` = sõrmejälg (tasude sõrmejälg + müügitasu). Kui need
  muutuvad (nt tasu muudeti), arvutatakse päevad Solarmanist järk-järgult uuesti; kuni selleni jääb vana kirje.
- Kui hinda pole vähemalt 90 % kogusest, jäävad selle sarja eurod kirjest välja (leht näitab perioodi eurosid
  „—“, mitte liiga väikest summat). Päevakokkuvõtte viga ei takista `hinnad.json`-i uuendamist.

## Mõõtmiste loogika: Estfeed vs inverter

Rakendus kasutab kahte teineteist täiendavat mõõtmist:
1. **Estfeed (Eleringi andmeladu, liitumispunkti arvesti, `hinnad.json` → `kwh`)**: **elektri ost võrgust** 15 minuti kaupa („ost võrgust (Estfeed)“; grupp „Ost võrgust sel päeval (võrguarvesti, arve alus)“, plaat „Ostetud võrgust“, alltekst „kuni HH:MM“). See on arve alus.
2. **Inverter (Solarman, `paike.json`)**: **päikesetoodang**, **maja tegelik tarbimine** (`usePower`), aku laadimine/tühjenemine ja ost võrgust (märgistatud „(inverter)“). Inverteri ost (`purchasePower` × 0,25 h) klapib Estfeedi arvestiga 15-min täpsusega (±2 %): periooditi kuni ±0,5 kWh ja päeva lõikes ~2 %, ning ulatub tavaliselt hilisema kellaajani; arve alus on Estfeed. Numbreid eri allikatest ei liideta, igaühel on allikas ja lõikeaeg („kuni HH:MM“).

Eri allikate arve ei liideta. Maja tarbimine ≠ ost võrgust + päikese omatarve, sest maja akut laetakse
odava hinnaga ka võrgust (öösel kuni ~19 kW). Seepärast võetakse maja tarbimine otse inverterist: ost +
päike + aku tühjenemine − aku laadimine − müük. Solarmani päevakogused on selle jaama puhul ~10× liiga
väikesed, seetõttu arvutatakse kõik päeva kogused 15-min mõõtmistest.

### Märgid ja väljad (`paike.json`)

Solarmani välja nimed ja märgid on failis muutmata; lehed tõlgendavad neid nii (kontrollitud selle jaama andmetest):

| Väli | Tähendus |
|---|---|
| `generationPower` | päikesetoodang, W (≥ 0) |
| `usePower` | maja tarbimine, W (≥ 0) |
| `purchasePower` | ost võrgust, W (≥ 0) |
| `chargePower` | aku laadimine: `realTime`-is laadimisel **negatiivne** (nt −120 W), kaadrites **positiivne** |
| `dischargePower` | aku tühjenemine, W (≥ 0) |
| `batteryPower` | aku võimsus, **< 0 = laeb** |
| `batterySoc` | aku laetuse tase, % |
| `gridPower` | selle jaama puhul peaaegu alati 0 (harva paar kümmet vatti); lehed seda ei kasuta |
| `wirePower` | selle jaama puhul (peaaegu) võrdne `purchasePower`-iga |

- **Aku:** `batteryKw = |chargePower| − |dischargePower|` (kW; + = laeb, − = tühjeneb), sama valem nii
  hetkeseisus kui kaadrites. Hoidevool (|batteryKw| < 0,2 kW ja laetuse tase ei muutu) on „ootel“, mitte „laeb“.
- **`gridPower` / `wirePower`:** selle jaama puhul `gridPower ≈ 0` ja `wirePower ≈ purchasePower`; ost võrgust
  on mõlemal lehel `purchasePower` ja `gridPower`-it ei loeta ostuks ega müügiks. Väljad jäävad faili alles.
- **Müük võrku:** müüki pole mõõtmistes seni esinenud, seega on selle märgikokkulepe kontrollimata.
  Lehed näitavad müüki ainult siis, kui ost ≤ 0,05 kW **ja** ülejääk (päike + aku tühjenemine − tarbimine −
  aku laadimine) on üle max(0,3 kW; 3 % toodangust); bilansi jäägist müüki ei tuletata. Töövoog kirjutab
  logisse hoiatuse, kui |`gridPower`| või |`wirePower − purchasePower`| on vähemalt 50 W – siis tuleb märgikokkulepe üle kontrollida.

## Päikeseenergia (elektriinfo lehe päikesekaart)

- **„Eile“ rida** kaardi põhjas (`paevad.json`, `CONFIG.paike.paevadeFail`): eilne aku tulu (`batteryGainEur`), maja
  makstud hind (võrgu netokulu / maja tarbimine) ja keskmine ostuhind s/kWh ning link energialehe perioodivalikule.
  Kirje või faili puudumisel on rida peidetud.
- Kõik päikese, maja tarbimise ja aku numbrid on **mõõtmised** failist `paike.json` (vt allpool
  „Energia töölaud“). Mudelit ega prognoosi ei kuvata: kogused on summad kuni viimase mõõtmiseni
  (`lastUpdateTime`; viimane, pooleli kaader arvestatakse ainult selle hetkeni, mitte lehe kellani – plaatide
  „kuni HH:MM“ ja jaluse „kaadrid kuni“ on sama aeg) ja
  graafikul on päike ainult lõppenud ja täielikult mõõdetud perioodides (kWh 15 min või 1 h kohta, parem
  telg): täna kuni viimase lõppenud perioodini ja „Eile“ vaates, kui `paike.json` sisaldab eilseid kaadreid.
- Kaardi märgil on mõõtmise kellaaeg ja vanus („Mõõdetud 14:59 · 23 min tagasi“). Kui viimane mõõtmine on
  vanem kui `CONFIG.paike.aegunudMinutites` (45 min, sama lävi kehtib energialehel), hetkeseisu ei kuvata
  ja päise olekumärk on kollane („OSA ANDMEID VANANENUD“). Pärast keskööd, kuni esimese tänase mõõtmiseni,
  on kaardil teade „Uus päev algas …“ (eilne värske mõõtmine ei ole vananenud).
- Päise olekumärgi vihjes ja jaluses on andmefailide seis (mis ajani on börsihinnad, Estfeedi ost ja
  inverteri kaadrid, kaadri pikkus `frameSeconds`-ist) ning töövoogude hoiatused failide `meta`-plokist; vana
  fail ilma `meta`-ta töötab nagu enne. Märk on kollane „OSA ANDMEID VANANENUD“, kui praeguse hetke hind või
  inverteri mõõtmine puudub/on vananenud või Estfeedi päring ebaõnnestus (`estfeedOk: false`), ja „OSA ANDMEID
  PUUDU“, kui hinnaridades on auk või tunnine samm (`pricesOk: false`; hinnad ise on värsked).
- „Päikesest kaetud“ = ise kasutatud päikeseenergia (toodang − müük) / maja tarbimine; sama mõõdik on
  energialehel. Aku laadimine (võrgust/päikesest) on voosõlmedes („sellest akusse“) ja selgitavas lauses
  koos allika ja lõikeajaga („Aku täna (inverter, kuni 14:59): laetud 31,8 kWh …“; iga selgituslause on omaette
  real); „Maja tarbis täna“ plaadil
  „ost võrgust 126,5 kWh (inverter), sellest akusse 31,2 · kuni 14:59“, väärtusplaadil „täna kuni 14:59 ·
  hinnang …“. Aku suund on |`chargePower`| − |`dischargePower`|, nende puudumisel `batteryPower`-ist (< 0 = laeb).
  Kõige kitsamal telefonil (≤ 380 px) on voosõlmede kiri väiksem ja „Päikese-park“ poolitub; kahe veeru
  paigutuses (768–1023 px) on sõlmedes telefoni lühikesed sildid ja 768–1179 px ning printimisel on neli
  plaati kahes veerus.
- Pargi võimsus (kWp) tuleb `paike.json`-i väljast `installedCapacityKw` (töövoog pärib selle Solarmanist
  kord päevas); `CONFIG.paike.paneelideKw` on varuväärtus. `paneelideArv` on ainult sildil; `kasutuselAlates` on sildil ja sellest kuust alates arvutab töövoog päevakokkuvõtted (`paevad.json`).
- **Vaadete lüliti** (*Kõik vaated*, *Elekter*, *Päike*, *Planeerija & EV*, *Maja üldelekter*; SVG-ikoonidega)
  ja **teemamootor** (hele/tume) päises.

## Hinnagraafik (elektriinfo leht)

- Graafik on **Chart.js**-i virn kahest ühise ajateljega paneelist (`#c-price`, `#c-kwh`), mis on joonistatud
  läbipaistmatul graafikupinnal (`.chart-well`). Hinnapaneelil on börsihind (s/kWh koos KM-ga) hinnaklassi
  värvi tulpadena, lävedel 5, 10 ja 20 s/kWh siltideta punktiirjoon, päeva keskmine (punktiir), planeerija
  odavaim aken, praeguse perioodi kontuur ja „praegu“-joon kellaajaga. Möödunud perioodid on tuhmimad
  (legendis „tuhmim = möödunud“). Arvutis on vaikimisi 15 min samm, telefonis (< 768 px) 1 h; lüliti
  „1 h / 15 min“ valik jääb kehtima.
- kWh-paneelil on ost võrgust (võrguarvesti, Estfeed) ja päikesetoodang (inverter) perioodi energiana
  (kWh 15 min või 1 h kohta) **omaette teljel**: hinna ja energia skaalad ei ole enam samal paneelil.
  Puuduv periood katkestab joone; pooleli olevat või ainult osaliselt mõõdetud perioodi (viimane kaader kuni
  inverteri mõõtmiseni) joonele ei kanta (tooltipis „pooleli, kuni HH:MM“ või „mõõdetud kuni HH:MM“). Kui
  Estfeed andis ainult tunnise koguse (`kwhRes: "hour"`), on see 15-min vaates katkendjoon (legendis
  „katkendjoon = tunni keskmine“). Mõõtmiste lõpus on rõngas ja silt „kuni HH:MM“, mis ei jää „praegu“-joone ega
  teise joone alla.
- Kõik graafikud (hind, kWh, maja 12 kuud, hinnakomponentide osakaal) kasutavad mõlemas lehes sama
  graafikute ühisosa failis `js/common.js` (Tallinna aja tunnisildid koos kellakeeramise „03*“-ga, virna ühine
  y-telje laius, ristjoon, tooltip, inspektor, klaviatuur, teemavahetus, print ja `forced-colors`); lõuendi tekst
  on vähemalt 12 px ja ühelgi graafikul pole kahte y-telge. Kui `js/vendor/chart.umd.min.js` ei laadi, näitab
  graafikukaev teate ja tabelivaated avanevad.
- Tooltip on tulba kõrval: aeg, börsihind ja hinnaklass, hind koos tasudega, kogused värvivõtmega (ost võrgust
  (võrguarvesti) koos maksumusega, päike ja maja (inverter), aku laadimine) ning võrdlus päeva keskmisega. Puutel ja
  kitsal ekraanil (< 768 px) tooltipi ei kuvata: info on graafiku kohal fikseeritud kõrgusega inspektoris, nii et
  graafik ei nihku sõrme all. Klaviatuuril valib fookus praeguse perioodi, nooled, `PageUp`/`PageDown`, `Home`/`End`
  liiguvad; ekraanilugeja teade (`#chart-announcer`) tuleb ainult klaviatuuriga liikudes.
- Puuduvat hinnaperioodi ei täideta eelmise hinnaga: graafikul jääb katkendkontuuriga tühi pesa, praeguse hetke
  puudumisel ütleb hinnakaart, et praeguse hetke hinnaperiood puudub, ja osaliste homsete hindade korral on teade
  „Homsed börsihinnad on osalised (puudub …)“ ning vaheleht „Homme (osaline)“.
- Graafiku all on legend (rühmad „Hind, s/kWh“ ja „Energia, kWh / …“), valitud päeva kokkuvõte kahes rühmas:
  „Hind, s/kWh“ (madalaim, keskmine, kõrgeim, võrdlus eilsega) ja „Ost võrgust sel päeval (võrguarvesti)“ (kogus
  allika ja lõikeajaga, kulu koos tasudega „≈“, sellest börsihind koos KM-ga), ning „Tabelivaade (tunni kaupa)“.
  Inverteri kogused on päikesekaardil, kuu ost ja aasta tagune võrdlus maja üldelektri kaardil.
- Sinine kast (valiku aktsent, mitte hinnaklassi roheline) on planeerijas valitud kestusega odavaim aken
  (lõpphinna järgi koos võrgutasuga), sildiga „odavaim 2 h · 04:15–06:15“. Hinnakaardi faktides on alati
  järgmise 24 h odavaim 2 h aken. Päeva keskmise silt pannakse vabale küljele; kui see kataks tulpi, on väärtus
  legendis.
- Kellakeeramise päeval on päeva sildi juures märkus; sügisel on korduva tunni ajad märgitud „(suveaeg)“ /
  „(talveaeg)“ ning laial graafikul on x-teljel „03“ ja „03*“.

## Kujundus ja värvid (mõlemad lehed)

- **Põhimõtted (alates 3.0.0 / 2.0.0):** Bento Grid, klaasmorfism, SVG energiavoog ja Chart.js graafikud.
  Mõlemad lehed laadivad sama disainisüsteemi `css/common.css`; lehe fail (`css/index.css`,
  `css/energy-dashboard.css`) sisaldab ainult `grid-template-areas` paigutust ja lehepõhiseid komponente.
- **Bento-ruudustik:** `.layout` on telefonis (< 640 px) üks veerg DOM-järjekorras, 640–1023 px kuus ja
  ≥ 1024 px kaksteist veergu nimetatud aladega. Elektriinfo: hind 7 + odavaim aeg 5, graafik 12, päike ja aku 7 +
  lõpphind 5, maja 12. Energia: soovitus 12, voog 7 × 2 rida ning kõrval hind 5 ja „Järgmised tunnid“ 5, aku 6 +
  päikesepark 6, „Täna kokku“ 12, päeva ülevaade 12. DOM-järjekord on sama mis lugemis- ja fookusjärjekord;
  vaadete filtris on iga nähtav kaart terve rea laiune. Kaardi sisemine paigutus kohandub konteineripäringuga.
- **Klaas:** lehe taust on madala kontrastiga mesh, kaardid on poolläbipaistvad (`backdrop-filter`, hele
  0,76 / tume 0,74), kaardi sees on ainult läbipaistmatud pinnad (plaadid, graafikukaev, tabelid), nii et tekst ja
  märgid on alati arvutatud pinnal (tekst ≥ 4,5:1 halvimal komposiitpinnal). `@supports not (backdrop-filter)`,
  `prefers-reduced-transparency` ja `forced-colors` annavad läbipaistmatud kaardid. Klaas ei liigu ega reageeri
  hõljutusele; ainus liikumine saidil on energiavoo täpid (`prefers-reduced-motion` korral on täpid peidetud ja suunda näitab iga marsruudi nooleots).
- **Tokenid:** värvid on CSS-i custom property'd **ainult failis `css/common.css`** (hele `:root`, tume
  `:root[data-theme="dark"]` ja `prefers-color-scheme: dark` all; mõlemad lehed seavad `data-theme` juba
  `<head>`-is ja jagavad teemavõtit `kauge32_theme`). Tume komplekt kehtib ainult ekraanil: **prinditakse alati
  heledana**, juhtelemendid on printimisel peidetud. Chart.js loeb värvid samadest tokenitest (`chartTokens`),
  seega teema vahetus joonistab graafikud ümber ilma andmeid uuesti laadimata.
- **Värvi tähendus:** tulba värv = hinnaklass (soojusskaala: heledus ja kontrast muutuvad hinnaga monotoonselt,
  naaberklassid eristuvad ka värvipimedale; lävedel 10 ja 20 s/kWh on siltideta punktiirjoon). Roheline on „Väga
  odav“, olek „andmed ajakohased“ ja soodne muutus. Osapooled: päike `--solar` (mõõdetud päikesetoodangu joon
  `--solar-line`), maja `--home`, võrk ja ost `--grid` (ka maja üldelektri tulbad), müük `--export`, aku
  `--battery`; valik ja aktsent (odavaim aken, planeerija plaan, „Homme“ märk) = `--focus`. Paletid on
  valideeritud (naaberpaaride ΔE ≥ 15 tavanägemisel ja ≥ 8 deuteranoopias, märgid ≥ 3:1 graafikupinnal).
- **Märgid:** tulbad on ainsad täisvärvis pinnad (möödunud perioodid tuhmimad, läbipaistmatu segu); jooned 2–2,5 px
  pinnavärvi haloga; alad hõredad (≤ 0,10); ruudustik hairline; legend on HTML (ruut tulpadele ja aladele, joon
  joontele, energialehe kW-sarjad on `aria-pressed` lülitusnupud); igal graafikul on tabelikaksik ja
  `aria-label`. Kaksiktelge ei kasutata: eri suurused on eraldi paneelidel (nt aku laetus % on energialehel
  omaette paneel).
- **Täpsus:** kW ja kWh ühe komakohaga mõlemal lehel, € kahe komakohaga; € hinnangud on „≈“-ga. Hero-number
  (börsihind) on üks vaate kohta (52 / 60 px), teised suured numbrid astme võrra väiksemad.
- **Piktogrammid:** üks süsteem – 24×24 stroke-SVG sprite `img/icons.svg` (`currentColor`, alati
  `aria-hidden`, tähendus on kõrval tekstina; JS-is `iconEl()`); samad kujundid energiavoo sõlmedes. Välk =
  elekter/hind, mast = elektrivõrk, päike/kuu = päikesepark, maja = maja, kell = planeerija, aku = aku,
  teemanupp = kontrast (`i-contrast`), olekud `i-check-circle` / `i-alert-triangle` / `i-x-circle`. Emojisid ei
  kasutata.
- **Ligipääsetavus:** puuteekraanil on vaadete pillid, lehtede navigatsioon, vahelehed, lülitid, tabelivaadete
  päised ja ikooninupud vähemalt 44 px; fookusrõngas 3 px `--focus` (forced-colors: `Highlight`); graafikud on
  klaviatuuriga kasutatavad (`.chart-stack` on fookuses, nooled valivad perioodi või kuu).

## Hinnad ja tariifid

- Lõpphind = (börsihind + marginaal + võrgutasu + taastuvenergia- ja varustuskindluse tasu + aktsiis)
  × (1 + KM). Öötariif kehtib tööpäeviti 22–07 ning laupäeval, pühapäeval ja **riigipühadel** kogu
  ööpäeva (`CONFIG.ootariif.riigipuhadOnOo`, Elektrilevi hinnakiri).
- „Leia odavaim aeg“, elektriauto laadimine ja soovitused valivad akna **hinna koos tasudega**
  järgi (öine võrgutasu on odavam), näidatakse ka börsihinda.
- Kuu € (`majaElekter`) on hinnang: 15-min ost × börsihind + **vastaval ajal kehtinud** tasud ja KM.
  `CONFIG.hinnad` sisaldab praegu kehtivaid tasusid; varasemate perioodide väärtused on töövoos
  `uuenda-hinnad.yml` (`KM_AJALUGU`: KM 22 % enne 01.07.2025; `TASUDE_AJALUGU`: taastuvenergia tasu
  1,05 s/kWh 2024, 0,84 alates 2025; varustuskindluse tasu 0,758 s/kWh alates 01.01.2026; elektriaktsiis
  0,145 s/kWh enne 01.05.2025; müüja marginaal 0,6 s/kWh ja müügitasu 1,05 s/kWh koos KM-ga enne 01.11.2026;
  allikad on kommentaarides). Võrgutasu kWh-hinnad on kõigil kuudel CONFIG-i omad (Elektrilevi kWh-hinnad
  2025–2027 hinnakirjamuudatustega ei muutunud: päev 3,49, öö 1,99 s/kWh).
- **Elektrimüüja alates 01.11.2026: Sunly.** Börsihinna marginaal tarbimisel 4,5 €/MWh + KM
  (`CONFIG.hinnad.marginaal` = 0,45 s/kWh ilma KM-ta), võrku andmisel 8,5 €/MWh + KM
  (`CONFIG.hinnad.muugitasu` = 0,85 × 1,24 = 1,054 s/kWh koos KM-ga; müügihind = börsihind ilma KM-ta − müügitasu).
  Kõik hinnad kuvatakse s/kWh. Päevakokkuvõtete (`paevad.json`) müügihind kasutab sel päeval kehtinud müügitasu.
- **Ette teada hinnamuudatused** (`CONFIG.hinnamuudatused`, nt uus võrguteenuse hinnakiri): kirje `alates`
  ("AAAA-KK-PP", Tallinna päeva 00:00) ja muutuvad `CONFIG.hinnad` väärtused. Kuni kuupäevani kehtivad
  `CONFIG.hinnad` väärtused, sellest alates kirje omad – nii lehtedel (`feesAt` / `tariffsAt`, js/common.js) kui
  töövoos (`TASUDE_MUUDATUSED`, `tariff_at`); graafikute leht saab need hinnad.json-i `meta.tariffChanges`-ist.
  Praegu: Elektrilevi hinnakiri madalpingel üle 63 A (Võimsus VMA2) alates 01.02.2027 – kuutasu 30,41 → 30,58 €/kuu,
  läbilaskevõime 0,32 → 0,33 € / A kuus; kasutusvõimsus 2,45 ja tarbimiskoha kasutusvõimsus 2,56 € / kW kuus ning
  kWh-hinnad jäävad samaks (ilma KM-ta).
- **Võrgu fikseeritud tasud** (`vorguKuutasu`, `labilaskevoimeTasu`, `kasutusvoimsusTasu`,
  `tarbimiskohaKasutusvoimsusTasu`, ilma KM-ta) on elektriinfo lehe hinna koostise all eraldi kirjas koos
  eelseisva hinnakirjamuudatusega. s/kWh hinnas ja kuu € arvestuses neid pole (sõltuvad läbilaskevõimest A ja
  kasutusvõimsusest kW); arve järgi kuutasu kokku käib `CONFIG.hinnad.kuutasu` väljale.
- **Tasu muutumisel** lisa vana väärtus esmalt `TASUDE_AJALUGU`-sse (kuni muutuse kuupäevani) ja muuda
  siis `CONFIG.hinnad`-i. Iga kuu kirjes on sõrmejälg `cfg`; kui see erineb, arvutab töövoog vahemälus
  olevad kuud järgmisel käivitusel ise uuesti (`index.html`-i muutmine töövoogu kohe ei käivita).
- **Fikseeritud kuutasu** (võrgu kuu- ja läbilaskevõimetasu, müüja kuutasu; €/kuu koos KM-ga) lisandub
  ainult siis, kui see on sisestatud: praegune `CONFIG.hinnad.kuutasu`, varasemad perioodid
  `TASUDE_AJALUGU["kuutasu"]` (Elektrilevi kuutasud muutusid 01.08.2025 ja 01.06.2026; summad on veel 0 –
  täida arvete järgi). Jooksval kuul ja „aasta varem sama ajani“ summas lisatakse kuutasust sama osa
  kuust, mis on möödunud. Kui arve on järjepidevalt suurem, sisesta kuutasu.

## Energia töölaud (`energy-dashboard.html`)

Eraldi leht, mis koondab ühte vaatesse päikesepargi tootmise, akupanga oleku, võrgu
ostu/müügi, maja tarbimise ja börsihinna koos soovitusega (lae akut võrgust, kasuta
akut, müü või tarbi). Elektriinfo lehe päikesekaart näitab samu mõõtmisi lühidalt ja viitab sellele lehele.

```
Solarman OpenAPI → GitHub Actions (uuenda-paike.yml) → paike.json ┐
Elering API      → GitHub Actions (uuenda-hinnad.yml) → hinnad.json ┴→ GitHub Pages → energy-dashboard.html
```

- Solarmani võtmed on GitHub Actions Secretsis, mitte lehe koodis. Lisa
  **Settings → Secrets and variables → Actions** alla:
  - `SOLARMAN_APP_ID` – Solarman OpenAPI App ID
  - `SOLARMAN_APP_SECRET` – Solarman OpenAPI App Secret
  - `SOLARMAN_EMAIL` – Solarmani konto e-post
  - `SOLARMAN_PASSWORD` – parool tavatekstina või selle SHA-256 räsi (64 hex-märki);
    tavatekst räsitakse enne päringut väiketähtedega hex-kujule
  - `SOLARMAN_STATION_ID` (valikuline) – jaama ID; puudumisel kasutatakse konto esimest jaama
- Seejärel käivita **Actions → Uuenda päikeseandmed → Run workflow**. Edaspidi käivitab töövoo
  „Uuenda elektrihinnad“ (väline ajastaja iga 30 minuti järel), nii et `paike.json` uueneb ~30-min
  sammuga; töövoo enda `schedule` (`*/10`) on ainult lisavaru, sest GitHub käivitab ajastatud töid
  ebaregulaarselt. Commit tehakse ainult siis, kui andmed muutusid (GitHub Pagesi pehme piirang on
  10 avaldamist tunnis koos `hinnad.json`-iga); leht ise kontrollib faili iga 5 minuti järel.
- `paike.json` sisaldab ainult võimsusi ja energiakoguseid (ilma jaama asukoha ja
  võtmeteta). GitHub Pagesi leht on avalik, seega on avalikud ka need andmed.
- Tariifid, hinnapiirid ja hinnasildid loeb töölaud `index.html`-i `CONFIG`-ist, nii et
  neid tuleb muuta ainult ühes kohas. Töövoog `uuenda-hinnad.yml` loeb tasud samast `CONFIG`-plokist
  ja kirjutab kasutatud väärtused `hinnad.json`-i `meta.tariffs`-i.
- Aku võimsus on |`chargePower`| − |`dischargePower`| (+ laeb, − tühjeneb), ost võrgust `purchasePower`.
  Ühise välja `batteryPower` märki kasutatakse ainult siis, kui laadimise/tühjenemise väljad puuduvad;
  see kalibreeritakse kaadritest (selle jaama puhul `batteryPower` < 0 = laeb). Kui aku suund kuvatakse
  siiski valepidi, määra `energy-dashboard.html` `CONFIG`-is `solarman.akuMark` käsitsi. Hoidevool
  (alla 0,2 kW muutumatu laetusega) on „Ootel · hoiab +0,1 kW“ (ka graafiku tooltipis „aku ootel · hoiab
  +0,1 kW“), mitte „Laeb“. Aku kasutatav mahutavus on `aku.mahtKwh` (100 kWh): sellest tulevad laadimis- ja
  tühjenemisaja hinnang, „Salvestatud“ plaat ja aku tulu laetuse muutus.
- **Müügihind** = börsihind ilma KM-ta − `index.html` `CONFIG.hinnad.muugitasu` (müügilepingu marginaal koos KM-ga,
  1,05 s/kWh; energialeht loeb selle koos teiste tasudega, varukoopia on energialehe `CONFIG.hinnad`-is); müügihinnale
  käibemaksu ei lisata.
- Päikeseandmete aegumislävi (45 min) loetakse `index.html`-i `CONFIG.paike.aegunudMinutites`-ist, nii et
  mõlemal lehel kehtib sama lävi. Vanema mõõtmise korral on energiavoo graafika tuhm ja liikumatu (tekst jääb täiskontrastiga) ja pealkirjas on
  mõõtmise kellaaeg („Energiavoog kell 14:59“). Kui `index.html`-i ei õnnestu lugeda, kasutatakse
  energialehe varukoopiat ja bänneris on vastav teade; erinevus `hinnad.json`-i `meta.tariffs`-iga kuvatakse samuti.
- Tänased kogused on inverteri 15-min mõõtmiste summad kuni viimase mõõtmiseni („Täna kuni 14:59
  (inverter)“; pooleli kaader ainult `lastUpdateTime`-ni); arve alus (ost võrgust Estfeedi arvestist) on elektriinfo lehel. „Päikesest kaetud“ on sama
  mõõdik mis elektriinfo lehel.
- **Järgmised tunnid** (oma kaart hinnakaardi all): tulevate tundide keskmine börsihind horisontaaltulpadena
  hinnaklassi toonides; graafiku all on legend ainult esinevate klasside sõna ja vahemikuga, ekraanilugejale on
  tabelikaksik, kus iga tunni real on ka hinnaklassi sõna.
- **Päeva graafik** (Chart.js-i virn ühise ajateljega: hinnapaneel, alumine paneel, inverteri režiimiriba ja aku
  laetuse paneel; lüliti „1 h / 15 min“: telefonis vaikimisi 1 h, laiemal ekraanil 15 min):
  - **Vahelehed „Eile“, „Täna“, „Homme“.** *Eile* näitab eilset päeva 00:00–24:00 mõõtmistena: hinnad `hinnad.json`-ist
    (fail algab eilsest 00:00-st) ja inverteri kaadrid `paike.json`-ist (fail sisaldab eilseid kaadreid), samad paneelid,
    režiimiriba, lülitid ja tabel mis „Täna“; „praegu“-joont, möödunud perioodide tuhmistust, odavaimat akent ja
    prognoosi pole. Plaatidel eilne madalaim, keskmine ja kõrgeim börsihind ning suurim tarbimine (inverter). Kui eilse
    päeva viimased kaadrid pole veel failis (kesköö järel), on graafiku all „Eilsed inverteri mõõtmised on kuni HH:MM“.
  - **Päikesetõus ja -loojang** (kõigil vahelehtedel): katkendlik juhtjoon päikese toonis (`--solar`) igal paneelil
    andmete taga ning energiapaneeli ülaservas päikese ikoon ja kellaaeg („tõus 07:39“ / „loojang 16:29“, kitsal
    graafikul „↑ 07:39“ / „↓ 16:29“; ilma energiapaneelita hinnapaneelil). Silt ei kata ühikut, teisi silte ega
    „praegu“-joont; legendis ja graafiku kirjelduses (ekraanilugeja) on samad ajad. Ajad arvutatakse lehel
    (`sunTimes` failis `js/common.js`, NOAA päikesevalem, täpsus ~1 min) asukoha järgi `energy-dashboard.html`
    `CONFIG.asukoht` (`{ laius, pikkus }` kraadides, Viljandi 58,36 / 25,59; linna täpsusest piisab, täpset aadressi
    pole vaja; `null` lülitab märke välja). Kõik ajad on Tallinna ajas (EET/EEST): kellakeeramise päeval on tõus ja
    loojang õiges ajas ja graafikul 23/25-tunnise päeva õiges kohas, brauseri ajavöönd tulemust ei mõjuta.
  - **Inverteri režiimi riba** („Täna“ ja „Eile“): iga 15-min kaader on *laeb võrgust*, *laeb päikesest*, *aku kasutus*,
    *müük võrku* või *aku ootel* (alla 0,2 kW). Režiim on tuletatud mõõtmistest (laadimise allikas = suurem osa
    energiavoost), mitte inverteri plaan; riba kohal „Inverter praegu: Aku kasutus · alates 17:30“ (vananenud
    mõõtmisel „Inverter (mõõdetud 14:59): …“).
  - **Hinnapaneel:** börsihinna tulbad, **ostuhind** (lõpphind koos tasudega, pidev joon), **müügihind**
    (punktiir), päeva keskmine ja odavaim 2 h aken (lõpphinna järgi).
  - **Alumine paneel** (lüliti „Täna“ ja „Eile“): *Energiavood* – päike, maja, ost võrgust (katkendjoon), aku võimsus
    (+ laeb / − tühjeneb) ja **aku laetus** (omaette paneel 0–100 % režiimiriba all, reservijoon 20 %,
    kaksiktelge pole); *Võrguga vahetus* – ost allapoole
    ja müük ülespoole kWh-des perioodi kohta (mõõdetud osa; tooltipis ka ≈ €).
  - **Maja tarbimise prognoos** (katkendjoon maja tooniga, ainult *Energiavood* vaates): prognoositava päevaga
    **sama tüüpi** (tööpäev / puhkepäev = laupäev, pühapäev, riigipüha) viimase 7 täieliku päeva (`paevad.json` `loadH`)
    sama kellatunni keskmine; kui sama tüüpi päevi on alla 3, siis kõigi viimase 7 päeva keskmine. Silt näitab alust
    („7 tööpäeva keskmine“, „7 puhkepäeva keskmine“, „7 päeva keskmine“). „Täna“ praegusest hetkest päeva lõpuni,
    „Homme“ terve päev (alumine paneel on siis ainult prognoos) ja plaat „Tarbimise prognoos ≈ … kWh, ≈ … € võrgust ostes“.
    Graafiku all on selgitus (päevad, kogus, maksumus lõpphinnaga, täna lisaks mõõdetud + prognoos). Ilma, päikese ega
    aku prognoosi ei arvestata; prognoos on märgitud „prognoos“, mitte „(inverter)“. Puhkepäeva profiil erineb andmetes
    tööpäevast (hommik madalam, keskpäev kuni ~2,5 kW kõrgem); tagasiulatuvalt (112 päeva) vähendas päevatüüp prognoosi
    viga ~5 %.
  - **Päeva kogusummad** (avatav plokk graafiku all): päike, maja, ost, müük, aku laetud ja tühjendatud – kWh,
    ≈ € ja keskmine s/kWh.
- **Kokkuvõtte periood** (lüliti kaardi ülaosas, nähtav siis, kui `paevad.json` on olemas): *Täna* (`paike.json`,
  kuni viimase mõõtmiseni), *Eile*, *7 päeva* (eilsega lõppevad 7 päeva), **neli viimast kalendrikuud** – kolm eelmist
  kuud tervikuna ja jooksev kuu (kuu algusest koos tänase poolelioleva päevaga; nähtav ka kuu 1. päeval) – ning
  **eelmine ja see aasta** (1. jaanuarist; see aasta koos tänase poolelioleva päevaga). Sildid on kuu nimed ja aastad
  (nt 1.11.2026: *August*, *September*, *Oktoober*, *November*, *2025*, *2026*); eelmise aasta kuu pealkirjas on aasta
  („Detsember 2026 kokku“). Perioodi summad on päevade summad; eurod ainult siis, kui igal päeval on eurod olemas. Aku
  laetuse muutus on perioodi esimese ja viimase päeva järgi. Puuduvad või aukudega päevad on kaardil märkusena; nupp on
  peidetud, kui perioodil andmeid pole. Mitme päeva perioodil on all **päevade graafik** (Chart.js; näitajad *Päike*,
  *Tarbimine*, *Võrk* – ost alla, müük üles, *Aku* – laetud üles, tühjendatud alla, *Energiahind* – keskmine
  ostuhind ja maja maksis s/kWh), valitud päeva rida graafiku kohal (hiir, puudutus, nooleklahvid) ja tabelivaade.
- **Aasta vaade:** inverteri plokid on päevakokkuvõtete summa alates `paevad.json` `meta.from`-ist (päikesepargi
  kasutuselevõtt, 1.6.2026). **Kuud enne seda** (2026 jaanuar–mai, kogu 2025) on omaniku otsusel võrguarvesti
  kuusummadest (`hinnad.json` `majaElekter`): päikest ja akut veel polnud, seega päike, müük ja aku on 0 ning maja
  tarbimine = ost võrgust (kWh ja € koos tasudega). Nii on aasta kogutarbimine kogu aasta kohta, tootmine ja aku tulevad
  inverterist. Sama kuu kohta eri allikate arve ei liideta (võrguarvesti kuud on täielikult enne inverteri esimest päeva).
  Pealkirja vihjes on mõlemad allikad („jaan–mai (võrguarvesti) · 1.6–1.11 · 151 päeva (inverter)“), märkuses ja
  kogusummade tabeli selgituses samuti; graafikul ja tabelis on need kuud märgitud „(võrguarvesti)“. Graafik ja tabel on
  **kuu kaupa** (pooleli kuu ja puudulike päevadega kuu on tuhmimad). Lisaks on plokk **„Ost
  võrgust AAAA“** võrguarvesti (Estfeed) kuusummadest (`hinnad.json` `data.majaElekter`, arve alus): kogus, kulu
  koos tasudega (≈, hinnang), keskmine hind, allikas ja lõikeaeg („võrguarvesti (Estfeed) · jaanuar–november, november
  kuni 06:30 · arve alus“), puuduvad ja esialgsed kuud ning tabel „Kuude kaupa“. Jooksval aastal on ka võrdlus
  **„aasta varem sama ajani“** (eelmise aasta samad kuud, jooksev kuu `kwhToDate`/`eurToDate`-iga; ainult siis, kui
  kõik vastavad kuud on olemas). Aastal, millest inverteri mõõtmisi pole (2025), on kaardil ainult see plokk.
  Võrguarvesti ja inverteri numbreid ei liideta (vt „Mõõtmiste loogika“).
- **Täna kokku** (inverter, kuni viimase mõõtmiseni; eurod on hinnang perioodi hinnaga):
  - **Aku:** tulu = tühjendamise väärtus (lõpphinnaga) − laadimise kulu (päikesest laetud osa müügihinnaga, ülejäänu
    lõpphinnaga) ± laetuse muutus (laetuse vahe × mahutavus tänase keskmise laadimishinnaga; laadimiseta päeval maja
    keskmise ostuhinnaga). Ilma laetuse muutuseta oleks eile laetud energia tühjendamine „tasuta“.
  - **Võrk:** ost ja müük kWh ja €, netokulu = ost − müük.
  - **Päike:** toodang ja väärtus: otse majja läinud osa lõpphinnaga, akusse ja võrku läinud osa müügihinnaga
    (akusse läinud päikese hilisem väärtus on aku tulus, nii et sama kWh-d ei loeta kaks korda); „Päikesest kaetud“.
  - **Tarbimine:** maja tarbimine, selle hind ilma päikese ja akuta (kõik osta tarbimise ajal lõpphinnaga) ja võrgu netokulu.
  - **Maja energiahind täna:** keskmine ostuhind (maja tarbimine perioodi lõpphinnaga) → maja maksis (võrgu netokulu /
    maja tarbimine) ja „x % odavam“. Kõrval aku laetuse muutus, sest päeva lõpuks täitunud või tühjenenud aku
    mõjutab võrdlust.

- **Trendid** (kaart lehe lõpus): kuni 24 kuud (`hinnad.json` `majaElekter`: jooksev aasta ja aasta varem samad kuud)
  neljal paneelil ühise kuuteljega, kaksiktelge pole: **kWh** – ost võrgust kuus (võrguarvesti) öö/päeva jaotusega
  (jaotuseta kuu neutraalne), päike kuus ja maja tarbimine kuus (inverteri päevakokkuvõtted; enne päikeseparki päike 0 ja
  tarbimine = ost) ning kõigi kolme **12 kuu libisev keskmine**; **€** – kulu kuus koos tasudega ja 12 kuu keskmine;
  **s/kWh** – börsihind kuus (`spotAvg`, ilma KM-ta), ostuhind (arve / ostetud kWh) ja „maja maksis“ (võrgu netokulu /
  tarbitud kWh, alates pargist) koos 12 kuu keskmistega; **tulu €** – aku tulu, päikese väärtus ja öötariifi sääst (öösel
  ostetud kWh × päeva ja öö võrgutasu vahe + KM, praeguste tasudega) virnastatult ja summa 12 kuu keskmine.
  Libisev keskmine = kuu ja 11 eelmise kuu keskmine, ainult lõppenud kuud ja kõik 12 peavad olemas olema (muidu auk
  joones); jooksev kuu on tuhmim ega osale. Plaadid on viimase 12 lõppenud kuu **summad** (aastane tase): ost (kWh, €,
  öö osa), maja tarbimine (ja päikese osa sellest), maja maksis s/kWh (kõrval ostuhind), tulu kokku (aku, päike,
  öötariif). Tähelepanekud andmetest (ainult kui andmed lubavad): päikesepargi järgsed kuud vs aasta varem samad kuud
  (ost, kulu, toodang) ja sama perioodi tarbimine koos päikese ja aku kaetud osaga, öö osakaal, viimase kuu hind 12 kuu
  keskmise suhtes, börsihinna ja lõpphinna muutus (turg vs tasud), 12 kuu keskmise suund viimase 3 kuuga. Valitud kuu
  rida graafiku kohal (hiir, puudutus, nooleklahvid), legend, selgitus ja tabelivaade. Kulu ei sisalda kuutasu, kui see
  on seadetes 0.

**Brauser ei suhtle Solarmani API-ga:** päikese- ja akuandmed tulevad ainult failist `paike.json`, mille kirjutab
töövoog GitHub Secretsis hoitud võtmetega. Brauseris pole ühtegi Solarmani võtit, parooli ega tokenit. (Varasem
valikuline „Solarmani otseühendus“ eemaldati versioonis 2.6.0; selle brauserisse salvestatud võtmed kustutatakse
lehe esimesel avamisel.)

„Värskenda“ nupp on pärast iga värskendust 30 s keelatud (nupul on loendur), et liiga tihe
vajutamine ei koormaks GitHub Pagesi ega Eleringi API-t; elektriinfo lehe „Proovi uuesti“
ootab 15 s.

## Graafikud (`graafikud.html`)

Ülevaateleht samadest andmefailidest (`hinnad.json`, `paike.json`, `paevad.json`), sama parooli ja disainiga. Erinevalt
kahest töölehest on graafikud siin **animeeritud**: iga kaart ilmub ja selle graafik joonistub, kui kaart kerimisel
vaatesse jõuab (`IntersectionObserver`); tulbad kasvavad lainena, jooned joonistuvad vasakult paremale, jagatud tulbad
kasvavad täis ja plaatide numbrid loendavad nullist. Lülitid (eile/täna/homme, 1 h / 15 min, täna/eile, 30/90 päeva, kWh/€) animeerivad graafiku uutele
väärtustele. **Vähendatud liikumise** eelistusega (`prefers-reduced-motion`) ja teemavahetusel animatsioone pole.

| Kaart | Andmed | Mida näitab |
|---|---|---|
| Plaadid | kõik | elektri hind praegu koos tasude ja KM-ga (all börsihind + tasud); päike, aku tulu (`batteryGainEur`) ja maja tarbimine viimase 30 lõppenud päeva kohta |
| Elektri hind | `hinnad.json` `data.ee` ja `meta.tariffs` | **eile / täna / homme**, **1 h või 15 min** (vaikimisi telefonis 1 h, arvutis 15 min). Tulp = börsihind (all) + tasud (heledam, üleval), mõlemad KM-ga: tasud = müüja marginaal + võrgutasu (päeva- või öötariif; öötariif ka nädalavahetusel ja riigipühadel) + taastuvenergia- ja varustuskindluse tasu + aktsiis, KM kogu summale, kuutasud pole sees – sama arvutus mis elektriinfo lehe lõpphind (kontrollitud: kõik 96 perioodi samad). Tasud võetakse `hinnad.json` `meta.tariffs`-ist (töövoog kirjutab sinna `index.html` `CONFIG`-i väärtused); kui need puuduvad, näitab graafik börsihinda KM-ga ja teadet. Värv on päeva sees **suhteline** (odavaim roheline → kalleim punane lõpphinna järgi), mitte elektriinfo lehe hinnaklass; möödunud perioodid tuhmid, praegune raamiga, katkendjoon = päeva keskmine. Tooltip: kokku, börsihind, tasud ja tariif. Homme alates ~15:00 |
| Kust energia tuli | `paevad.json` | kolm jagatud tulpa (eile, 7 päeva, 30 päeva): päikesetoodang vs ost võrgust (kogu majja tulnud energia); osa protsent on ploki sees, kui see mahub, kogused rea päises ja all |
| Päike, maja, võrk ja aku | `paike.json` `frames` | 15-min keskmised võimsused täna või eile (kW): päike alana, maja tarbimine, ost võrgust ja aku joontena; aku märk nagu energialehel (+ laeb, − tühjeneb majja), nulljoon telje toonis; märkuses akust kasutatud kWh. Jooned monotoonse interpolatsiooniga (astmete juures ei viska üle, nt aku ei näi hetkeks negatiivsena) |
| Aku | `paike.json` `frames`, `realTime`; `paevad.json` | plaadid: laetus praegu (ja laeb / tühjeneb / ootel, < 0,2 kW = ootel), laetud ja tühjendatud kWh valitud päeval (täna või eile; laetuse algus → lõpp, suurim võimsus), aku tulu eile ja 30 päeva; graafikud: laetus % ja laadimine (üles) / tühjenemine (alla) kW 15 min kaupa – kaks eraldi graafikut, et ühelgi poleks kahte y-telge |
| Päevad | `paevad.json` | päike + ost võrgust virnas (sisse tulnud energia) ja maja tarbimine joonena, 30 või 90 päeva; tooltipis aku tulu |
| Tarbimine kellaaja järgi | `paevad.json` `loadH` | viimase 14 päeva keskmine kW kellatunni järgi, tööpäev vs puhkepäev (nädalavahetus ja riigipühad) |
| Maja üldelekter kuude kaupa | `hinnad.json` `data.majaElekter` | viimased 12 kuud arvesti järgi (kWh või €) ja aasta varasem sama kuu; pooleli kuu on heledam |

- **Loetavus:** iga graafiku ühik on telje kohal (s/kWh, kW, %, kWh, €); hinnagraafikul on otsesildid (praegu, kalleim,
  odavaim ja keskmine joone otsas, kattuv madalama prioriteediga silt jääb ära); 15-min graafikute ajatelg ainult
  täistundidel (iga 2 h, kitsal ekraanil iga 3 h); aku kahe graafiku plot-alad algavad samast kohast; virnastatud tulpade
  osade vahel on 2 px pinnavahe; jooned 2 px; plaatide ühik on väiksem kui number. Seeriavärvid (päike, maja, võrk, aku)
  on kontrollitud värvipimeduse eristatavuse validaatoriga nii heledas kui tumedas teemas.
- **Hõljutus:** iga graafik näitab tooltipi (kogu veerg korraga), hinnagraafik ka erinevust päeva keskmisest, kuude graafik
  muutust aasta varasemaga. Puutel töötab sama toksamisega.
- **Ligipääsetavus:** iga lõuend on `role="img"` ja selle `aria-label` on graafiku tekstikokkuvõte (nt odavaim ja kalleim
  tund); lülitid on raadionupud (klaviatuuriga kasutatavad).
- **Puuduvad andmed:** faili laadimise viga või puuduv päev näitab kaardil teadet, teised kaardid töötavad edasi.
- **Seaded:** `graafikud.html` alguses `CONFIG` (failid, KM-i varuväärtus, perioodid). Tasusid ja hinnapiire siin ei ole.
- **Uus graafik:** lisa märgistusse kaart `class="card reveal" data-chart="<nimi>"` koos `<canvas>`-iga ja skripti funktsioon
  objekti `DRAW` alla; `upsert()` loob või uuendab graafikut, `barAnimation()` / `lineAnimations()` annavad animatsiooni,
  `tooltip()` ja `axis()` ühise stiili, värvid tulevad tokenitest (`chartTokens`). Bento paigutus on `css/graafikud.css`-is.

## Parooliga kaitse

GitHub Pages ei oska parooli küsida ja repo on avalik, seega ainus päriselt turvaline kaitse on
**andmete krüpteerimine**: töövood kirjutavad `hinnad.json`, `paike.json` ja `paevad.json` repo'sse
krüpteeritult (AES-256-GCM; võti tuletatakse paroolist PBKDF2-HMAC-SHA256-ga, 600 000 iteratsiooni) ja
brauser dekrüpteerib need WebCrypto-ga pärast parooli sisestamist. Parool ei jõua kunagi serverisse ega
repo'sse: see on ainult GitHub Secretsis ja elanike peas. Ilma paroolita näeb külaline ainult avamisvaadet;
andmefailid on talle juhuslik baidijada. Lehekood (`index.html` koos `CONFIG`-i tariifidega) jääb avalikuks,
sest see on avalikus repo's niikuinii.

**Sisselülitamine**

1. Vali pikk parool (vähemalt 12 märki, soovitavalt 16+ või mitmesõnaline lause; parooli alguse ja lõpu tühikud
   ei loe). Lisa see **Settings → Secrets and variables → Actions → New repository secret** nimega `LEHE_PAROOL`.
2. Käivita mõlemad töövood käsitsi (**Actions → Uuenda elektrihinnad → Run workflow** ja **Uuenda päikeseandmed
   → Run workflow**). Need krüpteerivad andmefailid ja loovad `lukk.json`-i (sool ja parooli kontrollväärtus).
3. Ava leht: see küsib parooli. Tuletatud võti (mitte parool) on **mitte-eksporditav** `CryptoKey` ja seda hoitakse
   brauseri IndexedDB-s (`kauge32-lukk`): „Jäta meelde selles seadmes“ korral püsivalt, märkimata ainult selle
   vahelehe jaoks (vahelehe sulgemisel ei saa kirjet enam kasutada ja see kustub järgmisel avamisel, hiljemalt 12 h
   pärast viimast kasutust). Jaluse „Lukusta leht“ unustab kõik selle brauseri võtmed kohe. Varasem
   `localStorage`/`sessionStorage`-is hoitud võti kolitakse automaatselt üle ja kustutatakse.

Kuni `lukk.json`-i pole, töötab leht nagu enne (parooli ei küsita) ja loeb tavatekstis andmefaile. Kui `lukk.json` on
olemas, võtab leht samalt saidilt vastu **ainult krüpteeritud** andmefaile (`Lukk.fetch`): tavatekstis fail annab selle
faili kohta laadimisvea, et krüpteeritud faili ei saaks vaikselt võltsitud tavafailiga asendada. Kaitse esmakordsel
sisselülitamisel on seega `paike.json` paar minutit (kuni päikesetöövoog on käinud) laadimisveaga. Kui `lukk.json`
vahepeal kustutatakse (kaitse võeti maha), jätkab juba avatud leht lukuta. Teise saidi vastuseid (Eleringi API,
varuproksi) dekrüpteerija ei puuduta: võõras „ümbrik“ ei saa parooli küsida ega võtit kasutada. Brauser ja töövoog
avavad ainult ümbrikke, mille PBKDF2 iteratsioonide arv on 600 000…2 000 000, sool vähemalt 16 ja nonss 12 baiti
(väiksem arv oleks nõrk võti, suurem koormaks protsessorit minuteid); `ITER`-i tõstmisel üle selle tõsta ka `MAX_ITER`
(`js/lukk.js` ja `lukk.py`).

**Kuidas töövoog töötab** (`.github/scripts/lukk.py`): samm „Paigalda krüpteerimise teek“ paigaldab `cryptography`
paketi ilma ühegi secret'ita keskkonnas ja ainult `.github/scripts/requirements-lukk.txt` räsidega (`pip --require-hashes`;
uuendamise juhend on faili alguses). Samm „Ava krüpteeritud andmefailid“ dekrüpteerib failid
kohapeal, skript töötab tavatekstiga nagu varem, samm „Lukusta andmefailid“ krüpteerib selle töövoo
kirjutatud failid uuesti. Muutumata fail taastatakse baidi täpsusega (uus nonss annaks iga kord uue sisu ja
asjatu commit'i), teiste töövoogude failid (nt `paike.json` hindade töövoos) taastatakse algsel kujul. Hindade
töövoog avab `paike.json`-i ainult lugemiseks (`ava … --loe paike.json`): kui see ei avane, jätkab töövoog hoiatusega
ilma eilse päeva kaadriteta (eilne päev laaditakse siis Solarmanist), mitte ei jää seisma.
Sool on kõigil failidel sama (`lukk.json`-i oma), et brauser tuletaks võtme ainult üks kord (~0,5 s telefonis).
`lukk.json`-i kontrollväärtuse nonss tuletatakse soolast, seega on fail sama parooli ja soolaga alati baidi täpsusega
sama: parooli vahetusel kirjutavad mõlemad töövood sama `lukk.json`-i ja nende samaaegsed commit'id ühenduvad
konfliktita (varem jäi teise töövoo andmefail konflikti tõttu vana parooli alla).

**Parooli vahetus:** pane uus parool `LEHE_PAROOL`-i ja vana `LEHE_PAROOL_VANA`-sse, käivita mõlemad töövood
(failid krüpteeritakse uue parooliga, `lukk.json`-i kontrollväärtus uueneb) ja kustuta `LEHE_PAROOL_VANA` alles
siis, kui **mõlemad** töövood on pärast vahetust roheliselt lõppenud (iga roheline käivitus salvestab oma faili uue
parooliga). Brauser märkab vahetust („Parool on vahetatud“) ja küsib uue parooli. Kui mõni fail on veel vana
parooliga, näitab leht ainult selle faili kohta laadimisviga (võtit ei unustata ega parooli küsita uuesti) kuni
seda faili kirjutav töövoog on uuesti käinud (≤ 30 min). Kui `LEHE_PAROOL_VANA` kustutati liiga vara ja töövoog
„Uuenda päikeseandmed“ jääb veaga seisma („ei avane …“), lisa vana parool ajutiselt tagasi ja käivita töövoog.

**Kaitse mahavõtmine:** kustuta `LEHE_PAROOL`, pane senine parool `LEHE_PAROOL_VANA`-sse, käivita mõlemad
töövood (failid salvestatakse tavatekstina, `lukk.json` kustub), kustuta `LEHE_PAROOL_VANA`. Kui `LEHE_PAROOL`
lihtsalt kustutada, jääb töövoog veaga seisma (krüpteeritud faili ei saa avada) ja andmed ei uuene.

**Piirid, mida tasub teada**

- Krüpteerimine kaitseb andmeid alates esimesest krüpteeritud commit'ist. **Varasemad commit'id sisaldavad
  andmefaile tavatekstina** ja on avalikus repo's kõigile loetavad. Need kaovad ainult repo privaatseks tegemisega
  (GitHub Pages privaatsest repo'st vajab tasulist plaani) või ajaloo ümberkirjutamisega.
- **Parool, sool ja „Jäta meelde“ (NIST SP 800-63B / 800-132):** uus `LEHE_PAROOL` peab olema 12–256 märki (lühemaga jääb
  töövoog parooli vahetusel veaga seisma ega muuda midagi; kehtivat parooli ei kontrollita, et logisse ei tuleks vihjet);
  parool normaliseeritakse NFKC-kujule (töövoos ja brauseris sama). Parooli vahetusel saab `lukk.json` uue soola
  (`tuleta_sool`: HMAC-SHA256(PBKDF2(uus parool, vana sool), …)) – mõlemad töövood arvutavad sama soola, seega nende
  samaaegsed commit'id ei lähe konflikti; vana parooli uuesti kasutamine ei anna sama `lukk.json`-i. Avatud leht märkab
  uut soola ja küsib uue parooli („Parool on vahetatud“). „Jäta meelde“ võti kehtib 30 päeva salvestamisest (ei pikene
  kasutamisega), vahelehe võti 12 h viimasest kasutusest. Ebaturvalisel ühendusel (http:// mitte-localhost aadressil, kus
  brauser WebCrypto-t ei luba) lukus leht ei avane ja näitab teadet HTTPS-i kohta.
- Parooli saab proovida piiramatult (failid on avalikud), seega loeb parooli pikkus: PBKDF2 600 000 iteratsiooni
  teeb ühe katse kalliks, aga lühikese sõnastikusõna murrab see siiski. Lehekülg ise katseid ei piira ega saagi piirata.
- Salvestatud võti on `ott-max-netizen.github.io` ühises IndexedDB-s (kõik selle konto Pages-lehed jagavad seda).
  Võti on mitte-eksporditav: teise lehe skript (nt XSS-i korral) saaks sellega selles brauseris dekrüpteerida, aga ei
  saa võtit välja lugeda ega teise seadmesse viia. Jagatud seadmes jäta „Jäta meelde“ märkimata.
- **Actions'i logid on avaliku repo puhul kõigile nähtavad.** Töövood ei kirjuta logisse mõõteväärtusi (kWh, €,
  võimsused), ainult kuupäevi, kirjete arve ja olekuid; uue `print`/`warn` lisamisel hoia sama reeglit. Enne
  2026-10-31 parandust kirjutasid töövood logisse kuude kWh ja €: vanad käivitused saab kustutada **Actions →
  käivitus → ⋯ → Delete workflow run** (logid kustuvad ka ise säilitusaja möödudes, **Settings → Actions → General →
  Artifact and log retention**).
- `file://` alt avatud lehel (ilma HTTPS-ita) WebCrypto ei tööta; andmefaile sealt niikuinii ei loeta.

## Külastuste statistika

Lehtede külastusi loendab [GoatCounter](https://www.goatcounter.com/) (töölaud **https://kauge32.goatcounter.com**, konto on
haldajal). See ei kasuta küpsiseid ega püsivaid kasutaja-ID-sid ja brauserisse midagi ei salvesta, seega nõusolekubännerit
üldjuhul vaja pole; lehe jaluses on lühike märge. Töölaud jäägu mitteavalikuks (GoatCounteri seadetes avalik vaade väljas).

**Mida loendatakse**

- **Lehe avamine:** Elektriinfo (`/`), Energia (`/energy-dashboard.html`) ja Graafikud (`/graafikud.html`); nimi ja pealkiri
  on fikseeritud lehe `<head>`-i sildi `data-goatcounter-settings`-is (sama leht ei jagune aadressi kuju järgi). Kaasa lähevad
  ekraani laius ja tulek (eelmine leht, nt sõnumi link); riigi tuletab GoatCounter päringust. Aadressi päringuosa
  (`?…`) ei saadeta ja automaatseid klikiloendureid ei seota (`no_events`).
- **Sündmused** (parooliga lehel, `js/lukk.js` → `js/common.js` `countEvent`): `lukk-kysitud` „Parooli vaade“ (avamisvaade
  näidati) ja `lukk-avatud` „Parool sisestatud“ (õige parool). Salvestatud võtmega avamine sündmust ei tee. Nende suhe
  näitab, kui paljud parooli vaatest edasi jõuavad.
- **Ei loendata:** lehe andmepäringuid (hinnad iga 10 min, energialeht iga 5 min) ega minutitikki – lahti seisev leht on
  üks avamine. Lehe andmeid (hinnad, kWh, eurod) ei saadeta kunagi.

**Kuidas numbreid lugeda:** GoatCounteri unikaalsed külastused on seansid (mitte inimesed); reklaamiblokeerijaga
brauserid ei loe, seega on arvud alammäär. `localhost`-i ja `file://` avamisi ei loendata (testimine).

**Oma külastused välja:** ava selles brauseris leht aadressiga, mille lõpus on `#toggle-goatcounter` (nt
`…/kauge32elekter/#toggle-goatcounter`); teade kinnitab, et loendus on selles brauseris välja lülitatud. Sama aadress
lülitab selle tagasi sisse.

**Tehniliselt:** skript `js/vendor/goatcounter-count.js` (GoatCounteri `count.js`, commit `c031008`) on repo sees, sest
CSP lubab skripte ainult samalt saidilt; see laaditakse `async`, nii et lehe joonistamist ei pidurda. Loendus läheb
`navigator.sendBeacon`-iga aadressile `https://kauge32.goatcounter.com/count` (CSP `connect-src`); pildipõhine
varuvariant on CSP `img-src`-iga tahtlikult blokeeritud. Failis on kaks Kauge 32 muudatust: `q: ''` (päringustringi ei
saadeta) ja `localStorage` on `try`/`catch`-is (keelatud salvestusruumiga brauser ei viska viga); märgitud faili alguses. Uuendamisel vaheta fail GoatCounteri repo `public/count.js`-iga, korda neid muudatusi,
uuenda `js/vendor/GOATCOUNTER_LICENSE.md`-i commit ja HTML-i linkides `?v=` (praegu `c031008-k32b`).

## Otsingumootorid

Mõlemal lehel on `<meta name="robots" content="noindex, nofollow, noarchive">` ja repo juures `robots.txt`.
`robots.txt` blokeerib andme- ja abifailid (`*.json`, `css/`, `js/`, `img/`, `README.md`, `CHANGELOG.md`), aga jätab
HTML-lehed tahtlikult robotitele loetavaks: `noindex` toimib ainult siis, kui robot saab lehte lugeda, ja
`robots.txt`-ga täielikult blokeeritud lehe võib Google siiski ainult aadressina loetleda, kui keegi sellele viitab.
Robotid näevad HTML-lehel ainult avamisvaadet. GitHub Pages ei luba `X-Robots-Tag` päist ega parooliga kaitset
serveri poolel. Repo enda lehte (`github.com/…`) indekseerib GitHub ise; seda saab vältida ainult repo privaatseks
tegemisega.

## Turvalisus

- API võtmed (Elering, Solarman) on ainult GitHub Actions Secretsis; töövood annavad secret'id
  edasi keskkonnamuutujatena ja kirjutavad andmefailidesse ainult mõõteväärtused.
- Lehe parool (`LEHE_PAROOL`) on samuti ainult Secretsis; andmefailid avaldatakse krüpteeritult ja
  avatakse brauseris (vt „Parooliga kaitse“). `js/lukk.js` laaditakse samalt saidilt (CSP lubab).
- Töövood: `actions/checkout` on lukustatud commit'i SHA-ga ja `persist-credentials: false`, nii et kirjutusõigusega
  `GITHUB_TOKEN` antakse ainult commit'i ja push'i sammule. Python'i sõltuvus (`cryptography`) paigaldatakse alati
  esmalt räsidega (`--require-hashes`) eraldi venv-i sammus, kus secret'eid pole; runneri süsteemne pakett on ainult
  hoiatusega varuvariant, kui PyPI pole kättesaadav. `PYTHONSAFEPATH=1`: Python ei impordi mooduleid töökataloogist.
  Mõõteväärtusi logisse ei kirjutata (logid on avalikud); tuletatud saladused (Solarmani parooli räsi, Solarmani ja
  Estfeedi tokenid, tükeldatud EIC-koodid, jutumärkideta võtmed) maskitakse (`::add-mask::`) ja välistest vastustest pärit
  tekst kirjutatakse logisse ühel real (`one_line`), nii et see ei saa lisada töövoo käske. Välise API aadress peab olema
  HTTPS (`require_https`; keskkonnamuutujaga `ELERING_URL`/`SOLARMAN_URL` saab seda muuta ainult kohalikuks testiks),
  ümbersuunamist mitte-HTTPS aadressile ei järgita (`NoDowngradeRedirect`) ja API vastus loetakse kuni 10 MB
  (`read_limited`), suurem vastus loetakse veaks.
- **Saladused ainult harul `main`:** andmetöövoogude ja live-avaldamise tööd käivad ainult harust `main`
  (`if: github.ref == 'refs/heads/main'`, ka käsitsi käivitusel) ja viitavad GitHubi keskkonnale **`production`**; PR-i
  eelvaade keskkonnale **`preview`**. Platvormi tasemel kaitseks (ka siis, kui keegi muudab mõnes harus töövoofaili):
  1. **Settings → Environments → production → Deployment branches and tags → Selected branches → `main`** (kinnitajaid
     mitte, muidu jäävad andmetöövood ootama).
  2. Tõsta secret'id `LEHE_PAROOL`, `LEHE_PAROOL_VANA`, `ELERING_*`, `SOLARMAN_*` ja `FIREBASE_SERVICE_ACCOUNT_KAUGE32_ELEKTER`
     **Repository secrets** alt keskkonna **production** alla (sama nimega; seejärel kustuta repo tasemelt).
  3. PR-i eelvaate jaoks lisa keskkonnale **preview** sama `FIREBASE_SERVICE_ACCOUNT_KAUGE32_ELEKTER` ja **Required
     reviewers** (eelvaade käivitub alles pärast sinu kinnitust, sest PR käivitab oma haru töövoofaili); kui eelvaadet
     vaja pole, jäta preview-le secret lisamata (eelvaate töö ebaõnnestub, live jääb puutumata).
  Kuni secret'id on repo tasemel, töötab kõik nagu enne (keskkonnad luuakse esimesel käivitusel automaatselt).
- Lehed lisavad sisu ainult `textContent`/`createElement` kaudu (mitte `innerHTML`). Lehe `Content-Security-Policy`
  meta-silt (kõigil kolmel lehel):
  - `script-src 'self'`: käivituvad ainult samalt saidilt laaditud skriptifailid – lehesiseseid skripte, inline-sündmusi,
    `eval`-i, `new Function`-it ega `setTimeout(string)`-i ei käivitata (ka siis, kui kuhugi peaks tekkima süstimisviga).
    Seepärast on lehtede kood failides `js/*.js` ja seaded mittekäivitatavas plokis (vt „Seadete muutmine“).
  - `require-trusted-types-for 'script'; trusted-types 'none'` (Trusted Types, Chromium-põhised brauserid): HTML-i ega
    skripti ei saa stringist kirjutada (`innerHTML`, `insertAdjacentHTML`, `script.src` stringist jms viskab vea).
  - `form-action 'none'`: vormi ei saa tavaviisil saata – parool jääb brauserisse ka siis, kui JS peaks ebaõnnestuma
    (avamisvaate vorm on lisaks `method="post"`, nii et parool ei satuks URL-i ka vanas brauseris).
  - `frame-src`, `worker-src`, `manifest-src`, `media-src`, `object-src 'none'`, `base-uri 'none'`.
  - `connect-src`: elektriinfo ja energia leht ainult sama sait, Eleringi API (`https://dashboard.elering.ee`, varuallikas)
    ja külastuste loendur; graafikute leht sama sait ja loendur. Ükski leht ei ühendu Solarmani API-ga (selle päringud
    teeb ainult töövoog). Uue välise teenuse (nt `CONFIG.varuProksi`) lisamisel lisa selle aadress lehe CSP-sse.
  - `style-src 'self'`: ainult samalt saidilt laaditud stiilifailid – HTML-i `style`-atribuute ega `<style>`-plokke pole.
    Skriptist antud stiilid (värvid, laiused, CSS-muutujad) seab `el()`/`svgEl()` CSSOM-iga (`node.style.cssText`), mida
    CSP ei piira; graafikute lehe legendi värvid on klassidega (`.swatch--solar` jt).
  Ainus kolmanda osapoole skript on repo sees olev GoatCounteri loendusskript (`js/vendor/goatcounter-count.js`, vt
  „Külastuste statistika“); see saadab ainult lehe nime, pealkirja, ekraani laiuse ja tuleku, mitte lehe andmeid.
- **Raamimise kaitse:** GitHub Pages ei luba saata `X-Frame-Options` ega `frame-ancestors` päist, seega peidab
  `js/teema.js` lehe, kui see on avatud teise saidi raamis (iframe, `html[hidden]`), ja proovib avada selle kogu aknas
  („clickjacking“). Raamis ei käivitu ka `js/lukk.js` (`Lukk.valmis` ei täitu): IndexedDB-d ei avata, sessiooni ei
  pikendata ega andmefaile ei laadita.
- **Firebase Hosting** (`firebase.json`) saadab päris HTTP päised, mida GitHub Pages ei luba: täielik
  `Content-Security-Policy` (sama baaspoliitika mis lehtedel, `connect-src` kõigi lehtede ühendus, lisaks `frame-ancestors
  'none'`; kehtib ka meta-sildita failidele nagu `img/icons.svg`) ja `X-Frame-Options: DENY` (raamimise keeld serveri poolel), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy` (kaamera, mikrofon, asukoht, maksed, USB, ekraanijagamine keelatud),
  `Cross-Origin-Opener-Policy` ja `Cross-Origin-Resource-Policy: same-origin` ning `X-Robots-Tag: noindex`. Päise CSP
  kehtib lisaks lehe meta-sildile (brauser rakendab mõlema ühisosa, nt graafikute lehe kitsam `connect-src` jääb). Avaldatakse ainult lehe failid: `README.md`, `CHANGELOG.md`,
  `public/` (Firebase CLI näidisleht, kustutatud), `skills-lock.json`, `package*.json` ja punktiga algavad failid/kaustad jäävad välja.
  Puuduv fail annab päris 404 (mitte `index.html`-i), mida `js/lukk.js` vajab (`lukk.json` puudub = lukku pole).
- **Firebase'i töövood:** live-avaldamise (`firebase-hosting-merge.yml`) töö õigus on ainult `contents: read` ja tegevusele
  ei anta `repoToken`-it (live-avaldamisel GitHubi API-t ei kasutata). `actions/checkout`, `FirebaseExtended/action-hosting-deploy`
  ja selle käivitatav `firebase-tools` (`firebaseToolsVersion`) on lukustatud täpse versiooniga (commit'i SHA / npm-i versioon,
  ka PR-i eelvaate töövoos), sest tegevus saab teenusekonto võtme `FIREBASE_SERVICE_ACCOUNT_KAUGE32_ELEKTER`; uuendamisel
  vaata enne uue versiooni muudatused üle. Ka `firebase-tools`-i ~630 kaudset npm-paketti on lukus: repo juure
  `package.json` + `package-lock.json` (integrity-räsid) paigaldatakse saladusteta sammus `npm ci --ignore-scripts` ja
  tegevuse `npx firebase-tools@<versioon>` kasutab seda kohalikku paigaldust (versioonid peavad klappima: `package.json`,
  `package-lock.json` ja töövoogude `FIREBASE_TOOLS_VERSION`; uuendamine: `npm install --package-lock-only
  --ignore-scripts firebase-tools@<uus>` ja töövoogudes sama versioon). `checkout` on ilma salvestatud tokenita. Live'i avaldatakse ainult harust
  `main`, korraga üks avaldamine (ootel ainult viimane), ajapiirang 10 min. Andmetöövood käivitavad avaldamise
  `repository_dispatch`-iga, mille jaoks piisab sammu „Salvesta muudatus“ olemasolevast õigusest `contents: write`
  (`gh workflow run` vajaks lisaks `actions: write`). Teenusekontole piisab Google Cloudi IAM-is rollist **Firebase Hosting
  Admin** (kontrolli, et sel pole projekti Editor/Owner rolli).
- **Paroolid ja tunnused brauseris:** lehe parooli ei salvestata ega hoita mälus – sellest tuletatakse kohe mitte-eksporditav
  võti ja avamisvormi väli tühjendatakse; konsooli parooli ega võtit ei logita. Brauseris pole ühtegi API võtit
  (Eleringi otsepäring ja GoatCounter ei vaja võtit). Varasema Solarmani otseühenduse brauserisse jäänud võtmed
  (`kauge32.energia.*`) kustutab `js/lukk.js` iga lehe avamisel ja „Lukusta leht“ vajutamisel. Avamisvormi parooliväljal
  pole `name`-i (vorm on `method="post"` ja CSP `form-action 'none'`), peidetud kasutajanime väli „Kauge 32“ aitab
  paroolihalduril ühistu parooli õigesti salvestada.
- **Teadlikult tegemata (2026-11 turvaauditite soovitused):** AES-GCM-i `additionalData` failinimega (vajaks failivormingut
  v2; failide vahetamiseks peab niikuinii olema repo kirjutusõigus), `el()`-i atribuudifilter (CSP ilma `'unsafe-inline'`-ita
  ei käivita `on*`-atribuute ega `javascript:` aadresse ning nimed tulevad alati koodist), SRI (`integrity`; kõik skriptid
  tulevad samast juurutusest, nii et kes saab muuta skripti, saab muuta ka räsi), HSTS päis (`.app` on brauserite
  HSTS-nimekirjas). Haldaja otsused / seaded: põhiaadress (`*.web.app` on eraldi päritolu, `*.github.io` jagab
  salvestusruumi konto teiste lehtedega), vana Git-ajaloo ümberkirjutamine, Firebase'i teenusekonto IAM-i roll, GitHubi
  keskkondade seadistus (vt „Saladused ainult harul main“) ja Firebase'i võtme asendamine Google Cloud Workload Identity
  Federationi (OIDC) lühiajaliste tokenitega (vajab GCP seadistust; `action-hosting-deploy` võtab praegu JSON-võtme).
- GitHub Pagesi leht ja avalik repo on kõigile nähtavad: lehekood on avalik, andmefailid (`hinnad.json`-i
  15-min tarbimine, `paike.json`-i võimsused) on ilma paroolita loetavad ainult siis, kui parooliga kaitse on
  välja lülitatud; varasemad commit'id on tavatekstina alles. Kõik sama konto `*.github.io` lehed jagavad brauseri
  salvestusruumi (Firebase'i `*.web.app` aadress on eraldi), seega ära vali „Jäta meelde“ jagatud seadmes. Lehe võti on
  mitte-eksporditav (IndexedDB): teine sama saidi leht saab seda selles brauseris kasutada, aga mitte välja lugeda.

## Piirangud

- Lõpphind ja kuu € on hinnangud; tegelik arve sõltub elektri- ja võrgulepingust.
- Solarmani välja `gridPower` märgikokkulepe ja päevakoguste tähendus ei ole Solarmani dokumentatsioonis
  üheselt kirjeldatud. Müüki võrku pole mõõtmistes seni esinenud ja selle tuletis on kontrollimata
  (vt „Märgid ja väljad“); esimesel müügipäeval tuleb märgikokkulepe andmetest üle kontrollida.
- Selle jaama `gridPower` näib olevat müügi (feed-in) väli: see on peaaegu alati 0 ja harva ostu ajal paar
  kümmet vatti (`wirePower` = `purchasePower` − `gridPower`), seega ei loe kumbki leht seda ostuks ega müügiks. Müük
  tuletatakse mõlemal lehel energiabilansist (ainult ostuta ja kadude varu ületava ülejäägiga); kui päike või
  maja tarbimine puudub, näitab energialeht „müüki ei mõõdeta“.
- Aku märk Solarmani andmetes (kontrollitud selle jaama failidest): `realTime.chargePower` < 0 = laeb,
  15-min kaadrites (history) `chargePower` > 0 = laeb, `batteryPower` < 0 = laeb mõlemas, `dischargePower` ≥ 0.
  Lehed arvestavad aku võimsust kujul |`chargePower`| − |`dischargePower`| (+ laeb, − tühjeneb); alla 0,2 kW
  muutumatu laetusega on aku „ootel“ (hoidevool).

## Versioon ja muudatuste ajalugu

- Praegune versioon: **v3.3.3** (`APP_VERSION` failis `js/index.js`), energialehel **v2.6.1**
  (`js/energy-dashboard.js`), graafikute lehel **v1.3.2** (`js/graafikud.js`).
- Üksikasjalik ülevaade UI/UX muudatustest, komponentide klassidest ja arhitektuurireeglitest (sh juhised Claude AI-le) asub failis [CHANGELOG.md](CHANGELOG.md).
