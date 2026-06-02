# Audit Cleaning Data / Données MVP propres - Moments Locaux

## 1. Résumé exécutif

Audit réalisé le 2 juin 2026 en lecture seule, avec service role Supabase pour compter les lignes, inventorier Storage et détecter les marqueurs de données de test. Aucune suppression, aucun `truncate`, aucun `delete`, aucun nettoyage Storage et aucune modification de migration n'ont été exécutés.

État global des données : la base ressemble davantage à un environnement de développement/seed qu'à un environnement MVP propre.

Signaux principaux :

- `profiles` : 68 profils en DB, mais seulement 32 utilisateurs Auth confirmés/non confirmés côté Supabase Auth.
- `events` : 1113 événements, dont 998 `published` et seulement 2 `refused`; aucune donnée `draft`/`pending` détectée dans la distribution live.
- `profiles` : 63 profils avec marqueurs seed/dev probables (`picsum`, `pravatar`, `seed`, `test`, etc.).
- `events` : au moins 228 événements suspects dans l'échantillon scanné, avec descriptions de type "événement X (test)" et URLs `picsum`.
- `event_media` : 414 médias sur 418 pointent vers `picsum`.
- `event_comments` : 40 commentaires seed détectés (`[seed-engagement] commentaire auto...`).
- `notifications` : 798 notifications, volume élevé pour un environnement MVP propre.
- Storage : 178 fichiers au total dans `event-media` et `avatar`; 143 fichiers semblent probablement orphelins par rapport aux URLs DB analysées.
- Les références DB vers fichiers Supabase Storage analysées ne pointent pas vers des fichiers manquants : 0 référence manquante détectée.

Niveau de risque : élevé si cette base est utilisée pour screenshots, review store ou bêta test, car elle mélange données seed, données potentiellement réelles, gamification non-MVP, historiques sociaux, notifications et médias orphelins.

Recommandation globale : ne pas nettoyer directement cette base sans confirmation d'environnement. Créer d'abord un environnement `staging/mvp-review`, y restaurer ou cloner la structure, puis appliquer un script de nettoyage contrôlé + seed MVP propre. La production ou une base contenant des vrais utilisateurs ne doit jamais être nettoyée par script global.

## 2. Inventaire des tables

Volumes live approximatifs :

