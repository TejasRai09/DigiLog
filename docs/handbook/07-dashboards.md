# 7. Dashboards

Eight dashboards in **BI Control Tower**. They are not forms.

## 7.1 BI Control Tower

- Open: **Home** → **Open BI Control Tower**.
- Empty: **No BI dashboards assigned**.
- Views: **Card view** / **List view**.
- `[TO CONFIRM]` Cane Quality may be missing in list view — use card view.
- Shared dates on most cockpits: **WTD** · **MTD** · **STD** · **Custom**, From / To, **Compare**.
- Green % = better; rose = worse. Some loss metrics treat a drop as good.

[Screenshot: 04-bi-hub — BI Control Tower, annotate: eight dashboard cards in hub order]

### 7.1.1 Feature list — hub cards (order)

- **Management Overview** — Executive KPIs
- **Cane Operations** — Procurement & gate
- **Cane Quality** — Field & yard
- **Centre Maturity** — Season vs season
- **Milling Operations** — Mill cockpit
- **Power Plant Operations** — Generation & steam
- **Distillery Operations** — Production analytics
- **Grower Intelligence** — Grower & dishonour

### 7.1.2 Dashboard map

- **Management Overview** — whole plant vs compare window — leadership — DMR + indent/purchase + lab/power/distillery forms.
- **Cane Operations** — purchase, gate, holding, transit — cane office — MSSQL (AIRACANE).
- **Cane Quality** — field/yard Brix — cane quality — Brix forms.
- **Centre Maturity** — centre vs indent — cane planning — Indent & Purchase upload.
- **Milling Operations** — stops and temperatures — mill — Mill Logbook + mapping files.
- **Power Plant Operations** — generation, steam, outages — power house — Power Logbook.
- **Distillery Operations** — ethanol and efficiency — distillery — Distillery Operations Form.
- **Grower Intelligence** — bonding and dishonour — cane/commercial — Grower Intelligence upload.

---

## 7.2 Management Overview

- Page header: **Management Dashboard**.
- Who: leadership / HODs, daily in season.
- Rows: **Cane**, **Milling**, **Sugar**, **Power**, **Distillery**.
- Click a cell for the trend. Compare % is on the cell and the expand window.

### 7.2.1 Cane row

- **Cane Indent (Q)** / **Cane Purchase (Q)** — Qtls.
- **Yard Bal. (8AM)** — Qtls. Cane in the yard at 8 AM. Mainly DMR workbook. If DMR is empty: Operations Logbook yard balance at 7–8 or 8–9 AM.
- **Overrun Gate** / **Overrun Center** — %.
- **Pol in Cane %** — DS Logbook or DMR.

### 7.2.2 Milling and Sugar rows

- Crush, Mixed Juice, Masceration %, DMF %, Bag Pol % Cane (lower better), Sugar Total, Recovery %, Power/Cane, Steam/Cane, Power/Sugar, Steam/Sugar, DS/RS cane, Pol In F Cake.

### 7.2.3 Power and Distillery rows

- Power Gen, Export, Inhouse, steam raised, steam to sugar, Steam/Bag, Sp. Steam.
- Syrup+Mol Used, Ethanol Prod. (BL), Recovery BL, stocks, Distillation / Fermentation Eff., TRS & FS %.

### 7.2.4 Sources and reading

- Sources: Data Upload → Centre Indent & Purchase and DMR; Operations Logbook and DS Logbook → Lab Logbook; Power Details and Steam Details → Power Logbook; Distillery Operations Form.
- Blank mill/sugar cells usually mean the DMR file is missing those dates.

[Screenshot: 04-management — Management scorecard, annotate: Cane row with Yard Bal. (8AM)]

---

## 7.3 Cane Operations

- Header: **Cane Operations** — *Cut to crush · Gate · Transit · Holding*.
- Tabs: **Procurement Summary**, **Gate 1**, **Gate 2**, **Center Purchase**, **Vehicle Handling**, **Vehicle Holding**, **Vehicle Holding 2**, **Truck Transit**, **Truck Holding**.

### 7.3.1 Tabs (feature list)

