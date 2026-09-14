# Matrice de génération des push — SCRUM-242

## Lecture produit (à lire en premier)

Deux canaux pour l’utilisateur :

1. **L’écran Notifications** dans l’app (l’historique).
2. **La bannière sur le téléphone** (push). On peut avoir le premier sans le second (l’utilisateur a coupé les push, c’est la nuit, ou le quota du jour est atteint).

Trois façons de déclencher un message :

| Famille | En français | Exemples |
| --- | --- | --- |
| Dans l’app | Un membre fait quelque chose | Me suivre, aimer, s’approcher d’un lieu, inviter |
| Modération | Un opérateur clique dans la console web | Valider / refuser une suggestion, bannir, trier une photo |
| Automatique | Personne n’a cliqué | « Nouvel événement près de chez toi », « ça commence dans les 24 h », récap du matin |

**En test aujourd’hui (DEV et UAT, 14 septembre 2026)** : les bannières téléphone sont **éteintes**. Publier le catalogue scrapé **ne prévient personne**. Le seul message encore créé tout seul est le rappel **« cet événement commence dans les 24 heures »**, et seulement dans l’app.

Le scrape OpenAgenda n’envoie **aucune** notif : il met les fiches en file d’attente. C’est le clic modo « publier » (ou la publication de masse) qui *pourrait* alerter le quartier — et c’est précisément ça qui a été coupé, pour ne pas spammer sur des dizaines de milliers de fiches.

Préférences utilisateur qui coupent (quand le canal sera rallumé) : interrupteur général push ; social ; rappels ; près de chez moi ; « moments en cours près de moi » (off par défaut) ; nuit ; max 3 push / jour. Les messages **critiques** (refus, ban, photo refusée, etc.) passent la nuit et le quota, mais **pas** l’interrupteur général.

Reco courte :

- **Garder** : alerte proximité (opt-in), follow/like, messages modo (suggestion, photo, compte), « près de chez moi » **uniquement** pour une vraie publication humaine — pas le dump catalogue.
- **Couper pour l’Alpha** : follow d’organisateur, Lumo/missions, Discovery, concours, invitation privée.
- **Recaler** : le rappel 24 h arrive trop tôt / trop souvent ; « demander un correctif » ne doit pas partir aussi comme un refus.

Le détail technique (fichiers, triggers, crons) commence à la section suivante.

---

Analyse **code + snapshot live DEV/UAT** au **14 septembre 2026**.  
Livrable produit + QA. Aucun refactor du pipeline.

Pipeline unique (quand le trigger est actif) :

`INSERT public.notifications` → `trg_notifications_push_dispatch` → Edge `push-dispatch` → Expo (APNs / FCM).

L’inbox est la ligne SQL. L’OS push est une décision **ultérieure** de l’Edge (sauf si l’insert est lui-même skippé par une pref SQL).

Sources vérifiées : repos `mobileApp`, `MomentsLocaux---Moderation-WebConsole`, `Moments-Locaux-Scrapper` ; Postgres `moments-locaux-dev` (`prymkgkafaovhzopslea`) et `moments-locaux-uat` (`ieehuzeotwagkkprohjr`).

---

## 1. Constat live (DEV = UAT)

**Les 11 triggers métier + le dispatch push sont DISABLED** sur les deux projets :

| Trigger | Table | État live 2026-09-14 |
| --- | --- | --- |
| `trg_notifications_push_dispatch` | `notifications` | disabled |
| `trg_events_notify_status` | `events` | disabled |
| `trg_events_notify_fanout` | `events` | disabled |
| `follows_notify` | `follows` | disabled |
| `event_likes_notify` | `event_likes` | disabled |
| `user_missions_notify` | `user_missions` | disabled |
| `trg_warnings_notify_insert` | `warnings` | disabled |
| `trg_profiles_notify_ban` | `profiles` | disabled |
| `trg_event_media_submissions_notify_status` | `event_media_submissions` | disabled |
| `trg_contest_entries_notify_status` | `contest_entries` | disabled |
| `trg_reports_notify_escalation` | `reports` | disabled |

Conséquence :

- **Aucun OS push automatique** aujourd’hui (dispatch off).
- Les **crons** continuent d’insérer des lignes inbox (`event_soon` surtout).
- La **console** peut encore `INSERT` (request-changes, ban, warn, contest results, correction).
- Le mobile peut encore `INSERT` une invitation privée ; le RPC proximité peut encore insérer si appelé.

