# Brand & Auth e-mail legitimacy (Brevo + Supabase)

Goal: Auth e-mails (signup, reset, magic link) leave from **your** domain, not Supabase’s default sandbox, and eventually OAuth sheets show a clean host.

**Scope today:** Brevo sender + DNS (SPF/DKIM/DMARC) + Supabase custom SMTP on **DEV only**.  
**Same Brevo account** can later power UAT/PROD SMTP without a second Brevo org.  
**Later:** SMTP on UAT, Auth custom domain (`auth.moments-locaux.com`), CAPTCHA, PROD project.

Related: `docs/notifications/CHANNELS.md`, `infra/urls/ENVIRONMENT_URLS.md`.

---

## Target addresses

| Use | Address | Notes |
| --- | -------- | ----- |
| Auth (Supabase SMTP From) | `ne-pas-repondre@moments-locaux.com` | No accents in the local part (deliverability). Stick to this address. |
| Display name | `Moments Locaux` | Shown in inbox |
| Support / privacy (in-app copy) | `contact@moments-locaux.com` | Zimbra OVH or Brevo — separate from Auth SMTP |
| Marketing (later) | Prefer another subdomain / From | Do **not** mix with Auth reputation |

Canonical domain for sending: **`moments-locaux.com`** (not `.app` / `.fr` redirects).

---

## Phase A — Brevo (once)

1. Create / open [Brevo](https://app.brevo.com) account.
2. **Senders & IP** → **Domains** → add `moments-locaux.com`.
3. Brevo shows DNS records (typically):
   - **Brevo code** / verification TXT or CNAME
   - **DKIM** CNAME(s)
   - **SPF** include (or Brevo’s SPF guidance)
   - Optional **DMARC** TXT on `_dmarc`
4. In **OVH** → Web Cloud → `moments-locaux.com` → **Zone DNS** → add exactly those records.
5. Wait until Brevo marks the domain **Authenticated** / green (can take minutes to hours).
6. Create a **Sender**: `ne-pas-repondre@moments-locaux.com`, name `Moments Locaux`, verify if asked.
7. **SMTP & API** → SMTP:
   - Host: usually `smtp-relay.brevo.com`
   - Port: `587` (STARTTLS) — preferred
   - Login: Brevo SMTP login (often your account e-mail)
   - Password: **SMTP key** (generate; store in Bitwarden — never commit)

Official Brevo SMTP help: [Send transactional emails using Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

---

## Phase B — Supabase custom SMTP (per project)

Do this first on **`moments-locaux-dev` only**. Repeat later for UAT with the same Brevo SMTP credentials.

Dashboard: **Authentication → Emails → SMTP Settings**  
(or project Auth config → enable Custom SMTP)

| Field | Value |
| ----- | ----- |
| Enable custom SMTP | On |
| Sender e-mail | `ne-pas-repondre@moments-locaux.com` |
| Sender name | `Moments Locaux` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Brevo SMTP login |
| Password | Brevo SMTP key |

Save. Then raise Auth **rate limits** (default after custom SMTP is still conservative, e.g. ~30/h until you raise it):  
**Authentication → Rate Limits**.

### Smoke test

1. In the mobile app (or Dashboard → Users → Invite / reset): trigger **password reset** or **signup confirm** to an address you control.
2. Confirm From = `Moments Locaux <ne-pas-repondre@moments-locaux.com>`.
3. Check Brevo → **Transactional** / logs for delivery.
4. If fail: Supabase Auth logs + Brevo blocked/bounce.

---

## Phase C — Brand legitimacy checklist (beyond SMTP)

| Item | When | Action |
| ---- | ---- | ------ |
| SPF / DKIM / DMARC | With Phase A | Via Brevo domain auth on OVH DNS |
| Auth e-mail templates | After SMTP works | Dashboard → Auth → Email Templates — French, short, no marketing fluff |
| Auth custom domain | Before store PROD | e.g. `auth.moments-locaux.com` CNAME → Supabase (Pro). Fixes ugly iOS OAuth sheet host. See `ENVIRONMENT_URLS.md` |
| Separate marketing sender | If newsletters | Different From / subdomain so Auth reputation stays clean |
| CAPTCHA on Auth | Before public signup | Supabase Auth CAPTCHA (bots burn SMTP reputation) |
| Apple / Google OAuth consoles | Ongoing | App name “Moments Locaux”, privacy URLs on `moments-locaux.com` when live |
| `contact@` mailbox | Soon | OVH Zimbra or Brevo — already referenced in app legal copy |

---

## What this agent cannot do for you

- Log into Brevo or create your SMTP key
- Add DNS records in OVH without your session
- Paste SMTP passwords into the repo

Paste here (redact password) when Phase A is done: domain status in Brevo + SMTP host/port/user — then we can double-check the Supabase form field-by-field.

---

## Bitwarden entries to create

- `Brevo` — login + SMTP key  
- `Supabase SMTP` — note which projects use custom SMTP (DEV now; UAT/PROD later)  
- Keep domain DNS screenshots optional

---

## Why Brevo at all?

Today, without custom SMTP, Supabase uses its **default sandbox mailer** (team addresses only, ~2 msgs/hour). Useless for real signup/reset tests.

Brevo = **transactional Auth e-mail only** (confirm, reset, magic link).  
It is **not** used for mobile push (Expo → APNs/FCM). See `docs/notifications/CHANNELS.md`.

If Brevo was created earlier and never wired to Supabase SMTP, it was unused until this setup.
