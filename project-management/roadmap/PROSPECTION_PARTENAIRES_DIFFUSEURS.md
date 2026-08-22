# Plans de prospection — Partenaires Pass Lumo & Diffuseurs

## Status

Draft commercial — 2026-08-06.  
Réf. : [PARTNER_PASS_MODEL.md](./PARTNER_PASS_MODEL.md) · [ADR_006](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md) · business model Visibility-first.

## Principe commun

| | **Partenaire Pass Lumo** | **Diffuseur** |
|--|--------------------------|---------------|
| Qui | Commerce / lieu d’accueil IRL | Orga / asso / lieu / OT / collectivité |
| Ils paient pour | (Pilote) rien · puis listing Actif | Visibilité + outils (Free → Pro / packs) |
| Ils ne sont pas | Un compte Diffuseur | Un Partenaire Pass |
| Moment idéal | Densité Habitués / events proches | Events à venir sous 14–45 j |
| Canal | Porte-à-porte + WhatsApp | Email + RDV + claim events scrapés |

**Ville pilote d’abord** (1 rayon 5–10 km). Ne pas prospecter nationalement.

**Ordre stratégique :** densifier un peu l’audience / les events scrapés → Partenaires Pass (preuve IRL) **en parallèle** pipeline Diffuseur (claim + boost) dès V1 produit. En MVP store : Partenaires = devis / relation ; Diffuseur self-serve = V1.

---

# A — Plan de prospection Partenaires Pass Lumo

## A1. Objectif

Signer **3–8 partenaires Pilot** dans la ville pilote avant activation Habitué / redemption live.

KPI 90 j :

| KPI | Cible |
|-----|--------|
| RDV physiques / sem. | 8–12 |
| Taux signature Pilot après RDV | ≥ 40 % |
| Partenaires live | ≥ 3 (go-live Pass) puis 8 |
| Rewards T1/T2 only | 100 % en pilote |

## A2. ICP (client idéal)

| Priorité | Profil | Reward type | Pourquoi |
|----------|--------|-------------|----------|
| **P0** | Café / boulangerie / salon de thé indépendant | Café / soft / viennoiserie (T1) | COGS bas, passage fréquent, gérant décide vite |
| **P0** | Bar / brasserie culturelle | Soft / apéro réduit (T1/T2) | Après-event naturel |
| **P1** | Librairie / disquaire / magasin sport local | Remise −2/−5 € (T2) | Aligné ADN ; process remise simple |
| **P1** | Lieu culturel (entrée / early) | Accès (T3) | Si jauge gérable |
| **P2** | Food truck / stand festival | Soft / snack | Pic densité |
| **Éviter** | Chaînes nationales, high COGS SKU, franchises lourdes | — | Décision lente, COGS, process |

**Signaux chauds :** déjà mécène d’assos, affiche events locaux, open late le week-end, gérant présent en journée.

## A3. Liste & sourcing (semaine 0)

1. Tracer un **polygone** (quartier / centre-ville + 2–3 rues events).
2. Croiser : Google Maps « café » / « boulangerie » + Instagram local + agenda scrapé ML (events à < 800 m).
3. Fiche CRM simple (Notion / Sheet) :

| Champ | Exemple |
|-------|---------|
| Nom / adresse | Café des Halles |
| Contact | Prénom gérant, tel, IG |
| Distance events ML | 120 m d’un pin fréquent |
| Reward proposé | Café offert |
| Statut | À contacter / RDV / Pilot / Refus |
| Notes COGS / horaires | Fermé dimanche |

Volume cible liste : **40–60 commerces** pour en signer 8.

## A4. Séquence de contact

| Étape | Canal | Timing | Message cœur |
|-------|-------|--------|--------------|
| 1 | Visite à pied (horaire calme : 10h–11h30 ou 15h–16h30) | J0 | Pitch 45 s + carte pitch |
| 2 | Laisser flyer 1 page + sticker « à venir » | J0 | Coordonnées ML |
| 3 | WhatsApp / SMS | J+1 | « Merci pour l’échange — résumé Pilot en 4 lignes » |
| 4 | RDV signature 15 min | J+3–7 | Annexe reward + horaires |
| 5 | Installation (autocollant + favori scan ou kit plus tard) | Sem. suivante | Formation staff 10 min |
| 6 | Relance dormants | J+14 | « On lance avec 3 commerces du quartier — place restante » |

**Ne pas** cold-email long. Le commerce se gagne **en face**.

## A5. Script porte (45 s)

