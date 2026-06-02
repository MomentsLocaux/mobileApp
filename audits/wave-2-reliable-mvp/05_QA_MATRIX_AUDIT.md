# 05 - QA Matrix / Manual Testing Audit

## Résumé exécutif

Le MVP nécessite une matrice manuelle complète sur iOS et Android réels. Les risques prioritaires sont les permissions, les médias, la carte, le lifecycle événement, la suppression compte et les erreurs réseau. Cette matrice doit être exécutée avant bêta et à chaque release candidate.

Niveau actuel : la matrice doit être formalisée et répétée. Aucun fichier QA exhaustif n'a été identifié dans le repo.

## Matrice de tests MVP

### Auth

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Register email/password | À tester | À tester | Compte créé ou email confirmation affichée |
| Register avec email invalide | À tester | À tester | Erreur claire |
| Login valide | À tester | À tester | Redirection carte/onboarding selon profil |
| Login invalide | À tester | À tester | Erreur claire |
| Logout | À tester | À tester | Retour login, session non restaurée sans action |
| Session persistée | À tester | À tester | Réouverture app connectée |
| Biométrie si active | À tester | À tester | Reconnexion claire et volontaire |

### Onboarding

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Profil onboarding incomplet | À tester | À tester | Redirection onboarding |
| Ville recherchée via Mapbox | À tester | À tester | Résultat sélectionnable |
| Mapbox indisponible | À tester | À tester | Erreur ou fallback clair |
| Fin onboarding | À tester | À tester | `onboarding_completed` true et carte |
| Profil absent | À tester | À tester | Création/réparation profil |

### Carte et recherche

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Carte avec localisation acceptée | À tester | À tester | Centrée utilisateur |
| Carte avec localisation refusée | À tester | À tester | Fallback clair |
| Recherche adresse | À tester | À tester | Résultats Mapbox |
| Filtre catégorie/tag | À tester | À tester | Liste et marqueurs cohérents |
| Rayon 10 km | À tester | À tester | Résultats dans rayon |
| Tri distance sans localisation | À tester | À tester | Désactivé ou message |
| Aucun résultat | À tester | À tester | Empty state utile |
| Événements non publiés | À tester | À tester | Jamais visibles publiquement |

### Événement

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Création complète | À tester | À tester | Event `pending` |
| Sauvegarde brouillon | À tester | À tester | Event `draft` privé |
| Reprise brouillon | À tester | À tester | Champs préremplis |
| Upload cover | À tester | À tester | Image publique affichée |
| Refus événement | À tester | À tester | Statut/refusal reason visible |
| Resoumission refused | À tester | À tester | Retour `pending` |
| Édition published | À tester | À tester | Bloquée côté mobile/serveur |
| Détail événement publié | À tester | À tester | Chargement stable |
| Événement privé | À tester | À tester | Non visible hors audience |

### Interactions

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Favori | À tester | À tester | Toggle persistant |
| Like/intérêt | À tester | À tester | Toggle persistant |
| Follow créateur | À tester | À tester | État suivi correct |
| Commentaire si MVP | À tester | À tester | Création/signalement/suppression selon droits |
| Signalement événement | À tester | À tester | Report créé, feedback utilisateur |
| Signalement commentaire | À tester | À tester | Report créé |
| Signalement profil | À tester | À tester | Report créé |

### Check-in et notifications

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Scan QR publié | À tester | À tester | Check-in validé |
| Scan QR mauvais événement | À tester | À tester | Refus clair |
| Check-in sans localisation | À tester | À tester | Fallback ou refus clair |
| Notification reçue | À tester | À tester | Visible utilisateur |
| Marquer notification lue | À tester | À tester | Persistant |
| Realtime notifications | À tester | À tester | Update sans fuite subscription |

### Profil et settings

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Modifier profil | À tester | À tester | Persisté |
| Upload avatar | À tester | À tester | Affiché partout |
| Paramètres notifications | À tester | À tester | Stable |
| CGU | À tester | À tester | Accessible |
| Privacy | À tester | À tester | Accessible |
| Suppression compte | À tester | À tester | Fonctionnelle ou demande explicite |

### Robustesse

| Scénario | iOS | Android | Attendu |
| --- | --- | --- | --- |
| Réseau faible | À tester | À tester | Pas de crash |
| Réseau coupé | À tester | À tester | Messages clairs |
| App background/foreground | À tester | À tester | Session/carte stables |
| Image très lourde | À tester | À tester | Compression ou refus |
| Deep links non-MVP | À tester | À tester | Redirection/guard |

## Risques

- Bêta lancée sans validation Android réelle.
- Régressions lifecycle événement non détectées.
- Suppression compte affichée mais non testable.
- Permissions refusées cassant les parcours.
- Données non-MVP accessibles via deep link.

## Recommandations

- Exécuter cette matrice sur au moins :
  - 1 iPhone récent
  - 1 iPhone ancien supporté
  - 1 Android moyen de gamme
  - 1 Android 13+
- Créer une release candidate figée avant test.
- Capturer vidéo/screenshots des P0.
- Garder un tableau `Pass/Fail/Notes/Build`.
- Réexécuter P0 à chaque changement RLS/config/native.

## Quick wins

- Transformer cette matrice en checklist Notion/Linear.
- Ajouter colonne commit/build number.
- Ajouter jeux de données demo propres.
- Ajouter compte test guest/user/creator/moderator uniquement pour test interne.

## Fichiers concernés

- `audits/wave-2-reliable-mvp/05_QA_MATRIX_AUDIT.md`
- Tous les écrans MVP.
- Supabase staging.
- App Store / Google Play release candidate.

## Scénarios à tester

Voir la matrice ci-dessus.

## Priorisation

### P0

- Auth, onboarding, carte, création événement, upload cover, suppression compte, RLS non-public, signalements.

### P1

- Favoris, follow, commentaires si MVP, notifications, check-in, réseau faible.

### P2

- Biométrie avancée, analytics créateur, export données, features post-MVP.
