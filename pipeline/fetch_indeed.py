"""Download the Indeed Hiring Lab job postings tracker into data/raw/indeed_job_postings_tracker/.

Standard library only. Run from the repo root:

    python3 -I pipeline/fetch_indeed.py            # fetch what is missing
    python3 -I pipeline/fetch_indeed.py --force    # fetch again

Source: https://github.com/hiring-lab/job_postings_tracker (default branch "master"), CC BY 4.0.
What is taken: the aggregate posting index for every country folder, the sector (occupational
category) posting index for the countries that have one, the sector job-title examples, the README
and the LICENSE. The regional, metro and state files are not downloaded (large, not needed for M3).
Files keep their repo names with the country folder as a prefix, for example
US_job_postings_by_sector_US.csv. data/manifest.json records URL, size, SHA-256 and retrieval time
(same format as pipeline/fetch.py). Downloaded files are only ever parsed, never executed.
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
SOURCE = "indeed_job_postings_tracker"
BASE = "https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/"
AI_SOURCE = "indeed_ai_tracker"   # AI_posting.csv itself is fetched by pipeline/fetch.py
AI_BASE = "https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/"

AGGREGATE = ["AU", "CA", "DE", "EA", "ES", "FR", "GB", "IE", "IT", "NL", "US"]
SECTOR = ["AU", "CA", "DE", "FR", "GB", "US"]   # no sector file for EA, ES, IE, IT, NL (see repo tree)

# (source folder, base url, path in repo, local file name)
FILES = [(SOURCE, BASE, f"{c}/aggregate_job_postings_{c}.csv", f"aggregate_job_postings_{c}.csv") for c in AGGREGATE]
FILES += [(SOURCE, BASE, f"{c}/job_postings_by_sector_{c}.csv", f"job_postings_by_sector_{c}.csv") for c in SECTOR]
FILES += [
    (SOURCE, BASE, "sector-job-title-examples.csv", "sector-job-title-examples.csv"),
    (SOURCE, BASE, "README.md", "README.md"),
    (SOURCE, BASE, "LICENSE", "LICENSE.txt"),
    (AI_SOURCE, AI_BASE, "README.md", "README.md"),
    (AI_SOURCE, AI_BASE, "LICENSE", "LICENSE.txt"),
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
    with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
        meta = {"http_status": resp.status, "last_modified": resp.headers.get("Last-Modified"), "etag": resp.headers.get("ETag")}
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            out.write(block)
    tmp.rename(dest)
    return meta


def main():
    force = "--force" in sys.argv
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    failures = []
    for source, base, repo_path, name in FILES:
        folder = RAW / source
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / name
        key = f"{source}/{name}"
        if dest.exists() and not force:
            print(f"skip   {key}")
            continue
        url = base + repo_path
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
        # re-read before writing so other fetch scripts' entries are not lost
        current = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
        current[key] = manifest[key]
        MANIFEST.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n")
        manifest = current
        print(f"ok     {key}  {manifest[key]['bytes']:,} bytes")
        time.sleep(0.5)
    if failures:
        print(f"\n{len(failures)} failed: {failures}")
        sys.exit(1)


if __name__ == "__main__":
    main()
