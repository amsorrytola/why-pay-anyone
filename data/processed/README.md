# Processed tables

Small derived tables the analysis and the website read. Each is built by a script in `pipeline/` from the raw files listed in `../SOURCES.md`.

## occupations.csv
Built by `pipeline/build_occupations.py`. One row per detailed occupation (830, SOC 2018) in the BLS May 2025 national OEWS file.

| Column | Meaning | Source |
|---|---|---|
| `soc`, `title` | 6-digit SOC code and occupation title | BLS OEWS |
| `employment` | US employment, May 2025 | BLS OEWS |
| `hourly_mean`, `annual_mean`, `annual_median` | Mean hourly wage, mean and median annual wage (US dollars); empty where BLS suppresses | BLS OEWS |
| `wage_bill` | `employment` × `annual_mean` | derived |
| `employment_share_pct` | Share of total employment in the 830 occupations, percent | derived |
| `ms_applicability` | Microsoft AI applicability score (0 to 1 scale as published), from Bing Copilot use, Jan–Sep 2024; empty for 47 occupations | Microsoft "Working with AI" |
| `aei_global_share_pct` | Occupation's share of worldwide Claude.ai usage, mean of April and May 2026, percent. Empty means not published, not zero | Anthropic Economic Index |
| `aei_india_share_pct` | Same for India. Empty means not published | Anthropic Economic Index |
| `aei_usage_ratio` | `aei_global_share_pct` ÷ `employment_share_pct`: usage share relative to the occupation's weight in US employment. Descriptive, mixes worldwide usage with US employment | derived |
| `aei_automation_pct`, `aei_augmentation_pct` | Share of the occupation's conversations coded as automation or augmentation, usage-weighted, worldwide | Anthropic Economic Index |
| `aei_ai_autonomy` | Mean degree of AI autonomy (1 to 5) | Anthropic Economic Index |
| `aei_human_only_hours`, `aei_with_ai_minutes`, `aei_speedup` | Estimated time for a human alone (hours), with AI (minutes), and the ratio (human-only minutes ÷ with-AI minutes). These are model-estimated, not measured | Anthropic Economic Index |
| `aei_work_use_pct` | Share of conversations coded as work use | Anthropic Economic Index |

The Economic Index codes are O*NET-SOC (8 digits); the first 7 characters give the 6-digit SOC. Where several O*NET codes share one SOC, shares are summed and metrics are averaged weighted by usage share.
