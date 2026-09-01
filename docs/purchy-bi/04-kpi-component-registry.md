# Purchy BI — KPI & Component Registry

Final mapping of Power BI measures/columns to SQL, API endpoints, and React components.

## Shared infrastructure

| Concern | Implementation |
|---------|----------------|
| Filter params | `purchyFilterBuilder.js` → `buildFilterContext()` |
| Filter state | `usePurchyFilters()` hook |
| Slicer UI | `PurchyFilterBar` |
| Page shell | `PurchyAnalysisDashboard.jsx` |
| Access gate | `bi_purchy_analysis` form key |

---

## Page 1 — Grower Performance: Year-wise Summary

### Slicers

| UI label | PBI field | Query param | API source | Component |
|----------|-----------|-------------|------------|-----------|
| Society | `Dim_Society.Society_Name` / `Society Name` | `societyName` | `GET /api/bi/purchy/filters` | `PurchyFilterBar` |
| Loyalty | `Grower_Summary_Sheet.Loyalty_Slicer` | `loyaltySlicer` | `GET /api/bi/purchy/filters` | `PurchyFilterBar` |

### Summary matrix (per `Years.Year`, 2020 hidden)

| Display name | PBI measure | SQL (per year) | API field | Component |
|--------------|-------------|----------------|-----------|-----------|
| Year | `Years.Year` | static 2021–2025 | `year` | `PurchySummaryTable` |
| Ttl Growers with Bond | `Ttl_Growers with Bond` | `COUNT(*) WHERE <year_bond_col> > 0` | `ttlGrowersWithBond` | `PurchySummaryTable` |
| # Growers with Indent | `# of Growers with Indent` | `COUNT(*) WHERE <year_indent_col> > 0` | `growersWithIndent` | `PurchySummaryTable` |
| # Growers Supplied | `# of Growers Supplied` | `COUNT(*) WHERE <year_supply_col> > 0` | `growersSupplied` | `PurchySummaryTable` |
| Ttl Bond | `Ttl_Bond` | `SUM(<year_bond_col>)` | `ttlBond` | `PurchySummaryTable` |
| Supply Qty by Year | `Supply Qty by Year` | `SUM(<year_supply_col>)` or 2025 tx sum | `supplyQtyByYear` | `PurchySummaryTable` |
| Supply vs Bond % | `Supply vs Bond %` | `supply_qty / ttl_bond` | `supplyVsBondPct` | `PurchySummaryTable` |
| Issued Purchy (cnt) | `Issued Purchy (cnt)` | `SUM(issue##)` or `2025_Indent Count` | `issuedPurchyCnt` | `PurchySummaryTable` |
| Weighted Purchy (cnt) | `Weighted Purchy (cnt)` | `SUM(wt##)` or `2025_Supply Count` | `weightedPurchyCnt` | `PurchySummaryTable` |
| Purchy Dishonour (cnt) % | `Purchy Dishonour (cnt) %` | `(issued - weighted) / issued` | `purchyDishonourCntPct` | `PurchySummaryTable` |

**Endpoint:** `GET /api/bi/purchy/grower-performance/summary`  
**Service:** `growerPerformanceService.getSummary()`

### Detail table

| Display name | PBI column | DB column | API field | Component |
|--------------|------------|-----------|-----------|-----------|
| Grower | `Grower_name_Key` | `grower_name_key` | `grower_name_key` | `PurchyDetailTable` |
| Village | `Village_name_Key` | `village_name_key` | `village_name_key` | `PurchyDetailTable` |
| Society | `Society Name` | `society_name` | `society_name` | `PurchyDetailTable` |
| Total Bond | `Total Bond` | `total_bond` | `total_bond` | `PurchyDetailTable` |
| Indent QTY | `Indent QTY` | `indent_qty` | `indent_qty` | `PurchyDetailTable` |
| Weight Qty 2025 | `Weight Qty 2025` | `weight_qty_2025` | `weight_qty_2025` | `PurchyDetailTable` |
| Indent Failer QTY | `Indent Failer QTY` | `indent_failer_qty` | `indent_failer_qty` | `PurchyDetailTable` |
| Loyalty | `Loyalty_Slicer` | `loyalty_slicer` | `loyalty_slicer` | `PurchyDetailTable` |

**Endpoint:** `GET /api/bi/purchy/grower-performance/detail`  
**Service:** `growerPerformanceService.getDetail()`  
**Hook:** `usePurchyGrowerPerformance()`

---

## Page 2 — Purchy Dishonour Analysis

### KPI cards

