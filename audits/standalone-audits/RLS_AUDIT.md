# Audit Supabase RLS / Sécurité Backend - Moments Locaux

## 1. Résumé exécutif

Audit réalisé le 2 juin 2026 en lecture seule, à partir de trois sources :

- tests live Supabase avec clé anon et service role ;
- inventaire Storage live ;
- analyse des migrations SQL locales, Edge Functions et services front-end.

Limite importante : les policies live exactes ne sont pas directement requêtables via l'API REST Supabase. Les constats "live" ci-dessous sont donc basés sur des tests d'accès anon/service et sur les migrations disponibles dans le repo. Aucune migration n'a été appliquée et aucune requête destructive n'a été exécutée.

Niveau de sécurité actuel estimé : 5/10 pour un MVP public.

La base possède de bonnes fondations : RLS existe dans les migrations sur les tables clés, les relations favorites/follows ont des policies owner explicites, les signalements sont prévus côté utilisateur, l'Edge Function `event-checkin` vérifie l'authentification et la distance, et les buckets Storage principaux existent. Mais plusieurs surfaces sensibles restent trop exposées ou trop dépendantes du client mobile.

Risques principaux :

- P0 : `bug_reports` est lisible en anon en live, alors que cette table contient des descriptions libres potentiellement sensibles.
- P0 : `event_checkins` est lisible en anon en live et expose `lat`, `lon`, `user_id`, `event_id`.
- P0 : `event_views` est lisible en anon en live et expose des traces de consultation.
- P0 : `event_likes` est lisible en anon en live et expose le graphe `user_id/event_id`.
- P0 : les owners d'événements peuvent probablement mettre à jour `status` via `events_update_owner_or_mod`; il faut empêcher un créateur de forcer `published`.
- P0 : les routes/services de modération admin existent encore côté mobile, alors que l'admin doit être web-only.
- P1 : `profiles` public expose trop de colonnes potentielles (`role`, `status`, `ban_until`, réseaux sociaux selon contexte).
- P1 : `get_events_by_ids` est `SECURITY DEFINER` et exécutable par anon ; il doit appliquer le même filtre que la lecture publique.
- P1 : `get_event_views_counts` est utilisé par le front mais non trouvé en live via PostgREST pendant le test.
- P1 : buckets `avatar` et `event-media` publics sans limite MIME/taille live.

Points bloquants avant MVP :

- resserrer les lectures anon des tables comportementales/personnelles ;
- retirer la capacité client mobile d'écrire les champs sensibles `profiles.role/status/ban_until` et `events.status`;
- déplacer toutes les actions admin/modération sensibles vers backend/web admin ;
- durcir Storage et les RPC `SECURITY DEFINER`;
- ajouter une vue publique minimale pour les profils au lieu d'exposer toute la table.

## 2. Inventaire Supabase

### Tables/vues live confirmées

Tables ou vues accessibles au service role :

- `profiles`
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
- `wallets`
- `lumo_transactions`
- `user_xp_levels`
- `badges`
- `user_badges`
- `missions`
- `user_missions`
- `leaderboard`
- `community_leaderboard`
- `event_category`
- `event_subcategory`
- `event_tag`
- `community_profile_stats`
- `event_engagement_stats`
- `creator_engagement_stats`
- `creator_fans`
- `kv_store_b32ec4be`
- `shop_items`
- `contest_entries`
- `lumo_rules`

Non trouvées en live :

- `transactions` : renommée/absente, `lumo_transactions` existe.
- `event_comment_replies` : pas de table séparée ; les replies utilisent `event_comments.parent_comment_id`.
- `report_media` : absente.

### Exposition anon confirmée par test live

Lisibles en anon avec au moins une ligne retournée :

- `profiles`
- `events`
- `event_media`
- `event_media_submissions` uniquement des données approuvées d'après l'échantillon agrégé
- `event_comments`
- `event_likes`
- `event_checkins`
- `bug_reports`
- `event_views`
- `user_xp_levels`
- `event_category`
- `event_subcategory`
- `event_tag`
- `community_profile_stats`
- `community_leaderboard`

Lisibles en anon mais retournant 0 ligne au test :

