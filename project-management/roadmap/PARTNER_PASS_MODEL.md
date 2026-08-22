# Modèle partenaires — Pass Lumo (Habitué / Éclaireur)

## Status

Draft produit — 2026-08-05 · amendé naming **Pass Lumo** + festival + check-in QR orga.  
Complète [ADR_004](../decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md) (M1 / M5 / redemption IRL) et reste **orthogonal** à [ADR_006](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md) (Diffuseur ≠ Partenaire Pass).  
Catalogue Lumo in-app : [OFFER_CATALOG_LUMO_SHOP.md](./OFFER_CATALOG_LUMO_SHOP.md).

## Naming

| Terme retenu | Usage |
|--------------|--------|
| **Pass Lumo** | Nom produit de la carte / programme cadeaux IRL (Habitué+) |
| ~~Pass Quartier~~ | Ancien libellé — à remplacer dans copy / pitch |

Le Pass porte la marque **Lumo** (monnaie d’engagement) : cohérence earn → spend → IRL.

## Promesse

> Habitué ou Éclaireur = un **Pass Lumo** digital (QR / code-barres / Wallet).  
> Sortir (check-ins) rapporte des **tampons** + des **Lumo**.  
> Pass Lumo et Lumo se dépensent chez des partenaires locaux en **cadeaux IRL** — jamais en cash.

### Pari produit (north star)

Le Pass n’est pas un programme de points isolé. C’est le **liant** entre deux acteurs du quartier qui ne se parlent presque jamais aujourd’hui :

| Acteur | Ce qu’il apporte | Ce qu’il gagne si les gens sortent plus |
|--------|------------------|----------------------------------------|
| **Organisateurs** (events) | Raisons de sortir (programmation) | Remplissage, check-ins, preuve d’impact |
| **Commerçants** (Pass) | Raisons de s’arrêter après / autour (cadeau IRL) | Passage qualifié, ticket moyen, visibilité locale |
| **Habitants** | Présence + interactions (amis, échos) | Vie de quartier + récompenses réelles |

```
Event (orga)  →  sortie + check-in  →  Lumo / Pass
                                      ↓
                              Commerce partenaire
                                      ↓
                         plus d’habitude de sortir
                                      ↓
                         plus d’events remplis (orga)
```

**Si on augmente les sorties et les interactions locales, on a gagné** — le reste (Habitué, Insights, Diffuseur, assets de quartier) en découle.  
Métrique nord : sorties / user / mois + redemptions Pass Lumo + check-ins events (pas les installs seules).

### Cas festival — intérêt du Pass Lumo

Un festival concentre en 1–3 jours ce que le quartier fait en un mois : densité de sorties, stands / food trucks, orga unique (ou multi-scènes).

| Pour qui | Intérêt Pass Lumo pendant un festival |
|----------|----------------------------------------|
| **Habitant** | Tampons accélérés (plusieurs check-ins scènes / jours) → activer un cadeau food truck / partenaire off / goodie fest |
| **Organisateur** | Preuve de présence réelle (check-ins QR) ; animation « collectionne 3 scènes → Pass Lumo » ; data remplissage ; **pas** une billetterie |
| **Commerçants / stands** | File de festivaliers **déjà sur site** ; offre simple (soft, snack) ; lien durable post-fest si commerce local |
| **Moments Locaux** | Démo haute densité du flywheel orga ↔ commerces ; acquisition Habitué ; assets visibles (stickers / kit stands) |

Variante festival (même produit, paramètres adaptés) :

- Période Pass = **durée du fest** (ex. ven–dim) au lieu du mois civil.
- Partenaires = stands + 2–3 commerces hors site (après-fest).
- Check-in **QR scène prioritaire / requis** pour tampon Pass Lumo (la geo seule est trop fraudable en foule).

Le festival est un **accélérateur de preuve**, pas un modèle à part.

### Check-in — geo vs QR orga (anti-fraude)

Le check-in alimente Lumo + tampons Pass Lumo. **Deux modes** complémentaires (déjà amorcés : `qr_token`, check-in distance, partage QR event).

| Mode | Comment | Fiabilité | Quand |
|------|---------|-----------|-------|
| **Geo / distance** | User dans un rayon autour du lieu | Moyenne (spoof GPS, parking, multi-events proches) | Confort ; low-stakes ; fallback |
| **QR orga** | User scanne un QR **affiché / imprimé par l’orga** (token event) | Haute — présence face au support | **Recommandé** dès enjeu Lumo / Pass / festival |

**Décision :**

1. L’organisateur **peut toujours** générer, afficher et **imprimer** le QR de check-in (écran owner, PNG/PDF, affiche A4, écran entrée, badge bénévoles).
2. L’app propose : « Scanner le QR » (prioritaire) et « Pas de QR — check-in distance » (secondaire ; éventuellement **moins de Lumo** ou sans tampon Pass — à calibrer).
3. Festival / fort volume : **QR requis** pour créditer un tampon Pass Lumo.
4. Anti-fraude commun : 1 check-in / user / event ; cooldown journalier ; token rotatif optionnel en phase 2.

