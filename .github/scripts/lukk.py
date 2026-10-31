#!/usr/bin/env python3
"""Andmefailide parooliga kaitse GitHub Pagesi lehel (vt README „Parooliga kaitse“).

GitHub Pages ei oska parooli küsida ja repo on avalik, seega on ainus päriselt turvaline kaitse
krypteerimine: töövood kirjutavad hinnad.json, paike.json ja paevad.json repo'sse krüpteeritult ning
brauser (js/lukk.js) dekrypteerib need pärast parooli sisestamist. Parool on ainult GitHub Secretsis
(LEHE_PAROOL) ja elanike peas; serverisse ega repo'sse seda ei jõua.

Krüptograafia (sama nii siin kui js/lukk.js-is):
  võti      = PBKDF2-HMAC-SHA256(parool NFC-kujul UTF-8, sool 16 B, 600 000 iteratsiooni) → 32 B
  fail      = AES-256-GCM(võti, juhuslik 12 B nonss, tavatekst) → ümbrik
  ümbrik    {"lukk":1,"kdf":"PBKDF2-SHA256","iter":600000,"salt":b64,"iv":b64,"ct":b64}
  lukk.json {"lukk":1,"kdf":...,"iter":...,"salt":b64,"kontroll":{"iv":b64,"ct":b64}}
             kontroll = AES-GCM(võti, "kauge32-lukk"): brauser kontrollib sellega parooli enne andmete laadimist.
  Sool on kõigil failidel sama (lukk.json-i oma), et brauser tuletaks võtme ühe korra.

Käsud (töövoo sammud; keskkonnamuutujad LEHE_PAROOL ja valikuline LEHE_PAROOL_VANA):
  ava FAIL...      Dekrypteerib loetletud failid kohapeal (töövoo skript töötab tavatekstiga) ja jätab
                   algsed baidid kõrvale ($LUKK_STASH, vaikimisi $RUNNER_TEMP/kauge32-lukk).
  lukusta FAIL...  Krüpteerib loetletud (selle töövoo kirjutatud) failid; muud `ava`-ga avatud failid
                   taastatakse algsel kujul, et git'i töökataloog jääks puhtaks. Muutumata fail taastatakse
                   baidi täpsusega (uus nonss annaks iga kord uue sisu ja seega asjatu commit'i).
                   Hoiab korras lukk.json-i: loob puuduva, uuendab kontrollväärtuse parooli vahetusel ja
                   kustutab selle, kui LEHE_PAROOL on eemaldatud (kaitse mahavõtmine).

Parooli vahetus: LEHE_PAROOL = uus, LEHE_PAROOL_VANA = vana → käivita mõlemad töövood → kustuta
LEHE_PAROOL_VANA. Kaitse mahavõtmine: kustuta LEHE_PAROOL, pane vana parool LEHE_PAROOL_VANA alla,
käivita mõlemad töövood (failid salvestatakse tavatekstina, lukk.json kustub), kustuta LEHE_PAROOL_VANA.
"""
import base64
import hashlib
import json
import os
import secrets
import sys
import unicodedata

VERSIOON = 1
KDF = "PBKDF2-SHA256"
ITER = 600_000          # OWASP (2023) soovitus PBKDF2-HMAC-SHA256 jaoks
SOOL_B = 16
NONSS_B = 12
LUKK_FAIL = "lukk.json"
KONTROLL = b"kauge32-lukk"
SEIS = "seis.json"      # kõrvalepandud failide manifest stash-kataloogis


def viga(msg):
    print(f"::error::{msg}")
    sys.exit(1)


def parool(nimi):
    """Secret ilma äärte tühikuteta ja NFC-kujul (nagu brauseris), None kui puudub."""
    p = os.environ.get(nimi, "")
    p = unicodedata.normalize("NFC", p.strip())
    return p or None


def stash_dir():
    base = os.environ.get("LUKK_STASH") or os.path.join(os.environ.get("RUNNER_TEMP") or "/tmp", "kauge32-lukk")
    os.makedirs(base, exist_ok=True)
    return base


def aesgcm():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        viga("Python'i pakett 'cryptography' puudub (paigalda: python3 -m pip install cryptography)")
    return AESGCM


def b64e(b):
    return base64.b64encode(b).decode("ascii")


def b64d(s):
    return base64.b64decode(s, validate=True)


def tuleta_voti(pw, sool, iteratsioone):
    return hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), sool, iteratsioone, dklen=32)


