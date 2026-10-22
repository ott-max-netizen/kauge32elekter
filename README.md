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
| `index.html` | **Elektriinfo**: börsihind, odavaim aeg, päikesekaart, maja lõpphind ja üldelekter (HTML ja JS; kujundus failis `css/index.css`) |
| `energy-dashboard.html` | **Energia**: päikesepark, akupank, energiavoog ja soovitus |
| `css/index.css` | elektriinfo lehe kujundus (teemamootor, hele/tume) |
| `css/common.css`, `css/energy-dashboard.css` | energialehe kujundus |
| `hinnad.json`, `paike.json` | GitHub Actionsi kirjutatud andmefailid |

CSS-i muutmisel suurenda HTML-i linkides `?v=` väärtust (GitHub Pages hoiab faile vahemälus 10 min).

Mõlema lehe päises on sama lehtede navigatsioon **Elektriinfo** / **Energia** (aktiivne leht on esile
tõstetud); elektriinfo lehe päikesekaardil on lisaks link energialehele.

## Seadete muutmine

Tasud, tariifid ja maja andmed on `index.html` alguses objektis `CONFIG` (iga rea
juures on selgitus). Muuda ainult numbreid ja tekste; jäta sulud, komad ja
jutumärgid alles. Muudatus jõuab lehele mõne minuti jooksul.

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

2. Käesoleva aasta ja eelneva aasta vastavate kuude kokkuarvutatud tarbimist (`kwh`) ja kogumaksumust (`eur` koos võrgutasude, aktsiisi ja käibemaksuga) massiivis `data.majaElekter`.

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
  KM ja tasude ajalugu, CONFIG-i tasud), `updatedAt` = millal kirje sisu viimati muutus. Lõplik kuu
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
  Solarmani vastus ei kustuta päeva varasemaid kaadreid.
- `frameSeconds` = kaadri pikkus sekundites (900); lehed loevad selle (vaikimisi 900).
- `meta.framesUntil` = viimase kaadri lõpp (Unix s), kuid mitte hilisem kui viimane mõõtmine `lastUpdateTime`
  (viimane kaader on enamasti pooleli); `meta.warnings` = töövoo hoiatused.
- Solarmani päevakoguseid (`data.day`) enam ei kirjutata: selle jaama puhul on need ~10× liiga
  väikesed; kõik päeva kogused arvutatakse 15-min kaadritest.

## Mõõtmiste loogika: Estfeed vs inverter

Rakendus kasutab kahte teineteist täiendavat mõõtmist:
1. **Estfeed (Eleringi andmeladu, liitumispunkti arvesti, `hinnad.json` → `kwh`)**: **elektri ost võrgust** 15 minuti kaupa („ost võrgust (Estfeed)“; plaat „Ostetud võrgust“, alltekst „Estfeed · kuni HH:MM · arve alus“). See on arve alus.
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
  koos allika ja lõikeajaga („Akut laeti täna (inverter, kuni 14:59) 31,8 kWh …“); „Maja tarbis täna“ plaadil
  „ost võrgust 126,5 kWh (inverter), sellest akusse 31,2 · kuni 14:59“, väärtusplaadil „täna kuni 14:59 ·
  hinnang …“. Aku suund on |`chargePower`| − |`dischargePower`|, nende puudumisel `batteryPower`-ist (< 0 = laeb).
  Kõige kitsamal telefonil (≤ 380 px) on voosõlmede kiri väiksem ja „Päikese-park“ poolitub; kahe veeru
  paigutuses (768–1023 px) on sõlmedes telefoni lühikesed sildid ja 768–1179 px ning printimisel on neli
  plaati kahes veerus.
- Pargi võimsus (kWp) tuleb `paike.json`-i väljast `installedCapacityKw` (töövoog pärib selle Solarmanist
  kord päevas); `CONFIG.paike.paneelideKw` on varuväärtus. `paneelideArv` ja `kasutuselAlates` on ainult sildil.
- **Vaadete lüliti** (*Kõik vaated*, *Elekter*, *Päike*, *Planeerija & EV*, *Maja üldelekter*; SVG-ikoonidega)
  ja **teemamootor** (hele/tume) päises.