```
Orga → fiche event → QR check-in → afficher / imprimer
Habitué → scan QR → +Lumo + tampon Pass Lumo
```

Sans QR orga possible, le Pass Lumo repose trop sur la geo → farm + perte de confiance des commerçants partenaires.

## Périmètre / hors-périmètre

| Inclus | Exclus |
|--------|--------|
| Carte Pass Habitué+ | Paywall découverte / carte |
| Tampons via check-in | Conversion Lumo → € |
| Redemption IRL chez partenaires | Comptes Diffuseur / packs boost € orga |
| Boutique Lumo rayon « Cadeaux quartier » | Revente de données perso aux partenaires |
| Admin WebConsole « Partenaires Pass » | App payante à l’achat |

**Go-to-market** : ne pas activer Habitué en store tant qu’il n’existe pas **≥ 3 partenaires live** dans la ville pilote (sinon Pass cosmétique).

## Rôles

| Rôle | Qui | Compte |
|------|-----|--------|
| Titulaire Pass | Habitant Habitué ou Éclaireur | Particulier (ADR 007) |
| Partenaire Pass | Café, lieu, commerce, asso accueillante | Fiche `partners` (admin) — **≠** org Diffuseur |
| Staff partenaire | Employé qui scanne | Accès redemption partenaire (web léger / console) |
| Ops ML | Valide partenaires, stock, litiges | WebConsole admin |

---

## 1. Boucle utilisateur

```
Habitué / Éclaireur
  → Carte Pass (in-app + Wallet)
  → Check-in event (+Lumo + 1 tampon, max 1/event)
  → 3 check-ins / mois → droit Pass
  → Dans l’app : choisir cadeau partenaire proche (activation)
  → En magasin : scan QR → cadeau IRL
  → (option) Boutique Lumo → coupon → scan magasin
```

| Étape | Détail | Asset technique |
|-------|--------|-----------------|
| Abo | Habitué 0,99 €/mois · 9,99 €/an ou Éclaireur 2,99 €/mois · 19,99 €/an | Entitlements `moments_locaux_habitue` / `moments_locaux_plus` |
| Carte | Affichage Pass + QR / code-barres ; ajout Apple/Google Wallet | `redemption_code` sur `user_partner_passes` |
| Earn | Check-in geo/QR validé → +15–25 Lumo + tampon | `wallets` + `user_pass_progress` |
| Unlock | 3 check-ins distincts dans le mois | `streak_unlocked` |
| Activer Pass | **In-app** : choisir reward parmi partenaires **proches** (réserve stock) | Pass `available` + `reward_id` lié |
| Redeem magasin | Scan QR chez le partenaire choisi | `status=redeemed` |
| Activer Lumo IRL | **Boutique** : dépense Lumo → coupon dans Mes cadeaux | `spend_lumo` + inventaire coupon |
| Redeem coupon | Scan coupon en magasin | coupon `redeemed` |

Flags existants (migration LUMO-008) :

- `partner_pass_enabled`
- `partner_pass_redemption_enabled` (défaut **false** jusqu’au pilote)

### 1.1 Logique retenue — activation in-app, puis magasin

**Décision produit** : les cadeaux IRL s’**activent dans l’app** (rétention, intention, réservation de stock), puis deviennent **scannables en magasin**. Pas de « on improvise le cadeau au comptoir ».

```
Découvrir partenaires proches (geo)
  → Choisir / acheter le cadeau dans l’app (Pass ou Boutique Lumo)
  → Cadeau = « prêt à utiliser » (Mes cadeaux / Pass)
  → Se rendre chez le partenaire
  → Scan QR → redeemed
```

| Sink | Dans l’app | En magasin |
|------|------------|------------|
| **Pass tampon** | Après 3 check-ins : **choisir** un reward parmi partenaires proches (activation = réserve 1 unité) | Scan seulement — le staff ne choisit pas l’offre |
| **Boutique Lumo** | Parcourir cadeaux → payer en Lumo → coupon one-shot | Scan du coupon |

#### Pourquoi pas tout décider au comptoir

| Approche | Pour | Contre |
|----------|------|--------|
| **Activation in-app (retenue)** | Rétention ; intention claire ; stock réservé ; staff simple | Un geste app avant d’y aller |
| Redeem live au scan (Lumo débité à la caisse) | Moins de friction | Moins de rétention ; surprises stock ; file au comptoir |
| Pass universel sans choix de commerce | Simple | Pas de réservation ; staff invente l’offre ; faible localisation |

Nuance : le **droit** au Pass vient des check-ins ; le **choix du commerce / reward** se fait dans l’app.

TTL après activation : **7–14 jours** pour redeem (libère le stock si expiré ; le titulaire Pass peut re-choisir s’il est encore dans la période).

### 1.2 Liste des partenaires — localisée

**Oui.** Découverte ancrée sur la **localisation actuelle** (GPS ou dernier point connu), pas un annuaire national plat.

