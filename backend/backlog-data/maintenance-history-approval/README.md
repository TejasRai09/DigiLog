# Maintenance History HOD Approval

Optional email approval for **Sugar House** and **Power Plant** equipment maintenance history (add / edit / delete on individual records).

Production House is **not** included.

## Production setup

```bash
cd backend
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval.sql
# deploy backend + frontend
# ensure SMTP_* and CLIENT_ORIGIN are set in backend/.env
```

### Admin configuration

1. Open **Admin → Config → Maintenance History Approval**
2. For **Sugar House** and/or **Power Plant**:
   - Select the **HOD employee** (must have an active DigiLog account with email)
   - Toggle **Enable HOD approval**
3. Click **Save**

When disabled, maintenance history saves directly to the database (existing behaviour).

When enabled:

- User add/edit/delete → pending request + email to HOD
- HOD email shows field diff (old → new on updates) with **Accept** and **Send for modification** buttons
- **Accept** → change applied to `shn_history` or `ppn_history`; submitter notified
- **Send for modification** → change discarded; submitter emailed to contact HOD

Approval links expire after **7 days**.

## SMTP environment variables

Required in `backend/.env` (same as account activation mail):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLIENT_ORIGIN` — used for approval links in emails (e.g. `https://your-digilog-host`)

## Database

- `maintenance_history_approval_request` — pending/approved/rejected requests
- `portal_settings` keys:
  - `mh_approval_sugar_enabled`, `mh_approval_power_enabled`
  - `mh_approval_sugar_hod_user_id`, `mh_approval_power_hod_user_id`

## API (reference)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET/PUT /api/admin/maintenance-history-approval-settings` | Admin | Toggle + HOD picker |
| `GET /api/maintenance-approval/accept?token=` | Public | HOD accept (HTML) |
| `GET /api/maintenance-approval/reject?token=` | Public | HOD reject (HTML) |
| `POST /api/sugar-new\|power-new/:id/history` | User | Returns `202` when approval queued |
| `POST .../history-approval/:requestId/documents` | User | Stage pending document uploads |

Frontend landing pages (optional fallback): `/maintenance-approval/accept?token=...` and `/maintenance-approval/reject?token=...`

HOD email buttons link directly to `/api/maintenance-approval/accept|reject?token=...` — a simple confirmation page, no app login.