- `comment_likes`
- `event_media_submission_likes`
- `event_interests`
- `favorites`
- `follows`
- `notifications`
- `reports`
- `warnings`
- `moderation_actions`
- `wallets`
- `lumo_transactions`
- `badges`
- `user_badges`
- `missions`
- `user_missions`
- `leaderboard`
- `event_engagement_stats`
- `creator_engagement_stats`
- `creator_fans`
- `kv_store_b32ec4be`
- `shop_items`
- `contest_entries`
- `lumo_rules`

Note : "0 ligne" ne prouve pas l'absence de policy trop permissive si la table est vide, filtrée ou si les données ne matchent pas. Les tables sensibles doivent être vérifiées côté SQL.

### RPC identifiées

Confirmées/testées :

- `get_events_by_ids(ids uuid[])` : exécutable par anon, retourne des événements.
- `is_moderator()` : exécutable anon/service, retourne un booléen.
- `is_profile_active(p_user uuid)` : exécutable anon, retourne un booléen.
- `get_event_views_counts(event_ids uuid[])` : présent dans migration locale mais non trouvé en live via PostgREST pendant le test.

Identifiées dans migrations/code :

- `toggle_like(event_id uuid)` : `SECURITY DEFINER`, grant authenticated.
- `toggle_favorite(event_id uuid)` : `SECURITY DEFINER`, grant authenticated.
- `get_events_by_ids(ids uuid[])` : `SECURITY DEFINER`, grant anon/authenticated/service_role.
- `get_event_views_counts(event_ids uuid[])` : `SECURITY DEFINER`, grant anon/authenticated/service_role dans migration locale.
- fonctions de notifications triggers : `enqueue_notification`, `notify_event_status_transition`, `notify_warning_created`, `notify_profile_ban`, `notify_media_submission_status`, `notify_contest_entry_status`, `notify_report_escalation`.
- fonctions creator stats : `refresh_creator_engagement_stats`, `recalculate_event_engagement_stats`, `upsert_creator_fan`, handlers de triggers.

### Edge Functions

Confirmée localement :

- `event-checkin`

Usage :

- reçoit `eventId`, `lat`, `lon`, `qrToken`, `source`;
- authentifie via token Bearer ;
- utilise service role côté serveur ;
- vérifie distance et QR token ;
- écrit `event_checkins`;
- crédite éventuellement Lumo via `lumo_rules`, `lumo_transactions`, `wallets`.

### Storage buckets live

Buckets live :

- `event-media`, public `true`, pas de limite MIME/taille live.
- `avatar`, public `true`, pas de limite MIME/taille live.

Policies locales identifiées :

- `avatar` : insert/update/delete owner, select public.
- `event-media` : insert/update/delete owner, select public.

## 3. Audit par table

### `profiles`

- RLS activée : oui d'après migrations.
- Policies existantes déduites : `profiles_select_public`, `profiles_select_auth_or_own`, `profiles_insert_own`, `profiles_update_own`, `profiles_update_moderation`.
- Opérations attendues : lecture publique limitée aux champs nécessaires ; update uniquement propre profil ; rôle/statut/ban réservés backend/admin.
- Live : anon lit 68 profils et colonnes exposées incluant `role`, `status`, `ban_until`, réseaux sociaux.
- Écart : `profiles_select_public USING (true)` expose trop de colonnes si la table complète est utilisée par PostgREST.
- Risque : P1, P0 si `email` ou champs sensibles réapparaissent en table.
- Recommandation : créer une vue `public_profiles` avec champs minimaux (`id`, `display_name`, `avatar_url`, `cover_url`, `city`, `bio` si assumé public), retirer la lecture anon directe de `profiles`, bloquer update des champs sensibles par policy ou trigger.

### `events`

- RLS activée : oui d'après migrations.
- Policies déduites : `events_select_public`, `events_select_auth`, `events_insert_creator`, `events_update_owner_or_mod`, `events_delete_owner_or_mod`.
- Live : service lit 1113, anon lit 1110, ce qui indique une restriction partielle.
- Modèle attendu : anon lit uniquement `published` + `public`; creator lit ses propres `draft/pending/refused`; creator ne peut jamais forcer `published`.
- Écart : migrations montrent `events_update_owner_or_mod` avec `WITH CHECK auth.uid() = creator_id`, sans restriction colonne par colonne ; un owner pourrait modifier `status` si RLS seule protège.
- Risque : P0, contournement modération.
- Recommandation : trigger `prevent_creator_status_escalation` ou RPC de publication qui force `pending`; interdire update client sur `status`, `creator_id`, `qr_token`, compteurs, champs modération.