| Règle | Détail |
|-------|--------|
| Tri défaut | Distance croissante |
| Filtre rayon | Ex. 1 / 3 / 5 / 10 km (alignable préférences nearby) |
| Carte | Pins partenaires + rewards dispo |
| États | Ouvert maintenant / stock > 0 / type reward |
| Hors zone | « Aucun partenaire près de toi » + élargir le rayon — pas de liste d’une autre ville |
| Privacy | Pas de PII ni trajectoire envoyée au commerce ; position = même cadre que la carte events |

UX : **Boutique → Cadeaux quartier** et **Pass → Choisir mon cadeau** = même source geo (`partners` + `partner_rewards`, `active`, distance, `stock_remaining > 0`).

---

## 2. Deux sinks IRL (ne pas fusionner)

### A — Pass tampon (streak mensuel)

Récompense de **présence**. Coût partenaire ≈ 1 cadeau entrée de gamme / titulaire / mois.

| Reward type | Exemple | Valeur faciale indicative |
|-------------|---------|---------------------------|
| Boisson | Café / soft | 1–3 € |
| Réduction | −2 € ou −10 % | plafonnée |
| Goodie | Sticker, goodie lieu | faible COGS |
| Accès | Early door / entrée offerte event partenaire | place limitée |

Règles :

- 1 Pass redeemable / période / user (après 3 tampons).
- TTL Pass : **30–45 jours** après unlock (à figer en config).
- Tampon bonus boutique (`pass_extra_stamp`, 80 Lumo, max 1/mois) : voir catalogue Lumo.

### B — Boutique Lumo IRL (« Cadeaux quartier »)

Sink d’accumulation. Pas de cash-out. Prix calibrés pour ~2–6 semaines d’activité (réf. earn ~40–70 Lumo/semaine, ADR 004).

| Reward | Prix Lumo indicatif | Notes |
|--------|---------------------|-------|
| Boisson | 60–80 | Entrée de catalogue |
| Goûter / dessert | 100–120 | |
| Réduction −5 € | 150–200 | Cap stock / mois |
| Expérience (atelier, entrée) | 250–400 | Sur réservation partenaire |

Chaque achat Lumo génère un **coupon one-shot** (QR distinct du Pass mensuel).

---

## 3. Offre partenaire — ce qu’ils donnent / reçoivent

| Tier | Partenaire donne | Partenaire reçoit | Il paie ML ? |
|------|------------------|-------------------|--------------|
| **Pass Pilot** | Stock cadeaux (COGS café ~1–2 €) | Flux Habitués qualifiés + badge « Partenaire Pass » | **Non** (ville pilote) |
| **Pass Actif** | COGS + 1–2 rewards Lumo/mois | Listing carte Cadeaux + reporting redemptions | **29–49 € HT/mois** |
| **Pass Premium** | Catalogue multi-rewards + stock | Story / mise en avant + insights footfall agrégé + option Moment partenaire | **79–149 € HT/mois** ou pack saison |

### Pitch partenaire (1 phrase)

> Tu n’achètes pas de pub : tu échanges un café contre un client **déjà sorti** (check-in), **abonné Habitué**, et dans ton quartier.

### Profils pilotes (1 ville)

| Priorité | Profil | Reward idéal |
|----------|--------|--------------|
| P0 | Café / boulangerie de quartier | Boisson / viennoiserie |
| P0 | Bar / brasserie culturelle | Soft / apéro réduit |
| P1 | Lieu culturel / asso | Entrée / early door |
| P1 | Commerce local (librairie, sport) | −5 € / goodie |
| Éviter | Chaînes nationales, high COGS, hors zone pilote | — |

Cible pilote : **3–8 partenaires** avant `partner_pass_redemption_enabled = true`.

### 3.1 Typologie de rewards — stock, déstockage, compta

Tous les cadeaux ne se gèrent pas comme un café. Anticiper **dès l’annexe contrat** le type de reward, sinon le commerçant refuse ou « oublie » de déstocker.

| Type | Exemples | Stock physique ? | Déstockage caisse | Risque | Phase |
|------|----------|------------------|-------------------|--------|-------|
| **T1 — Service / conso préparée** | Café, soft au verre, viennoiserie du jour | Faible (flux quotidien) | Ligne 0 € ou pas de ligne ; COGS absorbé en charges | Faible | **Pilote P0** |
| **T2 — Remise €** | −2 €, −10 % sur panier | Non (pas d’unité SKU) | Remise / code promo sur ticket | Faible (marge) | **Pilote P0** |
| **T3 — Accès** | Entrée, early door | Places / jauge | Compteur places ; parfois billet gratuit | Moyen (no-show) | Pilote P1 lieux |
| **T4 — Produit unitaire emballé** | Canette, bouteille, objet en boîte, goodie rayon | **Oui** — SKU + quantité | **Obligatoire** : sortie stock / inventaire | Fort si oublié | **Actif+** ; pas en 1er pilote café |
| **T5 — Produit à forte valeur** | Produit > ~8–10 € COGS, édition limitée | Oui + éventuellement réservation | Idem T4 + plafonds stricts | Très fort | Premium / sur devis |

