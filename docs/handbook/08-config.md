# 8. Config

Administrators only. Navbar **Config**. Subtitle: *Employees, categories, BI settings, and other portal configuration.* Sidebar group: **Settings**. Default: **Employees**.

[Screenshot: 08-config — Config sidebar, annotate: eight Settings sections Employees through Forms Approval]

## 8.1 Employees

- Table: Name, Email, Department, Role, Status (**Active** / **Inactive**), **Forms Hub** (badge **View only** when set), **Manager**, **Data upload**, **Locked cards**, **Actions**.
- Header: **Send Mail (n)**, **Add Employee**.

### 8.1.1 Add / Edit employee

- Fields: **Full Name**, **Email**, **Department**, **Role** (`employee` / `admin`), **Account Active** (edit).
- Buttons: **Cancel**, **Save**.

### 8.1.2 Row menu (feature list)

- **Send activation email**
- **Form mapping** — which Forms Hub apps and forms. Toast: *Form mapping saved. Forms Hub homepage card updated automatically.*
- **Forms Hub access** — **Full access** vs **View only**
- **Dashboard mapping** — which BI dashboards. Toast: *Dashboard mapping saved. BI Control Tower homepage card updated automatically.*
- **Data upload mapping** — Grower Intelligence, Management Dashboard, Milling Operations
- **Locked card manage access** — Sugar House, Power Plant, Production House
- **Assign manager**
- **Edit employee**
- **Delete employee**

### 8.1.3 Homepage cards (not a separate tab)

- Auto from mappings: **Forms Hub**, **BI Control Tower**.

## 8.2 Employee Categories

- Department options on the employee form.
- Add / edit / delete categories.
- Toast: *Category added.*

## 8.3 Season Mapping

- **Sugar Season (SS):** **Season Label (e.g. 2025-2026)**, **From**, **To**, **Add Season**.
- ESY / FY date rules are shown on the same page `[TO CONFIRM]` exact card titles.
- These windows drive **STD** on dashboards.

## 8.4 BI Dashboards

- **Calculation Constants** per **Sugar Season** (dropdown, **(Current)** on the active season).
- **Theoretical Yield Factor** (default 64.4).
- **Power Export Tariff (₹ / kWh)** (default ₹4.85).
- **Brix Ripeness Threshold** (default 18).
- **Save Constants**.

## 8.5 Audit & Activity

- Tabs: **Change Log**, **Activity Log**, **Session Log**.
- Change Log filters: Create / Update / Delete / Login; All results / Success / Failed.
- Session Log: All sessions / Online now / Ended.
- Location cascade (Home → Forms Hub → …).
- **Refresh**.

## 8.6 Maintenance History Approval

- Three cards: **Sugar House**, **Power Plant**, **Production House**.
- Per card:
  - **Enable HOD approval**
  - **HOD employee**
  - **Combined digest times (IST):** **Time 1**, **Time 2 (optional)**
  - Copy: *The HOD receives one email covering Forms, Maintenance History, and Maintenance Notes at each time (IST). Leave Time 2 blank to send only once per day.*
  - When on: **Resend full digest**, **Email new pending only**
- **Save**.

## 8.7 Maintenance Notes Approval

- Same three plant cards.
- **HOD who can close notes for this plant**.
- Same digest times and resend buttons as 8.6.
- **Save**.

## 8.8 Forms Approval

- Per Forms Hub **app card**:
  - **Enable HOD approval for this card**
  - **Card HOD**
  - Digest times and resend buttons (same combined-email copy)
- Expand **Forms** per form:
  - **Inherit card** / **On** / **Off**
  - **Form HOD (optional — leave blank to use card HOD)**
- Empty: *No data forms found to configure.*
- **Save**.
