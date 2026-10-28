# Recette suppression de compte — SCRUM-277

Choix retenu : **soft delete Auth** (`auth.admin.deleteUser(id, true)`) + **purge explicite** des tables PII. Les FK `ON DELETE CASCADE` ne partent pas sur un utilisateur Auth seulement « banned / deleted ».

`20260923_scrum_277_account_deletion_pii_extras.sql` est déjà sur DEV. `20261027132743_account_deletion_private_content_purge.sql` est appliquée sur DEV (`moments-locaux-dev`) le 2026-10-27. L’Edge Function `delete-account` y est redéployée (version 11, 2026-10-28), pièces jointes de bug reports comprises. UAT et prod : migration et fonction après validation humaine, ne pas `db push` automatiquement.

## Compte UAT / DEV dédié

1. Créer un compte test avec : profil, favori, commentaire, photo, token push, message Lumia, message direct envoyé à un autre compte, proposition de correction, bug report avec pièce jointe, export demandé.
2. Paramètres → Confidentialité → Supprimer le compte.
3. Vérifier :
   - plus d’e-mail Auth actif (connexion refusée) ;
   - plus de `user_preferences` / `device_push_tokens` / `lumia_chat_usage` / quotas / `account_export_requests` / `ai_processing_notices` pour cet uid ;
   - bucket `account-exports` vide pour le préfixe uid ;
   - commentaires publics anonymisés (`Commentaire supprimé`) ;
   - messages directs envoyés : corps remplacé par `Message supprimé` ; les messages de l’autre personne inchangés ; la ligne de participation reste (le fil reste dans sa boîte, au nom « Utilisateur supprimé ») ;
   - plus de `event_correction_proposals` dont il est `proposer_id` ;
   - plus de `notification_digest_queue` pour cet uid ;
   - bucket `bug-report-attachments` vide pour le préfixe uid ;
   - `account_deletion_requests` conserve `user_id` (preuve, durée à cadrer).
4. Conserver ce compte comme fixture, ne pas le réutiliser pour un parcours métier.