#### Pourquoi T4 (boîte, canette, objet) est différent

- Le commerce a un **inventaire** (logiciel ou cahier) : chaque unité a un coût d’achat.
- Sans déstockage, le stock théorique ≠ stock réel → écart d’inventaire, contrôle fiscal / expert-comptable, « magasinage ».
- Un café « offert » est souvent une **charge marketing** floue ; une canette scannée 0 € **sans** mouvement de stock = anomalie comptable.

#### Règles Moments Locaux (anticipation produit)

1. **Chaque `partner_reward` a un `fulfillment_type`** : `prepared` \| `discount` \| `access` \| `sku_unit`.
2. **T4 / T5** : le partenaire déclare un **SKU interne** (réf. caisse ou libellé inventaire) + `stock_cap` mensuel + `unit_cogs_estimate` (indicatif, non partagé publiquement).
3. **Au redeem vert (T4)** : l’écran B affiche explicitement  
   `Servir : [libellé] — DÉSTOCKER 1× réf. XXX`  
   pour forcer le geste métier (pas seulement « cadeau OK »).
4. **ML ne remplace pas l’ERP** du commerce : on ne synchronise pas Prestashop/Loyverse en pilote. On fournit :
   - le **signal** (redeem + libellé + réf.) ;
   - un **export mensuel** CSV des redemptions T4 (date, reward, qty=1) pour l’expert-comptable / inventaire.
5. **Cap stock ML** (`stock_remaining`) = filet anti-surpromesse (l’app arrête d’afficher le reward à 0).  
   Le **déstockage inventaire** reste **responsabilité du partenaire** à chaque vert.
6. **Rupture** : si inventaire physique à 0 mais cap ML > 0 → staff choisit « rupture » sur B (décrémente cap + alerte) ; pas de redeem.

#### Comptabilité côté commerce (ce qu’on leur dit)

| Type | Traitement typique (indicatif — à valider avec leur EC) |
|------|--------------------------------------------------------|
| T1 café / soft | Charge exploitation / animation commerciale ; souvent sans ligne stock |
| T2 remise | Moins de CA / remise accordée sur ticket |
| T3 accès | Place gratuite / invitation ; suivi jauge |
| T4 / T5 produit | **Sortie de stock** (offre client / échantillon / charge pub) **+** ticket 0 € ou avoir ; conserver l’export ML comme pièce |

Moments Locaux **ne comptabilise pas** pour eux et **ne rembourse pas** le COGS. Le contrat le rappelle. En listing Actif/Premium, on peut aider avec un **kit 1 page « comment enregistrer une offre Pass »** (modèle d’écriture + capture écran B).

#### Recommandation phasée

| Phase | Autorisé | Interdit / différé |
|-------|----------|---------------------|
| Pilote (3–8 partenaires) | T1 + T2 (+ T3 lieux) | T4/T5 sauf 1 partenaire « shop » volontaire avec process écrit |
| Actif | T1–T4 avec `sku_unit` + export CSV | T5 sans devis |
| Premium | T1–T5 + reporting inventaire vs redeem | — |

#### Annexe contrat — champs stock (obligatoires si T4/T5)

| Champ | Exemple |
|-------|---------|
| `fulfillment_type` | `sku_unit` |
| Libellé client | « Canette limonade artisanale » |
| Réf. interne caisse / inventaire | `LIMON-33` |
| Cap / mois | 40 |
| COGS unitaire estimé | 1,10 € |
| Gestes staff | « Au vert ML → déstocker 1× LIMON-33 » |
| Export | Acceptation réception CSV mensuel |

---

## 4. Asset carte (UX)

| Surface | Contenu | Phase |
|---------|---------|-------|
| In-app `/profile/pass` | Tampons X/3 · statut · QR · rewards dispo | Schéma + UI amorcés |
| Apple Wallet / Google Wallet | Store card / coupon : QR + validité + nom | Après pilote scan stable |
| Code-barres fallback | Code-128 du `redemption_code` | Commerces sans scan caméra |
| Coupon Lumo IRL | QR one-shot post-`spend_lumo` | Après calibration économie |

---

## 5. Interaction en commerce partenaire (parcours concret)

Objectif : **< 20 secondes** au comptoir, zéro app native pour le staff au pilote.

### 5.0 Matériel — qui a quoi

Deux appareils distincts. Ne pas les confondre.

| | **Appareil A — Habitant** | **Appareil B — Commerce** |
|--|---------------------------|---------------------------|
| Quoi | Le smartphone **du client** | Un **autre** smartphone ou tablette **du commerce** (caisse / gérant) |
| Logiciel | App Moments Locaux **ou** Apple/Google Wallet | Navigateur seul (Chrome / Safari) — **pas** l’app ML |
| À l’écran | Un **QR à faire scanner** (= Pass / coupon du client) | Page web **« Valider un Pass »** (caméra + champ code) |
| Rôle | Montrer le QR | Lire le QR du client et valider |

