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

CSS-i muutmisel suurenda HTML-i linkides `?v=` väärtust (GitHub Pages hoiab faile vahemälus 10 min).
| `hinnad.json`, `paike.json` | GitHub Actionsi kirjutatud andmefailid |

Lehtede vahel liigub elektriinfo lehe vaadete ribal oleva lingiga **🔋 Energia** ja energialehe päises
oleva lingiga **Elektriinfo**.

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

GitHub võib ajastatud käivitusi edasi lükata või vahele jätta. Täpsema ajastuse jaoks
võib töövoo käivitada väline ajastaja (nt cron-job.org, ajavöönd Europe/Tallinn,
kell 14:55), mis saadab päringu:

```
POST https://api.github.com/repos/ott-max-netizen/kauge32elekter/actions/workflows/uuenda-hinnad.yml/dispatches
Authorization: Bearer <fine-grained token: ainult see repo, "Actions: Read and write">
Accept: application/vnd.github+json

{"ref":"main"}
```

## Andmefail ja Elering Estfeed tarbimisandmed

`hinnad.json` uueneb **iga tunni järel** (ning tihedamalt kell 15:00 homsete börsihindade avaldamise ajal) ja sisaldab:
1. Eesti hinnapiirkonna 15-minutilisi börsihindu eilsest 00:00 kuni ülehomme 00:00 koos maja 15-minutilise tarbimisega (`kwh`), kui GitHub Actions Secrets all on seadistatud `ELERING_CLIENT_ID`, `ELERING_CLIENT_SECRET` ja `ELERING_EIC`:

```json
{"success":true,"generatedAt":"2026-10-18T12:01:07Z","source":"Elering (Nord Pool day-ahead, EE + Estfeed)",
 "data":{
   "ee":[{"timestamp":1792056600,"price":13.69,"kwh":0.412}],
   "majaElekter":[{"kuu":"2026-10","kwh":480.5,"eur":112.4,"complete":false}]
 }}
```

2. Käesoleva aasta ja eelneva aasta vastavate kuude kokkuarvutatud tarbimist (`kwh`) ja kogumaksumust (`eur` koos võrgutasude, aktsiisi ja käibemaksuga) massiivis `data.majaElekter`.

`timestamp` on perioodi algus (Unix sekundites, UTC), `price` on börsihind €/MWh ilma käibemaksuta ja `kwh` on 15-minutilise perioodi tarbimine kilovatt-tundides.

## Mõõtmiste loogika: Enefit vs Inverter

Rakendus kasutab kahte teineteist täiendavat mõõtmist:
1. **Estfeed (liitumispunkti arvesti, `hinnad.json` → `kwh`)**: **elektri ost võrgust** 15 minuti kaupa (plaat „Ostetud võrgust“, alltekst „Estfeed · kuni HH:MM · arve alus“). See on arve alus.
2. **Inverter (Solarman, `paike.json`)**: **päikesetoodang**, **maja tegelik tarbimine** (`usePower`), aku laadimine/tühjenemine ja ost võrgust (märgistatud „(inverter)“). Inverteri ost erineb Estfeedi arvestist periooditi kuni ±0,5 kWh ja päeva lõikes ~2% ning ulatub tavaliselt hilisema kellaajani; arve alus on Estfeed. Numbreid eri allikatest ei liideta, igaühel on allikas ja lõikeaeg („kuni HH:MM“).

Maja tarbimine ≠ ost võrgust + päikese omatarve, sest maja akut laetakse odava hinnaga ka võrgust
(öösel kuni ~19 kW). Seepärast võetakse maja tarbimine otse inverterist: ost + päike + aku tühjenemine −
aku laadimine − müük. Solarmani päevakogused (`data.day`) on selle jaama puhul ~10× liiga väikesed,
seetõttu arvutatakse kõik päeva kogused 15-min mõõtmistest.

## Päikeseenergia (elektriinfo lehe päikesekaart)

- Kõik päikese, maja tarbimise ja aku numbrid on **mõõtmised** failist `paike.json` (vt allpool
  „Energia töölaud“). Mudelit ega prognoosi ei kuvata: kogused on summad kuni viimase mõõtmiseni ja
  graafikul on päike ainult mõõdetud perioodides (kWh 15 min kohta, parem telg): täna kuni viimase
  mõõtmiseni ja „Eile“ vaates, kui `paike.json` sisaldab eilseid kaadreid.
