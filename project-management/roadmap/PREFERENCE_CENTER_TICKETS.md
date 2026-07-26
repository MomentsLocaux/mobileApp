# Preference Center Tickets (habitant)

Track push-first : centre de préférences habitant (budget, quiet hours, thèmes).

Prefix: `PREF-P*`, `PUSH-P*`.

Références:

- Proposition canvas : `preference-center-proposal` (Cursor)
- Vision push : `moments-locaux-push-vision` (Cursor)
- ADR OT / prefs : `project-management/decisions/ADR_005_OT_CONNECT_APIDAE.md` (§ décision 7)
- ADR Discovery : `ADR_003_DISCOVERY_ENGINE_DOMAIN.md` (prefs Discovery déjà livrées DISC-P0-003)
- Surface existante : `app/settings/notifications.tsx`, `src/services/preferences.service.ts`
- Pipeline : `supabase/functions/push-dispatch/index.ts`, fan-out `20260722_notifications_delivery_hardening.sql`

Règles :

- Étendre Settings → Notifications ; ne pas créer un second hub.
- Discovery consent reste `/settings/discovery`.
- Migrations additives uniquement ; **jamais apply sans validation humaine**.
- 1 ticket = 1 branche = 1 diff contrôlé.

Branche de suivi possible : `feat/ot-connect-prefs-push` (ou sous-branches `feat/pref-p0-*` / `feat/push-p0-*`).

---

## Phase P0 — Anti-spam + cold start thèmes

### ID: PREF-P0-001

Titre: Migration user_preferences — budget jour, quiet hours, thèmes

Priorité: P0

Source: Proposition preference-center, ADR 005 §7

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Supabase migration (additive)

Fichiers probablement concernés:

- `supabase/migrations/YYYYMMDD_preference_center_budget_quiet_themes.sql`
- `supabase/diagnostics/` (checks colonnes optionnels)

Description: Ajouter sur `user_preferences` :

- `max_push_per_day` smallint NOT NULL DEFAULT 3 CHECK (BETWEEN 0 AND 10) — 0 = pas de cap
- `quiet_hours_start` time NULL
- `quiet_hours_end` time NULL
- `preferred_category_slugs` text[] NOT NULL DEFAULT `'{}'`

Commentaires SQL sur chaque colonne. Pas de changement RLS (policies owner existantes). Pas de table compteur dédiée en P0 (COUNT inbox du jour côté dispatch).

Critères d'acceptation:

- Migration idempotente (`IF NOT EXISTS` / defaults sûrs)
- Aucune colonne destructive
- Defaults : budget 3, quiet NULL, thèmes `{}`
- Validée humainement avant apply

Commandes de vérification: revue SQL, script diagnostic colonnes si ajouté

Risques: Confusion avec `discovery_max_push_per_week` (cap Discovery 7j vs budget global jour)

Dépendances: Aucune

Branche Git recommandée: `feat/pref-p0-budget-quiet-themes-schema`

---

### ID: PREF-P0-002

Titre: UI Settings — sections Volume & horaires + Mes thèmes

Priorité: P0

Source: Proposition preference-center §3

Responsable / agent recommandé: Mobile Reliability Engineer, UX/UI Guardian

Type d'action: Mobile UI + service

Fichiers probablement concernés:

- `src/services/preferences.service.ts`
- `app/settings/notifications.tsx`
- `docs/notifications/QA_MATRIX.md` (étendre)

Description: Étendre types / DEFAULT / PREF_FIELDS. Réorganiser Settings → Notifications :

1. Push master (existant)
2. **Volume & horaires** — chips `max_push_per_day` (1/2/3/5), quiet hours start/end (pickers simples), copy anti-spam
3. Types d’alertes (existant + honesty copy sur fréquence digest)
4. **Mes thèmes** — multi-select sur `CATEGORY_VISUAL_SLUGS`
5. Discovery (existant, flag)
6. Fréquence (existant) — préciser que digest = nearby + followed seulement

`account/preferences.tsx` : redirect explicite vers `/settings/notifications` (ou libellé “Mes goûts & notifications”) — pas de stub silencieux.

Critères d'acceptation:

- Persist optimistic + rollback Toast
- Thèmes et budget visibles sans feature flag Discovery
- `npm run typecheck` && `npm run lint`

Risques: Pickers time UX iOS/Android ; surcharge visuelle de l’écran

Dépendances: PREF-P0-001 (colonnes appliquées ou mocks types alignés migration)

Branche Git recommandée: `feat/pref-p0-settings-volume-themes`

---

### ID: PREF-P0-003

Titre: Onboarding cold start — déclaration des thèmes

Priorité: P0

Source: Vision push (préférences déclarées), proposition §3

Responsable / agent recommandé: UX/UI Guardian, Mobile Reliability Engineer

Type d'action: Onboarding UX

Fichiers probablement concernés:

- `src/screens/onboarding/OnboardingScreen.tsx`
- éventuel `src/components/onboarding/OnboardingThemesStep.tsx`
- `PreferencesService.updateMine`

Description: Ajouter une étape courte “Qu’est-ce qui te tente ?” (3–6 chips thèmes, multi-select) après rôle/ville (avant ou après avatar). Upsert `preferred_category_slugs`. Skip autorisé (tableau vide). Compatible replay onboarding (`/onboarding?replay=1`).