| Table | Type | Volume | Dépendances principales | Recommandation | Risque |
|---|---:|---:|---|---|---|
| `auth.users` | comptes Auth | 32 | référencé indirectement par `profiles.id` | Ne pas toucher sans validation explicite; comparer aux profils | P0 |
| `profiles` | utilisateur + seed | 68 | parent de nombreux objets | Anonymiser/supprimer profils seed; conserver comptes validés MVP | P0 |
| `events` | utilisateur/test | 1113 | parent médias/commentaires/interactions/check-ins | Supprimer/reseeder en staging; conserver seulement demo MVP propre | P0 |
| `event_media` | utilisateur/test | 418 | dépend de `events` | Supprimer avec événements seed; reseeder médias demo | P1 |
| `event_media_submissions` | utilisateur | 4 | event + author | Conserver si demo utile, sinon nettoyer | P1 |
| `event_comments` | utilisateur/test | 185 | event + author + parent_comment | Nettoyer seed; reseeder quelques avis propres | P1 |
| `event_likes` | interaction | 449 | user + event | Nettoyer avec événements/profils; reseeder minimal | P1 |
| `comment_likes` | interaction | 5 | comment + user | Nettoyer avec commentaires | P2 |
| `event_media_submission_likes` | interaction | 0 | submission + user | Rien à nettoyer | P3 |
| `event_interests` | interaction | 280 | user + event | Nettoyer avec événements/profils | P1 |
| `event_checkins` | présence/localisation | 2 | user + event | Supprimer en staging; reseeder 1 cas si nécessaire | P0 |
| `favorites` | interaction privée | 12 | profile + event | Nettoyer; reseeder quelques favoris demo | P1 |
| `follows` | social graph | 108 | follower/following profiles | Nettoyer; reseeder quelques follows demo | P1 |
| `notifications` | utilisateur | 798 | user | Supprimer massivement en staging; reseeder 3-5 notifications demo | P1 |
| `reports` | modération | 12 | reporter + target | Supprimer/anonymiser en staging; reseeder 1 report demo si besoin | P1 |
| `warnings` | modération | 3 | user/moderator | Supprimer en staging MVP mobile | P1 |
| `moderation_actions` | audit modération | 22 | moderator/target | Supprimer en staging MVP mobile | P1 |
| `bug_reports` | support/dev | 61 | reporter optional | Supprimer/anonymiser; reseeder max 1 bug report demo | P1 |
| `event_views` | analytics | 298 | profile + event | Supprimer; reseeder via app si besoin | P1 |
| `wallets` | non-MVP gamification | 1 | user | Supprimer/masquer en staging MVP | P2 |
| `lumo_transactions` | non-MVP gamification | 2 | user | Supprimer/masquer en staging MVP | P2 |
| `user_xp_levels` | non-MVP gamification | 1 | user | Supprimer/masquer sauf si check-in XP conservé | P2 |
| `badges` | référence/gamification | 3 | user_badges | Préserver si ref, sinon masquer non-MVP | P2 |
| `user_badges` | non-MVP utilisateur | 1 | user + badge | Nettoyer en staging MVP | P2 |
| `missions` | référence non-MVP | 3 | user_missions | Préserver en dev, masquer/vider en staging MVP | P2 |
| `user_missions` | non-MVP utilisateur | 3 | user + mission | Nettoyer en staging MVP | P2 |
| `leaderboard` | non-MVP stats | 1 | user | Nettoyer/masquer | P2 |
| `community_leaderboard` | vue/cache stats | 201 | profiles/stats | Recalculer ou masquer Lumo; ne pas seed directement si vue | P2 |
| `community_profile_stats` | vue/cache stats | 68 | profiles/interactions | Recalculer après nettoyage; ne pas seed directement si vue | P2 |
| `event_engagement_stats` | cache stats | 219 | events/creator | Vider/recalculer après seed demo | P2 |
| `creator_engagement_stats` | cache stats | 67 | profiles | Vider/recalculer après seed demo | P2 |
| `creator_fans` | non-MVP analytics | 229 | creator/fan profiles | Nettoyer en staging MVP | P2 |
| `event_category` | référence | 10 | subcategories/events | Préserver; éventuellement reseed propre | P0 |
| `event_subcategory` | référence | 49 | categories/events | Préserver; éventuellement reseed propre | P0 |
| `event_tag` | référence | 11 | events/search | Préserver; éventuellement reseed propre | P0 |
| `lumo_rules` | règle non-MVP/check-in | 3 | Edge Function check-in | Préserver en dev; désactiver ou masquer en staging MVP | P2 |
| `shop_items` | non-MVP boutique | 0 | shop | Rien à nettoyer; garder vide | P3 |
| `contest_entries` | non-MVP concours | 1 | contests/user/event | Supprimer en staging MVP | P2 |
| `kv_store_b32ec4be` | cache/legacy | 6 | inconnu | Inspecter avant suppression; probable non-MVP | P2 |

### Tables à préserver

- `event_category`
- `event_subcategory`
- `event_tag`
- éventuellement `badges`, `missions`, `lumo_rules` en dev uniquement, mais pas nécessaires au MVP visible.

### Tables à nettoyer en staging/dev MVP

- `events`
- `event_media`
- `event_media_submissions`
- `event_comments`
- `event_likes`
- `comment_likes`
- `event_media_submission_likes`
- `event_interests`
- `event_checkins`
- `favorites`
- `follows`
- `notifications`
- `reports`
- `warnings`
- `moderation_actions`
- `bug_reports`
- `event_views`
- stats/cache : `event_engagement_stats`, `creator_engagement_stats`, `creator_fans`, `leaderboard`
- non-MVP : `wallets`, `lumo_transactions`, `user_xp_levels`, `user_badges`, `user_missions`, `contest_entries`

### Tables à anonymiser plutôt que supprimer

Sur une base contenant de vrais utilisateurs, anonymiser plutôt que supprimer :

- `profiles` liés à vrais comptes ;
- `events` publiés par vrais utilisateurs si l'historique doit être conservé ;
- `event_comments` si conservation éditoriale prévue ;
- `reports`, `warnings`, `moderation_actions` si conservation sécurité/modération nécessaire ;
- `bug_reports` si tickets encore utiles.

Pour un environnement staging/review isolé, la suppression + reseed propre est préférable.

## 3. Inventaire Storage

