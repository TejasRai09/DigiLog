# Purchy BI — Report Visual Mapping

Source: `Purchy Analysis Dashboard_v9.Report/definition/pages/`

## Page 1: Grower Performance: Year-wise Summary

**Page ID:** `8240f0caed002a90de2f`

### Layout (top → bottom)

1. **Title** — "Grower Performance: Year-wise Summary"
2. **Slicers (top-right)**
   - `Dim_Society.Society_Name` → React: `societyName` filter
   - `Grower_Summary_Sheet.Loyalty_Slicer ('20-'24)` → React: `loyaltySlicer` filter
3. **Summary matrix** — visual `4c82d99d42577c70bff9`
   - Rows: `Years.Year`
   - Values: 9 measures (see 01-semantic-model-analysis.md)
4. **Detail table** — visual `9ec96b301da2649d2f25` — "Current Sugar Season Data"
   - Columns: Grower_name_Key, Village_name_Key, Society Name, Total Bond, Indent QTY, Weight Qty 2025, Indent Failer QTY, Loyalty_Slicer

### Page-level filters

- **Exclude year 2020** from summary matrix (`Years.Year <> '2020'`)

### Interactions

- Summary matrix **cross-filters** detail table (`DataFilter` from `4c82d99d42577c70bff9` → `9ec96b301da2649d2f25`)
- v1: clicking a year row filters detail to growers with activity in that year (optional enhancement); default shows all filtered growers

### React mapping

| PBI | Component |
|-----|-----------|
| Slicers | `PurchyFilterBar` |
| Summary matrix | `PurchySummaryTable` |
| Detail table | `PurchyDetailTable` (grower-performance variant) |
| Page shell | `GrowerPerformanceTab` inside `PurchyAnalysisDashboard` |

---

## Page 2: Purchy Dishonour Analysis

**Page ID:** `560d82a845bb98fa6620`

### Layout (top → bottom)

1. **Title** — "Purchy Dishonour Analysis"
2. **KPI row (9 cards)**
   | Card | Measure |
   |------|---------|
   | Bonded_Growers | Bonded_Growers |
   | # Indent Purchy | 2025_Indent Count |
   | Indent Qty | 2025_Indent Qty |
   | # Supply Purchy | 2025_Supply Count |
   | Supply Qty | 2025_Supply Qty |
   | # Dishonour Purchy | 2025_Dishonour Count |
   | Dishonor % (Purchy Cnt) | 2025_Dishonour % (Count) |
   | Dishonour Qty | 2025_Dishonour Qty |
   | Dishonor % (Qty) | 2025_Dishonour % (Qty) |
3. **Slicers (6)**
   - FieldStaff_Mapping: Zone Head, Zonal Manager, Zonal Incharge, Village Staff
   - Grower_Summary_Sheet: Dishonour_Bucket, Loyalty_Slicer ('20-'24)
4. **Detail table** — visual `bad54c7129952c322745`
   - Columns: Society Name, Village_name_Key, Grower_name_Key, Village Staff, No of Purchy Indent, No of Indent Failer purchy, 2025_Supply Count, 2025_Indent Qty, 2025_Supply Qty, 2025_Dishonour Qty, 2025_Dishonour % (Qty)
   - **Sort:** 2025_Dishonour % (Qty) descending
5. **Footer note:** "Note: Indent - Supply + Failure because some purchys are still within the 5-day window."

### Page-level filters

- `No of Indent Failer purchy` IS NOT NULL (exclude null failure counts)

### React mapping

| PBI | Component |
|-----|-----------|
| KPI cards | `PurchyKpiGrid` |
| Slicers | `PurchyFilterBar` (dishonour variant) |
| Detail table | `PurchyDetailTable` (dishonour variant) |
| Page shell | `PurchyDishonourTab` |
