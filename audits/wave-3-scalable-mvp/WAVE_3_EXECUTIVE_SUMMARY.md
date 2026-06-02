# Wave 3 - Scalable MVP Executive Summary

## Verdict global

Moments Locaux peut évoluer après MVP, mais la scalabilité saine dépend de plusieurs fondations à poser avant bêta élargie : données propres, notifications backend, anti-abus, accessibilité, contenu légal, analytics minimal et résilience réseau.

Niveau actuel : base produit prometteuse, mais encore trop orientée dev/prototype pour une montée en charge sereine.

## Synthèse par audit

| Audit | Niveau actuel | Verdict |
| --- | --- | --- |
| Data Cleaning / Seed | Dev OK, staging bruité | Nettoyage + seed MVP indispensable |
| Notifications | Inbox OK | Push non prêt, création client à déplacer |
| Abuse / Anti-spam | Signalements présents | Quotas/rate limits manquants |
| Accessibility | Inégal | Labels/touch targets/fallback carte à renforcer |
| Legal Content | Structure présente | Contenus placeholders à finaliser |
| Product Analytics | Embryonnaire | Tracking plan minimal à définir |
| Offline / Weak Network | Réseau normal OK | Brouillon local/offline à améliorer |

## P0 transverses

- Séparer dev/staging/prod et créer un seed MVP propre.
- Vérifier RLS notifications own-only.
- Retirer toute route admin mobile liée aux notifications/modération.
- Bloquer les writes pour profils banned/suspended.
- Ajouter labels accessibles sur actions critiques.
- Finaliser CGU/privacy/mentions.
- Ne pas tracker de données sensibles libres.
- Ne pas perdre la création événement en cas de réseau faible/app restart.

## Ce qui est déjà solide

- Inbox notifications avec unread, mark read, realtime et cleanup.
- Signalements utilisateur présents.
- Statuts profil/modération déjà modélisés.
- Check-in via Edge Function avec contrôle distance.
- Bottom sheet liste comme fallback potentiel à la carte.
- Structure légale existante dans settings.
- Tracking `event_views` existant.

## Ce qui bloque une montée en charge saine

- Données demo/dev trop bruitées.
- Notifications créées depuis client.
- Push affiché mais pas réellement prêt.
- Absence de quotas anti-spam.
- Accessibilité icon-only incomplète.
- CGU/privacy avec placeholders.
- Analytics non structuré.
- Création événement non persistée localement.

## Plan d'action recommandé

### P0 - Avant bêta élargie

1. Données :
   - staging propre
   - seed MVP stable
   - diagnostic DB/Storage non destructif

2. Trust & Safety :
   - writes bloqués pour banned/suspended
   - déduplication reports
   - RLS reports/checkins/comments/events vérifiée

3. Notifications :
   - inbox only assumée
   - push masqué si non prêt
   - notifications own-only
   - pas de routing admin mobile

4. Accessibilité :
   - labels actions critiques
   - fallback liste carte
   - auth/création testées VoiceOver/TalkBack

5. Legal :
   - CGU/privacy/mentions finalisées
   - consentement register
   - règles communautaires MVP

6. Offline :
   - sauvegarde locale brouillon
   - erreurs upload/search/check-in explicites
   - pas de loading infini

### P1 - Avant ouverture publique

- Déplacer création notifications côté backend.
- Ajouter quotas/rate limiting.
- Ajouter analytics minimal.
- Ajouter cache minimal derniers contenus.
- Ajouter tests accessibilité complets.

### P2 - Post-MVP

- Push notifications.
- Trust score.
- Queue offline.
- Analytics avancé.
- Admin web complète.
- Purges automatiques DB/Storage.

## Conclusion

La vague 3 montre que le MVP peut rester simple tout en préparant la suite. Le bon cap est de ne pas ajouter de grosses features maintenant, mais de rendre les fondations propres : données, sécurité d'écriture, accessibilité, légal, tracking minimal et résilience réseau.
