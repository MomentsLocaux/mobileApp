# Catalogue Pass Lumo (boutiques partenaires)

## Status

Accepted — 2026-08-17. Complète [ADR_004](../decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md) amendement Pass Lumo. Orthogonal à [ADR_006](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md) (Partenaire Pass Lumo ≠ Diffuseur) et à [OFFER_CATALOG_LUMO_SHOP.md](./OFFER_CATALOG_LUMO_SHOP.md) (boutique in-app).

**Remplace** le Pass tampon « 3 check-ins = 1 bon mensuel unique » (`MVP-LUMO-008` v1).

## Accès

- `GAMIFICATION_ENABLED` + `partner_pass_redemption_enabled`
- Entitlement Habitué ou Éclaireur (`hasHabitue`) = **Pass Lumo**
- Auth requise. Compte Professionnel : non (ADR 007).

Pass Lumo n’est **pas** une 4ᵉ couche ni une 2ᵉ monnaie. C’est le droit d’ouvrir les boutiques partenaires et d’y dépenser du Lumo.

---

## Qui paie quoi

Moments Locaux **ne paie pas** le croissant, la remise ou le café. Il n’y a pas de virement vers le commerçant.

L’utilisateur paie 0,99 € / mois. Il gagne des Lumo en allant aux événements. Il les dépense dans l’app **ou** chez un commerce (un bon apparaît). En magasin, **le commerçant** offre le cadeau. Moments Locaux ne le rembourse pas.

```
L’utilisateur paie 0,99 € / mois  →  Moments Locaux
        |
        |  il va aux événements, il gagne des Lumo
        v
   Solde Lumo
        |
        |-- dans l’app : VIP, boost, accès anticipé, déco
        |
        |-- chez un commerce : il achète un bon (ses Lumo baissent)
                 |
                 v
            En magasin, le COMMERÇANT offre le croissant / la remise
            Moments Locaux ne le rembourse pas
```

| Quoi | Qui paie | Ce que ça donne | Dès le pilote ? |
|------|----------|-----------------|-----------------|
| Abonnement Habitué | L’utilisateur (0,99 € / mois) | Gagner et dépenser des Lumo, y compris chez les partenaires | Oui |
| Lumo | Personne — ça se gagne | 20 Lumo par check-in, plus les missions | Oui |
| Avantage dans l’app | L’utilisateur, en Lumo | VIP, boost, accès anticipé | Oui |
| Avantage en magasin | **Le commerçant** (coût du produit ou de la remise) | Le cadeau, sur place | **Oui — c’est tout le financement magasin** |
| Être plus visible dans l’app | Le commerçant, s’il le souhaite plus tard | Mise en avant — **pas obligatoire** pour offrir des cadeaux | Non |
| Moments Locaux rembourse le commerçant | Jamais | — | Jamais |

### Pourquoi le commerçant offre

Comme une happy hour, ou Too Good To Go : il offre un croissant (souvent ~0,50 € de coût) pour faire entrer quelqu’un qui peut payer le reste. Ce n’est pas une facture à Moments Locaux.

Il choisit **combien de cadeaux par mois**. Quand le compteur est plein, l’app affiche « plus de cadeaux ce mois-ci ». On ne lui doit rien.

### Ce que 0,99 € n’achète pas

Ne jamais dire : « pour 1 € / mois tu as 6 € de cadeaux offerts par Moments Locaux ». L’abonnement ouvre le système. Les cadeaux viennent **du commerce**, comme une carte de fidélité magasin.

On utilise en interne le repère **20 Lumo ≈ 1 €** pour caler les prix. On ne l’affiche **jamais** dans l’app (« 1 Lumo = x € »).

### VIP sur un événement (dans l’app, pas en magasin)

100 Lumo pour un accès VIP, seulement si l’organisateur le propose, places limitées. C’est l’orga qui « offre » la place / la file, pas Moments Locaux ni un commerçant.

---

## En magasin — comment ça se passe

Un **QR du commerce** est exposé à la caisse. Le client le scanne. Le commerçant n’a pas d’appli.

Deux sortes d’offres :

| | Cadeau (croissant, café) | Remise (sport, resto, friperie…) |
|--|--------------------------|----------------------------------|
| Ce que fait le commerçant | Il tend l’article, **sans le facturer** | Il enlève **5 €** (ou le % plafonné) **sur le ticket** |
| Preuve | Le client montre l’écran 90 secondes | Le commerçant appuie **sur le téléphone du client** |
| Pourquoi | Petit cadeau, un coup d’œil suffit | Une remise mal appliquée, ça se voit trop tard |

Les Lumo sont **mis de côté** au choix de l’offre, pas encore définitivement dépensés. Si personne ne valide dans les 90 secondes, ils reviennent.

