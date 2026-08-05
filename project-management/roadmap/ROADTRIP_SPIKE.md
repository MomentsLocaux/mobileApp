# Roadtrip — étapes 1–4/4

Branche : `feat/roadtrip-planner` · Flag : `EXPO_PUBLIC_FEATURE_ROADTRIP` (défaut : désactivé)

## Étape 4 — livrée (UX finale spike)

- **Timeline** : résultats groupés par journée (date locale de passage) puis par tronçon / étape (`roadtrip-timeline.ts`).
- **Saisie libre** : départ / étape / destination via presets + géocodage Mapbox (`RoadtripPlaceField`, `place,locality`).
- **Empty states** : avant recherche, après recherche sans résultat (pistes d’ajustement), connexion pour sauvegarder.
- **Accessibilité** : rôles/labels sur actions principales, chips, cartes, recherche et switch.

## Étape 3 — livrée (persistance)

Appliqué sur **moments-locaux-dev** uniquement :

| Migration | Contenu |
| --- | --- |
| `roadtrip_candidates_rpc` | RPC corridor PostGIS |
| `events_location_sync` | trigger + backfill `events.location` |
| `roadtrip_persistence` | tables `roadtrips` / `roadtrip_stops` / `roadtrip_events` + RLS owner-only |
| `roadtrip_stops_event_id` | colonne `event_id` sur les étapes `kind='event'` |

Côté app :

- `RoadtripService` — list / getDetail / saveSnapshot / archive (aucune écriture favoris).
- Ajout au programme → l’événement devient une étape, recalcul Directions + horaires.
- Conflit si l’arrivée destination bouge de ≥ 20 min → confirmation utilisateur (pas de modification silencieuse).
- Reprise des brouillons sauvegardés depuis `/roadtrip`.
- Tests RLS owner/non-owner : **11/11 pass** (transaction rollback, aucune donnée laissée).

## Étape 2 — livrée

- **RPC PostGIS `list_roadtrip_event_candidates`** (`supabase/migrations/20260815_roadtrip_candidates_rpc.sql`, **non appliquée — validation humaine requise**) : corridor `ST_DWithin` sur `events.location` (index GIST existant `idx_events_location`), fenêtre temporelle globale du voyage, catégories (uuid[]), gratuit uniquement. Paramètres bornés : corridor 500 m → 15 km, fenêtre ≤ 14 jours, limite ≤ 300, tracé ≤ 1000 points, géométrie validée. SECURITY DEFINER aligné sur `list_map_viewport` (ne retourne que du published + public).
- **Client** (`src/services/roadtrip/roadtrip-candidates.service.ts`) : RPC d'abord (tracé downsamplé à 800 points max), **fallback automatique** sur le fetch bbox du spike si la RPC n'est pas déployée — l'écran fonctionne sur tous les environnements. Le calcul fin (heures de passage par tronçon, fenêtres de présence, classement) reste dans le moteur client testé.
- **Catégories dans l'UI** : chips depuis la taxonomie (`event_category`) + « Tout sélectionner » ; filtrage serveur (uuid) et re-vérification moteur (uuid + slug, comme Propositions).
- **Détour précis** : appel Directions réel (départ tronçon → événement → fin tronçon) déclenché uniquement pour le candidat sélectionné, mis en cache ; affiché comme « Détour réel (Mapbox) » à côté de l'estimation heuristique.

## Ce que fait le spike

