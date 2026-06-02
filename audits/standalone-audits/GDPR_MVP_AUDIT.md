# Audit GDPR / Privacy / Store Compliance - Moments Locaux

## 1. Résumé exécutif

Moments Locaux possède déjà plusieurs fondations nécessaires à une publication store : authentification Supabase, settings avec liens légaux, signalement d'événement/commentaire/profil, statuts d'événements, permissions mobiles rationalisées, RLS sur plusieurs tables sensibles, et stockage des tokens via `SecureStore`.

Le niveau de préparation GDPR/store est toutefois insuffisant pour une soumission App Store / Google Play sans passe de conformité dédiée. Estimation : 5/10. Les mécanismes existent souvent côté UI ou service, mais les garanties attendues avant publication ne sont pas encore complètes : suppression de compte réelle, politique de confidentialité détaillée, sort des contenus après suppression, nettoyage Supabase Storage, rétention des données de modération, et retrait de la surface admin mobile.

Points bloquants avant publication :

- l'écran `Supprimer mon compte` affiche une confirmation mais ne déclenche aucune suppression réelle ;
- aucun flux complet documenté/implémenté pour supprimer ou anonymiser `auth.users`, `profiles`, contenus, social graph, check-ins, notifications, médias Storage ;
- politique de confidentialité trop générique pour les données réellement traitées ;
- CGU et mentions légales contiennent encore des champs `[a compléter]` ;
- la modération admin existe encore dans l'application mobile, alors que la décision produit est de la sortir vers une web app admin ;
- les médias Supabase Storage peuvent devenir orphelins si l'utilisateur, l'événement ou le compte est supprimé ;
- la localisation/check-in stocke des coordonnées utilisateur précises, avec besoin de rétention courte et justification explicite ;
- le logout actuel est un soft logout permettant une reconnexion biométrique via tokens conservés, point à expliquer et encadrer.

Ce document n'est pas un texte juridique définitif. Il fournit un audit technique/fonctionnel et un plan d'action.

## 2. Inventaire des données personnelles

