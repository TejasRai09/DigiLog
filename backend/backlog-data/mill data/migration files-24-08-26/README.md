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

## Notes

- Import hierarchy **before** history for each workbook.
- Electrical history import links leaves by tag (+ Sub Equipment when tags collide).
