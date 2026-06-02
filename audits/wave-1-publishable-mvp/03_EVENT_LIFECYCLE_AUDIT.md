# 03 - Event Lifecycle Audit

## Résumé exécutif

Le cycle événement couvre les états nécessaires au MVP : `draft`, `pending`, `published`, `refused`, `archived`. Le parcours principal de création est clair : step-1, step-2, preview, puis soumission en `pending`. Les événements publics visibles sur carte/liste sont filtrés côté client/data-provider sur `status = published` et `visibility = public`, ce qui va dans le bon sens.

Le risque principal est que les règles métier critiques ne sont pas suffisamment verrouillées côté serveur/RLS. Certains écrans limitent l'édition, mais d'autres routes permettent encore de tenter une modification via `?edit=...`. Pour un MVP publiable, le statut événement ne doit jamais dépendre uniquement du client.

Niveau de préparation : moyen à bon côté UX, insuffisant côté enforcement métier.

## Constats

### Création

- `app/events/create/step-1.tsx` collecte titre, cover, lieu et peut sauvegarder un brouillon.
- `app/events/create/step-2.tsx` complète les informations et redirige vers `preview`.
- `app/events/create/preview.tsx` soumet l'événement en `pending`.
- `app/events/create/step-3.tsx` existe encore mais ne semble plus faire partie du flux principal.

### Brouillon

- La sauvegarde brouillon est prévue dans `step-1`.
- `step-1` bloque la sauvegarde brouillon si l'événement existant n'est pas `draft`.
- Les brouillons ne doivent pas apparaître publiquement. Les requêtes carte/liste filtrent bien sur `published/public`.

### Pending

- Les événements soumis passent en `pending`.
- `MyEventsScreen` affiche le statut `En validation`.
- `MyEventsScreen` ne permet pas l'édition des `pending`.
- Il faut confirmer côté serveur que les `pending` ne sont pas modifiables depuis mobile, sauf règle explicitement décidée.

### Published

- Les requêtes publiques `listEvents` et `listEventsByBBox` filtrent `status = published` + `visibility = public`.
- `EventDetailScreen` affiche un bouton modifier pour propriétaire/admin sans condition de statut.
- Cette différence avec `MyEventsScreen` peut permettre à un propriétaire de modifier un événement publié via le détail.

### Refused

- `MyEventsScreen` permet l'édition des événements `refused`.
- `preview` remet le payload en `pending`, donc la resoumission semble possible.
- Aucune raison de refus visible n'a été identifiée dans `MyEventsScreen`.
- Pour le MVP, afficher une raison de refus est recommandé si la modération refuse un événement.

### Archived

- Le statut `archived` est affiché dans `MyEventsScreen`.
- Un événement archivé n'est pas éditable depuis `MyEventsScreen`.
- Il reste ouvrable en détail depuis le profil.
- Aucun flux clair d'archivage/restauration/suppression soft delete n'a été identifié côté mobile.

### Visibilité privée

- La création supporte une visibilité privée et une audience.
- Les requêtes carte/liste filtrent `visibility = public`.
- Le point à vérifier côté RLS est que les événements privés ne sont jamais lisibles par des utilisateurs hors audience via accès direct ou RPC.

### Notifications privées

- `preview` appelle `NotificationsService.notifyPrivateAudience` depuis le mobile.
- Pour une logique de notification privée, l'écriture directe depuis client est fragile.
- Cette responsabilité devrait être déplacée vers une Edge Function/RPC sécurisée.

## Réponses aux questions clés

- Un événement `pending` est-il modifiable ? UI principale : non. Route directe : à verrouiller côté serveur.
- Un événement `published` est-il modifiable ? Oui depuis le détail propriétaire/admin, ce qui est risqué.
- Un événement `refused` peut-il être corrigé puis resoumis ? Oui côté UI `MyEvents -> edit -> preview`, mais raison de refus à afficher.
- Un événement `archived` est-il encore visible ? Oui depuis `MyEvents`/détail propriétaire ; pas censé être public.
- Un événement `draft` apparaît-il publiquement ? Les requêtes publiques filtrent `published/public`, donc non côté carte/liste.
- Un événement `pending` peut-il apparaître sur la carte ? Non via `listEventsByBBox`, mais vérifier RPC/deep links.
- Un événement privé peut-il apparaître par erreur ? Le data-provider filtre `public`, mais il faut confirmer RLS/RPC.

## Risques

- Escalade de statut ou modification d'un événement publié depuis mobile.
- Édition par deep link non conforme au lifecycle attendu.
- Ancienne route `step-3` utilisée par erreur.
- Absence de raison de refus côté créateur.
- Notifications/audience privée créées directement depuis le client.
- RLS insuffisante sur événements privés, favoris ou RPC.

## Recommandations

- Définir une machine d'état événement minimale en base.
- Autoriser côté mobile uniquement :
  - création `draft`
  - soumission `draft/refused -> pending`
  - édition `draft/refused` par créateur
  - lecture publique `published/public`
- Interdire côté base/client direct :
  - `published -> pending` depuis mobile
  - modification `published` hors process modéré
  - lecture `draft/pending/refused/private` par non-propriétaire/non-audience
- Déplacer les transitions sensibles dans une RPC/Edge Function.
- Afficher `refusal_reason` ou équivalent dans `MyEventsScreen`.
- Retirer ou rediriger `step-3`.

## Quick wins

- Conditionner le bouton edit du détail à `event.status === 'draft' || event.status === 'refused'`.
- Ajouter une garde dans `step-1` si `edit` cible un statut non éditable.
- Afficher la raison de refus si disponible.
- Bloquer `step-3` en production MVP.
- Ajouter une checklist de tests lifecycle.

## Points bloquants MVP

- P0 : édition possible d'un événement publié depuis le détail.
- P0 : règles de transition statut non garanties côté serveur.
- P0 : événements privés/pending/draft à vérifier côté RLS/RPC.
- P1 : raison de refus non visible.
- P1 : route legacy `step-3`.

## Priorisation

### P0

- Verrouiller les transitions statut côté base/RPC.
- Corriger l'accès édition depuis détail événement.
- Vérifier RLS lecture events par statut/visibilité/audience.

### P1

- Afficher raison de refus.
- Retirer route legacy création.
- Formaliser cycle : draft, pending, published, refused, archived.

### P2

- Ajouter historique de modération.
- Ajouter archivage/restauration propre.
- Ajouter versioning des modifications événement.

## Fichiers concernés

- `app/events/create/step-1.tsx`
- `app/events/create/step-2.tsx`
- `app/events/create/preview.tsx`
- `app/events/create/step-3.tsx`
- `src/screens/profile/MyEventsScreen.tsx`
- `src/screens/events/EventDetailScreen.tsx`
- `src/data-provider/supabase-provider.ts`
- `src/services/events.service.ts`
- `src/services/notifications.service.ts`