## Hinnagraafik (elektriinfo leht)

- Tulbad on börsihind (s/kWh koos KM-ga, vasak telg), värv = hinnaklass; möödunud perioodid on tuhmimad
  (legendis „tuhmim = möödunud“; heledas teemas heledamad, tumedas tumedamad; „Eile“ vaates kõik tulbad, kui
  graafikul on eilne päikesejoon, et tume joon ei sulanduks tulpadega).
  Arvutis on vaikimisi 15 min samm, telefonis (< 768 px) 1 h; lüliti „1 h / 15 min“ valik jääb kehtima.
- Ost võrgust (Estfeed) ja päikesetoodang (inverter) on perioodi energia (kWh 15 min või 1 h kohta, parem
  telg). kWh-telje null on hinna nulljoonel ja kWh-skaala kasutab poolt hinnaala kõrgusest, et öine ostutipp
  (aku laadimine võrgust) ei paistaks hinnatipuna. Puuduv periood katkestab joone; pooleli olevat ja ainult
  osaliselt mõõdetud perioodi (viimane kaader kuni inverteri mõõtmiseni) joonele ei kanta (tooltipis „pooleli,
  kuni HH:MM“ või „mõõdetud kuni HH:MM“). Kui Estfeed andis ainult tunnise koguse (`kwhRes: "hour"`), on see
  15-min vaates katkendjoon (legendis „katkendjoon = tunni keskmine“). Tooltipis on ka keskmine võimsus (kW) ja
  aku laadimine koos allikaga (võrgust/päikesest; allikas omistatud energia järgi, alla 0,05 kWh osa ei nimetata).
- Kui ost (Estfeed) või inverteri kaadrid lõpevad enne päeva lõppu, on joone lõpus rõngas ja silt „kuni HH:MM“
  (perioodi lõpp; allikad jõuavad eri viitega, nt Estfeed kuni 14:15 ja inverter kuni 14:45).
- Tooltip on tulba kõrval (nagu energialehel): aeg, börsihind ja hinnaklass, hind koos tasudega, kogused
  värvivõtmega (ost võrgust (Estfeed) koos maksumusega, päike ja maja (inverter), aku laadimine) ning võrdlus
  päeva keskmisega. Puutel ja kitsal ekraanil (< 768 px, ka klaviatuuri ja hiirega) tooltipi ei kuvata – see
  kataks suurema osa graafikust: info on graafiku kohal fikseeritud kõrgusega inspektoris, nii et graafik ei
  nihku sõrme all. Telefonis ja puuteekraaniga tahvlis (`pointer: coarse`) on inspektor kaherealine paneel päeva
  sildi peal, hiirega laial ekraanil üks rida päeva sildi kõrval. Ekraanilugeja teade (`#chart-announcer`) tuleb
  ainult klaviatuuriga liikudes. Energialehel käitub inspektor puutel samamoodi.
- Puuduvat hinnaperioodi ei täideta eelmise hinnaga: graafikul jääb tühi koht, praeguse hetke puudumisel
  ütleb hinnakaart, et praeguse hetke hinnaperiood puudub, ja osaliste homsete hindade korral on teade „Homsed börsihinnad on osalised (puudub …)“ ning vaheleht „Homme (osaline)“.
- Graafiku all on valitud päeva kokkuvõte kahes rühmas: „Hind, s/kWh“ (madalaim, keskmine, kõrgeim, võrdlus;
  tunnivaates märkega „15 min“, sest need on päeva tegelikud veerandtunni hinnad) ja „Ost võrgust sel päeval“
  (Estfeed: kogus allika ja lõikeajaga, kulu koos tasudega „≈“, sellest börsihind koos KM-ga). Inverteri kogused on
  päikesekaardil. Kuu ost ja aasta tagune võrdlus on omaette rühmas „Käesolev kuu · ost võrgust“. Eile-vaates
  on päevade võrdlus neutraalse värviga lausena („eile oli … kallim kui täna“).
