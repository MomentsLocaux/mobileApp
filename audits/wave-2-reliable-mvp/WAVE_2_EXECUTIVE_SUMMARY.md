# Wave 2 - Reliable MVP Executive Summary

## Verdict global

Moments Locaux dispose d'une base MVP mobile crédible, mais la fiabilité opérationnelle doit être renforcée avant bêta sérieuse. Les points les plus importants ne sont pas de nouvelles features : ce sont les médias, les erreurs, les performances carte, la QA manuelle et la reproductibilité des builds.

Niveau global : proche d'une bêta interne, pas encore prêt pour bêta large/store sans P0.

## Synthèse par audit

| Audit | Niveau actuel | Verdict |
| --- | --- | --- |
| Media & Storage | Fonctionnel mais fragile | Sécuriser buckets, taille images, orphelins |
| Search / Map / Location | Bon socle | Améliorer erreurs, permission, RPC |
| Performance Mobile | Correct à mesurer | Tester appareils réels et images lourdes |
| Error Handling | Dev OK, prod faible | Ajouter logger/crash reporting |
| QA Matrix | À formaliser | Checklist iOS/Android indispensable |
| Build / Release | Dev OK, release incomplète | EAS/build numbers/env à structurer |

## P0 transverses

- Vérifier qu'aucun upload ne tombe en production dans un bucket `public` générique.
- Verrouiller Storage policies par propriétaire/contenu.
- Garantir qu'aucun événement non publié ou privé ne remonte via carte, recherche, deep link ou RPC.
- Empêcher logs sensibles en production.
- Ajouter feedback utilisateur sur erreurs upload, carte, auth et réseau.
- Exécuter matrice QA sur iOS et Android réels.
- Empêcher toute exposition service role dans l'app.
- Définir build numbers et valider build native Mapbox.

## Ce qui est rassurant

- Les requêtes publiques carte/liste filtrent `published` + `public`.
- Le fetch carte est debouncé et les timers principaux sont nettoyés.
- Les listes principales utilisent une virtualisation via `BottomSheetFlatList`.
- Les subscriptions notifications sont nettoyées.
- Les permissions inutiles majeures ont déjà été réduites.
- Le branding Expo principal est en place.

## Ce qui reste fragile

- Images non redimensionnées explicitement.
- Plusieurs conventions de chemins médias.
- Fallback Storage vers `public`.
- Erreurs Mapbox et certaines erreurs upload silencieuses.
- Pas d'observabilité production.
- Pas d'`eas.json`.
- Pas de build numbers explicites.
- Nom `package.json` encore scaffold.
- QA manuelle non encore formalisée en process release.

## Plan d'action recommandé

### P0 - Avant bêta publique

1. Médias :
   - supprimer fallback `public` en production
   - vérifier policies Storage
   - définir taille max et types MIME
   - définir purge médias compte/événement

2. Carte/recherche :
   - vérifier RPC `get_events_by_ids`
   - confirmer absence totale de `draft/pending/refused/private` côté public
   - ajouter feedback localisation refusée et Mapbox erreur

3. Erreurs :
   - filtrer logs production
   - ajouter feedback upload/carte/auth
   - protéger bug reports côté RLS

4. QA :
   - exécuter matrice iOS/Android
   - tester réseau faible, permissions refusées, images lourdes

5. Release :
   - garantir aucune service role dans bundle
   - définir build numbers
   - valider build native avec Mapbox

### P1 - Avant store review

- Ajouter `eas.json`.
- Renommer artefacts scaffold restants.
- Ajouter compression/redimensionnement.
- Ajouter crash reporting.
- Formaliser env dev/staging/prod.
- Reseeder un staging propre pour screenshots/review.

### P2 - Post-MVP

- Thumbnails/CDN.
- Cache carte/recherche avancé.
- Monitoring perf.
- CI release.
- Purge Storage automatisée.

## Conclusion

La vague 2 confirme que le MVP peut devenir fiable sans élargir le produit. La prochaine passe utile est une passe d'exécution P0 très concrète : sécuriser médias/Storage, durcir carte/RPC, rendre les erreurs compréhensibles, puis faire une vraie QA iOS/Android sur une build candidate.
