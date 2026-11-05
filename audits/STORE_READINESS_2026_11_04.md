# Audit de publication mobile — 4 novembre 2026

## Verdict

**NO-GO pour une publication publique en l'état.** Le produit dispose d'un socle exploitable,
mais plusieurs défauts de sécurité, d'export et de validation technique doivent être corrigés.
Ce verdict ne signifie pas que tous les parcours sont cassés ; il signifie que la release ne satisfait
pas encore les conditions nécessaires à une publication fiable.

Mission rattachée à MVP-P0-012 (release), avec constats pour MVP-P0-003/006/010/011 et QA.
Branche `audit/mvp-p0-012-store-readiness`, commit applicatif examiné `c57aeb0`.
Aucun code applicatif, donnée, migration, secret ou ticket Jira modifié. E15 reste différé.
Les deux documents non suivis du lot 0 présents avant l'audit ont été conservés.

## Méthode et limites

- Lecture du code client, configurations Expo/EAS/native, services auth/communauté/messages,
  garde des routes, signalement, fonctions IA et compte, docs scope/release/privacy.
- Exécution typecheck, lint, tests, scanner secrets, config Expo et compatibilité dépendances.
- Supabase **DEV `prymkgkafaovhzopslea`** : lecture des catalogues, policies, grants, fonctions,
  buckets, advisors sécurité/performance et comptages agrégés. Aucune action d'exploitation,
  création de compte, suppression, upload, envoi push ou appel IA payant.
- Lecture des fonctions déployées : delete-account v11, export-account v2, lumia-chat v22,
  suggest-event-from-poster v9, generate-event-cover v6, et dispatch examiné lors du lot 0.
- Comparaison d'empreintes de sources index.ts : identiques pour suppression/Lumia/affiche/couverture ;
  export différent, mais les requêtes erronées ci-dessous sont présentes dans les deux versions.
- Aucun build natif store, test d'appareil, contrôle App Store Connect/Play Console, credentials EAS
  distants, Auth dashboard ou production accessible n'a été effectué. Le nom DEV ne prouve pas
  l'absence de production ailleurs. La config production résolue ici utilise les variables locales.
- Aucun test destructif ni simulation de compte banni n'a été exécuté ; les chaînes de risque sont
  établies par lecture des définitions et droits. Les policies sont permissives par défaut : OR entre elles.

## Résultats des commandes

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | Échec TS2322, `src/lib/webcrypto.ts:126`, ArrayBufferLike non assignable à ArrayBuffer |
| `npm run lint` | Succès, 0 erreur / 42 avertissements |
| `npm test` | Arrêt à la compilation de test:filters : erreur webcrypto + résolution des imports dynamiques analytics.service et lumiaChatStore sous la config de tests |
| Exécution exploratoire des JS émis avec `NODE_PATH=./node_modules` | 435 tests, 433 passent, 2 échouent (copy filtres « Long »/« Longs », Home « amis »/« personnes que tu suis »). Ce n'est pas une réussite de `npm test` ni une compilation propre |
| `npm run test:hearts` | 18/18 passent |
| `npm run test:secrets` | 2/2 passent |
| `npm run check:secrets` | Succès ; pas de secret denylist détecté dans le périmètre du scanner |
| `npx expo config --type public --json` | Succès local ; résultat conservé temporairement, valeurs sensibles non reproduites |
| Même config avec env du profil EAS production | Succès ; package iOS/Android com.momentslocs.app, ads off, tracking false ; backend local DEV. Ne valide pas les variables EAS distantes |
| `npx expo install --check` en ligne | Échec compatibilité : datetimepicker 8.5.1 attendu 8.4.4 ; plusieurs patchs Expo SDK 54 recommandés dont expo ~54.0.37 et router ~6.0.24 |

La première exécution exploratoire sans NODE_PATH ajoutait six erreurs de résolution de modules ;
elles ne sont pas comptées comme défauts applicatifs. L'exécution avec le chemin prévu par npm a
confirmé seulement les deux assertions de copy. Aucun changement automatique des dépendances.

## Constats prioritaires

### SR-01 — P0 : effacement Storage à partir d'URL modifiables

Preuve : `supabase/functions/delete-account/index.ts:15`, `:79`, `:126` ; mêmes sources en live.
Le profil peut être modifié par son propriétaire (`profiles_update_own`) ; son avatar/cover contient
une URL. La fonction extrait le chemin de cette URL puis appelle Storage remove avec le client
service_role, sans vérifier propriétaire, préfixe autorisé pour ce compte ni lien réel avec l'objet.
Le garde de profil live protège rôle/statut/ban, pas la propriété des URL.

