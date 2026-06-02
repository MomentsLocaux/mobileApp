# 06 - Build / Release Audit

## Résumé exécutif

Le branding Expo principal est en place : `Moments Locaux`, slug `moments-locaux`, scheme `momentslocaux`, version `1.0.0`, bundle/package `com.momentslocs.app`. Les permissions ont été réduites. Il reste toutefois des points release importants : absence d'`eas.json`, nom package npm encore scaffold, divergence possible `app.config.ts`/`app.json`, pas de stratégie dev/staging/prod formalisée, et build numbers non définis explicitement.

Niveau actuel : bon pour dev local, incomplet pour release store reproductible.

## Constats

### Expo config

- `app.config.ts` est la source active dynamique.
- `app.json` existe encore avec une config partielle.
- `app.config.ts` définit `extra.supabaseUrl`, `supabaseAnonKey`, `mapboxToken`.
- Les secrets publics Expo sont injectés via `EXPO_PUBLIC_*`.

### Branding

- `name: Moments Locaux`.
- `slug: moments-locaux`.
- `scheme: momentslocaux`.
- `icon: ./assets/images/icon.png`.
- `favicon: ./assets/images/favicon.png`.
- `package.json` garde `name: bolt-expo-starter`.
- Le path natif iOS contient encore `ios/boltexponativewind/Info.plist`, ce qui peut rester un artefact de projet natif.

### Identifiants natifs

- iOS `bundleIdentifier: com.momentslocs.app`.
- Android `package: com.momentslocs.app`.
- Vérifier si `momentslocs` est volontaire ou typo de `momentslocaux`.

### Versioning

- Expo version `1.0.0`.
- Pas de `ios.buildNumber` explicite identifié.
- Pas de `android.versionCode` explicite identifié.
- Pas d'`eas.json` détecté.

### Permissions

- iOS : photos, camera, location, Face ID, schemes Waze/Google Maps.
- Android : coarse/fine location, camera, read media images, read external storage.
- Pas de `POST_NOTIFICATIONS` Android 13+ dans la config, à vérifier si push notifications réelles.

### Env et secrets

- `.env` existe localement et contient des secrets/keys.
- La service role key ne doit jamais être embarquée dans l'app.
- `app.config.ts` expose uniquement les valeurs publiques prévues.
- `src/data-provider/config.ts` exige `EXPO_PUBLIC_API_BASE_URL` si utilisé ; à confirmer selon usage réel.

### Scripts

- `npm run dev` lance `expo start`.
- `npm run lint` lance `expo lint`.
- `npm run typecheck` lance `tsc --noEmit`.
- `android` et `ios` utilisent `expo run:*`.
- Pas de script `prebuild`, `eas build`, ou `doctor` dédié.

### Compatibilité

- Expo SDK 54.
- React Native 0.81.5.
- `@rnmapbox/maps` nécessite config native et dev client/build native, pas Expo Go standard.
- `newArchEnabled: true` doit être validé avec Mapbox et bottom sheets sur appareils réels.

## Risques

- Build store non reproductible sans `eas.json`.
- Build numbers manquants bloquant upload ou releases suivantes.
- Confusion entre `app.config.ts` et `app.json`.
- Nom npm/package scaffold dans livrables internes.
- Service role accidentellement exposée via env/config.
- Permissions notifications manquantes si push utilisé.
- Artefacts natifs `bolt` donnant impression prototype.

## Recommandations

- Ajouter une stratégie EAS :
  - development
  - preview/staging
  - production
- Définir `ios.buildNumber` et `android.versionCode`.
- Clarifier `com.momentslocs.app` vs nom final.
- Renommer `package.json.name`.
- Décider si `app.json` reste comme fallback ou s'il doit être minimal/supprimé.
- Vérifier que `.env` n'est jamais commité et que service role n'est jamais lue par Expo.
- Ajouter un process release :
  - `npm run typecheck`
  - `npm run lint`
  - `npx expo config`
  - build preview
  - QA matrix
  - build production
- Vérifier assets icon/splash sur iOS/Android.

## Quick wins

- Renommer `package.json.name`.
- Ajouter `ios.buildNumber` et `android.versionCode`.
- Créer `eas.json`.
- Ajouter script `expo:config` ou `doctor`.
- Vérifier que la service role key n'est pas préfixée `EXPO_PUBLIC_`.
- Documenter env dev/staging/prod.

## Fichiers concernés

- `app.config.ts`
- `app.json`
- `package.json`
- `metro.config.js`
- `babel.config.js`
- `android/app/build.gradle`
- `android/app/src/main/res/values/strings.xml`
- `ios/boltexponativewind/Info.plist`
- `.env`

## Scénarios à tester

- `npm run typecheck`.
- `npm run lint`.
- `npx expo config`.
- Build iOS development.
- Build Android development.
- Build preview interne.
- Vérification icon/splash.
- Vérification permissions iOS.
- Vérification permissions Android 13+.
- Build sans `.env` local, via env CI/EAS.
- Vérification qu'aucune service role key n'est embarquée.

## Priorisation

### P0

- Empêcher toute exposition service role.
- Définir build numbers pour release.
- Valider build iOS/Android avec Mapbox/dev client.
- Vérifier permissions stores nécessaires.

### P1

- Ajouter `eas.json`.
- Renommer artefacts scaffold restants.
- Formaliser env dev/staging/prod.

### P2

- Automatiser release checklist.
- Ajouter monitoring build.
- Ajouter scripts CI.
