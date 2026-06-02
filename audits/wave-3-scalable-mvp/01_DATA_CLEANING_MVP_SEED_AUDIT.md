# 01 - Data Cleaning / MVP Seed Audit

## Résumé exécutif

L'environnement contient des volumes et traces de développement importants : profils de test, événements fake, médias Picsum, notifications nombreuses, contenus non-MVP et fichiers Storage potentiellement orphelins. Pour une bêta élargie ou des screenshots store, il faut séparer strictement données de référence, données utilisateurs, données demo MVP et données non-MVP.

Niveau actuel : acceptable pour développement, trop bruité pour staging/store review.

## Constats

### Données de référence à préserver

- Catégories.
- Sous-catégories.
- Tags.
- Raisons de signalement.
- Raisons de modération/refus si présentes.
- Templates de notifications si présents.
- Statuts applicatifs.

Ces données doivent être seedées proprement, versionnées et non supprimées lors d'un nettoyage.

### Données utilisateurs à nettoyer ou anonymiser

- `profiles`
- `events`
- `event_media`
- `event_media_submissions`
- `event_comments`
- `event_comment_replies`
- `favorites`
- `likes`
- `follows`
- `notifications`
- `reports`
- `checkins`
- `bug_reports`
- `event_views`

Ces tables doivent être nettoyées différemment selon environnement : dev, staging, prod.

### Données non-MVP à isoler

- Shop.
- Offers.
- Missions.
- Wallet/Lumo avancé.
- Creator analytics avancé.
- Classements/gamification.

Pour le MVP, elles peuvent rester en base si non exposées, mais doivent être absentes du seed demo et de la navigation mobile.

### Données demo MVP à créer proprement

Seed recommandé :

- 3 à 5 profils propres : utilisateur standard, créateur, organisateur local.
- 8 à 12 événements publics publiés avec covers cohérentes.
- 1 événement `pending`.
- 1 événement `refused` avec raison de refus.
- 1 événement `draft` appartenant au créateur test.
- Quelques favoris/follows.
- 3 notifications utiles.
- 1 report de test.
- 1 check-in de test si QR flow validé.

### Storage

- Des fichiers orphelins probables ont déjà été identifiés dans les audits précédents.
- Buckets principaux : `event-media`, `avatar`.
- Les médias Picsum dans la DB ne correspondent pas forcément à Storage.
- Toute purge Storage doit être séparée de la purge DB et confirmée humainement.

## Risques

- Données fake visibles en screenshots ou store review.
- Profils sans auth user, ou auth user sans profil.
- Fichiers Storage orphelins consommant espace et polluant les audits.
- Suppression accidentelle de données utilisateurs.
- Seed demo non représentatif du vrai MVP.
- Confusion dev/staging/prod.

## Recommandations

- Créer trois scripts séparés :
  - `diagnose_data_integrity.sql`, lecture seule.
  - `clean_dev_data.sql`, destructif mais uniquement dev/staging avec confirmation.
  - `seed_mvp_demo_data.sql`, seed contrôlé.
- Ne jamais toucher à `auth.users` sans validation explicite.
- Préserver les données de référence.
- Anonymiser plutôt que supprimer si les contenus doivent rester pour tests de modération.
- Réconcilier DB et Storage avant toute purge.

## Scripts proposés sans exécution

### Diagnostic lecture seule

```sql
-- diagnose_data_integrity.sql
select 'profiles' as table_name, count(*) from public.profiles
union all select 'events', count(*) from public.events
union all select 'event_media', count(*) from public.event_media
union all select 'event_comments', count(*) from public.event_comments
union all select 'favorites', count(*) from public.favorites
union all select 'follows', count(*) from public.follows
union all select 'notifications', count(*) from public.notifications
union all select 'reports', count(*) from public.reports
union all select 'checkins', count(*) from public.event_checkins
union all select 'bug_reports', count(*) from public.bug_reports;

select e.id, e.title, e.creator_id
from public.events e
left join public.profiles p on p.id = e.creator_id
where p.id is null;

select em.id, em.event_id, em.url
from public.event_media em
left join public.events e on e.id = em.event_id
where e.id is null;
```

### Nettoyage dev/staging à confirmer

```sql
-- clean_dev_data.sql
-- A executer uniquement sur dev/staging apres confirmation humaine.
begin;

-- ordre indicatif, a adapter aux FK reelles
delete from public.notifications;
delete from public.event_views;
delete from public.event_checkins;
delete from public.favorites;
delete from public.follows;
delete from public.event_comment_replies;
delete from public.event_comments;
delete from public.reports;
delete from public.bug_reports;
delete from public.event_media_submissions;
delete from public.event_media;
delete from public.events;

-- profiles/auth.users a traiter separement, jamais automatiquement.

rollback;
```

### Seed demo MVP

```sql
-- seed_mvp_demo_data.sql
-- Insérer uniquement des données propres, explicites et non ambiguës.
-- Prévoir des UUID fixes pour la reproductibilité.
-- Ne pas insérer de données personnelles réelles.
```

## Quick wins

- Créer un staging propre distinct de dev.
- Retirer données Picsum visibles des événements store.
- Ajouter un seed minimal avec statuts `published/pending/refused/draft`.
- Documenter les tables à préserver.

## Fichiers concernés

- `DATA_CLEANING_AUDIT.md`
- `supabase/migrations/*`
- `src/types/database.ts`
- `src/data-provider/supabase-provider.ts`
- Storage Supabase : `event-media`, `avatar`

## Scénarios à tester

- Staging vide + seed reference.
- Staging seed demo MVP.
- Carte avec seulement événements publiés.
- Profil créateur avec draft/pending/refused.
- Notifications vers ressources existantes.
- Suppression compte sur compte demo.
- Réconciliation DB/Storage.

## Priorisation

### P0

- Séparer dev/staging/prod.
- Ne jamais nettoyer `auth.users` sans validation.
- Préserver référence.
- Produire diagnostic non destructif.

### P1

- Nettoyer staging.
- Reseeder demo MVP propre.
- Identifier orphelins Storage.

### P2

- Automatiser refresh staging.
- Ajouter jobs de purge.
- Ajouter fixtures e2e.
