# 02 - Notifications Audit

## Résumé exécutif

L'application dispose d'une inbox notifications fonctionnelle : liste, filtre non-lues, unread count, mark as read, mark all as read et subscription realtime Supabase. Pour le MVP, le périmètre inbox est cohérent. Les push notifications ne semblent pas réellement implémentées et doivent rester masquées ou présentées comme non actives.

Niveau actuel : bon pour inbox MVP, incomplet pour push et scalabilité backend.

## Constats

### Inbox

- `NotificationsInboxScreen` charge jusqu'à 100 notifications.
- Modes `all` et `unread`.
- `markAsRead` au tap.
- `markAllAsRead`.
- Refresh manuel.
- Empty/loading/error states présents.

### Unread count

- Le drawer lit `NotificationsService.getUnreadCount`.
- Subscription realtime `notifications:${userId}` recharge le count.
- Le badge affiche `99+` au-delà de 99.

### Realtime

- `subscribeToMyNotifications` écoute `postgres_changes` sur `notifications` filtré par `user_id`.
- Cleanup via `supabase.removeChannel(channel)`.
- C'est propre côté listener, sous réserve RLS correcte.

### Routing

- Les notifications contenant `event_id` ouvrent `/events/{id}`.
- L'écran vérifie l'existence de l'événement avant navigation.
- `moderation_escalation` peut router vers `/moderation/reports` si rôle admin/modérateur, ce qui contredit la décision produit mobile sans admin.

### Création des notifications

- Certaines notifications sont créées côté client, notamment invitations privées depuis `preview`.
- `moderation.service.ts` crée aussi des notifications côté mobile/admin.
- Des migrations archivées prévoient `enqueue_notification`, ce qui est plus sain côté backend.

### Push notifications

- `app/settings/notifications.tsx` parle de notifications push.
- Aucune dépendance `expo-notifications` n'a été identifiée dans `package.json`.
- Pas de permission Android `POST_NOTIFICATIONS` dans `app.config.ts`.
- Conclusion : push non prêt, inbox uniquement pour MVP.

### Notifications orphelines

- Une notification peut pointer vers un événement supprimé/refusé/privé.
- L'écran affiche un message si l'événement n'est plus accessible.
- Il manque une stratégie de purge ou d'invalidation.

## Risques

- Un utilisateur lisant les notifications d'un autre si RLS est trop large.
- Création de notifications arbitraires depuis client.
- Notifications pointant vers ressources supprimées.
- Promesse push non tenue dans settings.
- Route mobile vers modération admin.
- Volume notifications non paginé au-delà de 100.

## Recommandations

- Garder "inbox uniquement" pour MVP.
- Masquer le wording push tant que `expo-notifications` et permissions ne sont pas prêts.
- Déplacer la création de notifications vers backend/RPC/Edge Function.
- Supprimer routing mobile vers modération admin.
- Ajouter pagination ou infinite scroll après 100.
- Ajouter cleanup notifications vers ressources supprimées.
- Vérifier RLS : select/update uniquement `user_id = auth.uid()`.

## Quick wins

- Renommer "Notifications push" en "Notifications dans l'application" si push absent.
- Retirer `moderation_escalation -> /moderation/reports` du mobile MVP.
- Ajouter type guard pour ressources supprimées.
- Ajouter index DB `notifications(user_id, read, created_at desc)`.

## Fichiers concernés

- `src/screens/notifications/NotificationsInboxScreen.tsx`
- `src/services/notifications.service.ts`
- `app/(tabs)/_layout.tsx`
- `app/settings/notifications.tsx`
- `app/events/create/preview.tsx`
- `src/services/moderation.service.ts`
- `supabase/migrations/*notifications*`

## Scénarios à tester

- Inbox vide.
- Inbox avec 1, 50, 100+ notifications.
- Filtre non-lues.
- Tout lire.
- Tap notification événement existant.
- Tap notification événement supprimé/refusé.
- Realtime nouvelle notification.
- Logout/login autre utilisateur.
- Tentative lecture notification autre user via API.
- Settings notifications sans push réel.

## Priorisation

### P0

- Vérifier RLS notifications own-only.
- Retirer routing admin mobile.
- Ne pas promettre push si non prêt.

### P1

- Déplacer création notifications côté backend.
- Gérer notifications orphelines.
- Ajouter pagination.

### P2

- Push notifications.
- Préférences fines.
- Templates versionnés.
