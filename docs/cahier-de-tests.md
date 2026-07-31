# Cahier de tests — Application mobile

Recette manuelle iOS/Android pour le MVP découverte + social pairs (FEATURE_SOCIAL_PEERS on, création/gamification off).

> Source de vérité exécutable : catalogue seedé dans la Moderation Console (`/moderation/qa`). Les IDs ci-dessous sont stables.

- **Cas** : 58
- **Smoke P0** : 15
- **Suivi** : créer une campagne dans la console, synchroniser le catalogue, initialiser les exécutions.

## Authentification

### MOB-AUTH-001 — Inscription par email/mot de passe

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : Aucun compte existant avec l'email de test

**Étapes**

1. Ouvrir l'app sur l'écran d'accueil non connecté
2. Toucher 'Créer un compte'
3. Saisir un email valide, un mot de passe conforme et valider les CGU
4. Confirmer l'inscription

**Résultat attendu** : Le compte est créé, un email de confirmation est envoyé et l'utilisateur est redirigé vers l'onboarding.

### MOB-AUTH-002 — Connexion par email/mot de passe

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : Compte existant et vérifié

**Étapes**

1. Ouvrir l'app
2. Toucher 'Se connecter'
3. Saisir email et mot de passe corrects
4. Valider

**Résultat attendu** : L'utilisateur est authentifié et redirigé vers l'écran principal (carte).

### MOB-AUTH-003 — Connexion refusée avec identifiants invalides

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir l'écran de connexion
2. Saisir un email valide et un mot de passe incorrect
3. Valider

**Résultat attendu** : Un message d'erreur explicite s'affiche, aucune session n'est créée, le champ mot de passe est réinitialisé.

### MOB-AUTH-004 — Connexion via Sign in with Apple

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios
- **Préconditions** : Compte Apple ID de test configuré sur le device

**Étapes**

1. Sur l'écran de connexion, toucher 'Continuer avec Apple'
2. Valider l'authentification biométrique du système
3. Autoriser le partage de l'email si demandé

**Résultat attendu** : L'utilisateur est connecté ou son compte est créé automatiquement, session persistée.

### MOB-AUTH-005 — Connexion via Google Sign-In

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Compte Google de test disponible sur le device

**Étapes**

1. Sur l'écran de connexion, toucher 'Continuer avec Google'
2. Sélectionner un compte Google dans le sélecteur natif
3. Confirmer l'autorisation

**Résultat attendu** : L'utilisateur est connecté ou son compte est créé, redirection vers l'écran principal.

### MOB-AUTH-006 — Réinitialisation du mot de passe

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Sur l'écran de connexion, toucher 'Mot de passe oublié ?'
2. Saisir l’email du compte
3. Valider la demande
4. Suivre le lien reçu par email et définir un nouveau mot de passe

**Résultat attendu** : Un email de réinitialisation est envoyé, le nouveau mot de passe permet la connexion, l'ancien est révoqué.

### MOB-AUTH-007 — Persistance de session après redémarrage de l’app

- **Priorité** : P0
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Utilisateur connecté

**Étapes**

1. Se connecter avec succès
2. Fermer complètement l'application (kill process)
3. Rouvrir l'application

**Résultat attendu** : L'utilisateur est automatiquement reconnecté (token rafraîchi) sans repasser par l'écran de connexion.

## Onboarding

### MOB-ONB-001 — Parcours d'onboarding complet nouvel utilisateur

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : Compte fraîchement créé

**Étapes**

1. Suivre les écrans de bienvenue jusqu'au bout
2. Accepter (ou refuser) la géolocalisation
3. Accepter (ou refuser) les notifications push
4. Sélectionner une ville/zone d'intérêt

**Résultat attendu** : L'onboarding se termine sans blocage quel que soit le choix aux permissions, l'utilisateur arrive sur la carte centrée sur sa zone.

### MOB-ONB-002 — Refus de la permission de géolocalisation

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Pendant l'onboarding, refuser l'accès à la position
2. Terminer l'onboarding

**Résultat attendu** : L'app propose une saisie manuelle de ville et affiche un état de repli cohérent sur la carte (pas de crash, pas de centrage aléatoire).

### MOB-ONB-003 — Refus de la permission de notifications

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Pendant l'onboarding, refuser les notifications push
2. Aller dans Compte > Notifications