### `event_media`

- RLS activée : oui d'après migrations.
- Policies déduites : public select, insert/update/delete owner of event or moderator.
- Live : anon lit toutes les lignes testées.
- Modèle attendu : lecture publique seulement pour médias d'événements publiés/publics ; écriture limitée au créateur de l'événement.
- Écart : policy locale `event_media_select_public USING (true)` expose les médias indépendamment du statut de l'événement.
- Risque : P1/P0 si médias de brouillons/refusés sont présents.
- Recommandation : select public via `EXISTS events WHERE status='published' AND visibility='public'`.

### `event_media_submissions`

- RLS activée : oui d'après migrations.
- Policies déduites : insert auth avec check-in/owner/mod ; select public approved ; select/update/delete mod.
- Live : anon lit 4 lignes, l'échantillon agrégé indique `approved`.
- Modèle attendu : public seulement `approved`; pending/rejected privés modération.
- Écart : pas d'écart confirmé live.
- Risque : P1, car `author_id` des contributions approuvées reste exposé.
- Recommandation : conserver public approved, mais vérifier besoin d'exposer `author_id`; prévoir purge rejected/pending anciens.

### `event_comments`

- RLS activée : oui d'après migrations.
- Policies déduites : select public/auth selon événement publié ; insert author ; update/delete author/mod.
- Live : anon lit 144 sur 185, donc restriction partielle.
- Modèle attendu : public lit commentaires d'événements publiés ; auteur modifie/supprime seulement ses commentaires.
- Écart : pas de champ `deleted_at`/`hidden` identifié ; suppression modération potentiellement destructive.
- Risque : P1.
- Recommandation : ajouter `status` ou `deleted_at`, filtrer public sur contenu non masqué, conserver audit modération côté web.

### `event_likes`

- RLS activée : inconnu en migrations récentes ; table live existe.
- Live : anon lit 449 lignes et colonnes `user_id`, `event_id`.
- Modèle attendu : agrégats publics éventuels, lignes personnelles privées ; insert/delete uniquement propre user via RPC ou RLS.
- Écart : exposition anon du graphe social complet.
- Risque : P0.
- Recommandation : activer/resserrer RLS : aucune lecture anon directe ; lecture propre utilisateur ou agrégats via vue/RPC ; unique `(user_id,event_id)`.

### `comment_likes`

- RLS activée : oui d'après migrations.
- Live : service lit 5, anon 0.
- Modèle attendu : propre utilisateur uniquement ; agrégats via vue.
- Écart : pas d'écart live confirmé.
- Risque : P2.
- Recommandation : vérifier unique `(comment_id,user_id)` et grants.

### `event_media_submission_likes`

- RLS activée : oui d'après migrations.
- Live : table vide.
- Modèle attendu : propre utilisateur uniquement.
- Écart : impossible à confirmer sur table vide.
- Risque : P2.
- Recommandation : vérifier unique `(submission_id,user_id)`.

### `event_interests`

- RLS activée : oui d'après migrations.
- Live : service 280, anon 0.
- Modèle attendu : propre utilisateur uniquement ; compteurs publics via agrégats.
- Écart : pas d'écart live confirmé.
- Risque : P2.
- Recommandation : vérifier unique `(user_id,event_id)`.

### `event_checkins`

- RLS activée : oui d'après migration ancienne.
- Policies locales anciennes : insert own, select own, mais aussi `Users can view all check-ins USING (true)` pour authenticated.
- Live : anon lit 2 lignes avec colonnes `user_id`, `event_id`, `lat`, `lon`, `validated_radius`, `source`.
- Modèle attendu : check-in uniquement via Edge Function ; coordonnées privées ; public seulement agrégats.
- Écart : exposition anon de localisation précise.
- Risque : P0.
- Recommandation : retirer toute lecture anon directe ; select propre utilisateur + event owner agrégé sans coordonnées ; coordonner avec Edge Function service role ; conserver unique `(user_id,event_id)`.

### `favorites`

- RLS activée : oui.
- Policies récentes : select/insert/delete own authenticated.
- Live : service 12, anon 0.
- Modèle attendu : propre utilisateur uniquement.
- Écart : pas d'écart live confirmé.
- Risque : P2.
- Recommandation : conserver ; vérifier unique `(profile_id,event_id)`.

