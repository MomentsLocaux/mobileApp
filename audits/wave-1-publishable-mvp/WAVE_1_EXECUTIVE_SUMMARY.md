# Wave 1 - Publishable MVP Executive Summary

## Verdict global

Moments Locaux est proche d'un MVP fonctionnel sur le périmètre produit visible, mais n'est pas encore prêt pour une publication publique App Store / Google Play.

Le produit a une base solide : découverte locale via carte, recherche, création d'événement, profil, favoris, communauté, notifications, signalements et paramètres. La direction MVP est bonne : rester simple, local, chaleureux et utile.

Les blocages restants sont surtout des sujets de surface réelle, sécurité, conformité et enforcement serveur. Ils ne demandent pas une refonte produit, mais une passe ciblée avant bêta/store.

## Niveau de préparation par audit

| Audit | Niveau actuel | Verdict |
| --- | --- | --- |
| MVP Scope & Navigation | Moyen | Trop de routes non-MVP restent accessibles |
| Auth & Onboarding | Moyen | Flux utilisable, cas limites à sécuriser |
| Event Lifecycle | Moyen | UX correcte, règles métier à verrouiller côté serveur |
| Supabase RLS | Insuffisant | Plusieurs expositions sensibles à corriger |
| Database Integrity | Moyen | Nettoyage/staging propre nécessaire |
| GDPR / Store Compliance | Partiel | Suppression compte et légal bloquants |

## Points bloquants MVP public

### P0

- Retirer la modération admin de l'application mobile.
- Protéger ou rediriger les routes non-MVP encore deep-linkables.
- Corriger les RLS exposant données sensibles : check-ins, bug reports, event views, likes/follows/favorites selon granularité.
- Vérifier les RPC, notamment `get_events_by_ids`, pour empêcher tout contournement de `published/public`.
- Verrouiller les transitions de statut événement côté serveur.
- Empêcher l'édition d'un événement publié depuis mobile.
- Rendre la suppression de compte réellement fonctionnelle.
- Finaliser CGU, politique de confidentialité, mentions légales et contact privacy/support.
- Ajouter consentement CGU/privacy à l'inscription.
- Traiter le cas session authentifiée sans profil applicatif.

## Risques principaux

- Un testeur ou reviewer accède à des écrans non-MVP.
- Des données sensibles sont lisibles par anon/authenticated non-owner.
- Un créateur modifie un événement publié ou force une transition de statut.
- La suppression de compte est affichée mais non exécutée.
- Des données de test ou médias fake apparaissent dans screenshots/store review.
- La biométrie/soft logout crée une confusion privacy.

## Ce qui est déjà plutôt OK

- La navigation visible principale est beaucoup plus resserrée qu'avant.
- La carte et les listes publiques filtrent côté data-provider sur `published` + `public`.
- Le flux création principal envoie les nouveaux événements en `pending`.
- Les signalements utilisateur existent pour événement/commentaire/profil.
- Les settings contiennent les entrées légales et suppression compte.
- Les features boutique/missions/offres sont globalement masquées de l'UI principale.

## Plan d'action recommandé

### P0 - Avant MVP public

1. Réduire la surface mobile réelle :
   - supprimer/guarder routes modération
   - guarder shop/missions/offers/journey/creator/step-3

2. Sécuriser Supabase :
   - corriger RLS tables sensibles
   - auditer RPC
   - verrouiller transitions `events.status`
   - limiter Storage uploads/types/visibility

3. Stabiliser lifecycle événement :
   - autoriser édition seulement `draft/refused`
   - empêcher update `published` depuis client
   - afficher raison de refus

4. Finaliser conformité :
   - vraie suppression compte
   - CGU/privacy/mentions finalisées
   - consentement inscription
   - contact support/privacy

5. Stabiliser auth :
   - profil manquant réparé automatiquement
   - biométrie clarifiée ou masquée
   - logout complet disponible si biométrie gardée

### P1 - Avant bêta large ou store review

- Nettoyer staging/dev et reseeder données demo MVP propres.
- Ajouter matrice tests manuels iOS/Android.
- Ajouter documentation permissions store.
- Ajouter diagnostics DB non destructifs.
- Remplacer les derniers textes/fallbacks prototype.

### P2 - Post-MVP

- Web app admin complète.
- Export données.
- Blocage/masquage utilisateur avancé.
- Wallet/lumo, missions, boutique, offers.
- Analytics créateur avancés.
- Automatisation purge Storage et jobs de maintenance.

## Livrables de cette vague

- `01_MVP_SCOPE_NAVIGATION_AUDIT.md`
- `02_AUTH_ONBOARDING_AUDIT.md`
- `03_EVENT_LIFECYCLE_AUDIT.md`
- `04_SUPABASE_RLS_AUDIT.md`
- `05_DATABASE_INTEGRITY_AUDIT.md`
- `06_GDPR_STORE_COMPLIANCE_AUDIT.md`
- `WAVE_1_EXECUTIVE_SUMMARY.md`

## Conclusion

Le MVP est atteignable sans ajouter de nouvelles fonctionnalités majeures. La prochaine passe doit être une passe de réduction de surface, sécurité Supabase, lifecycle événement et conformité store. C'est le chemin le plus direct vers une bêta crédible puis une review store.