- Kaardi märgil on mõõtmise kellaaeg ja vanus („Mõõdetud 14:59 · 23 min tagasi“). Kui viimane mõõtmine on
  vanem kui `CONFIG.paike.aegunudMinutites` (45 min, sama lävi kehtib energialehel), hetkeseisu ei kuvata
  ja päise olekumärk on kollane („OSA ANDMEID VANANENUD“). Pärast keskööd, kuni esimese tänase mõõtmiseni,
  on kaardil teade „Uus päev algas …“ (eilne värske mõõtmine ei ole vananenud).
- Päise olekumärgi vihjes ja jaluses on andmefailide seis (mis ajani on börsihinnad, Estfeedi ost ja
  inverteri kaadrid) ning töövoogude hoiatused failide `meta`-plokist; vana fail ilma `meta`-ta töötab nagu enne.
- „Päikesest kaetud“ = ise kasutatud päikeseenergia (toodang − müük) / maja tarbimine; sama mõõdik on
  energialehel. Aku laadimine (võrgust/päikesest) on voosõlmedes („sellest akusse“) ja selgitavas lauses.
- Pargi võimsus (kWp) tuleb `paike.json`-i väljast `installedCapacityKw` (töövoog pärib selle Solarmanist
  kord päevas); `CONFIG.paike.paneelideKw` on varuväärtus. `paneelideArv` ja `kasutuselAlates` on ainult sildil.
- **Vaadete lüliti** (*Kõik*, *⚡ Elekter*, *☀️ Päike*, *⏱️ Planeerija*, *🏢 Maja 12 k*) ja link
  energialehele, **teemamootor** (hele/tume) päises.

## Hinnad ja tariifid

- Lõpphind = (börsihind + marginaal + võrgutasu + taastuvenergia- ja varustuskindluse tasu + aktsiis)
  × (1 + KM). Öötariif kehtib tööpäeviti 22–07 ning laupäeval, pühapäeval ja **riigipühadel** kogu
  ööpäeva (`CONFIG.ootariif.riigipuhadOnOo`, Elektrilevi hinnakiri).
- „Leia odavaim aeg“, elektriauto laadimine ja soovitused valivad akna **hinna koos tasudega**
  järgi (öine võrgutasu on odavam), näidatakse ka börsihinda.
- Kuu € (`majaElekter`) on hinnang: 15-min ost × börsihind + praegused tasud (enne 01.07.2025 KM 22%).
  Fikseeritud kuutasud lisanduvad ainult siis, kui need on `CONFIG.hinnad.kuutasu`-s. Kui arve on
  järjepidevalt suurem, lisa kuutasu.

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
- Seejärel käivita **Actions → Uuenda päikeseandmed → Run workflow**. Töövoog
  käivitub edaspidi iga 10 minuti järel ja teeb commit'i ainult siis, kui andmed muutusid.
  10 minutit tuleneb GitHub Pagesi pehmest piirangust (10 avaldamist tunnis koos
  `hinnad.json`-iga); leht ise kontrollib faili iga 5 minuti järel.
- `paike.json` sisaldab ainult võimsusi ja energiakoguseid (ilma jaama asukoha ja
  võtmeteta). GitHub Pagesi leht on avalik, seega on avalikud ka need andmed.
- Tariifid, hinnapiirid ja hinnasildid loeb töölaud `index.html`-i `CONFIG`-ist, nii et
  neid tuleb muuta ainult ühes kohas.
- Kui aku või võrgu suund kuvatakse valepidi, määra `energy-dashboard.html` `CONFIG`-is
  `solarman.akuMark` / `solarman.vorguMark` käsitsi (vaikimisi tuvastatakse
  energiabilansist automaatselt). Aku mahtu (`aku.mahtKwh`) on vaja laadimis- ja
  tühjenemisaja hinnanguks.

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
  üheselt kirjeldatud; müük võrku tuletatakse energiabilansist.
- Aku märk Solarmani andmetes (kontrollitud selle jaama failidest): `realTime.chargePower` < 0 = laeb,
  15-min kaadrites (history) `chargePower` > 0 = laeb, `batteryPower` < 0 = laeb mõlemas, `dischargePower` ≥ 0.
  Lehed arvestavad aku võimsust kujul |`chargePower`| − |`dischargePower`| (+ laeb, − tühjeneb); alla 0,2 kW
  muutumatu laetusega on aku „ootel“ (hoidevool).

## Versioon ja muudatuste ajalugu

- Praegune versioon: **v2.4.2** (`APP_VERSION` failis `index.html`), energialehel **v1.1.1**
  (`APP_VERSION` failis `energy-dashboard.html`).
- Üksikasjalik ülevaade UI/UX muudatustest, komponentide klassidest ja arhitektuurireeglitest (sh juhised Claude AI-le) asub failis [CHANGELOG.md](CHANGELOG.md).