**Supports papier en caisse** — attention, il y a **deux QR différents** :

| Objet | Qui s’en sert | Rôle |
|-------|---------------|------|
| Chevalet « Ici Pass Moments Locaux » | Visible clients | Signalétique uniquement |
| Autocollant / carte **« Staff — ouvrir la caisse Pass »** + QR imprimé | **Staff seulement** | Ce QR encode l’URL `https://…/partner/scan`. Le staff le scanne **avec l’appareil B** pour ouvrir la page de validation (raccourci). **Ce n’est pas le cadeau.** |
| Favori navigateur « Pass ML » sur B | Staff | Même URL, sans rescanner l’autocollant |

Règle d’or hardware (pilote staff-assisté) :

> Le client **montre** son QR.  
> Un appareil du commerce (B) **lit** ce QR — tenu par le staff **ou** fixé en mode borne/tablette.

Variante self-service (optionnelle, voir §5.0bis) : le client présente son QR face à une tablette fixe ; le staff ne fait que servir quand l’écran passe au vert.

```
Staff-assisté (défaut pilote) :
  [A client] affiche QR  ←caméra—  [B tenu par staff]

Self-service (kit tablette) :
  [A client] affiche QR  —face à→  [B tablette fixée sur comptoir]
  Staff regarde le vert sur B → sert
```

### 5.0bis Choix hardware — borne custom vs tablette vs téléphone staff

| Option | Coût indicatif / point de vente | Délai | Réalisme boulangerie | Verdict |
|--------|----------------------------------|-------|----------------------|---------|
| **B1 — Téléphone / tablette déjà sur place** | 0 € | Immédiat | Moyen : le staff doit penser à ouvrir la page | **OK pilote** si le gérant est motivé |
| **B2 — Kit « Pass » : tablette Android entrée de gamme + support comptoir + mode kiosque** (URL verrouillée `/partner/scan`) | **80–180 €** one-shot (tablette 70–120 € + stand 15–40 €) · 0 fabrication ML | 1–2 sem. logistique | Bon : écran toujours ouvert, pas le tel perso du vendeur | **Recommandé dès 5–10 partenaires** |
| **B3 — Borne custom ML** (coque, électronique, firmware, outillage) | **Design 5–30 k€** + **200–800 €+/unité** + SAV / stocks / certifs | 3–9 mois | Excellent UX possible, mais overkill | **Non** avant scale (≥50 PDV, volume redeem prouvé) |
| **B4 — Intégration caisse / TPE existant** | Devis éditeur caisse | Long | Idéal long terme | Post–product-market fit |

#### Pourquoi la borne custom est un piège tôt

- Coûts cachés : outillage plastique, SAV, casse, vol, mises à jour OTA, homologation, stock dormant.
- Chaque partenaire a un comptoir différent (humidité, prise, Wifi).
- Tu finances du hardware alors que le **vrai risque** est : y a-t-il assez d’Habitués qui redeem ?

#### Pourquoi demander au seul « téléphone du vendeur » peut coincer

- Tel perso refusé / oublié / batterie / WhatsApp qui coupe.
- File d’attente : le staff n’a pas les mains libres pour « encore une appli ».
- D’où le **kit tablette fixe** : même logiciel web, mais l’appareil reste sur le comptoir, écran allumé sur « Valider un Pass ».

#### Recommandation CEO

1. **Semaines 1–4 (3 partenaires max)** : B1 — téléphone/tablette du commerce, formation 10 min, autocollant staff.
2. **Dès que ça freine ou dès 5+ partenaires** : B2 — kit tablette Android mode kiosque (self-service léger ou staff-assisté sur support). ML peut **prêter** le kit en Pilot (récupérable) puis le facturer / inclure dans Pass Actif.
3. **Borne custom (B3)** : seulement si B2 est saturé (file, volumes, image de marque) **et** qu’un volume de redeem justifie le CAPEX.

Le logiciel reste **identique** (page web `/partner/scan`) quel que soit B1 / B2 / B3 — tu ne redesign pas le produit pour le hardware.

### 5.0ter Vision — assets Moments Locaux dans le quartier

L’objectif long terme n’est pas « une feature Pass dans l’app », c’est une **présence physique récurrente** : en se promenant, on *voit* et on *utilise* Moments Locaux IRL.

| Asset | Forme | Rôle | Phase |
|-------|--------|------|-------|
| Signalétique | Chevalet / sticker vitrine « Ici Pass ML » | Preuve sociale, acquisition locale | Pilote |
| Kit caisse | Tablette + support (B2), URL kiosque | Habitude redeem, pas le tel du vendeur | Actif |
| Carte Wallet | Pass dans Apple/Google Wallet | Réflexe « j’ai ML sur moi » | V1 Pass |
| Mur / coin partenaire | Mini présentoir goodies ou menu « Cadeaux quartier » | Destination IRL du sink Lumo | Actif+ |
| Borne / totem (plus tard) | Hardware dédié si volumes | Icône de quartier, pas gadget | Scale only |

