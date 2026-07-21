# Notification channels

| Channel | Provider | Used for | Not used for |
| ------- | -------- | -------- | ------------ |
| **Push mobile** | Expo Push → APNs / FCM | In-app alerts from `public.notifications` | Auth e-mail, marketing e-mail |
| **E-mail** | Brevo SMTP (Supabase Auth) | Sign-up, magic link, password reset | Mobile push, inbox rows |
| **Inbox** | Supabase `notifications` table | History, read state, Realtime | Direct APNs (always via push pipeline when `push_enabled`) |

Mobile users opt in via OS permission + `user_preferences.push_enabled`.  
Per-type toggles: social, rewards, nearby, followed creator, reminders, discovery (see Settings → Notifications).

**Manual push from Brevo:** not supported with current architecture. Use SQL INSERT into `notifications` or Expo API with a device token for tests.

See [PUSH_NOTIFICATIONS runbook](../runbooks/PUSH_NOTIFICATIONS.md) for operations.