> On aide les gens du quartier à sortir plus — concerts, marchés, assos.  
> Ceux qui sortent vraiment ont un **Pass Lumo** : ils choisissent un cadeau dans l’app, puis viennent le scanner chez un commerce.  
> Chez vous, ce serait [un café offert] — vous gardez le stock, c’est gratuit en pilote, on ne vous donne aucune donnée perso client.  
> En échange : des voisins **déjà sortis**, motivés, à deux rues.  
> Je vous laisse la fiche — on peut figer ça en 15 minutes la semaine prochaine ?

Objections fréquentes → réponses :

| Objection | Réponse |
|-----------|---------|
| « Encore une appli » | Vous n’installez rien : page web / tablette ; le client montre son QR |
| « Ça va me coûter » | Pilote 0 € abo ; coût = le café (COGS) ; plafonné / mois |
| « Stock / compta » | On démarre café/remise ; export si produit emballé plus tard |
| « Personne ne viendra » | On ne lance le Pass que si l’audience locale tourne ; vous êtes dans les 3–8 premiers |
| « Données clients » | Aucune PII ; vous voyez seulement « café offert OK » |

## A6. Offre Pilot (ce qu’on signe)

- 0 € abo · 3 mois · 1 reward T1 ou T2 · cap mensuel (ex. 40 cafés)  
- Signalétique + page scan  
- Reporting hebdo agrégé (nb redemptions)  
- Sortie possible sous 15 j  

Kit visite : [pitch image](../../.cursor/projects/…) *ou* PDF 1 page + contrat 1 page (annexe reward).

## A7. Cadence & owner

| Qui | Quoi | Charge |
|-----|------|--------|
| Founder / sales | Visites + signatures | 2 demi-journées / sem. |
| Ops | CRM, contrats, onboarding staff | 0,5 j / sem. |
| Produit | Page `/partner/scan` + admin partners | Selon roadmap Pass |

---

# B — Plan de prospection Diffuseurs

## B1. Objectif

Remplir le **pipeline orga** pour V1 (création / Diffuseur) et convertir Free → Pro / packs boost.

Phaser :

| Phase | Objectif | Cash |
|-------|----------|------|
| **MVP (maintenant)** | Leads claim + waitlist pro + RDV OT | 0 € produit self-serve · Insights / white-glove possibles |
| **V1 early** | 30 orga Free actifs · 10 boosts vendus | First € boosts |
| **V1 M3–M6** | 15 Diffuseur Pro · packs campagne | MRR |

KPI pipeline :

| KPI | Cible 90 j post-V1 |
|-----|---------------------|
| Leads qualifiés / sem. | 15 |
| Compte Diffuseur Free créés | 30 |
| Boosts payés | 25 |
| Pro signés | 10–15 |
| OT Apidae connectés | 2–3 |

## B2. ICP par `pro_subtype`

| Subtype | ICP | Trigger d’achat | Offre d’entrée |
|---------|-----|-----------------|---------------|
| **Association** | Asso culturelle / sportive avec 1–4 events / mois | Prochain atelier sous-rempli | Free + Boost Express 9 € |
| **Lieu** | Salle / café-concert / médiathèque | Week-end à remplir | Free + Week-end fort 24 € |
| **Indépendant** | Coach / artisan / prof qui anime | Date unique | Free + Boost 9 € |
| **OT / CDT** | OT avec Apidae | Besoin diffusion locale habitants | Apidae **gratuit** → Insights / Campagne 79 € → Pro |
| **Collectivité** | Service culture / com | Observatoire / agenda | Devis Insights + Pack territoire |

**Éviter en early :** grosses institutions avec AO 12 mois (sauf si Insights déjà vendu) — cycle trop long pour le cash V1.

## B3. Sourcing

| Source | Action |
|--------|--------|
| Events scrapés ML | Top orga par volume / proximité → **claim** « C’est mon event » |
| OpenAgenda / Apidae / sites asso | Liste emails publics |
| Agenda mairie / Facebook Events locaux | Outbound manuel |
| Partenaires Pass déjà signés | Intro « l’asso d’à côté » (cross-sell soft) |
| Festivals calendrier N+1 | Approche 3–6 mois avant |

CRM champs : subtype, prochain event, canal, statut (Lead / Claim / Free / Boost / Pro), MRR.

## B4. Séquence de contact

### B4.1 Assos / lieux / indépendants (volume)

| Étape | Canal | Timing | Contenu |
|-------|-------|--------|---------|
| 1 | Email court + IG DM | J0 | « Votre [event] est déjà visible sur ML — revendiquez-le / boostez le prochain » |
| 2 | Relance | J+3 | Preuve : capture carte / vues si dispo |
| 3 | Appel 10 min | J+5–10 | Démo Free + prix Boost |
| 4 | Lien Stripe Boost ou onboarding Free | J+7–14 | Close cash or activation |
| 5 | J+30 post-Free | Email | Upsell Pro si multi-users / besoin stats |