Park historique : migration **live-only** `park_event_publish_notification_triggers` (DEV `20260804144251`, **absente du repo**). Les publications continuent (77 729 events `published` en DEV, dernier publish le 14/09) **sans** fan-out nearby ni notif créateur.

Le scrapper **n’est pas** une origine push : il insère `status = pending`. La publication est console / RPC.

---

## 2. Origines — règle de lecture

| Origine | Signifie | Exemples |
| --- | --- | --- |
| **Mobile** | L’action utilisateur dans l’app est la cause | follow, like, proximité live, invitation privée |
| **Console** | L’action opérateur est la cause (même si un trigger SQL fait l’insert) | approuver, refuser, correctifs, ban, média, concours |
| **Backend** | Cron, RPC sans UI, ou **effet de bord** d’une publication (fan-out nearby / followed) | `event_soon`, digests, discovery, nearby à la publish |

Aucun cas orphelin : chaque type d’enum a une origine **ou** est marqué mort / jamais inséré.

---

## 3. Gates transverses (`push-dispatch`)

Fichier : `mobileApp/supabase/functions/push-dispatch/index.ts`.

| Gate | Effet | Bypass |
| --- | --- | --- |
| `push_enabled = false` | skip OS (`push_disabled`) ; **inbox conservée** | **aucun** (y compris types critiques) |
| Pref famille (`notify_social`, `notify_rewards`, nearby, proximity, followed, reminders, discovery + Éclaireur) | skip OS ; inbox déjà créée ou non selon le SQL | — |
| Quiet hours (`Europe/Paris`, `quiet_hours_start` / `end`) | skip OS | types **critiques** |
| `max_push_per_day` (défaut 3) via `count_user_notifications_today` | skip OS | types **critiques** |
| Pas de token `device_push_tokens` | `no_tokens` | — |

**Critiques** (quiet + budget seulement, **pas** `push_enabled`) :

`user_banned`, `warning_received`, `event_refused`, `event_request_changes`, `media_rejected`, `contest_entry_refused`, `moderation_escalation`.

**Pas critiques** : `event_published`, `media_approved`, `system` (digest, invite, correction), nearby / live / soon, social, rewards, discovery, `contest_results`.

Prefs SQL vs client (`preferences.service.ts` defaults) :

| Pref | Défaut client | Défaut SQL / `coalesce` |
| --- | --- | --- |
| `notify_followed_creator` | **false** | SQL default **true** ; fan-out `coalesce(..., true)` |
| `notify_rewards` | **false** | `deliver_user_notification` `coalesce(..., true)` |
| `notify_proximity_live` | false | false (aligné) |
| `notify_event_reminders` | true | true |
| `notify_event_nearby` | true | true |
| `notify_social` | true | true |
| `notify_frequency` | instant | instant ; daily/weekly → `notification_digest_queue` pour nearby + followed |

Flags Alpha (`src/config/features.ts`) : `socialPeers` ON ; `eventSuggest` / `lumiaChat` ON en preview/prod ; `eventCreate`, `checkin`, `gamification`, `discovery`, `contests` OFF.  
`app_config.gamification_enabled = true` en DEV (SQL shop/missions **pas** aligné sur le flag mobile).

---

## 4. Matrice par type

Légende **Alpha** : `in-scope` = canal Alpha ; `parké` = ADR 002 / flags OFF ; `mort` = enum ou insert sans chemin réel.

**Live** = inséré en DEV (historique ou 14 j). UAT ≈ vide (1 `system`).

### 4.1 Découverte locale (Alpha)

