# 2. Operation Form

Every daily logbook and sampling sheet lives in **Forms Hub** → **Operations forms**. This chapter is the feature list for those cards.

## 2.1 Forms Hub

### 2.1.1 What it is

- Landing page for all operation apps and equipment apps.
- Title: **Forms Hub**.
- Two sections:
  - **Operations forms** — *Daily operational logbooks including mill, lab, power, distillery, and EHS forms.*
  - **Equipment maintenance and history** — covered in chapter 3.

[Screenshot: 02-forms-hub — Forms Hub Operations forms, annotate: section title and app cards]

### 2.1.2 How to open

- **Home** → **Open Forms Hub**.
- Empty: **No applications assigned** — *Contact your admin to get access.*

### 2.1.3 App card

- Shows the app name and **N Form(s)**.
- Click the card to open **Available Forms**.

### 2.1.4 Form row actions (desktop)

- **Open Form** — fill a new entry (equipment hub cards say **Open**).
- **View Data** — past rows.
- **CSV** — download rows.

[Screenshot: 02-app-detail — Available Forms table, annotate: Open Form, View Data, CSV]

### 2.1.5 Form row actions (phone)

- **Open Digital Form** (or **Open**).
- **View Logs**.
- **Excel Download**.

### 2.1.6 View only

- Banner: *View only — you can see this data but cannot submit or edit.*

## 2.2 Shared submit steps (all data forms)

- Set **Report Date** / **Sampling Date** / **Operation Date** and **Shift** where asked.
- Fill the sections for this shift.
- Click **Submit**.
- Read **Confirmation Policy Notice**.
- Click **Confirm & Commit**.
- If Forms Approval is on, wait for the HOD (chapter 5). If sent back, correct and submit again.

[Screenshot: 02-review-modal — Confirmation Policy Notice, annotate: Confirm & Commit]

### 2.2.1 Common validation

- Mill / lab: *Date and Shift are required.*
- Distillery: *Operation Date is required.*
- Power Details: Date and **General remarks** are required.
- Field Brix: many boxes required (see 2.9.2).

### 2.2.2 Live operations apps (feature list)

- **Mill Logbook** — 4 forms (2.3).
- **Lab Logbook** — 6 forms (2.4).
- **Power Logbook** — 3 forms (2.5).
- **Distillery Operations** — 1 form (2.6).
- **EHS — Environment Health & Safety** — 5 forms (2.7).
- **Production** — 5 forms (2.8).
- **Brix Sampling Forms** — 2 forms (2.9).

Retired (not in the grid): **Mill House Equipment History**, **Power Plant Equipment History (old)**.

---

## 2.3 Mill Logbook

- **Who:** mill operators / shift in-charge.
- **When:** each mill shift **A / B / C**.
- **Dashboards:** Milling Operations. Names on temperature tabs come from Data Upload → Milling Operations maps (chapter 6).

### 2.3.1 Equipment Temperature

- **What:** motor and bearing temperatures for mill-side machines.
- **How to open:** Forms Hub → **Mill Logbook** → **Equipment Temperature** → **Open Form**.
- **Header fields:** Report Date, Shift, Time.
- **Equipment cards:** Cane Kicker, Cardian Drum 1, Cardian Drum 2, Feeder Drum, Cane Carrier, Shred. Carrier, Belt Convy, IRC 1–4, Mill 0, Mill 4.
- **Per equipment:** Motor Temp (DE), Gear Box BRG Temp (DE), Gear Box BRG Temp (NDE), PB BRG Temp (DE), PB BRG Temp (NDE).
- **Required:** Date and Shift.
- **Where it goes:** Milling Operations → Equipment Temperature.

### 2.3.2 Shredder and OTG

- **What:** shredder motor / bearing / vibration and OTG bearing temperatures.
- **How to open:** **Mill Logbook** → **Shredder and OTG** → **Open Form**.
- **Header:** Report Date, Shift, Time.
- **Shredder RHS / LHS:** Motor BRG Temp, Bearing Temp (DCS), Bearing Temp (Site), Vibrations H / V / A.
- **OTG Bearing Temperature:** Mills 1–4; Input / Intermediate / Output; Mill side and Turbine side.
- **Where it goes:** Milling Operations → Shredder and OTG Temp.

