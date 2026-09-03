# ADR 009 - Lumia chat privacy (SCRUM-100)

## Status

Accepted — 2026-08-25, amended 2026-09-03 (SCRUM-155 : historique local appareil).

## Context

SCRUM-100 requires a GDPR-minded posture for Lumia: retention, logs, export, and user-facing mentions when the chat flag is on.

## Decision

1. **No server-side chat transcript.** Messages are not stored in Supabase. They may live on the device (screen + local store) so the conversation remains usable after leaving the chat screen. Full sign-out and account deletion wipe that local history.
2. **Quota counters only.** Table `lumia_chat_usage` stores `user_id`, `period_ym`, `request_count` — never message text.
3. **Logs.** Edge Function operational logs must not include user message bodies or full LLM prompts/responses. Status codes / short error codes only.
4. **OpenAI (or equivalent) as processor.** Question text (and a short in-memory history sent with the request) is processed for the duration of the API call to produce a grounded answer; Moments Locaux remains controller for the product purpose (in-app help + published-event search). History is not written to a chat table.
5. **Account export.** Chat history is **out of scope** of export because it is not persisted server-side. Documented in privacy policy and Lumia legal doc.
6. **User-facing copy.** Privacy policy always describes Lumia when the feature may be enabled; CGU appends a Lumia section when `FEATURE_LUMIA_CHAT` is true in the build.

## Consequences

- No chat history table, no cross-user memory, no prompt injection surface via shared history.
- Product may later add optional **server-side** opt-in history only with a new ADR + retention policy. Device-local history (SCRUM-155) is allowed without a chat table.
- Legal texts remain product-aligned drafts pending human/legal validation where required.
