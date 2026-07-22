# Push notifications — runbook

## Architecture

1. Business logic inserts into `public.notifications`.
2. Trigger `trg_notifications_push_dispatch` → `pg_net` POST → Edge Function `push-dispatch`.
3. `push-dispatch` reads `user_preferences` + `device_push_tokens`, sends to `https://exp.host/--/api/v2/push/send`.
4. Mobile app registers Expo tokens in `device_push_tokens` and routes taps via `resolveNotificationRoute`.

**E-mail (Brevo)** is only used for Supabase Auth SMTP. It does not send mobile push.

## Per-environment setup (Phase 1)

After applying migrations, set the project URL **once per Supabase project**:

| Env | Script |
| --- | ------ |
| DEV | `supabase/ops/app_config/dev.sql` |
| UAT | `supabase/ops/app_config/uat.sql` |

Key: `app_config.supabase_project_url` → `https://<project-ref>.supabase.co`

Alternative: database GUC `app.supabase_project_url` (fallback read by `resolve_push_dispatch_url()`).

### Vault secret

Each project must have Vault secret `push_dispatch_secret` (created by migration `20260608_notifications_push_dispatch.sql`).  
Edge `push-dispatch` validates `x-signature` against `current_push_dispatch_secret()`.

**Checklist per env**

- [ ] Migrations applied (including `20260722_push_dispatch_multi_env.sql`)
- [ ] `app_config.supabase_project_url` set
- [ ] Edge function `push-dispatch` deployed
- [ ] `SELECT public.resolve_push_dispatch_url();` returns correct URL
- [ ] Test INSERT into `notifications` → device receives push

## Debugging failures

### 1. Edge Function logs

Supabase Dashboard → Edge Functions → `push-dispatch` → Logs  
Look for `unauthorized`, `secret_unavailable`, `no_tokens`, or Expo errors.

### 2. pg_net responses

```sql
SELECT id, status_code, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 20;
```

Join with `net.http_request_queue` if needed for the request URL/body.

### 3. No row in `notifications`

Issue is upstream (trigger/SQL prefs). Push dispatch never ran.

### 4. Row in `notifications`, no push

- `push_enabled = false` → edge returns `skipped: push_disabled`
- No token in `device_push_tokens`
- Wrong `app_config` URL (dispatch hits another project)
- iOS entitlements / APNs profile mismatch
- Android: missing FCM V1 service account in EAS credentials, or build without `google-services.json`

## Android FCM (Expo)

1. Firebase Android app package = `com.momentslocs.app`
2. Commit `google-services.json` at repo root (`app.config.ts` → `android.googleServicesFile`)
3. Upload **FCM V1 service account key** (private JSON) via `eas credentials` for each build profile you use (`development`, `preview`, `production`)
4. Rebuild Android (`eas build --platform android --profile …`) — Metro reload is not enough
5. Physical device + accept notification permission → row in `device_push_tokens` with `platform = android`

### 5. Manual smoke test

```sql
INSERT INTO public.notifications (user_id, type, title, body, data)
VALUES (
  '<user-uuid>',
  'system',
  'Test push',
  'Runbook check',
  jsonb_build_object('eventId', '<published-event-uuid>')
);
```

## Crons (after `20260722_notifications_delivery_hardening.sql`)

| Job | Schedule | Function |
| --- | -------- | -------- |
| `event-soon-reminders` | `*/30 * * * *` | `notify_events_starting_soon(24)` |
| `discovery-push-opportunities` | `*/30 * * * *` | right_now + break_loop enqueue |
| `discovery-life-insight-pushes` | `30 5 * * *` | life insight enqueue |
| `notification-digest-daily` | `0 7 * * *` | `flush_notification_digests('daily')` |
| `notification-digest-weekly` | `0 7 * * 1` | `flush_notification_digests('weekly')` |
| `boost-expiry-sweep` | `*/15 * * * *` | `delete_expired_boosts()` |

## Digest queue

Users with `notify_frequency` **daily** or **weekly** buffer `event_nearby_new` and `followed_creator_published` in `notification_digest_queue`.  
Crons flush to a single `system` inbox/push recap (`data.kind = notification_digest`).

## Deploy edge after code changes

```bash
supabase functions deploy push-dispatch --project-ref <ref>
```

Do not apply SQL migrations to production without human validation (project rule).
