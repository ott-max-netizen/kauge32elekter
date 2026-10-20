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

## Seadete muutmine

Tasud, tariifid ja maja andmed on `index.html` alguses objektis `CONFIG` (iga rea
juures on selgitus). Muuda ainult numbreid ja tekste; jäta sulud, komad ja
jutumärgid alles. Muudatus jõuab lehele mõne minuti jooksul.

## Kui hinnad ei uuene

1. Ava **Actions → Uuenda elektrihinnad** ja vaata viimast käivitust.
2. Käivita töövoog käsitsi: **Run workflow**.
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

## Päikeseenergia tootmine (Solar Dashboard)

Rakendus sisaldab täielikku päikeseenergia moodulit (`CONFIG.paike`):
- **Reaalajas energiavoog (Energy Flow)**: kuvab visuaalselt energia liikumist päikesepargi (15 kWp), maja tarbimise ja elektrivõrgu vahel (omatarbimine vs võrku müük).
- **Päikese tootmiskõver graafikul**: astronoomiline mudel Tallinna koordinaatidel koos tipptundide soovitusega (nt 11:00–14:30), mil elekter on tasuta ja võrgutasusid ei lisandu.
- **Säästu ja tulukuse KPI-d**: reaalajas hetkevõimsus (kW), päeva kogutoodang (kWh), omatarbe rahaline sääst (€) ja võrku müügi tulu (€).
- **Vaadete lüliti (View Switcher)**: kiire hüppamine või filtreerimine mobiilis (*Kõik*, *⚡ Elekter*, *☀️ Päike*, *⏱️ Planeerija*, *🏢 Maja 12 k*).
- **Teemamootor**: hele ja tume režiim koos päise kiirlülitiga.

## Piirangud

- Lõpphind ja päikesetoodang on hinnangulised; tegelik arve ja tootlus sõltuvad lepingutest, arvestitest ja ilmaoludest.

## Versioon ja muudatuste ajalugu

- Praegune versioon: **v2.4.0** (määratud konstandis `APP_VERSION` failis `index.html`).
- Üksikasjalik ülevaade UI/UX muudatustest, komponentide klassidest ja arhitektuurireeglitest (sh juhised Claude AI-le) asub failis [CHANGELOG.md](CHANGELOG.md).