**Résultat attendu** : Les préférences de notifications restent accessibles et affichent un message invitant à activer les notifications dans les réglages système.

### MOB-ONB-004 — Reprise de l'onboarding après fermeture de l'app en cours de route

- **Priorité** : P2
- **Type** : exploratory
- **Plateformes** : ios, android

**Étapes**

1. Démarrer l'onboarding et valider les 2 premiers écrans
2. Tuer l'application
3. Rouvrir l'application

**Résultat attendu** : L'onboarding reprend à une étape cohérente (ou redémarre proprement) sans état corrompu ni double compte.

### MOB-ONB-005 — Onboarding non ré-affiché après première connexion

- **Priorité** : P1
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Utilisateur ayant déjà complété l’onboarding

**Étapes**

1. Se déconnecter
2. Se reconnecter avec le même compte

**Résultat attendu** : L'utilisateur arrive directement sur la carte, l'onboarding ne se relance pas.

### MOB-ONB-006 — Sélection de ville avec autocomplétion

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Pendant l'onboarding, ouvrir le champ de sélection de ville
2. Taper 'Rou' puis sélectionner 'Rouen' dans les suggestions

**Résultat attendu** : La liste de suggestions se filtre en temps réel, la sélection met à jour la zone par défaut de la carte.

## Carte

### MOB-MAP-001 — Chargement initial de la carte avec géolocalisation

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : Permission de localisation accordée

**Étapes**

1. Ouvrir l'app sur l'onglet Carte
2. Attendre le centrage automatique sur la position utilisateur

**Résultat attendu** : La carte se centre sur la position courante et affiche les pins des événements à proximité en moins de 3 secondes.

### MOB-MAP-002 — Recherche par ville sans géolocalisation

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la barre de recherche de la carte
2. Saisir un nom de ville, ex. 'Lyon'
3. Sélectionner le résultat

**Résultat attendu** : La carte se recentre sur la ville recherchée et charge les événements du viewport correspondant.

### MOB-MAP-003 — Filtrage des événements par catégorie

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir le panneau de filtres
2. Sélectionner une catégorie, ex. 'Marché/Brocante'
3. Appliquer le filtre

**Résultat attendu** : Seuls les événements de la catégorie sélectionnée restent visibles sur la carte et dans la liste.

### MOB-MAP-004 — Filtrage des événements par plage de dates

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir le panneau de filtres
2. Sélectionner 'Ce week-end'
3. Appliquer

**Résultat attendu** : Seuls les événements se déroulant durant la période sélectionnée s'affichent, le compteur de résultats est mis à jour.

### MOB-MAP-005 — Interaction avec un cluster de pins

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Zone avec au moins 5 événements proches

**Étapes**

1. Toucher un cluster regroupant plusieurs événements

**Résultat attendu** : La carte zoome sur le cluster et éclate les pins individuels, sans dépasser les limites de la zone couverte par les données.

### MOB-MAP-006 — Ouverture de la fiche événement depuis un pin

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Toucher un pin sur la carte

**Résultat attendu** : La fiche détail de l'événement s'ouvre avec titre, dates, lieu, description et actions d'engagement.

### MOB-MAP-007 — État vide sans événement dans la zone

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Naviguer la carte vers une zone rurale sans événement publié

**Résultat attendu** : Un état vide explicite s'affiche (message + illustration), sans erreur ni écran blanc.

### MOB-MAP-008 — Rafraîchissement des événements au déplacement du viewport

- **Priorité** : P1
- **Type** : regression
- **Plateformes** : ios, android

**Étapes**

1. Faire un panoramique important de la carte vers une autre région
2. Relâcher le geste

**Résultat attendu** : Les événements du nouveau viewport sont récupérés (debounce respecté) et la liste des pins est mise à jour sans doublon ni pin résiduel de l'ancienne zone.

### MOB-MAP-009 — Comportement de la carte en mode hors-ligne

- **Priorité** : P2
- **Type** : exploratory
- **Plateformes** : ios, android

**Étapes**

1. Activer le mode avion
2. Ouvrir l'onglet Carte

**Résultat attendu** : Un message de type 'pas de connexion' s'affiche et la dernière carte connue (si en cache) reste consultable, sans crash.