| Donnée | Table/source | Champ ou exemple | Finalité | Écran/fonctionnalité | Obligatoire | Visibilité | Conservation recommandée | Suppression/anonymisation recommandée |
|---|---|---|---|---|---|---|---|---|
| Identifiant utilisateur | `auth.users`, `profiles`, tables sociales | `id`, `user_id`, `profile_id`, `creator_id`, `author_id` | Lier le compte aux contenus/actions | Auth, profil, événements, favoris, follows, commentaires, check-ins | Oui | Privé, parfois indirectement public via profil/contenu | Tant que compte actif ; logs/modération durée limitée | Supprimer si données relationnelles non nécessaires ; anonymiser sur contenus conservés |
| Email | `auth.users`, `profiles.email` | `email` | Auth, support, compte, notifications transactionnelles | Signup/login, profil, drawer | Oui pour compte | Privé ; ne doit pas être exposé publiquement | Tant que compte actif | Supprimer/anonymiser dans `profiles`; supprimer compte Supabase Auth ou rendre email irréversible |
| Mot de passe | Supabase Auth | hash géré par Supabase | Authentification | Signup/login | Oui pour email/password | Jamais visible | Géré par Supabase | Suppression via suppression Auth user |
| Tokens session | `SecureStore` local | `supabase_session_access_token`, `supabase_session_refresh_token` | Session et reconnexion biométrique | Login, biométrie, logout | Non, mais nécessaire si biométrie | Local privé | Jusqu'à logout complet, expiration ou suppression compte | Effacer sur suppression compte et proposer une vraie révocation de session |
| Données biométriques | OS uniquement | Face ID / Touch ID via `expo-local-authentication` | Déverrouillage local | Login biométrique | Facultatif | Non accessibles par l'app | Pas stockées par l'app | Documenter que l'app ne stocke pas la biométrie |
| Nom affiché | `profiles` | `display_name` | Identification communautaire | Onboarding, profil, commentaires, événements | Oui dans profil | Public | Tant que compte actif | Anonymiser en `Utilisateur supprimé` si contenus conservés |
| Avatar / cover profil | `profiles`, Storage | `avatar_url`, `cover_url` | Profil public | Profil, communauté, commentaires, drawer | Facultatif | Public si profil visible | Tant que compte actif | Supprimer fichiers Storage ou remplacer URL par null |
| Bio | `profiles.bio` | texte libre | Présentation utilisateur | Profil communauté | Facultatif | Public | Tant que compte actif | Supprimer/anonymiser |
| Ville/région | `profiles.city`, `profiles.region` | ville, région | Personnalisation locale, communauté | Onboarding, profil, recherche communauté | Facultatif/recommandé | Public si affichée | Tant que compte actif | Supprimer/anonymiser |
| Réseaux sociaux | `profiles.facebook_url`, `instagram_url`, `tiktok_url` | URLs | Présentation profil | Profil/edit | Facultatif | Public si affiché | Tant que compte actif | Supprimer |
| Rôle/statut utilisateur | `profiles` | `role`, `status`, `ban_until` | Autorisations, modération | Navigation, accès admin/modérateur, sécurité | Oui technique | Privé/admin ; rôle parfois inféré par UI | Tant que compte actif ; historique sanction durée limitée | Conserver temporairement si nécessaire sécurité/modération, puis anonymiser |
| Données événement créateur | `events` | `creator_id`, `title`, `description`, `address`, `city`, `postal_code`, `latitude`, `longitude`, `contact_email`, `contact_phone` | Publication d'événements locaux | Création, carte, détail événement | Oui pour titre/date/lieu ; contact facultatif | Événements publiés publics | Tant que événement actif ; archives limitées | Supprimer brouillons ; anonymiser créateur ou supprimer événements selon choix produit |
| Coordonnées événement | `events` | `latitude`, `longitude`, `location`, `address` | Carte, recherche, itinéraire | Carte, détail, création | Oui pour événement local | Public si événement publié | Tant que événement visible | Supprimer avec événement ; conserver si contenu public maintenu |
| Coordonnées check-in | `event_checkins`, Edge Function | `lat`, `lon`, `validated_radius`, `source` | Valider présence et éviter fraude | Détail événement, QR check-in | Oui pour check-in | Privé ; agrégats/avatars peuvent être visibles | Durée courte recommandée : 30 à 90 jours pour coordonnées précises, agrégats plus longs | Supprimer ou réduire à preuve anonymisée après délai |
| Follows | `follows` | `follower`, `following` | Suivre créateurs, communauté | Communauté, favoris créateurs | Facultatif | Relation possiblement visible via compteurs ; lignes privées/auth | Tant que compte actif | Supprimer lignes où user est follower/following |
| Favoris | `favorites` | `profile_id`, `event_id` | Retrouver événements | Favoris, carte | Facultatif | Privé | Tant que compte actif | Supprimer lignes utilisateur |
| Likes/intérêts | `event_likes`, `comment_likes`, `event_interests`, media likes | `user_id`, target id | Interactions sociales | Détail, commentaires, stats | Facultatif | Agrégats publics ; lignes privées | Tant que compte actif | Supprimer lignes utilisateur ; recalculer compteurs |
| Commentaires/réponses | `event_comments` | `author_id`, `message`, `rating`, `parent_comment_id` | Avis, conversation | Échos de communauté | Facultatif | Public/visible sur événement | Selon CGU ; durée tant que événement visible | Supprimer ou anonymiser auteur + conserver texte si licence/CGU le prévoit |
| Médias événement | `event_media`, Storage | `url`, `event_id`, fichiers `event-media` | Illustrer événements | Création, détail, galerie | Facultatif sauf cover exigée par flow | Public si événement publié | Tant que événement visible | Supprimer fichiers Storage et lignes DB si supprimés |
| Contributions média | `event_media_submissions`, Storage | `author_id`, `url`, `status` | Photos communauté après check-in | Échos, détail événement | Facultatif | Public si approuvé | Tant que événement visible ; pending/rejected durée courte | Supprimer/anonymiser auteur ; supprimer médias rejetés après délai |
| Notifications | `notifications` | `user_id`, `type`, `title`, `body`, `data`, `read` | Informer l'utilisateur | Inbox notifications | Facultatif selon préférences | Privé | 6 à 12 mois ou moins | Supprimer notifications du compte |
| Signalements | `reports` | `reporter_id`, `target_type`, `target_id`, `reason`, `severity`, `status` | Sécurité, modération, conformité UGC | Signalement contenu/profil | Facultatif mais nécessaire UGC | Privé modération | Conservation temporaire justifiée : 6 à 24 mois selon risque | Conserver pseudonymisé si nécessaire défense/sécurité ; anonymiser reporter après suppression compte |
| Bug reports | `bug_reports` | `reporter_id`, `page`, `category`, `severity`, `description` | Support et amélioration produit | Reporter un bug | Facultatif | Privé support | 6 à 12 mois | Supprimer/anonymiser reporter ; vérifier texte libre |
| Vues événement | `event_views` | `profile_id`, `event_id`, date | Statistiques événement | Détail événement, stats créateur | Facultatif/technique | Privé/agrégé | Très court pour lignes personnelles, agrégat plus long | Supprimer/anonymiser `profile_id` |
| Wallet/Lumo/XP | `wallets`, `lumo_transactions`, `user_xp_levels`, missions | `user_id`, `balance`, `xp`, transactions | Gamification/wallet | Dormant/partiellement visible check-in | Non MVP | Privé ou semi-public via communauté | À éviter MVP ; sinon tant que compte actif | Supprimer/anonymiser si non nécessaire MVP |
| Préférences locales | Zustand/AsyncStorage/FileSystem/SecureStore | favorites-store, likes-store, history-store | Cache, UX locale | Favoris, historique, session | Non | Local privé | Tant que app installée | Effacer sur logout complet/suppression compte |

