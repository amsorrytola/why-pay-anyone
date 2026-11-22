"""Download the macro and labour-share sources for module M6 into data/raw/<source>/ and record the manifest.

Standard library only. Run from the repo root:

    python3 -I pipeline/fetch_pwt.py            # everything below
    python3 -I pipeline/fetch_pwt.py --force    # re-download existing files

Sources (no API keys needed):
  pwt/                 Penn World Table 11.0 (Groningen Growth and Development Centre, University of Groningen),
                       CC BY 4.0 (licence recorded in the DataverseNL record, doi 10.34894/FABVLR). Main Excel file
                       plus the user guide and the "what is new" note (PDFs are kept as documentation only).
  ilo_labour_share/    ILOSTAT, "Labour income share as a percent of GDP, ILO modelled estimates, Nov. 2025"
                       (SDMX CSV for the USA, India, China and the ILO world and income-group aggregates). ILO datasets
                       are under CC BY 4.0 since 3 May 2023 (https://www.ilo.org/node/9321).
  fred_macro/          A few FRED series (CSV download, no key): US nonfarm business labor share (BLS), compensation
                       share of gross domestic income (BEA), personal saving rate (BEA), shares of net worth held by
                       the top 1% and top 0.1% and shares of corporate equities and mutual fund shares held by the
                       top 1% and the 90th to 99th percentiles (Federal Reserve Distributional Financial Accounts),
                       10-year TIPS yield.
                       BLS, BEA and Federal Reserve data are US government statistics.
  worldbank_macro/     World Bank WDI indicators for the USA, India, China and the world (savings and investment
                       shares, GDP growth, consumption shares, tax revenue, population, labour force, real interest
                       rate). One JSON per indicator. World Bank WDI is CC BY 4.0. A different agent fetches other
                       World Bank indicators into worldbank/, so this script keeps its own folder.

Each file goes in its own source folder. data/manifest.json records the URL, size, SHA-256 and retrieval time of every
file. The manifest is shared with other scripts, so it is re-read just before every write and replaced atomically.
Downloaded files are treated as data: they are parsed by build_m6.py, never executed.
"""
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifest.json"
UA = "why-pay-anyone-lbp/0.1 (academic project; data fetch script)"

DATAVERSE = "https://dataverse.nl/api/access/datafile/"
ILO = ("https://sdmx.ilo.org/rest/data/ILO,DF_LAP_2GDP_NOC_RT/USA+IND+CHN+X01+X02+X03+X04+X05..?"
       "format=csvfilewithlabels&startPeriod=1990")
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id="
WB = "https://api.worldbank.org/v2/country/USA;IND;CHN;WLD/indicator/"

# (source folder, url, file name, sanity check: first bytes the file must start with)
FILES = [
    ("pwt", DATAVERSE + "554105", "pwt110.xlsx", b"PK"),
    ("pwt", DATAVERSE + "554025", "pwt110_user_guide_to_data_files.pdf", b"%PDF"),
    ("pwt", DATAVERSE + "554031", "pwt110_whatsnew.pdf", b"%PDF"),
    ("ilo_labour_share", ILO, "ilo_labour_income_share_gdp.csv", b"STRUCTURE"),
]
for sid in ["PRS85006173", "A4002E1A156NBEA", "PSAVERT", "WFRBST01134", "WFRBSTP1300", "WFRBST01122", "WFRBSN09149", "DFII10"]:
    FILES.append(("fred_macro", FRED + sid, sid + ".csv", b"observation_date"))
WB_INDICATORS = [
    "NY.GDP.MKTP.KD.ZG",   # GDP growth, annual %
    "NY.GDP.PCAP.KD.ZG",   # GDP per capita growth, annual %
    "NY.GDS.TOTL.ZS",      # gross domestic savings, % of GDP
    "NY.GNS.ICTR.ZS",      # gross savings, % of GDP
    "NE.GDI.TOTL.ZS",      # gross capital formation, % of GDP
    "NE.GDI.FTOT.ZS",      # gross fixed capital formation, % of GDP
    "NE.CON.PRVT.ZS",      # household final consumption expenditure, % of GDP
    "NE.CON.GOVT.ZS",      # general government final consumption, % of GDP
    "NY.GDP.MKTP.PP.KD",   # GDP, PPP (constant 2021 international $)
    "NY.GDP.MKTP.CD",      # GDP (current US$)
    "SP.POP.TOTL",         # population
    "SP.POP.GROW",         # population growth, annual %
    "SL.TLF.TOTL.IN",      # labour force, total
    "FR.INR.RINR",         # real interest rate, %
    "GC.TAX.TOTL.GD.ZS",   # tax revenue, % of GDP
]
for ind in WB_INDICATORS:
    FILES.append(("worldbank_macro", WB + ind + "?format=json&per_page=20000&date=1960:2026", ind + ".json", b"[{"))


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url, dest, magic):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=90) as resp, open(tmp, "wb") as out:
        meta = {"http_status": resp.status, "last_modified": resp.headers.get("Last-Modified"), "etag": resp.headers.get("ETag")}
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            out.write(block)
    with open(tmp, "rb") as f:
        head = f.read(len(magic))
    if head != magic:
        tmp.unlink()
        raise ValueError(f"unexpected content (does not start with {magic!r})")
    tmp.rename(dest)
    return meta


def record(key, entry):
    """Re-read the shared manifest, add one entry, replace the file atomically."""
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest[key] = entry
    tmp = MANIFEST.with_name(MANIFEST.name + f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    tmp.replace(MANIFEST)


def main():
    force = "--force" in sys.argv
    failures = []
    for source, url, name, magic in FILES:
        folder = RAW / source
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / name
        key = f"{source}/{name}"
        if dest.exists() and not force:
            print(f"skip   {key}")
            continue
        try:
            meta = download(url, dest, magic)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            print(f"FAILED {key}: {e}")
            failures.append(key)
            continue
        record(key, {
            "url": url,
            "bytes": dest.stat().st_size,
            "sha256": sha256_of(dest),
            "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            **meta,
        })
        print(f"ok     {key}  {dest.stat().st_size:,} bytes")
        time.sleep(0.5)
    if failures:
        print(f"\n{len(failures)} failed: {failures}")
        sys.exit(1)


if __name__ == "__main__":
    main()
