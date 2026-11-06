# SCRUM-328 — Diagnostic lot 0

Relevé du 2026-11-03, lecture seule via connecteur Supabase. Pas de lecture de comptes,
coordonnées, tokens, Vault ou secrets. Pas de DDL/DML, appel métier, activation ou migration.
Ce relevé remplace les hypothèses du plan de discussion, pas les anciens audits historiques.

## Environnements réellement accessibles

| Référence | Nom actuel du projet | Constat |
|---|---|---|
| `prymkgkafaovhzopslea` | moments-locaux-dev | Base applicative ; PostgreSQL 17 ; PostGIS, pg_net, pg_cron présents |
| `ieehuzeotwagkkprohjr` | moments-locaux-ingest-dev | Ancien identifiant décrit comme UAT dans la documentation ; aujourd'hui ingestion, pas une cible UAT app |

Le second projet a sept tables publiques : `event_import_staging`, `event_merge_candidate`,
`event_source_occurrence`, `ingestion_runs`, `source_registry`, `source_runs`, `venue_coverage`.
Aucune table app visée par ce diagnostic, aucun cron. Aucun autre projet n'est retourné par
le connecteur. Conclusion : UAT applicative non vérifiable avec les accès actuels ; ne pas y
appliquer les futures migrations app ni prétendre à une validation DEV/UAT complète.

## Inventaire DEV

| Objet | État observé | Conséquence |
|---|---|---|
| `user_preferences`, `events`, `notifications`, `device_push_tokens`, `event_likes`, `favorites`, `app_config` | Présents, RLS activée | Socle disponible ; activation RLS seule ne prouve pas toutes les permissions |
| `user_affinity_profile`, `user_taste_profiles` | Absents | Source de goût canonique à construire et coordonner avec SCRUM-307 |
| `proposal_scores`, `proposal_weights`, `proposal_outcomes`, `place_context`, `event_conditions` | Absents | Aucun moteur E15 persistant identifié |
| `recommendation_events` | Présente, RLS ; `id, recommendation_id, user_id, event_type, metadata, created_at` | Contrat Discovery existant, incompatible avec le schéma événement/surface/action de SCRUM-309 |
| Enum de notifications | `notification_type_mod_enum`, 26 valeurs dont `direct_message`, sans `moment_proposal` | Extension versionnée nécessaire ; ne pas viser le nom historique `notification_type` |
| `push_personalization` | JSONB nullable dans préférences | Ne contient actuellement que politique/version/date côté client |
| Données événement | `is_free`/`price` nullables, tags, ambiance, dates et operating_hours ; pas de colonnes dédiées âge/intérieur-extérieur | Qualification explicite et inconnus indispensables |
| `rank_events_for_user` et RPC affinité recherchées | Absentes dans la recherche ciblée | Ne pas présumer SCRUM-307/308 déjà livrés |
| `list_proposal_candidates` | RPC présente, SECURITY DEFINER | Concerne le swipe existant : public/published, rayon, dates ; exclut likes/favoris sous auth ; `ORDER BY random() LIMIT 80` |

La RPC swipe ne peut pas servir de classement exhaustif et déterministe E15 : échantillon aléatoire,
limite 80 et exclusions liées à `auth.uid()` (différent dans un job serveur). Réutiliser les invariants
d'éligibilité après revue, pas l'appel aléatoire comme source de vérité.

## Dispatch et triggers

Définition déployée `push-dispatch` version 17 inspectée ; flag plateforme `verify_jwt=false`
avec authentification personnalisée prévue dans le code. Aucun secret n'a été lu.

- `trg_notifications_push_dispatch` : **O (activé)**.
- `trg_events_notify_fanout` : **D (désactivé)**.
- `follows_notify`, `event_likes_notify`, `trg_events_notify_status`, notifications média,
  ban, warnings et escalation : activés.
- Notifications missions et concours inspectées : désactivées.
- Pas de liste blanche `push_allowed_types` ni de branche `moment_proposal` dans la source déployée.
- Aucune clé `push_allowed_types`, `push_dispatch_enabled`, `moment_proposals_enabled` dans
  `app_config` lors de la requête ciblée.
- Contrôle général push, préférences familles, quiet hours et compteur quotidien présents.
- `count_user_notifications_today` compte **les lignes inbox** depuis minuit Europe/Paris.
  Ce n'est pas un compteur de push livrés. Le dispatch logue l'erreur du compteur et poursuit.

