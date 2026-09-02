# Production equipment history extract

Extract workbooks and import into DigiLog (`phn_*` tables).

## Pan & crystallizer

Source: `production equipments hisotoru files/DS PAN & CRYSTALLIZER HISTORY RECORD_1.xlsx`

| File | Contents |
|------|----------|
| `ds-pan-crystallizer-equipment-history.xlsx` | Equipment list, specifications, maintenance actions |
| `ds-pan-crystallizer-equipment-history.json` | Same data as JSON |

```bash
node scripts/extract-pan-crystallizer-history.js
```

32 cards. Specs include compartment columns on B Vertical CVP flattened as extra rows. History is Season / Off-Season + year + action (`OFF SESON` / `SESON` normalised). Nine sheets are specs-only.

## Evaporation

Source: `DS Evaporation  history record_2.xlsx` (workspace root; two spaces in the filename)

| File | Contents |
|------|----------|
| `ds-evaporation-equipment-history.xlsx` | Equipment list, specifications, maintenance actions |
| `ds-evaporation-equipment-history.json` | Same data as JSON |
| `ds-evaporation-extract-audit.xlsx` | Per-sheet inventory, empty values, duplicate SN, issues, history by year |

```bash
node scripts/extract-evaporation-history.js
```

31 cards (juice heaters, Semi Kestner, vapour cell, FFE, quad bodies, condensers, DCH).

- Specs are SN / parameter / value. UOM is usually inside the value (`4000 mm`, `372m2`).
- Source history is **YEAR / WORK DONE** only (no Off-Season heading). Actions are recorded as Off-Season.
- Duplicate SN on FFE / vapour-cell pump rows is kept as separate spec lines.
- `CONDENSOR-C` title in the source is “EVAPORATOR SET-A CONDENSER”; flagged in the audit.
- 13 equipment have history (39 actions). 18 are specs-only.

## Clarification

Source: `DS clarification  history record_4.xlsx` (workspace root; two spaces in the filename)

| File | Contents |
|------|----------|
| `ds-clarification-equipment-history.xlsx` | Equipment list, specifications, maintenance actions |
| `ds-clarification-equipment-history.json` | Same data as JSON |
| `ds-clarification-extract-audit.xlsx` | Per-sheet inventory, empty values, duplicate SN, issues, history by year |

```bash
node scripts/extract-clarification-history.js
```

25 cards (air blowers, sulphur furnaces, juice/syrup sulphiters, MOL, Dorr clarifier, RVFs, tanks, vacuum pumps, bagacillo, decanter).

- One card per source sheet. Sub-equipment (pumps, tanks, drives) is prefixed onto the parameter name.
- History is OFF SEASON / YEAR / WORK DONE. Actions recorded as Off-Season.
- Specs after a history block (SF1 WHRS, Dorr clear-juice pumps) are included.
- Air-line / WHRS sketch cells are skipped and flagged in the audit.
- 10 equipment have history (36 actions). 15 are specs-only.

## Centrifugal / drier house

Source: `DS Centrifugal Drier House History Record_3.xlsx`

| File | Contents |
|------|----------|
| `ds-centrifugal-drier-equipment-history.xlsx` | Equipment list, specifications, maintenance actions |
| `ds-centrifugal-drier-equipment-history.json` | Same data as JSON |
| `ds-centrifugal-drier-extract-audit.xlsx` | Per-sheet inventory, empty values, duplicate SN, issues, history by year |

```bash
node scripts/extract-centrifugal-drier-history.js
```

58 cards (batch/continuous centrifugals, pugmills, magma mixers, melters, hoppers, elevators, grader, conveyors, dust collector, transient heater, spray pond, injection/spray pumps).

- Spec table usually starts at column B (`SN | Particular | Detail`). Years often sit in column A.
- Basket hole / CSA **right-hand tables** on conti machines are **not** extracted. Specs come from the left SN / Particular / Detail table only.
- Dust collector, spray pond, and transient heater sheets are mostly drawings; flagged in the audit.
- 5 equipment have history (17 actions, including two year-only rows with no work text). Most sheets are specs-only.

## Import into DigiLog

Tables: `phn_equipment`, `phn_specs`, `phn_history` (no OEM schedule).

```bash
cd backend
npm run db:apply-sql -- ../mysql/migrate_add_production_house_equipment_tables.sql
npm run db:apply-sql -- ../mysql/migrate_production_house_equipment_hub.sql
node seed.js
npm run db:import-production-house-history:replace
```

Forms Hub app: **Production House Equipment History** → `/production-house-equipment` (`digilog_hub_production_equipment`).

Re-extract then re-import after source workbook changes:

```bash
node scripts/extract-pan-crystallizer-history.js
node scripts/extract-evaporation-history.js
node scripts/extract-clarification-history.js
node scripts/extract-centrifugal-drier-history.js
npm run db:import-production-house-history:replace
```

