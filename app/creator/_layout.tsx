import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function CreatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.neutral[0],
        },
        headerTintColor: colors.neutral[900],
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
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