## 3. Inventaire des contenus générés par les utilisateurs

**Événements**

- UGC principal : titre, description, lieu, date, catégorie, tags, prix, liens externes, contact, couverture, médias.
- Risques : données personnelles dans description/contact, adresse précise, contenu illégal/trompeur, droits image.
- Recommandation : publication modérée `pending`, statut visible au créateur, raison de refus visible, suppression/anonymisation définie.

**Photos et médias**

- Covers événement, galerie organisateur, contributions communauté, avatar et cover profil.
- Risques : visages, lieux privés, mineurs, droits d'auteur, médias orphelins Storage.
- Recommandation : bucket public seulement pour médias réellement publics ; supprimer rejected/pending anciens ; nettoyer Storage sur suppression compte/événement.

**Commentaires et réponses**

- Texte libre + rating + auteur.
- Risques : propos illicites, données personnelles dans texte, harcèlement.
- Recommandation : signalement visible, suppression par auteur si possible, anonymisation auteur si compte supprimé.

**Profils**

- Nom public, avatar, cover, ville, bio, réseaux sociaux.
- Risques : auto-divulgation de données, usurpation, harcèlement.
- Recommandation : signalement profil déjà présent ; ajouter masquage/blocage minimal si communauté publique.

**Signalements**

- Contenu généré par l'utilisateur sous forme de motif et éventuellement détails.
- Risques : données sensibles dans détails, accusations, données de sécurité.
- Recommandation : accès restreint modération web, rétention définie, anonymisation reporter après suppression compte sauf besoin légitime.

**Bug reports**

- Description libre, page/écran, sévérité, reporter.
- Risques : utilisateur peut y inclure email, numéro, capture mentale d'un bug, infos personnelles.
- Recommandation : prévenir de ne pas inclure d'informations sensibles ; anonymiser/supprimer après traitement.

**Check-ins**

