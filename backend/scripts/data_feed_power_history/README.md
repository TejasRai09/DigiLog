# Power Plant Equipment History (new) — data feed

JSON feed files for loading into `ppn_*` tables via:

```bash
cd DigiLog/backend
npm run db:import-ppn-feed
```

## Feed file location

Place one or more `.json` files here:

- `feed-data/power_plant_feed.json` — primary feed (recommended)
- or any `feed-data/*.json`

## Equipment record format

```json
{
  "equipment": [
    {
      "hierarchy_name": "ID Fan -1",
      "hierarchy_card": "ID Fan -01",
      "image_name": "Induced Draft Fan No. 1",
      "name": "ID Fan -1",
      "equip_no": "",
      "tag_name": "IDF-01",
      "category": "150TPH BLR",
      "subcategory": "Auxiliary Equipment",
      "location": "POWER PLANT",
      "commissioned": "05.11.2015",
      "drive": "Motor driven",
      "specs": [
        {
          "lbl": "Make",
          "val": "Example OEM",
          "section": "mechanical",
          "sub_section": "Rotor & Frame"
        },
        {
          "lbl": "Foundation Grade",
          "val": "M30",
          "section": "civil"
        },
        {
          "lbl": "Control Cable",
          "val": "4CX1.5 mm2",
          "section": "instrument"
        },
        {
          "lbl": "Rated Power",
          "val": "500 KW",
          "section": "electrical"
        },
        {
          "lbl": "Serial No.",
          "val": "ABC-123"
        }
      ],
      "schedule": [
        {
          "no": 1,
          "comp": "Bearing",
          "act": "Inspect and lubricate",
          "iv_W": "X",
          "iv_M": "X",
          "iv_Q": null,
          "iv_H": "X",
          "iv_Y": null,
          "iv_T": "X",
          "iv_3Y": null
        }
      ],
      "history": [
        {
          "season": "Off-Season",
          "year": "2024",
          "obs": "Bearing noise observed",
          "act": "Replaced bearing",
          "cost": "15000",
          "svc": "Internal",
          "provider": "Maintenance team",
          "resp": "Shift engineer"
        }
      ]
    }
  ]
}
```

You may also pass a plain array `[ { ... }, ... ]` instead of `{ "equipment": [...] }`.

## Hierarchy name vs image name

**Rule for every new feed:** map each life-history card to the correct **hierarchy card** in `powerPlantEquipmentHierarchy.js`. Store the hierarchy name in the DB — **not** the long title from the image.

| Feed field | Purpose |
|------------|---------|
| `hierarchy_name` or `lookup_name` | Stored in `ppn_equipment.name` — must match hierarchy `lookupName` or card `name` |
| `name` | Alias for `hierarchy_name` if the latter is omitted |
| `hierarchy_card` | **Required for traceability** — exact UI card label (e.g. `Extraction QCNRV-2`) |
| `image_name` | Official title from the paper/Excel card (not stored in DB) |
| `equip_no` / `tag_name` | From the card when present; also add `equipNo` on the hierarchy leaf when available |

### Feeding checklist (upcoming cards)

1. Open `frontend/src/config/powerPlantEquipmentHierarchy.js` and find the target card path (e.g. `30.85MW STG → Turbine → Extraction QCNRV-2`).
2. Set `hierarchy_name` = hierarchy `lookupName` if set, otherwise the card display `name`.
3. Set `hierarchy_card` = the display label on that card.
4. Set `image_name` = the **NAME OF EQUIPMENT** line from the scanned card.
5. Set `category` / `subcategory` from the hierarchy path (parent groups).
6. Use `actions: [...]` arrays for OEM schedule bullets (not one semicolon string).
7. Import with `--replace` if updating an existing `equip_no` or name.
8. After import, the script prints **Hierarchy locations** — where to open each card in the app.

Optional: set `hierarchy_path` explicitly if category/subcategory/card is not enough:

```json
"hierarchy_path": "Power Plant > 30.85MW STG > Turbine > Extraction QCNRV-2"
```

**Example:** card image title `30.85 MW Turbine Extraction Condensing Cum Bleed` (`ZIL/GSM/PP/01`) belongs on **Extraction QCNRV-2**, not Gearbox:

```json
{
  "hierarchy_name": "Extraction QCNRV-2",
  "hierarchy_card": "Extraction QCNRV-2",
  "image_name": "30.85 MW Turbine Extraction Condensing Cum Bleed",
  "equip_no": "ZIL/GSM/PP/01",
  "category": "30.85MW STG",
  "subcategory": "Turbine"
}
```

## Specification sections

| `section` value | UI tab |
|-----------------|--------|
| `mechanical` | 1. Mechanical |
| `civil` | 2. Civil |
| `instrument` | 3. Instrument |
| `electrical` | 4. Electrical |

Aliases accepted: `discipline`, `spec_section`, `specSection`.

If `section` is **not** set on a spec row, it is stored under **mechanical** (default).

**Do not infer** civil / instrument / electrical from the spec label (e.g. “Rated Voltage” stays **mechanical** unless the scanned card explicitly shows a discipline column or section header). Only set `section` when the photo/card clearly names it.

`sub_section` aliases: `subSection`, `subsection`. Defaults to `General` when omitted.

### OEM schedule action bullets

Use an **`actions` array** for multiple bullet points per component. On import they are stored as `act` joined with ` || `.

Semicolon-separated `act` strings are also split automatically (e.g. `step one; step two`).

## Commands

```bash
# Preview counts (no DB writes)
npm run db:import-ppn-feed -- --dry-run

# Import feed-data/power_plant_feed.json
npm run db:import-ppn-feed

# Replace existing matched equipment
npm run db:import-ppn-feed -- --replace

# Import a specific file
npm run db:import-ppn-feed -- --file scripts/data_feed_power_history/feed-data/my_feed.json

# Import legacy repo-root power_data.json shape
npm run db:import-ppn-feed -- --file ../../../power_data.json --legacy --replace
```

## Matching / replace

Existing `ppn_equipment` rows are matched (dept = `plant`) by:

1. `equip_no`
2. `tag_name` (also checks legacy tag stored in `equip_no`)
3. `name`

Use `--replace` to delete and re-import when a match exists. Without `--replace`, duplicates are skipped.

## Clear before re-import

```bash
npm run db:clear-power-equipment-new
```
