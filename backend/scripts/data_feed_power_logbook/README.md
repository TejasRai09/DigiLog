# Power Logbook data feed

Imports **Power Details**, **Steam Details**, and **Stoppage Details** into:

| File | Table | Form key |
|------|-------|----------|
| `power_details.csv` / `.xlsx` | `ph_power` | `ph_power` |
| `steam_details.csv` / `.xlsx` | `ph_steam` | `ph_steam` |
| `stoppage_details.csv` / `.xlsx` | `ph_stoppage` | `ph_stoppage` |

## CSV format

- Semicolon (`;`) delimiter
- First row = MySQL column names (e.g. `Date`, `Time`, `Crush`, …)
- Quoted fields may contain newlines
- Same layout as `backlog-data/power data/*.csv`

## Excel format (.xlsx / .xls)

- **Single form file:** one sheet with row 1 = DB column names (same columns as CSV)
- **Combined workbook:** multiple sheets named e.g. `Power`, `Steam`, `Stoppage` (or `power_details`, etc.) — each sheet imports to its table
- Excel date/time cells are converted automatically

## JSON format

```json
{
  "power": [
    { "Date": "2023-11-16", "Time": "2023-11-17 15:32:00", "Crush": 10000 }
  ],
  "steam": [],
  "stoppage": []
}
```

## Usage

From `DigiLog/backend`:

```bash
# Import ALL .xlsx files in feed-data/ (and uploads/backlog fallbacks)
npm run db:import-power-logbook:xlsx-all
npm run db:import-power-logbook:xlsx-all:truncate
npm run db:import-power-logbook:xlsx-all -- --dry-run
npm run db:import-power-logbook:xlsx-all -- --scan-uploads
npm run db:import-power-logbook:xlsx-all -- --dir uploads/data-ingestion

# CSV / single-file import (original script)
npm run db:import-power-logbook
npm run db:import-power-logbook:truncate
npm run db:import-power-logbook -- --dry-run
npm run db:import-power-logbook -- --form power
npm run db:import-power-logbook -- --form steam --file backlog-data/power\ data/steam_details.csv
npm run db:import-power-logbook -- --file scripts/data_feed_power_logbook/feed-data/power_details.xlsx
npm run db:import-power-logbook -- --file path/to/power_logbook_all.xlsx
npm run db:import-power-logbook -- --file scripts/data_feed_power_logbook/feed-data/my_feed.json
```

## Place feed files

1. **Preferred:** `scripts/data_feed_power_logbook/feed-data/` — drop all power logbook `.xlsx` files here, then run `npm run db:import-power-logbook:xlsx-all`
2. **Uploads:** `uploads/data-ingestion/` — use `--scan-uploads` or `--dir` (filename must contain power/steam/stoppage)
3. **Fallback CSV:** `backlog-data/power data/` — used by the original `db:import-power-logbook` script
