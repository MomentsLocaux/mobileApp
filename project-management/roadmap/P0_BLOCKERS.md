# P0 Blockers

## Ordre Recommandé

1. `MVP-P0-001` - Retirer admin/modération mobile.
2. `MVP-P0-002` - Guarder routes non-MVP.
3. `MVP-P0-003` - Sécuriser RLS tables sensibles.
4. `MVP-P0-004` - Sécuriser RPC events et visibilité publique.
5. `MVP-P0-005` - Verrouiller lifecycle événement.
6. `MVP-P0-006` - Rendre suppression compte fonctionnelle.
7. `MVP-P0-007` - Finaliser légal minimum et consentement register.
8. `MVP-P0-008` - Corriger auth/onboarding profil absent.
9. `MVP-P0-009` - Sécuriser env/secrets/API locale.
10. `MVP-P0-010` - Empêcher exposition Storage/médias critiques.
11. `MVP-P0-011` - Bloquer writes pour profils banned/suspended.
12. `MVP-P0-012` - Valider build MVP minimal.

## Actions Bloquantes

### MVP-P0-001 - Retirer admin/modération mobile

Description : retirer les entrées, routes et routages vers la modération admin côté mobile.

Justification : décision ADR 001 ; admin web-only.

Risques si non traité : surface admin exposée, scope creep, risque store et sécurité.

Dépendances : ADR 001.

### MVP-P0-002 - Guarder routes non-MVP

Description : bloquer shop, missions, offers, wallet/Lumo, creator analytics, legacy routes et placeholders.

Justification : UI hiding insuffisant.

Risques si non traité : deep links vers écrans non finalisés.

Dépendances : ADR 002.

### MVP-P0-003 - Sécuriser RLS tables sensibles

Description : corriger exposition anon/auth excessive sur check-ins, bug reports, event views, likes et reports.

Justification : données privées/sensibles exposées.

Risques si non traité : fuite GDPR/sécurité.

Dépendances : aucune.

### MVP-P0-004 - Sécuriser RPC events et visibilité publique

Description : garantir que RPC et requêtes détails ne retournent jamais draft/pending/refused/private hors droits.

Justification : modération et confidentialité.

Risques si non traité : contenu non publié visible publiquement.

Dépendances : RLS events.

### MVP-P0-005 - Verrouiller lifecycle événement

Description : empêcher édition/transition non autorisée, notamment `published -> pending` depuis mobile.

Justification : la modération ne doit pas dépendre du client.

Risques si non traité : contournement publication.

Dépendances : RLS/RPC events.

### MVP-P0-006 - Rendre suppression compte fonctionnelle

Description : définir et implémenter suppression/anonymisation compte + Storage.

Justification : exigence App Store / Google Play / GDPR.

Risques si non traité : rejet store.

Dépendances : stratégie data/privacy.

### MVP-P0-007 - Finaliser légal minimum et consentement register

Description : finaliser CGU/privacy/mentions/contact et ajouter acceptation à l'inscription.

Justification : conformité store/GDPR.

Risques si non traité : rejet store, flou UGC.

Dépendances : décision produit sur contenu légal.

### MVP-P0-008 - Corriger auth/onboarding profil absent

Description : garantir session + profil absent => réparation profil + onboarding.

Justification : éviter blocage utilisateur.

Risques si non traité : utilisateurs bloqués ou état incohérent.

Dépendances : auth flow.

### MVP-P0-009 - Sécuriser env/secrets/API locale

Description : vérifier absence API locale hardcodée et absence service role exposée.

Justification : sécurité et build production.

Risques si non traité : fuite secret, build non portable.

Dépendances : release config.

### MVP-P0-010 - Empêcher exposition Storage/médias critiques

Description : empêcher fallback public et vérifier ownership upload/read/delete.

Justification : médias publics et contributions UGC.

Risques si non traité : fuite média ou upload abusif.

Dépendances : RLS/Storage.

### MVP-P0-011 - Bloquer writes pour profils banned/suspended

Description : empêcher création events/comments/reports abusifs par comptes non actifs.

Justification : trust & safety.

Risques si non traité : abus après sanction.

Dépendances : policies/RPC.

### MVP-P0-012 - Valider build MVP minimal

Description : garantir typecheck/lint/config/build numbers/secrets pour release candidate.

Justification : build impossible = blocker.

Risques si non traité : impossible de publier/tester proprement.

Dépendances : env/release.