### 2.3.3 Lube Pressure and Roller Temp

- **What:** lube pump line pressure and mill roller temperatures.
- **How to open:** **Mill Logbook** → **Lube Pressure and Roller Temp** → **Open Form**.
- **Header:** Date, Shift, Time.
- **Lube Pump Pressure (Kg/Sq.Cm):** ACC, MCC, Shredder, Mill 0.
- **Mill roller temperatures:** Mills 0–4, gear and pintal sides (as on the form).
- **Where it goes:** Milling Operations → Lube & Roller Temp.

### 2.3.4 Mill Stoppages

- **What:** mill stop events.
- **How to open:** **Mill Logbook** → **Mill Stoppages** → **Open Form**.
- **Fields:** Report Date, From, To, Section, Machinery, Remark.
- **Required:** Date, Start Time, End Time.
- **Where it goes:** Milling Operations → Mill Outage.

[Screenshot: 02-mill-stoppages — Mill Stoppages, annotate: From, To, Section, Remark]

---

## 2.4 Lab Logbook

- **Who:** lab / process chemist.
- **When:** each lab shift **A / B / C**.
- **Dashboards:** Management Overview uses DS and Operations (and RS for gaps). Special Analysis, Syrup, and lab Stoppage are **not** on a BI dashboard.

### 2.4.1 DS Logbook

- **What:** direct sulphitation Pol / Brix log.
- **How to open:** **Lab Logbook** → **DS Logbook** → **Open Form**.
- **Header:** Date, Shift, Sampling Time, Mode of Operation (**B Heavy** / **C Heavy**).
- **Pol and Brix pairs:** Primary Juice, Mixed Juice, Last Mill Juice, Clear Juice, Filterate Juice, Unsulphured Syrup, Sulphured Syrup, A / B / A1 / C massecuite, A1 / A-Hy / A-Light / B-Hy / C-Light molasses, Final Molasses.
- **Other:** Bagasse Pol, Bagasse Moisture, Filter Cake Pol, Decanter Mud Pol, Mill Drain Pol, Boiling House Drain Pol.
- **Required:** Date and Shift.
- **Where it goes:** Management Overview — **Pol in Cane %** and mill/sugar gaps.

[Screenshot: 02-ds-logbook — DS Logbook, annotate: Date, Shift, Mode of Operation, Pol and Brix]

### 2.4.2 RS Logbook

- **What:** remelt sulphitation Pol / Brix log.
- **How to open:** **Lab Logbook** → **RS Logbook** → **Open Form**.
- **Header:** Date, Shift, Sampling Time.
- **Groups:** Juices, Massecuites, Molasses, Melt, IER, Filter Cake Pol (labels as on the form).
- **Where it goes:** Management Overview (fills a reading when DMR has no value).

### 2.4.3 Operations Logbook

- **What:** yard, crush, juice, sugar bagging, dryer readings.
- **How to open:** **Lab Logbook** → **Operations Logbook** → **Open Form**.
- **Header:** Report Date, Shift, Sampling Time.
- **Input:** Yard Balance (Qtls), Crushing (Qtls), Imbibition Water (Qtls), Imbibition Temperature (°C).
- **Output:** Mixed Juice DS/RS, Molasses DS/RS, Filter Cake DS/RS.
- **Sugar:** DS Large / Medium / Small, RS Large / Medium / Small — Qty, Mesh, Bag Temp.
- **Pharma 20 / 30 / 40:** Qty, Bag Temp.
- **FBD DS / RS and RSD:** inlet / outlet / hopper temp and moisture.
- **Where it goes:** Management Overview — **Yard Bal. (8AM)** if DMR has no 8 AM figure (7–8 or 8–9 AM sample); mill/sugar gaps.

