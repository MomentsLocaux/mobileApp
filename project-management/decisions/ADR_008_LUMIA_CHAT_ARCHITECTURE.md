# ADR 008 - Lumia Chat Architecture (MVP)

## Status

Accepted — 2026-08-25 (product validation SCRUM-97).

## Context

Lumia is the in-app assistant for Moments Locaux (flag `FEATURE_LUMIA_CHAT`). Early implementation mixed:

- system prompt (behavior),
- documentary RAG (knowledge),
- ad-hoc SQL / stop-word heuristics for events,

without a clean agent/tools model. That caused incoherent answers (e.g. greeting → Partenaire) and made the system harder to reason about than a Custom GPT.

Industry practice for reliable chatbots:

1. **System prompt** = role, tone, hard limits  
2. **Knowledge (RAG)** = stable product docs  
3. **Tools** = live business data (APIs)  
4. **Guardrails + golden eval** = precision & coherence over time  

## Decision

MVP Lumia follows a **minimal agent** model (Custom-GPT mental model, API-hosted):

```
User message
  → classify / route (lightweight)
  → tools and/or RAG as needed
  → LLM answers from tool results + retrieved docs only
  → validate event_ids ⊆ tool output
```

### Layer 1 — System prompt (behavior)

Single source in Edge Function `lumia-chat` (versioned in git).

Owns: identity, tutoiement, refus (médical / illégal / fiction / billetterie), “n’invente pas”, JSON contract.

Does **not** own long product copy (Partenaire, RGPD paths, etc.).

### Layer 2 — Knowledge pack (RAG)

SSOT: `content/lumia/docs/*.md`  
Ingest → embeddings → retrieve top passages with a **strict** similarity threshold.

Owns: how the app works, legal orientation, offers without invented prices, B2B copy aligned to public website.

### Layer 3 — Tools (live data) — MVP set

Exactly **two** tools for MVP:

| Tool | Purpose | Returns |
|---|---|---|
| `app_help` | Optional fast-path for known usage intents (or rely on RAG alone) | Short grounded answer / doc ids |
| `search_events` | Natural-language search over **published** events only | Real `event_id`s + display fields |

`search_events` is the **only** source of event IDs. No inventing events from the LLM.

Out of MVP: multi-tool agents, CMS non-dev, full conversation memory across sessions, pgvector-in-DB (optional later — draft migration exists).

### Layer 4 — Guardrails

- Greetings / empty / pure chitchat → fixed welcome (no RAG, no tools).  
- Low RAG confidence → “reformule” (no filler topic).  
- Output: `event_ids` filtered to tool results.  
- Soft quota (SCRUM-103) when migration applied.
- **Deeplinks** : Markdown `[label](/path)` + `actions[]` chips, allowlisted only (`lumia-deeplinks`).

### Layer 5 — Golden eval

Ten fixed questions (`content/lumia/golden-questions.md`) must pass before treating Lumia as operational. Re-run after prompt/doc/tool changes.

## Mapping to tickets (SCRUM-96)

| Layer | Tickets |
|---|---|
| Spec / this ADR | SCRUM-97 |
| Shell + flag | SCRUM-60 |
| Edge orchestration | SCRUM-99 |
| Knowledge pack | SCRUM-104 |
| In-app help (usage) | SCRUM-102 |
| `search_events` quality | SCRUM-59 |
| Guardrails | SCRUM-98 |
| Quota | SCRUM-103 |
| RGPD chat logs | SCRUM-100 → ADR 009 |
| Entry points | SCRUM-101 (carte) |

## Consequences

- Stop treating stop-word SQL as the “brain”; tools replace DIY matching as the source of truth for events.  
- Prompt stays short; product truth lives in Markdown.  
- Coherence is measured by golden questions, not gut feel.  
- Custom GPT remains a valid **mental model**; production stays in-app (auth, quota, real events, flag).

## Non-goals (MVP)

- Admin moderation via chat  
- Ticket sales  
- Inventing unpublished / future events  
- Replacing onboarding tour (SCRUM-43 / 50 / 55) — complementary, not the same surface  
