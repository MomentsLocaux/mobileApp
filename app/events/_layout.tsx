import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function EventsLayout() {
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
          title: 'Détails de l\'événement',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: 'Créer un événement',
          headerBackTitle: 'Annuler',
        }}
      />
      <Stack.Screen
        name="create/step-1"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create/step-2"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
