# Recette suppression de compte — SCRUM-277

Choix retenu : **soft delete Auth** (`auth.admin.deleteUser(id, true)`) + **purge explicite** des tables PII. Les FK `ON DELETE CASCADE` ne partent pas sur un utilisateur Auth seulement « banned / deleted ».

À jouer **après** validation humaine de `20260923_scrum_277_account_deletion_pii_extras.sql` (ne pas `db push` automatiquement).

## Compte UAT / DEV dédié

1. Créer un compte test avec : profil, favori, commentaire, photo, token push, message Lumia, export demandé.
2. Paramètres → Confidentialité → Supprimer le compte.
3. Vérifier :
   - plus d’e-mail Auth actif (connexion refusée) ;
   - plus de `user_preferences` / `device_push_tokens` / `lumia_chat_usage` / quotas / `account_export_requests` pour cet uid ;
   - bucket `account-exports` vide pour le préfixe uid ;
   - commentaires publics anonymisés (`Commentaire supprimé`) ;
   - `account_deletion_requests` conserve `user_id` (preuve, durée à cadrer).
4. Conserver ce compte comme fixture, ne pas le réutiliser pour un parcours métier.