Conséquence : une URL pointant vers un fichier d'un tiers peut entraîner son effacement pendant
la suppression du compte. Pas besoin de propriété sur l'objet au moment du remove privilégié.
**Risque confirmé par chaîne de code/grants, non exploité en live.**

Correction : sélectionner les objets réellement possédés par l'utilisateur, valider bucket/projet/
chemin et référence métier, ignorer les URL externes ou d'autrui, ne pas convertir une URL libre
en autorisation de suppression. Test contrôlé avec deux comptes et fichiers jetables après accord.
Rattachement : MVP-P0-006 / sécurité Storage ; priorité avant nouvelle distribution publique.

### SR-02 — P0 : anciennes policies Storage contournent les nouvelles

Preuve live `pg_policies` : `Avatar insert/update/delete` et `Event media insert/update/delete`
autorisent simplement bucket + owner. Elles coexistent avec `*_objects_*_owner_path`, plus
strictes (chemin utilisateur et `is_profile_active`). Leur combinaison OR conserve la voie large.
Les buckets avatar et event-media sont publics, sans limite de taille ni restriction MIME.

Conséquences : restrictions de chemin et de compte actif non garanties ; compte sanctionné
susceptible de continuer les uploads ; contenu non image et charge sans limite de bucket.
Les lectures publiques d'un bucket ne sont pas protégées par une policy SELECT restrictive.
Deux soumissions média pending/rejected existent en DEV : vérifier leur traitement avant publication.
L'exposition de leurs URL n'a pas été testée, aucune URL n'a été extraite.

Correction : retirer les policies permissives redondantes par migration revue ; fixer MIME/taille ;
séparer les médias non approuvés en stockage privé ou imposer un workflow équivalent.
Ne pas passer aveuglément tout le bucket privé : adapter les URL et chemins de lecture existants.
Rattachement : MVP-P0-010/011.

### SR-03 — P1 bloquant release : export de données silencieusement incomplet

Preuve locale `supabase/functions/export-account/index.ts:163` et fonction déployée v2 :
requête commentaires sur `content` et `user_id`, alors que la table possède `message` et `author_id`.
Corrections filtrées sur `author_id`, colonne réelle `proposer_id`.
`selectMaybe` capture toute erreur et retourne `[]` ; l'export peut être annoncé prêt sans ces données.

Correction : requêtes conformes au schéma réel, erreurs obligatoires remontées, distinction entre
table facultative absente et échec d'une section attendue. Vérifier aussi pagination : les grands
exports ne doivent pas être tronqués par la limite de lignes PostgREST.
Rattachement : compte/GDPR ; recette export avec commentaires et corrections effectivement créés.

### SR-04 — P1 sécurité : RPC de modification accessible anonymement

Preuve live : `update_leaderboard(uuid,text,integer)` SECURITY DEFINER, EXECUTE anon/authenticated.
La définition accepte user_id/type/delta puis INSERT/UPDATE sans contrôle appelant, ownership ou
activation gamification. La RLS de la table ne protège pas contre ce chemin privilégié.
Même si cette surface est hors Alpha, l'API reste accessible. Aucun appel de modification exécuté.

Correction : révoquer aux clients, conserver un chemin serveur contrôlé ; inventorier les autres
RPC privilégiées avant de conclure au durcissement complet. Les 102 avertissements anon et
150 authenticated ne sont pas tous des vulnérabilités : beaucoup de fonctions vérifient leurs droits.
Rattachement : MVP-P0-003 et durcissement API hors périmètre mobile.

### SR-05 — P1 sécurité : repli cryptographique non sûr

Preuve `src/lib/webcrypto.ts:145` : absence de crypto.getRandomValues compensée par Math.random.
Ce module est importé avant le client Supabase configuré en PKCE. Le fallback peut donc servir
aux usages cryptographiques de dépendances dans un runtime qui n'a pas de CSPRNG natif.

Correction : source cryptographique native sûre et tests sur le runtime release ; ne pas masquer
le défaut par un simple cast TS. L'utilisation effective du fallback sur un appareil n'a pas été mesurée.
Le typecheck de SR-06 et ce défaut de sécurité sont deux problèmes distincts du même module.

### SR-06 — P1 release : validation TypeScript/tests rouge

