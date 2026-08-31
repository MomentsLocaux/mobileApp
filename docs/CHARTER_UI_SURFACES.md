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
| Loading spinners | Any `ActivityIndicator`; prefer `colors.brand.secondary` | Legacy `primary[600]` / `#0f1719` |
| Loading encarts (« on prépare… ») | `DiscoveryLoadingState`, `favorites` loading card, `ProposalLoadingState` | Dark `rgba(26,36,38)` panels + ink text = unreadable; use `surface` / `surfaceMuted` |
| Bug report form | `app/bug-report.tsx` | Form panel / chips contrast |
| Photo communauté sheet | `src/components/events/EventPhotoContributionModal.tsx` | Sheet bg + text + close |
| Correction / doublon sheet | `src/components/events/EventCorrectionSheet.tsx` | Sheet bg + inputs + CTA leaf (SCRUM-120) |
| Navigation (“Y aller”) sheet | `src/components/search/NavigationOptionsSheet.tsx` | Sheet bg + close + option rows |
| Proposal wizard | `src/screens/proposals/ProposalWizard.tsx` | Category colors (not all leaf); geocode / radius chips |
| Proposal deck distance chip | `src/screens/proposals/ProposalSwipeDeck.tsx` | Contrast on photo overlay |
| Event detail header actions | `src/screens/events/EventDetailScreen.tsx` (`iconButton`, `routeButton`) | Dark glass on light chrome |
| Map unit overlay close / heart | `src/components/search/MapEventUnitOverlay.tsx` | Croix **haut-droit**, cœur **bas-droit** (pills light) — pas les deux en haut |
| Map event card footer | `src/components/events/EventCard.tsx` (`map-preview`) | Pure white footer → use muted surface |
| Map markers | `src/components/map/CategoryEventMarker.tsx` | Harsh white stroke / disc halo |
| Map location/error banners | `app/(tabs)/map.tsx` | Light surface, readable status text and accessible retry/settings actions |
| Map search-area CTA / wide-area warning | `app/(tabs)/map.tsx` | Leaf CTA + small cancellation hint; warning uses semantic light amber surface |
| Home “Voir sur la map” floating CTA | `src/screens/home/HomeScreen.tsx` | Keep above tab chrome; leaf fill with ink text and accessible result count |
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
