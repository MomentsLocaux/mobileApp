# Champs UGC Alpha (SEC-002 / SCRUM-236)

Inventaire des textes saisis par un utilisateur mobile. Affichage = texte brut (pas d’HTML).
Les plafonds serveur sont dans `supabase/migrations/20260914_p1_sec_hardening_followup.sql`.
Le client miroir est `src/utils/ugc-sanitize.ts`.

| Surface | Colonne / payload | Max serveur | Notes |
|---|---|---|---|
| Commentaire | `event_comments.message` | 4000 | Null bytes strippés |
| Profil | `profiles.display_name` | 120 | |
| Profil | `profiles.bio` | 2000 | |
| Signalement | `reports.reason` | 2000 | Null bytes strippés |
| Bug (insert user) | `bug_reports.description` | 4000 | Console / modo : pas de plafond (rows existantes > 4k) |
| Lumia | Edge `message` | 800 | Historique 400 / tour |
| Recherche | ILIKE fragment | n/a | `sanitizeIlikeFragment` |
| Correction | `event_correction_proposals.comment` | 2000 | Déjà CHECK + quota jour |
| Contact site | `contact_messages.message` | CHECK existant | Hors mobile |

Hors scope volontaire : `events.title` / `description` (console + scrapper, rows longues).
