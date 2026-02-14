import { Stack } from 'expo-router';
import { colors } from '@/components/ui/v2';

export default function CreatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.textPrimary,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Espace créateur',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Statistiques',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen
        name="fans"
        options={{
          title: 'Communauté',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Profil créateur',
          headerBackTitle: 'Retour',
        }}
      />
    </Stack>
  );
}