**Email type (5 lignes) :**

> Objet : Votre [Atelier céramique] est déjà sur Moments Locaux  
> Bonjour,  
> Les habitants du coin découvrent les moments près d’eux sur Moments Locaux (carte + voisins).  
> [Event X] y apparaît déjà. Vous pouvez le **revendiquer** et, pour le prochain, le mettre en avant pour 9 € le samedi.  
> 10 min pour vous montrer ?  
> [Lien claim / calendly]

### B4.2 OT / collectivités (cycle plus long)

| Étape | Action |
|-------|--------|
| 1 | Identifier responsable numérique / animation / SIT |
| 2 | Mail + LinkedIn : Apidae gratuit + preuve audience pilote |
| 3 | RDV 30 min démo Insights (PDF) + Diffuseur Free |
| 4 | Proposition : Apidae free · option Campagne quartier · devis Baromètre |
| 5 | Close annuel Pro / Insights si budget |

## B5. Scripts & objections Diffuseur

**Pitch 30 s :**

> Moments Locaux, c’est la carte où les habitants voient ce qu’il se passe près d’eux — avec leurs amis, pas une billetterie.  
> Vous publiez **gratuitement**. Vous payez seulement si vous voulez être **plus visibles** le week-end (boost) ou outiller l’équipe (Pro : stats, sièges, badge).

| Objection | Réponse |
|-----------|---------|
| « On a Facebook » | FB = algo ; ML = voisins geo + preuve check-in |
| « On n’a pas de budget » | Free illimité ; boost 9 € ponctuel |
| « Double saisie » | Claim + plus tard connecteurs ICS/OA/Apidae |
| « C’est une billetterie ? » | Non — on diffuse et on mesure la présence |
| « Combien Pro ? » | 29 € HT/mois · 290 €/an |

## B6. Offres d’entrée (ordre de close)

1. **Claim / Free** — activer le compte (flywheel)  
2. **Boost Express 9 €** — first €, preuve ROAS  
3. **Week-end 24 € / Campagne 79 €** — orga régulier / OT  
4. **Pro 29 €** — multi-sièges / analytics  
5. **Insights** — collectivité / OT (devis)

Règle : ne jamais vendre Pro avant un Free actif **sauf** OT/collectivité en devis pack.

## B7. Cadence & owner

| Qui | Quoi | Charge |
|-----|------|--------|
| Founder | OT / collectivités / top lieux | 1 j / sem. |
| Sales / community | Outbound assos + claim scrapés | 2 j / sem. post-V1 |
| Ops | Onboarding Free, Stripe boosts | Continu |
| Produit | Claim flow, Diffuseur home, Apidae | Roadmap V1 |

---

# C — Calendrier type (ville pilote, 12 semaines)

| Sem. | Partenaires Pass | Diffuseurs |
|------|------------------|------------|
| 1–2 | Liste 50 · 20 visites · 5 RDV | Liste 80 orga scrapés · 40 mails claim |
| 3–4 | 3 Pilot signés · formation staff | 10 claims / Free waitlist |
| 5–6 | +3 Pilot · stickers vitrine | Démo OT #1 · Insights one-shot si data |
| 7–8 | Go redemption si ≥3 + audience | V1 : 10 boosts ciblés |
| 9–10 | Reporting partenaires · témoignages | Upsell Pro early adopters |
| 11–12 | Review : Actif payant ? | 5–10 Pro · rétrospective funnel |

---

# D — Assets à préparer

| Asset | Partenaire | Diffuseur |
|-------|------------|-----------|
| Pitch 1 page / image | Oui | Oui (autre copy) |
| Contrat 1 page + annexe | Oui | CGU org + devis |
| Page scan / onboarding | `/partner/scan` | `/app` Diffuseur |
| CRM Sheet | Oui | Oui |
| Preuves | Photos redemption · nb Pass | Captures carte · avant/après boost |
| Cross | Intro asso ↔ café du coin | Intro café → orga du week-end |

---

# E — Frontières (ne pas mélanger en prospection)

- Un **café** = Partenaire Pass, pas « Diffuseur Pro café » sauf s’il publie aussi des events (deux comptes possibles, ADR 007).  
- Un **OT** = Diffuseur (Apidae) ± acheteur Insights ; Pass = autre sujet (commerces du territoire).  
- Ne jamais promettre billetterie, cash-out Lumo, ou données perso habitants.

## Liens

- [PARTNER_PASS_MODEL.md](./PARTNER_PASS_MODEL.md)
- [ADR_006 — Diffuseur](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md)
- [ADR_004 — Lumo / Habitué](../decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md)
- [ADR_007 — Identité](../decisions/ADR_007_ACCOUNT_IDENTITY_MODES.md)