### Bucket `event-media`

- Public : oui.
- Volume : 157 fichiers, environ 71 MB.
- Préfixes :
  - `covers` : 68 fichiers.
  - `gallery` : 46 fichiers.
  - `contrib` : 8 fichiers.
  - préfixes user/event legacy : 35 fichiers.
- Usage : covers événements, galerie, contributions, anciens uploads.
- Références DB Supabase Storage détectées : 27.
- Références DB manquantes : 0.
- Fichiers probablement orphelins : une grande partie des 143 orphelins globaux vient de ce bucket.
- Risque : élevé, car bucket public et fichiers anciens non référencés restent accessibles.

Stratégie proposée :

- ne rien supprimer en production sans export d'inventaire ;
- créer un manifest `storage_keep_manifest` à partir des URLs DB ;
- supprimer seulement les fichiers absents du manifest après validation humaine ;
- nettoyer les préfixes legacy non référencés ;
- reseeder uniquement quelques covers/galleries propres pour les événements demo.

### Bucket `avatar`

- Public : oui.
- Volume : 21 fichiers, environ 11 MB.
- Préfixes :
  - `avatars` : 17 fichiers.
  - `covers` : 4 fichiers.
- Usage : avatars et covers profils.
- Références DB Supabase Storage détectées : 13.
- Références DB manquantes : 0.
- Fichiers probablement orphelins : plusieurs anciennes versions d'avatars/covers.
- Risque : moyen à élevé, car fichiers publics et liés à profils.

Stratégie proposée :

- conserver uniquement avatars/covers référencés par profils demo ;
- supprimer les anciennes versions non référencées uniquement après validation ;
- pour staging, préférer avatars neutres/brand ou générés proprement.

### Résumé orphelins Storage

- Fichiers Storage total : 178.
- Références DB Storage analysées : 40.
- Références DB vers fichier absent : 0.
- Fichiers potentiellement orphelins : 143.

Important : un fichier est "potentiellement orphelin" s'il n'est pas référencé dans `profiles.avatar_url`, `profiles.cover_url`, `events.cover_url`, `event_media.url`, `event_media_submissions.url`. Il peut tout de même être référencé ailleurs ou dans un ancien champ non audité. Il faut donc passer par un manifest et confirmation humaine avant suppression.

## 4. Plan de nettoyage recommandé

### Étape 0 - Sécuriser l'environnement

1. Confirmer si la base auditée est dev, staging ou prod.
2. Faire un backup Supabase complet.
3. Exporter `auth.users` séparément si nécessaire, sans le manipuler.
4. Exporter les tables publiques en snapshot.
5. Exporter la liste Storage avec paths, tailles, dates.
6. Créer une base `staging-mvp-review` séparée si possible.

### Étape 1 - Classifier les comptes/profils

1. Comparer `auth.users` et `profiles`.
2. Identifier profils sans compte Auth.
3. Identifier comptes Auth sans profil.
4. Marquer profils seed/dev via critères :
   - URLs `picsum`, `pravatar`;
   - `display_name`/`bio` contenant `test`, `seed`, `demo`;
   - emails de test ou aliases internes ;
   - rôles admin/modérateur créés en masse.
5. Conserver seulement 3 à 6 profils demo MVP.

### Étape 2 - Nettoyer données utilisateur/interactions

Ordre logique pour éviter FK :

1. `notifications`
2. `reports`
3. `warnings`
4. `moderation_actions`
5. `event_media_submission_likes`
6. `comment_likes`
7. `event_likes`
8. `event_interests`
9. `favorites`
10. `follows`
11. `event_views`
12. `event_checkins`
13. `event_media_submissions`
14. `event_comments` replies puis parents si FK non cascade
15. `event_media`
16. caches/stats : `event_engagement_stats`, `creator_engagement_stats`, `creator_fans`, `leaderboard`
17. `events`
18. non-MVP : `wallets`, `lumo_transactions`, `user_xp_levels`, `user_badges`, `user_missions`, `contest_entries`
19. `profiles` seed seulement

### Étape 3 - Préserver / reseeder référence

Préserver :

- catégories ;
- sous-catégories ;
- tags ;
- raisons de signalement côté code ;
- statuts enum/check.

Reseeder si nécessaire :