### 1. Le client scanne le QR du magasin

Le QR ouvre **la boutique de ce commerce seulement**. Pas d’achat à la maison la veille. Pas de « Mes bons » à 7 jours.

### 2a. Cadeau — croissant, café, viennoiserie

1. Il choisit « Croissant · 40 Lumo ».
2. Gros écran : nom du magasin, l’offre, un chrono 90 s, un code qui bouge (une photo ne suffit pas).
3. Il montre le téléphone. Le commerçant donne le croissant, **sans le mettre sur l’addition**.
4. Soit le client (ou le commerçant) appuie sur « Reçu », soit au bout de 90 s les Lumo reviennent.

### 2b. Remise — magasin de sport et les autres

Une remise, ce n’est pas un objet qu’on tend. C’est une ligne en moins sur le ticket. On **évite les pourcentages tout seuls** : en caisse, « moins 5 € » est plus clair que « 5 % de 47,80 € ».

1. Le client a déjà ses articles. Il scanne le QR.
2. Il choisit par exemple « 5 € de remise · panier au moins 25 € · 80 Lumo ».
3. Gros écran, face à la caisse : *« Panier ≥ 25 €. Enlevez 5 € sur le ticket, puis appuyez ici. »*
4. Le commerçant vérifie le panier, tape **moins 5 €** sur **sa** caisse, puis appuie sur le gros bouton du téléphone du client : **« J’enlève 5 € »**.
5. Là seulement, les Lumo sont dépensés. Écran « Remise faite ».
6. S’il n’appuie pas dans les 90 s : Lumo rendus, pas de remise. Le client ne peut pas dire « j’ai déjà payé en Lumo ».

Le commerçant n’installe rien. Il a déjà les mains sur sa caisse. Un tap sur le téléphone du client, c’est le même geste que « code VIP » à l’hôtel.

Si l’écran est périmé, déjà utilisé, ou un autre magasin : refusé.

### Accès trop fréquent

Si un commerce refuse trop souvent : on ferme sa boutique dans l’app.

---

## Le QR à la caisse

Une affiche / un présentoir, comme le QR Wi-Fi.

Face client : le QR + « Scannez avec Moments Locaux ».  
---

## Chez le commerçant : caisse, stock, compta

Moments Locaux **ne se branche pas** sur la caisse, le stock ni le logiciel comptable. Pas d’export Sage, pas de lien Lightspeed / Caisse Enregistreuse / Square. Le commerçant fait **comme une happy hour**, avec un ou deux boutons créés **une fois** dans sa caisse.

On lui dit, sur l’écran du client, quel bouton taper : « Votre bouton Remise 5 € ».

### Cadeau (croissant, café)

| | Quoi faire |
|--|------------|
| **Ticket** | Soit il ne passe pas l’article (le plus simple). Soit il a un article caisse **« Offert Lumo » à 0 €** et il le scanne — le ticket montre « croissant offert 0,00 € ». |
| **Stock** | S’il gère le stock dans la caisse : il **faut** passer l’article (à 0 €), sinon le stock ment. Boulangerie qui compte à l’œil : il tend le croissant, rien à scanner. |
| **Réf. article** | Pas un code Moments Locaux. C’est **son** croissant, **sa** référence. On n’envoie aucun fichier article. |
| **Compta** | Ce n’est **pas du chiffre d’affaires**. C’est un offre client / une pub. Le comptable le classe souvent en charges de communication. Un croissant, ce n’est pas un sujet TVA. |
| **Z de caisse** | Si bouton « Offert Lumo » : le total du soir le montre. Sinon : rien dans la caisse, on s’appuie sur le mail Moments Locaux (combien de croissants ce mois-ci). |

### Remise (sport, resto)

| | Quoi faire |
|--|------------|
| **Ticket** | Il encaisse **les articles au prix normal**, puis une **ligne négative** : « Remise Pass Lumo −5,00 € ». Le client paie le net. |
| **Stock** | **Inchangé par la remise.** La paire de chaussures sort du stock comme une vente. On a juste vendu moins cher. |
| **Réf. article** | Les produits = **ses** codes. La remise = **un bouton à créer une fois** : `REMISE-LUMO-5`, `REMISE-LUMO-10`, `REMISE-LUMO-15` (lignes à −5 / −10 / −15 €). Pas un % à calculer à la volée. |
| **Compta** | Ce n’est **pas une charge**. Le chiffre d’affaires du jour est le **net** (après remise). La TVA se calcule sur ce net. |
| **Z de caisse** | La remise apparaît dans les totaux « remises » / le bouton Lumo. Recoupable avec le mail Moments Locaux. |

