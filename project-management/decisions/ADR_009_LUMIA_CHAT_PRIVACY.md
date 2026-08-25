# ADR 009 - Lumia chat privacy (SCRUM-100)

## Status

Accepted — 2026-08-25.

## Context

SCRUM-100 requires a GDPR-minded posture for Lumia: retention, logs, export, and user-facing mentions when the chat flag is on.

## Decision

1. **No server-side chat transcript.** Messages live in the mobile screen state only for the current session. Closing the screen discards history.
2. **Quota counters only.** Table `lumia_chat_usage` stores `user_id`, `period_ym`, `request_count` — never message text.
3. **Logs.** Edge Function operational logs must not include user message bodies or full LLM prompts/responses. Status codes / short error codes only.
4. **OpenAI (or equivalent) as processor.** Question text is sent for the duration of the API call to produce a grounded answer; Moments Locaux remains controller for the product purpose (in-app help + published-event search).
5. **Account export.** Chat history is **out of scope** of export because it is not persisted. Documented in privacy policy and Lumia legal doc.
6. **User-facing copy.** Privacy policy always describes Lumia when the feature may be enabled; CGU appends a Lumia section when `FEATURE_LUMIA_CHAT` is true in the build.

## Consequences

- No chat history table, no cross-user memory, no prompt injection surface via shared history.
- Product may later add optional opt-in history only with a new ADR + retention policy.
- Legal texts remain product-aligned drafts pending human/legal validation where required.