- Sinine kast (valiku aktsent, mitte hinnaklassi roheline) on planeerijas valitud kestusega odavaim aken
  (lõpphinna järgi koos võrgutasuga), sildiga „odavaim 2 h · 04:15–06:15“. Hinnakaardi faktides on alati
  järgmise 24 h odavaim 2 h aken („Odavaim 2 h aken: Homme 04:15–06:15 (koos tasudega 7,34 s/kWh)“). Päeva keskmise silt pannakse vabale küljele; kui see kataks tulpi või kWh-joont,
  on väärtus legendis.
- Kellakeeramise päeval on päeva sildi juures märkus; sügisel on korduva tunni ajad märgitud „(suveaeg)“ /
  „(talveaeg)“ ning laial graafikul on x-teljel „03“ ja „03*“.

## Kujundus ja värvid (mõlemad lehed)

- **Tokenid:** värvid on CSS-i custom property'd. Ühised tokenid (pinnad, tekst, hinnaklassid, `--solar`,
  `--home`, `--grid`, `--solar-line`, `--avg-line`) on **samade väärtustega** failides `css/index.css` ja
  `css/common.css` – värvi muutmisel muuda mõlemas. Hele komplekt on `:root`-is; tume elektriinfo lehel
  `:root[data-theme="dark"]` all (leht seab `data-theme` alati, ka „auto“ korral süsteemi järgi, juba
  `<head>`-is), energialehel `@media (prefers-color-scheme: dark)` all. Tume komplekt kehtib ainult ekraanil:
  **prinditakse alati heledana**, juhtelemendid (nupud, vaadete riba, navigatsioon) on printimisel peidetud.
- **Värvi tähendus:** tulba värv = hinnaklass (heledas tumeneb toon hinnaga, tumedas kasvab kontrast hinnaga;
  kollane ja oranž eristuvad ka värvipimedale heleduse järgi, lävedel 10 ja 20 s/kWh on siltideta punktiirjoon).
  Roheline on „Väga odav“, olek „andmed ajakohased“ ja soodne muutus (võrdlusplaatide vahe, nt „Võrdlus
  eilsega −3,43“, ja planeerija sääst „43% odavam …“). Päike = kuldne (`--solar`), mõõdetud
  päikesetoodangu **joon** graafikutel tumepruun/kreem (`--solar-line`, et see ei sarnaneks kollase/oranži
  tulbaga); maja = sinine (`--home`); võrk ja ost võrgust (ka maja üldelektri tulbad) = terashall (`--grid`);
  aku = roheline (energialeht); valik (odavaim aken, planeerija plaan, „Homme“ täpp) = sinine aktsent (`--focus`).
- **Märgid:** tulbad on ainsad täisvärvis pinnad (möödunud perioodid 0,6 läbipaistvusega); jooned 2,5 px
  pinnavärvi haloga; päeva keskmine punktiir sama kriipsutusega haloga; alad hõredad (ostu ala 0,06,
  päikese ala elektriinfo hinnagraafikul pole). Legendis ja tooltipis on joonte võti sama `.line-key`.
- **Täpsus:** kW ja kWh ühe komakohaga mõlemal lehel, € kahe komakohaga; € hinnangud on „≈“-ga.
- **Piktogrammid:** üks süsteem – 24×24 stroke-SVG, värv pärib teksti värvi (`currentColor`), alati
  `aria-hidden`, tähendus on kõrval tekstina. Elektriinfo lehel on sprite (`<symbol id="i-…">`) lehe alguses,
  energialehe energiavoo ikoonid (`flowIcon`) on samade kujunditega. Välk = elekter/hind, mast = elektrivõrk,
  päike/kuu = päikesepark, maja = maja, kell = planeerija. Emojisid ei kasutata.