### Ce qu’on lui installe à l’ouverture

1. Le QR à la caisse.
2. Dans **sa** caisse, s’il a un vrai logiciel : 1 article 0 € « Offert Lumo » (si cadeaux) + 1 à 3 boutons de remise en euros.
3. Une fiche : *croissant = tendre sans facturer (ou Offert 0 €). Remise = bouton −5 € puis appuyer sur le téléphone du client.*
4. Chaque mois, un mail : « 12 croissants, 4 remises 5 € ». Pour son comptable, pas une facture.

Pas de facture Moments Locaux ↔ magasin. Pas d’avoir. Pas de remboursement.

---

## Accord avec le commerçant (une page, avant d’ouvrir)

1. Catégorie, offres choisies, combien par mois.
2. C’est **lui** qui offre chaque cadeau ou chaque remise. Moments Locaux ne rembourse pas.
3. Un bon = une fois, **son** magasin, 90 secondes à la caisse.
4. « Pas disponible » / ne pas appuyer → Lumo rendus. Trop de refus → on ferme la boutique.
5. Pas de photocopie, pas d’argent.
6. Dans l’app : pas de « 1 Lumo = x € ».

Plus tard, optionnel : payer pour être plus visible. Ce n’est **pas** obligatoire pour offrir des cadeaux.

## Économie des grilles

- En interne : **20 Lumo ≈ 1 €** pour caler les prix (jamais affiché dans l’app).
- Quelqu’un qui sort souvent : ~200 Lumo / mois. Max **120 Lumo** dépensables en magasin (~6 € de cadeaux).
- Cible : un peu plus dans l’app que chez les commerçants, un peu de déco, une réserve.
- Un pourcentage en magasin a **toujours** un plafond en euros + un panier minimum. Pas d’argent, pas d’offre hors métier.
- Le commerçant peut activer/désactiver, renommer, bouger le prix Lumo un peu (±20 %). Au-delà : on valide avec lui.

Streak 3 check-ins / mois calendaire → **+40 Lumo** une fois (plus de Pass tampon).

### Caps globaux

| Règle | Valeur |
|-------|--------|
| Cap IRL / user / mois | 120 Lumo |
| Partenaires distincts / mois | 3 |
| TTL bon | 7 jours, refund si non utilisé |
| Quota partenaire | Fixé à l’activation, coupé à l’**achat** du bon |
| Double redemption | Impossible (code unique, `redeemed`) |

---

## 12 catégories — grilles de départ

Le partenaire démarre sur sa catégorie, choisit un sous-ensemble, reste dans la bande.

### Boulangerie / pâtisserie — AOV 3–8 €

| Lumo | Offre | Faciale | Coût partenaire typ. | Cap user |
|------|-------|---------|----------------------|----------|
| 20 | 1 € de remise | 1 € | 0,40–1,00 € | 1 / j · 4 / mois |
| 40 | Croissant offert | ~1,30 € | 0,40–0,60 € | 1 / j · 4 / mois |
| 60 | Viennoiserie offerte | ~1,80 € | 0,50–0,80 € | 4 / mois |
| 100 | Goûter (boisson + viennoiserie) | ~4 € | ~1,20 € | 2 / mois |

### Café / bar — AOV 3–12 €

| Lumo | Offre | Faciale | Cap user |
|------|-------|---------|----------|
| 30 | Espresso offert | ~1,50 € | 1 / j · 6 / mois |
| 50 | Boisson chaude | ~2,50 € | 6 / mois |
| 60 | Soft ou demi | 3–4 € | 4 / mois |
| 120 | Apéro (soft + snack) | ~6 € | 2 / mois |

### Restaurant / brasserie

Remise en euros + panier mini. Le commerçant appuie sur le téléphone du client. Dessert / café = cadeau (on montre l’écran).

| Lumo | Offre | Type | Combien de fois |
|------|-------|------|-----------------|
| 60 | 3 € de remise (panier au moins 15 €) | Remise | 2 / mois |
| 80 | Café ou dessert offert | Cadeau | 2 / mois |
| 120 | 6 € de remise (panier au moins 25 €) | Remise | 1 / mois |

### Street food / food truck — AOV 8–14 €

| Lumo | Offre | Cap |
|------|-------|-----|
| 20 | 1 € de remise | 4 / mois |
| 40 | Soft offert | 4 / mois |
| 60 | 2 € sur le menu | 4 / mois |

### Magasin de sport

En caisse, « moins 5 € » est plus clair que « 5 % ». Le commerçant appuie sur le téléphone du client après avoir enlevé le montant sur **son** ticket.

