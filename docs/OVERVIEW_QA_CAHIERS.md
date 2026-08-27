# 08 — QA & cahiers de tests

| Métadonnée | Valeur |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-08-27 |
| **Audience** | QA, modos, release |
| **Hub exécutable** | Console `/moderation/qa` |

---

## 1. Modèle

| Élément | Description |
|---|---|
| **Catalogue** | Cas versionnés (IDs stables) seedés en DB |
| **Campagne** | Session de recette (env, repo, version cible) |
| **Exécution** | Une ligne par cas : `todo` → `passed` / `failed` / `blocked` / `skipped` |
| **Miroirs MD** | `docs/cahier-de-tests.md` dans chaque repo |

Guide ops console : [`Moderation-WebConsole/docs/content/cahiers-de-tests.md`](../../MomentsLocaux---Moderation-WebConsole/docs/content/cahiers-de-tests.md)  
Cahier console : [`Moderation-WebConsole/docs/cahier-de-tests.md`](../../MomentsLocaux---Moderation-WebConsole/docs/cahier-de-tests.md) (~49 cas, 16 smoke P0)

---

## 2. Routine campagne (console)

1. Compte `moderateur` \| `admin` sur le bon env (badge DEV/UAT)  
2. Migration catalogue appliquée (`20260731_qa_test_catalog.sql` côté mobile)  
3. **Resynchroniser le catalogue**  
4. **Nouvelle campagne** (nom, repo(s), env)  
5. **Initialiser les cas**  
6. Exécuter · commenter · **Créer un bug** si échec  
7. **Clôturer** la campagne  

Filtrer **P0** pour smoke store / déploiement.

---

## 3. Cahiers par surface

| Surface | Où | Focus |
|---|---|---|
| Console | `Moderation-WebConsole/docs/cahier-de-tests.md` | Auth, dashboard, events, collecte, media, users, bugs, QA meta CON-QA-* |
| Mobile | `mobileApp` (cahier / smoke MVP dans `MVP_SCOPE.md`) | Auth, map, peer social, notifs, delete account, flags off |
| Scrapper | `Moments-Locaux-Scrapper/docs/cahier-de-tests.md` | Pipeline, monitor, régions |
| Site | `moments-locaux-website/docs/cahier-de-tests.md` | Pages publiques, contact, waitlist |

Régénération miroirs console : `npx tsx scripts/generate-qa-cahiers.ts`.

---

## 4. Smoke MVP mobile (rappel)

D’après `MVP_SCOPE.md` :

- Auth + onboarding Particulier  
- Map / search / detail (orga Moments Locaux)  
- Membres : search, follow, profil pair, report, invite share  
- Like → « Aimé par vos suivis »  
- Favorites, comments, prefs notifs, delete account  
- Deep links create/offers avec flags off → redirect  
- iOS **et** Android avant store  

---

## 5. Smoke console (rappel P0)

Exemples d’IDs stables :

- `CON-AUTH-001` connexion modo  
- `CON-AUTH-002` refus non-modo  
- `CON-DASH-001` indicateurs  
- Approve / refuse event avec motif  
- Collecte région (monitor up)  
- Contact list  
- Meta `CON-QA-*` pour la feature Cahiers elle-même  

---

## 6. Critères go / no-go release

| Check | Owner |
|---|---|
| Campagne smoke P0 console + mobile passée sur **UAT** | QA |
| Pas de régression push (smoke INSERT) | Eng |
| Flags store = discovery + socialPeers ; create/checkin off | Release |
| Migrations humaines validées | Supabase owner |
| Docs D1–D5 / Layer 1 à jour | Doc owner |

---

## Historique

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-08-27 | Vue section Confluence ML §08 |