## Engagement

### MOB-ENG-001 — Ajouter un événement en favori

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la fiche d'un événement
2. Toucher l'icône favori

**Résultat attendu** : L'événement apparaît dans la liste des favoris du profil, l'icône reste active après retour sur la fiche.

### MOB-ENG-002 — Retirer un favori

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Événement déjà en favori

**Étapes**

1. Ouvrir la liste des favoris
2. Retirer un événement

**Résultat attendu** : L'événement disparaît de la liste de favoris immédiatement.

### MOB-ENG-003 — Liker un événement

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la fiche d'un événement
2. Toucher l'icône 'J'aime'

**Résultat attendu** : Le compteur de likes s'incrémente immédiatement (optimistic update) et se confirme après réponse serveur.

### MOB-ENG-004 — Ajouter un commentaire sur un événement

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la fiche d'un événement
2. Ouvrir la section commentaires
3. Saisir un commentaire et valider

**Résultat attendu** : Le commentaire apparaît dans la liste avec l'avatar et le pseudo de l'auteur, le compteur de commentaires est mis à jour.

### MOB-ENG-005 — Supprimer son propre commentaire

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : L'utilisateur a déjà posté un commentaire

**Étapes**

1. Ouvrir la section commentaires
2. Toucher son commentaire puis Supprimer
3. Confirmer

**Résultat attendu** : Le commentaire est retiré de la liste et le compteur décrémente.

### MOB-ENG-006 — Limite de longueur du commentaire

- **Priorité** : P3
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la saisie de commentaire
2. Saisir un texte dépassant la limite autorisée

**Résultat attendu** : Un compteur de caractères ou un blocage de saisie empêche de dépasser la limite, sans crash du champ texte.

### MOB-ENG-007 — Partager un événement

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la fiche d'un événement
2. Toucher 'Partager'
3. Sélectionner une application cible dans la feuille de partage native

**Résultat attendu** : La feuille de partage native s'ouvre avec un lien profond vers l'événement, le lien ouvre l'app (ou fallback web) sur la bonne fiche.

## Social

### MOB-SOC-001 — Suivre un autre utilisateur (peer)

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : FEATURE_SOCIAL_PEERS activé

**Étapes**

1. Ouvrir le profil public d’un autre utilisateur
2. Toucher 'Suivre'

**Résultat attendu** : Le bouton passe en 'Suivi(e)', l'utilisateur apparaît dans la liste des abonnements.

### MOB-SOC-002 — Ne plus suivre un utilisateur

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Utilisateur déjà suivi

**Étapes**

1. Ouvrir le profil de l’utilisateur suivi
2. Toucher 'Suivi(e)' puis confirmer l'arrêt du suivi

**Résultat attendu** : Le bouton repasse à 'Suivre', l'utilisateur disparaît de la liste des abonnements.

### MOB-SOC-003 — Badge « aimé par vos abonnements » sur un événement

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Au moins un utilisateur suivi a liké un événement visible

**Étapes**

1. Suivre un utilisateur ayant liké un événement
2. Ouvrir la carte ou la fiche de cet événement

**Résultat attendu** : Un badge/mention 'aimé par [pseudo] et X autres abonnements' est visible sur la fiche événement.

### MOB-SOC-004 — Inviter un ami à rejoindre l’app

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Inviter des amis
2. Sélectionner un canal de partage (SMS, WhatsApp...)

**Résultat attendu** : La feuille de partage native s'ouvre avec un message d'invitation contenant un lien de téléchargement/deep link.

### MOB-SOC-005 — Consulter la liste des abonnés (followers)

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir son propre profil
2. Toucher le compteur 'Abonnés'

**Résultat attendu** : La liste des abonnés se charge avec avatar, pseudo et bouton de suivi réciproque le cas échéant.

### MOB-SOC-006 — Bloquer un utilisateur depuis son profil

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir le profil public d’un utilisateur
2. Toucher le menu contextuel puis 'Bloquer'
3. Confirmer

**Résultat attendu** : L'utilisateur bloqué n'est plus visible dans les flux social/commentaires et ne peut plus interagir avec le profil de l'utilisateur bloquant.

### MOB-SOC-007 — Onglet Social masqué quand FEATURE_SOCIAL_PEERS est désactivé

