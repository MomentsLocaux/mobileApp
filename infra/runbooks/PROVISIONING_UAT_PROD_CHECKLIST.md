# Checklist provisionning UAT / PROD — ce que toi tu dois cliquer

**Date :** 7 septembre 2026  
**Epic :** [SCRUM-157](https://moments-locaux.atlassian.net/browse/SCRUM-157)  
**Périmètre :** actions **consoles / identités / DNS / billing**. Le code, les migrations, les env Vercel une fois les projets créés, l’agent peut les faire.

**Règle d’or :** pour un env donné, mobile + console + scrapper + site pointent le **même** projet Supabase.

GCP n’héberge rien. Le scrapper cible un **VPS** ([SCRUM-86](https://moments-locaux.atlassian.net/browse/SCRUM-86), Hetzner ou équivalent). GCP n’apparaît que via **Firebase / FCM** (push Android).

---

## Hostnames cibles

| Env | Site (Vercel) | Console (Vercel) | Monitor scrapper (Node / VPS) | Supabase |
| --- | --- | --- | --- | --- |
| DEV | `dev.moments-locaux.com` (hors scope E12) | `admin.dev.moments-locaux.com` (déjà en place) | `scrapper.dev.moments-locaux.com` | `moments-locaux-dev` (`prymkgkafaovhzopslea`) |
| UAT | `staging.moments-locaux.com` | `admin.staging.moments-locaux.com` | `scrapper.staging.moments-locaux.com` | **nouveau** projet (tuer le clone `ieehuzeotwagkkprohjr`) |
| PRD | `moments-locaux.com` + `www` | `admin.moments-locaux.com` | `scrapper.moments-locaux.com` | à créer (`moments-locaux-prd`) |

Autres TLD (`.fr` / `.app` / `.net` / `momentslocaux.com`) → redirect **apex PRD seulement**.

---

## Ordre des clics

1. Meta Live + Bitwarden (Vague 0)
2. Nouveau projet **Supabase UAT** + secrets + Auth / SMTP / Facebook
3. Projets **Vercel** site UAT + console UAT → DNS OVH
4. Recette UAT (login console, contact site, Facebook)
5. Même dance **PROD**
6. VPS + DNS scrapper (peut glisser, c’est E11)
7. Firebase FCM + EAS preview quand tu veux du TestFlight sur la nouvelle UAT

---

## Vague 0 — maintenant, en parallèle

### Meta (Facebook Login)

Lien apps : [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/)

- [ ] Ouvrir l’app Moments Locaux
- [ ] **Facebook Login → Settings** : coller  
      `https://prymkgkafaovhzopslea.supabase.co/auth/v1/callback`
- [ ] **Use Cases → Authentication** : `email` + `public_profile` prêts
- [ ] **Settings → Basic** : nom d’affichage `Moments Locaux`, icône, URL  
      Politique : `https://moments-locaux.com/privacy`  
      Contact : `hello@moments-locaux.com`
- [ ] Passer l’app **Live**
- [ ] Tester « Continuer avec Facebook » avec un compte **qui n’est pas** admin / testeur
- [ ] Plus tard (custom domain UAT/PROD) : **ajouter** les nouveaux callbacks **avant** d’activer le domaine, ne pas remplacer le DEV

#### Retrouver le compte qui a créé l’app

Rien dans le repo (Git, `.env`, Bitwarden templates) ne stocke l’e-mail Facebook. L’**App ID** est dans Supabase, pas le login Meta.

1. Ouvre le provider Facebook DEV :  
   [Authentication → Providers → Facebook](https://supabase.com/dashboard/project/prymkgkafaovhzopslea/auth/providers)  
   Copie l’**App ID** (chiffres). Le Secret reste dans le dashboard, ne le colle nulle part en clair.
2. Connecte-toi à Meta avec **chaque** e-mail probable, dans cet ordre :
   - perso Gmail (`rauyer.romain@gmail.com`)
   - `r.rauyer@moments-locaux.com` / `hello@moments-locaux.com` s’il existe un compte Facebook dessus
   - tout autre Facebook perso utilisé en 2025–2026
3. Après login : [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/) — l’app doit apparaître. Si la liste est vide, **mauvais compte**.
4. Cherche dans la boîte mail (toutes) : `developers.facebook.com`, `Your Facebook app`, `Meta for Developers` — surtout autour de **juin 2026** (social login ajouté au MVP) et **novembre 2025** (création projet DEV).
5. Cherche dans **Bitwarden** : `Facebook`, `Meta`, `developers`.
6. Si un **Meta Business Manager** existe : [business.facebook.com](https://business.facebook.com) → Paramètres → Applications.
7. Dernier recours : depuis l’App ID, Facebook Support / « I lost access to my app » — ou recréer une app Meta neuve, recoller App ID / Secret dans Supabase DEV, et jeter l’ancienne. Moins grave que perdre PROD plus tard.

Le compte Meta **n’est pas** le login Supabase. Deux identités différentes.

### Bitwarden

- [ ] 3 coffres : `Supabase DEV` / `UAT` / `PRD`
- [ ] Par coffre : URL, anon, service_role, DB password, SMTP Brevo, tokens monitor, Mapbox
- [ ] Jamais de `service_role` dans une variable `VITE_*` / `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*`

### Jira / Confluence

- [ ] Travailler dans [SCRUM-157](https://moments-locaux.atlassian.net/browse/SCRUM-157)
- [ ] Après recette : Confluence [07 — Ops](https://moments-locaux.atlassian.net/wiki/spaces/ML/pages/557097)

---

## Vague 1 — bases (bloque tout le reste)

### Supabase — UAT ([SCRUM-169](https://moments-locaux.atlassian.net/browse/SCRUM-169))

- [ ] Décider : UAT actuel **jetable** (sinon export avant)
- [ ] Dashboard : **créer** `moments-locaux-uat` (région `eu-west-1`), **pas** un reset du clone `ieehuzeotwagkkprohjr`
- [ ] Noter le **nouveau ref** + mot de passe DB
- [ ] Auth → URL Configuration :  
      Site URL `https://admin.staging.moments-locaux.com`  
      Redirects : `https://admin.staging.moments-locaux.com/**`, `https://staging.moments-locaux.com/**`, `moments-locaux://**`, `http://localhost:5173/**`
- [ ] Auth → Facebook : **Enabled**, mêmes App ID / Secret que DEV
- [ ] Auth → Google / Apple : mêmes clients OAuth que DEV (si déjà configurés)
- [ ] Auth → SMTP : Brevo, From `ne-pas-repondre@moments-locaux.com`
- [ ] Auth → Rate Limits : remonter après SMTP custom
- [ ] Pause puis **delete** de l’ancien `ieehuzeotwagkkprohjr` **après** bascule
- [ ] Copier les 4 secrets dans Bitwarden UAT

Replay migrations / Edge Functions / buckets : agent, une fois le projet créé et le ref collé dans le chat.

### Supabase — PROD ([SCRUM-159](https://moments-locaux.atlassian.net/browse/SCRUM-159)) — après UAT OK

- [ ] Créer `moments-locaux-prd` (`eu-west-1`), **zéro copie** de données DEV/UAT
- [ ] Activer **backups / PITR** (plan Pro déjà là)
- [ ] Auth URLs : apex + `admin.moments-locaux.com` + `moments-locaux://**`
- [ ] SMTP Brevo, Facebook / Google / Apple, Bitwarden `Supabase PRD`
- [ ] Seed : **ton** compte admin réel (pas un user de test)
- [ ] Custom domain Auth `api.moments-locaux.com` (add-on, 1 par projet) — **ou** dette écrite avant store

### Brevo

- [ ] Vérifier que `moments-locaux.com` est **Authenticated** (SPF / DKIM / DMARC déjà posés en DEV)
- [ ] Une clé **SMTP** (`xsmtpsib-…`) → Supabase Auth UAT puis PRD
- [ ] Une clé **API** (`xkeysib-…`) → formulaires site Vercel UAT puis PRD (**pas** la même que SMTP)
- [ ] Sender `ne-pas-repondre@moments-locaux.com` / `Moments Locaux`
- [ ] `CONTACT_TO` = `hello@moments-locaux.com` (Zimbra), pas l’adresse Auth

### OVH DNS ([SCRUM-158](https://moments-locaux.atlassian.net/browse/SCRUM-158))

Poser les records **quand** Vercel / VPS donnent la cible. TTL bas le temps de la propagation.

| Record | Type | Cible |
| --- | --- | --- |
| `staging` | CNAME | `cname.vercel-dns.com.` |
| `admin.staging` | CNAME | `cname.vercel-dns.com.` |
| `admin` | CNAME | `cname.vercel-dns.com.` |
| apex + `www` | selon Vercel | site PRD |
| `scrapper.dev` / `scrapper.staging` / `scrapper` | CNAME ou A | **VPS**, pas Vercel |
| `.fr` / `.app` / `.net` / `momentslocaux.com` | redirect | **apex PRD seulement** |
| Custom domain Auth (plus tard) | CNAME + TXT ACME | projet Supabase |

### OVH Zimbra

- [ ] Boîte `hello@moments-locaux.com` (support + contact site)
- [ ] Boîte ops si besoin (`r.rauyer@…` déjà citée pour les rapports scrape)
- [ ] **Ne pas** envoyer l’Auth SMTP depuis Zimbra — ça reste Brevo
- [ ] Vérifier que Zimbra n’écrase pas le SPF Brevo (un seul SPF, avec `include` Brevo)

---

## Vague 2 — sites UAT, puis PRD

### Vercel

**1 projet Vercel par couple app × env.** Ne pas accrocher `admin.staging` au projet DEV.

- [ ] Projet **site UAT** → repo website, branche `main`, domaine `staging.moments-locaux.com`
- [ ] Projet **console UAT** → repo console, `admin.staging.moments-locaux.com`
- [ ] Pareil en **PRD** (apex + `www`, `admin.moments-locaux.com`)
- [ ] Env Production collées depuis Bitwarden
- [ ] **Password protection** sur console UAT (et PRD tant que ce n’est pas public)
- [ ] `SITE_INDEXABLE=false` partout jusqu’au go-live public ; console **toujours** noindex

Tickets : [SCRUM-160](https://moments-locaux.atlassian.net/browse/SCRUM-160) · [SCRUM-161](https://moments-locaux.atlassian.net/browse/SCRUM-161) · [SCRUM-162](https://moments-locaux.atlassian.net/browse/SCRUM-162) · [SCRUM-163](https://moments-locaux.atlassian.net/browse/SCRUM-163)

### GitHub

- [ ] Accès org / repos pour Vercel (GitHub App installée sur website + console)
- [ ] Plus tard VPS (E11) : deploy key ou user SSH, **pas** le service-role dans GitHub Actions en clair
- [ ] Vérifier que `.env` / `.env.uat` restent gitignorés

---

## Vague 3 — scrapper (Node, pas Vercel)

Hébergement = VPS de [SCRUM-86](https://moments-locaux.atlassian.net/browse/SCRUM-86).

- [ ] Commander / pointer le VPS UE (Hetzner ou équivalent)
- [ ] DNS `scrapper.{dev,staging,}moments-locaux.com` → cette machine
- [ ] HTTPS (Caddy) + **pas** de port 8787 nu
- [ ] 3 process (DEV / UAT / PRD), 3 tokens monitor **différents**, Bitwarden
- [ ] Basic auth Caddy **en plus** du token, surtout UAT / PRD
- [ ] Clés sources (Datatourisme, OpenAgenda, etc.) recopiées sur le VPS, mode `600`

Tickets : [SCRUM-164](https://moments-locaux.atlassian.net/browse/SCRUM-164) · [SCRUM-165](https://moments-locaux.atlassian.net/browse/SCRUM-165) · [SCRUM-166](https://moments-locaux.atlassian.net/browse/SCRUM-166) · [SCRUM-167](https://moments-locaux.atlassian.net/browse/SCRUM-167)

---

## Autres consoles (mobile + OAuth + push)

Pas bloquant pour le **site** UAT. Bloquant pour TestFlight / store.

### Google Cloud / Firebase (le « GCP » réel)

- [ ] Projet Firebase existant, package Android `com.momentslocs.app`
- [ ] `google-services.json` à jour (déjà dans le repo)
- [ ] **FCM V1** : clé de compte de service GCP → `eas credentials` pour `development`, `preview`, `production`
- [ ] Google Cloud Console → OAuth client « Moments Locaux » : Authorized redirect URIs = callbacks Supabase DEV **et** UAT **et** PRD (`https://<ref>.supabase.co/auth/v1/callback` + custom domain le jour J)
- [ ] Écran de consentement Google : nom, logo, privacy `moments-locaux.com`

### Apple

- [ ] Developer → Identifiers : Sign in with Apple sur le bundle
- [ ] App Store Connect : app, TestFlight (EAS `preview` = UAT)
- [ ] Services ID / Return URLs Apple = mêmes callbacks Supabase que ci-dessus
- [ ] Plus tard store : fiche, screenshots, privacy nutrition labels — **hors** E12

### Expo / EAS

- [ ] `eas secret:create` (ou dashboard) profil **preview** → nouvelles clés UAT
- [ ] Plus tard profil **production** → clés PRD
- [ ] Rebuild Android après FCM ; iOS après changement d’entitlements

### Mapbox

- [ ] Tokens : public mobile, download SDK, geocoding console / scrapper (URL restrict UAT/PROD quand les domaines existent)

### OpenAI

- [ ] Même clé (ou une dédiée) en secret Edge Function **sur UAT et PRD** (`OPENAI_API_KEY`)

### Sentry

- [ ] Projet + DSN si crash reporting store. DSN prévu, SDK **absent** de l’app. Hors chemin critique web UAT.

### APIs scrapper (optionnel par source)

- [ ] Datatourisme, OpenAgenda, Tourism-system, Apidae, Tourinsoft : clés recopiées sur le VPS UAT/PRD. Pas de nouveau compte sauf quota.

---

## Recette transversale ([SCRUM-168](https://moments-locaux.atlassian.net/browse/SCRUM-168))

### UAT

- [ ] Site staging : pages + contact / waitlist → tables UAT
- [ ] Console `admin.staging` : login modo, file pending, pas de switcher
- [ ] Collecte → `scrapper.staging` (CORS + token)
- [ ] Monitor UAT : 1 run `--ingest-limit` petit → données UAT
- [ ] Mobile preview / `.env.uat` : même URL Supabase

### PRD

- [ ] Même checklist sur apex / `admin` / `scrapper` / projet PRD
- [ ] `SITE_INDEXABLE` toujours false tant que go-live public non décidé
- [ ] Console + monitor toujours noindex
- [ ] Ancien ref `ieehuzeotwagkkprohjr` absent des docs / Bitwarden

---

## Références

- `mobileApp/infra/urls/ENVIRONMENT_URLS.md`
- `mobileApp/infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md`
- `mobileApp/infra/runbooks/PUSH_NOTIFICATIONS.md`
- `Moments-Locaux-Scrapper/docs/ENV_CHECKLIST.md`
- `mobileApp/docs/GIT_AND_ENVIRONMENTS.md`