| Type | Origine | Déclencheur | Timing | Destinataire | Pref / flag | Bypass | Inbox vs OS | Alpha | Live DEV | Code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event_nearby_new` | **Backend** (effet de bord publish console) | `trg_events_notify_fanout` → `notify_event_published_fanout` | Immédiat si `notify_frequency=instant` ; sinon digest 07:00 | Users avec `home_location` dans `notify_radius_km`, thèmes `preferred_category_slugs`, hors créateur | `notify_event_nearby` ; visibilité ≠ private ; skip si `app.skip_publish_fanout=on` (RPC mass publish) | non | insert → les deux ; pref off → rien | in-scope | **0 ligne** (fanout disabled depuis ~04/08) | `20260608_notifications_event_fanout.sql` ; live = scrapper `20260901` (skip fanout, **pas** `community_suggest`) |
| `event_nearby_live` | **Mobile** | Task `proximity-live-alerts` → RPC `report_proximity_live_alerts` | Immédiat ; anti-dupe 24 h / event ; throttle client | L’utilisateur qui s’approche (≤ 500 m, live ou bientôt) | `notify_proximity_live` **opt-in false** ; thèmes | non | pref off → rien | in-scope | 0 | `20260801_push_p0_live_proximity.sql` ; `src/tasks/proximity-location.ts` |
| `event_soon` | **Backend** | Cron `event-soon-reminders` `*/30 * * * *` → `notify_events_starting_soon(24)` | Fenêtre **24 h** ; 1 ligne / (user, event) à vie | Créateur ∪ `event_interests` ∪ `favorites` | `notify_event_reminders` | non | insert → les deux (aujourd’hui inbox only, dispatch off) | in-scope | **909** (7–84 / j récemment) | `20260608_notifications_event_soon_cron.sql` |
| `system` digest | **Backend** | Crons `notification-digest-daily` `0 7 * * *` ; `notification-digest-weekly` `0 7 * * 1` Europe/Paris | Flush file daily/weekly | Users frequency daily/weekly | File : nearby + followed seulement | non | 1 `system` `kind=notification_digest` | in-scope (nearby) / parké (followed) | 0 digest en queue ; 0 kind digest | `20260722_notifications_delivery_hardening.sql` |

### 4.2 Social pairs (Alpha)

| Type | Origine | Déclencheur | Timing | Destinataire | Pref / flag | Bypass | Inbox vs OS | Alpha | Live DEV | Code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `social_follow` | **Mobile** | `INSERT follows` → `follows_notify` → `notify_follow` | Immédiat | Compte suivi | `notify_social` ; flag `socialPeers` | non | pref off → **rien** (SQL + Edge) | in-scope | 117 (dernier 07/09) | Fonction : `20260722_...sql`. **Trigger absent des migrations repo**, présent live mais **disabled** |
| `social_like` | **Mobile** | `INSERT event_likes` → `event_likes_notify` → `notify_like` | Immédiat | Créateur de l’event | `notify_social` | non | pref off → rien | in-scope | 664 (dernier 30/07) | idem |

### 4.3 Console / trust / suggestion (Alpha)

L’approbation console **ne** fait **pas** `sendNotification` : elle `UPDATE events.status`. Le trigger SQL (aujourd’hui disabled) est l’implémentation.

| Type | Origine | Déclencheur | Timing | Destinataire | Pref / flag | Bypass | Inbox vs OS | Alpha | Live DEV | Code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event_published` | **Console** | Approuver / bulk / RPC mass publish → `notify_event_status_transition` pending→published | Immédiat | `creator_id` | aucune | non | toujours insert | in-scope via **eventSuggest** (pas `eventCreate`) | 27 (dernier 28/07) | `20260911_cover_quota_and_suggest_organizer.sql` (copy suggest) **non appliqué** live ; live = scrapper 20260901 + skip fanout |
| `event_refused` | **Console** | Refuser **ou** « demander un correctif » (`status=refused`) | Immédiat | créateur | aucune | **oui** | toujours insert | in-scope (suggest) | 9 | Trigger pending→refused. Request-changes console pose aussi `refused` → **ce type part en plus** du `event_request_changes` |
| `event_request_changes` | **Console** | `requestEventChanges` → `sendNotification` type `event_request_changes` | Immédiat | créateur | aucune | **oui** | insert console | in-scope | 1 (12/02) | Console `moderation.service.ts` `requestEventChanges`. Trigger SQL pending→**draft** **jamais utilisé** par la console |
| `warning_received` | **Console** | `warnUser` INSERT `warnings` + `sendNotification` ; trigger `notify_warning_created` si level &lt; 3 | Immédiat | user | aucune | **oui** | **doublon** console + trigger si les deux actifs | in-scope | 1 | **Pas de bouton UI** warn ; service existe. Trigger archive `202602111620` |
| `user_banned` | **Console** | `banUser` UPDATE `profiles` + `sendNotification` ; trigger `notify_profile_ban` | Immédiat | user | aucune | **oui** | **doublon** si les deux actifs | in-scope | 2 (titres trigger « Compte bloqué ») | Console copy « Compte suspendu » |
| `media_approved` | **Console** | Approuver média → trigger (console n’insère pas) | Immédiat | `author_id` | aucune | non | insert trigger | in-scope | 12 | archive `notify_media_submission_status` |
| `media_rejected` | **Console** | Refuser média → trigger | Immédiat | auteur | aucune | **oui** | insert trigger | in-scope | 2 (dont 12/09) | idem |
| `moderation_escalation` | **Console** | Report → `escalated` → `notify_report_escalation` | Immédiat | `reporter_id` | aucune | **oui** | insert trigger | in-scope | 3 | archive. Tap mobile → event/inbox, **jamais** écran admin (ADR 001) |
| `system` correction | **Console** | Review taxonomy-only `kind=event_correction_review` | Immédiat | proposant | aucune | non | insert console | in-scope (corrections Alpha) | 12 | `finalizeCorrectionWithoutRpc` |

