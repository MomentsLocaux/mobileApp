# Base documentaire Lumia

Base de connaissances **prod** pour le chatbot Lumia (RAG sémantique).

## Source produit validée (site web)

Le **copy public validé** pour Partenaire / Diffuseur / Acteurs locaux vit dans le repo site :

`~/Projects/moments-locaux-website/src/messages/fr.json`

Namespaces : `offers`, `lumo`, `partenaires`, `diffuseur`, `acteurs`, `roadmap.fork`.

**Quand le site est mis à jour :** aligner les fiches Lumia correspondantes dans `content/lumia/docs/` (`04-offres.md`, `12-lumo-gamification-v2.md`, `14-*`, `15-*`, `16-*`), puis ingest + deploy.

Ne pas s'appuyer sur les roadmaps internes (`PARTNER_PASS_MODEL.md`, ADR) pour le discours Lumia **public** — réservé au technique / ops sauf mention explicite dans une fiche.

## Contenu

| Dossier / fichier | Rôle |
|---|---|
| `docs/*.md` | Fiches produit (source éditoriale) |
| `../supabase/functions/lumia-chat/rag-chunks.json` | Chunks + embeddings (généré, ne pas éditer à la main) |

## Marche à suivre — ajouter ou modifier une fiche

### 1. Éditer ou créer un Markdown

- Emplacement : `content/lumia/docs/`
- Nommage : `NN-sujet-court.md` (ex. `08-signalements-support.md`)
- **Frontmatter obligatoire** en tête du fichier :

```markdown
---
id: guide-mon-sujet
title: Titre lisible
category: usage | legal | offers | policy | social | events
---

# Titre

Corps en prose claire, tutoiement ou vouvoiement cohérent avec le reste (aujourd’hui : tutoiement côté Lumia).
```

**Categories :**
- `usage` — navigation, paramètres, comment faire
- `legal` — CGU, RGPD, confidentialité (orientation, pas conseil juridique)
- `offers` — Habitué / Diffuseur / Partenaire (copy **site** `/offres`), sans prix inventé
- `policy` — limites de Lumia, hors sujet, pas de billetterie
- `social` — membres, follow, invite
- `events` — découverte, favoris, recherche de moments

**Règles rédactionnelles :**
- Décrire **ce qui existe dans l’app aujourd’hui**, pas la roadmap sauf section « si flag activé »
- Indiquer le **chemin UI** (ex. Paramètres → Confidentialité & données)
- **Ne jamais** inventer de prix, de dates légales ou de features absentes du build MVP
- Pour les features V1/V2 : préciser « disponible seulement si activé dans le build »
- **Partenaire / Diffuseur / B2B** : fiches `14-moments-partenaire.md`, `15-moments-diffuseur.md`, `16-acteurs-locaux.md` (alignées site web) ; orienter hello@moments-locaux.com si hors fiche
- Contact support / privacy : `hello@moments-locaux.com`

### 2. Ingérer (embeddings OpenAI)

Prérequis : `OPENAI_API_KEY` dans `.env` (crédits API).

```bash
node scripts/ingest-lumia-rag.mjs
```

Le script :
- lit tous les `docs/*.md`
- découpe en chunks (~700 caractères)
- appelle `text-embedding-3-small`
- écrit `supabase/functions/lumia-chat/rag-chunks.json`

Coût typique : quelques centimes par ingest (dépend du volume).

### 3. Déployer l’Edge Function

```bash
npx supabase functions deploy lumia-chat --project-ref prymkgkafaovhzopslea
```

Sans redeploy, le serveur garde l’ancienne version des chunks.

### 4. Tester dans l’app

```bash
# .env
EXPO_PUBLIC_FEATURE_LUMIA_CHAT=true
```

Restart Metro. Poser des questions **proches** et **lointaines** du libellé des fiches pour valider la recherche sémantique.

Exemples :
- « comment supprimer mon compte ? » → fiche RGPD
- « c’est quoi Habitué ? » → fiche offres
- « concert demain » → events DB (pas la doc)

### 5. (Optionnel) pgvector en base

Migration draft : `supabase/migrations/20260824_lumia_doc_rag_pgvector.sql`

**Ne pas appliquer sans validation humaine.** Tant qu’elle n’est pas appliquée, les chunks voyagent dans `rag-chunks.json` au deploy.

---

## Architecture cible

Voir [ADR 008](../../project-management/decisions/ADR_008_LUMIA_CHAT_ARCHITECTURE.md) : prompt + RAG docs + tools (`search_events`) + golden eval.

Éval obligatoire : [golden-questions.md](./golden-questions.md).

## Checklist avant merge

- [ ] Fiche relue (pas de prix / promesse non validée)
- [ ] `node scripts/ingest-lumia-rag.mjs` OK
- [ ] Deploy `lumia-chat` sur dev
- [ ] Golden questions (au moins 1, 2, 5, 7) OK
- [ ] Ticket Jira SCRUM-96 / SCRUM-104 / SCRUM-97 mis à jour si changement de scope

---

## Architecture rappel

```
docs/*.md  →  ingest  →  rag-chunks.json  →  Edge Function lumia-chat
                              ↑                      ↓
                         embeddings            OpenAI chat + events DB
```

Lumia **ne répond pas** de mémoire générale : elle s’appuie sur les extraits retrouvés + events publiés.

## Fichiers liés (code)

| Fichier | Rôle |
|---|---|
| `supabase/functions/lumia-chat/index.ts` | Orchestration RAG + LLM |
| `supabase/functions/lumia-chat/rag.ts` | Similarité cosinus |
| `scripts/ingest-lumia-rag.mjs` | Pipeline ingest |
| `src/services/lumia-chat.service.ts` | Client mobile |
| `src/config/features.ts` | Flags produit (MVP vs V1/V2) |

## Évolution future

- Appliquer migration pgvector + script d’upsert DB (éviter gros JSON au deploy)
- Lier export données quand l’écran `/settings/privacy/export` sera implémenté
- CMS ou Notion → export Markdown si l’équipe non-dev doit éditer