- catégories/sous-catégories/tags avec ordre et couleurs propres ;
- 3 à 6 profils demo ;
- 8 à 12 événements propres ;
- 1 événement `draft`, 1 `pending`, 1 `refused`, plusieurs `published` ;
- 5 à 10 médias propres ;
- quelques commentaires propres ;
- 2 favoris, 2 follows, 2 notifications demo.

### Étape 4 - Nettoyer Storage

1. Créer manifest de fichiers à conserver à partir des URLs DB demo.
2. Lister tous les fichiers Storage.
3. Comparer manifest vs fichiers.
4. Générer une liste "candidats suppression".
5. Demander confirmation humaine.
6. Supprimer les candidats seulement sur staging/dev.

## 5. Proposition de scripts

Les scripts ci-dessous sont des propositions. Ne pas exécuter tels quels sans :

- confirmation de l'environnement ;
- backup ;
- revue humaine ;
- dry-run préalable ;
- validation que la base n'est pas production.

### `clean_dev_data.sql`

```sql
-- PROPOSITION UNIQUEMENT - NE PAS EXECUTER SANS VALIDATION
-- Objectif : nettoyer un environnement dev/staging MVP.
-- Préconditions :
-- 1. Backup complet effectué.
-- 2. Environnement confirmé comme non-production.
-- 3. Liste des profils à conserver remplie.

begin;

-- Garde-fou manuel : remplacer par les vrais profils demo à conserver.
create temporary table keep_profiles(id uuid primary key);
-- insert into keep_profiles(id) values
--   ('00000000-0000-0000-0000-000000000001'),
--   ('00000000-0000-0000-0000-000000000002');

-- Interactions et logs utilisateur.
delete from public.notifications;
delete from public.reports;
delete from public.warnings;
delete from public.moderation_actions;
delete from public.event_media_submission_likes;
delete from public.comment_likes;
delete from public.event_likes;
delete from public.event_interests;
delete from public.favorites;
delete from public.follows;
delete from public.event_views;
delete from public.event_checkins;

-- UGC événement.
delete from public.event_media_submissions;
delete from public.event_comments;
delete from public.event_media;
delete from public.events;

-- Caches/stats et non-MVP.
delete from public.creator_fans;
delete from public.event_engagement_stats;
delete from public.creator_engagement_stats;
delete from public.leaderboard;
delete from public.contest_entries;
delete from public.user_missions;
delete from public.user_badges;
delete from public.user_xp_levels;
delete from public.lumo_transactions;
delete from public.wallets;

-- Bug reports dev/support.
delete from public.bug_reports;

-- Profils seed/dev uniquement.
-- Ne jamais supprimer auth.users ici.
delete from public.profiles p
where not exists (select 1 from keep_profiles k where k.id = p.id);

-- Conserver catégories/sous-catégories/tags.
-- Conserver badges/missions/lumo_rules selon décision produit.

-- Review counts before commit.
-- select 'profiles' table_name, count(*) from public.profiles union all
-- select 'events', count(*) from public.events union all
-- select 'notifications', count(*) from public.notifications;

-- rollback; -- garder rollback par défaut pendant les tests.
-- commit;   -- remplacer uniquement après validation humaine.
rollback;
```

### `seed_mvp_reference_data.sql`

```sql
-- PROPOSITION UNIQUEMENT - Référence MVP.
-- Objectif : garantir catégories/sous-catégories/tags propres.

begin;

-- Exemple de structure : adapter aux catégories finales.
insert into public.event_category (slug, label, icon, color, position)
values
  ('culture', 'Culture', 'palette', '#2BBFE3', 10),
  ('sport', 'Sport', 'activity', '#22C55E', 20),
  ('famille', 'Famille', 'users', '#F59E0B', 30),
  ('musique', 'Musique', 'music', '#A855F7', 40),
  ('bien-etre', 'Bien-être', 'heart', '#EC4899', 50)
on conflict (slug) do update
set label = excluded.label,
    icon = excluded.icon,
    color = excluded.color,
    position = excluded.position;

-- Ajouter subcategories/tags de manière idempotente.

rollback;
```

### `seed_demo_data.sql`