- **Ligipääsetavus:** puuteekraanil on vaadete pillid, lehtede navigatsioon, vahelehed ja lülitid vähemalt
  44 px kõrged; `prefers-reduced-motion` peatab ka olekutäpi pulsi, energiavoo nooled ja spinneri.

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
  0,145 s/kWh enne 01.05.2025; allikad on kommentaarides). Võrgutasu kWh-hinnad ja marginaal on kõigil
  kuudel CONFIG-i omad (Elektrilevi kWh-hinnad 2025–2026 hinnakirjamuudatustega ei muutunud).
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
  +0,1 kW“), mitte „Laeb“. Aku mahtu (`aku.mahtKwh`)
  on vaja laadimis- ja tühjenemisaja hinnanguks.
- Päikeseandmete aegumislävi (45 min) loetakse `index.html`-i `CONFIG.paike.aegunudMinutites`-ist, nii et
  mõlemal lehel kehtib sama lävi. Vanema mõõtmise korral on energiavoog tuhm, liikumatu ja pealkirjas on
  mõõtmise kellaaeg („Energiavoog kell 14:59“). Kui `index.html`-i ei õnnestu lugeda, kasutatakse
  energialehe varukoopiat ja bänneris on vastav teade; erinevus `hinnad.json`-i `meta.tariffs`-iga kuvatakse samuti.
- Tänased kogused on inverteri 15-min mõõtmiste summad kuni viimase mõõtmiseni („Täna kuni 14:59
  (inverter)“; pooleli kaader ainult `lastUpdateTime`-ni); arve alus (ost võrgust Estfeedi arvestist) on elektriinfo lehel. „Päikesest kaetud“ on sama
  mõõdik mis elektriinfo lehel. Päeva graafikul on lisaks päikesele ja maja tarbimisele ost võrgust
  (katkendjoon) ja aku võimsus (+ laeb / − tühjeneb) ning odavaim 2 h aken (lõpphinna järgi).

**Otseühendus (valikuline):** jaluse lingi „Solarmani otseühendus“ kaudu saab ühes
seadmes pärida andmed brauserist otse Solarmani API-st. Võtmed ja token salvestatakse
vaikimisi `sessionStorage`-isse (kustuvad vahelehe sulgemisel); valikuga „Jäta meelde selles
seadmes“ `localStorage`-isse. Parool salvestatakse SHA-256 räsina, kuid Solarmani jaoks on räsi
parooliga samaväärne. Solarmani API ei luba enamasti brauserist otse pärida (CORS), seega on
vaja enda hallatavat CORS-proksit (`https://` või `http://localhost`), mille lõppu lisatakse API
aadress URL-kodeeritult. Kasuta seda ainult isiklikus seadmes; avalikul lehel jäävad võtmed
GitHub Secretsisse.

„Värskenda“ nupp on pärast iga värskendust 30 s keelatud (nupul on loendur), et liiga tihe
vajutamine ei koormaks Solarmani API-t ega GitHub Pagesi; elektriinfo lehe „Proovi uuesti“
ootab 15 s.

## Turvalisus

- API võtmed (Elering, Solarman) on ainult GitHub Actions Secretsis; töövood annavad secret'id
  edasi keskkonnamuutujatena ja kirjutavad andmefailidesse ainult mõõteväärtused.
- Lehed lisavad sisu ainult `textContent`/`createElement` kaudu (mitte `innerHTML`) ning
  `Content-Security-Policy` meta-silt lubab skripte ja stiile ainult samalt saidilt ning väliseid
  päringuid ainult HTTPS-iga. Uue välise teenuse lisamisel uuenda CSP-d.
- GitHub Pagesi leht ja avalik repo on kõigile nähtavad: ka `hinnad.json`-i 15-min tarbimine ja
  `paike.json`-i võimsused. Kõik sama konto `*.github.io` lehed jagavad brauseri salvestusruumi,
  seega ära salvesta otseühenduse võtmeid jagatud seadmes.

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

- Praegune versioon: **v2.5.0** (`APP_VERSION` failis `index.html`), energialehel **v1.2.0**
  (`APP_VERSION` failis `energy-dashboard.html`).
- Üksikasjalik ülevaade UI/UX muudatustest, komponentide klassidest ja arhitektuurireeglitest (sh juhised Claude AI-le) asub failis [CHANGELOG.md](CHANGELOG.md).