Écran accessible uniquement via `/roadtrip` quand le flag est actif (sinon redirection vers la carte, aucune entrée visible dans l'app) :

1. Choix départ / étape facultative / destination parmi des villes présélectionnées, heure de départ ajustable (±1 h / ±1 j).
2. Appel Mapbox Directions (profil `driving`, `geometries=geojson`, `steps=true` pour obtenir une géométrie **par tronçon**), mis en cache par itinéraire.
3. Planification des tronçons : départ de chaque tronçon = arrivée du précédent + temps passé à l'étape (2 h forfaitaires dans le spike).
4. Récupération des événements dans la bbox du tracé élargie du corridor (viewport RPC existante, limite 300).
5. Moteur pur côté client : corridor géographique, heure de passage estimée, fenêtre de présence, compatibilité temporelle, exclusions obligatoires, score déterministe.
6. Carte (tracé + points) et liste de résultats expliqués (« Sur votre route · détour estimé +12 min », « À 3,1 km de votre étape à Reims »…). Actions : ouvrir la fiche, masquer. **Rien n'est persisté.**

## Calcul des heures de passage

- Projection de l'événement sur la polyligne du tronçon (projection équirectangulaire locale, précise à l'échelle d'un corridor routier).
- `heure de passage = départ du tronçon + durée du tronçon × progression sur le tracé` (progression par distance, proxy raisonnable de la progression temporelle sur un tronçon).
- Fenêtre de présence : `passage − 15 min → passage + temps minimum sur place + 15 min` (marges parking/marche).
- Autour d'une étape : fenêtre = arrivée → départ déclarés.
- Compatibilité : `début événement ≤ fin de présence ET fin événement ≥ début de présence`, avec exclusion explicite des événements terminés à l'heure de passage.

## Classement (déterministe, sans ML)

`0,40 × compatibilité horaire + 0,30 × détour + 0,20 × catégories + 0,10 × qualité (visuel, description, lieu, catégorie)`.

Exclusions dures : non publié, non public, sans coordonnées, terminé au passage, hors corridor, détour > budget, payant si « gratuit uniquement ».

## Heuristiques assumées du spike (à raffiner en étape 2)

| Heuristique | Valeur spike | Raffinement prévu |
| --- | --- | --- |
| Détour estimé | aller-retour à 45 km/h vol d'oiseau | Directions réel pour le top N / à l'ajout au programme |
| Largeur de corridor | budget détour ÷ 2 × 45 km/h (10 min → 3,75 km ; 40 min → 15 km) | idem |
| Temps à l'étape | 2 h forfaitaires | saisie arrivée/départ par étape (UI complète) |
| Progression sur tronçon | par distance | par durée cumulée des steps Mapbox |
| Catégories | non branchées dans l'UI spike (moteur prêt) | sélecteur + « Tout sélectionner » |

## Limites détectées

1. **Volume d'événements** : la bbox d'un Paris→Lyon élargie de 15 km est énorme ; la limite de 300 du viewport RPC peut tronquer silencieusement le pool. C'est **l'argument décisif pour la RPC PostGIS `list_roadtrip_event_candidates`** (corridor `ST_DWithin` sur la géométrie du tracé + fenêtres temporelles côté SQL, limite stricte).
2. **Timezone** : les heures sont calculées en local device / ISO UTC ; OK France métropolitaine, à valider si multi-fuseaux.
3. **Trafic** : durées Mapbox sans trafic (`driving`), pas `driving-traffic` — acceptable pour une planification à J+n.
4. **Bbox vs corridor** : le préfiltre bbox inclut des zones loin du tracé sur les diagonales ; le moteur corrige, mais on paie le fetch. La RPC corridor supprime ce gaspillage.
5. **Événements « Horaire à confirmer »** : le moteur porte un indicateur `timeConfirmed`, l'UI spike l'affiche, mais la saisie « date sans heure » n'existe pas encore.

## Coûts Mapbox estimés

- **1 requête Directions par itinéraire distinct** (cache mémoire par coordonnées arrondies à ~11 m). Modifier préférences/date ne redéclenche pas d'appel ; modifier le tracé, si.
- Free tier Directions : 100 000 req/mois. À 5 recalculs de tracé par session de planification, ≈ 20 000 sessions/mois gratuites.
- Étape 2 ajoutera ~N appels « détour précis » par ajout au programme (1 requête par événement ajouté) : négligeable.
- Aucune autre API Mapbox appelée par le spike (la carte utilise les tuiles déjà comptées par l'app).

## Modèle de données final proposé (étape 3 — migrations livrées non appliquées)

```sql
create table public.roadtrips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  transport_mode text not null default 'driving' check (transport_mode = 'driving'),
  departure_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roadtrip_stops (
  id uuid primary key default gen_random_uuid(),
  roadtrip_id uuid not null references public.roadtrips(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('origin','stop','destination','event')),
  label text not null,
  latitude double precision not null,
  longitude double precision not null,
  arrival_at timestamptz,
  departure_at timestamptz,
  unique (roadtrip_id, position)
);

create table public.roadtrip_events (
  roadtrip_id uuid not null references public.roadtrips(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  leg_index int not null,
  planned_arrival_at timestamptz,
  planned_duration_minutes int,
  estimated_detour_minutes int,
  status text not null default 'planned' check (status in ('planned','removed')),
  primary key (roadtrip_id, event_id)
);
```

- RLS propriétaire uniquement sur les 3 tables : `(select auth.uid()) = user_id` (jointure via `roadtrip_id` pour stops/events). Aucune service_role côté client.
- RPC `list_roadtrip_event_candidates(route geometry, corridor_m int, windows jsonb, categories text[], free_only bool, max_results int)` : `security invoker`, paramètres bornés (corridor ≤ 15 000 m, max_results ≤ 100), filtre `status='published' and visibility='public'`, index GIST sur `events.location`.
- Aucune coordonnée de voyage dans les analytics.

## Fichiers du spike

| Fichier | Rôle |
| --- | --- |
| `src/config/features.ts` | flag `roadtrip` (défaut off) |
| `app/roadtrip/_layout.tsx` + `index.tsx` | route gardée par le flag |
| `src/screens/roadtrip/roadtrip.types.ts` | types partagés (réutilisables tels quels en étape 2/3) |
| `src/screens/roadtrip/roadtrip-geo.ts` | haversine, projection sur polyligne, corridor, détour |
| `src/screens/roadtrip/roadtrip-schedule.ts` | heures de passage, fenêtres de présence, planification des tronçons |
| `src/screens/roadtrip/roadtrip-engine.ts` | exclusions + score + classement (pur, sans I/O) |
| `src/screens/roadtrip/roadtrip-candidate-fetch.ts` | pool d'événements bbox élargie |
| `src/services/roadtrip/mapbox-directions.service.ts` | Directions isolé + cache |
| `src/screens/roadtrip/RoadtripSpikeScreen.tsx` + `RoadtripSpikeMap.tsx` | UI spike |
| `src/screens/roadtrip/*.test.ts` | 18 tests unitaires (géo, horaires, moteur) |

## Checklist de test manuel

1. Flag absent/false → `/roadtrip` redirige vers la carte, aucune entrée visible. ✅ attendu
2. `EXPO_PUBLIC_FEATURE_ROADTRIP=true` + restart Metro → `/roadtrip` affiche le formulaire.
3. Paris → Caen, samedi 9 h : tracé cohérent sur la carte, résumé km/durée plausible (~240 km, ~2 h 45).
4. Ajouter l'étape Rouen : le tracé passe par Rouen, les événements autour de Rouen dans la fenêtre 2 h apparaissent avec « À X km de votre étape à Rouen ».
5. Chaque résultat affiche détour estimé et heure de passage ; « Masquer » retire la carte et le point.
6. Détour 10 → 40 min : le nombre de candidats augmente (corridor élargi).
7. « Gratuits uniquement » : les événements payants disparaissent.
8. Trajet sans événements (nuit, campagne) : empty state explicite.
9. Discovery, carte et favoris inchangés (aucun code partagé modifié).

## Suite proposée

- ~~**Étape 2** : RPC PostGIS corridor + catégories UI + détour précis~~ ✅
- ~~**Étape 3** : persistance + RLS + reprise + conflits à l'ajout~~ ✅ (DEV only)
- ~~**Étape 4** : timeline, empty states, a11y, saisie libre~~ ✅

Spike complet. Prochains chantiers hors spike : entrée navigation produit (quand flag MVP), tests E2E, raffinement détour précis top-N automatique, saisie d’horaires d’étape libres.

## Checklist étape 2 (après application de la migration en dev)

1. Appliquer `20260815_roadtrip_candidates_rpc.sql` sur le projet **dev** uniquement, après validation.
2. Relancer une recherche : le warn `[roadtrip] corridor RPC unavailable` ne doit plus apparaître dans Metro.
3. Comparer les résultats avec/sans RPC sur un même trajet : mêmes événements dans le corridor (l'ordre final vient du moteur client).
4. Sélectionner des catégories : le pool retourné rétrécit (filtre serveur) et les propositions restent cohérentes.
5. Taper sur un candidat : « Détour réel (Mapbox) » apparaît ; re-taper le même candidat ne redéclenche pas d'appel (cache).
6. Vérifier qu'un trajet > 14 jours de fenêtre est refusé par la RPC (exception explicite).