SCRUM-303 est donc partiellement réalisé en live : ne pas recommencer par « réactiver tout ».
Versionner/valider la liste blanche et préserver le fan-out désactivé. Trigger actif et fonction
déployée ne prouvent ni disponibilité d'un token ni livraison OS : aucun push de test envoyé.

## Crons DEV

Tous les jobs ci-dessous sont actifs ; `cron.timezone = GMT` :

| Job | Expression |
|---|---|
| event-soon-reminders | `*/30 * * * *` |
| notification-digest-daily | `0 7 * * *` |
| notification-digest-weekly | `0 7 * * 1` |
| discovery-recalculate-profiles | `0 3 * * *` |
| discovery-generate-insights | `15 4 * * *` |
| discovery-match-outcomes | `0 */6 * * *` |
| award-earned-creator-boosts | `20 * * * *` |
| boost-expiry-sweep | `*/15 * * * *` |
| diffuseur-monthly-boost-credits | `15 4 1 * *` |

Aucun job E15 observé. Les jobs Discovery/monétisation restent hors mission ; aucun changement.
Les commandes cron ne sont pas exportées car elles peuvent contenir des informations sensibles.

## État des contrôles d'accès observés

Policies inspectées par nom/commande/rôle : préférences owner SELECT/INSERT/UPDATE ; notifications
owner SELECT/UPDATE, INSERT modérateur et invitation créateur ; recommendations owner SELECT.
Pas de simulation de rôle ni de test d'exploitation exécuté. Ce relevé n'est pas une certification RLS.
Les futures migrations devront empêcher l'INSERT de `moment_proposal` par un client, même via une
policy existante de notifications plus large. Vérifier aussi les droits sur les colonnes UPDATE.

## Reproduction des principaux contrôles

Requêtes à exécuter séparément en lecture seule sur une cible identifiée ; aucune commande métier :

```sql
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('user_preferences', 'user_affinity_profile', 'user_taste_profiles',
    'proposal_scores', 'proposal_weights', 'proposal_outcomes', 'event_conditions',
    'place_context', 'recommendation_events', 'notifications');

SELECT c.relname, t.tgname, t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND (c.relname = 'notifications' OR t.tgname ILIKE '%fanout%');

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT current_setting('cron.timezone', true);

SELECT e.enumlabel
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_enum e ON e.enumtypid = a.atttypid
WHERE n.nspname = 'public' AND c.relname = 'notifications' AND a.attname = 'type'
ORDER BY e.enumsortorder;

SELECT key, value FROM public.app_config
WHERE key IN ('push_allowed_types', 'push_dispatch_enabled', 'moment_proposals_enabled');
```

Compléments réalisés : colonnes via information_schema, RPC ciblées via pg_proc,
policies via pg_policies et source de l'Edge Function via get_edge_function.

## Sources locales et limites

Sources relues : `preferences.service.ts`, `push-personalization.ts`, `home-feed.ts`,
`proximity-location.ts`, `proximity-alert.service.ts`, `weather.service.ts`, routage notifications,
`export-account/index.ts`, migrations candidates et politique push ; audits notifications/RLS historiques.
`docs/notifications/PUSH_GENERATION_MATRIX.md` est daté de septembre : son « dispatch OFF »
ne décrit plus DEV. Ne pas extrapoler son ancien constat UAT au projet ingestion actuel.

La localisation existante est envoyée au RPC proximité sans conservation serveur annoncée ;
la task ne fournit pas encore l'instantané E15. L'export sélectionne explicitement les champs
préférences : ajouter un objet dans la table ne suffit pas à le rendre exportable.
La recherche locale n'identifie aucun moteur E15 ; la présence d'objets Discovery ne constitue pas
une implémentation E15. Aucune mesure de performance, livraison OS, qualité des prix/âges ou
validité géographique IRIS n'a été réalisée dans ce lot documentaire.

## Suites

1. Valider le [contrat proposé](SCRUM_328_LOT_0_CONTRACT.md) et reporter les critères dans les tickets concernés.
2. Retrouver/provisionner la cible UAT applicative avant sa recette ; corriger les références d'environnement
   dans une mission dédiée sans renommer ici l'historique de toute la documentation.
3. SCRUM-303 : rapprocher dépôt/live et ajouter la liste blanche sans toucher au fan-out.
4. SCRUM-309 : résoudre la collision `recommendation_events` avec Discovery avant toute extension.
5. Aucune migration future n'est approuvée par ce diagnostic.
