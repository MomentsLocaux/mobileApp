# SCRUM-289 — Tiroir intéressé ouvert par défaut

Le composant partagé `AgendaScreen` initialise le tiroir `interested` en mode liste,
pour l'onglet Favoris comme pour l'entrée modale. La sélection d'un jour dans la
semaine ne réinitialise plus le tiroir : une fermeture manuelle reste respectée.
Les chargements et retours au focus ne modifient déjà pas ce choix.

Le filtre du jour, l'état vide et son accès à la découverte sont conservés. Le
calendrier mensuel garde son parcours distinct de sélection de plage et sa modale.
Les flags de visibilité des autres tiroirs ne changent pas.

Vérifications du 30 septembre 2026 : `npm run typecheck` réussi ; `npm run lint`
réussi, 0 erreur et les 42 avertissements préexistants. Relecture de la charte UI
et des handlers semaine/mois, refresh/focus et ouverture/fermeture manuelle.
Recette native iOS/Android (entrée onglet et modale, vide, refresh et focus) à faire.

À la demande explicite de l'utilisateur, ce ticket partage la branche de
SCRUM-288 et SCRUM-290, avec un commit distinct et la PR #52.
