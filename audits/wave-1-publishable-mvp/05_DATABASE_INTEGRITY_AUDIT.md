# 05 - Database Integrity Audit

## Résumé exécutif

La base contient une quantité importante de données de développement et de démonstration. Les relations principales semblent présentes, mais plusieurs signaux demandent une revue avant MVP : incohérence profils/auth users, volumes de seed très élevés, médias de test, fichiers Storage probablement orphelins, et règles métier événement à renforcer côté base.

Niveau de préparation : moyen pour développement, insuffisant pour staging/store review sans nettoyage et validation d'intégrité.

## Constats

### Profils et auth

- Les checks précédents ont identifié plus de lignes `profiles` que d'utilisateurs Supabase Auth.
- Cela suggère des profils orphelins, des seeds ou des comptes de test sans auth correspondante.
- Le MVP doit garantir une relation claire `profiles.id` ou `profiles.user_id` vers `auth.users`.

### Événements

- Volume élevé d'événements, majoritairement publiés dans l'environnement audité.
- Les statuts présents doivent être contraints à une liste stricte : `draft`, `pending`, `published`, `refused`, `archived`.
- Les champs ownership doivent être cohérents : `creator_id`, `user_id`, `created_by` selon le modèle réel.
- Les transitions de statut ne semblent pas entièrement garanties côté base.

### Médias

- `event_media` contient beaucoup d'URLs de test de type Picsum dans les données précédentes.
- Les checks Storage précédents ont identifié de nombreux fichiers probablement orphelins.
- Les références DB analysées ne pointaient pas vers des fichiers manquants dans l'échantillon précédent, mais la réconciliation doit être refaite avant nettoyage.

### Commentaires et replies

- Les commentaires sont des contenus générés par les utilisateurs.
- Il faut vérifier contraintes FK vers `events` et `profiles`.
- Il faut vérifier soft delete/anonymisation plutôt que suppression brute si un fil doit rester lisible.

### Favorites, likes, follows

- Ces tables doivent avoir des contraintes uniques pour éviter les doublons :
  - user + event
  - follower + followed
  - user + comment/media selon cas
- Elles ne doivent pas exposer tout le graphe social publiquement.

### Check-ins

- Les check-ins sont sensibles car ils prouvent une présence.
- Ils doivent avoir des contraintes d'unicité par utilisateur/événement.
- Les coordonnées éventuelles doivent être privées ou agrégées.

### Reports et bug reports

- Ces tables peuvent contenir des données personnelles, messages libres ou captures.
- Lecture mobile directe à éviter.
- Elles doivent être conservées temporairement pour sécurité/modération, puis purgées/anonymisées.

### Notifications

- Elles doivent être liées à un destinataire clair.
- Les anciennes notifications de test doivent être nettoyées avant screenshots/store.
- Les templates éventuels sont des données de référence à préserver.

### Données non-MVP

- Offers, shop, wallet/lumo, missions et gamification avancée doivent être isolés.
- Les données non-MVP ne doivent pas influencer l'UX ou les permissions du MVP.

## Risques

- Profils orphelins ou comptes sans profil.
- Médias Storage non liés à la DB.
- Lignes DB pointant vers fichiers absents.
- Doublons dans likes/favorites/follows/checkins.
- Statuts événement incohérents.
- Suppression de compte qui casse FKs ou laisse des contenus identifiants.
- Données de test visibles dans screenshots/store review.

## Recommandations

- Créer un rapport d'intégrité non destructif avant tout nettoyage :
  - profils sans auth user
  - auth users sans profil
  - events sans creator valide
  - event_media sans event
  - comments sans event/author
  - notifications sans recipient
  - reports sans reporter/target valide
  - fichiers Storage sans référence DB
- Ajouter ou vérifier contraintes :
  - FK sur ownership
  - unique indexes sur interactions
  - checks statut/visibilité
  - timestamps `created_at`, `updated_at`
- Préparer un environnement staging propre avec seed MVP contrôlé.
- Ne jamais nettoyer `auth.users` sans validation humaine.

## Quick wins

- Produire un script SQL de diagnostic en lecture seule.
- Identifier les profils orphelins.
- Identifier les événements non publics qui seraient lisibles anonymement.
- Identifier les médias Picsum/test.
- Préparer seed demo : quelques profils, événements propres, statuts `pending/refused/published`.

## Points bloquants MVP

- P0 : règles statut/visibilité/ownership non garanties côté base.
- P0 : absence de stratégie suppression/anonymisation liée aux FKs.
- P0 : données de test visibles en environnement store.
- P1 : fichiers Storage orphelins.
- P1 : manque de seed demo propre.

## Priorisation

### P0

- Vérifier contraintes FK et checks.
- Vérifier cohérence `profiles` vs `auth.users`.
- Verrouiller lifecycle événement côté base.
- Préparer scripts de diagnostic non destructifs.

### P1

- Nettoyer dev/staging après confirmation humaine.
- Reseeder données MVP propres.
- Réconcilier DB et Storage.

### P2

- Automatiser purge de fichiers orphelins.
- Ajouter tests d'intégrité en CI.
- Ajouter jobs de maintenance.

## Fichiers concernés

- `supabase/migrations/*`
- `src/types/database.ts`
- `src/data-provider/supabase-provider.ts`
- `src/services/events.service.ts`
- `src/services/checkin.service.ts`
- `src/services/report.service.ts`
- `DATA_CLEANING_AUDIT.md`
