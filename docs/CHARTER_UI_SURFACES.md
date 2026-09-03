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
| Loading encarts (« on prépare… ») | `DiscoveryLoadingState`, `favorites` loading card, `ProposalLoadingState` | Dark `rgba(26,36,38)` panels + ink text = unreadable; use `surface` / `surfaceMuted`; `BrandLogoSpinner` fill loop, no Lucide badge |
| Bug report form | `app/bug-report.tsx` | Form panel / chips contrast |
| Contribution FAB | `src/components/events/ContributionFab.tsx`, `app/(tabs)/_layout.tsx` | Leaf fill, `onAccent` plus, mint border; draggable chat-head with throw inertia, then snap or peek on the left/right edge above the tab bar |
| Mes suggestions | `src/screens/profile/MySuggestionsScreen.tsx` | Light cards + status chips; not dark ink sheets |
| Contribute sheet | `src/components/events/EventContributeSheet.tsx` | Light sheet + assistance row (bug reporter) |
| Photo communauté sheet | `src/components/events/EventPhotoContributionModal.tsx` | Sheet bg + text + close |
| Correction / doublon sheet | `src/components/events/EventCorrectionSheet.tsx` | Sheet bg + inputs + CTA leaf + duplicate candidate rows (SCRUM-120 / SCRUM-156) |
| Navigation (“Y aller”) sheet | `src/components/search/NavigationOptionsSheet.tsx` | Sheet bg + close + option rows |
| Proposal wizard | `src/screens/proposals/ProposalWizard.tsx` | Category colors (not all leaf); geocode / radius chips |
| Proposal deck distance chip | `src/screens/proposals/ProposalSwipeDeck.tsx` | Contrast on photo overlay |
| Event detail header actions | `src/screens/events/EventDetailScreen.tsx` (`iconButton`, `routeButton`) | Dark glass on light chrome |
| Map unit overlay close / heart | `src/components/search/MapEventUnitOverlay.tsx` | Croix **haut-droit**, cœur **bas-droit** (pills light) — pas les deux en haut |
| Map event card footer | `src/components/events/EventCard.tsx` (`map-preview`) | Pure white footer → use muted surface |
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
| Profile edit identity row | `src/screens/profile/ProfileEditScreen.tsx` | Hide “Profil : Particulier” |
| Community invite | `src/screens/community/CommunityScreen.tsx` | Header “Inviter un ami” |
| Organizer avatar fallback | `src/constants/branding.ts` + assets | Keep in sync with app icon |
| App / store icon | `assets/images/icon.png`, `icon-meta-1024.png`, `app.config.ts`, native AppIcon | Rebuild after asset change |
| Welcome email | `docs/email-templates/` + Brevo | Out-of-app; still charter-bound |

## When closing a charter bug

1. Fix the reported surface.
2. Grep nearby siblings for the same dark-sheet / hardcode pattern.
3. Tick or extend this table if a new surface was involved.
4. Run `npm run typecheck` and `npm run lint`.
