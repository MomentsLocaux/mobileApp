import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const forbiddenPublicSecretKeys = Object.keys(process.env).filter(
  (key) => key.startsWith('EXPO_PUBLIC_') && /(SERVICE|SECRET|PRIVATE)/i.test(key),
);

const APP_VERSION = '1.0.0';
const IOS_BUILD_NUMBER = '1';
const ANDROID_VERSION_CODE = 1;

if (forbiddenPublicSecretKeys.length > 0) {
  throw new Error(
    `Refusing to build with public secret-like env keys: ${forbiddenPublicSecretKeys.join(', ')}`,
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Moments Locaux',
  slug: 'moments-locaux',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'momentslocaux',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
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
      'aps-environment': 'development',
      'com.apple.developer.applesignin': ['Default'],
    },
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Moments Locaux utilise votre photothèque pour ajouter des images à votre profil ou à vos événements.',
      NSPhotoLibraryAddUsageDescription:
        'Moments Locaux peut enregistrer des images dans votre photothèque si vous le demandez.',
      NSCameraUsageDescription:
        'Moments Locaux utilise la caméra pour scanner les QR codes de check-in et prendre des photos d’événements.',
      NSLocationWhenInUseUsageDescription:
        'Moments Locaux utilise votre position pour afficher les événements proches et valider les check-ins.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Moments Locaux utilise votre position en arrière-plan pour repérer les lieux que vous visitez et enrichir Discovery. Vous pouvez désactiver cette option à tout moment.',
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
    // Required for FCM / Expo push on Android (file from Firebase Console).
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.CAMERA',
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
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Moments Locaux utilise votre position en arrière-plan pour repérer les lieux visités et enrichir Discovery. Vous pouvez désactiver cette option à tout moment.',
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
