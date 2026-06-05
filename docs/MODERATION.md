# Moderation and account safety

This guide covers how reports, blocks, and account status work in SpeedSpark, and how to review them in Supabase without a dedicated admin UI.

## Apply migration

Run `supabase/migrations/009_account_safety.sql` in the Supabase SQL Editor after migrations `001`–`008`.

## Data model

### `reports`

| Column | Description |
|--------|-------------|
| `reporter_id` | User who submitted the report |
| `reported_id` | User being reported |
| `context` | `call`, `messages`, or `profile` |
| `speed_date_id` | Optional link to an active/completed speed date |
| `notes` | Optional free-text from reporter |
| `status` | `pending` (default), `reviewed`, `dismissed`, `action_taken` |
| `admin_notes` | Internal moderation notes |

### `profiles.account_status`

| Value | Meaning |
|-------|---------|
| `active` | Normal participation |
| `suspended` | Blocked from queue, matching, and messaging |
| `deleted_request` | User requested deletion; pending admin purge |
| `deleted` | Account removed from public visibility (set by admin) |

Related columns: `deletion_requested_at`, `suspended_at`.

## How reporting works (app)

1. **Active date** — Report button writes a row with `context = 'call'` and optional `speed_date_id`, then ends the date.
2. **Messages** — Report match writes `context = 'messages'`.
3. Users can **create** reports and **read their own** reports only (RLS).
4. Reported pairs are excluded from future server-side matching via `get_window_matching_context`.

Service functions (require **service role** client):

- `fetchReportsForAdmin()` — list all reports
- `updateReportStatus(reportId, status, adminNotes?)` — triage a report

These are used from scripts/Edge Functions with `setDbClientOverride(serviceRoleClient)`, not from the mobile app.

## How blocking works

- Inserts into `blocked_users`.
- During an active speed date, block also cancels the date (`status = cancelled`).
- Blocked pairs cannot be paired (`apply_queue_pair` enforces).
- Blocked users are hidden from each other's profile reads (RLS).

## Account deletion request

Settings → **Delete account** calls `request_account_deletion()` RPC which:

1. Sets `account_status = 'deleted_request'` and `deletion_requested_at`.
2. Leaves any waiting/paired queue entries.
3. Cancels active speed dates for that user.

The client then signs out. Auth user is **not** deleted from the client; an admin completes removal in Supabase.

## Review reports in Table Editor

1. Open Supabase Dashboard → **Table Editor** → `reports`.
2. Filter `status = pending`, sort by `created_at` descending.
3. Open a row and note `reporter_id`, `reported_id`, `context`, `speed_date_id`, `notes`.
4. Cross-reference:
   - `profiles` for both user IDs
   - `speed_dates` if `speed_date_id` is set
   - `messages` / `matches` for message-context reports
   - `blocked_users` for existing blocks
5. Update the report row:
   - Set `status` to `reviewed`, `dismissed`, or `action_taken`
   - Add `admin_notes` with your decision
6. If action is needed on the reported user:
   - Set `profiles.account_status = 'suspended'` and `suspended_at = now()` for temporary ban
   - Or `account_status = 'deleted'` after manual auth/data cleanup

## Suspend or restore a user

In **Table Editor** → `profiles`:

```sql
-- Suspend
update profiles
set account_status = 'suspended', suspended_at = now()
where id = '<user-uuid>';

-- Restore
update profiles
set account_status = 'active', suspended_at = null
where id = '<user-uuid>';
```

Suspended/deleted users cannot join queue, send messages, appear in matching, or be paired.

## RLS summary

| Action | Who |
|--------|-----|
| Insert report | Authenticated reporter (`reporter_id = auth.uid()`) |
| Read own reports | Reporter |
| Read/update all reports | `service_role` only |
| Read profiles | Self always; others only if `account_status = active` and not blocked |
| Request deletion | Own user via `request_account_deletion()` RPC |

## Testing checklist

1. Report from ActiveDate → confirm row in `reports` with `context = call`.
2. Report from Messages → confirm row with `context = messages`.
3. Block during active date → speed date `cancelled`, row in `blocked_users`.
4. Re-queue → blocked pair not matched.
5. Delete account from Settings → `account_status = deleted_request`, signed out.
6. Set `account_status = suspended` in Table Editor → user cannot rejoin queue on login.
