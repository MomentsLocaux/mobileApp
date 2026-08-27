# 07 — Ops & runbooks

| Métadonnée | Valeur |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-08-27 |
| **Audience** | Eng, release, support technique |
| **Hub** | `mobileApp/infra/` + checklists multi-repo |

---

## 1. Environnements

Les envs = **projets Supabase**, pas des branches Git.

| Env | Projet | Rôle |
|---|---|---|
| DEV | `moments-locaux-dev` (`prymkgkafaovhzopslea`) | Dev quotidien |
| UAT | `moments-locaux-uat` (`ieehuzeotwagkkprohjr`) | QA / TestFlight |
| PROD | plus tard | Store |

Hosts cibles : site `dev.` / `staging.` / apex · console `admin.*` · mobile → Supabase + scheme `moments-locaux://`.

Détail : [`infra/urls/ENVIRONMENT_URLS.md`](../infra/urls/ENVIRONMENT_URLS.md)  
Checklist multi-repo : Scrapper [`docs/ENV_CHECKLIST.md`](../../Moments-Locaux-Scrapper/docs/ENV_CHECKLIST.md)

**Règle d’or** : mobile + console + scrapper doivent pointer le **même** projet Supabase pour un env donné.

---

## 2. Secrets

| Où | Quoi |
|---|---|
| Bitwarden | URL, anon, service_role, DB password, Mapbox, Brevo SMTP, monitor tokens |
| Local | `.env` / `.env.uat` (gitignored) ; templates `.env.example` |
| Jamais | `EXPO_PUBLIC_*` / `VITE_*` avec service role |

---

## 3. Push notifications

Runbook : [`infra/runbooks/PUSH_NOTIFICATIONS.md`](../infra/runbooks/PUSH_NOTIFICATIONS.md)

```
INSERT notifications
  → trigger trg_notifications_push_dispatch (pg_net)
  → Edge push-dispatch
  → Expo Push → APNs / FCM
```

Checklist par env :

1. Migrations push appliquées  
2. `app_config.supabase_project_url` (scripts `supabase/ops/app_config/{dev,uat}.sql`)  
3. Edge `push-dispatch` déployée + vault `push_dispatch_secret`  
4. Smoke INSERT → device  

Debug : logs Edge · `net._http_response` · prefs quiet hours / budget · tokens `device_push_tokens` · FCM V1 EAS Android.

**Email ≠ push** : Brevo Auth SMTP seulement pour signup/reset.

---

## 4. Email marque (Brevo)

Runbook : [`infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md`](../infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md)

| Usage | Adresse |
|---|---|
| Auth SMTP From | `ne-pas-repondre@moments-locaux.com` |
| Support copy | `hello@moments-locaux.com` |
| Contact site | Brevo API (server actions website) |
| Digests scrape | SMTP scrapper optionnel (ops) |

DNS SPF/DKIM/DMARC sur `moments-locaux.com` ; SMTP custom Supabase (DEV d’abord, puis UAT).

---

## 5. Mapbox

| Surface | Variable |
|---|---|
| Mobile maps | `EXPO_PUBLIC_MAPBOX_TOKEN` |
| Native download | `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` |
| Console geocode | `VITE_MAPBOX_TOKEN` |
| Scrapper geocode | `MAPBOX_ACCESS_TOKEN` |

---

## 6. Monitor scrapper / Collecte

| Scrapper | Console |
|---|---|
| `MONITOR_API_TOKEN` / `MONITOR_MODERATOR_TOKEN` | `VITE_SCRAPER_MONITOR_URL` + `VITE_SCRAPER_MONITOR_TOKEN` |
| `npm run monitor` | `/moderation/collecte` |

Sans monitor up, Collecte est morte ; la file events reste lisible via Supabase.

---

## 7. Releases & vérifs

| Surface | Commandes / checks |
|---|---|
| Mobile | `npm run typecheck` · `npm run lint` · EAS profiles `development` / `preview` |
| Console | `npm run build` · `npm run docs:sync` |
| Scrapper | `npm test` · `docs/RELEASE_CANDIDATE.md` |
| Migrations Supabase | **Jamais** sans validation humaine |

---

## 8. Incidents fréquents

| Symptôme | Pistes |
|---|---|
| Pas de push | Voir runbook § Debugging |
| Console mauvais env | Badge DEV/UAT ; remount Auth |
| Collecte 401/CORS | Tokens + `MONITOR_CORS_ORIGINS` |
| Auth emails spam | SPF/DKIM Brevo + SMTP Supabase |
| Map vide | Token Mapbox · RPC `list_map_viewport` · events `published` |

---

## Historique

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-08-27 | Vue section Confluence ML §07 |