**Effet recherché** : chaque commerce partenaire = un **point de contact ML**, comme un réseau de micro-lieux — pas une pub Meta. Ça renforce Habitué (raison de payer), le claim orga (« mes participants ont un Pass »), et la vente Insights (« on mesure le passage Pass »).

Garde-fou : densifier **d’abord** les partenaires et les redemptions ; les assets suivent le réseau, ils ne le précèdent pas (sinon CAPEX mort dans des vitrines vides).

### 5.1 Avant le service (une seule fois par appareil B)

1. Sur l’appareil B, ouvrir l’URL partenaire (favori ou scan de l’autocollant staff).
2. Se connecter (email partenaire + magic link / PIN).
3. Laisser la session ouverte / épingler l’onglet.
4. Chaque service : revenir sur cet onglet (ou rescanner l’autocollant staff si l’onglet a été fermé).

### 5.2 Scène type — Pass tampon (café offert)

| # | Appareil A (client) | Appareil B (commerce) | Système |
|---|---------------------|----------------------|---------|
| 1 | Entre, commande / dit « j’ai un Pass Moments Locaux » | Accueille | — |
| 2 | Ouvre ML → **Pass** (ou Wallet) : QR + code `ML-7K2P` + « Café offert » | Si besoin : ouvre la page « Valider » (favori ou autocollant staff) | — |
| 3 | **Tend A, écran allumé, luminosité haute**, QR face au staff | Prend B, **vise le QR affiché sur A** (comme un paiement QR). Si échec scan → tape `ML-7K2P` | Reçoit le code |
| 4 | Attend | Attend le résultat sur B | Vérifie Habitué+ · Pass `available` · non expiré · stock · partenaire autorisé |
| 5a | — | **Vert** : « OK — servir : Café offert » | Marque `redeemed` + horodatage + `partner_id` |
| 5b | — | **Rouge** : motif (déjà utilisé / expiré / …) | Pas de conso |
| 6 | Reçoit le café ; Pass passe à « Utilisé » dans l’app | Sert le cadeau ; encaissement normal du reste | — |

### 5.2bis Commande mixte — Pass / coupon **+** achat payant

Cas le plus fréquent : « un café offert **et** un croissant » (ou réduction −2 € sur une commande plus large).

**Principe** : Moments Locaux ne remplace pas la caisse. Le Pass/coupon gère **uniquement la ligne offerte / la remise** ; tout le reste passe par l’encaissement normal (espèces, CB, ticket resto…).

#### Ordre recommandé au comptoir

| # | Qui | Action |
|---|-----|--------|
| 1 | Client | Annonce **toute** la commande d’un coup : « Un café avec mon Pass + un croissant » |
| 2 | Staff | Note la commande comme d’habitude sur la **caisse du commerce** |
| 3 | Staff + client | **Valide le Pass/coupon** (scan §5.2) → écran vert = autorisation de servir / appliquer la remise |
| 4 | Staff | Sur la caisse : ligne cadeau à **0 €** (ou bouton « offre / gratuit ») **ou** ligne normale moins la remise affichée sur B |
| 5 | Staff | Encaisse **seulement** le reste (ex. croissant 1,20 €) |
| 6 | Staff | Sert le tout ensemble |

```
Commande client
   ├── Ligne Pass / coupon  →  validée sur appareil B (ML)  →  0 € ou −X €
   └── Autres lignes        →  caisse commerce               →  payé CB / espèces
```

#### Exemples

| Intention client | Sur B (ML) | Sur la caisse commerce | Client paie |
|------------------|------------|------------------------|-------------|
| Café offert seul | Vert « Café offert » | Ligne café 0 € (ou pas de ticket) | 0 € |
| Café offert + croissant | Vert « Café offert » | Café 0 € + croissant 1,20 € | 1,20 € |
| Remise −2 € sur formule 8 € | Vert « −2 € » | Formule 8 € − 2 € = 6 € | 6 € |
| Coupon Lumo « dessert » + café payant | Vert « Dessert offert » | Dessert 0 € + café 2,50 € | 2,50 € |

#### Règles métier

1. **Valider ML avant de servir le cadeau** — sinon risque de double usage si le client repart.
2. **Une validation = une ligne offerte / une remise** — pas de « solde Lumo » débité progressivement sur la caisse ; si le client a un 2ᵉ coupon, 2ᵉ scan.
3. **Le staff ne tape pas de prix ML dans l’app** — B dit seulement quoi offrir / quelle remise max ; la caisse du commerce reste source de vérité du ticket.
4. **Si la caisse n’a pas de bouton « gratuit »** : encaisser le payant normalement et servir le cadeau « à part » (même plateau) après le vert ML — le ticket ne montre que le payant (acceptable en pilote).
5. **Cumul** : Pass tampon + coupon Lumo le même passage = **deux scans** (deux rewards), si le partenaire l’autorise en annexe contrat ; défaut pilote = **1 reward ML / passage** pour rester simple.

