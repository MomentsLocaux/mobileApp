# 04 - Supabase RLS Audit

## Résumé exécutif

Les protections RLS doivent être considérées comme le point le plus sensible avant MVP public. L'application manipule profils, événements, médias, commentaires, likes, favoris, check-ins, reports, bug reports et notifications. Les contrôles côté client ne suffisent pas.

Les vérifications précédentes sur Supabase ont montré plusieurs expositions anonymes ou trop larges : likes, check-ins, bug reports, event views, statistiques communautaires et buckets publics sans limites fortes. Ces éléments doivent être corrigés avant une publication publique.

Niveau de préparation : insuffisant pour un MVP public tant que les policies critiques ne sont pas revues.

## Constats

### Tables publiques attendues

Lecture publique acceptable sous conditions :

- `events` uniquement `published` + `public`
- `event_media` uniquement médias d'événements publics publiés
- catégories, sous-catégories, tags et données de référence
- profils publics limités à des champs publics
- commentaires uniquement sur événements publics publiés, si les commentaires sont visibles MVP

### Tables à protéger strictement

Ne doivent pas être lisibles librement :

- `event_checkins`
- `event_views`
- `event_likes` si expose les utilisateurs
- `favorites`
- `follows` si exposent graphe social complet
- `notifications`
- `reports`
- `bug_reports`
- médias privés ou submissions non approuvées
- données wallet/lumo/offers/shop non-MVP

### Expositions observées lors des checks précédents

- `profiles` lisible anonymement avec un volume significatif.
- `events` presque entièrement lisible anonymement, à corréler avec `published/public`.
- `event_media` lisible anonymement.
- `event_comments` partiellement lisible anonymement.
- `event_likes` lisible anonymement.
- `event_checkins` lisible anonymement, avec données de présence/localisation.
- `bug_reports` lisible anonymement.
- `event_views` lisible anonymement.
- `community_profile_stats` et `community_leaderboard` lisibles anonymement.
- Buckets `event-media` et `avatar` publics.

### RPC

- `get_events_by_ids` est utilisée pour récupérer les événements de la carte/favoris.
- Si cette RPC est `SECURITY DEFINER` ou contourne les filtres, elle peut exposer des événements non publics.
- Les RPC `is_moderator` et `is_profile_active` sont appelables anonymement ; ce n'est pas forcément bloquant, mais à limiter si inutile.
- Une migration locale mentionne `get_event_views_counts`, mais la fonction live semblait absente dans les checks précédents.

### Storage

- `event-media` public : acceptable uniquement si tous les fichiers publics sont liés à des événements publics approuvés.
- `avatar` public : acceptable si les avatars sont publics par design.
- Absence de limites fortes de taille/MIME observée précédemment : risque store/security.
- Des fichiers orphelins probables ont été identifiés dans l'audit data.

## Risques

- Fuite de données de présence via `event_checkins`.
- Fuite de bug reports contenant emails, logs, messages utilisateur ou screenshots.
- Exposition du graphe social via likes/follows/favorites.
- Contournement du cycle de modération via RPC.
- Écriture directe mobile sur tables qui devraient être serveur-only.
- Fichiers Storage publics non rattachés à du contenu publié.

## Recommandations

- Revoir toutes les policies avec une matrice : anon, authenticated owner, authenticated non-owner, moderator/admin, service role.
- Vérifier que `events` expose seulement `published/public` aux non-propriétaires.
- Interdire les updates directes de statut depuis mobile, sauf transitions autorisées.
- Restreindre `event_checkins` : lecture owner/admin ou agrégats uniquement.
- Restreindre `bug_reports` : insertion utilisateur possible, lecture admin service-only.
- Restreindre `reports` : insertion utilisateur possible, lecture admin service-only.
- Restreindre `notifications` : lecture uniquement destinataire.
- Restreindre `favorites/likes/follows` : écriture owner, lecture limitée.
- Remplacer les RPC sensibles par des fonctions qui appliquent explicitement les règles métier.
- Ajouter policies Storage liées au propriétaire et au type de contenu.

## Quick wins

- Couper lecture anon sur `event_checkins`, `bug_reports`, `event_views`, `event_likes` user-level.
- Vérifier `get_events_by_ids` pour imposer `status = published` + `visibility = public` hors owner/admin.
- Empêcher update direct de `events.status` depuis client.
- Ajouter limites Storage : taille max, types MIME images uniquement.
- Documenter les tables serveur-only.

## Points bloquants MVP

- P0 : lecture anon de check-ins.
- P0 : lecture anon de bug reports.
- P0 : lecture anon d'event views/likes user-level.
- P0 : RPC events pouvant contourner status/visibility.
- P0 : updates d'événements/statuts non verrouillées côté serveur.
- P1 : buckets publics sans gouvernance claire.

## Priorisation

### P0

- Auditer et corriger policies RLS des tables sensibles.
- Auditer RPC et Storage policies.
- Ajouter tests SQL non destructifs de permissions.

### P1

- Déplacer écritures sensibles vers Edge Functions/RPC sécurisées.
- Limiter le schéma public de profils.
- Mettre en place agrégats pour stats au lieu d'exposer lignes brutes.

### P2

- Ajouter monitoring d'accès anormal.
- Ajouter documentation interne RLS par table.

## Fichiers concernés

- `supabase/migrations/*`
- `src/data-provider/supabase-provider.ts`
- `src/lib/supabase/client.ts`
- `src/services/checkin.service.ts`
- `src/services/report.service.ts`
- `src/services/notifications.service.ts`
- `src/services/event-media-submissions.service.ts`
