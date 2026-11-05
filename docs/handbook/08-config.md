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

Administrators only. Use this after the night shift, or when checking one person or one form.

[Screenshot: 08-config — Audit & Activity Changes tab, annotate: chips, summary counts, Time / Person / What happened / Where / Result]

### Morning checklist

1. Open **Config → Audit & Activity**. Stay on **Changes**.
2. Tap **Yesterday** (or **Today** if you are checking the current shift).
3. Read the counts: **Saved**, **Sent for approval**, **Approved or returned**, **Edits**, **Deletes**, **Failed**. Tap a count to filter the list.
4. Open any **Failed** row. **What went wrong** shows the message the user saw (for example already exists for this shift). Server problems say **Ask IT**.
5. Open **Edits** and **Deletes**. The expanded row shows the old values.
6. Tap **Approvals** if you need who approved or sent back, including from the email link.
7. Tap **Uploads** for Purchy / Milling / Management file loads.
8. Switch to **Views and downloads** if you need who opened a form or downloaded CSV/PDF. Switch to **Sign-ins** for login times and who is online.

### How to read a Changes row

- **Time** is IST, with “2 h ago” under it.
- **Person** is name and role. Failed sign-in with an unknown email shows **Unknown user (tried: …)**.
- **What happened** is a sentence, for example *Ravi Kumar saved Mill Stoppages for 04-Nov-2026, Shift B*.
- **Where** is the place in the app, for example **Forms Hub › Mill House › Mill Stoppages**.
- **Result** chips: green **Saved**, blue **Sent for approval**, red **Failed** (and similar for Edited / Deleted / Approved).
- Expand the row:
  - **What was entered** — fields on a new save
  - **What changed** — old and new values
  - **What was deleted** — the removed row
  - **What went wrong** — why a save failed
  - **Technical details** — email, API path, status, error for IT

### Filters

- Chips on top: **Today**, **Yesterday**, **This week**, **Problems only**, **Edits and deletes**, **Approvals**, **Uploads**, **Sign-ins**.
- Area cascade: **Home → Forms Hub → Forms cards →** a card such as Mill House. **Approvals** includes **Operations forms** and **Maintenance Notes**.
- Search matches name, email, and the sentence. Dates and dropdowns apply as soon as you change them. Use **Apply** for search text. **Refresh** reloads.

### Views and downloads / Sign-ins

- **Views and downloads:** Opened form, Viewed data, Downloaded CSV, Downloaded PDF, Downloaded chart, Opened page. **Form / Dashboard** names the screen. Expand for path and stay time.
- **Sign-ins:** login / logout, duration, pages, **Online** vs **Ended**.

Nothing in this log can be edited or deleted. Night rows during crushing season are expected.

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