#### Phrase type staff

> « Je vous prends le croissant en caisse, et je scanne votre Pass pour le café offert. »

Pas besoin d’intégration TPE/caisse en phase 1 : deux gestes séparés, un seul service au client.

### 5.3 Variante — Coupon Lumo IRL

Même hardware. Sur A, le client ouvre **Boutique → Mes cadeaux → coupon** (autre QR). B scanne ce QR-là.

### 5.4 Variante sans caméra (code court)

1. Sur A, le client lit le code sous le QR (`ML-7K2P`).
2. Sur B, le staff le saisit dans « Code Pass ».
3. Même validation → vert / rouge.

### 5.5 Ce que chaque écran montre

**A (client)** : titre du cadeau · QR · code court · validité · pas de bouton « me valider moi-même ».

**B (staff)** : bouton Scanner · champ code · puis vert + libellé du cadeau **ou** rouge + motif.

| Affiché sur B | Jamais sur B |
|---------------|--------------|
| Reward à servir | Nom, email, téléphone |
| OK / déjà utilisé / expiré | Check-ins, amis, GPS |
| Code court (saisie) | Solde Lumo |

### 5.6 Erreurs — phrase staff

| Écran B | Phrase |
|---------|--------|
| Déjà utilisé | « Ce Pass a déjà été utilisé — regardez ensemble dans l’app » |
| Expiré | « Il a expiré — il faudra 3 nouvelles sorties ce mois-ci » |
| Stock épuisé | « Plus de stock Pass aujourd’hui » |
| Invalide | « Code non reconnu — réaffichez le QR » |

### 5.7 Schéma

```
Prérequis (1× sur B) : connexion compte partenaire
                       + favori ou autocollant staff → /partner/scan

Au comptoir :
  A (client)   affiche QR Pass
  B (commerce) caméra → écran de A   OU   saisie code court
  API          valide + redeem
  B            vert → staff remet le cadeau
  A            Pass = Utilisé
```

Pas de TPE dédié ni intégration caisse en phase 1. Hardware = téléphone du commerce (B1) puis kit tablette kiosque (B2) si besoin — jamais de borne custom en pilote (voir §5.0bis).

---

## 6. Redemption & anti-fraude

| Acteur | Action | Règle |
|--------|--------|-------|
| User | Ouvre Pass / coupon → QR + code court | Habitué+ only ; code lié user + période + reward |
| Staff partenaire | Scan (page web) **ou** saisie code | Compte partenaire authentifié |
| Système | `redeemed` + `partner_id` + timestamp | 1 seul redeem ; TTL ; validation live obligatoire (pas « screenshot suffit ») |
| Ops ML | Litiges, stock, désactivation | WebConsole Partenaires Pass |

Abus : multi-comptes, farm check-in, codes partagés → caps check-in ADR 004 + alerte admin + blacklist partner/user.

---

## 7. Contrat partenaire (modèle 1 page)

À adapter juridiquement ; clauses métier minimales :

1. **Objet** — Accueil des titulaires Pass / coupons Moments Locaux contre rewards définis en annexe.
2. **Rewards** — Liste figée : titre, valeur faciale, stock/mois, jours et horaires d’accueil.
3. **Non-discrimination** — Servir tout titulaire présentant un Pass/coupon valide non expiré / non used.
4. **Fraude** — Refus si code déjà used ou expiré ; signaler les abus à ML sous 48 h.
5. **Données** — ML fournit des **agrégats** (nb redemptions / semaine). Aucune **PII** habitant (données personnelles identifiantes) transmise au partenaire.
6. **Durée** — 3 mois pilote renouvelable ; résiliation 15 jours.
7. **Communication** — Droit d’afficher « Partenaire Pass Moments Locaux » ; ML peut retirer le badge en cas de plaintes répétées.
8. **Argent** — Pilote : 0 € d’abonnement. Actif / Premium : abo listing. **Aucun remboursement du COGS** (coût de revient du cadeau servi) par Moments Locaux.
9. **Responsabilité** — Le partenaire reste responsable de la remise du cadeau IRL et de la conformité de son établissement.

Annexe type : tableau `reward_id` / titre / stock mensuel / Lumo price (si applicable) / Pass-eligible (oui/non).

---

## 8. Data & reporting partenaire

| Livrable | Contenu | Fréquence |
|----------|---------|-----------|
| Dashboard léger / mail | Redemptions Pass vs coupons Lumo ; jours/heures pics | Hebdo (pilote) puis mensuel |
| Insights footfall (Premium) | Agrégats zone (pas de trajectoires GPS individuelles) | Mensuel |

Lignes rouges : pas de liste nominative d’Habitués, pas de graphe social, pas de revente data.

---

## 9. Modèle data / tables (existant + extensions)

### Existant (LUMO-008)