[Screenshot: 02-ops-logbook — Operations Logbook, annotate: Yard Balance, Crushing]

### 2.4.4 Special Analysis Logbook

- **What:** retention, moisture, colour by product grade.
- **How to open:** **Lab Logbook** → **Special Analysis Logbook** → **Open Form**.
- **Header:** Date, Shift, Sampling Time.
- **Products:** DSL, DSM, DSS, RSL, RSM, RSS, Pharma20, Pharma30, Pharma40.
- **Per product:** Retention (%), Moisture (%), Colour (IU).
- **Extra colour:** Clr Juice DS, Raw Melt RS, Clear Melt RS, Fine Liquor RS.
- **Dashboard:** none.

### 2.4.5 Syrup Logbook

- **What:** syrup made and diverted.
- **How to open:** **Lab Logbook** → **Syrup Logbook** → **Open Form**.
- **Header:** Date, Shift.
- **Syrup Production:** Syrup Prod DS, Syrup Prod RS.
- **Diversion:** Diversion Mode, Syrup Diversion, Molasses to Dist DS, Molasses to Dist RS.
- **TRS:** Syrup TRS, Boil House TRS.
- **Dashboard:** none.

### 2.4.6 Stoppage Logbook

- **What:** lab / process stoppages.
- **How to open:** **Lab Logbook** → **Stoppage Logbook** → **Open Form**.
- **Fields:** Report Date, From, To, Reason, Remark.
- **Dashboard:** none.

---

## 2.5 Power Logbook

- **Who:** power house.
- **Dashboards:** Power Plant Operations; power/steam cells on Management Overview.

### 2.5.1 Power Details

- **What:** generation, import, export, sugar / cogen / distillery splits.
- **How to open:** **Power Logbook** → **Power Details** → **Open Form**.
- **Header:** Report Date, Time.
- **Crushing:** Cane Crushed (Qtls), Bagasse Produced (Qtls).
- **Operating Hours:** 30.85MW STG, 3MW STG (O), 3MW STG (N), 4MW STG.
- **Power Generation:** same four STGs.
- **Power Gen by DG Set:** 625KVA 1–3, 380KVA 4.
- **Power Import:** Grid, 3MW Old, 3MW New, 4MW.
- **Power Export to Grid / Power to Sugar / Power to Cogen / Power to Distillery:** as on the form.
- **Power to Sugar (Breakup):** Mill, DS, Raw & Ref., 70TPH, ETP, Colony, Sugar CPU, Others.
- **Required:** Date and **General remarks**.
- **Where it goes:** Power Plant Operations; Management Overview power ratios.

### 2.5.2 Steam Details

- **What:** steam raised and used on 150 / 70 / 35 TPH.
- **How to open:** **Power Logbook** → **Steam Details** → **Open Form**.
- **Header:** Report Date, Time.
- **150 TPH:** generation, consumption, PRDS paths, extraction, fuel Firewood/Baggase (MT).
- **70 TPH:** generation, TG and distillery steam, fuel.
- **35 TPH:** generation, 4 MW, PRDS, distillery, ejector, deareator, slop (MT).
- **Where it goes:** Power Plant Operations steam tabs; Management Overview steam cells.

### 2.5.3 Stoppage Details

- **What:** power-house outages.
- **How to open:** **Power Logbook** → **Stoppage Details** → **Open Form**.
- **Fields:** Report Date, From, To, Section (+ specify), Sub-Section (+ specify), Machinery (+ specify), Category (+ specify), General remarks, Photo 1, Photo 2.
- **Where it goes:** Power Plant Operations → Outage.

---

## 2.6 Distillery Operations

### 2.6.1 Distillery Operations Form