- **Priorité** : P1
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Flag FEATURE_SOCIAL_PEERS désactivé côté configuration

**Étapes**

1. Ouvrir l'application avec le flag désactivé

**Résultat attendu** : Aucun onglet ni action de suivi/abonnement n'est visible dans l'interface, aucune erreur réseau liée au social n'est déclenchée.

## Notifications

### MOB-NOTIF-001 — Activation des préférences de notifications par catégorie

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Notifications
2. Activer/désactiver une catégorie, ex. 'Nouveaux événements à proximité'

**Résultat attendu** : La préférence est sauvegardée et persiste après redémarrage de l’app.

### MOB-NOTIF-002 — Réception d’une notification push en foreground

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : L'app est ouverte au premier plan

**Étapes**

1. Déclencher une notification push de test depuis le backend

**Résultat attendu** : Une bannière in-app s'affiche sans interrompre le flux courant, le contenu correspond à la notification envoyée.

### MOB-NOTIF-003 — Réception et ouverture d’une notification en background

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : App en arrière-plan ou fermée

**Étapes**

1. Déclencher une notification push de test
2. Toucher la notification dans le centre de notifications système

**Résultat attendu** : L'app s'ouvre et navigue directement vers l'écran/fiche concerné par la notification (deep link).

### MOB-NOTIF-004 — Repli gracieux quand la permission notification est refusée

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Permission système de notifications refusée

**Étapes**

1. Ouvrir Compte > Notifications

**Résultat attendu** : Un message explique que les notifications système sont désactivées et propose un lien vers les réglages, sans crash.

### MOB-NOTIF-005 — Respect des heures de silence (quiet hours)

- **Priorité** : P3
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Plage horaire de silence configurée dans les préférences

**Étapes**

1. Configurer une plage horaire de silence couvrant l’heure actuelle
2. Déclencher une notification push de test

**Résultat attendu** : La notification n'est pas délivrée en push pendant la plage de silence, ou est délivrée silencieusement selon la spécification produit.

### MOB-NOTIF-006 — Deep link de notification vers un commentaire précis

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Recevoir une notification de type « nouveau commentaire »
2. Toucher la notification

**Résultat attendu** : L'app ouvre la fiche événement avec la section commentaires déroulée et le commentaire concerné mis en évidence.

## Sûreté

### MOB-SURETE-001 — Signaler un événement

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la fiche d'un événement
2. Toucher le menu contextuel puis 'Signaler'
3. Sélectionner un motif et valider

**Résultat attendu** : Le signalement est enregistré côté serveur, un accusé de réception s'affiche à l'utilisateur.

### MOB-SURETE-002 — Signaler un commentaire

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir la section commentaires d’un événement
2. Toucher le menu contextuel d'un commentaire puis 'Signaler'
3. Sélectionner un motif et valider

**Résultat attendu** : Le signalement du commentaire est enregistré et confirmé à l’utilisateur.

### MOB-SURETE-003 — Signaler un profil utilisateur

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir le profil public d’un utilisateur
2. Toucher le menu contextuel puis 'Signaler ce profil'
3. Sélectionner un motif et valider

**Résultat attendu** : Le signalement de profil est enregistré et confirmé à l’utilisateur.

### MOB-SURETE-004 — Motif de signalement obligatoire

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir le formulaire de signalement
2. Tenter de valider sans sélectionner de motif

**Résultat attendu** : Le bouton de validation reste désactivé ou un message d'erreur bloque l'envoi tant qu'aucun motif n'est sélectionné.

### MOB-SURETE-005 — Visibilité du statut de publication après refus de modération

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android
- **Préconditions** : Un événement créé par l’utilisateur a été refusé en modération

**Étapes**

1. Ouvrir Compte > Mes publications
2. Ouvrir l'événement au statut 'Refusé'

**Résultat attendu** : Le statut 'Refusé' et le motif de refus (si renseigné) sont affichés clairement à l'utilisateur.

## Compte

### MOB-COMPTE-001 — Modifier les informations de profil

- **Priorité** : P1
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Modifier le profil
2. Modifier le pseudo et/ou la bio
3. Enregistrer

**Résultat attendu** : Les modifications sont sauvegardées et visibles immédiatement sur le profil public.