```sql
-- PROPOSITION UNIQUEMENT - Demo MVP.
-- Objectif : créer un petit jeu de données propre pour screenshots/review.
-- Précondition : profils demo créés côté Auth ou IDs explicitement validés.

begin;

-- Exemple conceptuel :
-- 1. Insérer 3 profils demo : organisateur, habitant, institution.
-- 2. Insérer 8-12 événements :
--    - 6 published publics
--    - 1 pending
--    - 1 refused avec raison de refus si colonne disponible
--    - 1 draft
-- 3. Ajouter covers et médias propres déjà uploadés.
-- 4. Ajouter 3 commentaires, 2 favoris, 2 follows, 2 notifications.

-- Ne pas utiliser picsum/pravatar en seed MVP final.
-- Ne pas créer de wallet/missions/shop pour MVP visible.

rollback;
```

### `storage_cleanup_plan.md`

```md
# Storage Cleanup Plan

1. Exporter les fichiers actuels :
   - bucket
   - path
   - size
   - created_at
   - updated_at

2. Générer manifest DB :
   - profiles.avatar_url
   - profiles.cover_url
   - events.cover_url
   - event_media.url
   - event_media_submissions.url

3. Classer :
   - KEEP : référencé par DB demo
   - REVIEW : non référencé mais récent ou chemin inconnu
   - DELETE_CANDIDATE : non référencé, ancien, préfixe legacy/test

4. Faire valider la liste DELETE_CANDIDATE par un humain.

5. Supprimer uniquement sur staging/dev.

6. Relancer l'audit missing refs :
   - aucune URL DB ne doit pointer vers un fichier absent.
```

## 6. Risques

### Suppression accidentelle de comptes

- `auth.users` contient 32 utilisateurs et `profiles` 68 lignes.
- Ne jamais supprimer `auth.users` sans décision explicite.
- Une suppression de `profiles` peut casser des comptes Auth encore valides.

### Rupture de foreign keys

- Les tables sociales et UGC dépendent fortement de `profiles` et `events`.
- Nettoyer les parents avant les enfants peut provoquer des erreurs ou cascades non désirées.
- Toujours nettoyer enfants/interactions avant `events` et `profiles`.

### Fichiers Storage orphelins

- 143 fichiers potentiellement orphelins détectés.
- Suppression Storage sans manifest peut casser des images encore utilisées.
- Suppression DB sans Storage laisse des fichiers publics accessibles.

### Données demo incohérentes

- Events sans médias, médias sans events, commentaires sans auteurs, notifications sans target.
- Il faut seed un jeu cohérent, petit et représentatif.

### Suppression de données utiles aux tests

- Certains bug reports ou profils peuvent contenir des retours utiles.
- Faire un export CSV avant nettoyage.

### Confusion dev/staging/prod

- Risque principal.
- Tout script destructif doit exiger une confirmation humaine et idéalement vérifier un flag d'environnement.

## 7. Plan d'action priorisé

### P0 - Sécuriser avant toute suppression

1. Confirmer l'environnement : dev, staging ou prod.
2. Créer backup DB + export Storage manifest.
3. Lister profils/comptes à conserver.
4. Valider une stratégie : suppression staging vs anonymisation production.
5. Ne pas toucher à `auth.users`.

### P1 - Nettoyer dev/staging

1. Nettoyer interactions/logs/notifications/reports.
2. Nettoyer UGC seed : événements, médias, commentaires.
3. Nettoyer non-MVP : wallet, missions user, concours, leaderboard avancé.
4. Nettoyer profils seed/orphelins en conservant seulement les profils demo.
5. Recalculer ou vider caches/stats.

### P2 - Préparer seed demo MVP

1. Définir 3-6 profils demo crédibles.
2. Définir 8-12 événements propres avec vraies catégories et images.
3. Ajouter statuts `draft`, `pending`, `published`, `refused`.
4. Ajouter quelques interactions réalistes.
5. Ajouter notifications simples et signalements demo si utiles.

### P3 - Stratégie future de purge automatisée

1. Job Storage orphelins mensuel.
2. Purge notifications anciennes.
3. Purge event_views/check-ins GPS selon rétention.
4. Purge médias rejected/pending anciens.
5. Rapport périodique de cohérence DB/Storage.

## Conclusion

Pour une base MVP propre, la stratégie la plus sûre est de repartir d'un staging contrôlé, conserver uniquement les données de référence, nettoyer les données seed/dev et reseeder un petit scénario demo cohérent. La base actuelle contient trop de données de test pour être utilisée telle quelle en screenshots, review store ou bêta publique.