- **What:** daily ethanol, feed, stock, and calculated efficiencies.
- **Who:** distillery.
- **When:** daily (operation date).
- **How to open:** **Distillery Operations** → **Distillery Operations Form** → **Open Form**.
- **Header:** Operation Date, Operation Mode.
- **Throughput & quality:** Syrup/Molasses Used (Qtls), Wash Distilled, TRS, UFS, Alcohol %.
- **Production:** Actual Ethanol Production (BL), AL/BL Ratio (%).
- **Storage:** Total BH Molasses, Total CH Molasses, Ethanol in Storage (BL).
- **Calculated (auto):** FS, FS%, FS Quantity, Theoretical yield, Alcohol prod in fermentation, FE, Actual prod. AL, DE, OE, REC BL, REC AL, TRS QTY, UFS QTY, Total mol in store (Qtls).
- **Required:** Operation Date.
- **Where it goes:** Distillery Operations dashboard; Management Overview Distillery row.

[Screenshot: 02-distillery-ops — Distillery Operations Form, annotate: Operation Date, syrup/molasses, ethanol]

---

## 2.7 EHS — Environment Health & Safety

- **Who:** EHS / safety / water.
- **Dashboard:** none of these five feed BI Control Tower.

### 2.7.1 Accident Report / Near Miss Report

- **What:** workplace accident or near miss.
- **When:** when an event happens.
- **How to open:** **EHS — Environment Health & Safety** → **Accident Report / Near Miss Report** → **Open Form**.
- **Header:** Date, Time, Incident type.
- **Person Involved:** Name, Contact No., Dept / Section, Type, Other (specify).
- **Incident Details:** Location, Severity, Description / Cause.
- **Treatment:** Treatment Type, What was given, By Whom.
- **Follow-up:** Significant Hazard Identified.
- **Incident Photos:** Image 1–3.
- **Document Upload:** Document 1–3.

### 2.7.2 Water Dashboard — Ground Water Abstraction

- **What:** bore-well extraction and use.
- **How to open:** EHS → **Water Dashboard — Ground Water Abstraction** → **Open Form**.
- **GW Pump 1 (Truck Yard) / 2 (36 Block) / 3 (Admin):** Meter Reading, Extracted (KL).
- **Total Bore Well:** Total Ext. (KL).
- **Domestic Uses:** Colony (KL), Fire & Labour (KL).
- **Industrial Uses:** Distillery, Power Plant, Refinery, DS, Mill, Total Industrial (KL).
- **Cane Crushing:** On Date (TCD), To Date (TCD).
- **Water per Tonne Cane:** Sugar + Dist (L/T), Industrial (L/T), Total Sugar Ext (L/T).
- **Remarks.**

### 2.7.3 Water Dashboard — ETP Working

- **What:** effluent treatment quantity and quality.
- **How to open:** EHS → **Water Dashboard — ETP Working** → **Open Form**.
- **Cane Crushing:** On Date / To Date (TCD).
- **ETP Inlet / Outlet:** Meter Reading, KL.
- **Quality:** pH (G Shift), TSS <30 ppm, COD <250 ppm, BOD <30 ppm, TDS <2100 mg/L, Oil & Grease <10 mg/L.
- **Effluent:** 200 L/TCD On Date, On Date (KLD), Remarks.

### 2.7.4 Water Dashboard — CPU Water Recycle

- **What:** CPU inlet/outlet and outlet quality.
- **How to open:** EHS → **Water Dashboard — CPU Water Recycle** → **Open Form**.
- **CPU Inlet / Outlet:** On Date (KL), To Date (KL).
- **Inlet pH:** A / B / C Shift.
- **Outlet Quality:** pH (5.5–8.5), TSS <30 ppm, COD <250 ppm, BOD <30 ppm, TDS <2100 mg/L, Oil & Grease <10 mg/L, Transmittance >85.
- **Remarks.**

### 2.7.5 Daily Safety Toolbox Talk

- **What:** toolbox talk record.
- **How to open:** EHS → **Daily Safety Toolbox Talk** → **Open Form**.
- **Fields:** Date, Shift, Time From, Time To, Prepared By, Topic Discussed, No. of Attendees.
- **Photos:** Attendance Sheet, Session Photo 1, Session Photo 2.

---

## 2.8 Production

- **Who:** production / boiling house / chemist.
- **Dashboard:** none of these five feed BI Control Tower.
- **Shifts on chemist sheet:** 8–4, 4–12, 12–8 (not A/B/C).