- Pas un UGC visible au sens classique, mais action utilisateur associée à coordonnées GPS.
- Risques : localisation précise, historique de présence, profilage.
- Recommandation : minimisation forte, rétention courte des coordonnées brutes, affichage public limité à agrégats.

## 4. Analyse des écrans nécessaires

**Politique de confidentialité**

- Existe : `app/settings/privacy/policy.tsx`.
- État : trop générique.
- Manques : responsable de traitement, contact privacy, bases légales, données collectées par catégorie, localisation/check-in, médias, signalements, notifications, sous-traitants Supabase/Mapbox/Expo, transferts hors UE, durées de conservation, droits utilisateur, suppression/anonymisation, mineurs, sécurité.
- Recommandation : P0 avant store. Le texte doit être juridique/finalisé par la société.

**Conditions générales d'utilisation**

- Existe : `app/settings/legal/cgu.tsx`.
- État : structure utile, mais champs `[a compléter]` et mentions d'achats intégrés/wallet/premium alors que ces features sont masquées MVP.
- Recommandation : P0/P1. Finaliser identité éditeur, contact, règles UGC, modération, signalement, licence UGC, âge minimum, suppression compte.

**Mentions légales**

- Existe : `app/settings/legal/mentions.tsx`.
- État : champs éditeur incomplets.
- Recommandation : P0 pour publication française/européenne.

**Suppression compte**

- Existe : `app/settings/privacy/delete.tsx`.
- État : écran placeholder, aucune action réelle.
- Recommandation : P0 bloquant. L'utilisateur doit pouvoir demander/supprimer son compte depuis l'app.

**Contact support/privacy**

- État : pas de vrai contact finalisé ; placeholders `[contact@momentslocaux.app]`.
- Recommandation : P0. Ajouter email support/privacy réel et cohérent dans privacy/CGU/mentions.

**Signalement contenu**

- Événement : présent dans détail événement.
- Commentaire : présent dans `EventEchoesScreen`.
- Média : service existe, vérifier exposition UI selon MVP.
- Recommandation : garder côté mobile, améliorer confirmation et tracking.

**Signalement utilisateur/profil**

- Présent dans `CommunityProfileScreen`.
- Recommandation : garder, car communauté/follow sont visibles.

**Blocage ou masquage utilisateur**

- État : pas de vrai blocage utilisateur côté MVP mobile identifié ; une action "Bloquer" existe dans modération admin mobile, pas côté utilisateur.
- Recommandation : pour un MVP avec profils/commentaires publics, le blocage/masquage n'est pas toujours légalement obligatoire, mais fortement recommandé par les stores si interactions sociales/UGC. À minima P1 : masquer profil/contenus d'un utilisateur signalé ou bloqué localement. P0 si commentaires/communauté sont largement ouverts au public.

**Modération admin mobile**

- État : routes et écrans modération existent dans l'app mobile.
- Décision produit : admin via web app séparée.
- Recommandation : P0 produit/store. Ne pas exposer ni embarquer la surface admin mobile dans le parcours public MVP ; conserver uniquement les mécanismes utilisateur.

## 5. Analyse des permissions

**Localisation**

- iOS : `NSLocationWhenInUseUsageDescription` clair.
- Android : `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`.
- Usage réel : événements proches, carte, filtres, check-in distance.
- Risque : `useLocation` demande la permission au montage ; préférer une demande contextuelle au moment carte/check-in/recherche proche.
- Recommandation : garder, mais documenter dans privacy et éviter demande trop précoce.

**Caméra**

- iOS : texte clair QR + photos.
- Android : `CAMERA`.
- Usage réel : scan QR check-in, prise photo événement/profil.
- Recommandation : garder.

**Photos / médias**

- iOS : `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`.
- Android : `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` compat SDK < 33.
- Usage réel : upload images profil/événements/contributions.
- Recommandation : garder. Vérifier que l'app n'utilise pas écriture photothèque sans action utilisateur explicite.

**Notifications**