### `follows`

- RLS activée : oui.
- Policies récentes : select authenticated `USING true`, insert/delete own follower.
- Live : service 108, anon 0.
- Modèle attendu : social graph peut être visible aux auth selon produit, mais pas anon complet ; insert/delete own.
- Écart : `select_auth USING true` expose tout le graphe aux utilisateurs connectés.
- Risque : P1.
- Recommandation : exposer plutôt via vues de compteurs/listes publiques minimales ; garder direct select own/following nécessaire.

### `notifications`

- RLS activée : oui.
- Policies : select/update own, insert mod.
- Live : service 798, anon 0.
- Accès front : `NotificationsService.notifyPrivateAudience` insère depuis mobile.
- Modèle attendu : création par backend/RPC/service role, lecture/update own.
- Écart : insertion de notifications depuis le client mobile si policy l'autorise aux modérateurs/admin ; invitations privées côté client fragile.
- Risque : P1.
- Recommandation : déplacer création notifications vers RPC/Edge Function ; client ne doit pas fabriquer notifications arbitraires.

### `reports`

- RLS activée : oui.
- Policies : insert reporter auth, select/update mod.
- Live : service 12, anon 0.
- Modèle attendu : insert auth avec `reporter_id=auth.uid()`; lecture/update web admin/backend uniquement.
- Écart : pas d'écart anon confirmé ; mais logique modération mobile existe.
- Risque : P1.
- Recommandation : garder insert utilisateur mobile ; retirer lecture/update mobile ; web admin avec rôle serveur.

### `warnings`

- RLS activée : oui d'après migrations.
- Policies : select/insert mod.
- Live : service 3, anon 0.
- Modèle attendu : jamais écrit depuis mobile ; web admin/backend.
- Écart : services mobile modération peuvent tenter insert/update via rôle client.
- Risque : P1.
- Recommandation : ne pas dépendre de rôles clients ; utiliser web admin/backend.

### `moderation_actions`

- RLS activée : oui d'après migrations.
- Policies : select/insert mod.
- Live : service 22, anon 0.
- Modèle attendu : journal serveur/admin uniquement.
- Écart : `ModerationService` mobile écrit dans cette table.
- Risque : P1.
- Recommandation : server-only via Edge Function/web admin.

### `bug_reports`

- RLS activée : oui d'après ancienne migration.
- Policies attendues : owner/mod select, insert own.
- Live : anon lit 61 bug reports.
- Modèle attendu : insert auth/user ; lecture owner ou support/admin uniquement ; jamais anon.
- Écart : exposition anon de descriptions libres.
- Risque : P0.
- Recommandation : supprimer toute policy anon select ; si reporting invité nécessaire, passer par Edge Function qui anonymise et ne rend pas les lignes publiques.

### `event_views`

- RLS activée : inconnue/non identifiée dans migrations locales.
- Live : anon lit 298 lignes.
- Accès front : insertion directe depuis `EventDetailScreen`.
- Modèle attendu : insert auth/anon pseudonymisé éventuellement ; lecture agrégée uniquement.
- Écart : exposition de traces de consultation.
- Risque : P0.
- Recommandation : activer RLS, interdire select direct anon/auth, exposer uniquement `get_event_views_counts` sécurisé ; revoir insertion pour éviter spoofing massif.

### `wallets` / `lumo_transactions`

- RLS activée : oui pour wallets/lumo_transactions d'après migrations.
- Live : anon 0.
- Modèle attendu : lecture own ; écritures via backend/RPC uniquement.
- Écart : Edge Function `event-checkin` écrit via service role, correct ; gamification non MVP.
- Risque : P2/P1 si affiché.
- Recommandation : masquer MVP ou garder server-only.

### `user_xp_levels`, `badges`, `user_badges`, `missions`, `user_missions`, `leaderboard`

- RLS activée : partiellement inconnue selon tables.
- Live : `user_xp_levels` anon lit 1 ; `badges/missions/user_*` anon 0 ; `leaderboard` anon 0.
- Modèle attendu : gamification non visible MVP ; données user privées ou agrégées.
- Écart : `user_xp_levels` anon exposé.
- Risque : P1 si gamification masquée mais données exposées.
- Recommandation : fermer direct anon ; exposer seulement les classements assumés via vue publique minimale.

