# 6. Data Upload

Workbooks that feed some dashboards. Navbar **Data Upload**. Page title: **Data Ingestion Center**.

## 6.1 Who can open it

- Administrators see all three sections.
- Employees see only sections granted in **Data upload mapping** (chapter 8.1).
- No grant: navbar hidden; URL sends you to **Home**.
- Intro: *Use the sections below to upload specific reference files for dashboards.*
- **Back to Modules** returns to Home.

[Screenshot: 04-data-upload — Data Ingestion Center, annotate: three section tabs and slot names]

## 6.2 Feature list — sections and slots

- **Grower Intelligence**
  - Grower Details Season
  - Staff wise Bonding
- **Management Dashboard**
  - Centre Indent & Purchase
  - DMR workbook
- **Milling Operations**
  - Mill Equipment Mapping
  - Shredder Equipment Mapping
  - Lube & Roller Mapping

## 6.3 Grower Intelligence

- Heading: **Grower Intelligence**.
- Link: **Open Grower Intelligence →**.

### 6.3.1 Grower Details Season

- Hint: Grower Details Season workbook (.xlsx).
- Feeds: Grower Intelligence dashboard (grower / dishonour).
- Buttons: **Upload & import** / **Replace & re-import** / **Uploading…**.
- Empty: *No file uploaded yet.*

### 6.3.2 Staff wise Bonding

- Hint: Staff wise Bonding target workbook (.xlsx).
- Feeds: Staff Drilldown.
- Same upload buttons as 6.3.1.

### 6.3.3 File rules and messages

- Accept: `.xlsx,.xls`.
- Toasts: *Upload started.*, *Purchy data imported. Open Grower Intelligence in Live mode.*, *Purchy files must be Excel (.xlsx or .xls).*, *Upload failed.*

## 6.4 Management Dashboard

- Heading: **Management Dashboard data**.
- Link: **Open Management Dashboard →**.

### 6.4.1 Centre Indent & Purchase

- One file — 1st sheet indent, 2nd sheet purchase (column names listed on the screen).
- Feeds: Management Overview indent/purchase/overrun; Centre Maturity.

### 6.4.2 DMR workbook

- Single Sheet1 — columns by name on the screen.
- Feeds: Management Overview mill and sugar spine, including **Yard Bal. (8AM)** when that column is filled.

### 6.4.3 History table

- Columns: **File**, **Uploaded**, **Date range**, **Rows**, **Status** (`done` / `failed` / `pending`).
- Toast: *Management Dashboard data imported.* (or the import error).

## 6.5 Milling Operations

- Heading: **Milling Operations Dashboard**.

### 6.5.1 Mill Equipment Mapping

- Hint names the mill mapping workbook (e.g. Data_Mill.xlsx).
- Feeds: Equipment Temperature names on Milling Operations.

### 6.5.2 Shredder Equipment Mapping

- Feeds: Shredder and OTG Temp names.

### 6.5.3 Lube & Roller Mapping

- Feeds: Lube & Roller Temp names.

### 6.5.4 Messages

- Toast: *File uploaded.* Optional: *Mapping auto-synced successfully.*

## 6.6 Cautions

- **Caution.** Upload to the correct slot. A Grower file in DMR will not fix the scorecard.
- **Caution.** Mill temperature charts show codes until the three mapping files are uploaded.