**Mass publish catégorisés** : RPC `publish_pending_categorized_events` pose `app.skip_publish_fanout=on`. Live, les fonctions status + fanout **lisent** ce GUC. UI console : « nearby ne partent pas ». Vrai **si** le fanout est réactivé. Copy créateur `event_published` est aussi skippée par le même GUC.

**Suggestion affiche (SCRUM-118)** : même triggers ; copy suggest seulement dans `20260911` **pas** en DEV/UAT (`community_suggest` absent du body live).

### 4.4 Créateur / follow orga (parké Alpha scraper)

| Type | Origine | Déclencheur | Timing | Destinataire | Pref / flag | Bypass | Alpha | Live DEV | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `followed_creator_published` | **Backend** | Même fanout que nearby | Instant ou digest | Followers du `creator_id` | `notify_followed_creator` (SQL true / client false) ; skip `community_suggest` seulement après 20260911 | non | **parké** ADR 002 (supply scraper, pas de follow orga) | 18 (jusqu’au 28/07) | Pref UI seulement si `eventCreate` |
| `system` `private_invite` | **Mobile** | `NotificationsService.notifyPrivateAudience` à la création | Immédiat | audience privée | RLS créateur+private ; pas de pref famille | non | **parké** (`eventCreate` OFF) | 2 | Client écrit `data.eventId` ; RLS historique checke `event_id` |

### 4.5 Gamification (V2, parké)

