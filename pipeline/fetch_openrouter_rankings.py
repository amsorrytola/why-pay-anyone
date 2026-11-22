"""Fetch OpenRouter's daily token totals (top 50 public models per day, plus an "other" row).

Used for M5 (market structure) and the volume side of M1. Needs OPENROUTER_API_KEY in
.env (any valid OpenRouter key). Standard library only. Run from the repo root:

    python3 -I pipeline/fetch_openrouter_rankings.py

Output: data/raw/openrouter_rankings_daily/rankings_daily.json (all rows) and an entry in
data/manifest.json. The key is read from .env and never printed.

Licence: CC BY 4.0. Cite as: "Source: OpenRouter (openrouter.ai/rankings), as of <as_of>."
The as_of time is stored in the manifest. Rate limits: 30 requests/minute, 500/day.
"""
import hashlib
import json
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "raw" / "openrouter_rankings_daily"
MANIFEST = ROOT / "data" / "manifest.json"
URL = "https://openrouter.ai/api/v1/datasets/rankings-daily"
START = date(2025, 1, 1)
CHUNK_DAYS = 60


def read_key():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("OPENROUTER_API_KEY not found in .env")


def get(key, start, end):
    req = urllib.request.Request(
        f"{URL}?start_date={start}&end_date={end}",
        headers={"Authorization": f"Bearer {key}", "User-Agent": "why-pay-anyone-lbp/0.1 (academic project)"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    key = read_key()
    end_all = datetime.now(timezone.utc).date() - timedelta(days=1)  # last complete day
    rows, as_of, start = [], None, START
    while start <= end_all:
        end = min(start + timedelta(days=CHUNK_DAYS - 1), end_all)
        try:
            d = get(key, start, end)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"HTTP {e.code} for {start}..{end}: {e.read()[:200]!r}")
        rows += d["data"]
        as_of = d["meta"]["as_of"]
        print(f"{start}..{end}: {len(d['data'])} rows", flush=True)
        start = end + timedelta(days=1)
        time.sleep(3)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "rankings_daily.json"
    payload = {"source": "OpenRouter rankings-daily (CC BY 4.0)", "as_of": as_of, "rows": rows}
    dest.write_text(json.dumps(payload))
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest["openrouter_rankings_daily/rankings_daily.json"] = {
        "url": f"{URL}?start_date={START}&end_date={end_all} (fetched in {CHUNK_DAYS}-day chunks)",
        "bytes": dest.stat().st_size,
        "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
        "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "as_of": as_of,
        "rows": len(rows),
        "citation": f"Source: OpenRouter (openrouter.ai/rankings), as of {as_of}. Licensed under CC BY 4.0.",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    days = {r["date"] for r in rows}
    print(f"saved {len(rows):,} rows covering {len(days)} days ({min(days)} to {max(days)})")


if __name__ == "__main__":
    main()
