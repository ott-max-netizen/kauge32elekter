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

## Andmefail

`hinnad.json` sisaldab Eesti hinnapiirkonna hindu eilsest 00:00 kuni ülehomme 00:00:

```json
{"success":true,"generatedAt":"2026-10-18T12:01:07Z","source":"Elering (Nord Pool day-ahead, EE)",
 "data":{"ee":[{"timestamp":1792056600,"price":13.69}]}}
```

`timestamp` on perioodi algus (Unix sekundites, UTC) ja `price` on hind €/MWh ilma
käibemaksuta.

## Piirangud

- Lõpphind on hinnang; tegelik arve sõltub elektri- ja võrgulepingust.