def on_umbrik(obj):
    return isinstance(obj, dict) and obj.get("lukk") == VERSIOON and isinstance(obj.get("ct"), str) and isinstance(obj.get("iv"), str)


def loe_json(path):
    with open(path, "rb") as f:
        raw = f.read()
    try:
        return raw, json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return raw, None


def krypteeri(voti, tavatekst):
    nonss = secrets.token_bytes(NONSS_B)
    return nonss, aesgcm()(voti).encrypt(nonss, tavatekst, None)


def dekrypteeri(voti, nonss, ct):
    """Tavatekst või None, kui võti ei sobi (GCM autentimine ebaõnnestus)."""
    try:
        return aesgcm()(voti).decrypt(nonss, ct, None)
    except Exception:
        return None


class Votmed:
    """Võtmete vahemälu: sama (parool, sool, iter) tuletatakse ainult üks kord (PBKDF2 on tahtlikult aeglane)."""

    def __init__(self):
        self.cache = {}

    def voti(self, pw, sool, iteratsioone):
        k = (pw, sool, iteratsioone)
        if k not in self.cache:
            self.cache[k] = tuleta_voti(pw, sool, iteratsioone)
        return self.cache[k]


def ava_umbrik(votmed, umbrik, paroolid):
    """Proovib ümbrikku avada antud paroolidega. Tagastab (tavatekst, parool) või (None, None)."""
    try:
        sool, nonss, ct = b64d(umbrik["salt"]), b64d(umbrik["iv"]), b64d(umbrik["ct"])
        iteratsioone = int(umbrik.get("iter", ITER))
    except (KeyError, ValueError, TypeError):
        return None, None
    if umbrik.get("kdf", KDF) != KDF or iteratsioone < 1000:
        return None, None
    for pw in paroolid:
        if not pw:
            continue
        tavatekst = dekrypteeri(votmed.voti(pw, sool, iteratsioone), nonss, ct)
        if tavatekst is not None:
            return tavatekst, pw
    return None, None


def loe_lukk(votmed, pw):
    """Kehtiv lukk.json praeguse parooliga või None (puudub, vigane või teise parooliga)."""
    if not os.path.exists(LUKK_FAIL):
        return None
    _, obj = loe_json(LUKK_FAIL)
    if not isinstance(obj, dict) or obj.get("lukk") != VERSIOON or obj.get("kdf") != KDF:
        return None
    try:
        sool = b64d(obj["salt"])
        iteratsioone = int(obj["iter"])
        kontroll = obj["kontroll"]
        nonss, ct = b64d(kontroll["iv"]), b64d(kontroll["ct"])
    except (KeyError, ValueError, TypeError):
        return None
    if len(sool) < SOOL_B or iteratsioone != ITER or not pw:
        return None
    if dekrypteeri(votmed.voti(pw, sool, iteratsioone), nonss, ct) != KONTROLL:
        return None
    return {"salt": sool, "iter": iteratsioone}


def kirjuta_lukk(votmed, pw, sool):
    voti = votmed.voti(pw, sool, ITER)
    nonss, ct = krypteeri(voti, KONTROLL)
    obj = {"lukk": VERSIOON, "kdf": KDF, "iter": ITER, "salt": b64e(sool), "kontroll": {"iv": b64e(nonss), "ct": b64e(ct)}}
    with open(LUKK_FAIL, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
        f.write("\n")


def kirjuta_umbrik(votmed, pw, sool, path, tavatekst):
    voti = votmed.voti(pw, sool, ITER)
    nonss, ct = krypteeri(voti, tavatekst)
    obj = {"lukk": VERSIOON, "kdf": KDF, "iter": ITER, "salt": b64e(sool), "iv": b64e(nonss), "ct": b64e(ct)}
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, path)


def sha(b):
    return hashlib.sha256(b).hexdigest()


