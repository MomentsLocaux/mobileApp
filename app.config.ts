import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { assertNoPublicSecrets } from './scripts/check-client-secrets.mjs';

const APP_VERSION = '1.0.0';
const IOS_BUILD_NUMBER = '3';
const ANDROID_VERSION_CODE = 1;

/** APNs entitlement is baked in at native build time, not Metro reload. */
const IS_STORE_PRODUCTION = process.env.APP_ENV === 'production';
const ADS_ENABLED = process.env.EXPO_PUBLIC_FEATURE_ADS === 'true';
/** Google's public sample app IDs. Production with ads must replace them via EAS. */
const GOOGLE_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID?.trim() || GOOGLE_TEST_ANDROID_APP_ID;
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID?.trim() || GOOGLE_TEST_IOS_APP_ID;
const TRACKING_USAGE_FR =
  'Moments Locaux utilise cet identifiant pour afficher des cartes publicitaires plus pertinentes, seulement si vous avez accepté les cartes personnalisées. Vous pouvez refuser.';

if (
  ADS_ENABLED &&
  IS_STORE_PRODUCTION &&
  (ADMOB_ANDROID_APP_ID === GOOGLE_TEST_ANDROID_APP_ID || ADMOB_IOS_APP_ID === GOOGLE_TEST_IOS_APP_ID)
) {
  throw new Error(
    'EXPO_PUBLIC_FEATURE_ADS is enabled for a production build without AdMob app IDs. Set ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID in EAS.',
  );
}
const APS_ENVIRONMENT = IS_STORE_PRODUCTION ? 'production' : 'development';

const CAMERA_USAGE_FR =
  'Moments Locaux utilise la caméra pour prendre des photos d’événements et illustrer vos contributions.';
const LOCATION_WHEN_IN_USE_FR =
  'Moments Locaux utilise votre position pour afficher les événements proches de vous sur la carte.';
const LOCATION_ALWAYS_FR =
  'Moments Locaux utilise votre position en arrière-plan pour vous prévenir des moments en cours ou bientôt près de vous. Vous pouvez désactiver cette option à tout moment.';
const CALENDAR_USAGE_FR =
  'Moments Locaux peut proposer d’ajouter un événement à votre calendrier. L’ajout se confirme dans l’app Calendrier.';
// Required by expo-calendar at native init even though the app never reads or writes reminders.
const REMINDERS_USAGE_FR =
  'Moments Locaux n’accède pas à vos rappels. Cette mention est exigée par le module calendrier iOS au démarrage.';

assertNoPublicSecrets(process.env);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Moments Locaux',
  slug: 'moments-locaux',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'moments-locaux',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
    // TestFlight stays on production APNs but must keep Google's test units.
    // Only the store profile sets ADS_PRODUCTION_UNITS.
    adsProductionBuild: process.env.ADS_PRODUCTION_UNITS === 'true',
    // Public EAS project id (not a secret). Override with EAS_PROJECT_ID if needed.
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'cdd0ac2d-c334-4aee-8bb9-e0cfb0771983',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.momentslocs.app',
    buildNumber: IOS_BUILD_NUMBER,
    usesAppleSignIn: true,
    entitlements: {
      // Local Metro / `eas build --profile development|preview*` stay `development`.
      // Only `eas build --profile production` (`APP_ENV=production`) uses production APNs.
      'aps-environment': APS_ENVIRONMENT,
      'com.apple.developer.applesignin': ['Default'],
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDataTypes',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
    },
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Moments Locaux utilise votre photothèque pour ajouter des images à votre profil ou à vos événements.',
      NSPhotoLibraryAddUsageDescription:
        'Moments Locaux peut enregistrer des images dans votre photothèque si vous le demandez.',
      NSCameraUsageDescription: CAMERA_USAGE_FR,
      NSCalendarsUsageDescription: CALENDAR_USAGE_FR,
      NSCalendarsFullAccessUsageDescription: CALENDAR_USAGE_FR,
      NSCalendarsWriteOnlyAccessUsageDescription: CALENDAR_USAGE_FR,
      NSRemindersUsageDescription: REMINDERS_USAGE_FR,
      NSRemindersFullAccessUsageDescription: REMINDERS_USAGE_FR,
      NSLocationWhenInUseUsageDescription: LOCATION_WHEN_IN_USE_FR,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_ALWAYS_FR,
      NSLocationAlwaysUsageDescription: LOCATION_ALWAYS_FR,
      UIBackgroundModes: ['location', 'remote-notification'],
      NSFaceIDUsageDescription:
        'Moments Locaux peut utiliser Face ID pour sécuriser la reconnexion à votre compte.',
      LSApplicationQueriesSchemes: ['waze', 'comgooglemaps'],
    },
  },
  android: {
    package: 'com.momentslocs.app',
    versionCode: ANDROID_VERSION_CODE,
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#F4FBF6',
    },
    // Required for FCM / Expo push on Android (file from Firebase Console).
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
      // Android 13+ runtime notification permission
      'android.permission.POST_NOTIFICATIONS',
      // Android 13+ requires READ_MEDIA_IMAGES instead of READ_EXTERNAL_STORAGE
      'android.permission.READ_MEDIA_IMAGES',
      // Backward compatibility for SDK < 33
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    '@rnmapbox/maps',
    'expo-notifications',
    'expo-apple-authentication',
    [
      'expo-calendar',
      {
        calendarPermission: CALENDAR_USAGE_FR,
        remindersPermission: REMINDERS_USAGE_FR,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS_FR,
        locationAlwaysPermission: LOCATION_ALWAYS_FR,
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE_FR,
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    ...(ADS_ENABLED
      ? [
          [
            'react-native-google-mobile-ads',
            {
              androidAppId: ADMOB_ANDROID_APP_ID,
              iosAppId: ADMOB_IOS_APP_ID,
              delayAppMeasurementInit: true,
              userTrackingUsageDescription: TRACKING_USAGE_FR,
              skAdNetworkItems: ['cstr6suwn9.skadnetwork'],
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
});
