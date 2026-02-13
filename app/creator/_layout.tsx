import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function CreatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.secondaryAccent[500],
        },
        headerTintColor: colors.textPrimary[500],
        headerTitleStyle: {
          fontWeight: '600',
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
