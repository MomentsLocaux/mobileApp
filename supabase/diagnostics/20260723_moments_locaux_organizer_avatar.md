# Moments Locaux organizer avatar (Storage seed)

Platform organizer avatar for events without a creator (imported / aggregated).

- Bucket: `avatar` (public-read)
- Path: `branding/moments-locaux-organizer.png`
- Public URL: `{SUPABASE_URL}/storage/v1/object/public/avatar/branding/moments-locaux-organizer.png`

Upload (service role) from repo root:

```bash
curl -X POST "$SUPABASE_URL/storage/v1/object/avatar/branding/moments-locaux-organizer.png" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary @assets/images/icon.png
```

Status:

- DEV (`prymkgkafaovhzopslea`): seeded 2026-07-23
- UAT: upload required when promoting
