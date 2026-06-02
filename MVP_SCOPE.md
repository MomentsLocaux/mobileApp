# MVP Scope

This branch prepares a tighter store-ready MVP for Moments Locaux. The goal is to keep the public app focused on reliable local-event discovery, creation, interaction, check-in, and moderation.

## Visible MVP Features

- Authentication: register, login, logout, persisted session.
- Onboarding: profile identity, role, location, avatar/cover, social links, bio.
- Map discovery: Mapbox map, visible-area event loading, search, filters, event preview, event details.
- Event browsing: home/list results, detail page, creator profile links, sharing.
- Event creation: multi-step creation, cover upload, location, date, category, media, draft/edit, moderation status.
- Social basics: favorites, likes/interests, follow creator/member, community profiles.
- Check-in: QR/location check-in through the Supabase Edge Function.
- Notifications: inbox, unread badge, notification routing.
- Moderation: admin/moderator dashboard and review screens.
- Profile basics: edit profile, my events, settings, bug report.

## Temporarily Hidden From Public Navigation

- Shop and purchase flows.
- Missions and deep gamification.
- Offers/subscriptions.
- Wallet and advanced Lumo display.
- Creator analytics dashboard and fan tools.
- Advanced settings placeholders: email/auth management, preferences, sessions, security, password change, data export.
- Journey/progression screen.

The route files remain in the repository for future work, but they are not exposed from the MVP drawer/settings/profile surfaces.

## Dormant Or Deferred Code

- `src/screens/events/EventCreateScreen.tsx` appears unreferenced by the current Expo Router flow. The active event creation flow lives under `app/events/create/*`.
- `src/store/authStore.ts` is exported from `src/store/index.ts`, but the active auth flow imports `src/state/auth.ts`.
- `apiProvider`, `ShopService.purchase`, `LumoService`, and `offersStore` are retained for post-MVP work. The local API URL was removed; legacy API calls now require `EXPO_PUBLIC_API_BASE_URL`.

## Critical Manual Test Matrix

- Create an account.
- Log in and log out.
- Complete onboarding.
- Search for an address.
- Display the map and nearby events.
- Search/filter events.
- Open an event detail page.
- Create an event with a cover image.
- Upload additional event media.
- Submit an event for moderation.
- Approve/publish an event from moderation.
- See the published event on map/list/detail.
- Add/remove favorite.
- Like/mark interest.
- Follow/unfollow a creator or member.
- Perform QR/location check-in.
- Report an event, comment, media, or profile.
- Review a report from moderation.
- Receive/open a notification.
- Open settings and edit profile.
- Trigger account deletion flow.

Run the matrix on iOS and Android real devices before store submission.

## Store Readiness Prerequisites

- Confirm final App Store / Play Store name, subtitle, screenshots, and descriptions.
- Confirm bundle/package identifiers and app ownership.
- Validate icons, splash, and store artwork.
- Verify iOS permission copy in a production build.
- Verify Android permissions shown in Play Console.
- Configure production Supabase, Mapbox, and optional `EXPO_PUBLIC_API_BASE_URL` values.
- Confirm account deletion is functional enough for store review.
- Run `npm run typecheck` and `npm run lint`.
- Build and smoke-test release/dev-client builds on iOS and Android.

## Post-MVP TODO

- Decide whether to delete or revive the legacy `EventCreateScreen`.
- Consolidate the duplicate auth store situation.
- Finish or remove placeholder settings screens.
- Reintroduce shop, missions, offers, wallet, and creator analytics only when the data and UX are production-ready.
- Add automated tests around auth, event creation, map search, moderation, and check-in.
