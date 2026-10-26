# 5. Approvals

HOD inbox for three queues. Navbar **Approvals** shows only if you are HOD for history, forms, and/or notes.

## 5.1 Open and tabs

- Path: `/maintenance/approvals`.
- Denied: **Approvals** — *You are not the assigned HOD for maintenance history, Forms Hub, or Maintenance Notes.*
- Tabs (only those you are entitled to):
  - **Maintenance**
  - **Forms**
  - **Maintenance Notes**

[Screenshot: 05-approvals-tabs — Approvals source switcher, annotate: Maintenance, Forms, Maintenance Notes]

[Screenshot: 02-approvals-forms — Approvals Forms tab, annotate: Approve and Send for modification]

## 5.2 Maintenance and Forms (shared desk)

### 5.2.1 Titles

- Maintenance: **Pending maintenance changes**.
- Forms: **Pending form submissions** — *Review pending form submits. Approve them or send them back for modification. The operator can submit the same form again to resubmit.*

### 5.2.2 Summary cards

- **Total Requests**
- **Total Pending**
- **Today's Pending**
- **Previous Pending**
- **Sent for modification**
- **Approved Requests**
- **Conflicts** (if any)

### 5.2.3 Filters

- Search: **Search employee or equipment** (forms: **Search employee or form**).
- Type: **All types** / **Create** / **Update** / **Delete**.
- Status: **Today's pending**, **Previous pending**, **Total pending**, **Resubmitted**, **Sent for modification**, **Approved**.
- Date **from** / **to**.
- **Filter** / **Reset**.
- Empty list: **None**.

### 5.2.4 Actions

- **Approve**.
- **Send for modification** — comment required — **Send back**.
- Bulk: **Select all on this page**, **Approve selected (n)**.
- Conflict: **Apply requested values** or **Discard**.
- Review titles: **Review form submission** / **Review maintenance history change**.
- Toasts: *Approved.*, *Sent for modification.*, *Selected changes approved.*

## 5.3 Maintenance Notes tab

- Title: **Maintenance notes approval**.
- KPIs: **Awaiting you**, **Rework**, **Completed**.
- Search: **Search activity, person, or note**.
- Plant: **All your plants** (or locked plant).
- Statuses: **Approval Pending**, **Rework Required**, **Completed**.
- Actions: **Review**, **View**, **Approve**, **Reject**.
- Reject modal: **Send back for rework** — **Reason (required)** — **Reject**.
- Success: note marked **Completed**, or sent back for rework.

## 5.4 Email (no login)

- Combined digest (IST) can cover Forms + Maintenance History + Maintenance Notes at Time 1 and optional Time 2 (set in Config, chapter 8).
- Forms mail includes **OPEN APPROVALS INBOX (NO LOGIN)**.
- Links expire in **7 days**.
- If the link is dead, sign in and use navbar **Approvals**.
- Exact HTML button labels: `[TO CONFIRM]`.

## 5.5 What each tab approves (feature list)

- **Forms** — Operation Form submits (chapter 2) when Forms Approval is on.
- **Maintenance** — Equipment history create/update/delete (chapter 3) when History Approval is on.
- **Maintenance Notes** — completion of notes (chapter 4).
