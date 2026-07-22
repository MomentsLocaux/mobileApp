# Post-MVP

## Explicitement Hors MVP Mobile

### Web App Admin Complète

- Dashboard admin.
- Files de modération.
- Approve/reject.
- Ban/warn/lift restriction.
- Media review.
- User risk dashboard.
- Analytics modération.

### Boutique

- Shop.
- Purchase flows.
- Produits premium.

### Missions

- Missions utilisateur.
- Quêtes avancées.
- Récompenses complexes.

### Offres

- Subscriptions.
- Offers.
- Plans premium.

### Wallet / Lumo Avancé

- Wallet.
- Transactions.
- Classements Lumo.
- Économie virtuelle.
- Spec : `project-management/decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md`
- Couches marketing : **Local → Habitué → Éclaireur** (monnaie **Lumo**)
- Tickets : `MVP-LUMO-001` … `MVP-LUMO-012` dans `MVP_TICKETS.md`
- Seed proposé (non appliqué) : `supabase/diagnostics/20260721_lumo_rules_seed_proposal.sql`

### Gamification Avancée

- Badges avancés.
- Leaderboards locaux / statut quartier (pas national — ADR 004).
- XP visible complexe.
- Missions profondes.
- Pass partenaires / early access / boost créateur gagné (matrice ADR 004).

### Creator Analytics Avancés

- Dashboard créateur.
- Fans segmentation.
- Stats détaillées.
- Actions reward.

### Analytics Avancées

- Cohortes.
- Rétention avancée.
- A/B testing.
- Data warehouse.

### Automatisations Avancées

- Purges automatiques complexes.
- Trust score automatique.
- Détection spam ML/rules avancées.
- Offline queue complète.

## Principe

Ces sujets peuvent rester dans le repo comme code dormant seulement s'ils sont invisibles, guardés et sans risque RLS/store. Ils ne doivent pas être exposés dans le mobile MVP.