### `community_profile_stats` / `community_leaderboard`

- Type : vues ou tables de stats communautaires.
- Live : anon lit 68 profils stats et 201 leaderboard rows.
- Modèle attendu : si communauté publique, exposer uniquement champs assumés publics ; éviter `lumo_total/lumo_month` si gamification masquée.
- Écart : exposition anon de stats Lumo et profil communautaire complet.
- Risque : P1.
- Recommandation : MVP public sans gamification : retirer Lumo des vues publiques ou limiter aux auth.

### `event_engagement_stats`, `creator_engagement_stats`, `creator_fans`

- RLS activée : oui dans migrations creator engagement.
- Policies locales : select authenticated.
- Live : anon 0.
- Modèle attendu : non MVP, accès créateur owner ou backend.
- Écart : select authenticated large peut exposer analytics/fans à tous les utilisateurs connectés.
- Risque : P1.
- Recommandation : owner-only ou web/admin-only ; ne pas exposer analytics avancés mobile MVP.

### `event_category`, `event_subcategory`, `event_tag`

- RLS/policies : public read attendu.
- Live : anon lit tout.
- Modèle attendu : lecture publique ; écriture admin/backend.
- Écart : pas d'écart lecture.
- Risque : P2.
- Recommandation : vérifier insert/update/delete interdits au mobile.

### `contest_entries`, `shop_items`, `lumo_rules`, `kv_store_b32ec4be`

- Live : existent ; anon 0 sauf `shop_items` vide.
- Modèle attendu : non MVP ou backend-only.
- Écart : tables dormantes à documenter ; `lumo_rules` utilisé par check-in Edge Function.
- Risque : P2/P1 si routes visibles.
- Recommandation : fermer direct writes ; service role/backend uniquement.

## 4. Audit RPC / Edge Functions

### `event-checkin` Edge Function

- Usage : validation présence par distance et QR.
- Paramètres : `eventId`, `lat`, `lon`, `qrToken`, `source`.
- Contrôle auth : lit le Bearer token et appelle `supabase.auth.getUser(token)`.
- Service role : oui, nécessaire pour écrire `event_checkins` et wallet.
- Risques :
  - coordonnées envoyées par client, donc spoofables ;
  - logs serveur contiennent `lat/lon`, `userId`, `eventId`;
  - écrit aussi dans Lumo/wallet alors que gamification est non MVP ;
  - CORS `*`.
- Recommandations :
  - conserver check-in via Edge Function uniquement ;
  - réduire logs GPS ;
  - imposer unique `(user_id,event_id)` ;
  - optionnel MVP : désactiver crédit Lumo ou le rendre silencieux ;
  - limiter rétention coordonnées.

### `toggle_like(event_id uuid)`

- Usage : like/unlike événement.
- Sécurité : `SECURITY DEFINER`, auth required, grant authenticated only dans migration.
- Risques : ne vérifie pas que l'événement est visible/published ; peut liker un événement privé/refusé si id connu.
- Recommandation : ajouter `EXISTS events WHERE status='published' AND visibility='public' OR creator/allowed audience`.

### `toggle_favorite(event_id uuid)`

- Usage : favori.
- Sécurité : `SECURITY DEFINER`, auth required.
- Risques : même risque que like sur événements non visibles.
- Recommandation : vérifier visibilité avant insert.

### `get_events_by_ids(ids uuid[])`

- Usage : expansion clusters/favoris.
- Sécurité : `SECURITY DEFINER`, grant anon/authenticated/service_role.
- Live : exécutable anon.
- Risque : retourne `setof public.events`; si la fonction ne filtre pas, elle bypass potentiellement RLS et peut exposer draft/private/refused selon ids.
- Recommandation P1/P0 : remplacer par fonction filtrée selon rôle, ou supprimer `SECURITY DEFINER`, ou appliquer explicitement `visibility='public' AND status='published'` pour anon.

### `get_event_views_counts(event_ids uuid[])`

- Usage : stats cartes.
- Local : migration existe avec grant anon/auth/service.
- Live : non trouvé via test RPC.
- Risque : fonctionnalité front cassée ou migration non appliquée ; fonction agrégée peut être OK si ne retourne que counts.
- Recommandation : vérifier application migration ; exposer uniquement agrégats pour événements publics.