- Pas de permission Android `POST_NOTIFICATIONS` dans `app.config.ts`.
- Écran settings notifications existe mais semble gérer des toggles locaux non reliés à une vraie préférence serveur complète.
- Recommandation : si push notifications MVP, ajouter permission Android 13+ et flux consentement. Si pas push MVP, rendre les toggles cohérents ou masquer.

**Biométrie**

- iOS : `NSFaceIDUsageDescription` clair.
- Usage réel : reconnexion via session sauvegardée.
- Risque : logout soft conserve tokens pour biométrie.
- Recommandation : garder si feature stable, mais ajouter option "déconnexion complète / oublier cet appareil" et expliquer dans privacy.

**Microphone**

- Non présent dans `app.config.ts`.
- Recommandation : ne pas ajouter pour MVP.

**Permissions Android excessives**

- `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE` ne sont plus dans `app.config.ts`.
- Recommandation : bon état actuel. Vérifier le manifeste final généré avant soumission.

## 6. Analyse du flux suppression de compte

### Ce qui existe

- Route settings visible : `Paramètres > Confidentialité & données > Supprimer mon compte`.
- Écran de confirmation avec alerte destructive.
- Aucun appel service/RPC/Edge Function identifié pour supprimer réellement le compte.

### Ce qui manque

- Edge Function ou endpoint sécurisé utilisant service role pour orchestrer la suppression.
- Vérification auth récente ou confirmation explicite.
- Suppression/révocation Supabase Auth user.
- Nettoyage `profiles`.
- Suppression des tokens locaux `SecureStore`, caches Zustand/AsyncStorage/FileSystem.
- Nettoyage Storage.
- Stratégie explicite pour contenus publics et données de sécurité.
- Email/contact ou fallback support si suppression automatique échoue.

### Données à supprimer

- `favorites`, `event_likes`, `comment_likes`, `event_interests`, `event_media_submission_likes`.
- `follows` où l'utilisateur est `follower` ou `following`.
- `notifications` de l'utilisateur.
- préférences locales et tokens sur l'appareil.
- brouillons d'événements non publiés.
- médias profil : avatar/cover.
- bug reports non nécessaires ou anonymisés.
- event views personnelles.

### Données à anonymiser ou traiter selon règle produit

- événements publiés : soit suppression complète, soit conservation avec créateur anonymisé si CGU le prévoit.
- commentaires/réponses : soit suppression, soit auteur `Utilisateur supprimé`.
- médias approuvés liés à événements : supprimer si média personnel de l'utilisateur, ou anonymiser auteur si conservation prévue.
- reports : conserver temporairement pour sécurité/modération, mais anonymiser `reporter_id` après suppression sauf nécessité légitime.
- check-ins : supprimer coordonnées précises ; conserver uniquement agrégat si nécessaire.
- sanctions/warnings/modération : conserver temporairement en pseudonymisé pour abus, litiges, anti-contournement.

### Médias Supabase Storage

Risques identifiés :

- avatar upload : bucket `avatar` ou fallback `public`, chemin `avatars/{userId}-{timestamp}` ;
- event cover upload : bucket `event-media` ou fallback `public`, chemin `event_covers/{userId}-{timestamp}` ;
- contributions : chemin `contrib/{eventId}/{userId}/{fileName}` ;
- suppressions partielles lors de l'édition d'événement, mais pas de flux global suppression compte.

Recommandation :

- stocker systématiquement `bucket` + `storage_path` en DB, pas seulement URL publique ;
- interdire le fallback `public` non maîtrisé en production ou le documenter clairement ;
- sur suppression compte, lister et supprimer tous les fichiers par préfixe utilisateur et par lignes DB ;
- nettoyer les médias orphelins via job planifié.

### Risques liés à `auth.users` / `profiles` / storage

- Supprimer `profiles` sans supprimer `auth.users` laisse un compte Auth existant.
- Supprimer `auth.users` sans nettoyer `profiles` laisse des données personnelles en base.
- Supprimer les lignes DB sans supprimer Storage laisse des fichiers publics accessibles par URL.
- Anonymiser les contenus sans recalculer compteurs peut produire des incohérences.

