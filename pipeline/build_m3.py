"""M3: adoption in the economy. Tidy tables, analysis, outputs for the website.

Run from the repo root (fetch scripts are separate: fetch.py and fetch_indeed.py):

    uv run python pipeline/build_m3.py            # everything
    uv run python pipeline/build_m3.py btos       # one part: btos | indeed | exposure | analysis

Needs data/processed/occupations.csv (build_occupations.py) and the raw files in
data/raw/census_btos/, data/raw/indeed_ai_tracker/, data/raw/indeed_job_postings_tracker/.
Deterministic: no random numbers except permutation tests with a fixed seed.

Outputs (data/processed/m3_*.csv), by part
  btos      m3_btos_{national,sector,subsector,size,state,msa}.csv   long tables, AI questions only
            m3_btos_questions.csv, m3_btos_periods.csv, m3_btos_coverage.csv
  indeed    m3_indeed_aggregate_monthly.csv, m3_indeed_sector_monthly.csv, m3_indeed_ai_share_monthly.csv
            (the analysis part adds total_postings_index and ai_postings_index to the AI share file)
  exposure  m3_category_exposure.csv, m3_category_soc_map.csv
  analysis  m3_btos_adoption_summary.csv, m3_btos_dispersion.csv, m3_btos_trend.csv,
            m3_btos_snapshot_employment.csv, m3_btos_sector_exposure.csv, m3_btos_exposure_correlation.csv,
            m3_indeed_ai_share_summary.csv, m3_event_study_coefs.csv, m3_event_study_summary.csv,
            m3_event_study_group_paths.csv

Everything here is exploratory. Findings are written up in docs/findings-m3.md.
"""
import os
import re
import sys
import warnings
from pathlib import Path

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):   # single thread: faster here, repeatable
    os.environ.setdefault(_v, "1")

import numpy as np
import pandas as pd
import statsmodels.api as sm

warnings.filterwarnings("ignore", category=FutureWarning)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
BTOS_DIR = RAW / "census_btos"
IND_DIR = RAW / "indeed_job_postings_tracker"
AI_DIR = RAW / "indeed_ai_tracker"

# ---------------------------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------------------------
AI_QIDS = ["7", "8", "9", "10", "28"]
QUESTION_LABELS = {  # long labels (m3_btos_questions.csv)
    "7": "Used AI in any business function (last two weeks)",
    "8": "Employees used generative AI for work tasks (last two weeks)",
    "9": "Effect of AI use on headcount (last six months)",
    "10": "Effect of AI use on number of new hires (last six months)",
    "28": "Expects to use AI in any business function (next six months)",
}
SHORT_LABELS = {  # short labels in the long tables
    "7": "AI use, last 2 weeks", "8": "Generative AI by employees, last 2 weeks",
    "9": "AI effect on headcount, last 6 months", "10": "AI effect on hiring, last 6 months",
    "28": "Expects AI use, next 6 months",
}
BTOS_FILES = {  # kind: (file, name of the group column, label of the group)
    "national": ("National.xlsx", None),
    "sector": ("Sector.xlsx", "Sector"),
    "subsector": ("Subsector.xlsx", "Subsector"),
    "size": ("Employment Size Class.xlsx", "Empsize"),
    "state": ("State.xlsx", "State"),
    "msa": ("Top 25 MSA.xlsx", "MSA"),
}
SECTOR_NAMES = {
    "11": "Agriculture, Forestry, Fishing and Hunting", "21": "Mining, Quarrying, and Oil and Gas Extraction",
    "22": "Utilities", "23": "Construction", "31": "Manufacturing", "42": "Wholesale Trade",
    "44": "Retail Trade", "48": "Transportation and Warehousing", "51": "Information",
    "52": "Finance and Insurance", "53": "Real Estate and Rental and Leasing",
    "54": "Professional, Scientific, and Technical Services", "55": "Management of Companies and Enterprises",
    "56": "Administrative and Support and Waste Management", "61": "Educational Services",
    "62": "Health Care and Social Assistance", "71": "Arts, Entertainment, and Recreation",
    "72": "Accommodation and Food Services", "81": "Other Services (except Public Administration)",
    "XX": "Multi-unit firms operating in several sectors",
}
SIZE_NAMES = {"A": "1 to 4 employees", "B": "5 to 9 employees", "C": "10 to 19 employees", "D": "20 to 49 employees",
              "E": "50 to 99 employees", "F": "100 to 249 employees", "G": "250 or more employees"}
SIZE_ORDER = list("ABCDEFG")
STATE_NAMES = {
    "AK": "Alaska", "AL": "Alabama", "AR": "Arkansas", "AZ": "Arizona", "CA": "California", "CO": "Colorado",
    "CT": "Connecticut", "DC": "District of Columbia", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "IA": "Iowa", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "MA": "Massachusetts", "MD": "Maryland", "ME": "Maine",
    "MI": "Michigan", "MN": "Minnesota", "MO": "Missouri", "MS": "Mississippi", "MT": "Montana",
    "NC": "North Carolina", "ND": "North Dakota", "NE": "Nebraska", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NV": "Nevada", "NY": "New York", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "PR": "Puerto Rico", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VA": "Virginia", "VT": "Vermont",
    "WA": "Washington", "WI": "Wisconsin", "WV": "West Virginia", "WY": "Wyoming",
    "XX": "Multi-state firms",
}
# NAICS subsector names. The Census file gives codes only; names are added here from the NAICS manual.
# 2017 vintage until period 202616, 2022 vintage from 202616 (see the note in the Subsector file).
NAICS_REMOVED_202616 = {"442", "443", "446", "447", "448", "451", "452", "453", "454", "511", "515"}
NAICS_ADDED_202616 = {"449", "455", "456", "457", "458", "459", "513", "516"}
SUBSECTOR_NAMES = {
    "113": "Forestry and Logging", "114": "Fishing, Hunting and Trapping",
    "115": "Support Activities for Agriculture and Forestry", "211": "Oil and Gas Extraction",
    "212": "Mining (except Oil and Gas)", "213": "Support Activities for Mining", "221": "Utilities",
    "236": "Construction of Buildings", "237": "Heavy and Civil Engineering Construction",
    "238": "Specialty Trade Contractors", "311": "Food Manufacturing",
    "312": "Beverage and Tobacco Product Manufacturing", "313": "Textile Mills",
    "314": "Textile Product Mills", "315": "Apparel Manufacturing", "316": "Leather and Allied Product Manufacturing",
    "321": "Wood Product Manufacturing", "322": "Paper Manufacturing", "323": "Printing and Related Support Activities",
    "324": "Petroleum and Coal Products Manufacturing", "325": "Chemical Manufacturing",
    "326": "Plastics and Rubber Products Manufacturing", "327": "Nonmetallic Mineral Product Manufacturing",
    "331": "Primary Metal Manufacturing", "332": "Fabricated Metal Product Manufacturing",
    "333": "Machinery Manufacturing", "334": "Computer and Electronic Product Manufacturing",
    "335": "Electrical Equipment, Appliance, and Component Manufacturing",
    "336": "Transportation Equipment Manufacturing", "337": "Furniture and Related Product Manufacturing",
    "339": "Miscellaneous Manufacturing", "423": "Merchant Wholesalers, Durable Goods",
    "424": "Merchant Wholesalers, Nondurable Goods", "425": "Wholesale Trade Agents and Brokers",
    "441": "Motor Vehicle and Parts Dealers", "442": "Furniture and Home Furnishings Stores",
    "443": "Electronics and Appliance Stores", "444": "Building Material and Garden Equipment and Supplies Dealers",
    "445": "Food and Beverage Stores", "446": "Health and Personal Care Stores", "447": "Gasoline Stations",
    "448": "Clothing and Clothing Accessories Stores", "449": "Furniture, Home Furnishings, Electronics, and Appliance Retailers",
    "451": "Sporting Goods, Hobby, Musical Instrument, and Book Stores", "452": "General Merchandise Stores",
    "453": "Miscellaneous Store Retailers", "454": "Nonstore Retailers", "455": "General Merchandise Retailers",
    "456": "Health and Personal Care Retailers", "457": "Gasoline Stations and Fuel Dealers",
    "458": "Clothing, Clothing Accessories, Shoe, and Jewelry Retailers",
    "459": "Sporting Goods, Hobby, Musical Instrument, Book, and Miscellaneous Retailers",
    "481": "Air Transportation", "483": "Water Transportation", "484": "Truck Transportation",
    "485": "Transit and Ground Passenger Transportation", "486": "Pipeline Transportation",
    "487": "Scenic and Sightseeing Transportation", "488": "Support Activities for Transportation",
    "492": "Couriers and Messengers", "493": "Warehousing and Storage", "511": "Publishing Industries",
    "512": "Motion Picture and Sound Recording Industries", "513": "Publishing Industries",
    "515": "Broadcasting (except Internet)", "516": "Broadcasting and Content Providers",
    "517": "Telecommunications", "518": "Data Processing, Hosting, and Related Services",
    "519": "Other Information Services", "522": "Credit Intermediation and Related Activities",
    "523": "Securities, Commodity Contracts, and Other Financial Investments and Related Activities",
    "524": "Insurance Carriers and Related Activities", "531": "Real Estate", "532": "Rental and Leasing Services",
    "533": "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)",
    "541": "Professional, Scientific, and Technical Services", "551": "Management of Companies and Enterprises",
    "561": "Administrative and Support Services", "562": "Waste Management and Remediation Services",
    "611": "Educational Services", "621": "Ambulatory Health Care Services", "622": "Hospitals",
    "623": "Nursing and Residential Care Facilities", "624": "Social Assistance",
    "711": "Performing Arts, Spectator Sports, and Related Industries",
    "712": "Museums, Historical Sites, and Similar Institutions", "713": "Amusement, Gambling, and Recreation Industries",
    "721": "Accommodation", "722": "Food Services and Drinking Places", "811": "Repair and Maintenance",
    "812": "Personal and Laundry Services",
}