### MOB-COMPTE-002 — Changer sa photo de profil

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Modifier le profil
2. Toucher la photo de profil
3. Choisir une image depuis la galerie et valider le recadrage

**Résultat attendu** : La nouvelle photo est uploadée, compressée et affichée sur le profil sans délai excessif.

### MOB-COMPTE-003 — Visualiser tous les statuts de publication (draft/pending/published/refused/archived)

- **Priorité** : P0
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Utilisateur ayant au moins un événement dans chacun des statuts possibles

**Étapes**

1. Ouvrir Compte > Mes publications
2. Parcourir chaque onglet/filtre de statut

**Résultat attendu** : Chaque événement affiche le bon libellé de statut (Brouillon, En attente, Publié, Refusé, Archivé) avec les actions associées correctes.

### MOB-COMPTE-004 — Accès aux CGU et à la politique de confidentialité

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Informations légales
2. Ouvrir les CGU puis la politique de confidentialité

**Résultat attendu** : Les deux documents s’affichent intégralement (webview ou écran natif) sans erreur de chargement.

### MOB-COMPTE-005 — Supprimer son compte

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Supprimer mon compte
2. Lire l’avertissement de suppression définitive
3. Confirmer avec le mot de passe ou une re-authentification

**Résultat attendu** : Le compte et les données associées sont supprimés/anonymisés conformément au RGPD, l'utilisateur est déconnecté et redirigé vers l'écran de connexion.

### MOB-COMPTE-006 — Annulation de la suppression de compte en cours de confirmation

- **Priorité** : P2
- **Type** : functional
- **Plateformes** : ios, android

**Étapes**

1. Ouvrir Compte > Supprimer mon compte
2. Sur l’écran de confirmation, toucher Annuler

**Résultat attendu** : Le compte reste actif, l’utilisateur revient à l’écran Compte sans aucune donnée supprimée.

## Non-fonctionnel

### MOB-NF-001 — Temps de démarrage à froid (cold start)

- **Priorité** : P0
- **Type** : smoke
- **Plateformes** : ios, android
- **Préconditions** : App fermée (process tué), device au repos

**Étapes**

1. Lancer l’application depuis l’icône
2. Mesurer le temps jusqu’à l’écran interactif (carte ou connexion)

**Résultat attendu** : Le démarrage à froid reste sous le seuil cible défini (ex. < 3s sur device de référence), sans écran blanc prolongé.

### MOB-NF-002 — Deep link vers la création d’événement masqué (flag création OFF)

- **Priorité** : P1
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Flag de création d’événement désactivé côté configuration

**Étapes**

1. Ouvrir un deep link pointant vers l’écran de création d’événement

**Résultat attendu** : L'app ignore ou redirige proprement le deep link (aucun écran de création accessible), sans crash ni écran cassé.

### MOB-NF-003 — Deep link vers un écran de gamification masqué (flag gamification OFF)

- **Priorité** : P1
- **Type** : regression
- **Plateformes** : ios, android
- **Préconditions** : Flag de gamification désactivé côté configuration

**Étapes**

1. Ouvrir un deep link pointant vers un écran de badges/points/niveaux

**Résultat attendu** : Aucun écran de gamification ne s’affiche, redirection propre vers un écran valide (ex. carte ou profil).

### MOB-NF-004 — Comportement hors-ligne général de l’app

- **Priorité** : P2
- **Type** : exploratory
- **Plateformes** : ios, android

**Étapes**

1. Naviguer dans plusieurs écrans (carte, profil, favoris)
2. Activer le mode avion
3. Continuer à naviguer entre écrans déjà chargés

**Résultat attendu** : Un indicateur de connexion clair est affiché, les données déjà en cache restent consultables, aucune action réseau ne provoque de crash.

### MOB-NF-005 — Accessibilité : taille de texte dynamique du système

- **Priorité** : P3
- **Type** : exploratory
- **Plateformes** : ios, android

**Étapes**

1. Augmenter la taille de police dans les réglages d’accessibilité du système
2. Rouvrir l’application et naviguer sur les écrans principaux

**Résultat attendu** : Les textes s’adaptent sans troncature critique ni chevauchement bloquant sur les écrans clés (carte, fiche événement, compte).