## 7. Risques GDPR/store

### P0 bloquant

- Suppression compte non fonctionnelle.
- Privacy policy trop générique et non alignée sur données réelles.
- Mentions légales/CGU avec champs non complétés.
- Absence de stratégie documentée sur le devenir des UGC après suppression.
- Absence de nettoyage Storage compte/événement.
- Modération admin encore présente dans l'app mobile malgré décision web admin.
- Données de check-in GPS précises sans rétention courte documentée.
- Contact support/privacy non finalisé.

### P1 important

- Demande localisation possiblement trop précoce.
- Notifications settings pas clairement reliées à un consentement serveur/push.
- Reconnexion biométrique et soft logout à clarifier avec option de révocation.
- Blocage/masquage utilisateur manquant si communauté/commentaires restent visibles.
- Reports sans champ `details` utilisé malgré API acceptant `details`, et pas de preuve UI de suivi côté utilisateur.
- Bug report peut collecter des données sensibles dans texte libre sans avertissement.
- Fallback Storage vers bucket `public` à durcir.
- Event views/statistiques personnelles à minimiser.

### P2 amélioration post-MVP

- Portail utilisateur export données.
- Historique des demandes privacy.
- Tableau de préférences granulaire serveur : push, recommandations, localisation, marketing.
- Jobs de purge automatisés.
- Audit RLS complet table par table.
- Registre interne de traitement et DPIA léger pour check-ins/localisation.

## 8. Plan d'action recommandé

### P0 - Avant soumission store

1. Finaliser textes légaux avec conseil juridique : privacy policy, CGU, mentions légales, contact privacy/support.
2. Implémenter un vrai flux suppression compte via Edge Function sécurisée, sans migration destructive côté client.
3. Définir la politique produit sur les UGC après suppression : supprimer vs anonymiser.
4. Nettoyer Storage sur suppression compte/événement et supprimer les médias orphelins.
5. Retirer/masquer complètement la surface admin modération dans l'app mobile ; garder uniquement signalements utilisateur et statuts de ses événements.
6. Documenter et réduire la rétention des check-ins : supprimer coordonnées GPS brutes après délai court.
7. Vérifier que les statuts `draft`, `pending`, `published`, `refused` et raison de refus sont visibles côté créateur.
8. Vérifier le manifeste final iOS/Android : uniquement localisation, caméra, photos/media, biométrie si utilisée, notifications si réellement MVP.

### P1 - Stabilisation conformité

1. Ajouter "Oublier cet appareil / déconnexion complète" pour supprimer tokens SecureStore et révoquer session.
2. Demander la localisation de façon contextuelle, notamment carte/check-in, plutôt qu'automatiquement si possible.
3. Ajouter blocage/masquage utilisateur minimal.
4. Ajouter avertissement bug report : ne pas inclure de données sensibles.
5. Relier les préférences notifications à une vraie persistance serveur ou masquer les options non branchées.
6. Centraliser un service de suppression/anonymisation avec dry-run et logs internes.
7. Ajouter des durées de conservation explicites pour reports, bug reports, notifications, event views.

### P2 - Post-MVP

1. Ajouter export de données utilisateur.
2. Ajouter historique privacy/support.
3. Ajouter jobs planifiés de purge : rejected media, old notifications, old GPS check-ins, orphan storage.
4. Ajouter audit RLS et tests automatisés pour accès données privées.
5. Préparer web admin modération séparée avec accès restreint, journalisation et séparation des rôles.

## Conclusion

Le MVP peut devenir store-ready sans refonte majeure, mais la conformité exige une passe dédiée. Le sujet prioritaire n'est pas l'ajout de fonctionnalités : c'est la preuve qu'un utilisateur peut comprendre les traitements, signaler les contenus, supprimer son compte, et que l'application sait supprimer ou anonymiser proprement les données et médias associés.