def subsector_name(code):
    if code == "XXX":
        return "Multi-unit firms operating in several sectors"
    if code.endswith("X"):
        return f"Multi-unit firms in several subsectors of sector {code[:-1]}"
    name = SUBSECTOR_NAMES.get(code, code)
    if code in NAICS_REMOVED_202616:
        name += " (NAICS 2017, to 202615)"
    if code in NAICS_ADDED_202616:
        name += " (NAICS 2022, from 202616)"
    return name


def group_name(kind, code):
    if kind == "national":
        return "United States"
    if kind == "sector":
        return SECTOR_NAMES.get(code, code)
    if kind == "subsector":
        return subsector_name(code)
    if kind == "size":
        return SIZE_NAMES.get(code, code)
    if kind == "state":
        return STATE_NAMES.get(code, code)
    return code.replace(" MSA", "")  # msa: the file already uses the full MSA title


def num(series):
    """'25.0%' -> 25.0; anything else ('S' suppressed, '.' not asked, missing) -> NaN."""
    return pd.to_numeric(series.astype(str).str.rstrip("%"), errors="coerce")


def tidy_btos(kind, filename, gcol, dates):
    """Long table of the AI questions (Q7, Q8, Q9, Q10, Q28) for one BTOS workbook.

    Keeps only cells with a published number. Suppressed cells ("S") and cells where the question was
    not asked (".") are dropped here and counted in the coverage table.
    """
    sheets = pd.read_excel(BTOS_DIR / filename, sheet_name=["Response Estimates", "Response Standard Errors"],
                           dtype=str)
    est, se = sheets["Response Estimates"], sheets["Response Standard Errors"]
    pcols = [c for c in est.columns if re.fullmatch(r"\d{6}", str(c))]
    ids = ([gcol] if gcol else []) + ["Question ID", "Answer ID", "Answer"]
    e = est[est["Question ID"].isin(AI_QIDS)][ids + pcols].melt(id_vars=ids, var_name="period", value_name="est_raw")
    s = se[se["Question ID"].isin(AI_QIDS)][ids + pcols].melt(id_vars=ids, var_name="period", value_name="se_raw")
    m = e.merge(s, on=ids + ["period"], how="left", validate="1:1")
    m["estimate_pct"] = num(m["est_raw"])
    m["se_pct"] = num(m["se_raw"])
    m["suppressed"] = m["est_raw"].eq("S")
    m["not_asked"] = m["est_raw"].eq(".")
    m["geo_code"] = m[gcol] if gcol else "US"
    m["geo_type"] = kind
    m["geo_name"] = [group_name(kind, c) for c in m["geo_code"]]
    m["period"] = m["period"].astype(int)
    m["question_id"] = m["Question ID"].astype(int)
    m["question_label"] = m["Question ID"].map(SHORT_LABELS)
    m["answer_id"] = m["Answer ID"].astype(int)
    m["answer"] = m["Answer"]
    m = m.merge(dates[["period", "ref_start", "ref_end"]], on="period", how="left", validate="m:1")
    cov = (m.groupby(["geo_type", "question_id"])
             .apply(lambda g: pd.Series({
                 "groups": g["geo_code"].nunique(),
                 "periods_with_values": g.loc[g["estimate_pct"].notna(), "period"].nunique(),
                 "first_period": g.loc[g["estimate_pct"].notna(), "period"].min(),
                 "last_period": g.loc[g["estimate_pct"].notna(), "period"].max(),
                 "cells_with_value": int(g["estimate_pct"].notna().sum()),
                 "cells_suppressed": int(g["suppressed"].sum()),
                 "cells_not_asked": int(g["not_asked"].sum()),
                 "cells_se_missing": int((g["estimate_pct"].notna() & g["se_pct"].isna()).sum()),
             }), include_groups=False).reset_index())
    cols = ["geo_type", "geo_code", "geo_name", "period", "ref_start", "ref_end", "question_id", "question_label",
            "answer_id", "answer", "estimate_pct", "se_pct"]
    out = m[m["estimate_pct"].notna()][cols].copy()
    out = out.sort_values(["geo_code", "question_id", "answer_id", "period"]).reset_index(drop=True)
    return out, cov


def load_btos_dates():
    d = pd.read_excel(BTOS_DIR / "National.xlsx", sheet_name="Collection and Reference Dates", dtype=str)
    d = d[d["Smpdt"].astype(str).str.fullmatch(r"\d{6}")].copy()
    out = pd.DataFrame({
        "period": d["Smpdt"].astype(int),
        "collect_start": pd.to_datetime(d["Collection Start"]).dt.strftime("%Y-%m-%d"),
        "collect_end": pd.to_datetime(d["Col End"]).dt.strftime("%Y-%m-%d"),
        "ref_start": pd.to_datetime(d["Reference Period Start"]).dt.strftime("%Y-%m-%d"),
        "ref_end": pd.to_datetime(d["Ref End"]).dt.strftime("%Y-%m-%d"),
        "publication_date": pd.to_datetime(d["Publication Date"]).dt.strftime("%Y-%m-%d"),
    })
    out["no_data_shutdown"] = out["period"].isin([202521, 202522, 202523])
    return out.reset_index(drop=True)


def part_btos():
    print("BTOS: reading workbooks (a few minutes)")
    dates_all = load_btos_dates()
    # The dates sheet lists future cycles too; keep the periods that exist as columns in the files.
    nat_cols = pd.read_excel(BTOS_DIR / "National.xlsx", sheet_name="Response Estimates", nrows=1).columns
    have = {int(c) for c in nat_cols if re.fullmatch(r"\d{6}", str(c))}
    dates = dates_all[dates_all["period"].isin(have)].reset_index(drop=True)
    # Check that every workbook's date sheet agrees with the National one.
    for kind, (fname, gcol) in BTOS_FILES.items():
        if kind == "national":
            continue
        d2 = pd.read_excel(BTOS_DIR / fname, sheet_name="Collection and Reference Dates", dtype=str)
        d2 = d2[d2["Smpdt"].astype(str).str.fullmatch(r"\d{6}")]
        assert set(d2["Smpdt"].astype(int)) == set(dates_all["period"]), f"date sheet differs in {fname}"
    dates.to_csv(OUT / "m3_btos_periods.csv", index=False)
    covs = []
    for kind, (fname, gcol) in BTOS_FILES.items():
        long, cov = tidy_btos(kind, fname, gcol, dates)
        long.to_csv(OUT / f"m3_btos_{kind}.csv", index=False)
        covs.append(cov)
        print(f"  {kind:10s} {len(long):6d} rows  {(OUT / f'm3_btos_{kind}.csv').stat().st_size / 1e6:5.2f} MB")
    cov = pd.concat(covs, ignore_index=True)
    cov.to_csv(OUT / "m3_btos_coverage.csv", index=False)
    # Question table: full wording from the National file.
    nat = pd.read_excel(BTOS_DIR / "National.xlsx", sheet_name="Response Estimates", dtype=str)
    q = nat[nat["Question ID"].isin(AI_QIDS)].drop_duplicates("Question ID")[["Question ID", "Question"]]
    q["question_id"] = q["Question ID"].astype(int)
    q["label"] = q["Question ID"].map(QUESTION_LABELS)
    q["wording_in_file"] = q["Question"].str.replace(r"\s+", " ", regex=True)
    nat_cov = cov[cov["geo_type"] == "national"].set_index("question_id")
    q["periods_national"] = q["question_id"].map(nat_cov["periods_with_values"])
    q["first_period"] = q["question_id"].map(nat_cov["first_period"])
    q["last_period"] = q["question_id"].map(nat_cov["last_period"])
    q["answers"] = q["Question ID"].map(nat[nat["Question ID"].isin(AI_QIDS)].groupby("Question ID")["Answer"]
                                         .apply(lambda s: "; ".join(s)))
    q["kind"] = np.where(q["periods_national"] > 2, "series", "snapshot (two periods)")
    q[["question_id", "label", "wording_in_file", "answers", "periods_national", "first_period", "last_period", "kind"]] \
        .sort_values("question_id").to_csv(OUT / "m3_btos_questions.csv", index=False)
    print("  coverage (national):")
    print(cov[cov["geo_type"] == "national"][["question_id", "periods_with_values", "first_period", "last_period"]]
          .to_string(index=False))


