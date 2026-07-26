# Push & inbox — QA matrix

Run on **UAT** with a physical device (Expo dev client or preview build), user with token in `device_push_tokens`.

Legend: **Push** = device banner; **Inbox** = app Notifications screen; **Route** = tap destination.

| Scenario | Setup | Trigger | Push | Inbox | Route |
| -------- | ----- | ------- | ---- | ----- | ----- |
| Smoke | `push_enabled` on | Manual INSERT `system` + `eventId` | ✓ | ✓ | Event detail |
| Global off | `push_enabled` false | Manual INSERT | ✗ | ✓ | — |
| Social follow | `notify_social` on | INSERT `follows` | ✓ | ✓ | Creator profile |
| Social off | `notify_social` false | INSERT `follows` | ✗ | ✗ | — |
| Like | `notify_social` on | INSERT `event_likes` | ✓ | ✓ | Event (`eventId`) |
| Mission | `notify_rewards` on | Complete mission | ✓ | ✓ | Missions tab |
| Rewards off | `notify_rewards` false | Complete mission | ✗ | ✗ | — |
| Nearby instant | `notify_event_nearby`, `home_location`, instant | Publish public event in radius | ✓ | ✓ | Event |
| Nearby digest | frequency **daily** | Publish in radius | ✗ until 07:00 cron | ✗ until flush | Recap → inbox |
| Followed creator | `notify_followed_creator` | Creator publishes | ✓ | ✓ | Event |
| Event soon | `notify_event_reminders` | Event starts < 24h (cron) | ✓ | ✓ | Event |
| Refused event | — | Admin refuses pending event | ✓ | ✓ | My events; body shows `refusal_reason` |
| Daily budget | `max_push_per_day=1`, already 1 notif today | Non-critical INSERT | ✗ `daily_budget` | ✓ | — |
| Quiet hours | quiet 22h–8h, now in window | Non-critical INSERT | ✗ `quiet_hours` | ✓ | — |
| Budget/quiet bypass | same + type `event_refused` | Admin refuse | ✓ | ✓ | My events |
| Themes nearby | slugs set, event other category | Publish in radius | ✗ (no row) | ✗ | — |
| Themes empty | slugs `{}` | Publish in radius | ✓ | ✓ | Event |
| Discovery personal match | discovery master on + `for_you` reco | Cron opportunities | ✓ if prefs | ✓ | Discovery |
| Discovery right now | discovery flags + consents + reco | Cron / data | ✓ if prefs | ✓ | Discovery |
| Private invite | — | Creator private invite RPC | ✓ | ✓ | Event (`eventId`) |

## Release (Phase 6)

- [ ] EAS profile **preview** (UAT) + **production** with APNs production key
- [ ] `app_config` + vault on prod project
- [ ] `push-dispatch` deployed on prod
- [ ] Store listings mention push opt-in (not e-mail marketing)

## Commands (app repo)

```bash
npm run typecheck
npm run lint
```

After edge change: deploy `push-dispatch` to target ref.

After SQL change: apply migrations + run `supabase/ops/app_config/<env>.sql`.
