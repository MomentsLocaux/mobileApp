# Cahier de testing – Modération (Moments Locaux)

## Objectif
Valider que l’espace de modération est accessible, navigable, et que les actions déclenchent bien les mutations attendues en base (Supabase) avec le bon niveau d’accès.

## Pré-requis
- Compte **moderateur** ou **admin**.
- Données seedées : events en `pending/draft`, reports `new`, warnings, event_media_submissions `pending`.
- RLS migrations appliquées :
  - `supabase/migrations/202601061530_add_moderation_rls.sql`
  - `supabase/migrations/202601061600_add_event_media_submissions_moderation_rls.sql`

## Accès & navigation
1. Ouvrir `/moderation` depuis l’app (profil ou tab).
2. Vérifier :
   - Header “Modération – Moments Locaux”.
   - Bouton menu (hamburger) ouvre la navigation.
   - Bouton fermer revient à l’écran précédent.
3. Navigation menu → chaque page :
   - Dashboard
   - Événements
   - Commentaires
   - Utilisateurs
   - Signalements
   - Photos

## Dashboard
**KPIs**
- “Événements en attente” = nombre d’événements `status != 'published'`.
- “Signalements reçus” = reports `status = 'new'`.
- “Utilisateurs signalés” = distinct reports `target_type = 'user'`.

**Listes**
- “Événements à vérifier” :
  - Titre, ville, date affichés.
  - Nombre de reports liés affiché.
  - Action “Examiner” → navigation vers `/moderation/events`.
  - Action “Rejeter” → status bascule à `refused`.
- “Signalements récents” :
  - Avatar reporter + reason + badge severity + temps relatif.
- “Utilisateurs à problèmes” :
  - Nom + niveau warning + badge “Récidiviste”.

**Charts**
- “Catégories de problèmes” : distribution severity (basée sur reports chargés).
- “Statistiques de modération” :
  - Événements rejetés (moderation_actions action_type = refuse)
  - Actions résolues (total moderation_actions)
  - Utilisateurs bannis (action_type = ban)

## Événements à vérifier (`/moderation/events`)
1. Liste des events `status = pending` (ou `draft`) affichée.
2. Action **Approuver** :
   - `events.status` → `published`.
   - Insertion `moderation_actions` (approve).
   - Notification envoyée au créateur.
3. Action **Refuser** (avec motif) :
   - `events.status` → `refused`.
   - `moderation_actions` avec metadata note.
   - Notification créateur avec motif.
4. Action **Demander des modifs** :
   - `events.status` → `draft`.
   - `moderation_actions` (request_changes + note).

## Commentaires signalés (`/moderation/comments`)
1. Liste commentaires liés à reports `status = new`.
2. **Supprimer** :
   - `event_comments` supprimé.
   - `moderation_actions` (remove).
   - Notification auteur.
3. **Avertir** :
   - `warnings` insert (level 1).
   - `moderation_actions` (warn).
   - Notification auteur.

## Utilisateurs à problèmes (`/moderation/users`)
1. Liste warnings récents.
2. **Avertir** :
   - `warnings` insert (level 1).
   - `moderation_actions` (warn).
3. **Bloquer** :
   - `moderation_actions` (ban).
   - Notification utilisateur.

## Signalements (`/moderation/reports`)
1. Liste reports (tous statuts).
2. **En revue** :
   - `reports.status` → `in_review`.
3. **Clôturer** :
   - `reports.status` → `closed`.

## Photos communauté (`/moderation/media`)
1. Liste `event_media_submissions` `status = pending`.
2. **Approuver** :
   - `event_media_submissions.status` → `approved`.
   - Insert `event_media`.
   - `moderation_actions` (approve sur event).
   - Notification auteur + créateur.
3. **Refuser** :
   - `event_media_submissions.status` → `rejected`.
   - `moderation_actions` (refuse sur event).
   - Notification auteur.

## Sécurité / RLS
1. Compte non-moderateur :
   - Accès `/moderation` refusé (écran bloqué ou data vide).
2. Compte modérateur :
   - Lecture/écriture `reports`, `warnings`, `moderation_actions`, `event_media_submissions` OK.
3. Vérifier refus RLS :
   - `event_media` insert non autorisé pour un user standard.

## Régressions UI
- Scroll fluide, pas de blocage.
- Boutons visibles sur iOS/Android.
- Modals fermables (tap outside + bouton annuler).
- Aucune action bloquée par le header.

## Notes d’exécution
Pour chaque action, vérifier dans Supabase :
- `events`, `reports`, `warnings`, `moderation_actions`, `event_media_submissions`, `event_media`, `notifications`.