# ---------------------------------------------------------------------------------------------
# Indeed Hiring Lab: tidy tables
# ---------------------------------------------------------------------------------------------
AGG_AREAS = ["AU", "CA", "DE", "EA", "ES", "FR", "GB", "IE", "IT", "NL", "US"]
SECTOR_COUNTRIES = ["US", "AU", "CA", "DE", "FR", "GB"]
VAR_CODE = {"total postings": "total", "new postings": "new"}


def monthly_complete(df, value_cols, by):
    """Monthly means of daily data, keeping only complete calendar months."""
    df = df.copy()
    df["month"] = df["date"].dt.to_period("M")
    g = df.groupby(by + ["month"])
    out = g[value_cols].mean()
    out["n_days"] = g["date"].nunique()
    out = out.reset_index()
    out = out[out["n_days"] == out["month"].dt.days_in_month].drop(columns="n_days")
    return out


def part_indeed():
    print("Indeed: tidying")
    # AI share of postings (AI tracker): daily, 9 countries, 7-day trailing average.
    ai = pd.read_csv(AI_DIR / "AI_posting.csv", parse_dates=["date"])
    ai_m = monthly_complete(ai, ["AI_share_postings"], ["jobcountry"])
    ai_m["month"] = ai_m["month"].astype(str)
    ai_m = ai_m.rename(columns={"jobcountry": "country", "AI_share_postings": "ai_share_pct"})
    ai_m["ai_share_pct"] = ai_m["ai_share_pct"].round(4)
    ai_m.sort_values(["country", "month"]).to_csv(OUT / "m3_indeed_ai_share_monthly.csv", index=False)
    print(f"  ai share: {len(ai_m)} rows, {ai_m['country'].nunique()} countries, {ai_m['month'].min()} to {ai_m['month'].max()}")

    # Aggregate postings index (Feb 1, 2020 = 100), total and new postings, seasonally adjusted and not.
    frames = []
    for c in AGG_AREAS:
        a = pd.read_csv(IND_DIR / f"aggregate_job_postings_{c}.csv", parse_dates=["date"])
        frames.append(a)
    agg = pd.concat(frames, ignore_index=True)
    agg_m = monthly_complete(agg, ["indeed_job_postings_index_SA", "indeed_job_postings_index_NSA"],
                             ["jobcountry", "variable"])
    agg_m["variable"] = agg_m["variable"].map(VAR_CODE)
    agg_m["month"] = agg_m["month"].astype(str)
    agg_m = agg_m.rename(columns={"jobcountry": "area", "indeed_job_postings_index_SA": "index_sa",
                                  "indeed_job_postings_index_NSA": "index_nsa"}).round(2)
    agg_m.sort_values(["area", "variable", "month"]).to_csv(OUT / "m3_indeed_aggregate_monthly.csv", index=False)
    print(f"  aggregate: {len(agg_m)} rows, {agg_m['month'].min()} to {agg_m['month'].max()}")

    # Sector (occupational category) index: US total and new postings; other countries total postings only
    # (to keep the file small).
    frames = []
    for c in SECTOR_COUNTRIES:
        s = pd.read_csv(IND_DIR / f"job_postings_by_sector_{c}.csv", parse_dates=["date"])
        if c != "US":
            s = s[s["variable"] == "total postings"]
        frames.append(s)
    sec = pd.concat(frames, ignore_index=True)
    sec_m = monthly_complete(sec, ["indeed_job_postings_index"], ["jobcountry", "display_name", "variable"])
    sec_m["variable"] = sec_m["variable"].map(VAR_CODE)
    sec_m["month"] = sec_m["month"].astype(str)
    sec_m = sec_m.rename(columns={"jobcountry": "country", "display_name": "category",
                                  "indeed_job_postings_index": "index_sa"}).round(2)
    sec_m = sec_m.sort_values(["country", "category", "variable", "month"])[
        ["country", "category", "variable", "month", "index_sa"]]
    sec_m.to_csv(OUT / "m3_indeed_sector_monthly.csv", index=False)
    size = (OUT / "m3_indeed_sector_monthly.csv").stat().st_size / 1e6
    print(f"  sector: {len(sec_m)} rows, {sec_m['category'].nunique()} categories, {size:.2f} MB")


# ---------------------------------------------------------------------------------------------
# Exposure by Indeed category (mapping of Indeed categories to SOC occupations)
# ---------------------------------------------------------------------------------------------
# Indeed assigns postings to categories from normalized job titles, not from SOC codes, so this mapping is a
# judgement. Each SOC occupation goes to the category of the LONGEST matching prefix below (so a general
# prefix such as "43-" is overridden by a specific code such as "43-4051"). Indeed's own title examples
# (data/raw/indeed_job_postings_tracker/sector-job-title-examples.csv) guided the choices. Occupations that
# match no prefix are left out. Rules for categories that exist only in some countries (for example
# Real Estate) are kept so that those countries can be scored.
CATEGORY_RULES = {
    "Accounting": ["13-2011", "13-2082", "13-2031", "13-2051", "13-2081", "43-3021", "43-3031", "43-3051", "43-3099"],
    "Administrative Assistance": ["43-", "43-6011", "43-6014", "43-9", "43-4021", "43-4031", "43-4061", "43-4071",
                                  "43-4111", "43-4171", "43-4199", "43-1011"],
    "Agriculture & Forestry": ["45-", "11-9013", "13-1074", "17-2021"],
    "Architecture": ["17-1011", "17-1012", "27-1025", "17-3011"],
    "Arts & Entertainment": ["27-1", "27-2", "13-1011", "11-907", "39-3", "39-1013", "39-1014", "41-9012", "41-2012"],
    "Aviation": ["53-1041", "53-2", "49-3011", "49-2091", "53-6032"],
    "Banking & Finance": ["11-3031", "13-2041", "13-2052", "13-2054", "13-2061", "13-2071", "13-2072", "13-2099",
                          "41-3031", "43-3011", "43-3041", "43-3071", "43-4011", "43-4041", "43-4131", "43-4141"],
    "Beauty & Wellness": ["39-5", "39-1022"],
    "Chemical Engineering": ["17-2041"],
    "Childcare": ["25-2011", "39-9011"],
    "Civil Engineering": ["17-2051", "17-2081", "17-2111", "17-2151", "17-1021", "17-1022", "17-3022", "17-3025",
                          "17-3031", "19-5"],
    "Cleaning & Sanitation": ["37-1011", "37-2", "51-6011", "53-7061", "53-7081"],
    "Community & Social Service": ["21-1", "21-2", "11-9151"],
    "Construction": ["47-1", "47-2", "47-3", "47-4", "11-9021", "13-1051"],
    "Customer Service": ["43-4051", "43-4081", "43-4151", "43-4181", "41-2021", "43-2"],
    "Data & Analytics": ["15-2", "13-1111", "43-9111"],
    "Dental": ["29-102", "29-1292", "31-9091", "51-9081"],
    "Driving": ["53-3", "53-4", "53-5", "53-6021", "53-6031", "43-5021"],
    "Education & Instruction": ["25-1", "25-2", "25-3", "25-4", "25-9", "11-903", "21-1012", "43-4121"],
    "Electrical Engineering": ["17-2061", "17-2071", "17-2072", "17-3012", "17-3023"],
    "Food Preparation & Service": ["35-", "11-9051"],
    "Hospitality & Tourism": ["39-6", "39-7010", "41-3041", "11-9081", "13-1121"],
    "Human Resources": ["13-1071", "13-1075", "13-1141", "13-1151", "11-3111", "11-3121", "11-3131", "43-4161"],
    "IT Infrastructure, Operations & Support": ["15-1212", "15-1231", "15-1232", "15-1241", "15-1244", "49-2011",
                                                "11-3021"],
    "IT Systems & Solutions": ["15-1211", "15-1221", "15-1242", "15-1243", "15-1299"],
    "Industrial Engineering": ["17-2", "17-2112", "17-2131", "17-3019", "17-3026", "17-3028", "17-3029"],
    "Installation & Maintenance": ["49-"],
    "Insurance": ["13-1031", "13-1032", "13-2053", "41-3021", "43-9041"],
    "Legal": ["23-", "13-1041", "43-6012"],
    "Loading & Stocking": ["53-7", "43-5071", "43-5111"],
    "Logistic Support": ["13-1020", "13-1081", "11-3061", "11-3071", "53-1047", "43-3061", "43-5011", "43-5032",
                         "43-5041", "43-5051", "43-5052", "43-5053", "43-5061", "53-6041", "53-6051", "53-6061",
                         "53-6099"],
    "Management": ["11-", "11-1011", "11-1021", "11-3012", "11-3013", "11-9199", "13-1199", "41-1011", "35-1012"],
    "Marketing": ["11-2011", "11-2021", "11-2032", "11-2033", "13-1131", "13-1161", "27-3031"],
    "Mechanical Engineering": ["17-2011", "17-2121", "17-2141", "17-3013", "17-3021", "17-3024", "17-3027"],
    "Media & Communications": ["27-3", "27-4", "43-9081"],
    "Medical Information": ["29-2072", "29-9021", "31-9094", "43-6013"],
    "Medical Technician": ["29-2", "29-9", "29-1124", "31-9092", "31-9093", "31-9097", "31-9099"],
    "Nursing": ["29-1141", "29-1151", "29-1161", "29-1171", "29-2061", "31-1131", "31-1132"],
    "Personal Care & Home Health": ["31-1120", "31-1133", "39-9041"],
    "Pharmacy": ["29-1051", "29-2052", "31-9095"],
    "Physicians & Surgeons": ["29-1", "29-1011", "29-1041", "29-1071", "29-1081", "29-12", "29-1291", "29-1299"],
    "Production & Manufacturing": ["51-", "11-3051", "53-7071", "53-7072", "53-7073"],
    "Project Management": ["13-1082"],
    "Real Estate": ["41-9021", "41-9022", "11-9141", "13-2020"],
    "Retail": ["41-2011", "41-2022", "41-2031", "41-9011", "27-1026"],
    "Sales": ["41-1012", "41-3011", "41-3091", "41-4", "41-9031", "41-9041", "41-9091", "41-9099", "11-2022"],
    "Scientific Research & Development": ["19-1", "19-2", "19-4", "11-9121", "17-2031"],
    "Security & Public Safety": ["33-", "43-5031"],
    "Social Science": ["19-3", "19-4061"],
    "Software Development": ["15-1251", "15-1252", "15-1253", "15-1254", "15-1255"],
    "Sports": ["27-2021", "27-2022", "27-2023", "39-9031", "39-9032", "29-9091", "33-9092"],
    "Therapy": ["29-1031", "29-112", "29-1181", "31-2", "31-9011"],
    "Veterinary": ["29-1131", "29-2056", "31-9096", "39-2011", "39-2021"],
}
UNMAPPED_RULES = ["47-5", "39-4", "37-3", "39-9099"]   # extraction, funeral, grounds workers, other personal care
CATEGORY_NOTES = {
    "Accounting": "Indeed's example titles include financial analysts, so SOC 13-2051 is placed here, not in Banking & Finance.",
    "Banking & Finance": "Bank clerks and tellers (43-3071 etc.) are placed here rather than in Administrative Assistance.",
    "Management": "General and other managers, plus first-line supervisors of retail sellers and of food service (Indeed lists 'shift manager'). Managers with an obvious domain (marketing, IT, HR, finance, education) go to that domain.",
    "Administrative Assistance": "Default home of the office and administrative support group (SOC 43) unless a more specific category fits.",
    "Customer Service": "Includes hotel desk clerks (Indeed lists 'front desk agent'), reservation agents and counter and rental clerks.",
    "Data & Analytics": "Indeed's newer category; replaces earlier 'Mathematics' and 'Information Design and Documentation'. Business analysts (management analysts, SOC 13-1111) are placed here on the old example title.",
    "IT Infrastructure, Operations & Support": "No Indeed title examples for the newer name; mapped from the label (older name 'IT Operations & Helpdesk').",
    "IT Systems & Solutions": "No Indeed title examples; mapped from the label. Includes computer systems analysts and 'Computer Occupations, All Other'.",
    "Software Development": "Programmers, developers, testers and web developers and designers.",
    "Civil Engineering": "Indeed lists 'environmental health and safety specialist' under Civil Engineering, so SOC 19-5 is placed here.",
    "Industrial Engineering": "Also receives engineers not elsewhere classified (SOC 17-2xxx default).",
    "Physicians & Surgeons": "Also the default for practitioner occupations (SOC 29-1) not placed elsewhere.",
    "Medical Technician": "Also the default for health technologists and technicians (SOC 29-2, 29-9).",
    "Retail": "Cashiers, retail salespersons, parts salespersons.",
    "Sales": "Non-retail sales representatives and sales managers.",
    "Loading & Stocking": "Material movers, stockers, packers and shipping clerks.",
    "Logistic Support": "Logisticians, buyers, dispatchers, postal workers and transportation supervisors.",
    "Driving": "All motor vehicle operators plus rail and water transport operators (judgement).",
    "Real Estate": "Category exists only in some countries' files (not US).",
    "Beauty & Wellness": "Category exists only in some countries' files (not US).",
    "Agriculture & Forestry": "Category exists only in some countries' files (not US).",
    "Chemical Engineering": "Category exists only in the DE file.",
    "Sports": "Category exists only in some countries' files (not US).",
    "Veterinary": "Category exists only in some countries' files (not US).",
    "Aviation": "Pilots, air traffic controllers, flight attendants, aircraft mechanics.",
}

