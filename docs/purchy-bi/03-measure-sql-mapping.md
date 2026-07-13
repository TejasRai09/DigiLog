# Purchy BI — Measure → SQL Mapping

All measures evaluate inside a **filter context** built from slicer query params. Base filtered set = `purchy_grower_summary_v` joined to `purchy_field_staff` when staff filters apply.

## Filter params → SQL

| Query param | SQL predicate |
|-------------|---------------|
| `societyName` | `gs.society_name IN (...)` |
| `loyaltySlicer` | `gs.loyalty_slicer IN (...)` |
| `zoneHead` | `fs.zone_head IN (...)` |
| `zonalManager` | `fs.zonal_manager IN (...)` |
| `zonalIncharge` | `fs.zonal_incharge IN (...)` |
| `villageStaff` | `fs.village_staff IN (...)` |
| `dishonourBucket` | `gs.dishonour_bucket IN (...)` |

Empty / omitted = no filter (Power BI "All").

---

## Page 1 measures (per year row)

### Ttl_Growers with Bond
**DAX:** `SWITCH(SelectedYear, "2021", COUNTROWS(FILTER(... bond2021 > 0)), ... "2025", COUNTROWS(FILTER(... total_bond > 0)))`

**SQL (per year `:year`):**
```sql
SELECT COUNT(*) FROM purchy_grower_summary_v gs
WHERE <filters> AND <year_bond_column> > 0
```

### # of Growers with Indent
**SQL:** `COUNT(*) WHERE <year_issue_column> > 0` (2025: `no_of_purchy_indent > 0`)

### # of Growers Supplied
**SQL:** `COUNT(*) WHERE <year_supply_column> > 0` (2025: `weight_qty_2025 > 0`)

### Ttl_Bond
**SQL:** `SUM(<year_bond_column>)`

### Supply Qty by Year
**SQL:** `SUM(<year_supply_column>)` — for 2025: subquery sum of `purchy_supply.purchasemodeqty` for filtered growers

### Supply vs Bond %
**SQL:** `supply_qty_by_year / NULLIF(ttl_bond, 0)`

### Issued Purchy (cnt)
**SQL:** `SUM(VALUE(issue##))` per year; 2025: `2025_Indent Count`

### Weighted Purchy (cnt)
**SQL:** `SUM(VALUE(wt##))` per year; 2025: `2025_Supply Count`

### Purchy Dishonour (cnt) %
**DAX:** `DIVIDE([Issued Purchy (cnt)] - [Weighted Purchy (cnt)], [Issued Purchy (cnt)], BLANK())`

**SQL:** `(issued - weighted) / NULLIF(issued, 0)`

---

## 2025 transaction measures

### 2025_Indent Count
**DAX:** `COUNTROWS(FILTER(Grower_Purchywise_Indent, NOT(ISBLANK(RELATED(Grower_Summary_Sheet[Grower_Key])))))`

**SQL:**
```sql
SELECT COUNT(*) FROM purchy_indent i
INNER JOIN <filtered_growers> g ON g.grower_key = i.grower_key
```

### 2025_Indent Qty
**SQL:** `SUM(i.supllymodeqty)` same join

### 2025_Supply Count
**SQL:** `COUNT(*) FROM purchy_supply s INNER JOIN <filtered_growers> g ON g.grower_key = s.grower_key`

### 2025_Supply Qty
**SQL:** `SUM(s.purchasemodeqty)`

### 2025_Dishonour Count
**SQL:** `COUNT(*) FROM purchy_dishonour d INNER JOIN purchy_indent i ON ... INNER JOIN <filtered_growers> g`

### 2025_Dishonour Qty
**SQL:** `SUM(d.mode_qty)` same joins

### 2025_Dishonour % (Count)
**SQL:** `dishonour_count / NULLIF(indent_count, 0)`

### 2025_Dishonour % (Qty)
**SQL:** `dishonour_qty / NULLIF(indent_qty, 0)`

### Bonded_Growers
**SQL:** `COUNT(*) FROM <filtered_growers>`

---

## API endpoint mapping

| Measure(s) | Endpoint |
|------------|----------|
| Page 1 summary (all 9 × years) | `GET /api/bi/purchy/grower-performance/summary` |
| Page 1 detail columns | `GET /api/bi/purchy/grower-performance/detail` |
| Page 2 KPIs (9) | `GET /api/bi/purchy/dishonour/kpis` |
| Page 2 detail + per-row measures | `GET /api/bi/purchy/dishonour/detail` |
| Slicer distinct values | `GET /api/bi/purchy/filters` |

## React component mapping

| Measure / column | Component |
|------------------|-----------|
| Summary matrix measures | `PurchySummaryTable` |
| Page 2 KPI measures | `PurchyKpiGrid` |
| Detail columns | `PurchyDetailTable` |