- **Procurement Summary** — cut-to-crush map (no KPI chips).
- **Gate 1** — Total Cane Purchased (Qtls), No. of Parchy, Avg Parchy Size, Avg Parchy Overrun (lower better).
- **Gate 2** — vehicles, Avg/Max Yard Holding (Hrs), Vehicles Exceeding (>8 Hrs).
- **Center Purchase** — purchase, parchie, trips, top/bottom 10 centres.
- **Vehicle Handling / Holding / Holding 2 / Truck Transit / Truck Holding** — SLA slider, **🟢 Target** / **🟠 Breach**.

### 7.3.2 Source

- MSSQL database (AIRACANE).
- `[TO CONFIRM]` live vs copy on this plant.

[Screenshot: 04-cane — Cane Operations Gate 1, annotate: KPI strip and Compare chip]

---

## 7.4 Cane Quality

- Page header: **Brix Sampling Analytics**.
- Tabs: **Field Sampling**, **Yard Sampling**.

### 7.4.1 Field

- **AVG MID BRIX %**, **AVERAGE MATURITY**, **TOTAL SAMPLES**, **BOTTOM BRIX < {threshold}%** (default 18 `[TO CONFIRM]`).
- Filter: **Operation**.

### 7.4.2 Yard

- **AVG MIDDLE BRIX %**, diseased / stale counts.
- Filter: **Point**.

### 7.4.3 Source

- Field Brix Sampling and Yard Brix Sampling → Brix Sampling Forms.

[Screenshot: 04-brix — Field Sampling KPIs, annotate: AVG MID BRIX %]

---

## 7.5 Centre Maturity

- KPIs: **Indent Qty (Qtl)**, **Purchase Qty (Qtl)**, **Maturity %**.
- Four section tables: Center Name, Indent, Maturity badge (red → green).
- Search: **Center name...**
- Subtitle may show **SPE 26** `[TO CONFIRM]`.
- Source: Data Upload → Centre Indent & Purchase.

[Screenshot: 04-centre-maturity — Centre tables, annotate: Maturity % badges]

---

## 7.6 Milling Operations

- Page header: **Milling Division Cockpit**.
- Tabs: **Mill Outage**, **Equipment Temperature**, **Shredder and OTG Temp**, **Lube & Roller Temp**.

### 7.6.1 Mill Outage

- **Total Stoppage Hours**, **Stoppage Events**, **Max Incident Duration**, **MTBF**.
- Lower stoppage hours is better.

### 7.6.2 Temperature tabs

- Names from Data Upload mapping files (chapter 6.5).
- Blank names mean the mapping file is missing.

[Screenshot: 04-milling — Mill Outage, annotate: Total Stoppage Hours]

---

## 7.7 Power Plant Operations

- Page header: **Power House**.
- Tabs: **Power Summary**, **Generation**, **Consumption**, **Steam Summary**, **Steam Consumption**, **Outage**, **Process**.
- Look at Total Power Generation, PLF, export vs in-house, steam, **Outage Duration (Hrs)**.
- Source: Power Details, Steam Details, Stoppage Details → Power Logbook.

[Screenshot: 04-power — Power Summary, annotate: generation trend]

---

## 7.8 Distillery Operations

- KPI strip: **Operating Days**, **Total Ethanol Produced (BL)**, **Syrup/Molasses Consumed (Q)**, **Fermentation Efficiency (%)**, **Distillation Efficiency (%)**.
- Charts: Ethanol Vol, Ferm. Sugar, Overall Efficiency, Wash Distilled, Molasses Stock, Ethanol Stock.
- Year types: **SS** (Sugar Season), **ESY** (Ethanol Supplier Year), **FY** (Financial Year).
- Source: Distillery Operations Form. Operating days = days with ethanol production.

[Screenshot: 04-distillery — Distillery KPI strip, annotate: Compare vs previous period]

---

## 7.9 Grower Intelligence

- Tabs: **Grower Performance**, **Purchy Dishonour**, **Dishonour Drilldown**, **Staff Drilldown**, **Failure by Date**.
- Dishonour KPIs: Bonded Growers, 2025 Indent / Supply / Dishonour count, qty, % `[TO CONFIRM]` year label.
- These KPIs do **not** show compare %.
- Filters: Society, Loyalty, Zone Head … Village Staff, Dishonour Bucket.
- Source: Grower Details Season; Staff wise Bonding for Staff Drilldown.

[Screenshot: 04-grower — Purchy Dishonour KPI grid, annotate: Dishonour % count and qty]