# BTOS NAICS sector -> Indeed categories judged to be that sector's occupational core. This is a rough proxy of a
# sector's exposure from occupations that are typical of it. It is NOT the sector's actual occupation mix (that
# needs the BLS industry-occupation matrix, which was not used). Sectors with no clear core are left out.
SECTOR_CORE_CATEGORIES = {
    "11": ["Agriculture & Forestry"],
    "23": ["Construction", "Civil Engineering"],
    "31": ["Production & Manufacturing", "Industrial Engineering", "Mechanical Engineering", "Electrical Engineering"],
    "44": ["Retail"],
    "48": ["Driving", "Loading & Stocking", "Logistic Support", "Aviation"],
    "51": ["Software Development", "IT Systems & Solutions", "Data & Analytics", "Media & Communications"],
    "52": ["Banking & Finance", "Insurance"],
    "53": ["Real Estate"],
    "54": ["Legal", "Accounting", "Architecture", "Scientific Research & Development", "Marketing"],
    "56": ["Cleaning & Sanitation", "Security & Public Safety", "Administrative Assistance", "Customer Service"],
    "61": ["Education & Instruction"],
    "62": ["Nursing", "Physicians & Surgeons", "Medical Technician", "Dental", "Pharmacy", "Therapy",
           "Medical Information", "Personal Care & Home Health", "Community & Social Service", "Childcare"],
    "71": ["Arts & Entertainment", "Sports"],
    "72": ["Food Preparation & Service", "Hospitality & Tourism"],
    "81": ["Beauty & Wellness", "Installation & Maintenance"],
}


def assign_categories(occ):
    """Return a Series of category (or NaN) and the matching prefix for each occupation."""
    rules = []
    for cat, prefixes in CATEGORY_RULES.items():
        for p in prefixes:
            rules.append((p, cat))
    for p in UNMAPPED_RULES:
        rules.append((p, None))
    seen = {}
    for p, cat in rules:
        if p in seen and seen[p] != cat:
            raise ValueError(f"prefix {p} assigned to both {seen[p]} and {cat}")
        seen[p] = cat
    rules = sorted(seen.items(), key=lambda kv: -len(kv[0]))   # longest prefix first
    cats, used = [], []
    for soc in occ["soc"]:
        hit = next(((p, c) for p, c in rules if soc.startswith(p)), (None, None))
        cats.append(hit[1])
        used.append(hit[0])
    return pd.Series(cats, index=occ.index), pd.Series(used, index=occ.index)


def part_exposure():
    print("Exposure: mapping Indeed categories to SOC occupations")
    occ = pd.read_csv(OUT / "occupations.csv", dtype={"soc": str})
    occ["category"], occ["matched_prefix"] = assign_categories(occ)
    total_emp = occ["employment"].sum()
    mapped = occ[occ["category"].notna()].copy()

    # categories present in each country's Indeed file
    present = {}
    for c in SECTOR_COUNTRIES:
        s = pd.read_csv(IND_DIR / f"job_postings_by_sector_{c}.csv", usecols=["display_name"])
        present[c] = set(s["display_name"].unique())
    all_labels = set().union(*present.values())
    missing_rules = sorted(all_labels - set(CATEGORY_RULES))
    if missing_rules:
        raise ValueError(f"Indeed categories without a mapping rule: {missing_rules}")

    rows = []
    for cat, g in mapped.groupby("category"):
        w = g["employment"].astype(float)
        ms = g[g["ms_applicability"].notna()]
        ms_w = ms["employment"].astype(float)
        ms_exp = np.average(ms["ms_applicability"], weights=ms_w) if ms_w.sum() > 0 else np.nan
        aei_share = g["aei_global_share_pct"].sum(min_count=1)        # unpublished counts as zero here
        emp_share = g["employment_share_pct"].sum()
        top = g.sort_values("employment", ascending=False).head(3)
        rows.append({
            "category": cat,
            "in_indeed_countries": " ".join(c for c in SECTOR_COUNTRIES if cat in present[c]),
            "n_occupations": len(g),
            "employment": int(w.sum()),
            "employment_share_pct": round(100 * w.sum() / total_emp, 3),
            "ms_exposure": round(ms_exp, 4),
            "ms_coverage_pct": round(100 * ms_w.sum() / w.sum(), 1) if w.sum() > 0 else np.nan,
            "aei_usage_share_pct": round(aei_share, 3) if pd.notna(aei_share) else np.nan,
            "aei_usage_ratio": round(aei_share / emp_share, 4) if emp_share > 0 and pd.notna(aei_share) else np.nan,
            "aei_coverage_pct": round(100 * g.loc[g["aei_global_share_pct"].notna(), "employment"].sum()
                                      / w.sum(), 1) if w.sum() > 0 else np.nan,
            "largest_occupations": "; ".join(top["title"].str.slice(0, 40)),
            "soc_prefixes": " ".join(sorted(CATEGORY_RULES[cat])),
            "mapping_note": CATEGORY_NOTES.get(cat, ""),
        })
    ex = pd.DataFrame(rows)
    us = ex["in_indeed_countries"].str.contains(r"\bUS\b")
    ex["ms_rank_us"] = np.nan
    ex.loc[us, "ms_rank_us"] = ex.loc[us, "ms_exposure"].rank(ascending=False, method="first")
    n_us = int(us.sum())
    ex["ms_tercile_us"] = ""
    r = ex.loc[us, "ms_rank_us"]
    ex.loc[us & (ex["ms_rank_us"] <= np.ceil(n_us / 3)), "ms_tercile_us"] = "high"
    ex.loc[us & (ex["ms_rank_us"] > n_us - np.ceil(n_us / 3)), "ms_tercile_us"] = "low"
    ex.loc[us & (ex["ms_tercile_us"] == ""), "ms_tercile_us"] = "middle"
    ex = ex.sort_values("ms_exposure", ascending=False).reset_index(drop=True)
    ex.to_csv(OUT / "m3_category_exposure.csv", index=False)

    smap = occ[["soc", "title", "employment", "category", "matched_prefix", "ms_applicability",
                "aei_global_share_pct"]].copy()
    smap["category"] = smap["category"].fillna("(not mapped)")
    smap.sort_values(["category", "soc"]).to_csv(OUT / "m3_category_soc_map.csv", index=False)
    cover = 100 * mapped["employment"].sum() / total_emp
    print(f"  {len(ex)} categories, {len(mapped)} of {len(occ)} occupations mapped ({cover:.1f}% of employment)")
    print(ex[["category", "in_indeed_countries", "employment", "ms_exposure", "aei_usage_ratio"]].head(8).to_string(index=False))


