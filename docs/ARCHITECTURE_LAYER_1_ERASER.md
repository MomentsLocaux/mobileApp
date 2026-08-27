# Architecture Layer 1 — Moments Locaux

> Document prêt à coller / importer dans [Eraser.io](https://eraser.io).  
> Chaque bloc ` ```eraser ` est du **diagram-as-code** Eraser (Cloud Architecture).  
> Les blocs ` ```sequence ` sont des **sequence diagrams** Eraser.  
> Date : 2026-08-27 · Sources : repos mobileApp, Moderation-WebConsole, Moments-Locaux-Scrapper, moments-locaux-website.

---

## Comment importer dans Eraser

1. Créer un nouveau document Eraser.
2. Coller ce markdown **section par section**, ou importer le fichier `.md`.
3. Pour chaque bloc de code :
   - Architecture → type **Cloud architecture diagram**
   - Sequence → type **Sequence diagram**
4. Ajuster `direction`, couleurs et icônes si besoin.

---

## 1. Schéma système Layer 1 (vue d’ensemble)

```eraser
direction down
colorMode pastel
styleMode plain
typeface clean

Actors [icon: users, color: gray] {
  MobileUsers [icon: user, label: "Utilisateurs mobiles"]
  Moderators [icon: user, label: "Modérateurs ops"]
  WebVisitors [icon: user, label: "Visiteurs web"]
}

Clients [icon: monitor, color: green] {
  MobileApp [icon: smartphone, label: "App mobile Expo/RN"]
  ModConsole [icon: monitor, label: "Console modération"]
  MarketingSite [icon: globe, label: "Site marketing Next.js"]
  ScraperStack [icon: server, label: "Scrapper + Monitor :8787"]
}

Platform [icon: database, color: blue] {
  Supabase [icon: database, label: "Supabase Auth DB RLS Realtime Storage Edge"]
}

Externals [icon: cloud, color: orange] {
  Mapbox [icon: map, label: "Mapbox Maps / Geo / Directions"]
  ExpoPush [icon: notification, label: "Expo Push → APNs / FCM"]
  Brevo [icon: mail, label: "Brevo SMTP / API"]
  TourismAPIs [icon: cloud, label: "Sources OT TS Iris OA Datatourisme…"]
}

MobileUsers > MobileApp: UI
Moderators > ModConsole: UI
WebVisitors > MarketingSite: UI

MobileApp <> Supabase: "HTTPS anon JWT / PostgREST / Realtime / Edge"
ModConsole <> Supabase: "HTTPS anon + role moderateur|admin"
MarketingSite > Supabase: "REST server actions (contact / waitlist)"
ScraperStack > Supabase: "HTTPS service role (staging → events pending)"

ModConsole --> ScraperStack: "HTTP Collecte GET /regions POST /run"

MobileApp > Mapbox: "Tiles / Geocoding / Directions"
ModConsole > Mapbox: Geocoding
ScraperStack > Mapbox: Geocoding
ScraperStack > TourismAPIs: "API / HTML / ICS"

Supabase --> ExpoPush: "Edge push-dispatch"
Supabase --> Brevo: "Auth SMTP (signup / reset)"
MarketingSite --> Brevo: "Contact form email"
ScraperStack --> Brevo: "Report digest SMTP (ops, optionnel)"

legend [position: bottom-left] {
  [connection: <>, label: "Sync données bidirectionnelle"]
  [connection: -->, label: "Contrôle / notif async"]
  [color: blue, label: "Hub données"]
  [color: green, label: "Clients Moments Locaux"]
  [color: orange, label: "Externes"]
}
```

### Modèle mental

Quatre clients convergent vers **le même projet Supabase** (DEV / UAT) :

| Client | Auth vers Supabase | Rôle |
|---|---|---|
| App mobile | Anon key + JWT user | Produit B2C |
| Console modération | Anon key + JWT rôle `moderateur` \| `admin` | Ops |
| Scrapper | **Service role** (worker trusted) | Ingestion |
| Site marketing | Service/secret côté serveur | Leads / contact |

La **Collecte** console ne scrappe pas via Supabase : elle pilote le **monitor HTTP** du scrapper (`VITE_SCRAPER_MONITOR_URL` + token).

---

## 2. Couches L0 → L3

```eraser
direction right
colorMode pastel
styleMode plain
typeface clean

L0 [icon: users, color: gray, label: "L0 Acteurs"] {
  A1 [label: "Users mobiles"]
  A2 [label: "Modérateurs"]
  A3 [label: "Visiteurs"]
}

L1 [icon: monitor, color: green, label: "L1 Surfaces"] {
  S1 [label: "Mobile"]
  S2 [label: "Console"]
  S3 [label: "Site"]
  S4 [label: "Scrapper/Monitor"]
}

L2 [icon: database, color: blue, label: "L2 Plateforme"] {
  P1 [label: "Auth"]
  P2 [label: "Postgres + RLS"]
  P3 [label: "Realtime"]
  P4 [label: "Storage"]
  P5 [label: "Edge Functions"]
}

L3 [icon: cloud, color: orange, label: "L3 Externes"] {
  E1 [label: "Mapbox"]
  E2 [label: "Expo Push"]
  E3 [label: "Brevo"]
  E4 [label: "APIs OT"]
}

L0 > L1
L1 > L2
L2 > L3
```

---

## 3. Matrice des connexions

| De | Vers | Protocole | Auth | Sens | Usage |
|---|---|---|---|---|---|
| App mobile | Supabase | HTTPS · PostgREST · Realtime · Storage · Edge invoke | Anon + JWT user | ↔ | CRUD events, map RPC, inbox, auth, media |
| Console | Supabase | HTTPS · PostgREST · Storage · RPCs `moderation_*` | Anon + JWT rôle | ↔ | Approve/refuse, ban, reports, contests, CRM |
| Scrapper | Supabase | HTTPS · PostgREST · Storage | **Service role** | → (écriture dominante) | staging → `events` pending, runs, merge |
| Site marketing | Supabase | HTTPS REST (server actions) | Service/secret serveur | → | `contact_messages`, `launch_interests` |
| Console Collecte | Monitor scrapper `:8787` | HTTP | Bearer `MONITOR_MODERATOR_TOKEN` | console → monitor | `GET /regions`, `POST /run` (`region-*`) |
| Mobile / Console / Scrapper | Mapbox | HTTPS Maps / Geocoding / Directions | Access token | → | Carte, reverse geo, directions |
| Edge `push-dispatch` | Expo Push → APNs/FCM | HTTPS Expo Push API | Secrets serveur | → | Push produit |
| Supabase Auth | Brevo SMTP | SMTP | Creds Auth | → | Signup, reset, magic link |
| Site contact | Brevo | API Brevo | API key serveur | → | Email formulaire |
| Scrapper | SMTP (optionnel) | SMTP nodemailer | `SMTP_*` | → | Digest HTML scrape (ops, pas users) |
| Scrapper | Sources OT | HTTPS API / HTML / ICS / Algolia | Clés plateformes | → | Collecte événements |

---

## 4. Dataflow — Collecte scrapper → file modération

```eraser
direction right
colorMode pastel
styleMode plain
typeface clean

Sources [icon: cloud, color: orange, label: "Sources OT"]
Pipeline [icon: server, color: green, label: "ScraperPipeline"]
Staging [icon: database, color: blue, label: "event_import_staging"]
Events [icon: database, color: blue, label: "events status=pending"]
Console [icon: monitor, color: green, label: "Console /moderation/events"]

Sources > Pipeline: "connectors TS / Iris / Woody / OA / DT…"
Pipeline > Staging: StagingService
Staging > Events: IngestionService
Events > Console: "file pending (RLS modo)"

Pipeline --> Dedup [icon: server, label: "Dedup / merge candidates"]
Pipeline --> Reports [icon: file, label: "reports HTML + source_runs"]
```

**Déclencheurs** : CLI · Monitor admin · Collecte console (`region-*`) · Scheduler (off par défaut).

---

## 5. Dataflow — Modération événement → publication

```sequence
title Modération événement → publication

Moderateur -> Console: Approuver / Refuser / Archiver
Console -> Supabase: UPDATE events + INSERT moderation_actions
Note over Console,Supabase: Publish génère qr_token ; refuse stocke refusal_reason
Supabase --> MobileMap: RPC list_map_viewport (published only)
Supabase --> CreatorApp: statut + motif (Mes événements)
Note over Console: GAP — approve/refuse ne fait pas encore INSERT notifications
```

---

## 6. Dataflow — Création user → pending → published

```sequence
title Création événement utilisateur

User -> Mobile: Create wizard (draft → submit)
Mobile -> Supabase: INSERT events status=pending
Note over Mobile,Supabase: Ou Edge suggest-event-from-poster → community_suggest
Moderator -> Console: File ingestion OU suggestions
Console -> Supabase: status=published | refused | archived
Supabase --> Mobile: Map si published ; motif si refused
```

---

## 7. Notifications & contact utilisateurs

### 7.1 Pipeline push + inbox

```eraser
direction right
colorMode pastel
styleMode plain
typeface clean

Business [icon: server, color: green, label: "Console / triggers DB / crons"]
NotifTable [icon: database, color: blue, label: "public.notifications"]
Trigger [icon: bolt, label: "trg_notifications_push_dispatch"]
Edge [icon: server, color: blue, label: "Edge push-dispatch"]
Tokens [icon: database, color: blue, label: "device_push_tokens + prefs"]
Expo [icon: notification, color: orange, label: "Expo Push"]
Device [icon: smartphone, color: green, label: "APNs / FCM → device"]
Inbox [icon: smartphone, color: green, label: "Inbox Realtime"]

Business > NotifTable: INSERT
NotifTable > Trigger: AFTER INSERT
Trigger > Edge: pg_net
Edge > Tokens: read
Edge > Expo: send
Expo > Device: push
NotifTable --> Inbox: Realtime subscribe
```

### 7.2 Canaux

| Canal | Qui | Déclencheur | Exemples | Statut |
|---|---|---|---|---|
| Push (Expo) | Users app | INSERT `notifications` → Edge `push-dispatch` | Ban, warn, média, proximité, social, nearby… | Actif |
| Inbox in-app | Users app | Table `notifications` + Realtime | Même payload | Actif |
| Email Auth (Brevo SMTP) | Comptes Auth | Supabase Auth | Signup, reset, magic link | Actif |
| Email contact (Brevo) | Ops | Site marketing | Formulaire contact | Actif |
| Email rapport scrape | Ops internes | Fin pipeline scrapper | HTML KPI | Optionnel |
| Email produit (digest / publish) | Users | — | — | **Absent** |
| Notif event publish/refuse | Créateur | Attendu à l’approve console | `event_published` / `event_refused` | **Gap console** |

### 7.3 Ce que fait / ne fait pas la console

```sequence
title Console → notifications

Moderator -> Console: Ban / warn / contest refuse
Console -> Supabase: INSERT notifications
Supabase -> PushDispatch: trigger + Edge
PushDispatch -> Device: Expo Push

Moderator -> Console: Approve / Refuse event
Console -> Supabase: UPDATE events seulement
Note over Console,Supabase: Pas d'INSERT notifications (gap)
```

La console **n’invoque jamais** d’Edge Function push, **n’a pas** de SDK Expo/FCM, **n’envoie pas** d’email produit.

---

## 8. Collecte régions (console ↔ monitor)

```sequence
title Collecte régions

Moderator -> Console: Ouvre /moderation/collecte
Console -> Monitor: GET /api/monitor/regions
Monitor --> Console: readiness + parked + health tourism-system
Moderator -> Console: Lancer région
Console -> Monitor: POST /api/monitor/run { source: region-*, env }
Note over Monitor: Clés tourism-system parked → 503 si health ≠ up (sauf admin force_unhealthy)
Monitor -> ScraperPipeline: run env DEV|UAT
ScraperPipeline -> Supabase: events pending
Console -> Supabase: file /moderation/events?filter=pending
```

**Prérequis** : monitor up (`MONITOR_PORT`, défaut `8787`) + `VITE_SCRAPER_MONITOR_TOKEN` = `MONITOR_MODERATOR_TOKEN` (rôle moderator). Admin ops : `MONITOR_API_TOKEN`. CORS extras : `MONITOR_CORS_ORIGINS`.

La console appelle aussi le monitor pour **categorize-suggest/decisions** et **dedup/merge** (hors Collecte pure).

---

## 9. Géolocalisation & carte (app mobile)

```eraser
direction down
colorMode pastel
styleMode plain
typeface clean

Perms [icon: lock, label: "expo-location permissions"]
GPS [icon: map, label: "useLocation / locationStore"]
HomeLoc [icon: database, color: blue, label: "RPC set_home_location"]
MapUI [icon: smartphone, color: green, label: "MapWrapper @rnmapbox/maps"]
Chip [icon: bolt, label: "Rechercher dans cette zone"]
RPC [icon: database, color: blue, label: "RPC list_map_viewport"]
Filters [icon: server, label: "Filtres client-side"]
Prox [icon: bolt, label: "Background proximity task"]

Perms > GPS
GPS > MapUI: recenter / first paint
GPS --> HomeLoc: nearby push (si granted)
MapUI > Chip: pas d'auto-fetch au pan
Chip > RPC
RPC > Filters: taxonomy / when / place / content
GPS --> Prox: "pref notify_proximity_live (off défaut)"
Prox --> SupabaseProx [icon: database, label: "RPC report_proximity_live_alerts"]
```

| Étape | Mécanisme |
|---|---|
| Permission GPS | Foreground (map) ; Always si proximité live |
| Position | lastKnown ≤5 min puis `getCurrentPosition` High |
| Home location | RPC `set_home_location` pour alertes nearby |
| Carte | Mapbox clustering natif + category ShapeSources |
| Fetch events | Chip explicite → `list_map_viewport` |
| Filtres | Client-side après RPC |
| Proximité live | Background task → `report_proximity_live_alerts` |
| Geocoding create | Mapbox Geocoding API (pickers / create) |

Doc détaillée : `docs/MAP_SCREEN_ORCHESTRATION.md`.

---

## 10. Contact site marketing

```sequence
title Contact site → ops

Visitor -> Website: Formulaire contact
Website -> Supabase: INSERT contact_messages
Website -> Brevo: email ops
Moderator -> Console: /moderation/contact (lecture)
```

Le site **n’est pas** une API produit (pas de proxy app).

---

## 11. Surfaces & routes (aperçu)

### App mobile (Expo Router)

| Domaine | Routes / surfaces |
|---|---|
| Tabs | `/(tabs)/map`, home, explore, create, profile |
| Auth | `/auth/login`, register, forgot, reset, callback, OAuth |
| Events | `/events/create/*`, detail, my-events, edit (draft/refused) |
| Social | likes, follows, comments/echoes, favorites |
| Notifs | `/notifications` + deep links |
| Settings | permissions, prefs notif, privacy, delete-account |
| Report | event / comment / profile / media → `reports` |
| Flagged | discovery, contests, roadtrip, lumia, shop |
| Bloqué | `app/moderation/*` → redirect map (ADR 001) |

### Console modération

| Path | Rôle |
|---|---|
| `/login` | Auth + switch DEV/UAT |
| `/moderation` | Dashboard |
| `/moderation/collecte` | Régions scrapper |
| `/moderation/events[+map]` | File ingestion |
| `/moderation/events/suggestions[+map]` | Suggestions community |
| `/moderation/events/:id` | Approve / refuse / archive |
| `/moderation/comments\|media\|reports` | UGC / signalements |
| `/moderation/users` | Ban / réactivation |
| `/moderation/bugs\|contact\|todos` | Support ops |
| `/moderation/contests\|partners\|prospects` | Contests / Lumo / CRM |
| `/moderation/qa\|docs` | QA + specs |

### Edge Functions (`mobileApp/supabase/functions`)

| Function | Appelant |
|---|---|
| `push-dispatch` | DB trigger (pas UI) |
| `event-checkin` | Mobile |
| `delete-account` | Mobile |
| `discovery-ingest` / `discovery-score` | Mobile (flag) |
| `lumia-chat` | Mobile (flag) |
| `suggest-event-from-poster` | Mobile (flag) |
| `subscription-webhook` | Billing externe |
| `diffuseur-billing-webhook` | Billing Diffuseur |

### Monitor scrapper (API clé)

- `GET /api/monitor/regions`
- `POST /api/monitor/run`
- `GET /api/monitor`, `/whoami`, `/health/tourism-system`, `/reports`
- Admin : merge / venue / registry…

---

## 12. Gaps connus

```eraser
direction down
colorMode pastel
styleMode plain
typeface clean

G1 [icon: alert, color: red, label: "Approve/refuse sans INSERT notifications"]
G2 [icon: alert, color: orange, label: "Pas d'email produit user"]
G3 [icon: alert, color: orange, label: "warnUser API sans bouton UI"]
G4 [icon: alert, color: gray, label: "Portails Diffuseur/Partenaire = marketing only"]

G1 > Impact1 [label: "Créateur peut manquer push à la publication"]
G2 > Impact2 [label: "Canal limité push + inbox + Auth SMTP"]
G3 > Impact3 [label: "Warn non exposé aux modos"]
G4 > Impact4 [label: "Pas d'apps B2B séparées encore"]
```

---

## 13. Environnements

| Env | Supabase | Mobile | Console | Scrapper | Site |
|---|---|---|---|---|---|
| DEV | `moments-locaux-dev` | Expo DEV | Vite DEV | `.env` | `dev.` |
| UAT | `moments-locaux-uat` | Expo UAT | switcher UAT | `.env.uat` | `staging.` |
| PROD | (plus tard) | Store | — | — | apex |

Détail URLs : `infra/urls/ENVIRONMENT_URLS.md` · checklist multi-repo : Scrapper `docs/ENV_CHECKLIST.md`.

---

## 14. Sources

| Artefact | Chemin |
|---|---|
| Spec tech mobile (D2) | `docs/SPEC_TECHNIQUE_APPLICATION_MOBILE.md` |
| Spec tech console (D4) | Moderation-WebConsole `docs/SPEC_TECHNIQUE_CONSOLE_ADMIN.md` |
| Push runbook | `infra/runbooks/PUSH_NOTIFICATIONS.md` |
| Canaux notif | `docs/notifications/CHANNELS.md` |
| Map orchestration | `docs/MAP_SCREEN_ORCHESTRATION.md` |
| Collecte ↔ monitor | Scrapper `docs/platform-collecte-regions.md` |
| ADR modération web | `project-management/decisions/ADR_001_ADMIN_MODERATION_WEB_APP.md` |

---

## Historique

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-08-27 | Première version Layer 1 export Eraser (écosystème 4 repos) |
| 1.1 | 2026-08-27 | Collecte : parked/503, dual-token, categorize/dedup |
