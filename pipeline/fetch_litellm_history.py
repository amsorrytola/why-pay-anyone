"""Collect month-end snapshots of the LiteLLM model price file from its git history.

Used for M1 (price of intelligence). Standard library plus the `gh` CLI (for
authenticated GitHub API calls). Run from the repo root:

    python3 -I pipeline/fetch_litellm_history.py

For each month from 2023-09 to now it finds the last commit that touched
model_prices_and_context_window.json on or before month end, then downloads
the file as it was at that commit. Output: data/raw/litellm_price_history/
<YYYY-MM>_<commit>.json, recorded in data/manifest.json.
"""
import calendar
import hashlib
import json
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "litellm_price_history"
MANIFEST = ROOT / "data" / "manifest.json"
REPO = "BerriAI/litellm"
PATH = "model_prices_and_context_window.json"
UA = "why-pay-anyone-lbp/0.1 (academic project; data fetch script)"


def months(start=(2023, 9)):
    now = datetime.now(timezone.utc)
    y, m = start
    while (y, m) <= (now.year, now.month):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def last_commit_before(year, month):
    end = f"{year}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}T23:59:59Z"
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/commits?path={PATH}&until={end}&per_page=1"],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    if not data:
        return None
    return data[0]["sha"], data[0]["commit"]["committer"]["date"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    seen = set()
    for y, m in months():
        found = last_commit_before(y, m)
        if not found:
            print(f"{y}-{m:02d}  no commit yet")
            continue
        sha, committed = found
        if sha in seen:
            print(f"{y}-{m:02d}  same commit as previous month ({sha[:7]}), skipped")
            continue
        seen.add(sha)
        name = f"{y}-{m:02d}_{sha[:7]}.json"
        dest = OUT / name
        url = f"https://raw.githubusercontent.com/{REPO}/{sha}/{PATH}"
        if not dest.exists():
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                dest.write_bytes(r.read())
        manifest[f"litellm_price_history/{name}"] = {
            "url": url,
            "commit": sha,
            "commit_date": committed,
            "bytes": dest.stat().st_size,
            "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
            "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        print(f"{y}-{m:02d}  {sha[:7]}  {committed}  {dest.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