# ---------------------------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------------------------
from scipy import stats  # noqa: E402

BTOS_FIRST = [202524, 202525, 202526]
BTOS_LAST = [202620, 202621, 202622, 202623]
SEED = 20261122


def is_multiunit(code):
    return code in ("XX", "XXX") or (len(code) == 3 and code.endswith("X"))


def load_btos_long():
    return {k: pd.read_csv(OUT / f"m3_btos_{k}.csv", dtype={"geo_code": str}) for k in BTOS_FILES}


def wide_series(df, qid, answer):
    """Group x period tables of estimates and standard errors for one question and answer."""
    d = df[(df["question_id"] == qid) & (df["answer"] == answer)]
    est = d.pivot(index=["geo_type", "geo_code", "geo_name"], columns="period", values="estimate_pct")
    se = d.pivot(index=["geo_type", "geo_code", "geo_name"], columns="period", values="se_pct")
    return est, se


def window_stat(est, se, periods):
    e = est.reindex(columns=periods)
    s = se.reindex(columns=periods)
    full = e.notna().all(axis=1)
    mean = e.mean(axis=1).where(full)
    sem = (np.sqrt((s ** 2).sum(axis=1)) / len(periods)).where(full)
    return mean, sem


def btos_adoption_summary(btos):
    rows = []
    for kind, df in btos.items():
        for qid in (7, 28):
            est, se = wide_series(df, qid, "Yes")
            f_m, f_s = window_stat(est, se, BTOS_FIRST)
            l_m, l_s = window_stat(est, se, BTOS_LAST)
            t = pd.DataFrame({"first3_mean": f_m, "first3_se": f_s, "last4_mean": l_m, "last4_se": l_s})
            t["latest_value"] = est.get(202623)
            t["latest_se"] = se.get(202623)
            t["periods_with_value"] = est.notna().sum(axis=1)
            t = t.reset_index()
            t["question_id"] = qid
            t["answer"] = "Yes"
            t["multi_unit_group"] = t["geo_code"].map(is_multiunit)
            ok = t["last4_mean"].notna() & ~t["multi_unit_group"]
            t["rank_last4"] = np.nan
            t.loc[ok, "rank_last4"] = t.loc[ok, "last4_mean"].rank(ascending=False, method="min")
            t["n_ranked"] = int(ok.sum())
            rows.append(t)
    out = pd.concat(rows, ignore_index=True)
    out["last4_ci_lo"] = out["last4_mean"] - 1.96 * out["last4_se"]
    out["last4_ci_hi"] = out["last4_mean"] + 1.96 * out["last4_se"]
    # The first and last windows are about a year apart, so the same firms can be in both; treating the two
    # estimates as independent overstates the standard error of the change (conservative).
    out["change_pp"] = out["last4_mean"] - out["first3_mean"]
    out["change_se"] = np.sqrt(out["last4_se"] ** 2 + out["first3_se"] ** 2)
    out["change_z"] = out["change_pp"] / out["change_se"]
    cols = ["geo_type", "geo_code", "geo_name", "multi_unit_group", "question_id", "answer", "periods_with_value",
            "first3_mean", "first3_se", "last4_mean", "last4_se", "last4_ci_lo", "last4_ci_hi", "latest_value",
            "latest_se", "change_pp", "change_se", "change_z", "rank_last4", "n_ranked"]
    out = out[cols].round(3)
    out.to_csv(OUT / "m3_btos_adoption_summary.csv", index=False)
    return out


def btos_dispersion(btos):
    rows = []
    for kind in ["sector", "subsector", "size", "state", "msa"]:
        df = btos[kind]
        est, se = wide_series(df, 7, "Yes")
        keep = [i for i in est.index if not is_multiunit(i[1])]
        est, se = est.loc[keep], se.loc[keep]
        for p in sorted(est.columns):
            e, s = est[p].dropna(), se[p].reindex(est[p].dropna().index)
            if len(e) < 5:
                continue
            var_obs = e.var(ddof=1)
            noise = (s ** 2).mean()
            rows.append({
                "geo_type": kind, "period": p, "n_groups": len(e), "mean": e.mean(), "sd": np.sqrt(var_obs),
                "min": e.min(), "max": e.max(), "p90_minus_p10": e.quantile(0.9) - e.quantile(0.1),
                "mean_se": np.sqrt(noise),
                "signal_sd": np.sqrt(max(var_obs - noise, 0.0)),
            })
    out = pd.DataFrame(rows)
    dates = pd.read_csv(OUT / "m3_btos_periods.csv")[["period", "ref_end"]]
    out = out.merge(dates, on="period", how="left").round(3)
    out.to_csv(OUT / "m3_btos_dispersion.csv", index=False)
    return out


def btos_trend(btos):
    nat = btos["national"]
    rows = []

    def add(series, stat, value, lo=np.nan, hi=np.nan, note=""):
        rows.append({"series": series, "statistic": stat, "value": value, "ci_lo": lo, "ci_hi": hi, "note": note})

    for qid, ans in [(7, "Yes"), (7, "No"), (7, "Do not know"), (28, "Yes"), (28, "No"), (28, "Do not know")]:
        d = nat[(nat["question_id"] == qid) & (nat["answer"] == ans)].sort_values("period")
        y = d["estimate_pct"].to_numpy()
        t = np.arange(len(y), dtype=float)
        res = sm.OLS(y, sm.add_constant(t)).fit(cov_type="HAC", cov_kwds={"maxlags": 2})
        name = f"Q{qid} {ans}"
        b = res.params[1]
        ci = res.conf_int()[1]
        add(name, "periods", len(y), note=f"{d['period'].min()} to {d['period'].max()}")
        add(name, "first_value_pct", y[0], note=str(d["period"].iloc[0]))
        add(name, "last_value_pct", y[-1], note=str(d["period"].iloc[-1]))
        add(name, "slope_pp_per_fortnight", b, ci[0], ci[1], "OLS on fortnight index, Newey-West (2 lags)")
        add(name, "slope_pp_per_year", b * 26, ci[0] * 26, ci[1] * 26, "26 fortnights")
        add(name, "r_squared", res.rsquared)
    # break in Q7 "Do not know" and "No" shares when Q8-Q10 appear (202622)
    for ans in ["Do not know", "No", "Yes"]:
        d = nat[(nat["question_id"] == 7) & (nat["answer"] == ans)].sort_values("period")
        a = d[d["period"] < 202622]["estimate_pct"]
        b2 = d[d["period"] >= 202622]["estimate_pct"]
        add(f"Q7 {ans}", "jump_at_202622_pp", b2.mean() - a.tail(4).mean(),
            note="mean of 202622-202623 minus mean of 202618-202621; descriptive, cause not stated in the files")
    # national standard errors before and after the switch
    s = nat[(nat["question_id"] == 7) & (nat["answer"] == "Yes")].sort_values("period")
    add("Q7 Yes", "mean_se_202524_202621", s[s["period"] < 202622]["se_pct"].mean())
    add("Q7 Yes", "mean_se_202622_202623", s[s["period"] >= 202622]["se_pct"].mean())
    out = pd.DataFrame(rows).round(4)
    out.to_csv(OUT / "m3_btos_trend.csv", index=False)
    return out