### `is_moderator()` / `is_profile_active(p_user uuid)`

- Usage : helper RLS.
- Live : exécutable anon.
- Risque : faible mais inutilement exposé ; oracle de statut utilisateur possible pour `is_profile_active`.
- Recommandation : ne pas grant public si non nécessaire ; garder helper utilisable par policies.

### Fonctions notifications/creator stats

- Usage : triggers.
- Risque : si grants publics par défaut, appel direct possible.
- Recommandation : `REVOKE ALL FROM PUBLIC/anon/authenticated` sauf fonctions explicitement appelées par le client.

## 5. Audit Storage

### `avatar`

- Live : public `true`, aucune limite MIME/taille.
- Policies locales : owner insert/update/delete, public select.
- Modèle attendu : avatar public, upload propriétaire seulement.
- Risques :
  - pas de limite MIME/taille ;
  - chemin upload `avatars/{userId}-{timestamp}` mais policy vérifie seulement owner storage, pas forcément préfixe utilisateur ;
  - fichiers orphelins à la suppression de compte.
- Recommandations :
  - limiter MIME `image/jpeg,image/png,image/webp` et taille ;
  - imposer préfixe `avatars/{auth.uid()}/...` ;
  - nettoyer Storage sur suppression compte.

### `event-media`

- Live : public `true`, aucune limite MIME/taille.
- Policies locales : owner insert/update/delete, public select.
- Modèle attendu : public seulement pour médias d'événements publiés ; upload créateur/contributeur validé.
- Risques :
  - public bucket expose tout fichier uploadé même si DB/event non publié ;
  - policy Storage owner ne vérifie pas que l'uploader est créateur de l'événement ;
  - contributions communauté dans même bucket public ;
  - pas de bucket privé pour report media.
- Recommandations :
  - séparer `event-covers`, `event-gallery`, `event-submissions` si possible ;
  - pour contributions pending, utiliser bucket privé ou chemin non public jusqu'à approbation ;
  - ajouter limites MIME/taille ;
  - synchroniser DB `storage_path/bucket` pour suppression.

### Buckets attendus mais absents

- `report-media` : absent. Si report media devient nécessaire, bucket privé obligatoire.
- bucket privé pour submissions pending/rejected : absent.

## 6. Contraintes SQL manquantes ou à vérifier

À vérifier/ajouter :

- `events.status` check enum : `draft`, `pending`, `published`, `refused`, `archived`.
- Trigger empêchant creator d'assigner `published`, `refused`, `archived`.
- `events.creator_id NOT NULL REFERENCES profiles(id)`.
- `event_comments.rating CHECK rating BETWEEN 1 AND 5`.
- `event_comments.parent_comment_id REFERENCES event_comments(id) ON DELETE CASCADE`.
- Unique `(user_id,event_id)` sur `event_checkins`.
- Unique `(user_id,event_id)` sur `event_likes`.
- Unique `(profile_id,event_id)` sur `favorites`.
- Unique `(user_id,event_id)` sur `event_interests`.
- Unique `(comment_id,user_id)` sur `comment_likes`.
- Unique `(submission_id,user_id)` sur `event_media_submission_likes`.
- Unique `(follower,following)` et check `follower <> following` sur `follows`.
- `reports.target_type` check aligné avec types MVP : `event`, `comment`, `user`, `media`.
- `reports.reporter_id NOT NULL` si signalement auth obligatoire.
- `bug_reports.reporter_id NOT NULL` si bug report auth obligatoire ; sinon Edge Function invitée séparée.
- `notifications.user_id NOT NULL REFERENCES profiles(id)`.
- `event_views` : unique ou rate-limit par `(profile_id,event_id,viewed_on)` ; RLS activée.
- Storage : contraintes de préfixe via policies `storage.foldername(name)`.

## 7. Migrations SQL proposées

Ces migrations sont des propositions. Ne pas appliquer automatiquement.

### P0 - Fermer lectures anon sensibles

