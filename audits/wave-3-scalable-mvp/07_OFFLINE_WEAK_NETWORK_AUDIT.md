# 07 - Offline / Weak Network Audit

## Résumé exécutif

L'application gère certains cas réseau par `try/catch`, retries Supabase ponctuels et états loading/error. En revanche, elle n'a pas encore de stratégie offline complète. La création d'événement est stockée en mémoire Zustand et peut être perdue si l'app redémarre avant sauvegarde brouillon. Les uploads interrompus et erreurs Mapbox restent des points faibles.

Niveau actuel : acceptable réseau normal, fragile réseau faible/offline.

## Constats

### Création événement

- `useCreateEventStore` est un store Zustand non persisté.
- Les champs restent en mémoire pendant navigation, mais pas après crash/restart.
- `step-1` propose une sauvegarde brouillon en DB.
- Si le réseau tombe avant sauvegarde brouillon, l'utilisateur peut perdre des données.

### Uploads

- Upload cover et contributions photo reposent sur `fetch(uri)` puis upload Supabase.
- Pas de retry upload identifié.
- Pas de queue offline.
- En cas d'échec cover, certains composants reset l'image et loggent.

### Carte/recherche

- Mapbox search retourne `[]` en cas erreur.
- Carte peut rester vide ou fallback sans message réseau précis.
- Pas de cache persistant des derniers événements consultés identifié.

### Supabase

- `supabase-provider` a un `withRetry` pour certains appels.
- Pas de timeout global standardisé.
- Plusieurs erreurs sont silencieuses ou deviennent des fallback.

### Check-in

- Check-in dépend réseau, QR, localisation et backend.
- Pas de mode offline raisonnable pour check-in MVP.
- Il faut afficher clairement "connexion requise".

### Favoris/likes/follows

- Stores persistés localement pour favoris/likes.
- Les toggles réseau peuvent diverger si Supabase échoue.
- Il faut vérifier reconciliation après erreur.

## Risques

- Perte formulaire création événement.
- Upload cover échoué sans explication suffisante.
- Recherche adresse vide sans savoir si réseau ou aucun résultat.
- Check-in impossible sans message clair.
- Favoris/likes optimistes incohérents.
- Utilisateur en réseau faible bloqué sur loading.

## Recommandations

- Ajouter détection réseau globale via une stratégie compatible Expo.
- Persister le brouillon de création localement avant submit.
- Afficher bannière "connexion faible/offline".
- Ajouter retry contrôlé pour uploads.
- Ne pas effacer immédiatement l'image locale si upload échoue.
- Ajouter timeouts standardisés.
- Garder cache minimal :
  - derniers événements consultés.
  - derniers résultats carte/recherche.
  - brouillon local.
- Check-in : afficher clairement "connexion nécessaire".

## Quick wins

- Ne pas clear cover locale après échec upload.
- Ajouter message utilisateur sur Mapbox error.
- Ajouter sauvegarde locale du formulaire création.
- Ajouter bouton "réessayer" sur upload/carte.
- Tester en mode offline iOS/Android.

## Fichiers concernés

- `src/hooks/useCreateEventStore.ts`
- `app/events/create/step-1.tsx`
- `app/events/create/preview.tsx`
- `src/components/events/CoverImageUploader.tsx`
- `src/components/events/EventPhotoContributionModal.tsx`
- `src/services/mapbox.service.ts`
- `app/(tabs)/map.tsx`
- `src/data-provider/supabase-provider.ts`
- `src/services/checkin.service.ts`
- `src/store/persistStorage.ts`

## Scénarios à tester

- Perte réseau pendant saisie création.
- Perte réseau pendant upload cover.
- Perte réseau pendant submit événement.
- App kill/restart pendant création.
- Carte ouverte sans réseau.
- Recherche adresse sans réseau.
- Détail événement sans réseau.
- Favori avec réseau coupé.
- Follow avec réseau coupé.
- Check-in sans réseau.
- Réseau revient après erreur.

## Priorisation

### P0

- Ne pas perdre les données de création.
- Feedback clair sur upload/check-in/search offline.
- Éviter états loading infinis.

### P1

- Persistance brouillon local.
- Retry upload.
- Cache minimal derniers contenus.

### P2

- Queue offline.
- Synchronisation différée.
- Mode offline complet liste/favoris.