def btos_snapshot(btos):
    """Q8, Q9, Q10: two periods only (202622, 202623). Mean of the two, and the net balance for Q9 and Q10."""
    rows = []
    for kind, df in btos.items():
        if kind == "subsector":
            continue
        d = df[df["question_id"].isin([8, 9, 10])]
        for (code, name, qid, ans), g in d.groupby(["geo_code", "geo_name", "question_id", "answer"]):
            g = g.set_index("period")
            rows.append({"geo_type": kind, "geo_code": code, "geo_name": name, "question_id": qid, "answer": ans,
                         "n_periods": len(g), "mean_pct": g["estimate_pct"].mean(),
                         "se_pct": np.sqrt((g["se_pct"] ** 2).sum()) / len(g),
                         "est_202622": g["estimate_pct"].get(202622, np.nan),
                         "est_202623": g["estimate_pct"].get(202623, np.nan)})
    out = pd.DataFrame(rows)
    # net balance: Increased minus Decreased, both published for both periods
    net = []
    for (kind, code, name, qid), g in out[out["question_id"].isin([9, 10])].groupby(
            ["geo_type", "geo_code", "geo_name", "question_id"]):
        g = g.set_index("answer")
        if {"Increased", "Decreased"} <= set(g.index) and g.loc[["Increased", "Decreased"], "n_periods"].min() == 2:
            inc, dec = g.loc["Increased", "mean_pct"], g.loc["Decreased", "mean_pct"]
            # approximate standard error of a difference of two shares from one multinomial sample, using
            # the effective sample size implied by the published standard errors
            n_eff = []
            for a in ("Increased", "Decreased"):
                p = g.loc[a, "mean_pct"] / 100
                s = g.loc[a, "se_pct"] / 100
                if s > 0:
                    n_eff.append(p * (1 - p) / s ** 2)
            ne = np.mean(n_eff) if n_eff else np.nan
            p1, p2 = inc / 100, dec / 100
            se_net = 100 * np.sqrt(max(p1 + p2 - (p1 - p2) ** 2, 0) / ne) if ne == ne else np.nan
            net.append({"geo_type": kind, "geo_code": code, "geo_name": name, "question_id": qid,
                        "answer": "Net (increased minus decreased)", "n_periods": 2, "mean_pct": inc - dec,
                        "se_pct": se_net, "est_202622": g.loc["Increased", "est_202622"] - g.loc["Decreased", "est_202622"],
                        "est_202623": g.loc["Increased", "est_202623"] - g.loc["Decreased", "est_202623"]})
    out = pd.concat([out, pd.DataFrame(net)], ignore_index=True).round(3)
    out = out.sort_values(["geo_type", "geo_code", "question_id", "answer"])
    out.to_csv(OUT / "m3_btos_snapshot_employment.csv", index=False)
    return out


def indeed_us_change_by_category():
    """Mean US total-postings index, last three months, relative to the Jan-Oct 2022 baseline."""
    s = pd.read_csv(OUT / "m3_indeed_sector_monthly.csv")
    s = s[(s["country"] == "US") & (s["variable"] == "total")].pivot(index="category", columns="month",
                                                                   values="index_sa")
    base = s.loc[:, "2022-01":"2022-10"].mean(axis=1)
    last = s.loc[:, "2026-08":"2026-10"].mean(axis=1)
    return (100 * (last / base - 1)).rename("us_postings_change_pct")


def btos_sector_exposure(adopt):
    ex = pd.read_csv(OUT / "m3_category_exposure.csv").set_index("category")
    chg = indeed_us_change_by_category()
    sec = adopt[(adopt["geo_type"] == "sector") & (adopt["question_id"] == 7)].set_index("geo_code")
    rows = []
    for code, cats in SECTOR_CORE_CATEGORIES.items():
        e = ex.loc[cats]
        w = e["employment"].astype(float)
        us_cats = [c for c in cats if c in chg.index]
        row = {
            "sector_code": code, "sector_name": SECTOR_NAMES[code], "core_categories": "; ".join(cats),
            "ms_exposure": np.average(e["ms_exposure"], weights=w),
            "aei_usage_ratio": e["aei_usage_share_pct"].sum() / e["employment_share_pct"].sum(),
            "mapped_employment": int(w.sum()),
            "q7_first3": sec["first3_mean"].get(code), "q7_last4": sec["last4_mean"].get(code),
            "q7_last4_se": sec["last4_se"].get(code), "q7_change_pp": sec["change_pp"].get(code),
            "us_postings_change_pct_2026_vs_2022": (np.average(chg[us_cats], weights=ex.loc[us_cats, "employment"])
                                                    if us_cats else np.nan),
            "us_postings_categories_used": "; ".join(us_cats),
        }
        rows.append(row)
    out = pd.DataFrame(rows)
    out.round(4).to_csv(OUT / "m3_btos_sector_exposure.csv", index=False)
    # rank correlations
    corr = []
    ok = out.dropna(subset=["q7_last4"])
    for xname, yname in [("ms_exposure", "q7_last4"), ("aei_usage_ratio", "q7_last4"),
                         ("ms_exposure", "q7_change_pp"),
                         ("q7_last4", "us_postings_change_pct_2026_vs_2022")]:
        d = ok.dropna(subset=[xname, yname])
        if len(d) >= 5:
            r = stats.spearmanr(d[xname], d[yname])
            corr.append({"x": xname, "y": yname, "n_sectors": len(d), "spearman_rho": r.statistic,
                         "p_value": r.pvalue})
    pd.DataFrame(corr).round(4).to_csv(OUT / "m3_btos_exposure_correlation.csv", index=False)
    return out, pd.DataFrame(corr)


def part_ai_share():
    ai = pd.read_csv(OUT / "m3_indeed_ai_share_monthly.csv", usecols=["country", "month", "ai_share_pct"])
    agg = pd.read_csv(OUT / "m3_indeed_aggregate_monthly.csv")
    agg = agg[agg["variable"] == "total"][["area", "month", "index_sa"]].rename(
        columns={"area": "country", "index_sa": "total_postings_index"})
    d = ai.merge(agg, on=["country", "month"], how="left", validate="1:1")
    # AI postings relative to February 2020, using the Feb-2020 AI share as the base. Feb 2020 = 100.
    base = d[d["month"] == "2020-02"].set_index("country")["ai_share_pct"]
    d["ai_postings_index"] = d["ai_share_pct"] * d["total_postings_index"] / d["country"].map(base)
    rows = []
    for c, g in d.groupby("country"):
        g = g.sort_values("month").reset_index(drop=True)
        g["t"] = np.arange(len(g), dtype=float)

        def val(m, col="ai_share_pct"):
            r = g[g["month"] == m]
            return float(r[col].iloc[0]) if len(r) else np.nan

        pre = g[(g["month"] >= "2019-01") & (g["month"] <= "2022-10")]
        post = g[(g["month"] >= "2022-11")]
        gr = {}
        for name, sub in [("pre", pre), ("post", post)]:
            res = sm.OLS(np.log(sub["ai_share_pct"]), sm.add_constant(sub["t"])).fit(
                cov_type="HAC", cov_kwds={"maxlags": 6})
            b, ci = res.params["t"], res.conf_int().loc["t"]
            gr[name] = (100 * (np.exp(12 * b) - 1), 100 * (np.exp(12 * ci[0]) - 1), 100 * (np.exp(12 * ci[1]) - 1))
        rows.append({
            "country": c, "share_2019_mean_pct": g[g["month"].str.startswith("2019")]["ai_share_pct"].mean(),
            "share_2022_10_pct": val("2022-10"), "share_2023_10_pct": val("2023-10"),
            "share_2024_10_pct": val("2024-10"), "share_2025_10_pct": val("2025-10"),
            "share_2026_10_pct": val("2026-10"),
            "change_2022_10_to_2026_10_pp": val("2026-10") - val("2022-10"),
            "ratio_2026_10_to_2022_10": val("2026-10") / val("2022-10"),
            "total_postings_index_2022_10": val("2022-10", "total_postings_index"),
            "total_postings_index_2026_10": val("2026-10", "total_postings_index"),
            "ai_postings_index_2022_10": val("2022-10", "ai_postings_index"),
            "ai_postings_index_2026_10": val("2026-10", "ai_postings_index"),
            "ai_postings_ratio_2026_10_to_2022_10": val("2026-10", "ai_postings_index") / val("2022-10", "ai_postings_index"),
            "annual_growth_pre_pct": gr["pre"][0], "annual_growth_pre_lo": gr["pre"][1], "annual_growth_pre_hi": gr["pre"][2],
            "annual_growth_post_pct": gr["post"][0], "annual_growth_post_lo": gr["post"][1],
            "annual_growth_post_hi": gr["post"][2],
        })
    out = pd.DataFrame(rows)
    out["rank_share_2026_10"] = out["share_2026_10_pct"].rank(ascending=False, method="min")
    out["rank_ratio_to_2022_10"] = out["ratio_2026_10_to_2022_10"].rank(ascending=False, method="min")
    out = out.round(3)
    out.to_csv(OUT / "m3_indeed_ai_share_summary.csv", index=False)
    # month-level table for the site: share and AI postings index
    d[["country", "month", "ai_share_pct", "total_postings_index", "ai_postings_index"]].round(3).to_csv(
        OUT / "m3_indeed_ai_share_monthly.csv", index=False)
    return out


