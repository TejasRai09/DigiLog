# Maintenance History HOD Approval

Optional email approval for **Sugar House**, **Power Plant**, and **Production House** equipment maintenance history (add / edit / delete on individual records).

**HOD approvals do not require DigiLog login.** The daily digest opens a public token inbox where the HOD can review, approve selected rows, approve remaining, or resend the pending list to email.

## Production setup

```bash
cd backend
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval.sql
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_digest.sql
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_workflow.sql
npm run db:apply-sql -- ../mysql/migrate_user_notifications.sql
npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_production.sql
# deploy backend + frontend
# ensure SMTP_* and CLIENT_ORIGIN are set in backend/.env
# restart backend (digest scheduler runs inside the Node process)
```

### Admin configuration

1. Open **Admin → Config → Maintenance History Approval**
2. For **Sugar House**, **Power Plant**, and/or **Production House**:
   - Select the **HOD employee** (must have an active DigiLog account with email)
   - Set **Daily digest time (IST)** — default `22:00` (10:00 PM)
   - Toggle **Enable HOD approval**
3. Click **Save**
4. Optional: **Resend full digest** or **Email new pending only** if the HOD missed the mail

When disabled, maintenance history saves directly to the database (existing behaviour).

When enabled:

- User add/edit/delete → pending request queued (no immediate email to HOD)
- At the configured **daily digest time (IST)**, one email is sent to the HOD with pending changes
- Primary CTA: **Open approvals inbox (no login)** → `/api/maintenance-approval/inbox?token=`
- Inbox supports:
  - **Review** modal (field diffs + photos + documents) → Accept / Send for modification; row drops off the list
- Per-row **Review** in the email opens the same inbox with that row’s modal
- **Accept** → change applied to `shn_history`, `ppn_history`, or `phn_history`; submitter notified
- **Send for modification** → change discarded; submitter emailed

Review and approve/reject links expire after **7 days** (refreshed on each digest).

## Daily digest behaviour

| Event | Behaviour |
|-------|-----------|
| User saves 10 rows same day | 0 immediate emails; 1 digest at configured time with 10 entries |
| HOD accepts 1 of 10 | Only that row applied; others stay pending |
| Entry after digest time | Included in **next day's** digest |
| Zero pending same day | No email sent; day not marked sent until there is something to send |
| Server missed digest window | Catch-up on next tick when IST time ≥ digest time and day not yet marked sent |
| Digest already sent, admin changes time to **later than now** (IST) | Today's "sent" marker is cleared; digest can send again at the new time |
| Admin resend | Force-sends again (all pending, or **new** = never notified) |

Times are evaluated in **Asia/Kolkata (IST)**.

## SMTP environment variables

Required in `backend/.env` (same as account activation mail):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLIENT_ORIGIN` — used for approval links in emails (e.g. `https://your-digilog-host`)

## Database

- `maintenance_history_approval_request` — pending/approved/rejected requests; `hod_notified_at` when included in a digest
- `portal_settings` keys:
  - `mh_approval_sugar_enabled`, `mh_approval_power_enabled`, `mh_approval_production_enabled`
  - `mh_approval_sugar_hod_user_id`, `mh_approval_power_hod_user_id`, `mh_approval_production_hod_user_id`
  - `mh_approval_sugar_digest_time`, `mh_approval_power_digest_time`, `mh_approval_production_digest_time` (HH:mm, default `22:00`)
  - `mh_approval_sugar_digest_last_sent_date`, `mh_approval_power_digest_last_sent_date`, `mh_approval_production_digest_last_sent_date` (YYYY-MM-DD IST)

## API (reference)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET/PUT /api/admin/maintenance-history-approval-settings` | Admin | Toggle, HOD picker, digest time |
| `POST /api/admin/maintenance-history-approval-settings/resend-digest` | Admin | `{ domain, mode: 'all'\|'new' }` force email |
| `GET /api/maintenance-approval/inbox?token=&open=` | Public | No-login inbox (modal review) |
| `GET /api/maintenance-approval/document?token=` | Public | View/download attachment from review modal |
| `GET /api/maintenance-approval/review?token=` | Public | Redirects pending items to inbox |
| `POST /api/maintenance-approval/review` | Public | JSON payload for review modal |
| `GET/POST /api/maintenance-approval/accept` | Public | Accept one entry |
| `GET/POST /api/maintenance-approval/reject` | Public | Send for modification |
| `POST /api/sugar-new\|power-new/:id/history` | User | Returns `202` when approval queued |
| `POST .../history-approval/:requestId/documents` | User | Stage pending document uploads |

## Selective approval

The inbox lists each pending entry. Approving one row does not approve the rest.
