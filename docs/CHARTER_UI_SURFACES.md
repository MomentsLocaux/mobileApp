# Charter UI surfaces checklist

Living checklist of mobile surfaces that must stay aligned with the light brand charter
(`src/constants/theme.ts`, website `docs/charte-graphique.md`).

**Rule for agents / humans:** when a charter / branding / “couleurs” request lands (bug report,
design tweak, or theme change), **walk this list** before closing the ticket. Add any new
surface you touch.

Tokens to prefer:

| Role | Token |
|------|--------|
| Screen fill | `colors.brand.page` |
| Cards / sheets | `colors.brand.surface` or `surfaceMuted` (avoid pure white for large panels on mint) |
| Body text | `colors.brand.text` (ink) |
| Muted text | `colors.brand.textSecondary` |
| Accent / CTA / spinners | `colors.brand.secondary` |
| Text on accent | `colors.brand.onAccent` |

Avoid dark ink sheets (`#121a1c`, `rgba(26,36,38,…)`), white-on-white chips, and hardcoded
`#0f1719` / `#334155` / `#122c33` on light UI.

## Surfaces (from 2026-08-05 moderation bugs + follow-ups)

| Surface | Path(s) | Watch for |
|---------|---------|-----------|
| Loading spinners | Shared `BrandLogoSpinner` on map bootstrap / discovery loading / staged progress / app bootstrap; compact inline actions keep `ActivityIndicator` | `BrandLogoSpinner` uses the transparent logo mark, counter-rotating leaf arcs and a soft halo; no legacy fill-mask disc or Lucide overlay |
| Shared button spinner | `src/components/ui/Button.tsx` | Spinner takes the `${variant}Text` color, so it stays legible on the leaf fill; never white on `brand.secondary` (SCRUM-68) |
| Create / preview publish CTA | `src/components/events/CreateEventStepper.tsx`, `app/events/create/preview.tsx`, `app/events/create/step-1.tsx`, `step-2.tsx`, `cover.tsx` | Leaf fill with `brand.onAccent` label, icon and spinner; not `#0f1719` (SCRUM-68) |
| Create / suggest stepper chrome | `src/components/events/CreateEventStepper.tsx`, `app/events/suggest-from-poster/index.tsx` | Close **X** + discard alert; **Continuer** identical on steps 1–3; Précédent / disabled CTA use surface tokens, not white-on-mint |
| Cover IA (generate step) | `src/components/events/CoverGenerateStep.tsx`, `CoverImageUploader`, `StagedProgressCard` | Tone chips surface/leaf; generate CTA leaf + `onAccent`; 2-try quota + candidate picker; hint under placeholder on step 1; staged loader (not a bare spinner) |
| Loading encarts (« on prépare… ») | `DiscoveryLoadingState`, `favorites` loading card, `ProposalLoadingState`, Home | Dark `rgba(26,36,38)` panels + ink text = unreadable; use `surface` / `surfaceMuted`; `BrandLogoSpinner` fill loop, no Lucide badge. Home paints a disk snapshot immediately (ADR 010); taxonomy badges may fill in a frame later. Full-screen / encart logo only when the list is empty and there is no snapshot |
| Poster / cover analysis timeline | `PosterAnalysisProgress`, `StagedProgressCard`, `app/events/suggest-from-poster/index.tsx` | Light `surface` card, leaf track + checks, ink percent; no dark skeleton or `#0f1719`; quota hint 2 analyses / suggestion |
| Bug report form | `app/bug-report.tsx` | Form panel / chips contrast |
| Contribution FAB | `src/components/events/ContributionFab.tsx`, `app/(tabs)/_layout.tsx` | Leaf fill, `onAccent` plus, mint border; draggable chat-head with throw inertia, then snap or peek on the left/right edge above the tab bar |
| Drawer logout | `app/(tabs)/_layout.tsx`, `app/(tabs)/profile.tsx` | Choice « Garder / Oublier cet appareil » before sign-out; not account deletion (SCRUM-71) |
| Settings hub | `app/(tabs)/settings/*`, `SettingsLayout` | Hidden tab (`href: null`) so the bottom tab bar stays visible, pinned to the screen bottom like the map (no nested-stack lift); scroll clears the overlay bar; Contribution FAB hidden on `/settings` |
| Mes suggestions | `src/screens/profile/MySuggestionsScreen.tsx` | Light cards + status chips; not dark ink sheets |
| Contribute sheet | `src/components/events/EventContributeSheet.tsx` | Light sheet + assistance row (bug reporter) |
| Photo communauté sheet | `src/components/events/EventPhotoContributionModal.tsx` | Same sheet tokens as “Y aller”: header `spacing.lg`, option rows 14/72 (SCRUM-80) |
| Event detail hero / actions / “Je note la date” | `src/screens/events/EventDetailScreen.tsx`, `PushButton`, `EventDetailSection`, `BrandIcon` | Entrée légère hero/header uniquement en translation GPU ; corps, stats et requêtes différés après l’animation. Pan UI simultané au ScrollView ; swipe down pour fermer depuis la carte **et** la liste Accueil (`origin=home-list`, modal transparente) ; la card source assure le cadrage final. Fiche tiroir (pas de 2ᵉ sheet carte) : photo en fond (~56 % / peek ~46 %), panneau `page` coins 28 px qui recouvre au scroll ; chrome X 34 px + compteur photos ; catégorie/tags/like/partage dans le tiroir (pastilles 34 px) ; titre compact (ville + chip, 2 lignes max) ; pastilles icône 34 px crayon / + / drapeau (correction, photo, signalement) — pas de libellés texte. Hero `Image` unique si une seule photo ; pas de `MotionReveal` sur un titre/cover déjà seedés (ADR 010). Horaires détaillés sous le déroulant du **bouton poussoir** calendrier (allumé / éteint) — à côté du bouton : dates seulement, pas d’heures ; pin lieu idem pour la mini-carte. Poussoirs 2.5D : tranche **3 px**, coins 15 px ; « Je note la date » **secondaire** (fond page) ; « J’y vais » **anis** pleine largeur sous le lieu. Icônes **B Duo végétal** (aplat menthe, contour ink). Cœur compteur dans le tiroir, même `EventHeartButton` dans les statistiques ; état occupé commun, respect de la réduction des animations |
| Event detail similar events | `EventDetailScreen`, `EventMiniatureCarousel`, `useSimilarEvents` | Section « Vous aimerez peut-être » en bas de fiche : 3 miniatures, fetch après le premier paint (`InteractionManager`), spinner leaf `ActivityIndicator` seulement si la section est visible et encore vide |
| Event detail / echoes | `EventDetailScreen`, `EventEchoesPreview`, `EchoCommentCard`, `EventEchoesScreen` | Carousel surface + peek, étoiles `#FBBF24`, « Il y a… », avatar/nom/ville ; pill « Afficher les X commentaires » `surfaceMuted` ; liste dédiée même chrome, onglets/input mint (pas de verre sombre) ; bandeau Avis / Photos orga / Photos communauté en **carrousel horizontal** (dernière pastille entièrement visible) |
| Home latest-added carousel | `HomeScreen`, `EventMiniatureCarousel` | Miniatures au-dessus de « Pour vous », mêmes critères que le fil ; cover + titre seulement (pas de date) pour rester compact ; contour cover = couleur de catégorie (`getCategoryColor`) |
| Favorites map | `app/(tabs)/favorites.tsx`, `FavoritesMapView` | Toggle liste/carte surface + leaf ; images = registre `map-marker-assets` + repli `CategoryEventMarker` (mêmes images que Découvrir) ; tap → preview `MapEventUnitOverlay` / `EventCard` `map-preview` ; pas de CircleLayer leaf |
| Favorites header | `favorites.tsx`, `SlidingSegmentedControl` | Entête compact : titre `h4`, search 44 mint, chips période `FilterChip` `xs` ; Événements/Suivis = radio glissant leaf/`onAccent`, pas de verre sombre |
| Mon agenda | `src/screens/agenda/AgendaScreen.tsx`, `AgendaWeekStrip`, `AgendaBucketRow`, `AgendaEventRow`, `AgendaEmptyIllustration` | Sheet/tab mint : strip semaine disque leaf, swipe horizontal pour changer de semaine, seaux cœur/pin/home/calendar, empty line-art (pas Lucide 28 px). Liste d’un seau = `MapDiscoveryEventCard` row (même carte que la bottom sheet Découvrir). CTA découverte ; « Créer une activité » seulement si `FEATURE_EVENT_CREATE`. « Je participe » seulement si `FEATURE_CHECKIN`. |
| Messages in-app | `src/screens/messages/*`, `MapChromeActions` | Inbox/thread `surface` + bulles leaf/`onAccent` ; entrée carte pastilles 44. Pas de verre sombre. |
| Visibilité du profil | `src/screens/settings/ProfileVisibilityScreen.tsx`, `CommunityProfileScreen` | Public/privé comme la visibilité position ; badge privé mint ; CTA Message outline |
| Notifications inbox | `NotificationsInboxScreen`, `SlidingSegmentedControl` | Toutes / Non lues = radio glissant leaf/`onAccent`, pas de pills plates ni verre sombre |
| Community member search | `CommunityScreen`, `CommunityMemberCard` | Même carte/search que Ma communauté : `surface`, CTA Suivre/Suivi leaf/`onAccent`, search 44 mint, ville + `MapPin` (+ zone) ; pas de verre sombre |
| Platform organizer sheet | `src/components/events/EventPlatformOrganizerSheet.tsx` | Light sheet; claim CTA « Vous êtes l’organisateur ? Nous écrire » only when organizer is Moments Locaux (SCRUM-36); opens the website contact form prefilled (`intent=diffuseur` + titre) ; copy agenda vs suggestion communautaire |
| Correction / doublon sheet | `src/components/events/EventCorrectionSheet.tsx` | Sheet bg + inputs + CTA leaf + duplicate candidate rows (SCRUM-120 / SCRUM-156) |
| Navigation (“Y aller”) sheet | `src/components/search/NavigationOptionsSheet.tsx` | Sheet bg + close + option rows |
| Proposal wizard | `src/screens/proposals/ProposalWizard.tsx` | Category colors (not all leaf); geocode / radius chips |
| Proposal deck distance chip | `src/screens/proposals/ProposalSwipeDeck.tsx` | Contrast on photo overlay |
| Create / suggest location picker | `src/components/events/LocationPickerModal.tsx` | Light outline « Localiser » next to the address field + surface map FAB; GPS fills address and flies the camera (SCRUM-45) |
| Suggestion / create location preview | `EventPreviewMiniMap`, `app/events/create/preview.tsx` | Pin as Mapbox CircleLayer; Camera `defaultSettings` + `onDidFinishLoadingMap` so Nyons is not Africa; map sits above the submit footer |
| Community follows (Ma communauté) | `app/community/follows.tsx`, `CommunityMemberCard`, `SlidingSegmentedControl` | Radio glissant leaf « Ceux qui me suivent / Ceux que je suis » (compact) ; cartes `surface` + CTA Suivre / Suivre aussi ; search 44 mint ; ville + `MapPin`, pas de mini-carte par ligne ; empty states invite / découverte membres ; pas de verre sombre |
| Contact assistance | `app/contact.tsx` | Light settings form, leaf CTA, closed subjects matching website |
| Map unit overlay close / heart | `EventHeartButton`, `MapEventUnitOverlay`, `EventCard`, `EventDetailScreen` | Cœur canonique 34 px / glyphe 19 px issu de la card individuelle, partagé par toutes les fiches ; petite croix **haut-droit** sur la card individuelle. Like : rebond 420 ms, halo et 6 éclats 480 ms, ignorés si réduction des animations |
| Brand icons / tabs / drawer | `BrandIcon`, `brand-icon-artwork`, `app/(tabs)/_layout.tsx`, `UiReliefFixture` | Famille SVG locale Duo végétal (pas Lucide sur onglets, tiroir, poussoirs, cœur). Fixture visuelle sans données utilisateur |
| Map discovery sheet / Les moments à découvrir | `SearchResultsBottomSheet`, `MapDiscoveryHeader`, `MapDiscoveryEventCard` | Duo végétal ; carrousel « Les moments à découvrir », visuels carrés, tampon de période en haut à droite (jour unique + horaire, sinon début → fin comme la liste Accueil), tarif sur image, titre/avatars/silhouette 2.5D de catégorie (`map-marker-assets`, sans teinte ni Lucide)/like/partage dessous. Liste : image carrée gauche (140 px, 124 px sur petit écran), contenu de même hauteur à droite, même tampon de période en haut, actions en bas ; silhouette de catégorie seule. Like et partage : pastilles outline **34 px** (`EventHeartButton` + `EventShareButton`, fond `page`, filet `neutral[200]`) — cœur + compteur, icône share + « Partager » ; petit écran : share icône seule, libellé accessible. Chaque événement (Spotlight et liste) est enveloppé comme la liste Accueil : fond `surfaceMuted`, filet 1 px `neutral[200]`, coins `EVENT_CARD_RADIUS`. Tarif près des avatars sur petit écran. Compteurs élevés abrégés visuellement, valeur exacte accessible. **Aucun encart invitation**. Sélection = 3 publiés classés par pertinence dans la zone filtrée ; tris Nouveautés/Distance indépendants. Reprise bornée de scroll ; glissement horizontal ne doit pas replier la sheet. |
| EventCard (listes + overlay map) | `EventCard`, `EventResultCard`, Home, favoris, aperçu individuel carte, `EventsListScreen` | Même corps `map-preview` : cover 220, titre, ligne date calendrier, lieu ; pas de panneau DÉBUT/FIN ni description. Preuve sociale d’une ligne sous le lieu : avatars suivis (max 3) + likes / « Aimé par Léa », `Soyez le premier à aimer` si 0 like, et `N échos` si `comments_count` ≥ 1. Liste Accueil : pastille **Partager** (`EventShareButton`, même 34 px outline) à droite de cette ligne, `Share.share` via `sharePublishedEvent`. Badge catégorie = label taxonomie / slug visuel, jamais l’UUID. Vues / check-ins restent sur la fiche. |
| EventCard social proof | `EventCard`, `EventDetailScreen` | Cartes : RPC déjà fetchées (`get_event_public_stats`, `get_event_liker_previews`). Fiche : compteur cœur + sheet likers + « Aimé par vos suivis ». |
| Community peer profile | `src/screens/community/CommunityProfileScreen.tsx` | Sans `eventCreate` : pas de galerie/stat/liste « ses événements » ; identité + Suivre/Signaler + Followers/Suivis + carte « Dans la communauté ». Surfaces mint/surface, pas de chips glass sombre |
| Map markers | `CategoryMarkerImages`, `map-marker-assets`, `CategoryEventMarker` | Dix silhouettes 2.5D PNG transparentes, sans pin ni disque ; dominante = couleur actuelle de chaque catégorie. Registre exhaustif partagé Découvrir/Favoris ; repli inconnu = symbole collectif sans pin. Pastilles de clusters et leurs couleurs conservées (MAP-MARKERS-001) |
| Map selected marker | `MapWrapper`, `FavoritesMapView` | Sélection = agrandissement de la même image, silhouette ancrée au centre ; hitbox de source 48 × 48, y compris la sélection ; aucun halo `CircleLayer` |
| Map user-location puck | `src/components/map/MapWrapper.tsx` | Keep the native `LocationPuck`; React `UserLocation` heading layers race with style reloads |
| Map location/error banners | `app/(tabs)/map.tsx` | Light surface, readable status text and accessible retry/settings actions |
| Map search-area CTA / wide-area warning | `app/(tabs)/map.tsx` | Leaf CTA + small cancellation hint; amber warning is a tappable button that tightens the camera |
| Map viewport refine / filters | `src/components/search/MapFiltersSheet.tsx` | Full-screen sheet (not the compact overlay). Leaf chips, `Réinitialiser` / `Enregistrer`, Reduce Motion skips enter/exit. `MapViewportRefinePanel` is unused on the map. |
| Map sheet motion / tab bar / loading | `app/(tabs)/map.tsx`, `MapWrapper`, `SearchResultsBottomSheet`, `MapAwareTabBar`, `MapEventUnitOverlay`, `EventDetailScreen` | Drag et snap 100 % UI thread ; recadrage sheet réversible (ancre peek snapshot + bounds brutes, jamais de bounds inset) ; padding caméra single plafonné (`SHEET_CAMERA_PADDING_MAX_RATIO`) ; overlay ne republie pas les bounds ; loader plein écran seulement s’il n’y a pas de snapshot disque (ADR 010), sinon pins d’hier tout de suite ; peek : uniquement `ActivityIndicator` leaf pendant le fetch (pas de compteur périmé, pas de skeleton peek ni BrandLogoSpinner) ; cycle pin→card sur une shared value avec chevauchement ; fiche map = page glissée (translateY + opacity, pas de morph) ; tab bar dès 15 % de progression sheet ; snap par projection d’inertie ; haptic au relâchement worklet ; ouverture fiche/card depuis EventCache (cover prefetch au pressIn / items visibles, pas de skeleton si l’événement est déjà connu) ; liste Home/sheet triée sur tout le set puis peinte par 50, page suivante près du bas, total N inchangé (footer `ActivityIndicator` leaf) ; filtres = `MapFiltersSheet` plein écran (la sheet liste ne redescend plus au peek) ; le resize de colonne conserve le snap courant |
| Event covers (cards / hero / carousel / propositions) | `EventCoverImage`, `EventCard`, `EventImageCarousel`, `PlaceMediaGallery`, `ProposalSwipeDeck` | `expo-image` `memory-disk` + `recyclingKey` + même `cacheKey` URI liste/fiche ; decode liste 400 px ; prefetch des items visibles seulement. Fallback `Image` RN tant que le module natif n’est pas lié |
| Event photo viewer (tap peek / hero) | `PlaceMediaGallery` Modal | Ouvert depuis le peek de la fiche tiroir (`openHero`) ; header sous la safe area (`insets.top + spacing.md`) ; onglets Organisateur/Communauté **centrés** ; croix à droite, même hauteur 40 ; photo `contain` dans l’espace restant ; compteur au-dessus de l’home indicator |
| SearchBar modal text fields (Où / Quoi) | `src/components/search/SearchBar.tsx` | Framed mint inputs (`inputFramed`); not ghost white-on-white placeholders. Overlay: fade + translateY (not pill morph); Reduce Motion skips the motion |
| Map navigation / style controls | `app/(tabs)/map.tsx` | Back arrow left of SearchBar; satellite toggle reste derrière la sheet lorsqu’elle est levée et derrière la card individuelle |
| Onboarding category cards | `src/components/onboarding/OnboardingThemesStep.tsx` | Borders `#334155`; select-all |
| Onboarding text fields | `src/screens/onboarding/OnboardingScreen.tsx`, `OnboardingConnectorStep.tsx` | No `lineHeight` on `TextInput`; extra bottom padding so descenders (g/p/y) are not clipped |
| Onboarding / profile avatars | `AvatarPresetPicker`, `PresetAvatarArt`, `UserAvatar`, `OnboardingScreen`, `ProfileEditScreen` | 20 portraits cartoon vectoriels mint/leaf, contours souples, coiffures distinctes et ombres légères ; cadrage circulaire dès le SVG, lisible en miniature ; mêmes identifiants `preset:<id>` ; case Photo et skip onboarding conservés ; rendu partagé profil / communauté / commentaires / notifications / preuves sociales |
| Avatar editor | `AvatarEditorModal`, `AvatarPresetPicker`, `PresetAvatarArt` | Modal claire `brand.page`, aperçu fixe, catégories défilantes, choix visuels et palettes ; sélection leaf + coche, footer safe area ; aperçu compact sur petit écran ; annuler conserve le portrait parent ; « Utiliser cet avatar » applique un `avatar:v1:` validé, enregistré par le parcours profil/onboarding existant (AVATAR-001) |
| Lumia chat | `src/screens/lumia/LumiaChatScreen.tsx` | Flag off = hidden; light bubbles, leaf send — no dark glass |
| Lumia first-run tour | `src/components/lumia/LumiaTourOverlay.tsx` | Light surface card, leaf CTA, ink text — not a dark glass sheet |
| Profile edit identity row | `src/screens/profile/ProfileEditScreen.tsx` | Hide “Profil : Particulier”; home location uses `LocationPickerModal` + leaf outline GPS CTA |
| Community invite | `CommunityScreen`, `app/community/follows.tsx` | Header “Inviter un ami” (Membres) + icône `UserPlus` sur Ma communauté |
| Organizer avatar fallback | `src/constants/branding.ts` + assets | Keep in sync with app icon |
| App / store icon | `assets/images/icon.png`, `icon-meta-1024.png`, `app.config.ts`, native AppIcon | Rebuild after asset change |
| Welcome email | `docs/email-templates/` + Brevo | Out-of-app; still charter-bound |

## When closing a charter bug

1. Fix the reported surface.
2. Grep nearby siblings for the same dark-sheet / hardcode pattern.
3. Tick or extend this table if a new surface was involved.
4. Run `npm run typecheck` and `npm run lint`.