# --- event study -------------------------------------------------------------------------------
WINDOW = ("2021-01", "2026-10")
BASELINE = ("2022-01", "2022-10")
FIRST_POST = "2022-12"       # ChatGPT launched 2022-11-30; Nov 2022 is kept as a pre-period month
PLACEBO_BASELINE = ("2021-01", "2021-10")
PLACEBO_FIRST_POST = "2021-12"
PLACEBO_WINDOW = ("2021-01", "2022-10")
POST_WINDOWS = {
    "post_all": ("2022-12", "2026-10"),
    "year1_2022-12_to_2023-11": ("2022-12", "2023-11"),
    "year2_2023-12_to_2024-11": ("2023-12", "2024-11"),
    "year3_2024-12_to_2025-11": ("2024-12", "2025-11"),
    "year4_2025-12_to_2026-10": ("2025-12", "2026-10"),
}
TECH_CATEGORIES = ["Software Development", "IT Systems & Solutions", "IT Infrastructure, Operations & Support",
                   "Data & Analytics"]


def month_list(a, b):
    return [str(p) for p in pd.period_range(a, b, freq="M")]


def make_x(cats, exposure, kind):
    """Treatment variable for a set of categories. exposure: Series indexed by category.
    kind 'tercile': 1 for the top third, 0 for the bottom third, others NaN (dropped).
    kind 'continuous': z-score of the exposure (per 1 SD) across the given categories."""
    e = exposure.reindex(cats)
    if kind == "continuous":
        return (e - e.mean()) / e.std(ddof=0)
    order = sorted(cats, key=lambda c: (-e[c], c))     # ties broken by name, so the result is deterministic
    k = int(np.ceil(len(order) / 3))
    x = pd.Series(np.nan, index=cats)
    x[order[:k]] = 1.0
    x[order[len(order) - k:]] = 0.0
    return x


def event_matrix(panel, cats, months, base):
    wide = panel.pivot(index="category", columns="month", values="logidx").reindex(index=cats)[months]
    bm = wide[month_list(*base)].mean(axis=1)
    return wide.sub(bm, axis=0)


def fit_event_study(y, x, w=None):
    """Saturated event study: month dummies and month dummies x treatment, clustered by category."""
    ok = x.notna() & y.notna().all(axis=1)
    y, x = y[ok], x[ok]
    C, T = y.shape
    Y = y.to_numpy().reshape(-1)
    M = np.tile(np.eye(T), (C, 1))
    X = np.hstack([M, M * np.repeat(x.to_numpy(), T)[:, None]])
    groups = np.repeat(np.arange(C), T)
    if w is not None:
        mod = sm.WLS(Y, X, weights=np.repeat(w[ok].to_numpy(), T))
    else:
        mod = sm.OLS(Y, X)
    res = mod.fit(cov_type="cluster", cov_kwds={"groups": groups})
    beta = res.params[T:]
    V = res.cov_params()[T:, T:]
    return beta, V, C, list(y.columns), list(y.index), x


def contrast(beta, V, wvec, C):
    est = float(wvec @ beta)
    se = float(np.sqrt(max(wvec @ V @ wvec, 0.0)))
    q = stats.t.ppf(0.975, C - 1)
    return est, se, est - q * se, est + q * se


def pct(v):
    return 100 * (np.exp(v) - 1)


def window_weights(months, start, end):
    w = np.array([1.0 if start <= m <= end else 0.0 for m in months])
    return w / w.sum()


def pretrend_weights(months, start, end):
    idx = np.array([i for i, m in enumerate(months) if start <= m <= end])
    t = idx - idx.mean()
    w = np.zeros(len(months))
    w[idx] = t / (t ** 2).sum()
    return w


def trend_adjusted_weights(months, pre=("2021-01", "2022-10"), post=("2022-12", "2023-11")):
    """Contrast: mean post coefficient minus the mean of the line fitted to the pre-period coefficients and
    extended over the same post months (linear extrapolation of the pre-existing gap)."""
    idx_pre = np.array([i for i, m in enumerate(months) if pre[0] <= m <= pre[1]])
    idx_post = np.array([i for i, m in enumerate(months) if post[0] <= m <= post[1]])
    tbar = idx_pre.mean()
    sxx = ((idx_pre - tbar) ** 2).sum()
    w = np.zeros(len(months))
    w[idx_post] += 1.0 / len(idx_post)
    for s in idx_pre:
        w[s] -= np.mean(1.0 / len(idx_pre) + (idx_post - tbar) * (s - tbar) / sxx)
    return w


def permutation_p(ybar, x, rng, n=10000):
    """Two-sided permutation p-value for the cross-category slope of ybar on x."""
    ok = x.notna() & ybar.notna()
    yb, xv = ybar[ok].to_numpy(), x[ok].to_numpy()

    def slope(xx):
        xc = xx - xx.mean()
        return (xc * yb).sum() / (xc ** 2).sum()

    obs = slope(xv)
    count = 0
    for _ in range(n):
        if abs(slope(rng.permutation(xv))) >= abs(obs) - 1e-12:
            count += 1
    return (count + 1) / (n + 1)


def run_spec(panel, ex, country, spec, kind, measure, drop=(), weighted=False, placebo=False, variable="total",
             rng=None, loo=False):
    """Run one specification. Returns (coef rows, summary rows, group path rows, loo rows)."""
    base = PLACEBO_BASELINE if placebo else BASELINE
    first_post = PLACEBO_FIRST_POST if placebo else FIRST_POST
    win = PLACEBO_WINDOW if placebo else WINDOW
    months = month_list(*win)
    cats = sorted(c for c in panel["category"].unique() if c not in drop)
    expo = ex.set_index("category")[measure]
    cats = [c for c in cats if c in expo.index and expo[c] == expo[c]]
    expo = expo.reindex(cats)
    if measure == "aei_usage_ratio":                      # rank-based: the ratio is very skewed
        expo = expo.rank(method="average")
    x = make_x(cats, expo, kind)
    y = event_matrix(panel, cats, months, base)
    emp = ex.set_index("category")["employment"].astype(float).reindex(cats)
    beta, V, C, cols, kept, xk = fit_event_study(y, x, emp if weighted else None)
    n_hi = int((xk == 1).sum()) if kind == "tercile" else np.nan
    n_lo = int((xk == 0).sum()) if kind == "tercile" else np.nan
    coef_rows = []
    q = stats.t.ppf(0.975, C - 1)
    for i, m in enumerate(cols):
        b, s = beta[i], np.sqrt(V[i, i])
        coef_rows.append({"country": country, "spec": spec, "month": m, "coef_log": b, "se": s,
                          "ci_lo": b - q * s, "ci_hi": b + q * s, "pct": pct(b), "pct_lo": pct(b - q * s),
                          "pct_hi": pct(b + q * s)})
    sum_rows = []
    windows = {"placebo_post_2021-12_to_2022-10": ("2021-12", "2022-10")} if placebo else dict(POST_WINDOWS)
    if not placebo:
        windows["pre_2021-01_to_2021-12"] = ("2021-01", "2021-12")
    for name, (a, b) in windows.items():
        wv = window_weights(cols, a, b)
        est, se, lo, hi = contrast(beta, V, wv, C)
        sum_rows.append({"country": country, "spec": spec, "window": name, "estimate_log": est, "se": se,
                         "ci_lo_log": lo, "ci_hi_log": hi, "pct": pct(est), "pct_lo": pct(lo), "pct_hi": pct(hi),
                         "n_clusters": C, "n_high": n_hi, "n_low": n_lo, "perm_p": np.nan})
    if not placebo:
        wv = pretrend_weights(cols, "2021-01", "2022-10")
        est, se, lo, hi = contrast(beta, V, wv, C)
        sum_rows.append({"country": country, "spec": spec, "window": "pre_trend_slope_per_month_2021-01_to_2022-10",
                         "estimate_log": est, "se": se, "ci_lo_log": lo, "ci_hi_log": hi, "pct": pct(est),
                         "pct_lo": pct(lo), "pct_hi": pct(hi), "n_clusters": C, "n_high": n_hi, "n_low": n_lo,
                         "perm_p": np.nan})
        wv = trend_adjusted_weights(cols)
        est, se, lo, hi = contrast(beta, V, wv, C)
        sum_rows.append({"country": country, "spec": spec, "window": "year1_trend_adjusted_linear_extrapolation",
                         "estimate_log": est, "se": se, "ci_lo_log": lo, "ci_hi_log": hi, "pct": pct(est),
                         "pct_lo": pct(lo), "pct_hi": pct(hi), "n_clusters": C, "n_high": n_hi, "n_low": n_lo,
                         "perm_p": np.nan})
    if not placebo:
        # timing: how much of the gap opened before the launch (Jun to Nov 2022) and after it (Nov 2022 to Nov 2023)
        for name, (m_from, m_to) in {"change_2022-06_to_2022-11_before_launch": ("2022-06", "2022-11"),
                                     "change_2022-11_to_2023-11_after_launch": ("2022-11", "2023-11")}.items():
            wv = np.zeros(len(cols))
            wv[cols.index(m_to)] += 1.0
            wv[cols.index(m_from)] -= 1.0
            est, se, lo, hi = contrast(beta, V, wv, C)
            sum_rows.append({"country": country, "spec": spec, "window": name, "estimate_log": est, "se": se,
                             "ci_lo_log": lo, "ci_hi_log": hi, "pct": pct(est), "pct_lo": pct(lo),
                             "pct_hi": pct(hi), "n_clusters": C, "n_high": n_hi, "n_low": n_lo, "perm_p": np.nan})
    # permutation p-value for the average post (or placebo post) effect
    pw = "placebo_post_2021-12_to_2022-10" if placebo else "post_all"
    a, b = windows[pw]
    yk = y.loc[kept]
    ybar = yk[[m for m in cols if a <= m <= b]].mean(axis=1)
    if rng is not None and not weighted:
        p = permutation_p(ybar, xk, rng)
        for r in sum_rows:
            if r["window"] == pw:
                r["perm_p"] = p
    # group paths (US chart): geometric-mean postings index relative to the baseline (=100)
    path_rows = []
    if kind == "tercile" and not placebo:
        for g, val in (("high", 1.0), ("low", 0.0)):
            sel = [c for c in kept if xk[c] == val]
            path = np.exp(yk.loc[sel].mean(axis=0)) * 100
            for m, v in path.items():
                path_rows.append({"country": country, "spec": spec, "group": g, "month": m,
                                  "postings_index_baseline_100": v, "n_categories": len(sel)})
    # leave-one-category-out point estimates of the average post effect
    loo_rows = []
    if loo:
        a, b = POST_WINDOWS["post_all"]
        pm = [m for m in cols if a <= m <= b]
        yb = y.loc[kept][pm].mean(axis=1)
        for c in kept:
            if kind == "tercile" and np.isnan(xk[c]):
                continue
            sel = [k for k in kept if k != c and not np.isnan(xk[k])]
            xv, yv = xk[sel].to_numpy(), yb[sel].to_numpy()
            xc = xv - xv.mean()
            loo_rows.append({"country": country, "spec": spec, "dropped_category": c,
                             "estimate_log": (xc * yv).sum() / (xc ** 2).sum()})
    return coef_rows, sum_rows, path_rows, loo_rows


