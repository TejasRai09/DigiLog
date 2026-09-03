# Migration files — 24-08-26

DS House / Refinery Electrical sugar equipment cards.

## PCC PANEL & Transformer

| File | Purpose |
|------|---------|
| `1_DS Equipment Life History - PCC PANEL & Transformer.xlsx` | Original source |
| `ds-pcc-panel-transformer-equipment-history-240826.xlsx` | Import workbook |
| `ds-pcc-panel-transformer-extract-audit-240826.xlsx` | Audit |

```bash
npm run db:import-shn-electrical-pcc-240826:hierarchy
npm run db:import-shn-electrical-pcc-240826:history
```

## Motors

| File | Purpose |
|------|---------|
| `2_DS Electrical Equipment Life History -MOTORS.xlsx` | Original source |
| `ds-motors-equipment-history-240826.xlsx` | Import workbook |
| `ds-motors-extract-audit-240826.xlsx` | Audit |

Match: **tag**, then **Sub Equipment** (shared tags).

```bash
npm run db:import-shn-electrical-motors-240826:hierarchy
npm run db:import-shn-electrical-motors-240826:history
```

## Refinery (`3_Final Ref_with_tags.xlsx`)

| File | Purpose |
|------|---------|
| `3_Final Ref_with_tags.xlsx` | Original source |
| `ds-refinery-electrical-equipment-history-240826.xlsx` | Import workbook (Hierarchy + cards) |
| `ds-refinery-electrical-extract-audit-240826.xlsx` | Audit |

Match: **tag** (incl. `REF.` vs `REF/` loose form), then **Sub Equipment** name when tags collide or disagree. Duplicate Sub Equipment names (e.g. Distributor Motor-1 ×2) are split by tag suffix / sheet number. Empty data sheets stay hierarchy-only.

```bash
npm run db:import-shn-electrical-refinery-240826:hierarchy
npm run db:import-shn-electrical-refinery-240826:history
```

Re-extract: `py -3 DigiLog/scripts/extract_ds_refinery_electrical.py`

## Turbine & Instrument (yellow rows only)

Hierarchy = **only the yellow-highlighted rows** of `Plant Instrument Equipment
List-21-08-2026.xlsx` (51 rows). Data = every multi-card sheet in
`Turbine & Instrument Equipment life histroy 20-06-2026 (2).xlsx`.

| File | Purpose |
|------|---------|
| `Turbine & Instrument Equipment life histroy 20-06-2026 (2).xlsx` | Copy of original source |
| `yellow-instrument-turbine-equipment-history-260826.xlsx` | Import workbook (Hierarchy + Sheet Map + cards) |
| `yellow-instrument-turbine-extract-audit-260826.xlsx` | Audit |

Match: **tag only** (exact, then punctuation-loose). None of the 51 yellow
rows share a tag, and the cards' `NAME OF EQUIPMENT` is a generic term
("Control valve", "Flow meter", ...), so name-based fallback is intentionally
**not** used here — it produced false matches (e.g. a generic "Control valve"
card matching a UPS hierarchy row) when tried. All 51/51 rows matched purely
by exact tag, verified against the raw source cells.

Result: **51 / 51 yellow hierarchy rows have data** in this file (1,112 spec
rows, 901 schedule rows, 351 history rows across 51 cards). 484 other cards
in the data file are not in the yellow set — listed in the audit's
"Cards not in hierarchy" sheet.

Re-extract: `py -3 DigiLog/scripts/extract_turbine_instrument_life_history.py`

### Patch: 43 Instrument tags (OEM schedule + 3 SCVS full cards)

Some control-valve cards had specs/history but **no OEM schedule** because the
extractor rejected `Sr. No.` / `SrNo.` headers (fixed in
`DigiLog/scripts/equipment_history_extract_lib.py`). The 3 SCVS UPS tags also
needed full specs + history from `UPS HISTORY`.

```bash
# From DigiLog/backend/ with DATABASE_URL = production

# 0) Deploy code that includes the Sr.No. header fix

# 1) Ensure SCVS hierarchy leaves exist (safe to re-run; skips existing)
npm run db:add-scvs-ups-hierarchy

# 2) Extract from Turbine & Instrument source workbook
npm run db:patch-43-instrument-tags:extract

# 3) Dry-run, then import
npm run db:patch-43-instrument-tags:dry-run
npm run db:patch-43-instrument-tags:import
```

Requires source file:
`backlog-data/mill data/migration files-24-08-26/Turbine & Instrument Equipment life histroy 20-06-2026 (2).xlsx`

### Import into the app

Hierarchy import reuses the generic (discipline-agnostic) tree importer.
History import uses a **dedicated** script,
`import-shn-instrument-turbine-life-history.js`, because this workbook mixes
disciplines row-by-row: 5 of the 51 rows are steam turbines (mechanical
equipment, `POWER HOUSE` / `MILL HOUSE`), the other 46 are real instrument
field devices — the plain electrical/mechanical/instrument importers each
hardcode one section, which would mislabel one side or the other. This
script reads each card's own `Department` column (from the Hierarchy sheet,
carried onto every `EQUIPMENT LIFE HISTORY CARD` row) and tags that card's
specs / schedule / history — including the `equipment_refs` JSON column,
which is what the frontend's discipline tab actually filters on — with
`mechanical` or `instrument` accordingly.

```bash
npm run db:import-shn-yellow-instrument-turbine-260826:hierarchy
npm run db:import-shn-yellow-instrument-turbine-260826:history
```

Result (26-08-26): 51/51 cards imported, 0 orphans (all linked to a
hierarchy leaf), 23 existing `shn_equipment` rows replaced + 28 newly
created, 1,112 specs / 415 schedule rows / 351 history rows.

Note: several tags in this corner of the tree (`RAW PAN` / `REFINERY PAN`
groups especially) already had duplicate/mislabeled hierarchy leaves and
`shn_equipment` rows from earlier, unrelated imports (predating this
24-08-26 batch). When re-running the generic hierarchy importer against a
new workbook here, always diff `shn_hierarchy_node` before/after by
`created_at` and check for a same-tag sibling under the *same* parent before
trusting its `shn_equip_id` auto-link (it falls back to a bare name match,
which can attach the wrong equipment) — don't assume dedupe caught
everything just because the run exited cleanly.

## Notes

- Import hierarchy **before** history for each workbook.
- Electrical history import links leaves by tag (+ Sub Equipment when tags collide).
- **Combined electrical extract audit:** `electrical-extract-audit-summary-240826.xlsx`
- **Yellow instrument tags vs Sugar DB:** `yellow-instrument-tags-sugar-audit-250826.xlsx`
  (Hierarchy + data / Hierarchy only / Data only / Nothing — checked against
  the live database, from an older version of the Turbine & Instrument file)