Erreur et commandes dans le tableau. Le bundler peut fonctionner malgré une erreur TS ; cela ne
rend pas le garde de release conforme. Les deux échecs d'assertion restants sont des libellés,
pas deux preuves de crash. Corriger le contrat attendu ou la copy de manière intentionnelle.
Ajouter typecheck/lint/tests à CI : le seul workflow trouvé ne vérifie que les secrets.
Rattachement : MVP-P0-012, QA.

### SR-07 — P1 store : blocage des utilisateurs absent du périmètre examiné

Les messages directs sont accessibles depuis la navigation, sans flag dédié identifié. Signalement
de profil présent ; aucun bouton/service/table de blocage utilisateur trouvé dans app, services et
migrations inspectés. Le réglage public/privé limite qui peut écrire, il ne bloque pas un utilisateur abusif.
Pas de signalement de message identifié dans ConversationThreadScreen.

Apple demande pour l'UGC les moyens de signaler et de bloquer les utilisateurs abusifs :
[App Review Guidelines 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content).
Risque de rejet sérieux à résoudre pour la communauté/messagerie, plus recette modération opérationnelle.
La présence d'une console admin externe ne remplace pas les actions personnelles nécessaires.

### SR-08 — P1 fonctionnel : derniers messages invisibles au-delà de 80

Preuve `src/services/messaging.service.ts:155` : tri created_at croissant puis limit 80 sans pagination.
ConversationThreadScreen recharge cette même fenêtre et marque la conversation lue.
Après 80 messages, un nouveau message peut être envoyé et notifié sans être visible dans le fil.

Correction : fenêtre des messages récents puis affichage chronologique, pagination vers le passé,
fusion realtime par identifiant ; marquer seulement ce qui a réellement été vu selon le contrat UX.
Recette : 81 et 200 messages, nouveau message, édition/suppression, deux appareils.

### SR-09 — P1 backend : quota génération de couverture absent et erreur tolérée

Fonction generate-event-cover v6 appelle `consume_event_cover_generate_quota` et
`release_event_cover_generate_quota` : absentes du catalogue public DEV, ainsi que la table prévue
event_cover_generate_usage. Le code continue expressément lorsque l'erreur est « fonction/table absente ».
Le client annonce pourtant une limite de deux générations par brouillon ; CoverGenerateStep est monté
dans le stepper partagé de suggestion. Le rate limit court existe, ce n'est pas une absence totale de protection.

Correction : infrastructure de quota revue/versionnée et comportement fermé si indisponible.
Risque coût/abus ; test concurrence et nouvel identifiant de brouillon. Aucun appel IA exécuté.

### SR-10 — P1 release : configuration native et profil EAS divergent