def run_boom_control(panel, ex, country, kind):
    """Cross-section of category means: average post outcome on exposure plus a control for the size of the
    2021-22 hiring boom (log of the Jan-Oct 2022 baseline index relative to February 2020). HC1 standard errors."""
    cats = sorted(panel["category"].unique())
    expo = ex.set_index("category")["ms_exposure"]
    cats = [c for c in cats if c in expo.index]
    x = make_x(cats, expo.reindex(cats), kind)
    y = event_matrix(panel, cats, month_list(*WINDOW), BASELINE)
    wide = panel.pivot(index="category", columns="month", values="logidx").reindex(cats)
    boom = wide[month_list(*BASELINE)].mean(axis=1)
    ok = x.notna()
    ybar = y.loc[ok, month_list(*POST_WINDOWS["post_all"])].mean(axis=1)
    X = pd.DataFrame({"x": x[ok], "boom_z": (boom[ok] - boom[ok].mean()) / boom[ok].std(ddof=0)})
    res = sm.OLS(ybar, sm.add_constant(X)).fit(cov_type="HC1")
    b, se = res.params["x"], res.bse["x"]
    q = stats.t.ppf(0.975, len(ybar) - 3)
    rho = stats.spearmanr(expo.reindex(cats)[ok], boom[ok]).statistic
    return {"country": country, "spec": f"{kind}_ms_boom_control", "window": "post_all", "estimate_log": b, "se": se,
            "ci_lo_log": b - q * se, "ci_hi_log": b + q * se, "pct": pct(b), "pct_lo": pct(b - q * se),
            "pct_hi": pct(b + q * se), "n_clusters": len(ybar),
            "note": (f"cross-section of category means, HC1 errors; control = baseline boom level "
                     f"(coefficient {pct(res.params['boom_z']):.1f}% per SD, rank correlation with exposure {rho:.2f})")}


def part_event_study():
    panel_all = pd.read_csv(OUT / "m3_indeed_sector_monthly.csv")
    panel_all["logidx"] = np.log(panel_all["index_sa"] / 100.0)
    ex = pd.read_csv(OUT / "m3_category_exposure.csv")
    rng = np.random.default_rng(SEED)
    coefs, sums, paths, loos = [], [], [], []

    def go(country, spec, kind, measure, **kw):
        variable = kw.pop("variable", "total")
        panel = panel_all[(panel_all["country"] == country) & (panel_all["variable"] == variable)]
        c, s, p, l = run_spec(panel, ex, country, spec, kind, measure, rng=rng, **kw)
        coefs.extend(c); sums.extend(s); paths.extend(p); loos.extend(l)

    for country in SECTOR_COUNTRIES:
        go(country, "tercile_ms", "tercile", "ms_exposure", loo=(country == "US"))
        go(country, "continuous_ms", "continuous", "ms_exposure", loo=(country == "US"))
        go(country, "tercile_aei_rank", "tercile", "aei_usage_ratio")
        go(country, "continuous_aei_rank", "continuous", "aei_usage_ratio")
        go(country, "tercile_ms_no_software", "tercile", "ms_exposure", drop=("Software Development",))
        go(country, "continuous_ms_no_software", "continuous", "ms_exposure", drop=("Software Development",))
        go(country, "tercile_ms_no_tech", "tercile", "ms_exposure", drop=tuple(TECH_CATEGORIES))
        go(country, "continuous_ms_no_tech", "continuous", "ms_exposure", drop=tuple(TECH_CATEGORIES))
        go(country, "continuous_ms_weighted", "continuous", "ms_exposure", weighted=True)
        go(country, "placebo_tercile_ms", "tercile", "ms_exposure", placebo=True)
        go(country, "placebo_continuous_ms", "continuous", "ms_exposure", placebo=True)
    boom_rows = []
    for country in SECTOR_COUNTRIES:
        pnl = panel_all[(panel_all["country"] == country) & (panel_all["variable"] == "total")]
        for kind in ("tercile", "continuous"):
            boom_rows.append(run_boom_control(pnl, ex, country, kind))
    # US new postings (flow of new listings)
    go("US", "tercile_ms_new_postings", "tercile", "ms_exposure", variable="new")
    go("US", "continuous_ms_new_postings", "continuous", "ms_exposure", variable="new")

    coef = pd.DataFrame(coefs)
    summ = pd.concat([pd.DataFrame(sums), pd.DataFrame(boom_rows)], ignore_index=True)
    path = pd.DataFrame(paths)
    loo = pd.DataFrame(loos)
    coef.round(4).to_csv(OUT / "m3_event_study_coefs.csv", index=False)
    # leave-one-out range goes into the summary file
    for (country, spec), g in loo.groupby(["country", "spec"]):
        lo_row, hi_row = g.loc[g["estimate_log"].idxmin()], g.loc[g["estimate_log"].idxmax()]
        for tag, r in (("min", lo_row), ("max", hi_row)):
            summ = pd.concat([summ, pd.DataFrame([{
                "country": country, "spec": spec, "window": f"post_all_leave_one_out_{tag}",
                "estimate_log": r["estimate_log"], "pct": pct(r["estimate_log"]),
                "note": f"drops {r['dropped_category']}"}])], ignore_index=True)
    summ = summ.round(4)
    summ.to_csv(OUT / "m3_event_study_summary.csv", index=False)
    path.round(3).to_csv(OUT / "m3_event_study_group_paths.csv", index=False)
    return coef, summ, path


def part_analysis():
    print("Analysis: BTOS")
    btos = load_btos_long()
    adopt = btos_adoption_summary(btos)
    btos_dispersion(btos)
    trend = btos_trend(btos)
    btos_snapshot(btos)
    out, corr = btos_sector_exposure(adopt)
    print(trend[trend["statistic"].isin(["first_value_pct", "last_value_pct", "slope_pp_per_year"])
                & trend["series"].isin(["Q7 Yes", "Q28 Yes"])].to_string(index=False))
    print(corr.to_string(index=False))
    print("Analysis: AI share")
    sh = part_ai_share()
    print(sh[["country", "share_2022_10_pct", "share_2026_10_pct", "ratio_2026_10_to_2022_10",
              "ai_postings_ratio_2026_10_to_2022_10"]].to_string(index=False))
    print("Analysis: event study")
    coef, summ, path = part_event_study()
    show = summ[(summ["country"] == "US") & (summ["spec"].isin(["tercile_ms", "continuous_ms"]))]
    print(show[["spec", "window", "pct", "pct_lo", "pct_hi", "perm_p", "n_clusters"]].to_string(index=False))


# PARTS_MARKER


if __name__ == "__main__":
    parts = sys.argv[1:] or ["btos", "indeed", "exposure", "analysis"]
    OUT.mkdir(parents=True, exist_ok=True)
    if "btos" in parts:
        part_btos()
    if "indeed" in parts:
        part_indeed()
    if "exposure" in parts:
        part_exposure()
    if "analysis" in parts:
        part_analysis()