```sql
-- bug_reports: aucun select anon
alter table public.bug_reports enable row level security;
drop policy if exists bug_reports_select_public on public.bug_reports;
drop policy if exists "bug_reports_select_public" on public.bug_reports;

-- event_views: agrégats uniquement
alter table public.event_views enable row level security;
drop policy if exists event_views_select_public on public.event_views;
drop policy if exists "event_views_select_public" on public.event_views;

-- event_checkins: jamais de coordonnées publiques
alter table public.event_checkins enable row level security;
drop policy if exists "Users can view all check-ins" on public.event_checkins;
drop policy if exists event_checkins_select_public on public.event_checkins;

-- event_likes: pas de graphe social public direct
alter table public.event_likes enable row level security;
drop policy if exists event_likes_select_public on public.event_likes;
drop policy if exists "event_likes_select_public" on public.event_likes;
```

### P0 - Empêcher publication forcée par creator

```sql
create or replace function public.prevent_creator_status_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.creator_id and not public.is_moderator() then
    if new.status is distinct from old.status
       and new.status in ('published','refused','archived') then
      raise exception 'Event status moderation fields are backend-only';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_creator_status_escalation on public.events;
create trigger trg_prevent_creator_status_escalation
before update on public.events
for each row execute function public.prevent_creator_status_escalation();
```

### P1 - Profils publics via vue minimale

```sql
create or replace view public.public_profiles as
select id, display_name, avatar_url, cover_url, city, bio
from public.profiles
where coalesce(status, 'active') = 'active';

-- Puis retirer la lecture anon directe de public.profiles
-- et pointer les clients publics vers public_profiles.
```

### P1 - Filtrer médias par événement public

```sql
drop policy if exists event_media_select_public on public.event_media;
drop policy if exists "event_media_select_public" on public.event_media;

create policy event_media_select_public
on public.event_media
for select
to anon, authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_media.event_id
      and e.status = 'published'
      and e.visibility = 'public'
  )
);
```

### P1 - Durcir `get_events_by_ids`

```sql
create or replace function public.get_events_by_ids(ids uuid[])
returns setof public.events
language sql
security invoker
set search_path = public
as $$
  select *
  from public.events e
  where array_length(ids, 1) is not null
    and e.id = any(ids)
    and (
      (e.visibility = 'public' and e.status = 'published')
      or e.creator_id = auth.uid()
      or public.is_moderator()
    );
$$;
```

### P1 - Storage MIME/taille et préfixes

```sql
-- Exemple de principe : à adapter via dashboard ou SQL Supabase.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id in ('avatar','event-media');
```

## 8. Plan d'action priorisé

### P0 sécurité bloquante

1. Fermer anon direct sur `bug_reports`, `event_checkins`, `event_views`, `event_likes`.
2. Bloquer toute modification client de `events.status` vers `published/refused/archived`.
3. Retirer les routes/services admin mobile de la surface MVP ; garder uniquement signalements utilisateur.
4. Vérifier et corriger `get_events_by_ids` pour éviter tout bypass RLS via `SECURITY DEFINER`.
5. Créer un canal backend/web admin pour modération, notifications admin, warnings, moderation_actions.

### P1 nécessaire avant MVP

1. Remplacer lecture publique `profiles` par vue `public_profiles`.
2. Filtrer `event_media` public par événements publiés/publics.
3. Vérifier/appliquer `get_event_views_counts` ou retirer son usage front si migration absente.
4. Durcir Storage : MIME, taille, préfixes, stratégie pending/private.
5. Vérifier les unique constraints sociales/check-in.
6. Revoir `follows_select_auth USING true` si le graphe complet ne doit pas être visible aux utilisateurs connectés.
7. Ne plus créer de notifications depuis le client mobile hors RPC/Edge Function.

### P2 post-MVP

1. Audit SQL direct via connexion Postgres read-only pour lister `pg_policies`, `pg_class.relrowsecurity`, grants exacts.
2. Tests automatisés RLS avec utilisateurs fixtures : anon, user A, user B, creator, banned, moderator.
3. Séparer buckets publics/privés pour covers, galleries, submissions, report media.
4. Purge planifiée : Storage orphelin, event_views anciennes, check-ins GPS, notifications anciennes.
5. Retirer/fermer les tables gamification/shop/contest non MVP.

## Conclusion

Le backend a une base RLS exploitable, mais l'état live montre encore des expositions anon incompatibles avec un MVP store-ready, surtout sur les données comportementales et les textes libres. La priorité est de fermer les lectures directes sensibles, puis de déplacer toute logique admin/modération hors du client mobile. Ensuite seulement, il faudra raffiner les vues publiques et les RPC pour garder une app fluide sans rouvrir de surface de données.