ios/ et android/ sont suivis ; ni .easignore ni hook prebuild trouvé. Dans ce cas EAS ne régénère
pas automatiquement les projets natifs : [documentation Expo](https://docs.expo.dev/workflow/continuous-native-generation/#usage-with-expo-build).
Le profil production coupe ads, mais les projets natifs contiennent toujours configuration AdMob
et mention ATT ; le fichier entitlements iOS suivi indique APNs development, app.config production
indique production. Cela impose de vérifier le binaire signé effectif, sans présumer que les flags
Expo ont retiré le SDK ou appliqué les entitlements. Les credentials EAS peuvent intervenir à la signature.

Identifiants publicitaires réels présents dans les fichiers natifs suivis, contrairement à la convention
du projet « EAS seulement » ; aucune valeur n'est reproduite dans ce rapport.
Android release utilise signingConfigs.debug dans le Gradle local : EAS peut injecter les credentials,
mais un build Gradle release local ne doit pas être pris pour une preuve de signature Play valide.

Correction : choisir la source de vérité native, contrôler manifests/entitlements signés, build store
installé iOS/Android, vérifier signature, push et déclarations privacy du binaire réel.

### SR-11 — P1 qualité de données : prix inconnu affiché « Gratuit »

Preuve `EventDetailScreen.tsx:803` : prix absent/non numérique/<=0 donne Gratuit sans lire is_free.
Comptage DEV : 116951 événements publics publiés dont 95284 avec is_free distinct de true ET
price NULL ; 55688 événements publics ont un début futur au moment de la requête.
Ces chiffres ne signifient pas qu'ils sont tous payants : ils montrent que l'inconnu ne peut pas être
transformé en certitude de gratuité.

Correction : distinguer gratuit explicite, prix connu et tarif non renseigné ; aligner cartes/filtres.
Recette avec is_free=false/NULL et price=NULL, ainsi qu'un gratuit réel.

## Observations à ne pas transformer en faux blocages

- Toutes les tables publiques examinées par pg_class ont RLS activée ; aucun cas RLS désactivée trouvé.
- 29 noms de RPC littéraux relevés dans src/app : tous présents en DEV. Les tables/vues littérales
  relevées existent aussi (le bucket event-media a été exclu de cette comparaison de tables).
  Cela ne valide ni toutes les signatures ni chaque colonne/query dynamique.
- get_events_by_ids utilise can_view_event, qui garde publication/visibilité/ownership/modération.
- profiles possède un trigger anti-escalade rôle/statut ; ne pas conclure à une escalade sur la seule
  policy UPDATE propre compte. Email n'est pas une colonne profiles live ; le client le rattache depuis Auth.
- Reports mod-only en lecture ; bug_reports propriétaire/modérateur ; tokens push propriétaire.
  Pas de preuve d'une fuite de ces lignes sur le seul avertissement GraphQL de grants larges.
- Secrets du dispatch et RPC de quotas affiche/rate limit ont EXECUTE refusé aux rôles clients.
- Suppression compte est déployée, authentifie l'utilisateur et traite la purge complémentaire privée
  par trigger ; le défaut SR-01 demeure. Aucun scénario destructif ne permet de la déclarer E2E validée.
- Lumia appelle match_lumia_doc_chunks, absent en DEV, mais possède un repli sur le corpus embarqué :
  ce n'est pas une preuve que le chat est inutilisable.
- Ads est false dans le profil production ; les défauts E15 publicitaires ne justifient pas de réactiver
  ou terminer la publicité avant sortie. Vérifier cependant la présence native du SDK (SR-10).
- Scanner secrets réussi ne certifie pas tout l'historique Git, les credentials distants ou tout binaire.

## Advisors et dette non bloquante à prioriser

Sécurité : 27 tables RLS sans policy (souvent serveur-only, donc fermées aux clients), 6 fonctions sans
search_path fixé, 2 extensions dans public, protection mots de passe compromis désactivée.
86 avertissements visibilité GraphQL anon et 113 authenticated sont des grants à réduire/analyser,
pas 199 fuites de données démontrées. Remédiation :
[linter RPC](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

Performance : 43 FK sans index de couverture, 85 cas RLS initplan, 17 groupes de policies permissives,
1 table sans PK, 1 index dupliqué, 56 index non utilisés. Leur nombre n'est pas une mesure de latence.
Mesurer carte/recherche et messages au volume réel avant de supprimer/ajouter des index au hasard.
Le contrôle Expo en ligne recommande plusieurs patchs du SDK 54 et une version différente du datepicker ;
faire une mise à niveau contrôlée et recette native, sans refonte ni migration majeure opportuniste.

## Ordre recommandé avant soumission

1. SR-01/SR-02 : suppression/Storage ; migration et tests de propriété sous revue humaine.
2. SR-04/SR-05 : fermer RPC non autorisées et remplacer le fallback crypto.
3. SR-03/SR-09 : aligner fonctions déployées et schéma, fiabiliser export et quota.
4. SR-06/SR-08/SR-11 : tests/TS, fenêtre messages et prix inconnus.
5. SR-07 : blocage/signalement opérationnels avant soumission UGC.
6. SR-10 : binaire production, backend cible et questionnaires cohérents ; recette complète appareils.

Créer/relier des tickets de correction distincts avec leurs critères ; ne pas regrouper toutes les
corrections dans une PR d'audit. Aucun ticket Jira créé dans cette mission.

## Conditions restantes pour un GO

- Typecheck, lint, suite de tests officielle et dépendances validés pour le commit candidat.
- SR-01/02/03/04/05/07/09 résolus ou capacité concernée réellement retirée/fermée et vérifiée.
- Auth email/OAuth/Apple, confirmation, reset, session redémarrage, logout et profil absent testés.
- Carte/recherche/favoris/commentaires/signalements/affiche/Lumia testés en ligne et en erreur réseau.
- Messages récents/pagination/anti-abus, export complet et suppression de comptes jetables testés.
- Builds release iOS/Android installés ; signature, APNs/FCM, permissions, liens et SDK natifs vérifiés.
- Projet backend public explicitement choisi ; pas d'exposition accidentelle de comptes de test.
- Politique publiée accessible, Data Safety/App Privacy alignés au binaire, permissions de localisation
  justifiées, procédure modération/support et accès reviewer préparés.

Ces conditions incluent des vérifications manuelles et consoles non couvertes ici. Un audit de code
et de catalogues ne peut garantir l'acceptation Apple/Google ni l'absence de tout bug.