- `partners` — fiche partenaire
- `partner_rewards` — titre, `stamps_required`, `data` jsonb, `active`
- `user_pass_progress` — `period_key`, `checkins_count`, `streak_unlocked`
- `user_partner_passes` — `redemption_code`, `status` (`available` \| `redeemed` \| `expired` \| `pending_partner`)
- RPCs : `get_my_pass_status`, `record_my_pass_progress`, `redeem_partner_pass`

### À ajouter (tickets)

| Besoin | Direction |
|--------|-----------|
| Scan staff | RPC `redeem_partner_pass_as_staff(p_code)` + auth partenaire |
| Coupons Lumo IRL | `shop_items` rayon IRL + table `partner_coupons` (one-shot) |
| Wallet passes | Génération Apple/Google Pass Kit / API ; refresh on status change |
| Stock | `fulfillment_type` + `stock_remaining` + réf. SKU ; export CSV redemptions T4 |
| Reporting | Vue admin + export compta partenaire (date, reward, qty, réf.) |

Ticket parent historique : `MVP-LUMO-008` (redemption IRL réelle + admin web).

---

## 10. Phasing

| Phase | Scope | Flag / livrable |
|-------|--------|-----------------|
| **0 — Schéma** | Tables + `get_my_pass_status` | Fait DEV ; redemption off |
| **1 — Pilote ville** | 3–8 partenaires · Pass tampon only · scan page web | `partner_pass_redemption_enabled=true` |
| **2 — Wallet** | Apple / Google Wallet + barcode | Après stabilité scan |
| **3 — Lumo IRL** | Catalogue cadeaux + coupons | Après ratio earn/spend 1.2–1.5 |
| **4 — Listing payant** | Tiers Actif / Premium | File d’attente partenaires ou ≥15 partenaires |

---

## 11. KPIs

| KPI | Cible indicative |
|-----|------------------|
| Partenaires live / ville pilote | ≥ 3 avant go Habitué store |
| % Habitués avec ≥1 redeem / 90 j | ≥ 25 % |
| Délai médian unlock Pass → redeem | &lt; 14 j |
| Taux fraude / codes invalides | &lt; 2 % des tentatives |
| COGS moyen partenaire / redeem | Suivi (santé relation) |
| Conversion Pilot → Actif (listing) | Mesurer après 3 mois |

---

## 12. Glossaire

### COGS (*Cost Of Goods Sold* — coût de revient)

C’est **ce que ça coûte au commerce de servir le cadeau**, pas le prix affiché au client.

Exemple : un café vendu 2,50 € au comptoir peut coûter ~0,40–0,80 € en grain/lait/gobelet. Ce ~0,40–0,80 € = **COGS**.  
Quand le partenaire offre un café via le Pass, **c’est lui qui assume ce coût**. Moments Locaux ne le rembourse pas (clause contrat). C’est acceptable en pilote parce que le COGS est bas et le client amené est qualifié (déjà sorti, Habitué, local).

### Déstockage

Action d’**enlever une unité de l’inventaire** du commerce (logiciel de caisse, inventaire, cahier). Obligatoire pour un produit emballé (canette, objet en boîte) ; souvent ignorée pour un café préparé. Si on offre sans déstocker, le stock comptable reste faux.

### PII habitant (*Personally Identifiable Information* — données personnelles identifiantes)

Données qui permettent d’**identifier une personne** : nom, email, téléphone, adresse, photo nette, identifiant compte, trajectoire GPS précise, etc.

Dans le modèle Pass, le partenaire voit seulement « ce cadeau est valide » — **pas** qui est Marie Dupont, ni son email. On lui donne des **agrégats** (« 42 Pass scannés cette semaine, pic samedi 11 h »), pas une liste de clients. C’est une exigence **RGPD** et de confiance produit.

| OK à partager au partenaire | Interdit |
|-----------------------------|----------|
| Nb de redemptions / jour | Nom, email, téléphone |
| Reward servi (type) | Solde Lumo d’un user |
| Horaires de pic (agrégés) | Liste des Habitués du quartier |
| Stock restant de *ses* rewards | Check-ins nominatifs, amis suivis |

### Autres termes utiles

| Terme | Sens |
|-------|------|
| **Redemption** | Utilisation / scan d’un Pass ou coupon chez le partenaire |
| **TTL** | Durée de validité avant expiration |
| **Agrégat** | Statistique de groupe (ex. « 30 personnes »), pas un individu |
| **Footfall** | Passage / fréquentation générée vers le commerce |

---

## 13. Liens

- [ADR_004 — Économie Lumo / Habitué](../decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md)
- [ADR_006 — Diffuseur B2B](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md) (frontière)
- [ADR_007 — Identité comptes](../decisions/ADR_007_ACCOUNT_IDENTITY_MODES.md)
- [OFFER_CATALOG_LUMO_SHOP.md](./OFFER_CATALOG_LUMO_SHOP.md)
- Migration : `supabase/migrations/20260727_lumo_earned_boost_and_partner_pass.sql`
- Service mobile : `src/services/pass.service.ts`