Critères d'acceptation:

- Skip et sélection partielle OK
- Valeurs visibles ensuite dans Settings → Mes thèmes
- Ne bloque pas la fin d’onboarding si prefs row absente (upsert)

Commandes de vérification: `npm run typecheck`, `npm run lint`, parcours onboarding manuel

Risques: Allonger l’onboarding ; friction nouveaux users

Dépendances: PREF-P0-001

Branche Git recommandée: `feat/pref-p0-onboarding-themes`

---

### ID: PUSH-P0-001

Titre: Enforcement push-dispatch — budget jour + quiet hours

Priorité: P0

Source: Proposition preference-center §4.2, vision anti-spam

Responsable / agent recommandé: Mobile Reliability Engineer, Supabase Security Architect

Type d'action: Edge Function

Fichiers probablement concernés:

- `supabase/functions/push-dispatch/index.ts`
- `infra/runbooks/PUSH_NOTIFICATIONS.md`
- `docs/notifications/QA_MATRIX.md`

Description: Dans `push-dispatch`, après lecture prefs :

1. Si `quiet_hours_start` et `quiet_hours_end` définis et maintenant dans la fenêtre (timezone MVP `Europe/Paris`, support traverse-minuit) → `skipped: quiet_hours`
2. Si `max_push_per_day` > 0 et COUNT notifications du jour calendaire (ou pushes déjà envoyés — documenter le choix) ≥ budget → `skipped: daily_budget`
3. Types critiques moderation (`user_banned`, `warning_received`, `event_refused`…) : **ne pas** appliquer budget/quiet (toujours tenter le push OS)
4. Inbox inchangée : skip push ≠ delete row

Critères d'acceptation:

- Skip documenté dans réponse JSON
- QA matrix : budget × quiet × type critique
- Runbook mis à jour

Risques: Timezone fixe ; double-count si COUNT sur toutes les rows inbox (y compris non-pushées) — préférer COUNT des inserts du jour filtrés ou log minimal

Dépendances: PREF-P0-001

Branche Git recommandée: `feat/push-p0-dispatch-budget-quiet`

---

### ID: PUSH-P0-002

Titre: Filtre soft thèmes sur fan-out nearby

Priorité: P0

Source: Vision “proximité + match préférences”

Responsable / agent recommandé: Supabase Security Architect

Type d'action: SQL fan-out

Fichiers probablement concernés:

- migration additive remplaçant / patchant `notify_event_published_fanout`
- diagnostics fan-out

Description: Si `preferred_category_slugs` est non vide, n’inclure l’utilisateur dans le fan-out `event_nearby_new` que si la catégorie / slug de l’event matche (ou event sans catégorie → ne pas exclure, pour éviter silence total). Si tableaux thèmes vide → comportement actuel (tous nearby dans le rayon).

Critères d'acceptation:

- Thèmes vides = pas de régression nearby
- Thèmes renseignés = réduction ciblée du fan-out
- Digest daily/weekly respecte la même règle

Risques: Mapping category UUID ↔ slug incorrect ; sous-notification

Dépendances: PREF-P0-001, PREF-P0-002 (données thèmes)

Branche Git recommandée: `feat/push-p0-nearby-theme-filter`

---

## Phase P1 — Découverte habituelle

### ID: PUSH-P1-001

Titre: Enqueue discovery_personal_match (découverte habituelle)

Priorité: P1

Source: Vision push “pattern jeudi soir jazz”, enum déjà présent

Responsable / agent recommandé: Mobile Reliability Engineer, Supabase Security Architect

Type d'action: SQL cron + prefs gate

Fichiers probablement concernés:

- migration `discovery_enqueue_personal_match_pushes`
- `push-dispatch` (gate famille si toggle dédié, sinon master discovery)
- `app/settings/notifications.tsx` (toggle optionnel)
- DISC scoring / `event_recommendations`

Description: Brancher le type enum `discovery_personal_match` : fonction enqueue + cron, respect `discovery_push_enabled`, cap semaine, et `max_push_per_day`. S’appuyer sur recommendations / scoring existants (pas de nouveau moteur). Toggle UI dédié seulement si nécessaire (sinon master Discovery suffit en V1).

Critères d'acceptation:

- Au moins un chemin de génération testable en UAT
- Pas de spam si Discovery off
- Aligné ADR 003 (pas de colonnes discovery hors prefs notifs)

Dépendances: DISC scoring stable, PUSH-P0-001, DISC-P0-003

Branche Git recommandée: `feat/push-p1-personal-match`

---

## Hors scope (tickets non créés ici)

- OT Connect Apidae (`OT-P0-*`) — fichier tickets dédié à créer ensuite
- UI `email_enabled`
- Multi-zones domicile / travail
- Timezone profil utilisateur
- Type `ugc_nearby_new` dédié (rester sur filtre data nearby)
- Portail WebConsole OT

---

## Ordre d’exécution recommandé

1. PREF-P0-001 (schema)
2. PREF-P0-002 (UI) // PUSH-P0-001 (dispatch) en parallèle après apply schema
3. PREF-P0-003 (onboarding)
4. PUSH-P0-002 (filtre nearby)
5. PUSH-P1-001 (personal match)
