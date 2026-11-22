"""Download World Bank indicators for the India lens (Stage A) into data/raw/worldbank/.

Standard library only. Run from the repo root:

    python3 -I pipeline/fetch_worldbank.py [--force]

What it saves (one JSON file per request, all countries and aggregates, years 2022 to 2025):
  countries.json        country list with region and income group (to tell countries from aggregates)
  <indicator>.json      observations for one indicator
  <indicator>_meta.json indicator definition and source organisation
  LICENCE_NOTE.txt      the licence statement read on worldbank.org, with the pages it came from
data/manifest.json records URL, size, SHA-256 and retrieval time of each file.

Indicators
  NY.GDP.PCAP.PP.KD  GDP per capita, PPP (constant 2021 international dollars)
  IT.NET.USER.ZS     Individuals using the Internet (% of population)
  SE.TER.ENRR        School enrollment, tertiary (% gross)
  SL.SRV.EMPL.ZS     Employment in services (% of total employment)
  SL.AGR.EMPL.ZS     Employment in agriculture (% of total employment)
  SP.POP.1564.TO.ZS  Population ages 15-64 (% of total population)
  SP.POP.TOTL        Population, total

Licence: the World Bank states that it licenses datasets under CC BY 4.0 by default; the
World Development Indicators catalog entry lists "Creative Commons Attribution 4.0".
Attribution to carry: "Source: World Bank, World Development Indicators (CC BY 4.0)".
Indicators that come from other organisations (for example ITU, UNESCO, ILO, UN Population
Division) are distributed through the WDI under the same listing; the source organisation
is in each <indicator>_meta.json.
"""
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "worldbank"
MANIFEST = ROOT / "data" / "manifest.json"
UA = "why-pay-anyone-lbp/0.1 (academic project; data fetch script)"
API = "https://api.worldbank.org/v2/"
YEARS = "2022:2025"
INDICATORS = [
    "NY.GDP.PCAP.PP.KD",
    "IT.NET.USER.ZS",
    "SE.TER.ENRR",
    "SL.SRV.EMPL.ZS",
    "SL.AGR.EMPL.ZS",
    "SP.POP.1564.TO.ZS",
    "SP.POP.TOTL",
]

LICENCE_NOTE = """World Bank open data licence (read on 2026-11-22)

1. https://datacatalog.worldbank.org/public-licenses
   The page says the World Bank Group licenses datasets under the Creative Commons Attribution
   4.0 International licence (CC BY 4.0), the default for datasets produced by the World Bank.
   Exceptions listed there: ODbL where a data provider requires it, the Microdata Research
   Licence for most microdata, and third-party datasets that carry their own terms.
2. https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators
   Metadata section "Data Access and Licensing": "License: Creative Commons Attribution 4.0".
3. https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
   The general terms page; it points to dataset-specific terms and asks for attribution to the
   World Bank Group.

Attribution used in this project: "Source: World Bank, World Development Indicators (CC BY 4.0)".
The indicators here are WDI series; the source organisation of each is in its _meta.json file.
"""


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=60) as resp, open(tmp, "wb") as out:
        meta = {"http_status": resp.status, "last_modified": resp.headers.get("Last-Modified"), "etag": resp.headers.get("ETag")}
        out.write(resp.read())
    # The API answers errors with HTTP 200 and a message list; check it is real JSON data first.
    payload = json.loads(tmp.read_text())
    if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
        tmp.unlink()
        raise ValueError(f"unexpected API response for {url}: {str(payload)[:200]}")
    tmp.rename(dest)
    return meta


def main():
    force = "--force" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    jobs = [("countries.json", API + "country?format=json&per_page=400")]
    for ind in INDICATORS:
        jobs.append((f"{ind}.json", f"{API}country/all/indicator/{ind}?format=json&per_page=20000&date={YEARS}"))
        jobs.append((f"{ind}_meta.json", f"{API}indicator/{ind}?format=json"))

    new_entries = {}
    failures = []
    for name, url in jobs:
        dest = RAW / name
        if dest.exists() and not force:
            print(f"skip   worldbank/{name}")
            continue
        try:
            meta = download(url, dest)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            print(f"FAILED worldbank/{name}: {e}")
            failures.append(name)
            continue
        new_entries[f"worldbank/{name}"] = {
            "url": url,
            "bytes": dest.stat().st_size,
            "sha256": sha256_of(dest),
            "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            **meta,
        }
        print(f"ok     worldbank/{name}  {dest.stat().st_size:,} bytes")
        time.sleep(0.5)

    note = RAW / "LICENCE_NOTE.txt"
    if not note.exists() or force:
        note.write_text(LICENCE_NOTE)
        new_entries["worldbank/LICENCE_NOTE.txt"] = {
            "url": "https://datacatalog.worldbank.org/public-licenses",
            "bytes": note.stat().st_size,
            "sha256": sha256_of(note),
            "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "http_status": None,
            "last_modified": None,
            "etag": None,
            "note": "written by this script from the licence pages read on 2026-11-22: CC BY 4.0 for World Bank datasets",
        }

    if new_entries:
        # Re-read the manifest just before writing: other scripts update it too.
        manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
        manifest.update(new_entries)
        MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    if failures:
        print(f"\n{len(failures)} failed: {failures}")
        sys.exit(1)


if __name__ == "__main__":
    main()
