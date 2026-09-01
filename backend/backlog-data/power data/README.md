# Power Plant equipment Excel import

Drop these workbooks here, then run from `backend/`:

```bash
npm run db:import-power-xlsx
```

Expected filenames:

- `File for Electrical.xlsx` → dept `electrical`
- `File for Instrument.xlsx` → dept `instrument`
- `File for Instrument_2.xlsx` → dept `instrument2`

Each **sheet** = one equipment form (skip Index/Summary sheets).

Options:

```bash
npm run db:import-power-xlsx -- --dry-run
npm run db:import-power-xlsx -- --replace
npm run db:import-power-xlsx -- --file "./backlog-data/power data/File for Electrical.xlsx" --dept electrical
```
