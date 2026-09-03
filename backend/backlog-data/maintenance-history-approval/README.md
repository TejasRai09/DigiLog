# Maintenance History HOD Approval

Optional email approval for **Sugar House** and **Power Plant** equipment maintenance history (add / edit / delete on individual records).

Production House is **not** included.

## Production setup

```bash
cd backend
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval.sql
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_digest.sql
# deploy backend + frontend
# ensure SMTP_* and CLIENT_ORIGIN are set in backend/.env
# restart backend (digest scheduler runs inside the Node process)
```

### Admin configuration

1. Open **Admin → Config → Maintenance History Approval**
2. For **Sugar House** and/or **Power Plant**:
   - Select the **HOD employee** (must have an active DigiLog account with email)
   - Set **Daily digest time (IST)** — default `22:00` (10:00 PM)
   - Toggle **Enable HOD approval**
3. Click **Save**

When disabled, maintenance history saves directly to the database (existing behaviour).

When enabled:

- User add/edit/delete → pending request queued (no immediate email to HOD)
- At the configured **daily digest time (IST)**, one email per card is sent to the HOD with **all changes submitted that calendar day**
- Each digest row has a **Review details** link (not the full field table)
- **Review page** (`/api/maintenance-approval/review?token=`) shows every field (previous vs new) plus photos, then **Accept** / **Send for modification**
- HOD can still approve **one entry** without affecting the others
- **Accept** → change applied to `shn_history` or `ppn_history`; submitter notified
- **Send for modification** → change discarded; submitter emailed to contact HOD

Review and approve/reject links expire after **7 days**.

## Daily digest behaviour

| Event | Behaviour |
|-------|-----------|
| User saves 10 rows same day | 0 immediate emails; 1 digest at configured time with 10 entries |
| HOD accepts 1 of 10 | Only that row applied; others stay pending |
| Entry after digest time | Included in **next day's** digest |
| Zero pending same day | No email sent; scheduler still marks the day as processed |
| Server missed digest window | Catch-up on next tick when IST time ≥ digest time and day not yet marked sent |

Times are evaluated in **Asia/Kolkata (IST)**.

## SMTP environment variables

Required in `backend/.env` (same as account activation mail):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLIENT_ORIGIN` — used for approval links in emails (e.g. `https://your-digilog-host`)

## Database

- `maintenance_history_approval_request` — pending/approved/rejected requests; `hod_notified_at` when included in a digest
- `portal_settings` keys:
  - `mh_approval_sugar_enabled`, `mh_approval_power_enabled`
  - `mh_approval_sugar_hod_user_id`, `mh_approval_power_hod_user_id`
  - `mh_approval_sugar_digest_time`, `mh_approval_power_digest_time` (HH:mm, default `22:00`)
  - `mh_approval_sugar_digest_last_sent_date`, `mh_approval_power_digest_last_sent_date` (YYYY-MM-DD IST)

## API (reference)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET/PUT /api/admin/maintenance-history-approval-settings` | Admin | Toggle, HOD picker, digest time |
| `GET /api/maintenance-approval/review?token=` | Public | HOD review page — all fields, then Accept / Reject |
| `POST /api/maintenance-approval/review` | Public | JSON payload for the SPA review page |
| `GET /api/maintenance-approval/accept?token=` | Public | HOD accept one entry (HTML) |
| `GET /api/maintenance-approval/reject?token=` | Public | HOD reject one entry (HTML) |
| `POST /api/sugar-new\|power-new/:id/history` | User | Returns `202` when approval queued |
| `POST .../history-approval/:requestId/documents` | User | Stage pending document uploads |

HOD digest email uses **Review details** → `/api/maintenance-approval/review?token=...` (full field list in the browser, no login). Accept / Reject on that page use the same 7-day tokens.

Frontend landing pages (optional fallback): `/maintenance-approval/review?token=...`, `/maintenance-approval/accept?token=...`, `/maintenance-approval/reject?token=...`

## Selective approval

The digest email lists each pending entry with its own **Review details** link. Approving one row does not approve the rest.