| Display name | PBI measure | SQL | API field | Component |
|--------------|-------------|-----|-----------|-----------|
| Bonded Growers | `Bonded_Growers` | `COUNT(*)` on filtered summary | `bondedGrowers` | `PurchyKpiGrid` |
| 2025 Indent Count | `2025_Indent Count` | count `purchy_indent` for filtered growers | `indentCount` | `PurchyKpiGrid` |
| 2025 Indent Qty | `2025_Indent Qty` | `SUM(supllymodeqty)` | `indentQty` | `PurchyKpiGrid` |
| 2025 Supply Count | `2025_Supply Count` | count `purchy_supply` | `supplyCount` | `PurchyKpiGrid` |
| 2025 Supply Qty | `2025_Supply Qty` | `SUM(purchasemodeqty)` | `supplyQty` | `PurchyKpiGrid` |
| 2025 Dishonour Count | `2025_Dishonour Count` | count dishonour rows | `dishonourCount` | `PurchyKpiGrid` |
| 2025 Dishonour % (Count) | `2025_Dishonour % (Count)` | `dishonour_count / indent_count` | `dishonourPctCount` | `PurchyKpiGrid` |
| 2025 Dishonour Qty | `2025_Dishonour Qty` | `SUM(mode_qty)` | `dishonourQty` | `PurchyKpiGrid` |
| 2025 Dishonour % (Qty) | `2025_Dishonour % (Qty)` | `dishonour_qty / indent_qty` | `dishonourPctQty` | `PurchyKpiGrid` |

**Endpoint:** `GET /api/bi/purchy/dishonour/kpis`  
**Service:** `purchyDishonourService.getKpis()`  
**Hook:** `usePurchyDishonour()`

### Slicers

| UI label | PBI field | Query param | Component |
|----------|-----------|-------------|-----------|
| Zone Head | `FieldStaff_Mapping.Zone Head` | `zoneHead` | `PurchyFilterBar` |
| Zonal Manager | `FieldStaff_Mapping.Zonal Manager` | `zonalManager` | `PurchyFilterBar` |
| Zonal Incharge | `FieldStaff_Mapping.Zonal Incharge` | `zonalIncharge` | `PurchyFilterBar` |
| Village Staff | `FieldStaff_Mapping.Village Staff` | `villageStaff` | `PurchyFilterBar` |
| Dishonour Bucket | `Grower_Summary_Sheet.Dishonour_Bucket` | `dishonourBucket` | `PurchyFilterBar` |
| Loyalty | `Grower_Summary_Sheet.Loyalty_Slicer` | `loyaltySlicer` | `PurchyFilterBar` |

### Detail table (sorted by `2025_Dishonour % (Qty)` desc)

| Display name | PBI field | API field | Component |
|--------------|-----------|-----------|-----------|
| Society Name | `Society Name` | `societyName` | `PurchyDetailTable` |
| Village | `Village_name_Key` | `villageNameKey` | `PurchyDetailTable` |
| Grower | `Grower_name_Key` | `growerNameKey` | `PurchyDetailTable` |
| Village Staff | `Village Staff` | `villageStaff` | `PurchyDetailTable` |
| No of Purchy Indent | `No of Purchy Indent` | `noOfPurchyIndent` | `PurchyDetailTable` |
| No of Indent Failer purchy | `No of Indent Failer purchy` | `noOfIndentFailerPurchy` | `PurchyDetailTable` |
| 2025 Supply Count | `2025_Supply Count` | `supplyCount2025` | `PurchyDetailTable` |
| 2025 Indent Qty | `2025_Indent Qty` | `indentQty2025` | `PurchyDetailTable` |
| 2025 Supply Qty | `2025_Supply Qty` | `supplyQty2025` | `PurchyDetailTable` |
| 2025 Dishonour Qty | `2025_Dishonour Qty` | `dishonourQty2025` | `PurchyDetailTable` |
| 2025 Dishonour % (Qty) | `2025_Dishonour % (Qty)` | `dishonourPctQty` | `PurchyDetailTable` |

**Endpoint:** `GET /api/bi/purchy/dishonour/detail`  
**Service:** `purchyDishonourService.getDetail()`  
**Page filter:** `no_of_indent_failer_purchy IS NOT NULL`

### Footer note

Static text in `PurchyAnalysisDashboard.jsx` (Purchy Dishonour tab).

---

## Data layer

| PBI table | MySQL table | Import |
|-----------|-------------|--------|
| `Grower_Summary_Sheet` | `purchy_grower_summary` | `Grower Details Season 2025-2026.xlsx` sheet `Grower  Wise summary ` |
| `Grower_Purchywise_Indent` | `purchy_indent` | sheet `Grower Purchy wise Indent` |
| `Grower_Purchywise_Supply` | `purchy_supply` | sheet `Grower Indent Purchy wise suppl` |
| `Grower_Purchywise_Dishonour` | `purchy_dishonour` | sheet `Grower Purchy wise Indent Faile` |
| `FieldStaff_Mapping` | `purchy_field_staff` | `Staff wise Bonding target.xlsx` sheet `Main` |
| `Years` | `purchy_years` | static 2020–2025 |

**View:** `purchy_grower_summary_v` — calculated columns (`grower_key`, `loyalty_slicer`, `dishonour_bucket`, etc.)

---

## Validation

Run `npm run db:validate-purchy-measures` (no filters) and compare output to Power BI baseline screenshots.

**Registration:** form `bi_purchy_analysis` → route `/bi/purchy-analysis`
