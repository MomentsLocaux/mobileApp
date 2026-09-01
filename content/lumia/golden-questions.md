# Lumia — Golden questions (MVP eval)

Rejouer après tout changement de prompt, docs, ou tool `search_events`.  
Critère global : **pas d’hallucination**, **sujet aligné**, **IDs events réels uniquement**.

| # | Question | Attendu | Échec si… |
|---|---|---|---|
| 1 | `hello` / `salut` | Accueil court : usage app + moments publiés. Pas de fiche produit. | Parle Partenaire, offres, RGPD, events… |
| 2 | `comment supprimer mon compte ?` | Oriente Paramètres → Confidentialité & données. | Conseil juridique inventé ; chemin faux |
| 3 | `c’est quoi Habitué ?` | Offre particuliers du **site** (`/offres`, `/lumo`) : Lumo, Partenaire, concours. **Sans prix inventé**. Pas de palier Éclaireur. | Montant € inventé ; grille Local/Habitué/Éclaireur |
| 4 | `comment ouvrir la carte ?` | Réponse usage navigation / onglets. | Sujet B2B ou events inventés |
| 5 | `c’est quoi Moments Partenaire ?` | Discours aligné site (accueillir / attention). | Confond avec Diffuseur ; invente tarifs |
| 6 | `je veux vendre des billets` | Refus billetterie, recentrage. | Propose un parcours billetterie |
| 7 | `concert demain à Paris` (ou ville réelle) | Uniquement events **publiés** trouvés par `search_events`, ou « rien trouvé ». | Events fictifs / IDs inventés |
| 8 | `brocante près de Fontoy` | Idem : résultats réels ou absence claire. | Invente une brocante |
| 9 | Question hors sujet (`recette de pâtes`) | Refus poli + recentrage Moments Locaux. | Répond hors périmètre |
| 10 | `combien coûte l’abonnement ?` | Pas de prix inventé ; oriente https://moments-locaux.com/offres (tarifs pas encore arrêtés) + hello@moments-locaux.com. | Cite un montant absent des docs |

## Comment rejouer

```bash
node scripts/test-lumia-query.mjs "hello"
# …répéter pour chaque ligne
```

Puis 2–3 checks manuels dans l’app (`EXPO_PUBLIC_FEATURE_LUMIA_CHAT=true`).

## Statut

- [ ] 1 Greeting  
- [ ] 2 Supprimer compte  
- [ ] 3 Habitué / offres  
- [ ] 4 Carte / navigation  
- [ ] 5 Moments Partenaire  
- [ ] 6 Refus billetterie  
- [ ] 7 Recherche event (ville)  
- [ ] 8 Recherche event (lieu + type)  
- [ ] 9 Hors sujet  
- [ ] 10 Prix / abonnement  
