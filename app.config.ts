import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'bolt-expo-nativewind',
  slug: 'bolt-expo-nativewind',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.momentslocs.app',
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Lumo utilise votre photothèque pour sélectionner des images pour vos événements.',
      NSPhotoLibraryAddUsageDescription:
        'Lumo peut enregistrer des images dans votre photothèque si vous le demandez.',
      NSCameraUsageDescription:
        'Lumo a besoin d’accéder à votre caméra pour prendre des photos.',
    },
  },
  android: {
    package: 'com.momentslocs.app',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
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
  ],
  experiments: {
    typedRoutes: true,
  },
});
