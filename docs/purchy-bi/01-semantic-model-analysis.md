# Purchy BI — Semantic Model Analysis (Pages 1–2)

Source: `Purchy Analysis Dashboard_v9.SemanticModel/definition/`

## Tables in scope

### Grower_Summary_Sheet (core fact)
- **Source:** `Grower Details Season 2025-2026.xlsx` → sheet `Grower  Wise summary `
- **Grain:** one row per Village Code + Grower Code (deduped in Power Query)
- **MySQL:** `purchy_grower_summary`

Key source columns used by the two pages:
| PBI column | Usage |
|------------|-------|
| Village Code, Grower Code | Keys, grower_key |
| Grower Name, Village Name, Society Name | Labels / slicers |
| Total Bond, Indent QTY, Weight Qty 2025 | Detail table |
| No of Purchy Indent, No of Indent Failer purchy | Page 2 detail + page filter |
| Indent Failer QTY | Detail + dishonour_bucket |
| Supply 2020–2024, bond2021–bond2024, issue21–issue24, wt21–wt24 | Year-wise measures |
| No of Purchy Indent (2025) | `# of Growers with Indent` for 2025 |

**Calculated columns (recreated in SQL view):**
| Column | DAX logic |
|--------|-----------|
| Grower_Key | `[Village Code] & "-" & [Grower Code]` |
| Grower_name_Key | `[Village Code] & "-" & [Grower Code] & "-" & [Grower Name]` |
| Village_name_Key | `[Village Code] & "-" & [Village Name]` |
| Loyalty_Slicer ('20-'24) | Count years supplied 2020–2024 → 0–5 label |
| Dishonour_Bucket | Failure % bands from Indent Failer QTY / Indent QTY |

### Grower_Purchywise_Indent
- **Sheet:** `Grower Purchy wise Indent`
- **MySQL:** `purchy_indent`
- **Grain:** one purchy indent row
- **Join:** `grower_key` → summary; `societypurchy_no` → supply/dishonour

### Grower_Purchywise_Supply
- **Sheet:** `Grower Indent Purchy wise suppl`
- **MySQL:** `purchy_supply`

### Grower_Purchywise_Dishonour
- **Sheet:** `Grower Purchy wise Indent Faile`
- **MySQL:** `purchy_dishonour`

### FieldStaff_Mapping
- **Source:** `Staff wise Bonding target.xlsx` → sheet `Main`
- **MySQL:** `purchy_field_staff`
- **Join:** `village_code` ↔ summary (bothDirections in PBI)

### Years (calculated dimension)
- Static: 2020–2025
- **MySQL:** `purchy_years`

### Dim_Society
- Calculated from ERP_data in full model; **v1 uses `Society Name` from grower summary** for the Society slicer.

## Relationships used (from relationships.tmdl)

```
Grower_Summary_Sheet.Village Code  ↔  FieldStaff_Mapping.Village Code  (bothDirections)
Grower_Purchywise_Indent.Grower_Key  →  Grower_Summary_Sheet.Grower_Key
Grower_Purchywise_Indent.societypurchyNo  →  Grower_Purchywise_Supply.SocietyPurchyNo  (1:1, bothDirections)
Grower_Purchywise_Indent.societypurchyNo  →  Grower_Purchywise_Dishonour.Society Purchy No  (bothDirections)
Grower_Summary_Sheet.Society Code  →  Dim_Society.Society_Code  (page 1 slicer — use summary.society_name in v1)
```

## Measures in scope

### Page 1 — Year-wise matrix (per Years[Year], exclude 2020 on page)

| Measure | Base logic |
|---------|------------|
| Ttl_Growers with Bond | COUNT rows where year-specific bond > 0 |
| # of Growers with Indent | COUNT rows where year-specific issue count > 0 |
| # of Growers Supplied | COUNT rows where year-specific supply > 0 (2025: Weight Qty 2025 > 0) |
| Ttl_Bond | SUM year-specific bond column |
| Supply Qty by Year | SUM year supply; 2025 uses 2025_Supply Qty measure |
| Supply vs Bond % | Supply Qty by Year / Ttl_Bond |
| Issued Purchy (cnt) | SUM issue## per year; 2025 = 2025_Indent Count |
| Weighted Purchy (cnt) | SUM wt## per year; 2025 = 2025_Supply Count |
| Purchy Dishonour (cnt) % | (Issued - Weighted) / Issued |

### Page 1 — 2025 transaction measures (embedded in year SWITCH)

| Measure | DAX |
|---------|-----|
| 2025_Indent Count | COUNTROWS indent where RELATED summary Grower_Key not blank |
| 2025_Supply Count | COUNTROWS supply |
| 2025_Supply Qty | SUM supply purchasemodeqty |

### Page 2 — KPI cards

| Measure | DAX |
|---------|-----|
| Bonded_Growers | COUNTROWS(Grower_Summary_Sheet) |
| 2025_Indent Count | Same as above |
| 2025_Indent Qty | SUM indent supllymodeqty (filtered via summary) |
| 2025_Supply Count / Qty | Transaction counts/sums |
| 2025_Dishonour Count | COUNTROWS dishonour (linked to summary) |
| 2025_Dishonour % (Count) | Dishonour Count / Indent Count |
| 2025_Dishonour Qty | SUM dishonour Mode QTY |
| 2025_Dishonour % (Qty) | Dishonour Qty / Indent Qty |

## Out of scope (v1)

Plot_Survey, ERP_data, Dim_Grower/Village, map pages, drilldown pages, insight narrative measures.
