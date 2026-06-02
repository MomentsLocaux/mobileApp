# 03 - Abuse / Anti-Spam / Trust & Safety Audit

## Résumé exécutif

Moments Locaux expose des surfaces d'abus classiques : création massive d'événements, spam commentaires, spam follows/favorites, médias inappropriés, signalements abusifs et comptes frauduleux. Le code contient des bases de modération, statuts profil et checks `is_profile_active`, mais le MVP ne semble pas disposer d'une stratégie complète de quotas/rate limiting côté backend.

Niveau actuel : mécanismes de signalement présents, protections anti-abus à renforcer avant ouverture publique.

## Constats

### Signalements

- Signalement événement, commentaire, profil et média disponibles côté data-provider.
- Raisons de signalement incluent `spam`.
- Les reports sont créés depuis le client.
- Les signalements doivent être traités dans une future web app admin, pas mobile.

### Statuts utilisateur

- Types profil : `active`, `restricted`, `suspended`, `banned`.
- Migrations mentionnent `is_profile_active(auth.uid())`.
- Certaines policies archivent ou appliquent ce check.
- Il faut vérifier que toutes les actions d'écriture MVP le respectent.

### Modération mobile

- Des écrans mobile admin existent encore dans le repo.
- Décision produit : à retirer/guarder du mobile MVP.

### Quotas et rate limiting

Aucun quota clair identifié côté mobile/base pour :

- nombre d'événements créés par jour.
- commentaires par minute.
- reports par cible/jour.
- follows par minute.
- uploads médias par minute.
- bug reports par heure.

### Check-in

- Edge Function `event-checkin` limite la distance à 500m.
- C'est un bon pattern backend pour action sensible.
- Ce modèle devrait inspirer les autres actions sensibles.

### Signalements abusifs

- Un utilisateur peut potentiellement signaler massivement.
- Il faut éviter qu'un report seul nuise directement à une cible.
- Les reports doivent être des signaux, pas des sanctions automatiques sans seuil/process.

## Risques

- Spam création événement.
- Spam commentaires.
- Harcèlement via follow/like/report.
- Upload média inapproprié ou volumétrique.
- Utilisateur banni continuant à écrire si policies incomplètes.
- Signalements abusifs utilisés comme arme sociale.
- Saturation notifications/bug reports.

## Recommandations

- Ajouter quotas backend MVP :
  - événements par user/jour.
  - commentaires par event/minute.
  - reports par target/user/jour.
  - uploads par user/heure.
  - follows par minute.
- Appliquer `is_profile_active` partout où un utilisateur écrit.
- Ajouter statut `restricted` avec limitations concrètes.
- Créer Edge Functions/RPC pour actions sensibles.
- Ajouter déduplication reports : `reporter_id + target_type + target_id`.
- Ne jamais sanctionner automatiquement sur un seul report.
- Journaliser actions sensibles côté backend.

## Quick wins

- Vérifier policies insert/update pour `events`, `comments`, `reports`, `follows`, `event_media_submissions`.
- Ajouter unique constraint report par reporter/cible si absente.
- Bloquer création événement/commentaire si profil non actif.
- Limiter contributions photo par user/event côté DB.

## Fichiers concernés

- `src/data-provider/supabase-provider.ts`
- `src/services/report.service.ts`
- `src/services/checkin.service.ts`
- `supabase/functions/event-checkin/index.ts`
- `supabase/migrations/*rls*`
- `src/types/database.ts`
- `src/constants/report-reasons.ts`
- `app/moderation/*`

## Scénarios à tester

- Utilisateur actif crée événement.
- Utilisateur banned tente créer événement.
- Utilisateur restricted tente commenter.
- Spam 20 commentaires rapides.
- Spam 20 follows rapides.
- Double report même cible.
- Report abusif sans sanction automatique.
- Upload 10 photos contribution.
- Check-in hors rayon.
- Check-in répété même événement.

## Priorisation

### P0

- Bloquer writes pour profils banned/suspended.
- Vérifier RLS reports/checkins/comments/events.
- Dédupliquer reports.

### P1

- Ajouter quotas/rate limits backend.
- Journaliser actions sensibles.
- Définir effets concrets du statut restricted.

### P2

- Système de trust score.
- Détection spam automatique.
- File de review admin avancée.
