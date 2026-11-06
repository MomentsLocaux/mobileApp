# SCRUM-328 — Lot 0 : contrat des propositions proactives

Date : 2026-11-03. Branche : `docs/scrum-328-lot-0`.
Statut : cadrage prêt pour revue ; paramètres et amendements proposés, pas décisions produit déjà approuvées.

Sources : [epic Jira](https://moments-locaux.atlassian.net/browse/SCRUM-328), ses onze enfants,
SCRUM-303/307/308/309/310/312/320/323, ADR 001/002/003, `MVP_SCOPE.md`.
Le diagnostic et ses limites sont dans [le relevé live](SCRUM_328_LOT_0_DIAGNOSTIC.md).
L'autorisation du lot 0 porte sur le diagnostic et cette documentation ; aucune activation produit,
migration, modification Jira ou collecte supplémentaire n'est réalisée.

## 1. Périmètre

Un moment choisi côté serveur ; interruption seulement si elle est autorisée et pertinente.
Recherche et carte restent disponibles. Pas de fan-out catalogue, digest de secours, Discovery Engine,
lieux inférés, historique de trajets, IAP ou administration mobile. SCRUM-350 est exclu.
L'accueil à un moment de SCRUM-339 doit faire l'objet d'un amendement explicite du périmètre Alpha
avant activation. Le lot 0 ne modifie pas les ADR acceptées ni les flags existants.

## 2. Arbitrages proposés

| ID | Proposition de contrat | Motivation / ticket à amender |
|---|---|---|
| D01 | Sélectionner indépendamment du droit d'envoyer ; essentiel et push off peuvent lire un gagnant | Réconcilie SCRUM-333 (saute essentiel) et SCRUM-339 (proposition possible sans push) |
| D02 | Un gagnant public, un alternatif interne au-dessus du seuil ; remplacement une fois par proposition, contrôlé serveur | SCRUM-333 doit fournir le suivant de SCRUM-339 sans exposer une liste |
| D03 | Notification immuable : son événement reste sa destination même après remplacement ou nouveau passage | « Même moment » vaut au moment de l'envoi, pas identité perpétuelle entre toutes les notifications et l'accueil |
| D04 | Profil canonique `user_taste_profiles` si SCRUM-307 n'est pas livré ; adaptateur E14 au lieu d'une seconde agrégation | Aucun des deux profils n'existe en DEV au diagnostic |
| D05 | `recommendation_events` Discovery reste intact ; `proposal_outcomes` possède son propre contrat | La table live exige `recommendation_id`, contrairement au schéma proposé par SCRUM-309 |
| D06 | Ajouter la tranche 16–17 ans facultative ; tranche absente reste inconnue | SCRUM-349 commence à 18 ans, l'app à 16 ans ; valider les règles de profilage des mineurs avant collecte |
| D07 | `notify_frequency` plafonne la cadence : instant = 2 passages/jour, daily = 1/jour, weekly = 1/semaine ; aucun digest | Arbitrage manquant dans SCRUM-335 ; ne pas ignorer un réglage existant |
| D08 | Pas de zone valide : état calme, jamais de centre arbitraire | Quartier absent et téléphone non autorisé/frais |
| D09 | Budget partagé réservé atomiquement avant envoi ; recontrôle au dispatch ; erreur de budget = silence pour ce flux | Le compteur live porte sur les lignes inbox, pas sur les push livrés |
| D10 | IRIS seulement pour un départage borné ; aucune réponse personnelle imputée depuis le quartier | Supprime l'ambiguïté « compense une question vide » de SCRUM-345 |

Ces propositions permettent de préparer les tickets. D01–D03, D06–D10 et l'amendement Alpha
doivent être validés avant de livrer les comportements concernés. D04/D05 nécessitent une revue
de contrat E14/Supabase avant migration. Les descriptions Jira restent inchangées dans cette mission.

## 3. Paramètres de départ à tester

| Paramètre | Valeur proposée | Propriétaire |
|---|---|---|
| Passages de sélection | 08:30 et 17:30 Europe/Paris ; nuit goûts 03:30 | SCRUM-330/333 |
| Fenêtre de candidats | Événements en cours non terminés et occurrences des 7 prochains jours | SCRUM-331 |
| Expiration | Minimum du prochain passage et de la fin de l'occurrence ; si fin inconnue, fin locale du jour | SCRUM-333 |
| Position téléphone | Fraîche si âge < 3 h ; timestamp futur de plus de 5 min refusé ; une seule ligne | SCRUM-348 |
| Passage goûts | Poids culturel observé croissant jusqu'à 10 événements distincts aimés/enregistrés ; déclaré culturel dominant avant | SCRUM-330/331 |
| Répétition push | Même événement/occurrence : pas de nouvel envoi pendant 7 jours | SCRUM-335 |
| Attribution conversion | Action postérieure à l'envoi dans les 7 jours, attribuée au dernier envoi du même événement | SCRUM-337 |
| Absence d'ouverture | `not_opened_observed` après 48 h ; pas une preuve de livraison ni de rejet | SCRUM-337/347 |
| Conservation | Décisions 90 jours ; position supprimée après 3 h ; agrégats goûts remplacés ; 10 versions de poids | SCRUM-330/337/347 |
| Météo | Créneau local de l'occurrence, horizon 7 jours, cache valide au plus 6 h | SCRUM-342 |
| Apprentissage | Désactivé au départ ; minimum provisoire 500 tentatives acceptées et 50 ouvertures, puis revue statistique | SCRUM-347 |

Ces valeurs ne sont pas des seuils légaux ni des garanties de performance. Rétention et profilage
nécessitent la revue GDPR, et le seuil d'apprentissage sera fixé avec les premiers volumes réels.
Le cron DEV utilise GMT : un simple cron `17:30` ne respecte pas Europe/Paris en été/hiver.
Prévoir une orchestration testée avec garde sur le créneau civil et clé de passage locale.

## 4. Arbre de décision et score

1. Vérifier activation serveur et compte actif. Sans activation : aucune nouvelle écriture de proposition.
2. Charger réponses, goûts et quartier. Ne pas conditionner la sélection aux autorisations push.
3. Ajouter le téléphone seulement avec opt-in proximité et permission déclarée encore valide, position fraîche.
   Le serveur vérifie l'opt-in et la fraîcheur, sans pouvoir certifier lui-même la permission OS.
4. Charger les événements publiés et publics dans l'union des rayons autorisés. Dédupliquer par événement/occurrence.
   Ne pas tronquer un échantillon aléatoire avant scoring. Exclure les événements déjà enregistrés/aimés
   de la proposition d'interruption ; conserver leurs signaux pour le goût.
5. Normaliser données connues et inconnues ; calculer les contraintes fortes puis les contributions.
6. Départager déterministement ; conserver gagnant et alternatif. Sous le seuil : état calme et décision non envoyée.
7. Réévaluer politique local, préférence nearby, push, cadence, silence, répétition et budget.
8. Si tout passe, réserver et créer atomiquement une notification unique par personne/passage.
9. Au dispatch, revérifier activation, préférences, événement et validité temporelle. Aucun rattrapage tardif automatique.
10. Mesurer tentative, ouverture et interactions sans assimiler l'absence de télémétrie à un refus.

Score proposé, à calibrer par fixtures dans SCRUM-331 :

`base = 100 * somme(w_i * x_i) / somme(w_i)` pour déclaré culturel, goût, distance et temps,
avec contributions disponibles normalisées [0,1]. Question absente = aucune contribution ni
renormalisation donnant un bonus artificiel. Les termes indisponibles sont traités de manière
identique pour tous les candidats d'un passage. Météo est un ajustement signé borné ; IRIS un
départage final borné. Contraintes budget/enfants sont pénalités prioritaires séparées.

La valeur exacte des poids, pénalités et du seuil appartient à SCRUM-331 ; les fixtures imposent
leur ordre relatif. Les facteurs neutres `1` mentionnés par Jira correspondent à « aucun effet » ;
dans cette formulation additive l'ajustement neutre vaut `0`. Corriger ce vocabulaire dans 331/342/345.
Les poids météo/IRIS ne changent pas parce qu'une table existe : ils deviennent actifs uniquement
quand les données du candidat sont fraîches et qualifiées.

Une date absente, un prix nul, `is_free=null`, une audience inconnue ne deviennent pas une donnée certaine.
Un âge de participant n'est pas déduit de la catégorie. Les motifs utilisent des codes et paramètres
vérifiés (`your_theme`, `near_home`, `near_phone`, `tonight`, etc.), jamais une phrase générée sur la famille
ou la situation sociale. Départage : score, début de l'occurrence, distance, identifiant stable.

## 5. Contrats de données envisagés

Contrats logiques pour les prochaines migrations, pas DDL exécutable.

| Objet | Champs/invariants | Accès / cycle de vie |
|---|---|---|
| `user_preferences.proposal_answers` | Objet versionné : `age_band`, `children_count` (0,1,2,3+), `children_age_bands`, `household`, `situations`, `companions`, `budget_band`, `cultural_affinities`, `answered_at` ; champs absents/null = sans réponse | Owner read/update avec validation ; export explicite ; purge compte. SCRUM-310 lit/écrit le même objet, mobilité reste une extension E14 |
| `user_taste_profiles` | PK user, poids thèmes/créneaux/prix/distance, nombre d'événements distincts, date et version d'agrégation ; likes/favoris du même événement dédupliqués | Owner read, serveur write ; remplacement, cascade compte |
| `proposal_current_locations` | PK user, point, `observed_at`, `received_at`, `expires_at`, appareil/source ; aucune liste de points ; dernier timestamp valide gagne | Écriture propriétaire via endpoint validant préférences et taille ; pas de lecture cross-user ; purge TTL, révocation et compte |
| `proposal_weights` | Versions immuables, version active unique, coefficients bornés, seuil, auteur/date | Lecture interne ; écriture serveur privilégiée ; retour à une version antérieure |
| `proposal_scores` | Une ligne courante/personne : proposal_id, run_id, gagnant, occurrence, score, contributions, reason_code/params, origine, alternative interne, dates/expiration, version poids, état du remplacement | Serveur write, lecture propriétaire via projection sans liste de candidats ni coordonnées brutes |
| `proposal_outcomes` | Décision immuable par personne/passage, gagnant nullable, score nullable, raison silence, version poids ; références notification et tentative, ouverture, like/favori | Owner read ; écritures serveur ; ouverture via RPC propriétaire idempotente ; aucune écriture client du score ou de l'état d'envoi |
| `proposal_push_attempts` | Clé unique décision/envoi, budget réservé, statut tenté/accepté/échoué/inconnu, identifiant fournisseur et horodatages ; pas de token brut dans le journal | Serveur seulement ; état inconnu après timeout ne déclenche pas un retry aveugle |
| `event_conditions` | Event/occurrence, intérieur/extérieur/inconnu, provenance/confiance, prévision au créneau, date et expiration cache | Référence serveur ; mutualisation météo E14 ; aucune donnée utilisateur |
| `place_context` | Clé de quartier stable, géométrie/résolution IRIS, millésime, indicateurs agrégés | Référence serveur ; pas de revenu/foyer inféré dans un profil ; pas de coordonnées précises dans les logs |

Toutes les tables exposées : RLS et grants minimaux. Pas d'accès anonyme aux données personnelles.
Fonctions privilégiées internes non exposées, droits EXECUTE révoqués par défaut, search_path fixé.
Les tests doivent prouver l'absence d'écriture client de scores, poids, destinataires et état d'envoi.
L'export inclut réponses et données personnelles dérivées pertinentes ; il ne suffit pas d'exclure
les inférences du dossier : vérifier aussi les informations à fournir sur le profilage.
Purge de compte vérifiée sur chaque nouveau stockage et les archives d'export.

## 6. API et identité d'une proposition

Noms proposés, à figer avec la migration du ticket propriétaire :

- `get_my_moment_proposal()` : `{status: ready|calm|expired, proposal_id?, event_id?, occurrence_start?, reason_code?, reason_params?, expires_at?, can_request_another?}`. Ne reçoit pas de user_id arbitraire.
- `replace_my_moment_proposal(proposal_id, request_id)` : comparaison atomique de version et consommation unique ; replay de request_id retourne le même résultat. Aucun envoi push supplémentaire.
- `record_my_proposal_open(proposal_id, notification_id?, request_id)` : contrôle ownership ; notification facultative pour ouverture directe, canal distingué ; ne confond pas mark-read inbox et ouverture réelle.
- Endpoint position : écriture d'un point courant, pas de batch de trajet ; rejet des coordonnées invalides, timestamps et opt-in non valides.
- Payload `moment_proposal` : `eventId`, `proposalId`, `decisionId`, occurrence et version. La fiche reste accessible par son eventId historique même si le score courant a changé.

Les réponses, localisation, profil goûts, poids, sélection et événement possèdent des versions ou
dates permettant l'invalidation. Une modification des réponses/quartier marque la proposition obsolète
et demande un recalcul ; elle ne provoque pas un push supplémentaire hors passage.
La réserve push et la décision SQL sont atomiques ; l'appel externe ne l'est pas. Le journal garde
cette limite : pas de promesse d'exactement une livraison OS.

## 7. Amendements des critères et dépendances

| Ticket | Critère complémentaire/corrigé | Dépendance / responsable de revue |
|---|---|---|
| 349 | 16–17 couvert ; skip distinct de zéro ; réponses modifiées/exportées ; aucun champ perdu par fallback silencieux | Contrat commun 310 ; produit/GDPR/mobile |
| 330 | 10 événements distincts ; unlike et suppression favori répercutés ; pas de seconde source E14 | 307 ; Supabase |
| 331 | Contraintes prioritaires prouvées ; inconnu neutre ; score déterministe ; prix/audiences traçables | 349/330/348 ; produit/Supabase |
| 348 | TTL et révocation ; pas de collecte sans opt-in ; retrait OS découvert à reprise + TTL de sécurité | 323 pour task/permissions, sans rallumer ses push ; GDPR/mobile |
| 333 | Sélection possible essentiel/push off ; un gagnant et un alternatif interne ; aucune notification ici | 331 ; Supabase |
| 335 | Aucun insert si porte fermée ; cadence/fréquence ; atomicité budget ; recheck dispatch ; pas de fan-out | 333, socle 337, 303 adapté au live ; Supabase/release |
| 337 | Non-envoi distinct d'échec ; ouverture authentifiée ; attribution bornée ; rétention et export | Socle avant 335, finalisation après ; QA/GDPR |
| 339 | Une alternative par proposition ; notification historique stable ; essentiel avec gagnant ou calme ; flag off inchangé | 333/337 et amendement Alpha ; produit/UX/mobile |
| 342 | Cache lieu/créneau ; panne neutre ; intérieur/extérieur inconnu explicite | 331/320 mutualisés ; Supabase |
| 345 | Influence de départage bornée ; hors couverture neutre ; aucune réponse imputée | 331/349 ; produit/GDPR |
| 347 | Données suffisantes ; erreurs de livraison exclues des ignorés ; contraintes non apprises ; rollback | 337 et observation réelle ; produit/QA |

Les clés numériques désignent SCRUM-xxx. Chaque ticket garde sa branche, son diff et sa review.
Les tâches de clarification ci-dessus sont prêtes à reporter dans Jira après validation du cadrage.

Ordre : contrats → 349/330 → 348/331 → 333 + socle 337 → 335 + fin 337 → 339 → 342/345 → 347.
SCRUM-303 est déjà partiellement réalisé en live (dispatch ON), pas entièrement (pas de liste blanche).
SCRUM-308/312 ne doivent ni créer un troisième score ni ajouter une notification concurrente sans arbitrage.
SCRUM-309 doit résoudre son conflit avec le schéma Discovery existant avant d'y brancher ce flux.

## 8. Fixtures de référence (aucune donnée personnelle réelle)

Horloge fixe : `2026-11-03T16:00:00Z` (17:00 Europe/Paris). Quartier H et téléphone P à plus
de 50 km l'un de l'autre ; rayon 25 km. Événements fictifs publics/publiés, sauf indication contraire.

| ID | Entrées / scénario | Résultat attendu | Tickets |
|---|---|---|---|
| F01 | Aucune réponse, aucun like ; événements à égalité | Aucun âge/enfant/budget inféré ; ordre déterministe | 330/331/349 |
| F02 | enfants=0 vs champ absent | États distincts ; aucun âge enfant affiché ; aucune contrainte inventée | 349 |
| F03 | 2 enfants 4–10, gratuit ; familial gratuit 18 h vs concert payant 23 h, même distance | Familial devant, même après 10 likes musique | 331/349 |
| F04 | 10 événements musique distincts, certains à la fois likés et favoris ; affinité expos | Décompte 10 ; musique domine culturel, contraintes F03 conservées | 330/331 |
| F05 | Prix/audience inconnus | Pas de motif « gratuit »/« adapté aux enfants » | 331 |
| F06 | Opt-in off, point P encore en base | P jamais lu pour scorer, effacement prévu ; H seulement | 348 |
| F07 | Opt-in on + point récent P ; événement près de P et loin de H | Candidat autorisé, motif near_phone ; un gagnant unique | 331/348 |
| F08 | Point âgé de 3 h ou plus / futur >5 min / permission retirée à reprise | Point inutilisable ; H seulement | 348 |
| F09 | Même événement dans H et P ; autre privé ou refused | Un seul candidat dédupliqué ; privé/refused absents | 331/333 |
| F10 | Essentiel ou push off, gagnant suffisant | Gagnant dans app ; zéro insert moment_proposal ; rappels inchangés | 333/335/339 |
| F11 | Sous seuil ou aucune zone/candidat | Décision silence avec raison ; zéro notification ni catalogue de repli | 333/337/339 |
| F12 | Quiet hours traversant minuit ; plafond atteint ; deux workers simultanés | Zéro dépassement, zéro doublon par passage ; erreur budget bloque ce flux | 335 |
| F13 | Deux clics « Un autre » concurrents et replay réseau | Un seul remplacement ; réponse idempotente ; aucun push | 339 |
| F14 | Notification A puis nouveau gagnant B | Tap notification ouvre A ; ouverture app lit B ; attribution distincte | 335/337/339 |
| F15 | Événement supprimé/privé/terminé entre choix et envoi | Aucun envoi périmé ; état calme ; pas de remplacement push implicite | 335/339 |
| F16 | Temps expiré à l'ouverture du lien, app fermée puis auth | Destination vérifiée ; message indisponible si nécessaire, aucun résultats catalogue | 339 |
| F17 | Deux personnes, même lieu ; pluie ; indoor/outdoor/inconnu ; événement J+10 | Cache partagé ; indoor non pénalisé ; inconnu/J+10 neutres | 342 |
| F18 | Quartier aisé + budget gratuit ; changement quartier | Payant ne gagne pas grâce à IRIS ; réponses personnelles intactes | 345 |
| F19 | Tentative échouée ou statut inconnu, aucune ouverture | Pas de rejet appris ; aucun retry aveugle ; attribution favori préexistant exclue | 337/347 |
| F20 | Volume insuffisant puis série fictive d'ignorés exploitables | Aucun apprentissage initial ; ensuite bornes/seuil respectés et rollback possible | 347 |
| F21 | Compte A tente lire/modifier position, scores, ouvertures de B ; anon | Accès refusé ; aucune usurpation via user_id client | Tous SQL |
| F22 | Export puis suppression compte | Réponses/données dérivées exportées ; données personnelles nouvelles purgées | 349/330/337/348 |
| F23 | Bascule été/hiver Europe/Paris ; replay même passage | Une décision/créneau civil, heures prévues conservées | 330/333/335 |
| F24 | Flag off, utilisateur non inclus dans pilote | Accueil et notifications historiques inchangés, aucune collecte nouvelle | Tous |

## 9. Sortie du lot 0

- [x] Onze tickets et dépendances revus ; contrat, arbre, paramètres et fixtures rédigés.
- [x] Diagnostic DEV réel effectué sans mutation et ancien UAT identifié comme ingestion.
- [x] Incompatibilités et critères à amender consignés sans réécrire l'historique Jira.
- [ ] Identifier une vraie cible UAT applicative accessible avant recette UAT.
- [ ] Valider les arbitrages proposés et l'amendement de parcours avant activation correspondante.
- [ ] Valider les futures migrations humainement ; aucun apply autorisé par ce document.

Vérification de cette mission : liens locaux et `git diff --check` ; pas de build, typecheck ou lint
relancés pour cette modification exclusivement documentaire.