def cmd_ava(failid):
    pw, vana = parool("LEHE_PAROOL"), parool("LEHE_PAROOL_VANA")
    votmed = Votmed()
    stash = stash_dir()
    seis = {}
    for path in failid:
        if not os.path.isfile(path):
            continue
        raw, obj = loe_json(path)
        kirje = {"kruptitud": False, "sha": sha(raw)}
        if on_umbrik(obj):
            if not pw and not vana:
                viga(f"{path} on krüpteeritud, kuid secret LEHE_PAROOL puudub. Lisa parool Settings → Secrets → Actions alla "
                     f"(kaitse mahavõtmiseks pane vana parool LEHE_PAROOL_VANA alla, vt README „Parooliga kaitse“).")
            tavatekst, kasutatud = ava_umbrik(votmed, obj, (pw, vana))
            if tavatekst is None:
                viga(f"{path} ei avane ei LEHE_PAROOL-i ega LEHE_PAROOL_VANA-ga: parool on vale või fail on rikutud.")
            with open(path, "wb") as f:
                f.write(tavatekst)
            kirje = {"kruptitud": True, "sha": sha(tavatekst), "praegune": kasutatud == pw,
                     "salt": obj["salt"], "iter": int(obj.get("iter", ITER))}
            print(f"{path}: avatud ({'praeguse' if kirje['praegune'] else 'VANA'} parooliga), {len(tavatekst)} B")
        else:
            print(f"{path}: tavatekst" + (" (krüpteeritakse lukustamisel)" if pw else ""))
        with open(os.path.join(stash, os.path.basename(path) + ".orig"), "wb") as f:
            f.write(raw)
        seis[path] = kirje
    with open(os.path.join(stash, SEIS), "w", encoding="utf-8") as f:
        json.dump(seis, f)
    if not pw:
        print("LEHE_PAROOL puudub: leht avaldatakse ilma paroolita" + (" (kaitse võetakse maha)" if vana else "") + ".")


def taasta(stash, path):
    orig = os.path.join(stash, os.path.basename(path) + ".orig")
    if os.path.exists(orig):
        with open(orig, "rb") as f:
            raw = f.read()
        with open(path, "wb") as f:
            f.write(raw)
        return True
    return False


def cmd_lukusta(omad):
    pw = parool("LEHE_PAROOL")
    votmed = Votmed()
    stash = stash_dir()
    try:
        with open(os.path.join(stash, SEIS), encoding="utf-8") as f:
            seis = json.load(f)
    except (OSError, ValueError):
        seis = {}

    # Teiste töövoogude failid (ainult loetud): tagasi algsele kujule, et git'i töökataloog oleks puhas
    for path in seis:
        if path not in omad and os.path.isfile(path) and taasta(stash, path):
            print(f"{path}: taastatud algsel kujul (seda faili kirjutab teine töövoog)")

    if not pw:
        if os.path.exists(LUKK_FAIL):
            os.remove(LUKK_FAIL)
            print(f"::warning::LEHE_PAROOL puudub: {LUKK_FAIL} kustutatud, andmefailid avaldatakse tavatekstina (kaitse võetud maha).")
        return

    lukk = loe_lukk(votmed, pw)
    if lukk:
        sool = lukk["salt"]
    else:
        # Sool jääb samaks, kui lukk.json on olemas (ainult parool vahetus); muidu uus juhuslik sool
        sool = None
        if os.path.exists(LUKK_FAIL):
            _, vana_obj = loe_json(LUKK_FAIL)
            try:
                kandidaat = b64d(vana_obj["salt"])
                if len(kandidaat) >= SOOL_B:
                    sool = kandidaat
            except (KeyError, ValueError, TypeError, AttributeError):
                sool = None
        if sool is None:
            sool = secrets.token_bytes(SOOL_B)
        oli = os.path.exists(LUKK_FAIL)
        kirjuta_lukk(votmed, pw, sool)
        print(f"{LUKK_FAIL}: {'uuendatud (parool vahetus)' if oli else 'loodud'}")
    sool_b64 = b64e(sool)

    for path in omad:
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            tavatekst = f.read()
        kirje = seis.get(path)
        muutumata = (kirje and kirje.get("kruptitud") and kirje.get("praegune") and kirje.get("sha") == sha(tavatekst)
                     and kirje.get("salt") == sool_b64 and kirje.get("iter") == ITER)
        if muutumata and taasta(stash, path):
            print(f"{path}: andmed ei muutunud, krüpteeritud fail jäi samaks")
            continue
        try:
            json.loads(tavatekst.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            viga(f"{path} ei ole kehtiv JSON, krypteerimine katkestatud")
        kirjuta_umbrik(votmed, pw, sool, path, tavatekst)
        print(f"{path}: krüpteeritud ({len(tavatekst)} B tavateksti)")


def main(argv):
    if len(argv) < 2 or argv[1] not in ("ava", "lukusta"):
        print(__doc__)
        return 2
    failid = argv[2:]
    if argv[1] == "ava":
        cmd_ava(failid)
    else:
        cmd_lukusta(failid)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
