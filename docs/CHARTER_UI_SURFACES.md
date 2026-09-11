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
| Loading spinners | `BrandLogoSpinner` on Home / Favoris / Membres / tab bootstrap; other `ActivityIndicator` keep `colors.brand.secondary` | No Lucide overlay on the discovery loader; legacy `primary[600]` / `#0f1719` |
| Shared button spinner | `src/components/ui/Button.tsx` | Spinner takes the `${variant}Text` color, so it stays legible on the leaf fill; never white on `brand.secondary` (SCRUM-68) |
| Create / preview publish CTA | `src/components/events/CreateEventStepper.tsx`, `app/events/create/preview.tsx`, `app/events/create/step-1.tsx`, `step-2.tsx`, `cover.tsx` | Leaf fill with `brand.onAccent` label, icon and spinner; not `#0f1719` (SCRUM-68) |
| Create / suggest stepper chrome | `src/components/events/CreateEventStepper.tsx`, `app/events/suggest-from-poster/index.tsx` | Close **X** + discard alert; **Continuer** identical on steps 1–3; Précédent / disabled CTA use surface tokens, not white-on-mint |
| Cover IA (generate step) | `src/components/events/CoverGenerateStep.tsx`, `CoverImageUploader`, `StagedProgressCard` | Tone chips surface/leaf; generate CTA leaf + `onAccent`; 2-try quota + candidate picker; hint under placeholder on step 1; staged loader (not a bare spinner) |
| Loading encarts (« on prépare… ») | `DiscoveryLoadingState`, `favorites` loading card, `ProposalLoadingState` | Dark `rgba(26,36,38)` panels + ink text = unreadable; use `surface` / `surfaceMuted`; `BrandLogoSpinner` fill loop, no Lucide badge |
| Poster / cover analysis timeline | `PosterAnalysisProgress`, `StagedProgressCard`, `app/events/suggest-from-poster/index.tsx` | Light `surface` card, leaf track + checks, ink percent; no dark skeleton or `#0f1719`; quota hint 2 analyses / suggestion |
| Bug report form | `app/bug-report.tsx` | Form panel / chips contrast |
| Contribution FAB | `src/components/events/ContributionFab.tsx`, `app/(tabs)/_layout.tsx` | Leaf fill, `onAccent` plus, mint border; draggable chat-head with throw inertia, then snap or peek on the left/right edge above the tab bar |
| Drawer logout | `app/(tabs)/_layout.tsx`, `app/(tabs)/profile.tsx` | Choice « Garder / Oublier cet appareil » before sign-out; not account deletion (SCRUM-71) |
| Mes suggestions | `src/screens/profile/MySuggestionsScreen.tsx` | Light cards + status chips; not dark ink sheets |
| Contribute sheet | `src/components/events/EventContributeSheet.tsx` | Light sheet + assistance row (bug reporter) |
| Photo communauté sheet | `src/components/events/EventPhotoContributionModal.tsx` | Same sheet tokens as “Y aller”: header `spacing.lg`, option rows 14/72 (SCRUM-80) |
| Event detail “Je note la date” | `src/screens/events/EventDetailScreen.tsx` | Leaf-tint chip (`brand.secondary`), distinct from the date-row expand tap (SCRUM-178) |
| Platform organizer sheet | `src/components/events/EventPlatformOrganizerSheet.tsx` | Light sheet; claim CTA only when organizer is Moments Locaux (SCRUM-36); copy agenda vs suggestion communautaire |
| Correction / doublon sheet | `src/components/events/EventCorrectionSheet.tsx` | Sheet bg + inputs + CTA leaf + duplicate candidate rows (SCRUM-120 / SCRUM-156) |
| Navigation (“Y aller”) sheet | `src/components/search/NavigationOptionsSheet.tsx` | Sheet bg + close + option rows |
| Proposal wizard | `src/screens/proposals/ProposalWizard.tsx` | Category colors (not all leaf); geocode / radius chips |
| Proposal deck distance chip | `src/screens/proposals/ProposalSwipeDeck.tsx` | Contrast on photo overlay |
| Create / suggest location picker | `src/components/events/LocationPickerModal.tsx` | Light outline « Localiser » next to the address field + surface map FAB; GPS fills address and flies the camera (SCRUM-45) |
| Suggestion / create location preview | `EventPreviewMiniMap`, `app/events/create/preview.tsx` | Pin as Mapbox CircleLayer; Camera `defaultSettings` + `onDidFinishLoadingMap` so Nyons is not Africa; map sits above the submit footer |
| Follows list location maps | `app/community/follows.tsx` | Static Mapbox image only when RPC allows; otherwise “Position non partagée” |
| Contact assistance | `app/contact.tsx` | Light settings form, leaf CTA, closed subjects matching website |
| Map unit overlay close / heart | `src/components/search/MapEventUnitOverlay.tsx` | Croix **haut-droit**, cœur **bas-droit** (pills light) — pas les deux en haut |
| EventCard social proof | `src/components/events/EventCard.tsx` | Liker avatar stack (follows first) + leaf count; empty copy only when 0 likes |
| Map markers | `src/components/map/CategoryEventMarker.tsx` | Harsh white stroke / disc halo behind the pin head (SVG), not a ground disc |
| Map selected marker | `src/components/map/MapWrapper.tsx` | Selection = enlarged pin only; no Mapbox `CircleLayer` halo at the pin tip |
| Map user-location puck | `src/components/map/MapWrapper.tsx` | Keep the native `LocationPuck`; React `UserLocation` heading layers race with style reloads |
| Map location/error banners | `app/(tabs)/map.tsx` | Light surface, readable status text and accessible retry/settings actions |
| Map search-area CTA / wide-area warning | `app/(tabs)/map.tsx` | Leaf CTA + small cancellation hint; amber warning is a tappable button that tightens the camera |
| Map viewport refine panel (status + categories) | `src/components/search/MapViewportRefinePanel.tsx` | FilterChip / StatusFilterRow tokens; surface under SearchBar, not dark ink |
| SearchBar modal text fields (Où / Quoi) | `src/components/search/SearchBar.tsx` | Framed mint inputs (`inputFramed`); not ghost white-on-white placeholders |
| Map style toggle (satellite) | `app/(tabs)/map.tsx` | Clustered with GPS recenter; surface chrome, not SearchBar sibling |
| Onboarding category cards | `src/components/onboarding/OnboardingThemesStep.tsx` | Borders `#334155`; select-all |
| Onboarding text fields | `src/screens/onboarding/OnboardingScreen.tsx`, `OnboardingConnectorStep.tsx` | No `lineHeight` on `TextInput`; extra bottom padding so descenders (g/p/y) are not clipped |
| Lumia chat | `src/screens/lumia/LumiaChatScreen.tsx` | Flag off = hidden; light bubbles, leaf send — no dark glass |
| Lumia first-run tour | `src/components/lumia/LumiaTourOverlay.tsx` | Light surface card, leaf CTA, ink text — not a dark glass sheet |
| Profile edit identity row | `src/screens/profile/ProfileEditScreen.tsx` | Hide “Profil : Particulier”; home location uses `LocationPickerModal` + leaf outline GPS CTA |
| Community invite | `src/screens/community/CommunityScreen.tsx` | Header “Inviter un ami” |
| Organizer avatar fallback | `src/constants/branding.ts` + assets | Keep in sync with app icon |
| App / store icon | `assets/images/icon.png`, `icon-meta-1024.png`, `app.config.ts`, native AppIcon | Rebuild after asset change |
| Welcome email | `docs/email-templates/` + Brevo | Out-of-app; still charter-bound |

## When closing a charter bug

1. Fix the reported surface.
2. Grep nearby siblings for the same dark-sheet / hardcode pattern.
3. Tick or extend this table if a new surface was involved.
4. Run `npm run typecheck` and `npm run lint`.