### 2.8.1 Shift Chemist Job Log Book

- **How to open:** **Production** → **Shift Chemist Job Log Book** → **Open Form**.
- **General:** Date, Season, Instructions / Remarks.
- **Each shift (8–4, 4–12, 12–8):** Jobs Done, Jobs To Be Done, Chemist Sign.

### 2.8.2 A-Centrifugal Machine Stoppage Log Book

- **How to open:** **Production** → **A-Centrifugal Machine Stoppage Log Book** → **Open Form**.
- **General:** Date, Shift.
- **Parameters:** S.H.W. Temp (°C), S.H.W. Pressure (Kg/cm²), Air Pressure (Kg/cm²).
- **Machines No.1, No.2, No.3 NHEC, No.4 WB:** Basket Cleaning, Screen Condition, From, To, Duration, Reasons, Separator, Remarks.
- **Sign-off:** Operator / Chemist / Section Head `[TO CONFIRM]` exact labels on your build.

### 2.8.3 Pan Log Book

- **How to open:** **Production** → **Pan Log Book** → **Open Form**.
- **Strike / lab groups:** Massecuite Grade, Strike No., Pan No., times, Qty, lab purity / Brix (as on the form).

### 2.8.4 Decanter Log Book

- **How to open:** **Production** → **Decanter Log Book** → **Open Form**.
- **Time slots:** 8 AM–9 AM through 7 AM–8 AM (24 slots).
- **1st Stage / 2nd Stage:** mud, centrate, floc, load, torque, vibration (as on the form).

### 2.8.5 Clarification Log Book

- **How to open:** **Production** → **Clarification Log Book** → **Open Form**.
- **Instructions:** HOD / Dy HOD / Sectional Head (as on the form).
- **Hourly:** Juice Flow (T/Hr), MOL dose, pH, temperatures.

---

## 2.9 Brix Sampling Forms

- **Who:** cane quality / field staff.
- **Dashboard:** Cane Quality (Field Sampling / Yard Sampling).
- Hub list may show **GSMA** in the title; the form heading may hide that prefix.

### 2.9.1 Yard Brix Sampling Form 23-24

- **How to open:** **Brix Sampling Forms** → **Yard Brix Sampling Form 23-24** → **Open Form**.
- **Groups:** Record Info, Origin, Transport, Cane Details, Quality.
- **Key fields:** Sampling Date, Delivery Point, Truck Number, Variety, Middle Brix %, crop condition flags.

### 2.9.2 Field Brix Sampling Form 23-24

- **How to open:** **Brix Sampling Forms** → **Field Brix Sampling Form 23-24** → **Open Form**.
- **Required:** Sampling Date, Name, Test Type, Grower Name, Village Name, Variety of Cane, Land Type, Soil Type, Crop Type, Field Condition, Crop Condition, Sampling Point, Bottom Brix %, Middle Brix %, Top Brix %.
- **Where it goes:** Cane Quality → Field Sampling.

[Screenshot: 02-brix-field — Field Brix Sampling, annotate: required Brix % boxes]

---

## 2.10 Editing, View Data, and form approvals

- There is no separate **Save draft** on these logbooks.
- **View Data** (phone **View Logs**) lists stored rows.
- Admins can edit/delete a row when it has no open approval and you are not view-only.
- Badges: pending / needs modification / resubmitted.
- If Forms Approval is on, the HOD uses **Approvals** → **Forms** (chapter 5).

[Screenshot: 02-approvals-forms — Approvals Forms tab, annotate: Approve and Send for modification]

## 2.11 Common mistakes

- Wrong date or shift — row sits on another shift.
- Duplicate **Submit** — two rows; ask admin to remove extras if allowed.
- View-only login — cannot submit.
- Sent back by HOD — correct and submit again (resubmit).
- Wrong unit (Qtls vs T) — dashboard looks impossible.
- Mill names blank on dashboard — mapping file not uploaded (chapter 6).