| Lumo | Offre | Panier mini | Combien de fois |
|------|-------|-------------|-----------------|
| 60 | Accessoire (chaussettes, grip) — **cadeau**, on montre l’écran | — | 2 / mois |
| 80 | **5 € de remise** | 25 € | 1 / mois |
| 120 | **10 € de remise** | 40 € | 1 / mois |
| 180 | **15 € de remise** | 60 € | 1 / trimestre |

Si le magasin tient vraiment au %, on peut afficher l’équivalent (« 10 %, max 10 € ») — le bouton reste « J’enlève 10 € ».

**Exemple — paire de running à 89 €, remise 5 €**

1. Le vendeur scanne **son** article : `RUN-NIKE-42` · 89,00 €. Le stock de cette référence −1, comme n’importe quelle vente.
2. Le client scanne le QR Moments Locaux, choisit « 5 € de remise ».
3. Le vendeur tape **son** bouton `REMISE-LUMO-5` → ligne −5,00 €. Puis il appuie sur le téléphone du client.
4. Ticket : 89,00 − 5,00 = **84,00 € TTC** à encaisser. TVA sur 84 €, pas sur 89.
5. Chiffre d’affaires du jour : **84 €**, pas 89. Ce n’est pas une charge « cadeau », c’est une vente moins chère.
6. Moments Locaux n’a jamais vu la référence `RUN-NIKE-42`.

**Exemple — chaussettes offertes (cadeau)** : il tend la paire sans la facturer, ou il passe `CHAUS-LUMO` à 0 € pour sortir le stock. Pas de ligne sur le ticket client, ou 0,00 €. Pas de CA. Le running à côté, s’il y en a un, se vend au prix normal.

### Culture (librairie, disquaire, cinéma indé)

| Lumo | Offre | Cap |
|------|-------|-----|
| 20 | 1 € de remise | 4 / mois |
| 40 | Goodie / marque-page | 2 / mois |
| 50 | 5 % (max 3 €) | 2 / mois |
| 100 | 10 % (max 5 €, mini 12 €) | 1 / mois |

### Bien-être / salon — pas de % nu

| Lumo | Offre | Cap |
|------|-------|-----|
| 100 | 5 € de remise (mini 25 €) | 1 / mois |
| 180 | 10 € de remise (mini 40 €) | 1 / trimestre |

### Mode / friperie

| Lumo | Offre | Cap |
|------|-------|-----|
| 60 | Goodie / retouche simple | 2 / mois |
| 80 | 5 % (max 5 €) | 1 / mois |
| 140 | 10 % (max 8 €, mini 20 €) | 1 / mois |

### Loisirs (escape, bowling, atelier)

| Lumo | Offre | Cap |
|------|-------|-----|
| 20 | 1 € sur le ticket | 4 / mois |
| 40 | Soft offert | 4 / mois |
| 120 | 2ᵉ partie −50 % (max 8 €) | 1 / mois |

### Fleuriste / cadeau

| Lumo | Offre | Cap |
|------|-------|-----|
| 40 | 2 € de remise (mini 10 €) | 2 / mois |
| 100 | 5 € de remise (mini 20 €) | 1 / mois |

### Services quartier (vélo, pressing)

| Lumo | Offre | Cap |
|------|-------|-----|
| 40 | 2 € de remise | 2 / mois |
| 100 | 5 € de remise (mini 15 €) | 1 / mois |

### Producteur / marché

| Lumo | Offre | Cap |
|------|-------|-----|
| 20 | 1 € de remise | 4 / mois |
| 40 | Dégustation / sachet | 4 / mois |
| 100 | 5 € de remise (mini 15 €) | 1 / mois |

---

## Schéma cible (indicatif, pas une migration)

Réutiliser `partners`. Évoluer `partner_rewards` → catalogue SKU (catégorie, `lumo_price`, `face_value_eur_cap`, `min_basket_eur`, `active`, quota). Remplacer `user_partner_passes` mensuel par `lumo_vouchers` (`issued` / `redeemed` / `cancelled` / `expired`, `redemption_code`, `expires_at`, `partner_id`, `sku_id`).

RPCs : `buy_partner_sku`, `cashier_lookup_voucher`, `cashier_redeem_voucher`, `cashier_cancel_voucher` (indisponible → refund), `admin_redeem_voucher` (fallback ops). Flag `partner_pass_redemption_enabled` inchangé comme kill-switch live.

Tickets : `MVP-LUMO-008`, `ADMIN-LUMO-002`, `ADMIN-LUMO-003`.

## Related

- `project-management/decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md`
- `project-management/decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md`
- `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md`
- `MomentsLocaux---Moderation-WebConsole/GAMIFICATION_ADMIN_TICKETS.md`
