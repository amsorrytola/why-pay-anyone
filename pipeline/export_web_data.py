"""Export the processed tables the website reads to compact JSON in web/src/data/.

Run from the repo root:  uv run python pipeline/export_web_data.py

Every file in data/processed/*.csv under MAX_BYTES is converted to an array of row objects (numbers rounded to
5 significant digits, missing values as null). Edit SKIP to leave tables out. The JSON files are committed so the
site builds without the raw data.
"""
import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "processed"
DST = ROOT / "web" / "src" / "data"
MAX_BYTES = 1_200_000
SKIP = {
    "m5_hhi_daily.csv",  # thinned copy below
    "m3_btos_msa.csv", "m3_btos_state.csv", "m3_btos_subsector.csv", "m3_btos_sector.csv", "m3_btos_size.csv",  # slim copies below
    "m3_indeed_sector_monthly.csv", "m3_category_soc_map.csv", "m3_btos_snapshot_employment.csv",
}


def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, float):
        return float(f"{v:.5g}")
    return v


def main():
    DST.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(SRC.glob("*.csv")):
        if f.name in SKIP or f.stat().st_size > MAX_BYTES:
            continue
        df = pd.read_csv(f)
        rows = [{k: clean(v) for k, v in r.items()} for r in df.to_dict("records")]
        out = DST / (f.stem + ".json")
        out.write_text(json.dumps(rows, separators=(",", ":")))
        n += 1
        print(f"{out.name}: {len(rows)} rows, {out.stat().st_size / 1024:.0f} KB")
    d = pd.read_csv(SRC / "m5_hhi_daily.csv")
    d = d.iloc[::2]  # every second day
    (DST / "m5_hhi_daily.json").write_text(json.dumps([{k: clean(v) for k, v in r.items()} for r in d.to_dict("records")], separators=(",", ":")))
    # M3: only the series the site draws
    parts = []
    for name in ("m3_btos_sector", "m3_btos_size", "m3_btos_state"):
        b = pd.read_csv(SRC / f"{name}.csv")
        b = b[(b.question_id == 7) & (b.answer == "Yes")]
        parts.append(b[["geo_type", "geo_name", "ref_end", "estimate_pct", "se_pct"]])
    q7 = pd.concat(parts)
    (DST / "m3_btos_q7_groups.json").write_text(json.dumps([{k: clean(v) for k, v in r.items()} for r in q7.to_dict("records")], separators=(",", ":")))
    sn = pd.read_csv(SRC / "m3_btos_snapshot_employment.csv")
    sn = sn[sn.geo_type.isin(["national", "size"])]
    (DST / "m3_btos_snapshot_employment.json").write_text(json.dumps([{k: clean(v) for k, v in r.items()} for r in sn.to_dict("records")], separators=(",", ":")))
    print(f"exported {n + 3} tables")


if __name__ == "__main__":
    main()
