"""Download the raw data sources into data/raw/<source>/ and record a manifest.

Standard library only. Run from the repo root:

    python3 -I pipeline/fetch.py small     # small files
    python3 -I pipeline/fetch.py large     # large files (hundreds of MB)
    python3 -I pipeline/fetch.py all

Each file goes in its own source folder. data/manifest.json records, for every
file, the URL, size, SHA-256 and retrieval time, so the data can be re-fetched
and checked. Existing files are skipped unless --force is given.
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
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifest.json"
UA = "why-pay-anyone-lbp/0.1 (academic project; data fetch script)"

MS = "https://raw.githubusercontent.com/microsoft/working-with-ai/main/"
BTOS = "https://www.census.gov/hfp/btos/downloads/"
EPOCH = "https://epoch.ai/data/"
HF = "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/release_2026_06_26/"

# (group, source id, url, file name)
FILES = [
    ("small", "microsoft_working_with_ai", MS + "ai_applicability_scores.csv", "ai_applicability_scores.csv"),
    ("small", "microsoft_working_with_ai", MS + "soc_metrics.csv", "soc_metrics.csv"),
    ("small", "microsoft_working_with_ai", MS + "LICENSE.txt", "LICENSE.txt"),
    ("small", "microsoft_working_with_ai", MS + "README.md", "README.md"),
    ("small", "indeed_ai_tracker", "https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/AI_posting.csv", "AI_posting.csv"),
    ("small", "openrouter_models", "https://openrouter.ai/api/v1/models", "models.json"),
    ("small", "onet_29_0", "https://www.onetcenter.org/dl_files/database/db_29_0_text.zip", "db_29_0_text.zip"),
    ("small", "onet_31_0", "https://www.onetcenter.org/dl_files/database/db_31_0_text.zip", "db_31_0_text.zip"),
]
for name in ["National", "Sector", "Subsector", "Employment Size Class", "State", "Top 25 MSA", "URR"]:
    FILES.append(("small", "census_btos", BTOS + name.replace(" ", "%20") + ".xlsx", name + ".xlsx"))
for path in [
    "ai_models.zip",
    "benchmark_data.zip",
    "ai_companies.zip",
    "ai_chip_sales.zip",
    "data_centers/data_centers.zip",
    "chat_stats/chat_stats.xlsx",
    "polling/polling_on_ai_usage_oct_2026.csv",
]:
    FILES.append(("small", "epoch_ai", EPOCH + path, path.split("/")[-1]))
FILES += [
    ("large", "anthropic_economic_index_2026_06_26", HF + "data/aei_claude_ai_2026-06-26.csv", "aei_claude_ai_2026-06-26.csv"),
    ("large", "anthropic_economic_index_2026_06_26", HF + "data/aei_1p_api_2026-06-26.csv", "aei_1p_api_2026-06-26.csv"),
    ("large", "anthropic_economic_index_2026_06_26", HF + "data_documentation.md", "data_documentation.md"),
]


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
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            out.write(block)
    tmp.rename(dest)
    return meta


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    group = args[0] if args else "all"
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    failures = []
    for g, source, url, name in FILES:
        if group != "all" and g != group:
            continue
        folder = RAW / source
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / name
        key = f"{source}/{name}"
        if dest.exists() and not force:
            print(f"skip   {key}")
            continue
        try:
            meta = download(url, dest)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print(f"FAILED {key}: {e}")
            failures.append(key)
            continue
        manifest[key] = {
            "url": url,
            "bytes": dest.stat().st_size,
            "sha256": sha256_of(dest),
            "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            **meta,
        }
        MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        print(f"ok     {key}  {manifest[key]['bytes']:,} bytes")
        time.sleep(0.5)
    if failures:
        print(f"\n{len(failures)} failed: {failures}")
        sys.exit(1)


if __name__ == "__main__":
    main()