| Type | Origine | Déclencheur | Timing | Destinataire | Pref / flag | Bypass | Alpha | Live DEV | Code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mission_completed` | **Mobile** | `user_missions.completed` false→true | Immédiat | user | `notify_rewards` ; `is_gamification_enabled()` | non | parké | 4 | Trigger live disabled ; **pas dans les migrations repo** |
| `lumo_reward` | **Backend** | RPC `buy_item` ; cron `award-earned-creator-boosts` `20 * * * *` | Immédiat | acheteur / créateur | `notify_rewards` ; `gamification_enabled` | non | parké | 0 | `20260808_shop_v1_effects_caps.sql` ; `20260727_...` |
| `boost_expired` | **Backend** | Cron `boost-expiry-sweep` `*/15 * * * *` → `delete_expired_boosts` | Toutes les 15 min | détenteur | `notify_rewards` | non | parké | 0 | idem |

Check-in (`FEATURE_CHECKIN`) : **aucun** type / insert notif (`event-checkin`). Parké V1, hors matrice push.

### 4.6 Discovery Engine (V2, parké)

Crons **actifs** en DEV/UAT malgré le flag mobile OFF. Gates SQL : prefs discovery + consentements + entitlement Éclaireur `moments_locaux_plus`. Pas de section Discovery dans Settings.

| Type | Origine | Cron | Timing | Alpha | Live DEV |
| --- | --- | --- | --- | --- | --- |
| `discovery_right_now` | Backend | `discovery-push-opportunities` `*/30 * * * *` | Enqueue immédiat | parké | 3 (21/07) |
| `discovery_break_loop` | Backend | même job | idem | parké | 0 |
| `discovery_personal_match` | Backend | même job | + budget `max_push_per_day` **avant** insert | parké | 0 |
| `discovery_life_insight` | Backend | `discovery-life-insight-pushes` `30 5 * * *` | quotidien | parké | 0 |
| `discovery_new_area` | — | **aucun enqueue** | — | **mort** | 0 |

Jobs satellites (pas d’insert notif) : `discovery-generate-insights` 04:15, `discovery-recalculate-profiles` 03:00, `discovery-match-outcomes` `0 */6`.

### 4.7 Concours (V2, parké)

| Type | Origine | Déclencheur | Bypass | Alpha | Live DEV |
| --- | --- | --- | --- | --- | --- |
| `contest_entry_refused` | **Console** si `refused` (insert) ; **Backend** trigger si `hidden`/`removed` | `updateContestEntryStatus` | **oui** | parké | 7 (21/07) |
| `contest_results` | **Console** | `announceContestJury` fan-out participants | non | parké | 0 |
| `system` (entry `active`) | Backend trigger | validation participation | non | parké | mélange `system` |
| `contest_opened` / `contest_ending_soon` | — | Routing TS seulement, **pas dans l’enum** | — | mort | — |

### 4.8 Morts / invalides

| Identifiant | Statut |
| --- | --- |
| `restriction_lifted` | Console `liftUserRestriction` — **absent de l’enum** → insert échoue |
| `discovery_new_area` | Enum + Edge + TS ; **aucun INSERT** |
| `contest_opened`, `contest_ending_soon` | `notification-routing.ts` seulement |

---

## 5. Enum complet (25 valeurs)

`event_published`, `event_soon`, `lumo_reward`, `mission_completed`, `boost_expired`, `social_follow`, `social_like`, `system`, `event_refused`, `event_request_changes`, `warning_received`, `user_banned`, `media_approved`, `media_rejected`, `contest_entry_refused`, `moderation_escalation`, `event_nearby_new`, `followed_creator_published`, `discovery_right_now`, `discovery_break_loop`, `discovery_new_area`, `discovery_personal_match`, `discovery_life_insight`, `contest_results`, `event_nearby_live`.

---

## 6. Crons notifs (identiques DEV ; UAT sans `diffuseur-monthly-boost-credits`)

| Job | Schedule | Insert notif ? |
| --- | --- | --- |
| `event-soon-reminders` | `*/30 * * * *` | `event_soon` |
| `notification-digest-daily` | `0 7 * * *` | `system` digest |
| `notification-digest-weekly` | `0 7 * * 1` | `system` digest |
| `boost-expiry-sweep` | `*/15 * * * *` | `boost_expired` |
| `award-earned-creator-boosts` | `20 * * * *` | `lumo_reward` possible |
| `discovery-push-opportunities` | `*/30 * * * *` | 3 types discovery |
| `discovery-life-insight-pushes` | `30 5 * * *` | `discovery_life_insight` |
| `diffuseur-monthly-boost-credits` | `15 4 1 * *` (DEV only) | non |

---

## 7. Écarts doc vs code

| Doc | Écart |
| --- | --- |
| `QA_MATRIX.md` follow / like / mission → push | Triggers **disabled** live ; **absents des migrations** du repo (créés hors bande). QA non reproductible tant que non réactivés + versionnés |
| QA follow → « Creator profile » | Code → `/community/{follower}` si `socialPeers` |
| QA mission → « Missions tab » | Code → **inbox** |
| QA Discovery → « Discovery » | Code → **inbox** |
| QA private invite → « RPC » | **Insert client** `system` + `private_invite` |
| QA social/rewards off → inbox ✗ | Vrai si `deliver_user_notification` ; l’Edge seul laisserait l’inbox |
| Runbook crons | OK vs live. Ne dit **pas** que tous les triggers sont parked |
| Runbook / CHANNELS : prefs Discovery dans Settings | Colonnes SQL oui ; **pas d’UI Settings** |
| CHANNELS lien runbook `../runbooks/` | Fichier réel : `infra/runbooks/PUSH_NOTIFICATIONS.md` |
| Spec §7.8 MVP-core nearby + social + trust + médias | Aligné **intention**. Live : nearby **0**, dispatch **off**, social triggers **off** |
| Spec / ADR : `followed_creator` hors MVP scraper | Code fan-out encore là (disabled). Client default false vs SQL true |
| ADR 001 pas de route admin | OK (`notification-routing.ts`) |
| Console soft-flag `notificationSent: true` sur approve | **Pas** d’insert console ; dépend du trigger (off) |
| `20260911` copy community_suggest | **Non appliqué** DEV/UAT ; live a `skip_publish_fanout` sans suggest |
| `gamification_enabled=true` DEV | Mobile `FEATURE_GAMIFICATION` OFF |

---

## 8. Recos produit (sans implémenter)

### Garder (quand on redémarre le canal)

1. **Proximité live** — opt-in, anti-dupe, hors blast catalogue.
2. **Social pairs** (follow / like) — cœur MVP, volume borné par l’activité réelle.
3. **Trust critique** (refus, correctifs, ban, warn, média rejeté, escalation) — bypass quiet/budget justifié ; tap ≠ admin.
4. **Statut suggestion affiche** (`event_published` / refused / request_changes) — pertinent Alpha `eventSuggest`.
5. **Nearby publish** — pertinent produit, **à condition** d’exclure le bulk scraper (déjà le but de `skip_publish_fanout`).

### Couper / laisser parké pour Alpha

1. **Fan-out nearby / followed sur chaque publish** tant que 77 k events scraper et triggers off — le park est rationnel.
2. **`followed_creator_published`** — hors ADR scraper ; ne pas réactiver avec le nearby.
3. **Discovery \*** — crons encore actifs, types parkés, 0 UI prefs : **désactiver les jobs** en Alpha (pas seulement le flag client).
4. **Lumo / missions / boost** — V2 ; `gamification_enabled` SQL à remettre à `false` en DEV pour éviter des inserts si triggers/RPC tournent.
5. **Concours** — V2 ; `contest_opened` / `ending_soon` à oublier.
6. **Check-in** — pas de push, ne pas en inventer.

### Revoir le timing

1. **`event_soon` 24 h + scan `*/30`** — anti-dupe OK, mais **c’est le seul flux encore vivant** (7–84 lignes/j ; ~11–21 notifs / user test sur 14 j). Trop tôt vs un vrai « ça commence » ([SCRUM-196](https://moments-locaux.atlassian.net/browse/SCRUM-196)) ; trop large vs J+1 ([SCRUM-69](https://moments-locaux.atlassian.net/browse/SCRUM-69)). Reco : limiter aux **favorites / interests**, pas au créateur scraper, et/ou rapprocher la fenêtre.
2. **Request-changes** — aujourd’hui `refused` + insert `event_request_changes` = **deux** types (refus critique + correctif). Aligner sur pending→draft **ou** n’envoyer que `event_request_changes`.
3. **Digests 07:00** — OK ; inutiles tant que nearby/followed sont parked.
4. **Quiet hours / budget** — garder ; `push_enabled` qui coupe aussi le critique : à trancher (compte banni sans bannière OS si master off).

### Ops avant tout changement de trigger

1. Réactiver **`trg_notifications_push_dispatch` seul** si on veut tester l’OS push sur `event_soon` / inserts console — **sans** réactiver le fan-out.
2. Versionner dans le repo le park (`park_event_publish_notification_triggers`) et les `CREATE TRIGGER` follow/like/mission.
3. Trancher `20260911` (copy suggest) vs `20260901` (skip fanout) : les deux doivent coexister, last-apply gagne aujourd’hui.
4. Ne pas réactiver `trg_events_notify_fanout` sur DEV tant que le mass-publish skip n’est pas prouvé sur le body **post-20260911**.

---

## 9. Volume DEV (historique `notifications`)

| Type | n | Dernier insert |
| --- | --- | --- |
| `event_soon` | 909 | 14/09/2026 (actif) |
| `social_like` | 664 | 30/07 |
| `social_follow` | 117 | 07/09 |
| `event_published` | 27 | 28/07 |
| `system` | 25 | 09/09 (12 correction, 2 invite, 11 none) |
| `followed_creator_published` | 18 | 28/07 |
| `media_approved` | 12 | 18/08 |
| `event_refused` | 9 | 22/07 |
| `contest_entry_refused` | 7 | 21/07 |
| autres | ≤ 4 | — |
| `event_nearby_new`, `event_nearby_live`, `lumo_reward`, `boost_expired`, `contest_results`, 4/5 discovery | **0** | — |

UAT : 1 ligne `system`.

---

## Références

- Runbook : `infra/runbooks/PUSH_NOTIFICATIONS.md`
- QA : `docs/notifications/QA_MATRIX.md`
- Canaux : `docs/notifications/CHANNELS.md`
- Spec §7.8 : `docs/SPEC_FONCTIONNELLE_APPLICATION_MOBILE.md`
- ADR 001, ADR 002
- Ticket : [SCRUM-242](https://moments-locaux.atlassian.net/browse/SCRUM-242)
